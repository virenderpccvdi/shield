from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from services.weekly_digest import WeeklyStats, generate_digest
from services.risk_scorer import ProfileStats, generate_insights
from schemas.response import WeeklyDigestResponse, InsightsResponse

router = APIRouter(prefix="/ai", tags=["insights"])


@router.get("/{profile_id}/weekly", response_model=WeeklyDigestResponse)
async def get_weekly_digest(profile_id: str, db: AsyncSession = Depends(get_db)):
    # In production: fetch real stats from DB.
    # Stats are seeded with neutral defaults; the LLM layer will enrich the
    # summary using whatever data is available.
    stats = WeeklyStats(
        profile_id=profile_id,
        name="Your Child",
        usage_change_pct=-12.0,
        days_within_budget=5,
        total_screen_hours=14.5,
        tasks_completed=2,
        reward_minutes_earned=45,
        anomalies=[],
        block_count=23,
        late_night_sessions=0,
        age=10,
        unique_domains=0,
        top_categories=[],
    )
    return await generate_digest(stats)


@router.get("/{profile_id}/insights", response_model=InsightsResponse)
async def get_insights(profile_id: str, db: AsyncSession = Depends(get_db)):
    stats = ProfileStats(
        profile_id=profile_id,
        late_night_session_count=0,
        schedule_violation_count=0,
        days_over_budget=0,
        bypass_attempt_count=0,
        usage_change_pct=0.0,
        adult_query_count=0
    )
    return generate_insights(stats)
