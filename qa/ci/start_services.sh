#!/usr/bin/env bash
# Start all Shield services for CI and wait for gateway readiness.
set -euo pipefail

SERVICES=(
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
    "shield-gateway:8280"
)

for entry in "${SERVICES[@]}"; do
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
    fi
done

echo "Waiting for gateway to be healthy..."
for i in $(seq 1 60); do
    if curl -sf http://localhost:8280/actuator/health > /dev/null 2>&1; then
        echo "✓ Gateway ready after ${i}s"
        exit 0
    fi
    sleep 2
done

echo "✗ Gateway did not become healthy within 120s"
echo "=== Service logs ==="
for entry in "${SERVICES[@]}"; do
    SVC="${entry%%:*}"
    echo "--- $SVC ---"
    tail -20 "/tmp/${SVC}.log" 2>/dev/null || echo "(no log)"
done
exit 1
