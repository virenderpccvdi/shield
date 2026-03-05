# 10 — Infrastructure & Deployment

## Server

| Resource | Detail |
|----------|--------|
| OS | Ubuntu 24.04.3 LTS |
| CPU | 8 cores |
| RAM | 62 GB |
| Disk | 490 GB (265 GB free) |
| IP | Same server as gps.rstglobal.in, apps.makewish.ai |

**Port isolation from other apps:**
- SmartTrack uses ports: 8081–8089, 8093, 8761, 8888, 6000, 5023, 7001
- MakewishSpring uses: 8095, 9600–9615
- Shield uses: **8261, 8280–8291** — no conflicts

---

## Nginx Configuration

**Files created:**
```
/etc/nginx/sites-available/shield.rstglobal.in  ← Full config (ACTIVE)
/etc/nginx/sites-enabled/shield.rstglobal.in    ← Symlink
/etc/nginx/conf.d/shield-upstream.conf          ← Upstream pool
```

**SSL Certificate:**
```
/etc/letsencrypt/live/shield.rstglobal.in/fullchain.pem
/etc/letsencrypt/live/shield.rstglobal.in/privkey.pem
Expires: 2026-06-02 (auto-renews)
```

**Routing summary:**
```
https://shield.rstglobal.in/api/v1/*      → 127.0.0.1:8280 (API Gateway)
https://shield.rstglobal.in/ws/*           → 127.0.0.1:8286 (Notification WS)
https://shield.rstglobal.in/eureka/        → 127.0.0.1:8261 (localhost only)
https://shield.rstglobal.in/adguard/       → 127.0.0.1:3080 (localhost only)
https://shield.rstglobal.in/actuator/health → 127.0.0.1:8280
https://shield.rstglobal.in/*.apk          → /var/www/ai/FamilyShield/static/
https://shield.rstglobal.in/*              → /var/www/ai/FamilyShield/shield-dashboard/dist/
```

**Shared rate-limit zones** (from existing `/etc/nginx/conf.d/smarttrack-performance.conf`):
- `api_limit` — 100 req/s per IP
- `auth_limit` — 10 req/s per IP
- `static_limit` — 500 req/s per IP

---

## PostgreSQL 18 Database Setup

PostgreSQL 18 is running on port **5454** (primary) + **5455** (read replica).

```sql
-- Run as postgres user
CREATE DATABASE shield_db;
CREATE USER shield WITH PASSWORD 'your-secure-password-here';
GRANT ALL PRIVILEGES ON DATABASE shield_db TO shield;
\c shield_db
CREATE SCHEMA auth;
CREATE SCHEMA tenant;
CREATE SCHEMA profile;
CREATE SCHEMA dns;
CREATE SCHEMA location;
CREATE SCHEMA notification;
CREATE SCHEMA rewards;
CREATE SCHEMA analytics;
GRANT ALL ON SCHEMA auth, tenant, profile, dns, location, notification, rewards, analytics TO shield;
```

**Connection string for Spring Boot services:**
```
jdbc:postgresql://localhost:5454/shield_db?currentSchema={schema_name}
```

---

## Redis 7 — No Changes Needed

Redis is already running on `localhost:6379` with no password. This is the same instance used by other apps — Shield uses **separate key prefixes** to avoid conflicts:

```
shield:session:{userId}
shield:rt:{userId}
shield:budget:{profileId}:{app}
shield:online:{profileId}
shield:dns-rules:{profileId}
shield:geofence:{profileId}
```

No Redis password required — consistent with existing server config.

---

## Spring Boot Services — systemd

Each Shield service runs as a systemd service. Pattern follows SmartTrack.

**Template:** `/etc/systemd/system/shield-{service}.service`

```ini
[Unit]
Description=Shield — {Service Name}
After=network.target postgresql.service redis.service shield-eureka.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/ai/FamilyShield
ExecStart=/usr/lib/jvm/java-21-openjdk-amd64/bin/java \
    -Xms256m -Xmx512m \
    -XX:+UseG1GC \
    -XX:MaxGCPauseMillis=200 \
    -XX:+UseStringDeduplication \
    -XX:+HeapDumpOnOutOfMemoryError \
    -XX:HeapDumpPath=/var/log \
    -jar /var/www/ai/FamilyShield/shield-{service}/target/shield-{service}-1.0.0-SNAPSHOT.jar
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Start order (Phase 1):**
```bash
# 1. Start Eureka (service registry)
systemctl start shield-eureka

# 2. Start Config Server
systemctl start shield-config

# 3. Start Gateway
systemctl start shield-gateway

# 4. Start business services (can start in parallel)
systemctl start shield-auth shield-tenant

# Phase 2+
systemctl start shield-profile shield-dns shield-notification shield-analytics
systemctl start shield-location    # Phase 3
systemctl start shield-ai          # Phase 4 (Python)
systemctl start shield-rewards     # Phase 5
systemctl start shield-admin       # Phase 6
```

---

## Environment Variables (.env)

```bash
# /var/www/ai/FamilyShield/.env

# Database
DB_HOST=localhost
DB_PORT=5454
DB_NAME=shield_db
DB_USER=shield
DB_PASSWORD=your-secure-password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
# No password — consistent with server

# JWT
JWT_SECRET=your-256-bit-hex-secret-here
JWT_EXPIRY_HOURS=1
JWT_REFRESH_DAYS=30

# Eureka
EUREKA_PASSWORD=your-eureka-password

# AdGuard Home
ADGUARD_URL=http://localhost:3080
ADGUARD_USER=shield-api
ADGUARD_PASS=your-adguard-password

# Firebase (FCM)
FIREBASE_SERVICE_ACCOUNT=/var/www/ai/FamilyShield/config/firebase-service-account.json

# Email (SMTP)
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=noreply@rstglobal.in
SMTP_PASS=your-smtp-password
SMTP_FROM=Shield <noreply@rstglobal.in>

# Sentry (error tracking)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Domain
APP_DOMAIN=shield.rstglobal.in
APP_URL=https://shield.rstglobal.in
```

---

## Docker Compose — AdGuard + Monitoring

```yaml
# /var/www/ai/FamilyShield/docker-compose.yml
version: "3.9"

services:
  adguard:
    image: adguard/adguardhome:latest
    container_name: shield-adguard
    restart: unless-stopped
    volumes:
      - ./adguard/work:/opt/adguardhome/work
      - ./adguard/conf:/opt/adguardhome/conf
      - /etc/letsencrypt/live/shield.rstglobal.in:/ssl:ro
    ports:
      - "5353:53/udp"
      - "5353:53/tcp"
      - "4443:443/tcp"
      - "3080:3000/tcp"
    networks:
      - shield-net

networks:
  shield-net:
    driver: bridge
```

```yaml
# /var/www/ai/FamilyShield/docker-compose-monitoring.yml
version: "3.9"

services:
  prometheus:
    image: prom/prometheus:v3.1.0
    container_name: shield-prometheus
    restart: unless-stopped
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9190:9090"     # Port 9090 may be used by SmartTrack — use 9190
    networks:
      - shield-net

  grafana:
    image: grafana/grafana:11.4.0
    container_name: shield-grafana
    restart: unless-stopped
    environment:
      GF_SERVER_ROOT_URL: https://shield.rstglobal.in/grafana/
      GF_SERVER_SERVE_FROM_SUB_PATH: "true"
      GF_SECURITY_ADMIN_PASSWORD: your-grafana-password
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    ports:
      - "3190:3000"     # Avoid conflict with gps Grafana on :3000
    networks:
      - shield-net

volumes:
  prometheus-data:
  grafana-data:

networks:
  shield-net:
    driver: bridge
```

> **Port conflict note:** SmartTrack already uses Grafana on port 3000 and Prometheus on port 9090. Shield uses **3190** and **9190** to avoid conflicts.

---

## Prometheus Scrape Config

```yaml
# /var/www/ai/FamilyShield/monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'shield-gateway'
    static_configs:
      - targets: ['localhost:8280']
    metrics_path: /actuator/prometheus

  - job_name: 'shield-auth'
    static_configs:
      - targets: ['localhost:8281']
    metrics_path: /actuator/prometheus

  - job_name: 'shield-profile'
    static_configs:
      - targets: ['localhost:8283']
    metrics_path: /actuator/prometheus

  - job_name: 'shield-dns'
    static_configs:
      - targets: ['localhost:8284']
    metrics_path: /actuator/prometheus

  - job_name: 'shield-location'
    static_configs:
      - targets: ['localhost:8285']
    metrics_path: /actuator/prometheus

  - job_name: 'shield-ai'
    static_configs:
      - targets: ['localhost:8291']
    metrics_path: /metrics
```

---

## Build Script

```bash
#!/bin/bash
# /var/www/ai/FamilyShield/build.sh

set -e

echo "Building Shield Platform..."
cd /var/www/ai/FamilyShield

# Build all Spring Boot services
mvn clean package -DskipTests -T 4

# Build React dashboard
cd shield-dashboard
npm install && npm run build
cd ..

# Build Flutter APK (optional — only when app changes)
# cd shield-app
# flutter build apk --release --flavor shield -t lib/main_production.dart
# cp build/app/outputs/flutter-apk/app-shield-release.apk static/shield-latest.apk
# cd ..

echo "Build complete."
```

---

## Manage Script

```bash
#!/bin/bash
# /var/www/ai/FamilyShield/manage.sh
# Usage: ./manage.sh [start|stop|restart|status|logs]

SERVICES="shield-eureka shield-config shield-gateway shield-auth shield-tenant shield-profile shield-dns shield-notification shield-analytics shield-location shield-rewards shield-admin"

case "$1" in
  start)
    for svc in $SERVICES; do
      systemctl start $svc 2>/dev/null && echo "Started $svc" || echo "Skipped $svc (not installed yet)"
    done
    ;;
  stop)
    for svc in $(echo $SERVICES | tr ' ' '\n' | tac); do
      systemctl stop $svc 2>/dev/null
    done
    ;;
  restart)
    $0 stop && sleep 2 && $0 start
    ;;
  status)
    for svc in $SERVICES; do
      status=$(systemctl is-active $svc 2>/dev/null || echo "not-installed")
      echo "$svc: $status"
    done
    ;;
  logs)
    service=${2:-shield-gateway}
    journalctl -u $service -f --no-pager
    ;;
esac
```
