from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any


async def get_profile_stats(
    db: AsyncSession,
    profile_id: str,
    period_start: datetime,
    period_end: datetime
) -> dict:
    """Fetch aggregated DNS query stats for anomaly detection."""
    try:
        result = await db.execute(text("""
            SELECT
                COUNT(*) AS query_count,
                SUM(CASE WHEN action = 'BLOCKED' THEN 1 ELSE 0 END) AS block_count,
                COUNT(DISTINCT domain) AS unique_domains,
                SUM(CASE WHEN category = 'ADULT' THEN 1 ELSE 0 END) AS adult_queries,
                SUM(CASE WHEN category = 'SOCIAL_MEDIA' THEN 1 ELSE 0 END) AS social_queries,
                SUM(CASE WHEN category IN ('GAMING','GAMES') THEN 1 ELSE 0 END) AS gaming_queries,
                EXTRACT(HOUR FROM :period_start) AS hour_of_day,
                EXTRACT(DOW FROM :period_start) AS day_of_week
            FROM analytics.dns_query_logs
            WHERE profile_id = :profile_id
              AND queried_at BETWEEN :period_start AND :period_end
        """), {"profile_id": profile_id, "period_start": period_start, "period_end": period_end})
        row = result.fetchone()
        if not row:
            return {}
        return {
            "query_count": int(row.query_count or 0),
            "block_count": int(row.block_count or 0),
            "block_rate": float(row.block_count or 0) / max(1, int(row.query_count or 1)),
            "unique_domains": int(row.unique_domains or 0),
            "adult_queries": int(row.adult_queries or 0),
            "social_queries": int(row.social_queries or 0),
            "gaming_queries": int(row.gaming_queries or 0),
            "after_hours_queries": 0,
            "new_domains": 0,
            "hour_of_day": int(row.hour_of_day or 0),
            "day_of_week": int(row.day_of_week or 0),
        }
    except Exception:
        return {}


async def get_profile_week_stats(
    db: AsyncSession,
    profile_id: str,
) -> Dict[str, Any]:
    """Fetch enriched weekly stats for the AI insights endpoint.

    Returns a dict with:
      - total_allowed, total_blocked, late_night_count, schedule_violations,
        bypass_attempts, adult_queries, days_over_budget,
        top_categories: [{name, allowed, blocked}],
        daily_trend: [{date, allowed, blocked}] for last 7 days,
        has_data: bool (False when no rows found)
    """
    period_start = datetime.utcnow() - timedelta(days=7)
    period_end = datetime.utcnow()

    empty: Dict[str, Any] = {
        "has_data": False,
        "total_allowed": 0,
        "total_blocked": 0,
        "late_night_count": 0,
        "schedule_violations": 0,
        "bypass_attempts": 0,
        "adult_queries": 0,
        "days_over_budget": 0,
        "top_categories": [],
        "daily_trend": [],
        "unique_domains": 0,
    }

    try:
        # ── Aggregate totals ──────────────────────────────────────────────────
        agg_result = await db.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE action = 'ALLOWED') AS total_allowed,
                COUNT(*) FILTER (WHERE action = 'BLOCKED')  AS total_blocked,
                COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM queried_at) >= 22
                                    OR EXTRACT(HOUR FROM queried_at) < 6)  AS late_night_count,
                COUNT(*) FILTER (WHERE action = 'BLOCKED'
                                    AND category IN ('ADULT','ADULT_CONTENT','PORN')) AS adult_queries,
                COUNT(*) FILTER (WHERE action = 'BLOCKED'
                                    AND category IN ('VPN','PROXY','BYPASS')) AS bypass_attempts,
                COUNT(DISTINCT DATE(queried_at))                            AS active_days,
                COUNT(DISTINCT domain)                                      AS unique_domains
            FROM analytics.dns_query_logs
            WHERE profile_id = :profile_id
              AND queried_at BETWEEN :start AND :end
        """), {"profile_id": profile_id, "start": period_start, "end": period_end})
        agg = agg_result.fetchone()
        if not agg or int(agg.total_allowed or 0) + int(agg.total_blocked or 0) == 0:
            return empty

        # ── Top categories ────────────────────────────────────────────────────
        cat_result = await db.execute(text("""
            SELECT
                COALESCE(category, 'OTHER')                                          AS name,
                COUNT(*) FILTER (WHERE action = 'ALLOWED')                           AS allowed,
                COUNT(*) FILTER (WHERE action = 'BLOCKED')                           AS blocked
            FROM analytics.dns_query_logs
            WHERE profile_id = :profile_id
              AND queried_at BETWEEN :start AND :end
              AND category IS NOT NULL
            GROUP BY category
            ORDER BY (COUNT(*) FILTER (WHERE action = 'ALLOWED') +
                      COUNT(*) FILTER (WHERE action = 'BLOCKED')) DESC
            LIMIT 6
        """), {"profile_id": profile_id, "start": period_start, "end": period_end})
        cats = [
            {"name": row.name, "allowed": int(row.allowed or 0), "blocked": int(row.blocked or 0)}
            for row in cat_result.fetchall()
        ]

        # ── Daily trend (7 days) ──────────────────────────────────────────────
        trend_result = await db.execute(text("""
            SELECT
                DATE(queried_at)                                           AS day,
                COUNT(*) FILTER (WHERE action = 'ALLOWED')                AS allowed,
                COUNT(*) FILTER (WHERE action = 'BLOCKED')                AS blocked
            FROM analytics.dns_query_logs
            WHERE profile_id = :profile_id
              AND queried_at BETWEEN :start AND :end
            GROUP BY DATE(queried_at)
            ORDER BY day
        """), {"profile_id": profile_id, "start": period_start, "end": period_end})
        day_rows = {str(row.day): {"allowed": int(row.allowed or 0), "blocked": int(row.blocked or 0)}
                    for row in trend_result.fetchall()}

        # Fill missing days with zeros so we always return 7 entries
        trend = []
        for i in range(7, 0, -1):
            d = (datetime.utcnow() - timedelta(days=i)).date()
            key = str(d)
            trend.append({
                "date": key,
                "allowed": day_rows.get(key, {}).get("allowed", 0),
                "blocked": day_rows.get(key, {}).get("blocked", 0),
            })

        # ── Days over budget (days where blocked > 50% of total) ─────────────
        days_over = sum(
            1 for d in trend
            if (d["allowed"] + d["blocked"]) > 0
            and d["blocked"] / (d["allowed"] + d["blocked"]) > 0.35
        )

        return {
            "has_data": True,
            "total_allowed": int(agg.total_allowed or 0),
            "total_blocked": int(agg.total_blocked or 0),
            "late_night_count": int(agg.late_night_count or 0),
            "schedule_violations": 0,   # populated by schedule service
            "bypass_attempts": int(agg.bypass_attempts or 0),
            "adult_queries": int(agg.adult_queries or 0),
            "days_over_budget": days_over,
            "unique_domains": int(agg.unique_domains or 0),
            "top_categories": cats,
            "daily_trend": trend,
        }

    except Exception:
        return empty
