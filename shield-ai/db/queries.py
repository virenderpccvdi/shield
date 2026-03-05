from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime
from typing import Optional


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
