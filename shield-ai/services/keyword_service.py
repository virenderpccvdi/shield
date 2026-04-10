"""
Keyword monitoring service — DB-backed (replaces in-memory _keyword_store dict).
All functions are async and receive a db session from the router layer.
"""
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from db.queries import get_keywords_db, set_keywords_db


async def set_keywords(db: AsyncSession, profile_id: str, keywords: List[str]) -> None:
    """Persist the keyword list for a profile (replaces any existing list)."""
    normalised = [kw.lower().strip() for kw in keywords if kw.strip()]
    await set_keywords_db(db, profile_id, normalised)


async def get_keywords(db: AsyncSession, profile_id: str) -> List[str]:
    """Return the monitored keyword list for a profile."""
    return await get_keywords_db(db, profile_id)


async def check_domain(db: AsyncSession, profile_id: str, domain: str) -> List[str]:
    """Return list of monitored keywords that appear in the given domain."""
    keywords = await get_keywords_db(db, profile_id)
    domain_lower = domain.lower()
    return [kw for kw in keywords if kw in domain_lower]
