from fastapi import APIRouter
from services.keyword_service import set_keywords, get_keywords
from schemas.request import KeywordRequest

router = APIRouter(prefix="/api/v1/ai", tags=["keywords"])


@router.get("/{profile_id}/keywords")
async def get_profile_keywords(profile_id: str):
    return {"profileId": profile_id, "keywords": get_keywords(profile_id)}


@router.post("/{profile_id}/keywords")
async def set_profile_keywords(profile_id: str, request: KeywordRequest):
    set_keywords(profile_id, request.keywords)
    return {"profileId": profile_id, "keywords": request.keywords, "status": "updated"}
