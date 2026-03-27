import logging
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from db.queries import get_profile_stats
from services.anomaly_service import detect_anomaly
from schemas.request import BatchAnalysisRequest
from schemas.response import AnomalyResult

logger = logging.getLogger(__name__)
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
    result = detect_anomaly(features)

    # Register an alert if anomaly detected (decision_function returns negative for anomalies)
    if result.is_anomaly and result.score < -0.05:
        try:
            from routers.alerts import register_alert
            # Normalize to 0-1 (IsolationForest decision_function is negative for anomalies)
            normalized_score = min(abs(result.score) * 2, 1.0)
            register_alert(
                profile_id=str(request.profileId),
                alert_type="ANOMALY",
                severity=result.severity.value,
                score=normalized_score,
                description=f"Anomaly detected for profile {request.profileId} "
                            f"(score={normalized_score:.2f}, severity={result.severity.value}). "
                            f"Unusual internet usage pattern identified by IsolationForest model."
            )
        except Exception as e:
            logger.warning("Failed to register alert: %s", e)

    return result
