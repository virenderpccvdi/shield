"""
routers/config.py
-----------------
Hot-reload AI provider configuration without restarting shield-ai.

Called by shield-admin after saving new AI settings:
  POST /ai/config/reload

Reads /tmp/shield_ai_config.json and updates os.environ in-process.
"""

import json
import logging
import os
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["config"])

CONFIG_FILE = Path("/tmp/shield_ai_config.json")

# ── Schema ────────────────────────────────────────────────────────────────────

class ConfigReloadResponse(BaseModel):
    success: bool
    provider: Optional[str] = None
    model: Optional[str] = None
    message: str


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/config/reload", response_model=ConfigReloadResponse)
async def reload_config():
    """
    Reads /tmp/shield_ai_config.json written by shield-admin and updates
    runtime environment variables. No service restart required.
    """
    if not CONFIG_FILE.exists():
        logger.warning("Config reload requested but %s not found", CONFIG_FILE)
        return ConfigReloadResponse(
            success=False,
            message=f"Config file not found: {CONFIG_FILE}"
        )

    try:
        with open(CONFIG_FILE, "r") as f:
            cfg: dict = json.load(f)
    except Exception as exc:
        logger.error("Failed to parse %s: %s", CONFIG_FILE, exc)
        return ConfigReloadResponse(
            success=False,
            message=f"Failed to parse config file: {exc}"
        )

    _apply_env(cfg)

    provider = cfg.get("provider", "DEEPSEEK")
    model    = cfg.get("model", "deepseek-chat")
    logger.info("AI config reloaded — provider=%s model=%s", provider, model)

    return ConfigReloadResponse(
        success=True,
        provider=provider,
        model=model,
        message="AI configuration reloaded successfully"
    )


@router.get("/config/current", response_model=dict)
async def current_config():
    """Returns current AI environment settings (keys masked for security)."""
    def mask(val: Optional[str]) -> str:
        if not val or len(val) < 8:
            return "****"
        return "****" + val[-4:]

    return {
        "provider":      os.getenv("AI_PROVIDER", "DEEPSEEK"),
        "model":         os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        "anthropicModel": os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),
        "deepseekKeySet": bool(os.getenv("DEEPSEEK_API_KEY")),
        "anthropicKeySet": bool(os.getenv("ANTHROPIC_API_KEY")),
        "deepseekKeyMasked": mask(os.getenv("DEEPSEEK_API_KEY")),
        "anthropicKeyMasked": mask(os.getenv("ANTHROPIC_API_KEY")),
    }


# ── Helper ────────────────────────────────────────────────────────────────────

def _apply_env(cfg: dict) -> None:
    """Maps config.json fields to environment variable names and sets them."""
    provider = cfg.get("provider", "").upper()
    if provider:
        os.environ["AI_PROVIDER"] = provider

    api_key  = cfg.get("apiKey", "")
    model    = cfg.get("model", "")
    base_url = cfg.get("baseUrl", "")

    if provider == "DEEPSEEK":
        if api_key:
            os.environ["DEEPSEEK_API_KEY"]  = api_key
        if model:
            os.environ["DEEPSEEK_MODEL"]    = model
        if base_url:
            os.environ["DEEPSEEK_BASE_URL"] = base_url

    elif provider == "ANTHROPIC":
        if api_key:
            os.environ["ANTHROPIC_API_KEY"]  = api_key
        if model:
            os.environ["ANTHROPIC_MODEL"]    = model

    elif provider == "OPENAI":
        if api_key:
            os.environ["OPENAI_API_KEY"]   = api_key
        if model:
            os.environ["OPENAI_MODEL"]     = model
        if base_url:
            os.environ["OPENAI_BASE_URL"]  = base_url

    if cfg.get("maxTokens"):
        os.environ["AI_MAX_TOKENS"] = str(cfg["maxTokens"])
    if cfg.get("temperature") is not None:
        os.environ["AI_TEMPERATURE"] = str(cfg["temperature"])
