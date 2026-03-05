from fastapi import APIRouter
from schemas.response import HealthResponse
from services.anomaly_service import is_model_loaded, load_model

router = APIRouter(prefix="/ai", tags=["health"])


@router.get("/model/health", response_model=HealthResponse)
async def model_health():
    load_model()
    return HealthResponse(
        status="UP",
        model_loaded=is_model_loaded(),
        model_version="1.0.0",
        features=11
    )
