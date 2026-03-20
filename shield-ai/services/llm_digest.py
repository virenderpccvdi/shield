"""
services/llm_digest.py
-----------------------
Generates warm, empathetic, parent-friendly weekly digests using an LLM.

Primary provider: DeepSeek (configurable via AI_PROVIDER env var).
Fallback:         Anthropic Claude.

Any failure (network, quota, API error) returns None so the caller can
fall back gracefully to the rule-based digest.
"""

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy Anthropic client (only imported when needed to avoid startup crash
# when the anthropic package key is absent).
# ---------------------------------------------------------------------------
_anthropic_client = None


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic  # noqa: import only when needed
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        _anthropic_client = anthropic.Anthropic(api_key=api_key)
    return _anthropic_client


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def enhance_digest_with_llm(
    child_name: str,
    age: int,
    stats: dict,
    anomalies: list,
    risk_score: int,
) -> Optional[str]:
    """
    Call the configured LLM to generate a 3-4 sentence, human-readable
    weekly summary for a parent.

    Parameters
    ----------
    child_name  : First name of the child.
    age         : Child's age in years (adjusts tone).
    stats       : Weekly stats dict — keys: week_label, total_hours,
                  change_pct, days_within_budget, unique_domains,
                  blocks_total, top_categories, late_night_sessions,
                  tasks_completed, reward_minutes.
    anomalies   : Human-readable anomaly strings.
    risk_score  : 0-100 risk score.

    Returns
    -------
    str or None — LLM summary or None on failure.
    """
    prompt = _build_prompt(child_name, age, stats, anomalies, risk_score)
    provider = os.getenv("AI_PROVIDER", "DEEPSEEK").upper()

    if provider == "DEEPSEEK":
        result = await _call_deepseek(prompt, child_name)
        if result is not None:
            return result
        logger.info("DeepSeek failed for %s — trying Anthropic fallback", child_name)
        return await _call_anthropic(prompt, child_name)

    if provider == "ANTHROPIC":
        result = await _call_anthropic(prompt, child_name)
        if result is not None:
            return result
        logger.info("Anthropic failed for %s — trying DeepSeek fallback", child_name)
        return await _call_deepseek(prompt, child_name)

    # Unknown provider — try DeepSeek as safe default
    logger.warning("Unknown AI_PROVIDER=%s — falling back to DeepSeek", provider)
    return await _call_deepseek(prompt, child_name)


# ---------------------------------------------------------------------------
# Provider implementations
# ---------------------------------------------------------------------------

async def _call_deepseek(prompt: str, child_name: str) -> Optional[str]:
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        logger.debug("DEEPSEEK_API_KEY not set — skipping DeepSeek call")
        return None

    model   = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
    base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    url      = f"{base_url.rstrip('/')}/chat/completions"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type":  "application/json",
                },
                json={
                    "model":      model,
                    "messages":   [{"role": "user", "content": prompt}],
                    "max_tokens": 220,
                },
            )
            response.raise_for_status()
            text = response.json()["choices"][0]["message"]["content"].strip()
            logger.info("DeepSeek digest generated for %s (%d chars)", child_name, len(text))
            return text
    except Exception as exc:
        logger.warning("DeepSeek digest failed for %s: %s", child_name, exc)
        return None


async def _call_anthropic(prompt: str, child_name: str) -> Optional[str]:
    try:
        client = _get_anthropic_client()
        model  = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
        message = client.messages.create(
            model=model,
            max_tokens=220,
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text.strip()
        logger.info("Anthropic digest generated for %s (%d chars)", child_name, len(text))
        return text
    except Exception as exc:
        logger.warning("Anthropic digest failed for %s: %s", child_name, exc)
        return None


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_prompt(child_name: str, age: int, stats: dict,
                  anomalies: list, risk_score: int) -> str:
    if risk_score < 30:
        risk_label = "LOW - all good!"
    elif risk_score < 60:
        risk_label = "MEDIUM - some concerns"
    else:
        risk_label = "HIGH - attention needed"

    top_categories = stats.get("top_categories", [])
    top_cats_str   = ", ".join(top_categories[:3]) if top_categories else "not available"
    anomalies_str  = ", ".join(anomalies) if anomalies else "None — great week!"

    return (
        f"You are a child safety assistant helping parents understand their child's internet usage.\n\n"
        f"Child: {child_name}, Age: {age}\n"
        f"Week: {stats.get('week_label', 'This week')}\n\n"
        f"USAGE STATISTICS:\n"
        f"- Total screen time: {stats.get('total_hours', 0):.1f} hours "
        f"({stats.get('change_pct', 0):+.0f}% vs last week)\n"
        f"- Days within time budget: {stats.get('days_within_budget', 0)}/7\n"
        f"- Total sites visited: {stats.get('unique_domains', 0)}\n"
        f"- Sites blocked: {stats.get('blocks_total', 0)}\n"
        f"- Top categories: {top_cats_str}\n"
        f"- Late night usage (after 10 pm): {stats.get('late_night_sessions', 0)} sessions\n"
        f"- Reward tasks completed: {stats.get('tasks_completed', 0)}\n"
        f"- Reward minutes earned: {stats.get('reward_minutes', 0)}\n\n"
        f"RISK SCORE: {risk_score}/100 ({risk_label})\n\n"
        f"DETECTED PATTERNS: {anomalies_str}\n\n"
        f"Write a 3-4 sentence weekly summary for the parent. "
        f"Be warm, specific, and actionable.\n"
        f"- If risk is low: celebrate good behaviour\n"
        f"- If risk is medium: mention concerns gently, suggest one action\n"
        f"- If risk is high: be direct but supportive, suggest 2 concrete steps\n"
        f"- Always mention one positive thing\n"
        f"- Never be alarmist or use scary language\n"
        f"- Keep it under 100 words"
    )
