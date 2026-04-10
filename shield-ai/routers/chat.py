"""
routers/chat.py
----------------
POST /ai/chat  — answer a parent's natural-language question about their child's
online activity using real DB stats + Claude AI.
"""

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator, Field
from sqlalchemy.ext.asyncio import AsyncSession
import json

from db.database import get_db
from db.queries import get_profile_week_stats
from limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["chat"])

# ─── Request / Response models ────────────────────────────────────────────────

class ChatRequest(BaseModel):
    profileId: str
    question: str = Field(..., max_length=2000, description="Parent chat message")
    tenantId: Optional[str] = None

    @field_validator('question')
    @classmethod
    def question_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Message cannot be empty')
        return v.strip()


class ChatResponse(BaseModel):
    answer: str
    suggestions: list[str]


# ─── Lazy Anthropic client ────────────────────────────────────────────────────

_anthropic_client = None


def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        _anthropic_client = anthropic.Anthropic(api_key=api_key)
    return _anthropic_client


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
@limiter.limit("10/minute")
async def chat_with_ai(http_request: Request, request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Answer parent questions about child activity using Claude AI."""

    # 1. Fetch child's recent stats from DB (last 7 days)
    week_stats = await get_profile_week_stats(db, request.profileId)

    # 2. Build context string
    has_data = week_stats.get("has_data", False)
    top_cats = week_stats.get("top_categories", [])
    top_cats_str = ", ".join(c["name"] for c in top_cats[:5]) if top_cats else "No data yet"
    total_blocked = week_stats.get("total_blocked", 0)
    total_allowed = week_stats.get("total_allowed", 0)
    late_night = week_stats.get("late_night_count", 0)
    bypass_attempts = week_stats.get("bypass_attempts", 0)
    unique_domains = week_stats.get("unique_domains", 0)
    days_over_budget = week_stats.get("days_over_budget", 0)

    # Rough screen-time hours estimate (assume ~10 s average per query)
    screen_hours = round((total_allowed + total_blocked) * 10 / 3600, 1)

    # Count anomaly count via top_cats heuristic (days_over_budget as proxy)
    anomaly_count = days_over_budget

    context = (
        f"CHILD ACTIVITY DATA (last 7 days):\n"
        f"- Data available: {'Yes' if has_data else 'No — new profile or device not yet connected'}\n"
        f"- Total DNS queries allowed: {total_allowed}\n"
        f"- Total DNS queries blocked: {total_blocked}\n"
        f"- Estimated screen time: {screen_hours} hours\n"
        f"- Top blocked categories: {top_cats_str}\n"
        f"- Late-night sessions (after 10 PM): {late_night}\n"
        f"- Bypass/VPN attempts: {bypass_attempts}\n"
        f"- Unique domains visited: {unique_domains}\n"
        f"- Days where usage exceeded budget: {anomaly_count} out of 7\n"
    )

    # 3. Call Claude
    system_prompt = (
        "You are Shield AI, a helpful parental control assistant. "
        "Answer the parent's question about their child's online activity based on the provided data. "
        "Be concise, supportive, and actionable. Never be alarmist. Limit to 150 words."
    )

    answer = "I'm having trouble connecting to the AI service right now. Please try again in a moment."
    suggestions = [
        "What time does my child use the internet most?",
        "Which categories should I consider blocking?",
        "Is my child's screen time within a healthy range?",
    ]

    # Try DeepSeek first (working), fall back to Claude
    try:
        import httpx
        deepseek_key = os.getenv("DEEPSEEK_API_KEY")
        deepseek_model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
        if deepseek_key:
            resp = httpx.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {deepseek_key}", "Content-Type": "application/json"},
                json={
                    "model": deepseek_model,
                    "max_tokens": 300,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"{context}\n\nParent's question: {request.question}"},
                    ],
                },
                timeout=30.0,
            )
            resp.raise_for_status()
            answer = resp.json()["choices"][0]["message"]["content"].strip()
            logger.info("DeepSeek chat response for profile %s (%d chars)", request.profileId, len(answer))
        else:
            raise RuntimeError("DEEPSEEK_API_KEY not set")
    except Exception as ds_exc:
        logger.warning("DeepSeek chat failed for profile %s: %s — trying Claude", request.profileId, ds_exc)
        try:
            client = _get_anthropic_client()
            model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
            message = client.messages.create(
                model=model,
                max_tokens=300,
                system=system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": f"{context}\n\nParent's question: {request.question}",
                    }
                ],
            )
            answer = message.content[0].text.strip()
            logger.info("Claude chat response for profile %s (%d chars)", request.profileId, len(answer))
        except Exception as exc:
            logger.warning("Claude chat also failed for profile %s: %s", request.profileId, exc)

    # 4. Generate context-aware follow-up suggestions
    suggestions = _build_suggestions(request.question, week_stats)

    return ChatResponse(answer=answer, suggestions=suggestions)


# ─── Follow-up suggestion helper ─────────────────────────────────────────────

def _build_suggestions(question: str, stats: dict) -> list[str]:
    q = question.lower()
    late_night = stats.get("late_night_count", 0)
    total_blocked = stats.get("total_blocked", 0)

    base = [
        "What time does my child use the internet most?",
        "Which categories should I consider blocking?",
        "Is my child's screen time within a healthy range?",
        "How do I set a bedtime schedule?",
        "What does the risk score mean?",
        "Are there any concerning patterns I should know about?",
        "How can I reward good behaviour?",
        "What are bypass attempts and should I be worried?",
    ]

    # Prioritise contextually relevant suggestions
    prioritised: list[str] = []
    if late_night > 0 and "bedtime" not in q and "night" not in q:
        prioritised.append("How do I set a bedtime schedule?")
    if total_blocked > 50 and "block" not in q and "categor" not in q:
        prioritised.append("Which categories should I consider blocking?")
    if stats.get("bypass_attempts", 0) > 0 and "bypass" not in q and "vpn" not in q:
        prioritised.append("What are bypass attempts and should I be worried?")
    if "risk" not in q and "score" not in q:
        prioritised.append("What does the risk score mean?")

    # Fill to exactly 3 suggestions from base pool without repeats
    seen = set(prioritised)
    for s in base:
        if len(prioritised) >= 3:
            break
        if s not in seen:
            prioritised.append(s)
            seen.add(s)

    return prioritised[:3]


# ─── Streaming chat endpoint ──────────────────────────────────────────────────

@router.post("/chat/stream")
@limiter.limit("10/minute")
async def chat_stream(http_request: Request, request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Stream Claude AI responses as Server-Sent Events (SSE)."""

    # Fetch child's recent stats
    week_stats = await get_profile_week_stats(db, request.profileId)

    # Build context string (same logic as /chat)
    has_data = week_stats.get("has_data", False)
    top_cats = week_stats.get("top_categories", [])
    top_cats_str = ", ".join(c["name"] for c in top_cats[:5]) if top_cats else "No data yet"
    total_blocked = week_stats.get("total_blocked", 0)
    total_allowed = week_stats.get("total_allowed", 0)
    late_night = week_stats.get("late_night_count", 0)
    bypass_attempts = week_stats.get("bypass_attempts", 0)
    unique_domains = week_stats.get("unique_domains", 0)
    days_over_budget = week_stats.get("days_over_budget", 0)
    screen_hours = round((total_allowed + total_blocked) * 10 / 3600, 1)

    context = (
        f"CHILD ACTIVITY DATA (last 7 days):\n"
        f"- Data available: {'Yes' if has_data else 'No — new profile or device not yet connected'}\n"
        f"- Total DNS queries allowed: {total_allowed}\n"
        f"- Total DNS queries blocked: {total_blocked}\n"
        f"- Estimated screen time: {screen_hours} hours\n"
        f"- Top blocked categories: {top_cats_str}\n"
        f"- Late-night sessions (after 10 PM): {late_night}\n"
        f"- Bypass/VPN attempts: {bypass_attempts}\n"
        f"- Unique domains visited: {unique_domains}\n"
        f"- Days where usage exceeded budget: {days_over_budget} out of 7\n"
    )

    system_prompt = (
        "You are Shield AI, a helpful parental control assistant. "
        "Answer the parent's question about their child's online activity based on the provided data. "
        "Be concise, supportive, and actionable. Never be alarmist. Limit to 150 words."
    )

    async def generate():
        try:
            import anthropic
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                yield f"data: {json.dumps({'error': 'AI service not configured'})}\n\n"
                return
            async_client = anthropic.AsyncAnthropic(api_key=api_key)
            model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
            async with async_client.messages.stream(
                model=model,
                max_tokens=1024,
                system=system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": f"{context}\n\nParent's question: {request.question}",
                    }
                ],
            ) as stream:
                async for text in stream.text_stream:
                    yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.error("Streaming chat failed for profile %s: %s", request.profileId, exc)
            yield f"data: {json.dumps({'error': 'Streaming unavailable, please use /chat instead'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
