"""
Run the AI schema migrations at startup (idempotent — uses IF NOT EXISTS).
"""
import logging
import os
from pathlib import Path

from sqlalchemy import text

from db.database import engine

logger = logging.getLogger(__name__)

_SCHEMA_SQL = (Path(__file__).parent / "schema.sql").read_text()


async def init_db() -> None:
    """Create AI tables if they do not already exist."""
    try:
        async with engine.begin() as conn:
            await conn.execute(text(_SCHEMA_SQL))
        logger.info("AI database schema initialised.")
    except Exception as e:
        logger.error("Failed to initialise AI database schema: %s", e)
        raise
