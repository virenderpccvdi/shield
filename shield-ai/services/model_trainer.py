"""
services/model_trainer.py
--------------------------
On-demand IsolationForest retraining pipeline using real DNS query log data.

Called from the /ai/train POST endpoint as a background task.
Status is written to /tmp/shield_training_status.json so the GET /ai/train/status
endpoint can poll it without holding a database connection.
"""

import json
import logging
import pickle
from datetime import datetime, timedelta
from pathlib import Path

import os
import asyncpg
import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)

MODEL_PATH = Path("/var/www/ai/FamilyShield/shield-ai/models/anomaly_model.pkl")
STATUS_FILE = Path("/tmp/shield_training_status.json")

# Minimum hourly buckets required before we'll train.
MIN_SAMPLES = 5  # lower threshold for early-stage deployments


def _update_status(status: str, progress: int, message: str | None) -> None:
    STATUS_FILE.write_text(
        json.dumps(
            {
                "status": status,
                "progress": progress,
                "message": message,
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
    )


async def run_retraining(days_back: int, db: AsyncSession = None) -> None:
    """Full retraining pipeline — runs as a FastAPI BackgroundTask.

    Stages
    ------
    1. Fetch per-profile hourly feature buckets from analytics.dns_query_logs.
    2. Validate we have enough data.
    3. Build normalised feature matrix.
    4. Train IsolationForest.
    5. Persist model to disk.
    6. Hot-reload the in-memory model in anomaly_service.
    7. Write completed status.
    """
    _update_status("training", 0, f"Fetching DNS log data for last {days_back} days…")
    logger.info("Model retraining started: days_back=%d", days_back)

    # Use raw asyncpg with explicit IP to avoid uvloop DNS resolution issues with 'localhost'
    db_host = os.getenv('DB_HOST', 'localhost')
    if db_host == 'localhost':
        db_host = '127.0.0.1'
    conn = await asyncpg.connect(
        host=db_host,
        port=int(os.getenv('DB_PORT', '5432')),
        database=os.getenv('DB_NAME', 'shield_db'),
        user=os.getenv('DB_USER', 'shield'),
        password=os.getenv('DB_PASSWORD', 'Shield@2026#Secure'),
        ssl=None,
    )
    try:
        await _run_retraining_inner(days_back, conn)
    finally:
        await conn.close()


async def _run_retraining_inner(days_back: int, db) -> None:
    """db is a raw asyncpg connection"""
    try:
        cutoff = datetime.utcnow() - timedelta(days=days_back)

        sql = """
            SELECT
                profile_id,
                DATE_TRUNC('hour', queried_at)                                   AS hour_bucket,
                COUNT(*)                                                          AS query_count,
                SUM(CASE WHEN action = 'BLOCKED'  THEN 1 ELSE 0 END)             AS block_count,
                COUNT(DISTINCT domain)                                            AS unique_domains,
                SUM(CASE WHEN EXTRACT(HOUR FROM queried_at) >= 22
                           OR EXTRACT(HOUR FROM queried_at) <  6
                         THEN 1 ELSE 0 END)                                      AS late_night_queries,
                SUM(CASE WHEN category IN (
                        'SOCIAL_MEDIA','SOCIAL_NETWORKS','SOCIAL')
                         THEN 1 ELSE 0 END)                                      AS social_queries,
                SUM(CASE WHEN category IN (
                        'GAMING','ONLINE_GAMING','GAMES')
                         THEN 1 ELSE 0 END)                                      AS gaming_queries,
                SUM(CASE WHEN category IN (
                        'STREAMING','VIDEO_STREAMING')
                         THEN 1 ELSE 0 END)                                      AS streaming_queries,
                SUM(CASE WHEN category IN (
                        'VPN_PROXY','PROXY','VPN')
                         THEN 1 ELSE 0 END)                                      AS vpn_queries
            FROM analytics.dns_query_logs
            WHERE queried_at >= $1
            GROUP BY profile_id, hour_bucket
            HAVING COUNT(*) >= 5
            ORDER BY hour_bucket
            """

        rows = await db.fetch(sql, cutoff)

        logger.info("Retraining: fetched %d hourly buckets from DB", len(rows))
        _update_status("training", 20, f"Fetched {len(rows)} hourly buckets from DB")

        # ------------------------------------------------------------------
        # Stage 2 — validate data sufficiency.
        # ------------------------------------------------------------------
        if len(rows) < MIN_SAMPLES:
            msg = (
                f"Insufficient data: got {len(rows)} hourly buckets, "
                f"need at least {MIN_SAMPLES}. "
                f"Extend the days_back window or wait for more usage data."
            )
            logger.warning("Retraining aborted: %s", msg)
            _update_status("failed", 100, msg)
            return

        # ------------------------------------------------------------------
        # Stage 3 — build normalised feature matrix.
        # Features (8):
        #   0  query_count_norm   — capped at 500, normalised 0-1
        #   1  block_rate         — blocked / total
        #   2  unique_domains_norm — capped at 200, normalised 0-1
        #   3  late_night_ratio   — late-night queries / total
        #   4  social_ratio       — social queries / total
        #   5  gaming_ratio       — gaming queries / total
        #   6  streaming_ratio    — streaming queries / total
        #   7  vpn_ratio          — vpn/proxy queries / total
        # ------------------------------------------------------------------
        X = []
        for row in rows:
            r = dict(row)
            qc = max(int(r.get('query_count') or 0), 1)
            features = [
                min(qc, 500) / 500.0,
                int(r.get('block_count') or 0) / qc,
                min(int(r.get('unique_domains') or 0), 200) / 200.0,
                int(r.get('late_night_queries') or 0) / qc,
                int(r.get('social_queries') or 0) / qc,
                int(r.get('gaming_queries') or 0) / qc,
                int(r.get('streaming_queries') or 0) / qc,
                int(r.get('vpn_queries') or 0) / qc,
            ]
            X.append(features)

        X_array = np.array(X, dtype=np.float32)
        logger.info("Feature matrix shape: %s", X_array.shape)
        _update_status("training", 50, f"Training IsolationForest on {len(X)} samples…")

        # ------------------------------------------------------------------
        # Stage 4 — train IsolationForest.
        # ------------------------------------------------------------------
        model = IsolationForest(
            n_estimators=200,
            max_samples="auto",
            contamination=0.05,
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X_array)
        logger.info("IsolationForest training complete")
        _update_status("training", 80, "Saving model to disk…")

        # ------------------------------------------------------------------
        # Stage 5 — persist to disk with metadata.
        # ------------------------------------------------------------------
        version_tag = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        model_data = {
            "model": model,
            "feature_names": [
                "query_count_norm",
                "block_rate",
                "unique_domains_norm",
                "late_night_ratio",
                "social_ratio",
                "gaming_ratio",
                "streaming_ratio",
                "vpn_ratio",
            ],
            "trained_at": datetime.utcnow().isoformat(),
            "training_samples": len(X),
            "days_back": days_back,
            "version": version_tag,
        }

        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(model_data, f)
        logger.info("Model saved: %s (version=%s)", MODEL_PATH, version_tag)

        # ------------------------------------------------------------------
        # Stage 6 — hot-reload in-memory model.
        # ------------------------------------------------------------------
        from services.anomaly_service import reload_model

        reload_model(model_data)

        # ------------------------------------------------------------------
        # Stage 7 — done.
        # ------------------------------------------------------------------
        _update_status(
            "completed",
            100,
            f"Trained on {len(X)} samples from last {days_back} days. "
            f"Version: {version_tag}",
        )
        logger.info("Retraining pipeline completed: version=%s", version_tag)

    except Exception as exc:
        logger.exception("Retraining pipeline failed: %s", exc)
        _update_status("failed", 100, str(exc))
        raise
