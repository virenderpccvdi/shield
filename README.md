# Shield — Smart Family Internet Protection Platform

> Multi-tenant ISP platform for DNS-based content filtering, GPS geofencing, AI anomaly detection, and family screen-time management.

[![Quality Gate](https://github.com/virenderpccvdi/shield/actions/workflows/quality-gate.yml/badge.svg)](https://github.com/virenderpccvdi/shield/actions/workflows/quality-gate.yml)
[![Shield QA Pipeline](https://github.com/virenderpccvdi/shield/actions/workflows/qa.yml/badge.svg)](https://github.com/virenderpccvdi/shield/actions/workflows/qa.yml)
[![CodeQL](https://github.com/virenderpccvdi/shield/actions/workflows/codeql.yml/badge.svg)](https://github.com/virenderpccvdi/shield/actions/workflows/codeql.yml)
[![Trivy Security](https://github.com/virenderpccvdi/shield/actions/workflows/trivy.yml/badge.svg)](https://github.com/virenderpccvdi/shield/actions/workflows/trivy.yml)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

**Live:** https://shield.rstglobal.in &nbsp;|&nbsp; **Docs:** [doc/](doc/README.md)

---

## What is Shield?

Shield is a production-grade, multi-tenant SaaS platform that ISPs deploy to offer families:

| Feature | How it works |
|---------|-------------|
| **DNS content filtering** | Per-child DoH client IDs — shield-dns-resolver (Java) filters by 43 content categories |
| **Screen-time scheduling** | Block internet access by time-of-day (school, bedtime, weekend presets) |
| **GPS geofencing** | Real-time location with breach alerts and place history |
| **AI anomaly detection** | Isolation Forest + Claude AI flags unusual browsing patterns |
| **Rewards & tasks** | Parents assign tasks; children earn points redeemable for screen time |
| **Multi-tenant billing** | ISPs resell Shield to families via Stripe Checkout (INR) |
| **Flutter mobile app** | Parent + child screens — push alerts, SOS, DNS quick-toggle |

---

## Architecture

### High-Level Platform Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ROSTAN TECHNOLOGIES — SHIELD                     │
│                    Smart Family Internet Protection                       │
└─────────────────────────────────────────────────────────────────────────┘

 ┌─── CLIENT TIER ───────────────────────────────────────────────────────┐
 │  Flutter Android/iOS App     React Dashboard (SPA)    Static Website  │
 │       shield-app                shield-dashboard       shield-website  │
 └──────────┬──────────────────────────┬───────────────────────┬─────────┘
            │  HTTPS / WSS             │  HTTPS                │  HTTPS
            ▼                          ▼                        ▼
 ┌─── EDGE / PROXY ──────────────────────────────────────────────────────┐
 │           Nginx 1.24  (SSL termination · reverse proxy)               │
 │     shield.rstglobal.in:443  →  Let's Encrypt auto-renew             │
 └──────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
 ┌─── API GATEWAY ───────────────────────────────────────────────────────┐
 │         Spring Cloud Gateway  :8280  (WebFlux / reactive)            │
 │   JWT validation · Rate limiting · Circuit breakers (Resilience4j)   │
 │   Correlation-ID injection · Service discovery (Eureka)              │
 └──┬─────────┬────────────┬───────────┬───────────┬────────────┬───────┘
    │         │            │           │           │            │
    ▼         ▼            ▼           ▼           ▼            ▼
 ┌──────┐ ┌──────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
 │ Auth │ │Tenant│ │ Profile │ │   DNS   │ │Location  │ │Analytics │
 │:8281 │ │:8282 │ │  :8283  │ │  :8284  │ │  :8285   │ │  :8289   │
 └──┬───┘ └──┬───┘ └────┬────┘ └────┬────┘ └────┬─────┘ └────┬─────┘
    │        │           │           │           │             │
    ▼        ▼           ▼           ▼           ▼             ▼
 ┌─── DATA TIER ─────────────────────────────────────────────────────────┐
 │   PostgreSQL 18 (Patroni HA)         Redis 7.0 (cache · pub/sub)     │
 │   Schemas: auth · tenant · profile   DNS rules · session tokens      │
 │            dns · location · rewards  Rate limits · broadcast events  │
 │            analytics · admin                                          │
 └───────────────────────────────────────────────────────────────────────┘

 ┌─── DNS FILTERING ENGINE ──────────────────────────────────────────────┐
 │                                                                        │
 │   Child Device (Android VPN / DoH)                                    │
 │        │  POST /dns/{clientId}/dns-query                              │
 │        │  Content-Type: application/dns-message (RFC 8484)            │
 │        ▼                                                               │
 │   shield-dns-resolver  :8292  (Spring WebFlux · pure Java)           │
 │   ┌────────────────────────────────────────────────────────┐          │
 │   │  DNS Wire Format Parse (dnsjava 3.6)                   │          │
 │   │       ↓                                                │          │
 │   │  Domain Enrichment → Redis category cache              │          │
 │   │       ↓                                                │          │
 │   │  Rule Check pipeline (in order):                       │          │
 │   │    1. Custom Allowlist  → ALLOW (overrides all)        │          │
 │   │    2. Custom Blocklist  → BLOCK (return 0.0.0.0/::)   │          │
 │   │    3. Category Filter   → BLOCK if category disabled   │          │
 │   │    4. Schedule Check    → BLOCK if in blocked window   │          │
 │   │    5. SafeSearch CNAME  → redirect google/yt/bing      │          │
 │   │    6. Upstream Forward  → 1.1.1.1 / 8.8.8.8 (UDP)    │          │
 │   │       ↓                                                │          │
 │   │  Async Query Log → PostgreSQL dns.browsing_history     │          │
 │   │  Metrics → Prometheus (dns.queries.total/blocked)      │          │
 │   └────────────────────────────────────────────────────────┘          │
 │        ↑                                                               │
 │   shield-dns  :8284  (rules management)                               │
 │   Rules DB → Redis broadcast → dns-resolver cache (TTL 5 min)        │
 └───────────────────────────────────────────────────────────────────────┘

 ┌─── SUPPORTING SERVICES ───────────────────────────────────────────────┐
 │  Notification :8286  FCM push · WebSocket STOMP · Email (weekly digest│
 │  Rewards      :8287  Tasks · point ledger · redemption                │
 │  Admin        :8290  Platform-wide management API                     │
 │  shield-ai    :8291  FastAPI · Isolation Forest · Claude API          │
 │                      Anomaly detection · AI insights · gap analysis   │
 └───────────────────────────────────────────────────────────────────────┘

 ┌─── MONITORING & OBSERVABILITY ────────────────────────────────────────┐
 │  Prometheus :9190  →  Grafana :3190  (dashboards + alerting)          │
 │  Zipkin :9412  (distributed tracing across all microservices)         │
 │  Vector log pipeline  →  PostgreSQL analytics schema                  │
 └───────────────────────────────────────────────────────────────────────┘

 ┌─── INFRASTRUCTURE / CI-CD ────────────────────────────────────────────┐
 │  GitHub Actions: Quality Gate · QA Pipeline · CodeQL · Trivy          │
 │  Azure DevOps: Multi-stage pipeline (build → test → deploy)           │
 │  Kubernetes: k8s/ manifests · Helm-ready                              │
 │  Docker Compose: local dev + monitoring stack                          │
 └───────────────────────────────────────────────────────────────────────┘
```

### DNS Filtering Data Flow

```
Parent configures rules                  Child browses on Android
in React Dashboard                       VPN intercepts DNS port 53
        │                                        │
        ▼                                        ▼ DoH POST
shield-dns (8284)                    shield-dns-resolver (8292)
  saves to PostgreSQL                    1. Parse DNS wire format
  broadcasts via Redis pub/sub           2. Look up dnsClientId → profileId
        │                                3. Load rules from Redis (or
        ▼                                   fetch from shield-dns if miss)
 shield:dns:rules:                      4. Apply rule pipeline:
   profileId → blocklist                   allowlist → blocklist
   profileId → allowlist                   → categories → schedule
   profileId → categories                  → SafeSearch CNAME
   profileId → schedule                 5. Return 0.0.0.0 (blocked)
   profileId → level                       or forward to 1.1.1.1
   profileId → safe_search             6. Log to PostgreSQL async
                                        7. Metrics to Prometheus
```

Full architecture diagram: [doc/02-system-architecture.md](doc/02-system-architecture.md)

---

## Tech Stack (2026)

| Layer | Technology |
|-------|-----------|
| Backend | Spring Boot **4.0.3** · Spring Cloud **2025.1.1** · Java 21 |
| Gateway | Spring Cloud Gateway 5.x (WebFlux) |
| Auth | Spring Security 7.x · JJWT 0.13.0 · TOTP MFA |
| Database | PostgreSQL 18 (Patroni HA) · Flyway migrations |
| Cache | Redis 7.0 · Spring Cache |
| AI Service | Python 3.13 · FastAPI 0.115 · scikit-learn 1.6 · Anthropic Claude |
| Mobile | Flutter **3.41.0** · Dart 3.7 (25 screens) |
| Dashboard | React **19.2** · MUI **v7.3** · Vite 6 · TypeScript 5.8 |
| DNS Engine | **shield-dns-resolver** (Java · dnsjava 3.6) · DoH/DoT · per-child client IDs · pure Java |
| Monitoring | Prometheus · Grafana · Zipkin · Vector log pipeline |
| Containers | Docker 29 · Docker Compose · Kubernetes manifests in `k8s/` |
| CI/CD | GitHub Actions (4 pipelines) · Azure DevOps |
| Security | CodeQL · Trivy · Gitleaks · OWASP ZAP · Dependabot |

---

## Services & Ports

| Service | Port | Description |
|---------|------|-------------|
| `shield-gateway` | **8280** | API Gateway — JWT validation, routing, circuit breakers |
| `shield-auth` | **8281** | Registration, login, TOTP MFA, JWT refresh |
| `shield-tenant` | **8282** | ISP tenant management, plans, customer onboarding |
| `shield-profile` | **8283** | Child profiles, device registration (DoH URL generation) |
| `shield-dns` | **8284** | DNS rules management — categories, schedules, time budgets, allow/block lists |
| `shield-dns-resolver` | **8443** | DNS filter engine — DoH/DoT, dnsjava, Redis rules cache, SafeSearch |
| `shield-location` | **8285** | GPS tracking, geofence zones, breach detection |
| `shield-notification` | **8286** | FCM push, WebSocket STOMP, email, weekly digest |
| `shield-rewards` | **8287** | Tasks, point system, reward redemption |
| `shield-config` | **8288** | Spring Cloud Config server |
| `shield-analytics` | **8289** | DNS query analytics, usage stats, ISP reporting |
| `shield-admin` | **8290** | Platform-wide admin API |
| `shield-ai` | **8291** | Python AI — anomaly detection, insights, gap analysis |
| `shield-eureka` | **8261** | Service discovery (Eureka) |

---

## Roles

| Role | Access |
|------|--------|
| `GLOBAL_ADMIN` | Full platform — all tenants, billing, analytics |
| `ISP_ADMIN` | Own tenant — customers, plans, DNS reports |
| `CUSTOMER` | Own family — child profiles, location, content rules |
| `CHILD` | Mobile app only — tasks, SOS, own screen-time view |

---

## Quick Start (Local Dev)

**Prerequisites:** Java 21, Maven 3.8+, Docker, Node 25, Python 3.13, Flutter 3.41

```bash
# 1. Clone and configure
git clone https://github.com/virenderpccvdi/shield.git
cd shield
cp .env.example .env          # fill in DB creds, JWT secret, API keys

# 2. Start infrastructure
docker compose up -d postgres redis

# 3. Build all Java services
mvn package -DskipTests -q

# 4. Start services (order matters: eureka → config → gateway → *)
bash start-services.sh

# 5. React dashboard (dev server)
cd shield-dashboard && npm ci && npm run dev

# 6. Flutter mobile app
cd shield-app && flutter run

# 7. Python AI service
cd shield-ai && pip install -r requirements.txt && uvicorn main:app --port 8291
```

API documentation (Swagger UI) once services are running:
```
http://localhost:8280/docs/{service}/swagger-ui/index.html
# services: auth, tenant, profile, dns, location, notification, rewards, analytics, admin
```

---

## Project Structure

```
shield/
├── shield-common/          Shared library — exceptions, DTOs, base entities
├── shield-eureka/          Service discovery
├── shield-config/          Centralised config server
├── shield-gateway/         API gateway (WebFlux)
├── shield-auth/            Authentication & authorisation
├── shield-tenant/          Multi-tenant / ISP management
├── shield-profile/         Child profiles & devices
├── shield-dns/             DNS rules management (categories, schedules, budgets)
├── shield-dns-resolver/    DNS filter engine (DoH/DoT, Java, dnsjava)
├── shield-location/        GPS & geofencing
├── shield-notification/    Push, email, WebSocket
├── shield-rewards/         Gamification / tasks
├── shield-analytics/       Usage analytics
├── shield-admin/           Platform admin
├── shield-ai/              Python FastAPI — ML + Claude AI
├── shield-app/             Flutter mobile app (iOS + Android)
├── shield-dashboard/       React 19 web dashboard
├── shield-website/         Static marketing / landing site
├── config-repo/            Spring Cloud Config files
├── k8s/                    Kubernetes manifests
├── qa/                     QA agent (Python) + test suites
├── doc/                    Full platform documentation (15 files)
└── .github/                CI/CD, Dependabot, security policies
```

---

## Security

Shield uses a defence-in-depth approach:

- **CodeQL** — Java, TypeScript, and Python static analysis on every push
- **Trivy** — Docker image CVE scanning + IaC misconfiguration checks
- **Gitleaks** — Secret scanning across full git history
- **Dependabot** — Automated dependency updates (Maven, npm, pip, pub, Actions)
- **OWASP ZAP** — Nightly DAST scan against running gateway
- **SBOM** — Software Bill of Materials generated per release

Report vulnerabilities via [SECURITY.md](.github/SECURITY.md).

---

## Documentation

| File | Topic |
|------|-------|
| [01-platform-overview.md](doc/01-platform-overview.md) | Product vision, user roles, business model |
| [02-system-architecture.md](doc/02-system-architecture.md) | Architecture diagram, service communication |
| [03-microservices-specification.md](doc/03-microservices-specification.md) | Per-service API, DB schema, responsibilities |
| [04-database-design.md](doc/04-database-design.md) | Full PostgreSQL schema |
| [05-dns-engine.md](doc/05-adguard-dns-engine.md) | DoH/DoT, per-child DNS client IDs, shield-dns-resolver architecture |
| [06-flutter-mobile-app.md](doc/06-flutter-mobile-app.md) | 25 screens, navigation, Firebase FCM |
| [07-web-dashboard.md](doc/07-web-dashboard.md) | React dashboard — all pages and components |
| [08-api-reference.md](doc/08-api-reference.md) | Full REST API reference |
| [09-ai-monitoring-service.md](doc/09-ai-monitoring-service.md) | Isolation Forest, Claude AI integration |
| [10-infrastructure-deployment.md](doc/10-infrastructure-deployment.md) | Nginx, systemd, PostgreSQL HA, Redis |

---

## CI / CD

| Pipeline | Trigger | What it checks |
|----------|---------|----------------|
| **Quality Gate** | Every push + PR | Build, TypeScript, Flutter analyze, Dockerfile lint, pip-audit, npm audit |
| **Shield QA** | Every push to main + daily | API integration tests (health, auth, DNS, security), full QA suite |
| **CodeQL** | Every push + weekly | Java, TypeScript, Python SAST; secret scanning (Gitleaks) |
| **Trivy** | Every push + daily | Filesystem CVEs, Docker image CVEs (all 9 services), k8s IaC misconfigs |

---

## License

[Proprietary](LICENSE) — Copyright (c) 2026 Rostan Technologies. All rights reserved.

This software is the confidential and proprietary information of Rostan Technologies.
Unauthorised copying, distribution, or use is strictly prohibited.
