from dataclasses import dataclass, field
from typing import List, Dict, Any
from schemas.response import (
    RiskLevel, RiskIndicator, InsightsResponse,
    CategoryStat, Recommendation, AnomalyEvent, DayTrend,
)
from datetime import datetime


@dataclass
class ProfileStats:
    profile_id: str
    late_night_session_count: int = 0
    schedule_violation_count: int = 0
    days_over_budget: int = 0
    bypass_attempt_count: int = 0
    usage_change_pct: float = 0.0
    adult_query_count: int = 0
    # enriched fields fed from DB
    has_data: bool = False
    total_allowed: int = 0
    total_blocked: int = 0
    unique_domains: int = 0
    top_categories_raw: List[Dict[str, Any]] = field(default_factory=list)
    daily_trend_raw: List[Dict[str, Any]] = field(default_factory=list)


def calculate_addiction_score(stats: ProfileStats) -> int:
    score = 0
    score += min(25, stats.late_night_session_count * 5)
    score += min(20, stats.schedule_violation_count * 4)
    score += min(20, stats.days_over_budget * 3)
    score += min(20, stats.bypass_attempt_count * 10)
    if stats.usage_change_pct > 50:
        score += 15
    elif stats.usage_change_pct > 25:
        score += 8
    return min(100, score)


def _build_recommendations(stats: ProfileStats, risk_level: RiskLevel) -> List[Recommendation]:
    recs: List[Recommendation] = []

    if stats.late_night_session_count >= 2:
        recs.append(Recommendation(
            type="schedule",
            title="Enable Bedtime Mode",
            description=(
                f"Internet activity was detected late at night on {stats.late_night_session_count} "
                "occasions this week. Enabling a bedtime schedule can improve sleep quality."
            ),
            icon="bedtime",
        ))

    if stats.bypass_attempt_count > 0:
        recs.append(Recommendation(
            type="block",
            title="Tighten VPN/Proxy Blocking",
            description=(
                f"{stats.bypass_attempt_count} attempt(s) to use a VPN or proxy were detected. "
                "Ensure the Bypass category is blocked at STRICT level."
            ),
            icon="vpn_lock",
        ))

    if stats.adult_query_count > 3:
        recs.append(Recommendation(
            type="block",
            title="Review Content Filters",
            description=(
                f"{stats.adult_query_count} attempts to access adult content were blocked. "
                "Consider upgrading the filter profile to STRICT."
            ),
            icon="shield",
        ))

    # Gaming category spike
    gaming = next(
        (c for c in stats.top_categories_raw
         if c.get("name", "").upper() in ("GAMING", "GAMES")), None
    )
    if gaming and gaming.get("allowed", 0) > 200:
        recs.append(Recommendation(
            type="limit",
            title="Set Gaming Time Limit",
            description=(
                f"Gaming queries are high this week ({gaming['allowed']} allowed). "
                "Consider setting a daily time limit for the Gaming category."
            ),
            icon="sports_esports",
        ))

    # Social media spike
    social = next(
        (c for c in stats.top_categories_raw
         if c.get("name", "").upper() in ("SOCIAL_MEDIA", "SOCIAL MEDIA")), None
    )
    if social and social.get("allowed", 0) > 150:
        recs.append(Recommendation(
            type="limit",
            title="Review Social Media Usage",
            description=(
                f"Social media activity is elevated ({social['allowed']} queries allowed). "
                "Consider scheduling social media blocks during homework hours."
            ),
            icon="people",
        ))

    if risk_level == RiskLevel.LOW and not recs:
        recs.append(Recommendation(
            type="reward",
            title="Reward Good Behavior",
            description=(
                "Activity patterns look healthy this week! "
                "Consider rewarding your child with extra screen time."
            ),
            icon="star",
        ))

    return recs[:4]  # cap at 4


def _build_anomaly_events(stats: ProfileStats) -> List[AnomalyEvent]:
    events: List[AnomalyEvent] = []
    now = datetime.utcnow().isoformat() + "Z"

    if stats.late_night_session_count >= 3:
        events.append(AnomalyEvent(
            severity=RiskLevel.MEDIUM if stats.late_night_session_count < 5 else RiskLevel.HIGH,
            description=f"Unusual late-night browsing on {stats.late_night_session_count} nights this week.",
            detectedAt=now,
        ))

    if stats.bypass_attempt_count > 0:
        events.append(AnomalyEvent(
            severity=RiskLevel.HIGH,
            description=f"{stats.bypass_attempt_count} VPN/proxy bypass attempt(s) detected.",
            detectedAt=now,
        ))

    if stats.adult_query_count > 5:
        events.append(AnomalyEvent(
            severity=RiskLevel.HIGH,
            description=f"{stats.adult_query_count} attempts to access adult content blocked.",
            detectedAt=now,
        ))

    if stats.days_over_budget >= 4:
        events.append(AnomalyEvent(
            severity=RiskLevel.MEDIUM,
            description=f"Daily screen time budget exceeded on {stats.days_over_budget} days.",
            detectedAt=now,
        ))

    return events


def _estimate_screen_minutes(stats: ProfileStats) -> int:
    """Rough estimate: each DNS query ~= 10 seconds of browsing time."""
    total_queries = stats.total_allowed + stats.total_blocked
    return int(total_queries * 10 / 60)  # convert seconds to minutes


def generate_insights(stats: ProfileStats) -> InsightsResponse:
    indicators: List[RiskIndicator] = []

    if stats.late_night_session_count >= 3:
        indicators.append(RiskIndicator(
            type="LATE_NIGHT_USAGE",
            description=f"Internet usage detected after 11pm on {stats.late_night_session_count} nights this week",
            severity=RiskLevel.MEDIUM if stats.late_night_session_count < 5 else RiskLevel.HIGH,
            detectedAt=datetime.utcnow()
        ))

    if stats.schedule_violation_count > 0:
        indicators.append(RiskIndicator(
            type="SCHEDULE_VIOLATIONS",
            description=f"{stats.schedule_violation_count} attempts to access internet outside allowed hours",
            severity=RiskLevel.LOW if stats.schedule_violation_count < 5 else RiskLevel.MEDIUM,
            detectedAt=datetime.utcnow()
        ))

    if stats.bypass_attempt_count > 0:
        indicators.append(RiskIndicator(
            type="BYPASS_ATTEMPTS",
            description=f"{stats.bypass_attempt_count} VPN/proxy bypass attempt(s) detected",
            severity=RiskLevel.HIGH,
            detectedAt=datetime.utcnow()
        ))

    if stats.adult_query_count > 5:
        indicators.append(RiskIndicator(
            type="ADULT_CONTENT_ATTEMPTS",
            description=f"{stats.adult_query_count} attempts to access adult content this week",
            severity=RiskLevel.HIGH,
            detectedAt=datetime.utcnow()
        ))

    addiction_score = calculate_addiction_score(stats)
    risk_score = addiction_score

    if risk_score >= 61:
        risk_level = RiskLevel.HIGH
    elif risk_score >= 31:
        risk_level = RiskLevel.MEDIUM
    else:
        risk_level = RiskLevel.LOW

    # Mental health signals
    mental_health: List[str] = []
    if stats.late_night_session_count >= 3:
        mental_health.append("Disrupted sleep pattern detected")
    if stats.usage_change_pct > 40:
        mental_health.append("Significant increase in screen time")

    # Enriched fields
    screen_time = _estimate_screen_minutes(stats)
    daily_avg = screen_time // 7 if stats.has_data else 0

    # Convert raw categories to typed models
    top_categories = [
        CategoryStat(
            name=c.get("name", "OTHER"),
            minutes=int((c.get("allowed", 0)) * 10 / 60),
            blocked=c.get("blocked", 0),
        )
        for c in stats.top_categories_raw[:5]
    ]

    # Convert daily trend
    weekly_trend = [
        DayTrend(date=d["date"], allowed=d["allowed"], blocked=d["blocked"])
        for d in stats.daily_trend_raw
    ]

    # Build summary string
    if not stats.has_data:
        summary = "Collecting data... AI insights will be available after 24 hours of usage."
    elif risk_level == RiskLevel.LOW:
        summary = "Activity patterns look healthy this week. No major concerns detected."
    elif risk_level == RiskLevel.MEDIUM:
        summary = "Some patterns worth watching. Check the recommendations below."
    else:
        summary = "Several risk indicators detected this week. Review the alerts and take action."

    recommendations = _build_recommendations(stats, risk_level)
    anomaly_events = _build_anomaly_events(stats)

    return InsightsResponse(
        profileId=stats.profile_id,
        riskScore=risk_score,
        riskLevel=risk_level,
        indicators=indicators,
        addictionScore=addiction_score,
        mentalHealthSignals=mental_health,
        hasData=stats.has_data,
        screenTimeMinutes=screen_time,
        dailyAvgMinutes=daily_avg,
        totalBlocked=stats.total_blocked,
        topCategories=top_categories,
        recommendations=recommendations,
        anomalies=anomaly_events,
        weeklyTrend=weekly_trend,
        summary=summary,
    )
