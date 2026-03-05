from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional
from schemas.response import RiskLevel, UsageTrend, WeeklyDigestResponse


@dataclass
class WeeklyStats:
    profile_id: str
    name: str
    usage_change_pct: float
    days_within_budget: int
    total_screen_hours: float
    tasks_completed: int
    reward_minutes_earned: int
    anomalies: List[str] = field(default_factory=list)
    block_count: int = 0
    late_night_sessions: int = 0


def generate_digest(stats: WeeklyStats) -> WeeklyDigestResponse:
    parts = []

    # Usage trend sentence
    if stats.usage_change_pct < -10:
        parts.append(
            f"{stats.name} had a good week — screen time was down "
            f"{abs(stats.usage_change_pct):.0f}% from last week."
        )
        trend = UsageTrend.DOWN
    elif stats.usage_change_pct > 20:
        parts.append(
            f"Screen time increased {stats.usage_change_pct:.0f}% this week for {stats.name}."
        )
        trend = UsageTrend.UP
    else:
        parts.append(f"{stats.name}'s screen time was about the same as last week.")
        trend = UsageTrend.STABLE

    # Budget compliance
    within = stats.days_within_budget
    if within >= 6:
        parts.append(f"They stayed within their daily limits on {within} out of 7 days — excellent!")
    elif within >= 4:
        parts.append(f"They stayed within limits on {within} out of 7 days.")
    else:
        parts.append(f"They exceeded their daily limits on {7 - within} days this week.")

    # Anomalies / concerns
    if not stats.anomalies:
        parts.append("No concerning patterns were detected.")
    else:
        for anomaly in stats.anomalies[:2]:
            parts.append(f"Note: {anomaly}")

    # Rewards
    if stats.tasks_completed > 0:
        parts.append(
            f"They completed {stats.tasks_completed} task(s) this week and earned "
            f"{stats.reward_minutes_earned} minutes of reward time."
        )

    # Risk scoring
    risk_score = _calculate_risk(stats)
    if risk_score >= 61:
        risk_level = RiskLevel.HIGH
    elif risk_score >= 31:
        risk_level = RiskLevel.MEDIUM
    else:
        risk_level = RiskLevel.LOW

    # Top insight
    if trend == UsageTrend.DOWN:
        top_insight = f"Screen time decreased by {abs(stats.usage_change_pct):.0f}% week-over-week."
    elif stats.late_night_sessions > 0:
        top_insight = f"Late-night usage detected on {stats.late_night_sessions} night(s)."
    elif stats.block_count > 50:
        top_insight = f"{stats.block_count} blocked requests this week."
    else:
        top_insight = f"Total screen time: {stats.total_screen_hours:.1f} hours this week."

    recommended_action = None
    if risk_level == RiskLevel.HIGH:
        recommended_action = "Review schedule settings and consider reducing daily screen time limits."
    elif stats.late_night_sessions >= 3:
        recommended_action = "Consider enabling Bedtime mode to block internet after 10pm."

    return WeeklyDigestResponse(
        profileId=stats.profile_id,
        weekOf=datetime.utcnow().strftime('%Y-%m-%d'),
        summary=" ".join(parts),
        riskLevel=risk_level,
        riskScore=risk_score,
        signals=stats.anomalies,
        usageTrend=trend,
        topInsight=top_insight,
        recommendedAction=recommended_action,
        generatedAt=datetime.utcnow(),
    )


def _calculate_risk(stats: WeeklyStats) -> int:
    score = 0
    score += min(25, stats.late_night_sessions * 5)
    score += min(20, max(0, 7 - stats.days_within_budget) * 3)
    score += min(15, len(stats.anomalies) * 5)
    if stats.usage_change_pct > 50:
        score += 15
    elif stats.usage_change_pct > 25:
        score += 8
    return min(100, score)
