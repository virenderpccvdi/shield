"""
routers/safe_chat.py
---------------------
POST /ai/safe-chat  — child-safe AI chatbot powered by Claude.
GET  /ai/safe-chat/health — liveness check for this endpoint.

Answers educational questions from children (age 6-17) with pre- and
post-generation content filtering.  Conversations are stateless from the
server's perspective; the client passes conversationHistory each request.
"""

import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["safe-chat"])

# ─── System prompt & blocked keywords ─────────────────────────────────────────

SAFE_CHAT_SYSTEM_PROMPT = """You are a friendly, safe AI assistant for children aged 6-17.

Rules you MUST follow:
1. NEVER discuss violence, weapons, drugs, alcohol, explicit content, or adult themes
2. NEVER provide personal information or encourage sharing personal details
3. NEVER discuss ways to bypass parental controls or internet filters
4. ALWAYS be educational, positive, and encouraging
5. If asked about inappropriate topics, gently redirect: "That's not something I can help with, but let me suggest something more fun!"
6. Keep responses concise and age-appropriate (2-3 short paragraphs max)
7. Use simple language appropriate for the child's age group
8. Encourage curiosity, learning, and creativity

You are here to help with: homework, science questions, creative writing, math, history, geography, art, music, coding basics, and general knowledge.

Remember: You are a SAFE tool for children. Err on the side of caution always."""

BLOCKED_KEYWORDS = [
    "weapon", "gun", "knife", "drug", "alcohol", "sex", "nude", "hack", "password",
    "kill", "suicide", "violent", "porn", "adult", "bypass", "vpn to avoid",
]

_FALLBACK_BLOCKED = (
    "I'm not able to help with that topic. "
    "Let me know if you have questions about school, science, or anything else!"
)
_FALLBACK_POST = (
    "I'm here to help with learning! "
    "What subject would you like to explore today?"
)

# ─── Request / Response models ────────────────────────────────────────────────


class SafeChatRequest(BaseModel):
    profileId: str
    message: str
    ageGroup: str = "child"                  # "child" (6-12) or "teen" (13-17)
    conversationHistory: list[dict] = []     # [{"role": "user/assistant", "content": "..."}]


class SafeChatResponse(BaseModel):
    reply: str
    safe: bool
    filteredTopics: list[str] = []


# ─── Lazy Anthropic client ────────────────────────────────────────────────────

_anthropic_client = None


def _get_client():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic as _anthropic
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        _anthropic_client = _anthropic.Anthropic(api_key=api_key)
    return _anthropic_client


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/safe-chat/health")
async def safe_chat_health():
    """Liveness check for the safe-chat endpoint."""
    return {"status": "ok", "model": "claude-haiku-4-5-20251001"}


@router.post("/safe-chat", response_model=SafeChatResponse)
async def safe_chat(req: SafeChatRequest):
    """
    Child-safe AI chatbot.

    Performs pre-generation keyword filtering and post-generation reply
    filtering.  Uses Claude Haiku for low-latency, cost-efficient responses.
    """
    # ── Pre-filter: block clearly inappropriate messages ──────────────────────
    message_lower = req.message.lower()
    triggered = [kw for kw in BLOCKED_KEYWORDS if kw in message_lower]
    if len(triggered) > 2:          # allow 1-2 incidental matches (false-positives)
        logger.info(
            "safe-chat pre-filter blocked message for profile=%s topics=%s",
            req.profileId, triggered,
        )
        return SafeChatResponse(
            reply=_FALLBACK_BLOCKED,
            safe=False,
            filteredTopics=triggered,
        )

    # ── Build messages list (cap history to last 20 turns = 10 exchanges) ─────
    history = req.conversationHistory[-20:] if len(req.conversationHistory) > 20 else list(req.conversationHistory)
    history.append({"role": "user", "content": req.message})

    # ── Compose system prompt with age note ───────────────────────────────────
    age_note = "aged 6-12" if req.ageGroup == "child" else "aged 13-17"
    system = SAFE_CHAT_SYSTEM_PROMPT + f"\n\nThe child is {age_note}. Adjust your language accordingly."

    # ── Call AI (DeepSeek primary, Claude fallback) ───────────────────────────
    reply = ""
    try:
        import httpx
        deepseek_key = os.getenv("DEEPSEEK_API_KEY")
        if deepseek_key:
            ds_messages = [{"role": "system", "content": system}] + history
            resp = httpx.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {deepseek_key}", "Content-Type": "application/json"},
                json={"model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat"), "max_tokens": 512, "messages": ds_messages},
                timeout=30.0,
            )
            resp.raise_for_status()
            reply = resp.json()["choices"][0]["message"]["content"].strip()
            logger.info("safe-chat DeepSeek reply for profile=%s ageGroup=%s len=%d", req.profileId, req.ageGroup, len(reply))
        else:
            raise RuntimeError("DEEPSEEK_API_KEY not set")
    except Exception as ds_exc:
        logger.warning("safe-chat DeepSeek failed for profile=%s: %s — trying Claude", req.profileId, ds_exc)
        try:
            client = _get_client()
            model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
            response = client.messages.create(model=model, max_tokens=512, system=system, messages=history)
            reply = response.content[0].text.strip()
            logger.info("safe-chat Claude reply for profile=%s ageGroup=%s len=%d", req.profileId, req.ageGroup, len(reply))
        except Exception as exc:
            logger.error("safe-chat all AI providers failed for profile=%s: %s", req.profileId, exc)
            raise HTTPException(status_code=500, detail="AI service temporarily unavailable. Please try again.")

    # ── Post-filter: scan Claude's own reply for blocked content ──────────────
    reply_lower = reply.lower()
    post_triggered = [kw for kw in BLOCKED_KEYWORDS if kw in reply_lower]
    if post_triggered:
        logger.warning(
            "safe-chat post-filter replaced reply for profile=%s topics=%s",
            req.profileId, post_triggered,
        )
        reply = _FALLBACK_POST

    return SafeChatResponse(
        reply=reply,
        safe=len(post_triggered) == 0,
        filteredTopics=post_triggered if post_triggered else [],
    )
