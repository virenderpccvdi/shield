from dataclasses import dataclass
from typing import List
from schemas.response import RiskLevel, RiskIndicator, InsightsResponse
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

    return InsightsResponse(
        profileId=stats.profile_id,
        riskScore=risk_score,
        riskLevel=risk_level,
        indicators=indicators,
        addictionScore=addiction_score,
        mentalHealthSignals=[]
    )
