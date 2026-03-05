# 11 — Implementation Roadmap

## Overview

8 phases from MVP DNS filtering to full multi-tenant ISP platform.
**Current status:** Pre-development (documentation complete, infrastructure ready).

| Phase | Focus | Services | Timeline |
|-------|-------|----------|----------|
| 1 | Foundation MVP | Eureka, Config, Gateway, Auth, Tenant | Month 1–3 |
| 2 | Core Parent Features | Profile, DNS, Notification, Analytics, React Dashboard | Month 4–6 |
| 3 | GPS & Location | Location service, Geofences, Panic button | Month 7–9 |
| 4 | AI Monitoring | Python AI service, Anomaly detection, Weekly digest | Month 10–12 |
| 5 | Reward System | Rewards service, Child app screens | Month 13–15 |
| 6 | Multi-Tenant ISP | ISP Admin portal, TR-069 provisioning, White-label Flutter | Month 16–20 |
| 7 | Production Hardening | Security audit, load testing, HA, CI/CD | Month 21–22 |
| 8 | Social Monitoring | Signal-based social monitoring, New contact alerts | Month 23–26 |

---

## Phase 1 — Foundation MVP (Months 1–3)

**Goal:** Working authentication + basic DNS filtering via AdGuard Home. Parents can login, create child profiles, enable/disable content categories.

### Services to build:

**1. shield-common** (Week 1)
- [ ] Base entity (UUID, tenantId, createdAt, updatedAt)
- [ ] ApiResponse, PagedResponse, ErrorResponse DTOs
- [ ] GlobalExceptionHandler
- [ ] JwtUtils (HS512, JJWT 0.12.6)
- [ ] TenantContext (ThreadLocal)

**2. shield-eureka :8261** (Week 1)
- [ ] Spring Cloud Eureka Server
- [ ] Basic auth (EUREKA_PASSWORD)
- [ ] systemd service unit

**3. shield-config :8288** (Week 1)
- [ ] Spring Cloud Config Server (native filesystem)
- [ ] Config files in `/var/www/ai/FamilyShield/config-repo/`
- [ ] Shared `application.yml` (DB, Redis, JWT, domain)
- [ ] systemd service unit

**4. shield-gateway :8280** (Week 2)
- [ ] Spring Cloud Gateway
- [ ] JWT validation filter (HS512)
- [ ] X-User-Id, X-User-Role, X-Tenant-Id header injection
- [ ] Rate limiting (Redis): api_limit, auth_limit
- [ ] CORS config (https://shield.rstglobal.in)
- [ ] Routes: /auth/**, /children/**, /rules/**, /budgets/**
- [ ] Circuit breaker (Resilience4j)
- [ ] systemd service unit

**5. shield-auth :8281** (Weeks 2–4)
- [ ] PostgreSQL schema `auth` + Flyway migrations
- [ ] User registration (CUSTOMER role)
- [ ] Email/password login → JWT pair
- [ ] Refresh token (Redis + DB)
- [ ] Logout (blacklist JWT)
- [ ] Forgot/reset password (email via SMTP)
- [ ] Child app token issuance (PIN-based)
- [ ] Multi-tenant login (tenantSlug in request)
- [ ] systemd service unit

**6. shield-tenant :8282** (Weeks 3–6)
- [ ] PostgreSQL schema `tenant` + Flyway migrations
- [ ] ISP tenant CRUD (Global Admin)
- [ ] Feature flags per tenant (JSONB)
- [ ] Quota management
- [ ] Default tenant: `rst-default` (shield.rstglobal.in)
- [ ] ISP Admin login and tenant context
- [ ] systemd service unit

**Phase 1 Database setup:**
```bash
# Run once on server
sudo -u postgres psql -p 5454 << 'EOF'
CREATE DATABASE shield_db;
CREATE USER shield WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE shield_db TO shield;
\c shield_db
CREATE SCHEMA auth;
CREATE SCHEMA tenant;
GRANT ALL ON SCHEMA auth, tenant TO shield;
EOF
```

**Phase 1 Deliverables:**
- [ ] https://shield.rstglobal.in returns 200 (React placeholder page)
- [ ] POST /api/v1/auth/register → creates customer account
- [ ] POST /api/v1/auth/login → returns JWT
- [ ] GET /api/v1/auth/me → returns current user
- [ ] All services visible in Eureka dashboard (localhost:8261)

---

## Phase 2 — Core Parent Features (Months 4–6)

**Goal:** Full DNS filtering, per-child profiles, schedule builder, time budgets, push notifications, weekly email reports, React dashboard.

### Services to build:

**7. shield-profile :8283** (Weeks 1–3)
- [ ] PostgreSQL schema `profile` + Flyway
- [ ] Customer account management
- [ ] Child profile CRUD (+ AdGuard Home client creation via REST API)
- [ ] Device registration (QR code generation)
- [ ] Family member (co-parent) invites
- [ ] DNS Client ID slug generation (unique per child)

**8. shield-dns :8284** (Weeks 2–5)
- [ ] PostgreSQL schema `dns` + Flyway
- [ ] 80+ content category toggles (maps to AdGuard filter lists)
- [ ] Custom allow/block lists → sync to AdGuard
- [ ] Schedule grid (24h × 7-day) → sync to AdGuard client schedule
- [ ] Time budget per app (YouTube, TikTok, etc.)
- [ ] Budget enforcement via AdGuard blocked_services + Redis counters
- [ ] Midnight budget reset (scheduled task)
- [ ] Time extension request/approval
- [ ] AdGuard REST API client (all operations)

**9. shield-notification :8286** (Weeks 3–6)
- [ ] Firebase FCM setup (Android push)
- [ ] APNs setup (iOS push)
- [ ] Email templates (block alert, weekly report, welcome)
- [ ] WebSocket STOMP server (live DNS feed)
- [ ] Alert preference management (quiet hours, channels)
- [ ] Monday 8am weekly summary email (scheduled task)

**10. shield-analytics :8289** (Weeks 4–6)
- [ ] PostgreSQL schema `analytics` (partitioned dns_query_logs)
- [ ] Vector log pipeline: AdGuard → PostgreSQL
- [ ] Usage chart endpoints (today, week, month)
- [ ] Top domains endpoint
- [ ] Blocked events history (paged)
- [ ] PDF report generation (iText or Apache PDFBox)

**11. shield-dashboard** (Weeks 3–6, React)
- [ ] Vite + React 19 + TypeScript + MUI v7 project setup
- [ ] Axios client with JWT inject + 401 refresh
- [ ] Login / Register / Forgot password pages
- [ ] Customer dashboard (child cards)
- [ ] Child profile detail (tabs: Rules, Schedule, Time Limits, Devices)
- [ ] Live activity feed (WebSocket STOMP)
- [ ] Schedule grid builder
- [ ] Build + deploy to `/var/www/ai/FamilyShield/shield-dashboard/dist/`

**Phase 2 Deliverables:**
- [ ] Parent can create child profile → gets DoH URL
- [ ] Parent sets child's Android Private DNS → filtering works
- [ ] Real-time block alert push notifications
- [ ] Live DNS feed visible in React dashboard
- [ ] Monday weekly email summary arrives

---

## Phase 3 — GPS & Location (Months 7–9)

**Goal:** Real-time GPS, geofences, panic button, location history, place manager.

**12. shield-location :8285**
- [ ] PostgreSQL schema `location` (partitioned location_points)
- [ ] GPS upload endpoint (CHILD_APP token)
- [ ] Real-time GPS map feed via WebSocket
- [ ] Geofence engine (circle: Haversine formula; polygon: ray-casting)
- [ ] Geofence breach detection → FCM alert
- [ ] Named places with auto-arrival/departure detection
- [ ] Panic/SOS button → immediate FCM push
- [ ] Driving mode detection (speed > 20 km/h)
- [ ] Location history paged API
- [ ] Manual check-in endpoint

**Flutter app — Phase 3 screens:**
- [ ] Live GPS map (all children)
- [ ] Location history + route playback
- [ ] Geofence manager (draw + name)
- [ ] Places manager
- [ ] Panic button (prominent in child app)
- [ ] Full-screen SOS alert view (parent)

**Phase 3 Deliverables:**
- [ ] Child's live location visible on parent's map
- [ ] Geofence alert fires within 60 seconds of breach
- [ ] Panic button sends FCM push with GPS coordinates

---

## Phase 4 — AI Monitoring (Months 10–12)

**Goal:** Python AI service, anomaly detection, addiction scoring, weekly AI digest.

**13. shield-ai :8291 (Python)**
- [ ] FastAPI project setup (Python 3.12)
- [ ] Virtual environment + requirements.txt
- [ ] Isolation Forest model training script (on historical DNS data)
- [ ] Hourly batch analysis endpoint (called by analytics service)
- [ ] Risk scoring (addiction + mental health signals)
- [ ] Weekly digest generation (rule-based templates)
- [ ] Custom keyword matching
- [ ] systemd service unit

**Dashboard updates:**
- [ ] AI Insights tab on child profile detail
- [ ] Mental health dashboard (per-child)
- [ ] AI concern alert type + detail screen
- [ ] Keyword watch list configuration

**Phase 4 Deliverables:**
- [ ] AI weekly digest email generated every Monday
- [ ] Late-night usage alerts firing correctly
- [ ] Schedule violation counter tracked
- [ ] Risk score displayed in parent app

---

## Phase 5 — Reward System (Months 13–15)

**Goal:** Task/chore builder, reward bank, achievements, child-facing app screens.

**14. shield-rewards :8287**
- [ ] PostgreSQL schema `rewards` + Flyway
- [ ] Task CRUD (parent creates tasks with reward minutes)
- [ ] Child marks task complete (CHILD_APP endpoint)
- [ ] Parent approves → reward bank credited
- [ ] Reward bank balance + redemption
- [ ] Achievement badge system (7 badge types)
- [ ] Streak tracking + streak bonus

**Flutter app — Phase 5 screens:**
- [ ] Rewards tab on child profile (parent view)
- [ ] Child task list (child-facing)
- [ ] Reward bank display (child-facing)
- [ ] Achievement gallery
- [ ] Streak counter

---

## Phase 6 — Multi-Tenant ISP (Months 16–20)

**Goal:** ISP Admin portal, white-label Flutter flavors, TR-069 provisioning.

**15. shield-admin :8290**
- [ ] Full ISP Admin portal API
- [ ] Customer bulk import (CSV)
- [ ] TR-069/CWMP auto-provisioning webhook
- [ ] ISP content policy management
- [ ] ISP branding API (logo, colors, app name)
- [ ] Regulatory compliance reports
- [ ] Customer churn tracking

**Dashboard updates:**
- [ ] ISP Admin portal pages (customers, branding, analytics, blocklist)
- [ ] Global Admin portal pages (tenants, platform dashboard)

**Flutter flavors:**
- [ ] flutter_flavor system setup
- [ ] ISP template flavor (copy for each new ISP)
- [ ] Build script for multi-flavor CI/CD

---

## Phase 7 — Production Hardening (Months 21–22)

- [ ] Security audit (OWASP Top 10 review)
- [ ] Load testing (k6 or Gatling): 1000 concurrent parents, 10k DNS queries/min
- [ ] PostgreSQL connection pooling (PgBouncer)
- [ ] Redis Sentinel (HA for Redis)
- [ ] Automated backup script (PostgreSQL + Redis)
- [ ] SSL certificate auto-renewal verification
- [ ] Sentry error tracking integration
- [ ] Grafana dashboards for all services
- [ ] Alertmanager rules (service down, disk full, error rate spike)

---

## Phase 8 — Social Monitoring Signals (Months 23–26)

- [ ] Signal-based social platform monitoring (DNS pattern analysis only — no message content)
- [ ] Late-night social media alert refinement
- [ ] New app detection (first DNS to unknown domain → alert)
- [ ] Private/incognito browser detection signals
- [ ] Discord usage alert (high-risk platform flag)
- [ ] App sideloading detection (APK domains)
- [ ] Screen sharing app detection signals

---

## Quick Start — Phase 1 (First Day)

```bash
# 1. Create project directory structure
mkdir -p /var/www/ai/FamilyShield/{shield-common,shield-eureka,shield-config,shield-gateway,shield-auth,shield-tenant}
mkdir -p /var/www/ai/FamilyShield/{config-repo,static,logs}

# 2. Create PostgreSQL database
sudo -u postgres psql -p 5454 -c "CREATE DATABASE shield_db;"
sudo -u postgres psql -p 5454 -c "CREATE USER shield WITH PASSWORD 'change-me';"
sudo -u postgres psql -p 5454 -c "GRANT ALL PRIVILEGES ON DATABASE shield_db TO shield;"

# 3. Create .env file
cp /var/www/ai/FamilyShield/doc/10-infrastructure-deployment.md /tmp/
# Copy .env section from doc to /var/www/ai/FamilyShield/.env and fill in values

# 4. Verify nginx is serving shield.rstglobal.in
curl -I https://shield.rstglobal.in
# Should return 502 (gateway not up yet) or 404 from nginx — that's expected

# 5. Start Maven multi-module build once shield-common is written
cd /var/www/ai/FamilyShield
mvn clean package -DskipTests

# 6. Start services in order
systemctl start shield-eureka
systemctl start shield-config
systemctl start shield-gateway
systemctl start shield-auth
systemctl start shield-tenant
```

---

## Development Tips

**Run single service locally (without Config Server):**
```bash
cd /var/www/ai/FamilyShield/shield-auth
mvn spring-boot:run -Dspring.profiles.active=local \
  -Dspring.datasource.url=jdbc:postgresql://localhost:5454/shield_db \
  -Dspring.datasource.username=shield \
  -Dspring.datasource.password=change-me
```

**Watch logs for all Shield services:**
```bash
journalctl -f -u "shield-*"
```

**Check which port a service is on:**
```bash
ss -tlnp | grep 828
```

**Test API Gateway is routing correctly:**
```bash
curl -X POST https://shield.rstglobal.in/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"wrong"}'
# Should return 401 from auth service (not 502)
```
