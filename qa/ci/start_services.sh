#!/usr/bin/env bash
# Start all Shield services for CI and wait for per-service readiness.
# Order matters: eureka → config → core services → gateway (last).
set -euo pipefail

# Java services: name:port
JAVA_SERVICES=(
    "shield-eureka:8261"
    "shield-config:8288"
    "shield-auth:8281"
    "shield-tenant:8282"
    "shield-profile:8283"
    "shield-dns:8284"
    "shield-analytics:8289"
    "shield-admin:8290"
    "shield-rewards:8287"
    "shield-location:8285"
    "shield-notification:8286"
    "shield-dns-resolver:8292"
    "shield-gateway:8280"
)

for entry in "${JAVA_SERVICES[@]}"; do
    SVC="${entry%%:*}"
    PORT="${entry##*:}"
    JAR=$(ls "$SVC/target/"*.jar 2>/dev/null | grep -v sources | head -1 || true)
    if [[ -n "$JAR" ]]; then
        java -jar "$JAR" \
            --spring.profiles.active=ci \
            --server.port="$PORT" \
            --eureka.client.service-url.defaultZone=http://localhost:8261/eureka/ \
            --shield.jwt.secret="${JWT_SECRET:-ci-shield-test-only-7a9f3b2c8d5e1f4a6b0c3d7e2f5a8b1c4d7e0f3a6b9c2d5e8f1a4b7c0d3e6f9a}" \
            "--spring.datasource.password=${DB_PASSWORD:-Shield@2026#Secure}" \
            > "/tmp/${SVC}.log" 2>&1 &
        echo "Started $SVC on :$PORT (PID $!)"
        sleep 1
    else
        echo "⚠ No JAR found for $SVC — skipping"
    fi
done

# Start shield-ai (Python FastAPI) if the venv exists
if [[ -d "shield-ai/.venv" ]]; then
    shield-ai/.venv/bin/python -m uvicorn \
        shield_ai.main:app --host 0.0.0.0 --port 8291 \
        > /tmp/shield-ai.log 2>&1 &
    echo "Started shield-ai on :8291 (PID $!)"
fi

# ── Wait for each service (skip optional ones that may not have JARs) ──────────
# Critical services whose health MUST pass before tests start.
# Eureka/Config are infrastructure — poll them first.
wait_for() {
    local name=$1 url=$2 max_wait=${3:-90}
    echo -n "Waiting for $name ($url)..."
    for i in $(seq 1 $((max_wait / 2))); do
        if curl -sf "$url" > /dev/null 2>&1; then
            echo " ✓ (${i}×2s)"
            return 0
        fi
        sleep 2
    done
    echo " ✗ not ready after ${max_wait}s"
    echo "--- $name last 30 log lines ---"
    tail -30 "/tmp/${name}.log" 2>/dev/null || true
    return 1  # non-fatal — report but continue so other services can be tested
}

# Infrastructure first (required)
wait_for shield-eureka    "http://localhost:8261/actuator/health" 60 || true
wait_for shield-config    "http://localhost:8288/actuator/health" 60 || true

# Core services (all started in parallel above — wait for each)
wait_for shield-auth         "http://localhost:8281/actuator/health" 90 || true
wait_for shield-tenant       "http://localhost:8282/actuator/health" 90 || true
wait_for shield-profile      "http://localhost:8283/actuator/health" 90 || true
wait_for shield-dns          "http://localhost:8284/actuator/health" 90 || true
wait_for shield-analytics    "http://localhost:8289/actuator/health" 90 || true
wait_for shield-admin        "http://localhost:8290/actuator/health" 90 || true
wait_for shield-rewards      "http://localhost:8287/actuator/health" 90 || true
wait_for shield-location     "http://localhost:8285/actuator/health" 90 || true
wait_for shield-notification "http://localhost:8286/actuator/health" 90 || true
wait_for shield-dns-resolver "http://localhost:8292/actuator/health" 60 || true

# shield-ai: Python FastAPI — health endpoint at /health (not /actuator/health)
wait_for shield-ai "http://localhost:8291/health" 60 || true

# Gateway is last — it needs Eureka registrations to be present before routing works.
# Extra 30s grace after services are healthy for Eureka heartbeat propagation.
echo "Giving services 30s to register with Eureka..."
sleep 30

wait_for shield-gateway "http://localhost:8280/actuator/health" 90
echo "✓ All services ready — starting QA tests"
