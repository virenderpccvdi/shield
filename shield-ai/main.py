import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, insights, analysis, keywords, alerts, training, config
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(insights.router)
app.include_router(analysis.router)
app.include_router(keywords.router)
app.include_router(alerts.router)
app.include_router(training.router)
app.include_router(config.router)


@app.get("/actuator/health")
async def actuator_health():
    return {"status": "UP", "groups": ["liveness", "readiness"]}


@app.get("/")
async def root():
    return {"service": "shield-ai", "version": "1.0.0", "status": "running"}
