import logging
from fastapi import APIRouter, Depends, Request
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from db.queries import get_profile_week_stats
from services.weekly_digest import WeeklyStats, generate_digest
from services.risk_scorer import ProfileStats, generate_insights
from schemas.response import WeeklyDigestResponse, InsightsResponse
from limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["insights"])


@router.get("/{profile_id}/weekly", response_model=WeeklyDigestResponse)
@limiter.limit("30/minute")
async def get_weekly_digest(request: Request, profile_id: str, db: AsyncSession = Depends(get_db)):
    """Return an LLM-enhanced weekly digest using real DB stats where available."""
    week_stats = await get_profile_week_stats(db, profile_id)

    top_cats = [c["name"] for c in week_stats.get("top_categories", [])[:3]]
    total_allowed = week_stats.get("total_allowed", 0)
    total_blocked = week_stats.get("total_blocked", 0)
    late_night = week_stats.get("late_night_count", 0)

    # Rough screen-time hours estimate
    screen_hours = round((total_allowed + total_blocked) * 10 / 3600, 1)

    # Usage change pct vs previous week is not available without a second query;
    # use 0 as neutral default (LLM will still produce a useful summary).
    stats = WeeklyStats(
        profile_id=profile_id,
        name="Your Child",
        usage_change_pct=0.0,
        days_within_budget=max(0, 7 - week_stats.get("days_over_budget", 0)),
        total_screen_hours=screen_hours if week_stats.get("has_data") else 0.0,
        tasks_completed=0,
        reward_minutes_earned=0,
        anomalies=[],
        block_count=total_blocked,
        late_night_sessions=late_night,
        age=10,
        unique_domains=week_stats.get("unique_domains", 0),
        top_categories=top_cats,
        week_label=datetime.now(timezone.utc).strftime("Week of %B %d, %Y"),
    )
    return await generate_digest(stats)


@router.get("/{profile_id}/insights", response_model=InsightsResponse)
@limiter.limit("30/minute")
async def get_insights(request: Request, profile_id: str, db: AsyncSession = Depends(get_db)):
    """Return enriched AI insights using real DB stats where available.

    Falls back gracefully when no data exists (new profile).
    """
    week_stats = await get_profile_week_stats(db, profile_id)

    stats = ProfileStats(
        profile_id=profile_id,
        has_data=week_stats.get("has_data", False),
        total_allowed=week_stats.get("total_allowed", 0),
        total_blocked=week_stats.get("total_blocked", 0),
        late_night_session_count=week_stats.get("late_night_count", 0),
        schedule_violation_count=week_stats.get("schedule_violations", 0),
        days_over_budget=week_stats.get("days_over_budget", 0),
        bypass_attempt_count=week_stats.get("bypass_attempts", 0),
        usage_change_pct=0.0,
        adult_query_count=week_stats.get("adult_queries", 0),
        unique_domains=week_stats.get("unique_domains", 0),
        top_categories_raw=week_stats.get("top_categories", []),
        daily_trend_raw=week_stats.get("daily_trend", []),
    )
    return generate_insights(stats)
