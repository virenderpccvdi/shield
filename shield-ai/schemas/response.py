from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from enum import Enum


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class UsageTrend(str, Enum):
    UP = "UP"
    DOWN = "DOWN"
    STABLE = "STABLE"


class RiskIndicator(BaseModel):
    type: str
    description: str
    severity: RiskLevel
    detectedAt: datetime


class WeeklyDigestResponse(BaseModel):
    profileId: str
    weekOf: str
    summary: str
    llm_summary: Optional[str] = None
    rule_based_summary: str = ""
    riskLevel: RiskLevel
    riskScore: int
    signals: List[str] = []
    usageTrend: UsageTrend
    topInsight: str
    recommendedAction: Optional[str] = None
    generatedAt: datetime


class InsightsResponse(BaseModel):
    profileId: str
    riskScore: int
    riskLevel: RiskLevel
    indicators: List[RiskIndicator] = []
    addictionScore: int
    mentalHealthSignals: List[str] = []


class AnomalyResult(BaseModel):
    is_anomaly: bool
    score: float
    severity: RiskLevel


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str
    features: int
