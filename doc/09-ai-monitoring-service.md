# 09 — AI Monitoring Service

## Overview

The Shield AI Service is a **Python 3.12 + FastAPI** microservice running at port **8291**. It provides:
- DNS usage pattern anomaly detection (Isolation Forest)
- Weekly plain-language digest generation (rule-based NLP templates)
- Cyberbullying / concerning content risk scoring
- Screen addiction risk scoring
- Custom keyword alert matching

All processing is **on-premises** — no data is sent to external AI APIs.

---

## Tech Stack

| Component | Version (2026) | Purpose |
|-----------|----------------|---------|
| Python | 3.12.3 (server) | Runtime |
| FastAPI | 0.115.11 | REST API framework |
| Uvicorn | 0.34.x | ASGI server |
| scikit-learn | 1.6.1 | Isolation Forest, vectorizers |
| HuggingFace Transformers | 4.47.x | BERT-based text classifier |
| Pydantic | 2.10.x | Request/response validation |
| SQLAlchemy | 2.0.x | PostgreSQL access (analytics schema) |
| asyncpg | 0.30.x | Async PostgreSQL driver |
| redis-py | 5.2.x | Redis access |
| httpx | 0.28.x | Internal HTTP calls to Spring services |

---

## Project Structure

```
/var/www/ai/FamilyShield/shield-ai/
├── main.py                     — FastAPI app entry point
├── routers/
│   ├── insights.py             — GET /ai/{profileId}/weekly + /insights
│   ├── analysis.py             — POST /ai/analyze/batch
│   ├── keywords.py             — POST /ai/{profileId}/keywords
│   └── health.py               — GET /ai/model/health
├── services/
│   ├── anomaly_service.py      — Isolation Forest inference
│   ├── weekly_digest.py        — Rule-based weekly summary generator
│   ├── risk_scorer.py          — Addiction + mental health scoring
│   └── keyword_service.py      — Custom keyword matching
├── models/
│   ├── anomaly_model.pkl       — Trained Isolation Forest (serialized)
│   └── model_metadata.json     — Version, training date, accuracy
├── db/
│   ├── database.py             — SQLAlchemy async engine (PostgreSQL 18 :5454)
│   └── queries.py              — Analytics DB query helpers
├── schemas/
│   ├── request.py              — Pydantic input models
│   └── response.py             — Pydantic output models
├── requirements.txt
└── systemd/
    └── shield-ai.service       — systemd unit file
```

---

## API Endpoints

### GET `/ai/{profileId}/weekly`

Returns the AI-generated weekly summary for a child profile.

**Response:**
```json
{
  "profileId": "uuid",
  "weekOf": "2026-03-02",
  "summary": "Jake had a good week. He stayed within his YouTube limit on 5 out of 7 days and showed no concerning patterns. His total screen time was 14 hours, down 3 hours from last week.",
  "riskLevel": "LOW",
  "riskScore": 12,
  "signals": [],
  "usageTrend": "DOWN",
  "topInsight": "Screen time decreased by 18% week-over-week.",
  "recommendedAction": null,
  "generatedAt": "2026-03-04T08:00:00Z"
}
```

**Risk levels:** `LOW` (0–30) | `MEDIUM` (31–60) | `HIGH` (61–100)

---

### GET `/ai/{profileId}/insights`

Returns real-time risk indicators.

**Response:**
```json
{
  "profileId": "uuid",
  "riskScore": 45,
  "riskLevel": "MEDIUM",
  "indicators": [
    {
      "type": "LATE_NIGHT_USAGE",
      "description": "Social media usage detected after 11pm on 3 nights this week",
      "severity": "MEDIUM",
      "detectedAt": "2026-03-03T23:45:00Z"
    },
    {
      "type": "SCHEDULE_VIOLATIONS",
      "description": "4 attempts to access blocked content during school hours",
      "severity": "LOW",
      "detectedAt": "2026-03-04T10:22:00Z"
    }
  ],
  "addictionScore": 38,
  "mentalHealthSignals": []
}
```

---

### POST `/ai/analyze/batch`

Called by `shield-analytics` service every hour to process the latest DNS query logs.

**Request:**
```json
{
  "profileId": "uuid",
  "tenantId": "uuid",
  "periodStart": "2026-03-04T16:00:00Z",
  "periodEnd": "2026-03-04T17:00:00Z"
}
```

**What it does:**
1. Reads DNS query logs from `analytics.dns_query_logs` for the period
2. Runs Isolation Forest anomaly detection on query patterns
3. Checks for late-night activity (11pm–7am)
4. Checks schedule violation count
5. Checks time budget overruns
6. Updates risk scores in Redis (cache) and PostgreSQL (persistence)

---

## Anomaly Detection — Isolation Forest

### Training Features (per 1-hour window, per profile)

```python
features = [
    query_count,           # total DNS queries
    block_count,           # queries that were blocked
    block_rate,            # blocked / total
    unique_domains,        # distinct domains queried
    adult_queries,         # queries to adult category
    social_queries,        # queries to social media
    gaming_queries,        # queries to gaming
    after_hours_queries,   # queries outside schedule window
    new_domains,           # first-ever queries (not seen before)
    hour_of_day,           # 0–23
    day_of_week,           # 0–6
]
```

### Training the Model

```python
# shield-ai/train_anomaly_model.py
from sklearn.ensemble import IsolationForest
import pickle

# Load 30 days of normal usage data from shield_db
X_train = load_normal_usage_data()

model = IsolationForest(
    contamination=0.05,    # 5% expected anomaly rate
    random_state=42,
    n_estimators=100
)
model.fit(X_train)

with open('models/anomaly_model.pkl', 'wb') as f:
    pickle.dump(model, f)
```

### Inference

```python
# services/anomaly_service.py
def detect_anomaly(profile_id: str, window_features: dict) -> AnomalyResult:
    X = np.array([[window_features[f] for f in FEATURE_ORDER]])
    score = model.decision_function(X)[0]  # negative = anomaly
    is_anomaly = model.predict(X)[0] == -1

    return AnomalyResult(
        is_anomaly=is_anomaly,
        score=float(score),
        severity='HIGH' if score < -0.3 else 'MEDIUM' if score < -0.1 else 'LOW'
    )
```

---

## Weekly Digest Generation (Rule-Based)

No LLM required. The digest is built from template sentences based on measured stats.

```python
# services/weekly_digest.py
def generate_digest(stats: WeeklyStats) -> str:
    parts = []

    # Usage trend
    if stats.usage_change_pct < -10:
        parts.append(f"{stats.name} had a good week — screen time was down {abs(stats.usage_change_pct):.0f}% from last week.")
    elif stats.usage_change_pct > 20:
        parts.append(f"Screen time increased {stats.usage_change_pct:.0f}% this week for {stats.name}.")
    else:
        parts.append(f"{stats.name}'s screen time was about the same as last week.")

    # Budget compliance
    within_days = stats.days_within_budget
    if within_days >= 6:
        parts.append(f"They stayed within their daily limits on {within_days} out of 7 days — excellent!")
    elif within_days >= 4:
        parts.append(f"They stayed within limits on {within_days} out of 7 days.")
    else:
        parts.append(f"They exceeded their daily limits on {7 - within_days} days this week.")

    # Concerning signals
    if not stats.anomalies:
        parts.append("No concerning patterns were detected.")
    else:
        for anomaly in stats.anomalies[:2]:  # Max 2 concerns per digest
            parts.append(f"Note: {anomaly.description}")

    # Rewards
    if stats.tasks_completed > 0:
        parts.append(f"They completed {stats.tasks_completed} task(s) this week and earned {stats.reward_minutes_earned} minutes of reward time.")

    return " ".join(parts)
```

---

## Addiction Risk Score Algorithm

```python
def calculate_addiction_score(profile_stats: ProfileStats) -> int:
    """
    Weighted score 0–100. Higher = more concerning usage patterns.
    """
    score = 0

    # Late-night usage (11pm–7am) — weight: 25 points max
    late_night_sessions = profile_stats.late_night_session_count
    score += min(25, late_night_sessions * 5)

    # Schedule violations — weight: 20 points max
    violations = profile_stats.schedule_violation_count
    score += min(20, violations * 4)

    # Time overruns (exceeding daily limit) — weight: 20 points max
    overrun_days = profile_stats.days_over_budget
    score += min(20, overrun_days * 3)

    # Bypass attempts (VPN, proxy usage detected) — weight: 20 points max
    bypass_attempts = profile_stats.bypass_attempt_count
    score += min(20, bypass_attempts * 10)

    # Week-over-week usage increase — weight: 15 points max
    if profile_stats.usage_change_pct > 50:
        score += 15
    elif profile_stats.usage_change_pct > 25:
        score += 8

    return min(100, score)
```

---

## systemd Service

```ini
# /var/www/ai/FamilyShield/shield-ai/systemd/shield-ai.service
[Unit]
Description=Shield AI Monitoring Service
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/ai/FamilyShield/shield-ai
ExecStart=/var/www/ai/FamilyShield/shield-ai/.venv/bin/uvicorn main:app \
    --host 127.0.0.1 \
    --port 8291 \
    --workers 2 \
    --log-level info
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Setup:**
```bash
cd /var/www/ai/FamilyShield/shield-ai

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Install systemd service
cp systemd/shield-ai.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable shield-ai
systemctl start shield-ai
systemctl status shield-ai
```

---

## Privacy Guarantees

| What the AI processes | What it NEVER processes |
|----------------------|------------------------|
| DNS query domain names (hashed) | SMS / iMessage content |
| Query timestamps and frequency | WhatsApp messages |
| Category classifications | Photos or videos |
| Schedule compliance data | Emails |
| Battery / online presence | Keystrokes |
| GPS arrival/departure events | Screen recordings |
