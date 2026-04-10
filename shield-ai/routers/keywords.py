from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from services.keyword_service import set_keywords, get_keywords
from schemas.request import KeywordRequest

router = APIRouter(prefix="/api/v1/ai", tags=["keywords"])


@router.get("/{profile_id}/keywords")
async def get_profile_keywords(profile_id: str, db: AsyncSession = Depends(get_db)):
    return {"profileId": profile_id, "keywords": await get_keywords(db, profile_id)}


@router.post("/{profile_id}/keywords")
async def set_profile_keywords(
    profile_id: str,
    request: KeywordRequest,
    db: AsyncSession = Depends(get_db),
):
    await set_keywords(db, profile_id, request.keywords)
    return {"profileId": profile_id, "keywords": request.keywords, "status": "updated"}
