# 02 — System Architecture

## High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────────┐   │
│  │  React Web      │  │ Flutter Parent  │  │  Flutter Child App    │   │
│  │  Dashboard      │  │ App (iOS/Droid) │  │  (Panic/SOS/Tasks)    │   │
│  │  TypeScript/MUI │  │ Riverpod/Dio    │  │  Minimal permissions  │   │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬────────────┘   │
│           │ HTTPS              │ HTTPS                 │ HTTPS/GPS       │
└───────────┼────────────────────┼───────────────────────┼────────────────┘
            │                    │                        │
            ▼                    ▼                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                              NGINX :443                               │
│                   shield.rstglobal.in (SSL / Let's Encrypt)         │
│                                                                       │
│  /              → React SPA build (static files)                     │
│  /api/v1/*      → :8280 (API Gateway)                                │
│  /ws/*          → :8285 (Location WebSocket) / :8284 (DNS activity)  │
│  /eureka/*      → :8261 (Eureka dashboard — admin only)              │
│  /adguard/*     → :3080 (AdGuard Home UI — admin only)               │
│  *.dns.domain   → :4443 (AdGuard DoH endpoint, per-child subdomain)  │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    API GATEWAY :8280                                   │
│              Spring Cloud Gateway 2025.1.1 (WebFlux)                  │
│                                                                        │
│  • JWT validation (HS512) — rejects invalid/expired tokens            │
│  • Injects X-User-Id, X-User-Role, X-Tenant-Id headers               │
│  • Generates X-Correlation-ID (UUID) for distributed tracing          │
│  • Rate limiting via Redis token-bucket (100 req/s, burst 200)        │
│  • Resilience4j circuit breakers per downstream service               │
│  • CORS: allowed origins, exposed X-Correlation-ID / X-Total-Count   │
│  • /api/v1/auth/** → bypasses JWT (login / register)                  │
│  • /api/v1/child/** → validates CHILD_TOKEN (device PIN)              │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │ routes to microservices (Eureka LB)
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          MICROSERVICES LAYER                             │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Auth Service │  │Tenant Service│  │Profile Svc   │  │ DNS Service │ │
│  │   :8281      │  │   :8282      │  │   :8283      │  │   :8284     │ │
│  │ JWT, BCrypt  │  │ ISP/Global   │  │ Customers,   │  │ AdGuard API │ │
│  │ Registration │  │ Admin mgmt   │  │ Children,    │  │ DNS Rules   │ │
│  │ Login, MFA  │  │ Tenants,     │  │ Devices      │  │ Schedules   │ │
│  │ Token refresh│  │ Feature flags│  │ DoH Client ID│  │ Categories  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │Location Svc  │  │Notification  │  │Rewards Svc   │  │Analytics Svc│ │
│  │   :8285      │  │Service :8286 │  │   :8287      │  │   :8289     │ │
│  │ GPS tracking │  │ FCM (Android)│  │ Tasks/Chores │  │ ClickHouse  │ │
│  │ Geofences    │  │ APNs (iOS)   │  │ Reward bank  │  │ DNS logs    │ │
│  │ Panic button │  │ Email (SMTP) │  │ Achievements │  │ Usage stats │ │
│  │ Driving mode │  │ WebSocket    │  │ Badges       │  │ Reports PDF │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐                                     │
│  │ Admin Service│  │AI Service    │                                     │
│  │   :8290      │  │(Python) :8291│                                     │
│  │ Global admin │  │ NLP + BERT   │                                     │
│  │ ISP billing  │  │ Anomaly det. │                                     │
│  │ Compliance   │  │ Weekly digest│                                     │
│  │ Platform ops │  │ Risk scoring │                                     │
│  └──────────────┘  └──────────────┘                                     │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
           ┌───────────────────────┼──────────────────────┐
           ▼                       ▼                       ▼
┌──────────────────┐  ┌────────────────────┐  ┌──────────────────────┐
│  PostgreSQL 18   │  │  Redis 7.0.15      │  │  AdGuard Home        │
│  :5454 primary   │  │  :6379             │  │  :3080 (UI)          │
│  :5455 replica   │  │                    │  │  :5353 (DNS UDP/TCP) │
│                  │  │  • JWT blacklist   │  │  :4443 (DoH)         │
│  Schema per svc: │  │  • Session store   │  │                      │
│  auth, tenant,   │  │  • Rate limit      │  │  • DNS engine        │
│  profile, dns,   │  │  • WS Pub/Sub      │  │  • Client IDs        │
│  location,       │  │  • AI job queue    │  │  • Blocklists        │
│  rewards,        │  │  • DNS rules cache │  │  • Query logs        │
│  analytics       │  │  • Geofence cache  │  │  • DoH/DoT/DNS-over  │
│                  │  │  • Online presence │  │    -TLS endpoints    │
│  Flyway per svc  │  │                    │  │                      │
└──────────────────┘  └────────────────────┘  └──────────────────────┘
```

---

## Microservices — Port Reference

| Service | Port | Responsibility |
|---------|------|----------------|
| **Eureka Server** | **8261** | Service registry and discovery |
| **Config Server** | **8288** | Centralised config (file-based / git) |
| **API Gateway** | **8280** | JWT auth, routing, rate limiting, CORS |
| **Auth Service** | **8281** | Registration, login, JWT issue/refresh, BCrypt, multi-tenant |
| **Tenant Service** | **8282** | Global Admin + ISP Admin management, feature flags, quotas |
| **Profile Service** | **8283** | Customer accounts, child profiles, device management, DoH Client IDs |
| **DNS Service** | **8284** | AdGuard Home REST API integration, DNS rules, categories, schedules |
| **Location Service** | **8285** | GPS upload, geofences, location history, panic/SOS, driving mode |
| **Notification Service** | **8286** | FCM push, APNs push, email (SMTP), WebSocket, weekly reports |
| **Rewards Service** | **8287** | Tasks/chores, reward bank, achievements, badges, streaks |
| **Analytics Service** | **8289** | DNS query analytics, usage charts, PDF reports |
| **Admin Service** | **8290** | Platform admin ops, ISP billing, regulatory compliance |
| **AI Service (Python)** | **8291** | NLP classifier, anomaly detection, weekly AI digest |
| **AdGuard Home** | **3080 (UI)** | Core DNS engine |
| AdGuard DNS | 5353 (UDP/TCP) | DNS resolution for home routers |
| AdGuard DoH | 4443 | DNS-over-HTTPS for mobile devices |

---

## Service Communication Patterns

```
┌──────────────────────────────────────────────────────────────┐
│                  Communication Patterns                       │
│                                                              │
│  Sync (HTTP/REST via Gateway):                               │
│  Client → Gateway → Service → Response                       │
│  Used for: all client-facing API calls                       │
│                                                              │
│  Sync (Internal, service-to-service):                        │
│  profile-service → dns-service (apply DNS rules on change)  │
│  profile-service → notification-service (new device alert)  │
│  location-service → notification-service (geofence breach)  │
│  dns-service → ai-service (batch DNS logs for analysis)     │
│                                                              │
│  Async (Redis Pub/Sub) — current:                            │
│  Channel: shield.dns.activity.{customerId}                   │
│  Channel: shield.alerts.{customerId}                         │
│  Channel: shield.location.{profileId}                        │
│  Channel: shield.ai.analysis.queue                           │
│                                                              │
│  Future upgrade: Kafka (3-broker cluster) for high-volume   │
│  DNS event streaming at ISP scale                           │
│                                                              │
│  Real-time (WebSocket/STOMP via Notification Service):       │
│  /topic/activity/{profileId}   — live DNS query feed        │
│  /topic/alerts/{customerId}    — parent alert stream        │
│  /topic/location/{profileId}   — live GPS position         │
│  /topic/panic/{customerId}     — SOS emergency alert        │
└──────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenant Data Isolation

All services enforce **Row-Level Security (RLS)** on PostgreSQL with `tenant_id`. The API Gateway adds `X-Tenant-Id` from the validated JWT, and every service includes it in all queries.

```sql
-- Example RLS policy (applied to every table)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON profiles
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- Every service sets this before queries:
SET LOCAL app.tenant_id = '...';
```

---

## JWT Token Structure

```json
{
  "sub": "user-uuid",
  "email": "parent@example.com",
  "role": "CUSTOMER",
  "tenant_id": "isp-tenant-uuid",
  "iat": 1700000000,
  "exp": 1700003600
}
```

| Field | Description |
|-------|-------------|
| `sub` | User UUID (maps to `users.id`) |
| `role` | One of: `GLOBAL_ADMIN`, `ISP_ADMIN`, `CUSTOMER`, `CHILD_APP` |
| `tenant_id` | ISP tenant UUID (null for `GLOBAL_ADMIN`) |
| `iat` | Issued-at timestamp |
| `exp` | Expiry — access token: 1 hour; refresh token: 30 days |

Child app tokens use `CHILD_APP` role with `profile_id` claim. They can only call `/api/v1/child/**` endpoints.

---

## DNS Traffic Flow

```
Child's device (Private DNS set to jake.dns.shield.rstglobal.in)
        │ DNS-over-HTTPS (port 443)
        ▼
Nginx → AdGuard Home :4443 (DoH endpoint)
        │
        ▼
AdGuard Home — identifies child via subdomain "jake"
        │
        ├── Query against global blocklists (malware, CSAM, phishing)
        ├── Query against ISP blocklist (tenant-specific rules)
        ├── Query against per-profile rules (categories, custom allow/block)
        ├── Check schedules (is this a blocked time slot?)
        ├── Check time budgets (has YouTube limit been reached today?)
        │
        ├── BLOCKED → return NXDOMAIN + log to ClickHouse
        │                     + publish to shield.dns.activity channel
        │                     + increment daily counter in Redis
        │
        └── ALLOWED → forward to upstream resolver (Cloudflare 1.1.1.1)
                      + log to ClickHouse (sampled 10% for allowed)
```

---

## Infrastructure Services

| Service | Port | Purpose |
|---------|------|---------|
| Nginx | 80, 443 | SSL termination, reverse proxy, static serving |
| PostgreSQL 18 | 5454 (primary) | Primary database for all services |
| PostgreSQL 18 | 5455 (replica) | Read replica for analytics queries |
| Redis 7 | 6379 | Cache, sessions, Pub/Sub, rate-limiting |
| AdGuard Home | 3080, 5353, 4443 | DNS engine |
| Prometheus | **9190** | Metrics scraping (non-conflicting with SmartTrack:9090) |
| Grafana | **3190** | Dashboards (non-conflicting with SmartTrack:3000) |
| Zipkin | **9411** | Distributed tracing (Micrometer Brave + Zipkin reporter) |

---

## Deployment Model (Phase 1 — Single VPS)

```
Ubuntu 24.04 — /var/www/ai/Shield/
│
├── Spring Boot services: run as systemd services (direct JARs)
├── Python AI service: run as systemd service (uvicorn)
├── AdGuard Home: Docker container
├── Prometheus + Grafana: Docker Compose (monitoring stack)
├── React build: served by Nginx from /var/www/ai/Shield/shield-dashboard/dist/
└── Flutter APK: served by Nginx from /var/www/ai/Shield/static/
```

All Spring Boot services are configured via `application.yml` pointing to:
- PostgreSQL: `localhost:5454` (database: `shield_db`)
- Redis: `localhost:6379` (no password — consistent with server config)
- Eureka: `http://localhost:8261/eureka`
