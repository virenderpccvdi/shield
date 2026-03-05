# 12 — Shield Platform — Completion Status

**Last Updated:** 2026-03-04
**Platform Version:** 1.0.0
**Environment:** Production — shield.rstglobal.in

---

## Service Status

| Service | Port | Status | Health |
|---------|------|--------|--------|
| shield-eureka | 8261 | active | UP |
| shield-config | 8288 | active | UP |
| shield-gateway | 8280 | active | UP |
| shield-auth | 8281 | active | UP |
| shield-tenant | 8282 | active | UP |
| shield-profile | 8283 | active | UP |
| shield-dns | 8284 | active | UP |
| shield-location | 8285 | active | UP |
| shield-notification | 8286 | active | UP |
| shield-rewards | 8287 | active | UP |
| shield-analytics | 8289 | active | UP |
| shield-admin | 8290 | active | UP |
| shield-ai | 8291 | active | running |

---

## Frontend

| Component | Technology | Status | URL |
|-----------|-----------|--------|-----|
| Marketing Website | HTML/CSS/JS | Live | https://shield.rstglobal.in/ |
| Login Page | HTML/CSS | Live | https://shield.rstglobal.in/login.html |
| Register Page | HTML/CSS | Live | https://shield.rstglobal.in/register.html |
| React Dashboard | React 19 + TypeScript + MUI v7 | Not built (dist/ missing) | https://shield.rstglobal.in/dashboard |

---

## Architecture Summary

### Backend — Java Spring Boot 4.0.3
- **Spring Cloud:** 2025.1.1 (Eureka, Config, Gateway with WebFlux)
- **Java:** 21 (G1GC, `-Xms256m -Xmx512m`)
- **Database:** PostgreSQL 18 on port 5454 (`shield_db`)
- **Cache:** Redis 6379
- **Service Discovery:** Eureka on 8261
- **Config Server:** Spring Cloud Config on 8288 (Git-backed from `/var/www/ai/FamilyShield/config-repo`)
- **API Gateway:** Spring Cloud Gateway on 8280 (WebFlux, JWT validation, X-Correlation-ID)
- **Circuit Breakers:** Resilience4j (per service)
- **Distributed Tracing:** Micrometer Brave + Zipkin reporter
- **Logging:** Logstash JSON encoder
- **Observability:** Prometheus:9190, Grafana:3190, Zipkin:9411

### Python AI Service
- **Runtime:** Python 3.12 + FastAPI 0.115.11
- **ASGI:** Uvicorn (2 workers)
- **AI Models:** Isolation Forest (scikit-learn), weekly digest (rule-based NLP)
- **AI APIs:** Claude API (Anthropic claude-sonnet-4-6), DeepSeek API (deepseek-chat)
- **Port:** 8291

### Frontend — React Dashboard
- **Framework:** React 19 + TypeScript 5.7
- **UI:** MUI v7 + custom Shield theme (primary: #1565C0)
- **State:** Zustand 5 (auth, alerts)
- **HTTP:** Axios + TanStack React Query v5
- **Maps:** Leaflet + react-leaflet (OpenStreetMap)
- **Charts:** Recharts
- **WebSocket:** @stomp/stompjs (STOMP over WebSocket)
- **Build:** Vite 6 → dist/

### Flutter Mobile App
- **Version:** Flutter 3.41.0 / Dart 3.7.0
- **State:** Riverpod 2.6.1
- **Navigation:** go_router 14.6.2
- **HTTP:** Dio 5.8 + retrofit
- **Maps:** google_maps_flutter 2.9.0 (API key: AIzaSyDXazeaKnjxYsnwE-Vb-gfapzhr566mo2M)
- **WebSocket:** stomp_dart_client 3.1.0
- **Push Notifications:** Firebase FCM 15.2.4
- **Background GPS:** workmanager 0.5.2 + flutter_foreground_task 8.11.0
- **Flavors:** shield (default), ISP white-label (template)

---

## Database Schemas

| Schema | Tables | Purpose |
|--------|--------|---------|
| public | customers, users, profiles, devices | Core data |
| dns | dns_rules, query_logs, category_mappings | DNS filtering |
| location | location_points (partitioned), geofences | GPS tracking |
| analytics | dns_query_logs, hourly_stats, ai_scores | Analytics |
| rewards | tasks, reward_bank | Gamification |
| notification | notification_logs | Alerts |
| admin | audit_logs | Admin tracking |

---

## DNS Engine — AdGuard Home
- **URL:** http://localhost:3080
- **User:** shield-api
- **Integration:** shield-dns service via REST API
- **Features:** 80+ category blocklists, custom per-profile DoH rules, SafeSearch enforcement

---

## API Keys Configured

| Service | Environment Variable | Configured |
|---------|---------------------|------------|
| Anthropic Claude | ANTHROPIC_API_KEY | Yes |
| DeepSeek | DEEPSEEK_API_KEY | Yes |
| Google Maps | GOOGLE_MAPS_API_KEY | Yes |

---

## Infrastructure

| Component | Details |
|-----------|---------|
| Server | Ubuntu 22.04, Java 21, Python 3.12, Node 25 |
| Reverse Proxy | Nginx (SSL termination, WebSocket, static files) |
| Process Manager | systemd (all services auto-restart on failure) |
| DNS | AdGuard Home (custom DoH per profile) |
| SSL | Let's Encrypt via Nginx |

---

## Development Phases

| Phase | Services | Status |
|-------|---------|--------|
| Phase 1 | Eureka, Config, Gateway | Complete |
| Phase 2 | Auth, Tenant, Profile, DNS, Notification | Complete |
| Phase 3 | Location, Rewards, Analytics, Admin, AI | Complete |
| Phase 4 | React Dashboard, Flutter App | Dashboard source complete (build pending), Flutter TBD |

---

## Nginx Routes

```
https://shield.rstglobal.in/
├── /                    → Marketing website (shield-website/)
├── /login.html          → Login page
├── /register.html       → Register page
├── /dashboard           → React Dashboard (shield-dashboard/dist/)
├── /api/v1/             → API Gateway (:8280)
├── /ws/                 → WebSocket (Notification :8286)
├── /eureka/             → Eureka dashboard (:8261)
└── /shield-latest.apk   → Android APK download
```

---

## Quick Commands

```bash
# Check all service status
systemctl status shield-{eureka,config,gateway,auth,tenant,profile,dns,location,notification,rewards,analytics,admin,ai}

# View logs for any service
journalctl -u shield-auth -f

# Restart a specific service
systemctl restart shield-gateway

# Check all health endpoints
for port in 8261 8288 8280 8281 8282 8283 8284 8285 8286 8287 8289 8290 8291; do
  echo -n "Port $port: "
  curl -s --max-time 2 http://localhost:$port/actuator/health | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null
done
```
