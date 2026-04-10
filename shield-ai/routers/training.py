"""
routers/training.py
--------------------
Endpoints for on-demand AI model retraining.

POST /ai/train        — kick off a background retraining job
GET  /ai/train/status — poll current job status (reads /tmp/shield_training_status.json)
"""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from services.model_trainer import run_retraining

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["training"])

STATUS_FILE = Path("/tmp/shield_training_status.json")


@router.post("/train")
async def retrain_model(
    days_back: int = Query(default=30, ge=7, le=90, description="Number of days of DNS log data to use"),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger IsolationForest retraining using real DNS query log data.

    The job runs in the background; poll **GET /ai/train/status** to track progress.

    - **days_back**: Window of historical data (7–90 days). More data = better model.
    """
    logger.info("Retraining requested: days_back=%d", days_back)
    background_tasks.add_task(run_retraining, days_back, db)
    return {
        "status": "training_started",
        "days_back": days_back,
        "message": (
            f"Retraining started in the background using the last {days_back} days of DNS data. "
            "Poll GET /ai/train/status for progress."
        ),
    }


@router.get("/train/status")
async def training_status():
    """
    Return the current training job status.

    Possible status values:
    - **idle** — no job has been run yet since service start
    - **training** — job in progress (check `progress` 0-100)
    - **completed** — last job succeeded
    - **failed** — last job failed (`message` contains the reason)
    """
    if STATUS_FILE.exists():
        try:
            return json.loads(STATUS_FILE.read_text())
        except Exception as exc:
            logger.warning("Could not read training status file: %s", exc)
            return {"status": "unknown", "message": "Status file unreadable", "progress": 0}

    return {"status": "idle", "last_trained": None, "progress": 0, "message": None}
