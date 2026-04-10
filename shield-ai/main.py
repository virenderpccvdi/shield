import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, insights, analysis, keywords, alerts, training, config, chat, safe_chat
from services.anomaly_service import load_model

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Shield AI Service starting up...")
    load_model()
    logger.info("Anomaly model loaded.")
    yield
    logger.info("Shield AI Service shutting down.")


app = FastAPI(
    title="Shield AI Service",
    description="AI monitoring and anomaly detection for Shield Family Protection",
    version="1.0.0",
    lifespan=lifespan,
)

_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "https://shield.rstglobal.in,https://api.shield.rstglobal.in"
).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-Id", "X-User-Id", "X-User-Role"],
)

app.include_router(health.router)
app.include_router(insights.router)
app.include_router(analysis.router)
app.include_router(keywords.router)
app.include_router(alerts.router)
app.include_router(training.router)
app.include_router(config.router)
app.include_router(chat.router)
app.include_router(safe_chat.router)


@app.get("/actuator/health")
@app.get("/api/v1/ai/actuator/health")
async def actuator_health():
    return {"status": "UP", "groups": ["liveness", "readiness"]}


@app.get("/")
async def root():
    return {"service": "shield-ai", "version": "1.0.0", "status": "running"}
