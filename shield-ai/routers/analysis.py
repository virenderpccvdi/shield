from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from db.queries import get_profile_stats
from services.anomaly_service import detect_anomaly
from schemas.request import BatchAnalysisRequest
from schemas.response import AnomalyResult

router = APIRouter(prefix="/ai", tags=["analysis"])


@router.post("/analyze/batch", response_model=AnomalyResult)
async def analyze_batch(
    request: BatchAnalysisRequest,
    db: AsyncSession = Depends(get_db)
):
    features = await get_profile_stats(
        db, str(request.profileId), request.periodStart, request.periodEnd
    )
    if not features:
        features = {
            "query_count": 0, "block_count": 0, "block_rate": 0.0,
            "unique_domains": 0, "adult_queries": 0, "social_queries": 0,
            "gaming_queries": 0, "after_hours_queries": 0, "new_domains": 0,
            "hour_of_day": 0, "day_of_week": 0
        }
    return detect_anomaly(features)
