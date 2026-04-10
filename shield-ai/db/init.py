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
        # asyncpg does not allow multiple statements in a single execute() call.
        # Split on ';' and run each non-empty statement individually.
        statements = [s.strip() for s in _SCHEMA_SQL.split(";") if s.strip()]
        async with engine.begin() as conn:
            for stmt in statements:
                await conn.execute(text(stmt))
        logger.info("AI database schema initialised (%d statements).", len(statements))
    except Exception as e:
        logger.error("Failed to initialise AI database schema: %s", e)
        raise
