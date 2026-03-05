from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid


class BatchAnalysisRequest(BaseModel):
    profileId: str
    tenantId: str
    periodStart: datetime
    periodEnd: datetime


class KeywordRequest(BaseModel):
    keywords: list[str]


class WindowFeatures(BaseModel):
    query_count: int = 0
    block_count: int = 0
    block_rate: float = 0.0
    unique_domains: int = 0
    adult_queries: int = 0
    social_queries: int = 0
    gaming_queries: int = 0
    after_hours_queries: int = 0
    new_domains: int = 0
    hour_of_day: int = 0
    day_of_week: int = 0
