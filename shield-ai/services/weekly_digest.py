"""
services/weekly_digest.py
--------------------------
Rule-based weekly digest generator with optional LLM enhancement.

generate_digest() is async so it can call the Claude API for a richer,
empathetic summary.  If the LLM call fails the rule-based summary is used
as the canonical `summary` field — behaviour is identical to the previous
synchronous version from the caller's perspective.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

from schemas.response import RiskLevel, UsageTrend, WeeklyDigestResponse

logger = logging.getLogger(__name__)


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
    # Optional — used for LLM context; defaults keep backwards-compat
    age: int = 10
    unique_domains: int = 0
    top_categories: List[str] = field(default_factory=list)
    week_label: str = ""


async def generate_digest(stats: WeeklyStats) -> WeeklyDigestResponse:
    """Build a weekly digest, optionally enhanced by Claude.

    Always returns a fully-populated WeeklyDigestResponse.
    The `llm_summary` field contains the Claude text when available;
    `rule_based_summary` always contains the deterministic text;
    `summary` is set to `llm_summary` when present, else `rule_based_summary`.
    """
    rule_based = _build_rule_based_summary(stats)
    risk_score = _calculate_risk(stats)

    if risk_score >= 61:
        risk_level = RiskLevel.HIGH
    elif risk_score >= 31:
        risk_level = RiskLevel.MEDIUM
    else:
        risk_level = RiskLevel.LOW

    trend = _usage_trend(stats.usage_change_pct)
    top_insight = _top_insight(stats, trend)
    recommended_action = _recommended_action(risk_level, stats)

    # ---------------------------------------------------------------
    # LLM enhancement — fire-and-forget on failure
    # ---------------------------------------------------------------
    llm_summary: Optional[str] = None
    try:
        from services.llm_digest import enhance_digest_with_llm

        llm_stats = {
            "week_label": stats.week_label or datetime.now(timezone.utc).strftime("Week of %B %d, %Y"),
            "total_hours": stats.total_screen_hours,
            "change_pct": stats.usage_change_pct,
            "days_within_budget": stats.days_within_budget,
            "unique_domains": stats.unique_domains,
            "blocks_total": stats.block_count,
            "top_categories": stats.top_categories,
            "late_night_sessions": stats.late_night_sessions,
            "tasks_completed": stats.tasks_completed,
            "reward_minutes": stats.reward_minutes_earned,
        }
        llm_summary = await enhance_digest_with_llm(
            child_name=stats.name,
            age=stats.age,
            stats=llm_stats,
            anomalies=stats.anomalies,
            risk_score=risk_score,
        )
    except Exception as exc:
        logger.warning("LLM enhancement skipped: %s", exc)

    summary = llm_summary if llm_summary else rule_based

    return WeeklyDigestResponse(
        profileId=stats.profile_id,
        weekOf=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        summary=summary,
        llm_summary=llm_summary,
        rule_based_summary=rule_based,
        riskLevel=risk_level,
        riskScore=risk_score,
        signals=stats.anomalies,
        usageTrend=trend,
        topInsight=top_insight,
        recommendedAction=recommended_action,
        generatedAt=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _build_rule_based_summary(stats: WeeklyStats) -> str:
    parts: List[str] = []

    # Usage trend sentence
    if stats.usage_change_pct < -10:
        parts.append(
            f"{stats.name} had a good week — screen time was down "
            f"{abs(stats.usage_change_pct):.0f}% from last week."
        )
    elif stats.usage_change_pct > 20:
        parts.append(
            f"Screen time increased {stats.usage_change_pct:.0f}% this week for {stats.name}."
        )
    else:
        parts.append(f"{stats.name}'s screen time was about the same as last week.")

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

    return " ".join(parts)


def _usage_trend(change_pct: float) -> UsageTrend:
    if change_pct < -10:
        return UsageTrend.DOWN
    if change_pct > 20:
        return UsageTrend.UP
    return UsageTrend.STABLE


def _top_insight(stats: WeeklyStats, trend: UsageTrend) -> str:
    if trend == UsageTrend.DOWN:
        return f"Screen time decreased by {abs(stats.usage_change_pct):.0f}% week-over-week."
    if stats.late_night_sessions > 0:
        return f"Late-night usage detected on {stats.late_night_sessions} night(s)."
    if stats.block_count > 50:
        return f"{stats.block_count} blocked requests this week."
    return f"Total screen time: {stats.total_screen_hours:.1f} hours this week."


def _recommended_action(risk_level: RiskLevel, stats: WeeklyStats) -> Optional[str]:
    if risk_level == RiskLevel.HIGH:
        return "Review schedule settings and consider reducing daily screen time limits."
    if stats.late_night_sessions >= 3:
        return "Consider enabling Bedtime mode to block internet after 10 pm."
    return None


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
