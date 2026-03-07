"""
Shield AI — Mental Health Signals and Alerts endpoints.

GET  /ai/{profile_id}/mental-health  — mental health risk signals for a profile
GET  /ai/alerts                      — platform-wide AI alerts above threshold
POST /ai/alerts/{alert_id}/feedback  — rate an alert for accuracy (stored in-memory)
"""
import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.queries import get_profile_stats
from services.risk_scorer import ProfileStats, generate_insights, calculate_addiction_score
from services.anomaly_service import detect_anomaly
from schemas.response import RiskLevel, InsightsResponse

router = APIRouter(prefix="/ai", tags=["alerts", "mental-health"])

# ── In-memory alert store (process lifetime) ─────────────────────────────────
# In production this would be backed by a DB or Redis.
_alerts: Dict[str, Dict[str, Any]] = {}
_alert_feedback: Dict[str, Dict[str, Any]] = {}


class MentalHealthSignal(BaseModel):
    category: str        # e.g. SLEEP_DISRUPTION, SOCIAL_ISOLATION, ANXIETY_INDICATOR
    description: str
    severity: RiskLevel
    detectedAt: datetime


class MentalHealthResponse(BaseModel):
    profileId: str
    overallRiskScore: int
    overallRiskLevel: RiskLevel
    mentalHealthSignals: List[MentalHealthSignal]
    recommendations: List[str]
    generatedAt: datetime


class AlertItem(BaseModel):
    id: str
    profileId: str
    alertType: str           # ANOMALY | RISK_THRESHOLD | MENTAL_HEALTH
    severity: RiskLevel
    score: float
    description: str
    detectedAt: datetime
    feedbackGiven: bool = False


class AlertFeedbackRequest(BaseModel):
    accurate: bool
    comment: Optional[str] = None


# ── GET /ai/{profile_id}/mental-health ───────────────────────────────────────

@router.get("/{profile_id}/mental-health", response_model=MentalHealthResponse)
async def get_mental_health(profile_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns mental health signals derived from AI behaviour analysis.
    Uses the same stats pipeline as insights but maps indicators to
    mental health categories with clinical-style labels.
    """
    raw_stats = await get_profile_stats(db, profile_id, None, None)

    if not raw_stats:
        # Return a low-risk default if no data available
        raw_stats = {
            "query_count": 0, "block_count": 0, "block_rate": 0.0,
            "unique_domains": 0, "adult_queries": 0, "social_queries": 0,
            "gaming_queries": 0, "after_hours_queries": 0, "new_domains": 0,
            "hour_of_day": 0, "day_of_week": 0
        }

    # Derive ProfileStats from raw_stats
    after_hours = raw_stats.get("after_hours_queries", 0)
    adult_queries = raw_stats.get("adult_queries", 0)
    gaming_queries = raw_stats.get("gaming_queries", 0)
    social_queries = raw_stats.get("social_queries", 0)
    block_rate = raw_stats.get("block_rate", 0.0)
    query_count = raw_stats.get("query_count", 0)

    stats = ProfileStats(
        profile_id=profile_id,
        late_night_session_count=1 if after_hours > 20 else (2 if after_hours > 50 else 0),
        schedule_violation_count=0,
        days_over_budget=0,
        bypass_attempt_count=0,
        usage_change_pct=0.0,
        adult_query_count=adult_queries,
    )
    insights = generate_insights(stats)
    addiction_score = calculate_addiction_score(stats)

    signals: List[MentalHealthSignal] = []
    now = datetime.utcnow()

    # Sleep disruption: high after-hours usage
    if after_hours > 30:
        signals.append(MentalHealthSignal(
            category="SLEEP_DISRUPTION",
            description=f"Significant internet activity detected outside normal hours "
                        f"({after_hours} queries). This may indicate disrupted sleep patterns.",
            severity=RiskLevel.HIGH if after_hours > 60 else RiskLevel.MEDIUM,
            detectedAt=now,
        ))

    # Gaming addiction risk
    if gaming_queries > 100:
        signals.append(MentalHealthSignal(
            category="GAMING_DEPENDENCY",
            description=f"High gaming-related activity ({gaming_queries} queries). "
                        f"Excessive gaming is associated with social withdrawal and mood changes.",
            severity=RiskLevel.HIGH if gaming_queries > 300 else RiskLevel.MEDIUM,
            detectedAt=now,
        ))

    # Social media over-engagement
    if social_queries > 200:
        signals.append(MentalHealthSignal(
            category="SOCIAL_MEDIA_OVERUSE",
            description=f"Heavy social media usage ({social_queries} queries). "
                        f"Overuse is linked to anxiety and reduced self-esteem in minors.",
            severity=RiskLevel.MEDIUM,
            detectedAt=now,
        ))

    # Seeking restricted content
    if adult_queries > 5:
        signals.append(MentalHealthSignal(
            category="INAPPROPRIATE_CONTENT_SEEKING",
            description=f"{adult_queries} attempts to access adult or restricted content detected. "
                        f"This may indicate curiosity-driven risk behaviour.",
            severity=RiskLevel.HIGH,
            detectedAt=now,
        ))

    # Very low usage (possible isolation)
    if query_count < 10 and query_count > 0:
        signals.append(MentalHealthSignal(
            category="REDUCED_ENGAGEMENT",
            description="Unusually low internet activity may indicate social withdrawal or device restriction bypass.",
            severity=RiskLevel.LOW,
            detectedAt=now,
        ))

    recommendations = []
    if insights.riskScore >= 60:
        recommendations.append("Consider scheduling a family check-in to discuss digital habits.")
    if any(s.category == "SLEEP_DISRUPTION" for s in signals):
        recommendations.append("Enable night-time schedule restrictions to improve sleep hygiene.")
    if any(s.category == "GAMING_DEPENDENCY" for s in signals):
        recommendations.append("Set daily time budgets for gaming-related domains.")
    if any(s.category == "SOCIAL_MEDIA_OVERUSE" for s in signals):
        recommendations.append("Review social media category limits in DNS filter settings.")
    if not recommendations:
        recommendations.append("No immediate action required. Continue monitoring weekly trends.")

    overall_score = insights.riskScore
    if overall_score >= 61:
        overall_level = RiskLevel.HIGH
    elif overall_score >= 31:
        overall_level = RiskLevel.MEDIUM
    else:
        overall_level = RiskLevel.LOW

    return MentalHealthResponse(
        profileId=profile_id,
        overallRiskScore=overall_score,
        overallRiskLevel=overall_level,
        mentalHealthSignals=signals,
        recommendations=recommendations,
        generatedAt=now,
    )


# ── GET /ai/alerts ────────────────────────────────────────────────────────────

@router.get("/alerts", response_model=List[AlertItem])
async def get_alerts(
    min_score: float = 0.3,
    severity: Optional[str] = None,
    limit: int = 50,
):
    """
    Returns the list of AI-generated alerts above the given score threshold.
    Alerts are generated during batch analysis (POST /ai/analyze/batch)
    and stored in-memory for the process lifetime.

    Query params:
    - min_score: minimum anomaly/risk score (0.0-1.0), default 0.3
    - severity: filter by LOW | MEDIUM | HIGH
    - limit: max results (default 50)
    """
    results = [
        AlertItem(**v) for v in _alerts.values()
        if v.get("score", 0) >= min_score
        and (severity is None or v.get("severity") == severity)
    ]
    results.sort(key=lambda x: x.score, reverse=True)
    return results[:limit]


# ── POST /ai/alerts/{alert_id}/feedback ──────────────────────────────────────

@router.post("/alerts/{alert_id}/feedback")
async def submit_alert_feedback(alert_id: str, body: AlertFeedbackRequest):
    """
    Rate an alert for accuracy. Feedback is stored in-memory and can be
    used to improve model thresholds.
    """
    if alert_id not in _alerts:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")

    _alert_feedback[alert_id] = {
        "alertId": alert_id,
        "accurate": body.accurate,
        "comment": body.comment,
        "submittedAt": datetime.utcnow().isoformat(),
    }
    # Mark alert as having feedback
    _alerts[alert_id]["feedbackGiven"] = True

    return {
        "alertId": alert_id,
        "status": "feedback_recorded",
        "accurate": body.accurate,
        "message": "Thank you for the feedback. It will be used to improve alert accuracy.",
    }


# ── Internal helper: register an alert (called from analysis pipeline) ────────

def register_alert(profile_id: str, alert_type: str, severity: str,
                   score: float, description: str) -> str:
    """
    Register a new alert in the in-memory store.
    Called by the batch analysis endpoint when anomalies are detected.
    Returns the alert ID.
    """
    import uuid
    alert_id = str(uuid.uuid4())
    _alerts[alert_id] = {
        "id": alert_id,
        "profileId": profile_id,
        "alertType": alert_type,
        "severity": severity,
        "score": score,
        "description": description,
        "detectedAt": datetime.utcnow().isoformat(),
        "feedbackGiven": False,
    }
    return alert_id
