from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any
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


# ─── Enriched Insights models ────────────────────────────────────────────────

class CategoryStat(BaseModel):
    name: str
    minutes: int
    blocked: int


class Recommendation(BaseModel):
    type: str          # "limit" | "schedule" | "block" | "reward"
    title: str
    description: str
    icon: str          # material icon name string


class AnomalyEvent(BaseModel):
    severity: RiskLevel
    description: str
    detectedAt: str    # ISO-8601 string


class DayTrend(BaseModel):
    date: str          # YYYY-MM-DD
    allowed: int
    blocked: int


class InsightsResponse(BaseModel):
    profileId: str
    riskScore: int
    riskLevel: RiskLevel
    indicators: List[RiskIndicator] = []
    addictionScore: int
    mentalHealthSignals: List[str] = []
    # --- enriched fields (new) ---
    hasData: bool = False
    screenTimeMinutes: int = 0
    dailyAvgMinutes: int = 0
    totalBlocked: int = 0
    topCategories: List[CategoryStat] = []
    recommendations: List[Recommendation] = []
    anomalies: List[AnomalyEvent] = []
    weeklyTrend: List[DayTrend] = []
    summary: str = ""


class AnomalyResult(BaseModel):
    is_anomaly: bool
    score: float
    severity: RiskLevel
    confidence_score: Optional[float] = None   # 0-100 confidence it IS an anomaly
    explanation: Optional[str] = None          # human-readable reason


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str
    features: int
