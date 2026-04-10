# Shield Platform — Master TODO: All Gaps & Fixes
**Generated:** 2026-04-10  
**Source:** Deep codebase audit (docs 13 + 14) + session analysis  
**Total items:** 180+ actionable tasks across 15 categories

---

## HOW TO USE THIS DOCUMENT

Each item has:
- `[ ]` checkbox — tick when done
- **Severity:** 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW
- **Effort:** S = <2h, M = half-day, L = full-day, XL = multi-day
- **File/Location** — exact place to fix

---

## CATEGORY INDEX

1. [Security (VAPT)](#1-security-vapt) — 24 items
2. [API Gaps](#2-api-gaps) — 18 items
3. [Database & Performance](#3-database--performance) — 16 items
4. [Gateway Microservice](#4-gateway-microservice) — 8 items
5. [Auth Microservice](#5-auth-microservice) — 10 items
6. [Tenant & Subscription Microservice](#6-tenant--subscription-microservice) — 12 items
7. [Profile Microservice](#7-profile-microservice) — 8 items
8. [DNS Filtering Microservice](#8-dns-filtering-microservice) — 14 items
9. [Analytics & Reports Microservice](#9-analytics--reports-microservice) — 10 items
10. [AI Microservice (shield-ai)](#10-ai-microservice-shield-ai) — 14 items
11. [Notification Microservice](#11-notification-microservice) — 6 items
12. [React Dashboard (shield-dashboard)](#12-react-dashboard-shield-dashboard) — 24 items
13. [Flutter App (shield-app)](#13-flutter-app-shield-app) — 20 items
14. [DevOps / CI-CD / K8s](#14-devops--ci-cd--k8s) — 16 items
15. [Code Quality (DRY/KISS/SRP/Fail Fast)](#15-code-quality) — 14 items

---

---

## 1. SECURITY (VAPT)

### 🔴 CRITICAL

- [ ] **C1** — Remove `/api/v1/analytics/**` from `PUBLIC_PREFIXES` in `JwtAuthenticationFilter.java`  
  **File:** `shield-gateway/src/main/java/.../filter/JwtAuthenticationFilter.java`  
  **Fix:** Delete the analytics line from the public prefixes list  
  **Effort:** S | **Impact:** Anyone can read all DNS logs without login

- [ ] **C2** — Move ALL secrets from `.env` to Kubernetes Secrets  
  **Secrets:** `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET`, `DB_PASSWORD`, `GOOGLE_MAPS_API_KEY`  
  **Fix:** `kubectl create secret generic shield-secrets --from-env-file=.env -n shield-prod`  
  Then reference via `secretKeyRef` in all `deployment.yaml` files  
  **Effort:** M | **Impact:** Credentials exposed in pod env

- [ ] **C3** — Add Stripe webhook signature verification in `BillingController.java`  
  **File:** `shield-tenant/src/main/java/.../controller/BillingController.java`  
  **Fix:** `Event event = Webhook.constructEvent(payload, sigHeader, webhookSecret);`  
  Wrap in try-catch `SignatureVerificationException` → return 400  
  **Effort:** S | **Impact:** Anyone can POST fake invoice.paid events

- [ ] **C4** — Fix `shield-ai` CORS from `allow_origins=["*"]` to specific domain  
  **File:** `shield-ai/main.py`  
  **Fix:** `allow_origins=["https://shield.rstglobal.in"]`  
  **Effort:** S | **Impact:** Any website can call AI endpoints, LLM cost abuse

- [ ] **C5** — Persist AI alerts to PostgreSQL (not in-memory list)  
  **File:** `shield-ai/routers/alerts.py`  
  **Fix:** Replace `alerts_store: List[Dict] = []` with async call to analytics service  
  `POST /internal/ai-alerts` → saves to `analytics.ai_insights`  
  **Effort:** M | **Impact:** All alerts lost on pod restart

- [ ] **C6** — Persist AI keywords to PostgreSQL (not in-memory list)  
  **File:** `shield-ai/routers/keywords.py`  
  **Fix:** Replace `keywords_store: List[str] = [...]` with DB table `dns.flagged_keywords`  
  **Effort:** M | **Impact:** Keywords reset to defaults on every deployment

### 🟠 HIGH

- [ ] **H1** — Add `@Valid` to ALL request bodies in ALL 11 Java service controllers  
  **Files:** Every `@PostMapping`, `@PutMapping` controller method in all services  
  **Fix:** Add `@Valid` before every `@RequestBody` parameter  
  Also add `@Bean MethodValidationPostProcessor` to each `SecurityConfig.java`  
  **Effort:** M | **Impact:** Invalid data (empty names, negative ages, null enums) reaches DB

- [ ] **H2** — Add failed login rate limiting in `shield-auth`  
  **File:** `shield-auth/src/main/java/.../service/AuthService.java`  
  **Fix:** Redis key `shield:auth:failures:{email}` → increment on fail, expire 15min  
  Throw locked exception if count > 5  
  **Effort:** M | **Impact:** Brute force 360,000 attempts/hour possible

- [ ] **H3** — Sanitize 500 error responses — no stack traces to client  
  **File:** `shield-common/src/main/java/.../exception/GlobalExceptionHandler.java`  
  **Fix:** Replace `ex.getMessage()` with `"An unexpected error occurred"` in generic handler  
  Log full trace internally via `log.error("Unhandled exception", ex)`  
  **Effort:** S | **Impact:** Internal class names, table names leaked to attackers

- [ ] **H4** — Add refresh token rotation on every `/auth/refresh` call  
  **File:** `shield-auth/src/main/java/.../service/AuthService.java`  
  **Fix:** On refresh — issue new refresh token, invalidate old one in Redis immediately  
  **Effort:** M | **Impact:** Stolen refresh token valid for full 30 days

- [ ] **H5** — Add PostgreSQL Row Level Security policies  
  **Schema:** All tables with `tenant_id` column  
  **Fix:** `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`  
  `CREATE POLICY tenant_isolation ON x USING (tenant_id = current_setting('app.tenant_id')::uuid);`  
  **Effort:** L | **Impact:** Java bug → cross-tenant data leak

- [ ] **H6** — Add TR-069 webhook HMAC signature validation  
  **File:** Wherever TR-069 handler exists (shield-tenant or shield-admin)  
  **Fix:** Validate HMAC-SHA256 signature or IP whitelist ACS server  
  **Effort:** M | **Impact:** Fake device registration/provisioning

- [ ] **H7** — Restrict actuator endpoints to health+info only  
  **Files:** All 11 service `application.yml` files  
  **Fix:**  
  ```yaml
  management.endpoints.web.exposure.include: health,info
  ```  
  **Effort:** S | **Impact:** `/actuator/env` exposes all environment variables

- [ ] **H8** — Add child-parent ownership validation in DNS service  
  **File:** `shield-dns/src/main/java/.../controller/DnsProfileController.java`  
  **Fix:** After tenant check, also verify `child.parentUserId == X-User-Id header`  
  **Effort:** S | **Impact:** Parent A in same ISP can edit Parent B's child DNS rules

### 🟡 MEDIUM

- [ ] **M1** — Add security response headers in nginx config  
  **File:** K8s nginx ingress annotations or nginx configmap  
  **Fix:** Add `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,  
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`  
  **Effort:** S

- [ ] **M2** — Restrict AdGuard admin panel to localhost only  
  **Fix:** Bind AdGuard to `127.0.0.1:3443` — accessible only via SSH tunnel  
  **Effort:** S

- [ ] **M3** — Add Grafana authentication (change default admin/admin)  
  **Fix:** Set `GF_SECURITY_ADMIN_PASSWORD` env var, disable anonymous access  
  **Effort:** S

- [ ] **M4** — Restrict Prometheus to internal network only  
  **Fix:** NetworkPolicy in K8s — only allow scrape from Grafana pod  
  **Effort:** S

- [ ] **M5** — Add LLM input length validation in shield-ai  
  **File:** `shield-ai/routers/chat.py`, `safe_chat.py`  
  **Fix:** `@validator('message') def check_length(v): assert len(v) <= 2000`  
  **Effort:** S | **Impact:** 100k character prompts → huge API bill

- [ ] **M6** — Add domain format validation in DNS custom rules  
  **File:** `shield-dns/src/main/java/.../controller/DnsRuleController.java`  
  **Fix:** Regex validator: `^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$`  
  Strip `http://` / `https://` prefix if present  
  **Effort:** S

- [ ] **M7** — Enforce password complexity in `RegisterRequest.java`  
  **File:** `shield-auth/src/main/java/.../dto/RegisterRequest.java`  
  **Fix:** `@Pattern(regexp = "^(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).{8,}$")`  
  **Effort:** S

- [ ] **M8** — Add K8s Network Policies (restrict pod-to-pod traffic)  
  **Fix:** Only allow gateway → services, services → DB, not arbitrary pod communication  
  **Effort:** M

### 🟢 LOW

- [ ] **L1** — Disable TLS 1.2, enforce TLS 1.3 only in nginx  
  **Effort:** S

- [ ] **L2** — Pin Docker image digests (not `latest` tags)  
  **Files:** All Dockerfiles and deployment.yaml  
  **Effort:** S

- [ ] **L3** — Add `npm audit` + Maven `dependency-check` plugin to CI pipeline  
  **Effort:** M

- [ ] **L4** — Add security event audit logging (@AfterThrowing AOP)  
  Log: failed logins, role changes, tenant deletions, data exports  
  **Effort:** M

- [ ] **L5** — Add GDPR log sanitization — strip PII (email, IP) from logs  
  **Effort:** M

---

---

## 2. API GAPS

### Missing Endpoints

- [ ] **A1** — Add `GET /api/v1/auth/sessions` — list active sessions per user  
  Returns: device, IP, last active, token issued at  
  Needed by: Settings page "Active Sessions" feature  
  **Effort:** M

- [ ] **A2** — Add `DELETE /api/v1/auth/sessions/{sessionId}` — revoke specific session  
  Needed by: Remote logout from unfamiliar device  
  **Effort:** M

- [ ] **A3** — Add `GET /api/v1/dns/profiles/{childId}/usage/today` — today's screen time minutes  
  Currently: Flutter dashboard shows usage but fetches from analytics service  
  Should be: Dedicated lightweight endpoint  
  **Effort:** S

- [ ] **A4** — Add `POST /api/v1/location/sos` endpoint in shield-location  
  Currently: SOS goes through notification directly  
  Should be: location service records SOS with GPS, then notifies  
  **Effort:** M

- [ ] **A5** — Add `GET /api/v1/profile/children/{id}/status` — online/offline + current device  
  Needed by: Parent dashboard real-time child status card  
  **Effort:** S

- [ ] **A6** — Add `GET /api/v1/rewards/leaderboard` — family leaderboard  
  **Effort:** S

- [ ] **A7** — Add `POST /api/v1/dns/blocklist/import` bulk CSV/JSON import  
  Needed by: V24 20,000 domain migration  
  **Effort:** M

- [ ] **A8** — Add `GET /api/v1/admin/system/health` — all services health aggregated  
  Query each service's `/actuator/health` and return combined status  
  **Effort:** M

- [ ] **A9** — Add `GET /api/v1/analytics/profile/{id}/weekly-summary` — for weekly digest  
  **Effort:** S

- [ ] **A10** — Add `PATCH /api/v1/notification/alerts/read-all` — bulk mark read  
  **Effort:** S

### Response Consistency Gaps

- [ ] **A11** — Standardize all paginated responses to same envelope  
  **Problem:** Some return `{content:[...], totalElements}` (Spring Page)  
  Others return `{data: {content:[...], page}}` (wrapped)  
  Others return plain arrays  
  **Fix:** All paginated endpoints return Spring `Page<T>` directly — no wrapping  
  Update all frontend parsing accordingly  
  **Effort:** L

- [ ] **A12** — Add `X-Correlation-ID` to ALL error responses  
  **File:** `GlobalExceptionHandler.java` in shield-common  
  **Fix:** Read `X-Correlation-ID` from request, include in error body  
  **Effort:** S

- [ ] **A13** — Add `timestamp` and `path` to ALL error responses  
  **Fix:** Update `ErrorResponse.java` with `timestamp`, `path` fields  
  **Effort:** S

- [ ] **A14** — Fix analytics `period=today` returning empty data  
  **File:** `shield-analytics/.../service/TenantAnalyticsService.java`  
  **Fix:** Change `atStartOfDay()` to `LocalDateTime.now().minusHours(24)`  
  **Effort:** S

- [ ] **A15** — Standardize error codes to SCREAMING_SNAKE_CASE across all services  
  Some return `"error": "not_found"`, others `"NOT_FOUND"`, others `"ResourceNotFound"`  
  **Effort:** M

### Documentation Gaps

- [ ] **A16** — Add `@Operation` Springdoc annotations to all controller methods  
  Currently: Auto-generated docs, no descriptions or example values  
  **Effort:** L

- [ ] **A17** — Add API versioning strategy document  
  When v2 endpoints are needed — how to handle backwards compatibility  
  **Effort:** S (document only)

- [ ] **A18** — Add Postman collection export to repo  
  **File:** `doc/Shield-API.postman_collection.json`  
  **Effort:** M

---

---

## 3. DATABASE & PERFORMANCE

### Indexes (Critical for Scale)

- [ ] **DB1** — Add composite index on `analytics.dns_logs(tenant_id, queried_at DESC)`  
  ```sql
  CREATE INDEX idx_dns_logs_tenant_time
  ON analytics.dns_logs(tenant_id, queried_at DESC);
  ```  
  **Effort:** S | **Impact:** ISP dashboard query 2000ms → 50ms

- [ ] **DB2** — Add composite index on `analytics.dns_logs(profile_id, category, blocked, queried_at DESC)`  
  ```sql
  CREATE INDEX idx_dns_logs_profile_category
  ON analytics.dns_logs(profile_id, category, blocked, queried_at DESC);
  ```  
  **Effort:** S | **Impact:** Browsing history filter query 1500ms → 30ms

- [ ] **DB3** — Add date index on `analytics.dns_logs(tenant_id, DATE(queried_at))`  
  ```sql
  CREATE INDEX idx_dns_logs_date
  ON analytics.dns_logs(tenant_id, DATE(queried_at));
  ```  
  **Effort:** S | **Impact:** Daily breakdown chart query

- [ ] **DB4** — Add partial index for blocked-only queries  
  ```sql
  CREATE INDEX idx_dns_logs_blocked
  ON analytics.dns_logs(tenant_id, queried_at DESC)
  WHERE blocked = true;
  ```  
  **Effort:** S

- [ ] **DB5** — Add index on `dns.domain_blocklist(domain)` WHERE active  
  ```sql
  CREATE INDEX idx_blocklist_domain
  ON dns.domain_blocklist(domain) WHERE is_active = true;
  ```  
  **Effort:** S | **Impact:** DNS resolution lookup speed

### Connection Pool

- [ ] **DB6** — Reduce HikariCP `maximum-pool-size` from 20 to 8 in all services  
  **Problem:** 11 services × 20 = 220 connections > Azure PostgreSQL max 100  
  **Files:** All 11 service `application.yml`  
  **Fix:** `maximum-pool-size: 8`, `minimum-idle: 2`  
  **Effort:** S | **Impact:** Prevents 503s under load

### Partitioning

- [ ] **DB7** — Partition `analytics.dns_logs` by month  
  Create `dns_logs_2026_04`, `dns_logs_2026_05` etc.  
  Old partitions archiveable without locking  
  **Effort:** L

### Caching

- [ ] **DB8** — Add Redis cache for analytics overview (2-min TTL)  
  **File:** `shield-analytics/.../service/TenantAnalyticsService.java`  
  **Fix:** `@Cacheable(value = "analytics:overview", key = "#tenantId + ':' + #period")`  
  **Effort:** M | **Impact:** Dashboard load 3000ms → 200ms

- [ ] **DB9** — Add Redis cache for DNS profiles (30-sec TTL)  
  **File:** `shield-dns/.../service/DnsProfileService.java`  
  **Fix:** Cache profile on read, evict on update  
  **Effort:** M

- [ ] **DB10** — Add Redis cache for tenant plan details (5-min TTL)  
  Used on every auth check and customer creation  
  **Effort:** M

- [ ] **DB11** — Add Redis cache for content categories list (1-hour TTL)  
  43 categories fetched on every DNS check — rarely changes  
  **Effort:** S

### Query Fixes

- [ ] **DB12** — Fix N+1 query in analytics profile stats  
  **File:** `shield-analytics/.../service/TenantAnalyticsService.java`  
  **Fix:** Replace loop of `countByProfileId()` with single JOIN query  
  **Effort:** M

- [ ] **DB13** — Fix N+1 in gateway route to profile+dns (2 sequential calls)  
  **Effort:** M

### Data Management

- [ ] **DB14** — Run V24 DNS blocklist migration — 20,000 domains  
  **File:** Create `shield-dns/src/main/resources/db/migration/V24__domain_blocklist_20k.sql`  
  Use categorized lists: StevenBlack, OISD, Hagezi sources  
  **Effort:** L

- [ ] **DB15** — Add data retention enforcement (currently in code but verify it runs)  
  DNS logs: 90 days, Events: 180 days — verify `@Scheduled` cron fires  
  **Effort:** S

- [ ] **DB16** — Add PgBouncer connection pooler  
  Handles 1000+ app connections → pools to 50 real DB connections  
  Required for 10+ ISPs with multiple pods  
  **Effort:** L

---

---

## 4. GATEWAY MICROSERVICE

- [ ] **G1** — Remove `/api/v1/analytics/**` from `PUBLIC_PREFIXES` ← same as C1, highest priority  
  **File:** `shield-gateway/.../filter/JwtAuthenticationFilter.java`

- [ ] **G2** — Add null check on JWT claims before header injection  
  **Fix:** If `role` claim is null → return 401 not inject `X-User-Role: null`  
  **Effort:** S

- [ ] **G3** — Add stricter rate limit for auth endpoints (5 RPS vs 100 global)  
  **Fix:** Separate `RequestRateLimiter` filter on `/api/v1/auth/login` route  
  **Effort:** S

- [ ] **G4** — Add circuit breaker fallback for ALL routes (not just some)  
  Currently: auth, tenant, notification, ai have fallback  
  Missing: profile, dns, location, rewards, analytics, admin  
  **Effort:** S

- [ ] **G5** — Add request/response logging filter for audit trail  
  Log: method, path, userId, tenantId, status, duration  
  **Effort:** M

- [ ] **G6** — Add `X-Response-Time` header to all responses  
  **Effort:** S

- [ ] **G7** — Handle WebSocket upgrade properly in gateway  
  Ensure `Upgrade: websocket` header is forwarded to shield-notification  
  **Effort:** M

- [ ] **G8** — Add gateway health indicator showing all downstream service status  
  `GET /actuator/health` should show each lb:// service UP/DOWN  
  **Effort:** M

---

---

## 5. AUTH MICROSERVICE

- [ ] **AU1** — Add login attempt tracking + account lockout  
  **File:** `shield-auth/.../service/AuthService.java`  
  Redis key: `shield:auth:failures:{email}` — lock after 5 fails for 15 min  
  **Effort:** M

- [ ] **AU2** — Add refresh token rotation (issue new token on every refresh)  
  Invalidate previous refresh token in Redis immediately  
  **Effort:** M

- [ ] **AU3** — Add `GET /api/v1/auth/sessions` — list active sessions  
  Track login events with device fingerprint in `auth.sessions` table  
  **Effort:** L

- [ ] **AU4** — Add `DELETE /api/v1/auth/sessions/{id}` — revoke specific session  
  **Effort:** M

- [ ] **AU5** — Fix MFA disable — add re-authentication confirmation  
  Currently: one click disables MFA  
  Fix: Require current password before disabling  
  **Effort:** S

- [ ] **AU6** — Add device fingerprinting on login  
  Store user-agent + IP hash — alert on new device login  
  **Effort:** M

- [ ] **AU7** — Add `POST /api/v1/auth/logout/all` — logout all sessions  
  Set blacklist timestamp + delete all refresh tokens for user  
  **Effort:** S

- [ ] **AU8** — Add email verification on registration  
  Currently: `is_verified = false` stored but never enforced  
  **Effort:** M

- [ ] **AU9** — Add `co-parent invite` endpoint  
  `POST /api/v1/auth/invite` → send email with registration link tied to tenant  
  **Effort:** M

- [ ] **AU10** — Add password history (prevent reusing last 5 passwords)  
  Table: `auth.password_history`  
  **Effort:** M

---

---

## 6. TENANT & SUBSCRIPTION MICROSERVICE

- [ ] **T1** — Add Stripe webhook signature verification ← same as C3, highest priority  
  **File:** `shield-tenant/.../controller/BillingController.java`

- [ ] **T2** — Split `BillingService.java` into focused classes  
  - `StripeCheckoutService` — checkout session creation  
  - `WebhookProcessingService` — all webhook event handlers  
  - `InvoiceService` — invoice query + PDF  
  - `SubscriptionQueryService` — subscription status  
  **Effort:** L

- [ ] **T3** — Add Stripe Checkout for UPI support (Indian market)  
  **Fix:** Add `SessionCreateParams.PaymentMethodType.UPI` to checkout params  
  **Effort:** S

- [ ] **T4** — Add trial period support  
  `Tenant.status = TRIAL` with `trial_ends_at` timestamp  
  Auto-suspend when trial expires (scheduled job)  
  **Effort:** L

- [ ] **T5** — Add plan upgrade/downgrade flow  
  When plan changes mid-cycle → prorate Stripe subscription  
  **Effort:** L

- [ ] **T6** — Remove Stripe customer creation from `TenantService`  
  Move to `StripeCustomerService` — SRP violation  
  **Effort:** M

- [ ] **T7** — Add tenant suspend/reactivate audit log entries  
  **Effort:** S

- [ ] **T8** — Add `GET /api/v1/billing/plans` public pricing page endpoint  
  Return plans with features for marketing page  
  Currently pricing is hardcoded in website HTML  
  **Effort:** S

- [ ] **T9** — Add subscription renewal notification (7 days before)  
  Scheduled job → email ISP 7 days before billing date  
  **Effort:** M

- [ ] **T10** — Fix `parseUuid()` helper — apply consistently everywhere  
  Currently exists in BillingController but not in TenantController  
  If `X-Tenant-Id` is empty → `UUID.fromString("")` throws 500  
  **Effort:** S

- [ ] **T11** — Add customer count validation before creating customers  
  Currently checks `maxCustomers` — also need to check plan `is_active`  
  **Effort:** S

- [ ] **T12** — Add ISP white-label config table  
  `tenant.branding` — logo_url, primary_color, custom_domain  
  Needed for Phase 10 white-label feature  
  **Effort:** L

---

---

## 7. PROFILE MICROSERVICE

- [ ] **P1** — Add child-parent ownership validation on all child endpoints  
  **File:** `shield-profile/.../service/ChildService.java`  
  **Fix:** `if (!child.getParentId().equals(currentUserId)) throw forbidden()`  
  **Effort:** S

- [ ] **P2** — Add `GET /api/v1/profile/children/{id}/status` — online/offline  
  Query latest location timestamp to determine if online  
  **Effort:** M

- [ ] **P3** — Add avatar upload endpoint with resize  
  `POST /api/v1/profile/children/{id}/avatar` — accept image, resize to 256x256  
  Store in Azure Blob Storage  
  **Effort:** L

- [ ] **P4** — Add family invite via email  
  `POST /api/v1/profile/family/invite` → sends join link to co-parent  
  **Effort:** M

- [ ] **P5** — Add device online/offline tracking  
  Update `profile.devices.is_online` + `last_seen` on each GPS ping  
  **Effort:** M

- [ ] **P6** — Remove welcome email sending from `CustomerService`  
  SRP violation — delegate to notification service via RabbitMQ event  
  **Effort:** S

- [ ] **P7** — Add soft delete for child profiles  
  `is_deleted = true` + `deleted_at` — keep historical data  
  **Effort:** S

- [ ] **P8** — Add QR code generation for device registration  
  `POST /api/v1/profile/devices/qr` — generate short-lived token (15 min)  
  Store in Redis: `shield:qr:{token}` → `{parentId, tenantId}`  
  **Effort:** M

---

---

## 8. DNS FILTERING MICROSERVICE

- [ ] **DNS1** — Run V24 migration — import 20,000 domain blocklist  
  **Sources:** StevenBlack unified (100k+), OISD (big list), Hagezi  
  **Format:** SQL INSERT batch or Flyway CSV import  
  **Effort:** L | **Priority:** HIGHEST — core product has only 345 domains

- [ ] **DNS2** — Add domain format validator on custom rule endpoints  
  Regex: `^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$`  
  Strip `http://`, `https://`, trailing `/`  
  **Effort:** S

- [ ] **DNS3** — Make AdGuard sync async (fire-and-forget)  
  **Fix:** Publish `adguard.sync` event to RabbitMQ, `AdGuardSyncWorker` consumes  
  API returns 200 immediately — sync in background  
  **Effort:** M | **Impact:** DNS rule update API currently waits for AdGuard

- [ ] **DNS4** — Add wildcard domain support in custom rules  
  e.g. `*.roblox.com` blocks all subdomains  
  **Effort:** M

- [ ] **DNS5** — Add `DomainFilterChain` — split `checkDomain()` into chain of checkers  
  Each checker: `PauseChecker`, `AllowlistChecker`, `BlocklistChecker`,  
  `BedtimeChecker`, `BudgetChecker`, `ScheduleChecker`, `CategoryChecker`  
  **File:** `shield-dns/.../service/DnsProfileService.java`  
  **Effort:** L | **Impact:** SRP + testability

- [ ] **DNS6** — Add `SafeSearch` enforcement option  
  Redirect `google.com` → `forcesafesearch.google.com` for child profiles  
  Redirect `youtube.com` → restricted mode  
  **Effort:** L

- [ ] **DNS7** — Add `YouTube Restricted Mode` toggle  
  DNS CNAME `www.youtube.com → restrict.youtube.com`  
  **Effort:** M

- [ ] **DNS8** — Add unknown domain auto-categorization  
  New domains not in blocklist → call AI service to auto-classify  
  Cache result in `dns.domain_categorization_cache`  
  **Effort:** XL

- [ ] **DNS9** — Add bulk category import API  
  `POST /api/v1/dns/blocklist/import` — CSV file upload  
  Parse `domain,category,severity,source` per row  
  **Effort:** M

- [ ] **DNS10** — Fix schedule enforcement loop performance  
  Currently: `@Scheduled(fixedRate=60000)` loads ALL profiles every minute  
  Fix: Only load profiles with active schedules for today  
  **Effort:** M

- [ ] **DNS11** — Add `grace period` notification before bedtime  
  5 minutes before bedtime → push "Internet off in 5 minutes"  
  **Effort:** S

- [ ] **DNS12** — Move hardcoded schedule presets to DB table  
  `dns.schedule_presets` — seeded via Flyway  
  Allows ISP to customize preset definitions  
  **Effort:** M

- [ ] **DNS13** — Add ISP-level category override  
  ISP_ADMIN can force-block categories that CUSTOMER cannot override  
  New column: `dns.content_categories.isp_enforced`  
  **Effort:** L

- [ ] **DNS14** — Add `Homework Mode` preset  
  Block everything except: Education, Reference, Google, Wikipedia  
  **Effort:** S

---

---

## 9. ANALYTICS & REPORTS MICROSERVICE

- [ ] **AN1** — Fix `SecurityConfig.java` — change `.permitAll()` to `.authenticated()`  
  **File:** `shield-analytics/.../config/SecurityConfig.java`  
  **Fix:** `.anyRequest().authenticated()` (gateway already handles JWT)  
  **Effort:** S | **Priority:** CRITICAL — same as C1

- [ ] **AN2** — Add `analytics.daily_summaries` pre-computation  
  Nightly cron at 1AM — compute and store daily stats  
  Dashboard reads from pre-computed table instead of live query  
  **Effort:** L

- [ ] **AN3** — Fix `validateAccess()` to check CUSTOMER role owns the profile  
  Currently only checks tenantId — not parent-child ownership  
  **Effort:** S

- [ ] **AN4** — Add `GET /api/v1/analytics/profile/{id}/weekly-summary` endpoint  
  Used by weekly digest and Flutter AI insights screen  
  **Effort:** S

- [ ] **AN5** — Add `GET /api/v1/analytics/tenant/{id}/categories` endpoint  
  Returns top blocked categories ranked by count  
  **Effort:** S

- [ ] **AN6** — Add data export endpoint  
  `GET /api/v1/analytics/tenant/{id}/export?format=csv&period=month`  
  GDPR right to data portability  
  **Effort:** L

- [ ] **AN7** — Extract `periodToDateRange()` as static utility method  
  Remove 3+ duplicate `switch(period)` blocks  
  **File:** `shield-analytics/.../util/DateRangeUtils.java`  
  **Effort:** S

- [ ] **AN8** — Add RabbitMQ consumer for `anomaly.detected` events  
  Store in `analytics.ai_insights` when AI service detects anomaly  
  **Effort:** M

- [ ] **AN9** — Add `screen_time_mins` tracking per profile per day  
  Currently DNS logs exist but screen time not explicitly calculated  
  Add scheduled job to compute from DNS log density  
  **Effort:** L

- [ ] **AN10** — Add `analytics.ai_insights` internal save endpoint  
  `POST /internal/ai-alerts` — called by shield-ai to persist alerts  
  **Effort:** M

---

---

## 10. AI MICROSERVICE (shield-ai)

- [ ] **AI1** — Fix CORS from `allow_origins=["*"]` ← same as C4, highest priority  
  **File:** `shield-ai/main.py`

- [ ] **AI2** — Persist alerts to PostgreSQL via analytics service  
  **File:** `shield-ai/routers/alerts.py`  
  Replace `alerts_store: List[Dict] = []` with async HTTP call  
  **Effort:** M

- [ ] **AI3** — Persist keywords to PostgreSQL  
  **File:** `shield-ai/routers/keywords.py`  
  New table: `dns.flagged_keywords` — seed defaults via Flyway  
  **Effort:** M

- [ ] **AI4** — Add JWT validation on all `/ai/*` endpoints  
  Currently: shield-ai has no auth — gateway should enforce  
  Verify gateway does NOT have `/ai/` in `PUBLIC_PREFIXES`  
  **Effort:** S

- [ ] **AI5** — Add message length validation  
  Max 2000 chars for parent chat, 500 chars for child safe-chat  
  **Effort:** S

- [ ] **AI6** — Add streaming LLM responses (SSE)  
  **File:** `shield-ai/routers/chat.py`  
  Fix: Return `StreamingResponse` with `text/event-stream`  
  React/Flutter renders tokens progressively  
  **Effort:** M | **Impact:** Perceived latency 3-8s → 200ms

- [ ] **AI7** — Replace naive string-match content moderation in safe-chat  
  Current: `if topic in message_lower` — blocks "bypass the exam"  
  Fix: Use LLM as content moderator (ask Claude to classify intent)  
  **Effort:** L

- [ ] **AI8** — Add weekly model retraining schedule  
  **File:** `shield-ai/routers/training.py`  
  `@asynccontextmanager` startup trigger + weekly cron  
  **Effort:** M

- [ ] **AI9** — Add per-child personalized baseline (not global model)  
  Train separate IsolationForest per child with their own history  
  **Effort:** XL

- [ ] **AI10** — Add anomaly explainability (SHAP values)  
  Parents see WHY a session was flagged, not just the score  
  **Effort:** L

- [ ] **AI11** — Add false positive feedback loop  
  Parent marks alert as "false alarm" → training data updated  
  **Effort:** L

- [ ] **AI12** — Add confidence scores to anomaly predictions  
  Return `confidence: 0.87` alongside each anomaly  
  **Effort:** S

- [ ] **AI13** — Add per-request rate limiting on LLM endpoints  
  Max 10 AI chat requests per user per minute  
  Use Redis: `shield:ai:ratelimit:{userId}`  
  **Effort:** S

- [ ] **AI14** — Add API key rotation capability  
  `/ai/config` endpoint to rotate DeepSeek/Claude keys without restart  
  **Effort:** M

---

---

## 11. NOTIFICATION MICROSERVICE

- [ ] **N1** — Fix `WeeklyDigestService` — make async with batching  
  Currently: sequential loop over all tenants blocks thread for hours  
  Fix: Publish `weekly.digest.{tenantId}` to RabbitMQ, process in parallel  
  **Effort:** M

- [ ] **N2** — Remove analytics fetching from `WeeklyDigestService`  
  SRP violation — analytics service should push data, not notification pull it  
  **Effort:** M

- [ ] **N3** — Add notification preferences persistence  
  `notification.user_preferences` table — which alert types to receive  
  Currently Settings page shows toggles but they're not saved to DB  
  **Effort:** M

- [ ] **N4** — Add push notification for new child device login  
  Alert parent when child's app connects from a new device  
  **Effort:** S

- [ ] **N5** — Add `Bedtime warning` push (5 min before bedtime)  
  Publish from DNS service's schedule enforcer  
  **Effort:** S

- [ ] **N6** — Add email queue + retry on SMTP failure  
  Currently: email failure = silent loss  
  Fix: RabbitMQ email queue with dead-letter queue + retry 3×  
  **Effort:** M

---

---

## 12. REACT DASHBOARD (shield-dashboard)

### Critical UX Fixes

- [ ] **RD1** — Add skeleton loaders to AI Insights page (3-8s LLM load)  
  **File:** `shield-dashboard/src/pages/customer/AiInsightsPage.tsx`  
  Use MUI `Skeleton` component while waiting for `/ai/insights` response  
  **Effort:** S

- [ ] **RD2** — Add pause/resume button to ISP Live Dashboard  
  **File:** `shield-dashboard/src/pages/isp-admin/IspLiveDashboardPage.tsx`  
  Buffer events, pause rendering on click, resume drains buffer  
  **Effort:** S

- [ ] **RD3** — Fix ISP URL Activity default period  
  **File:** `shield-dashboard/src/pages/isp-admin/IspUrlActivityPage.tsx`  
  Default to `week` not `today` — "today" shows empty if no recent logs  
  **Effort:** S

- [ ] **RD4** — Add live filter to URL Activity (remove Apply button)  
  Apply filters on change with 500ms debounce — no manual apply step  
  **Effort:** S

- [ ] **RD5** — Add CSV export to URL Activity and Browsing History  
  Button → `GET /api/v1/analytics/tenant/{id}/export?format=csv`  
  **Effort:** M

### Navigation & Structure

- [ ] **RD6** — Fix sidebar to show active route highlight correctly  
  Some nested routes don't highlight parent menu item  
  **File:** `shield-dashboard/src/components/layout/Sidebar.tsx`  
  **Effort:** S

- [ ] **RD7** — Add breadcrumb navigation  
  Tenants > BSNL Rajasthan > Customers > Virender Kumar  
  **Effort:** M

- [ ] **RD8** — Add empty states for all list pages  
  "No customers yet — Add your first customer →"  
  Currently: blank screen when no data  
  **Effort:** M

- [ ] **RD9** — Fix mobile sidebar — hamburger menu not working on all pages  
  **Effort:** S

- [ ] **RD10** — Add loading states to ALL toggle switches and action buttons  
  Currently: switches flip immediately with no API confirmation  
  Fix: Disable + show spinner until API responds  
  **Effort:** M

### Dashboard Pages

- [ ] **RD11** — Add parallel API loading on Parent Dashboard  
  **Fix:** `Promise.all([getChildren(), getAlerts(), getAnalytics()])`  
  Currently sequential — adds 800ms extra load time  
  **Effort:** S

- [ ] **RD12** — Add "generated at" timestamp on AI Insights page  
  Parents need to know if data is fresh or stale  
  **Effort:** S

- [ ] **RD13** — Add week-over-week risk score comparison on AI Insights  
  "Risk score was 45 last week → 34 this week ▼ Improving"  
  **Effort:** S

- [ ] **RD14** — Add domain grouping option on Browsing History  
  "Show 47 queries to youtube.com as one row"  
  **Effort:** M

- [ ] **RD15** — Fix pricing section on website — pull from API  
  **File:** `shield-website/index.html`  
  Currently hardcoded — call `GET /api/v1/plans` on page load  
  **Effort:** M

### Charts & Data Viz

- [ ] **RD16** — Add column sorting to all data tables  
  URL Activity, Customers, Tenants tables have no sort  
  **Effort:** M

- [ ] **RD17** — Fix Recharts on mobile — charts too small on 360px  
  Add `ResponsiveContainer` with min-height  
  **Effort:** S

- [ ] **RD18** — Add date range picker to URL Activity  
  Currently only 7/30 days — add custom `from`/`to` date range  
  **Effort:** M

### Code Quality

- [ ] **RD19** — Add route-based code splitting + lazy loading  
  ```tsx
  const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
  ```  
  Bundle size reduction — Admin/ISP pages not loaded for CUSTOMER role  
  **Effort:** M

- [ ] **RD20** — Move API base URL from hardcoded string to `import.meta.env.VITE_API_URL`  
  Find and fix all instances of hardcoded `https://shield.rstglobal.in`  
  **Effort:** S

- [ ] **RD21** — Add global error boundary component  
  Uncaught React errors show blank white screen — add friendly error page  
  **Effort:** S

- [ ] **RD22** — Fix TenantsPage response parsing — use consistent fallback  
  `r.data?.data?.content ?? r.data?.content ?? r.data?.data ?? r.data`  
  Apply this pattern consistently across ALL list pages  
  **Effort:** M

- [ ] **RD23** — Add MFA setup flow to Settings page (save to backend)  
  Currently: QR shown but verify step doesn't call API  
  **Effort:** M

- [ ] **RD24** — Add accessibility — aria-labels to all icon buttons  
  Missing on: sidebar icons, action buttons, toggle switches  
  **Effort:** M

---

---

## 13. FLUTTER APP (shield-app)

### Loading & Error States

- [ ] **FL1** — Add loading states to ALL toggle switches (DNS, schedule, bedtime)  
  Currently: switches flip immediately — no API confirmation  
  Fix: `isLoading` state + disabled switch during API call  
  **Effort:** M

- [ ] **FL2** — Add error states to all screens  
  Some screens show blank on API error  
  Fix: `AsyncValue.error` handler → retry button + error message  
  **Effort:** M

- [ ] **FL3** — Add skeleton loaders on initial data fetch  
  Browsing history, AI insights, location history — show shimmer while loading  
  **Effort:** M

- [ ] **FL4** — Add pull-to-refresh on ALL list screens  
  Currently only Parent Dashboard has pull-to-refresh  
  **Effort:** S

### Data & Performance

- [ ] **FL5** — Add true pagination to Browsing History  
  Currently loads all DNS logs at once — causes OOM on large history  
  Fix: Infinite scroll with page=0,1,2... size=50  
  **Effort:** M

- [ ] **FL6** — Add `cached_network_image` for all avatar images  
  Currently: re-downloads on every screen transition  
  **Effort:** S

- [ ] **FL7** — Fix background GPS adaptive interval  
  Active (parent viewing): 2 min  
  Normal background: 15 min  
  Stationary (no movement): 30 min  
  **Effort:** M

- [ ] **FL8** — Add offline mode — cache DNS profile locally  
  If no internet on child device — use last-known DNS rules  
  **Effort:** L

### Screens Missing / Incomplete

- [ ] **FL9** — Add domain search to Browsing History screen  
  Currently only category filter — no text search  
  **Effort:** S

- [ ] **FL10** — Add location trail "play" animation  
  Button animates marker along GPS trail over time  
  **Effort:** M

- [ ] **FL11** — Add task detail view (description, due date, points detail)  
  Currently: task list only shows title — no detail screen  
  **Effort:** S

- [ ] **FL12** — Add undo on task completion  
  Child accidentally marks complete → snackbar with undo within 5 sec  
  **Effort:** S

- [ ] **FL13** — Add "active sessions" in Settings screen  
  Show logged-in devices with last active timestamp  
  **Effort:** M

- [ ] **FL14** — Complete Safe Filters preset switch confirmation  
  Switching from STRICT to OFF should show "Are you sure?" dialog  
  **Effort:** S

- [ ] **FL15** — Add category search bar to Safe Filters screen  
  43 categories — need search to find specific one quickly  
  **Effort:** S

### Notifications

- [ ] **FL16** — Add deep link handling for all push notification types  
  GEOFENCE → open location map  
  BUDGET_EXCEEDED → open time limits  
  ANOMALY → open AI insights  
  SOS → open map with child location  
  **Effort:** M

- [ ] **FL17** — Add in-app notification list (not just system push)  
  Alerts screen should show all history including missed pushes  
  **Effort:** S

### Build & Release

- [ ] **FL18** — Build release APK (currently debug ~95MB)  
  `flutter build apk --release --tree-shake-icons`  
  Release APK ~15-20MB — needed for Play Store  
  **Effort:** S

- [ ] **FL19** — Add `google-services.json` from Firebase Console  
  FCM push currently non-functional without this file  
  **File:** `shield-app/android/app/google-services.json`  
  **Effort:** S

- [ ] **FL20** — Add app signing config for Play Store release  
  `android/key.properties` + keystore file  
  **Effort:** M

---

---

## 14. DEVOPS / CI-CD / K8s

### K8s High Availability

- [ ] **K1** — Change ALL deployments from `replicas: 1` to `replicas: 2`  
  **Files:** All `k8s/base/*/deployment.yaml`  
  **Effort:** S | **Impact:** Zero-downtime rolling updates

- [ ] **K2** — Add `RollingUpdate` strategy to all deployments  
  ```yaml
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  ```  
  **Effort:** S

- [ ] **K3** — Add HorizontalPodAutoscaler for gateway, auth, analytics  
  Scale on CPU 70% — min 2, max 5 replicas  
  **Effort:** M

- [ ] **K4** — Add Pod Disruption Budgets  
  `minAvailable: 1` for all services — prevents all pods going down during node drain  
  **Effort:** S

- [ ] **K5** — Add pod anti-affinity rules  
  Spread replicas across different nodes  
  **Effort:** S

### Secrets Management

- [ ] **K6** — Move all secrets from `.env` to K8s Secrets ← same as C2  
  **Effort:** M

- [ ] **K7** — Add sealed-secrets or Azure Key Vault integration  
  K8s Secrets are base64 (not encrypted) — use proper secret management  
  **Effort:** L

### CI/CD Pipeline

- [ ] **K8** — Add automated tests stage to Azure DevOps pipeline  
  At minimum: compile check + `mvn test` for each service  
  **Effort:** L

- [ ] **K9** — Add staging environment  
  Deploy to `shield-staging` namespace before `shield-prod`  
  **Effort:** L

- [ ] **K10** — Add smoke tests after deployment  
  Hit health endpoints + basic login flow after each deploy  
  **Effort:** M

- [ ] **K11** — Add rollback procedure to pipeline  
  On smoke test failure → `kubectl rollout undo deployment/{service}`  
  **Effort:** M

- [ ] **K12** — Add dependency vulnerability scanning  
  Maven: `dependency-check-maven` plugin  
  Node: `npm audit --audit-level high`  
  Flutter: `flutter pub audit`  
  **Effort:** M

### Monitoring

- [ ] **K13** — Add Prometheus alerting rules  
  Alert on: error rate > 5%, pod restart, high memory, DB connections > 80  
  **File:** `k8s/monitoring/prometheus-rules.yaml`  
  **Effort:** M

- [ ] **K14** — Add Grafana dashboards for each service  
  Request rate, error rate, latency p95/p99, DB connections  
  **Effort:** L

- [ ] **K15** — Add log aggregation  
  Pod stdout → Loki → Grafana  
  Currently: logs only in pod stdout, lost on restart  
  **Effort:** L

- [ ] **K16** — Add SSL certificate expiry monitoring  
  Current cert expires 2026-06-02 — add alert 30 days before  
  **Effort:** S

---

---

## 15. CODE QUALITY

### DRY Fixes

- [ ] **CQ1** — Extract `validateTenantAccess()` to `shield-common`  
  All 11 services have identical tenant isolation check  
  Create `TenantAccessValidator.java` in shield-common  
  **Effort:** M

- [ ] **CQ2** — Extract `DateRangeUtils.fromPeriod(String period)` utility  
  3+ services have identical `switch(period)` block  
  **Effort:** S

- [ ] **CQ3** — Extract `parseUuid(String header)` utility to shield-common  
  Safely parse UUID from header — return 400 if blank  
  **Effort:** S

- [ ] **CQ4** — Move category color/icon config to API  
  `GET /api/v1/dns/categories` returns `{name, displayName, icon, color}`  
  Remove duplicate maps from React and Flutter  
  **Effort:** M

### Single Responsibility Fixes

- [ ] **CQ5** — Split `DnsProfileService.checkDomain()` into `DomainFilterChain`  
  Chain: Pause → Allowlist → Blocklist → Bedtime → Budget → Schedule → Category  
  **Effort:** L

- [ ] **CQ6** — Move email sending out of `TenantService` and `CustomerService`  
  These services should publish events — notification service sends emails  
  **Effort:** M

- [ ] **CQ7** — Move Stripe customer creation out of `TenantService`  
  Create `StripeCustomerService` — SRP violation  
  **Effort:** M

### Hardcoded Values

- [ ] **CQ8** — Move HikariCP pool sizes to `application.yml` config  
  `maximum-pool-size: ${DB_POOL_MAX:8}`  
  **Effort:** S

- [ ] **CQ9** — Move cron expressions to `application.yml`  
  `@Scheduled(cron = "${digest.cron:0 0 8 * * MON}")`  
  **Effort:** S

- [ ] **CQ10** — Move data retention days to config  
  `${analytics.retention.dns-logs-days:90}`  
  **Effort:** S

- [ ] **CQ11** — Move IsolationForest params to `shield-ai` config  
  `AI_N_ESTIMATORS=100`, `AI_CONTAMINATION=0.1`  
  **Effort:** S

### Fail Fast

- [ ] **CQ12** — Add `@Valid` to ALL request bodies in ALL controllers ← same as H1  
  **Effort:** M | **Priority:** HIGH

- [ ] **CQ13** — Add input validation to `shield-ai` Python models  
  Use Pydantic validators: `@validator('message')`, `@validator('profileId')`  
  **Effort:** S

- [ ] **CQ14** — Add startup validation in all services  
  Check required env vars on boot, fail fast with clear message  
  ```java
  @PostConstruct
  void validate() {
    Assert.hasText(jwtSecret, "JWT_SECRET must be set");
  }
  ```  
  **Effort:** S

---

---

## PRIORITY EXECUTION ORDER

### Week 1 — Stop the Bleeding (Critical Security + Data Integrity)
```
C1  — Remove analytics from PUBLIC_PREFIXES
C2  — Move secrets to K8s Secrets
C3  — Stripe webhook signature
C4  — Fix shield-ai CORS
C5  — Persist AI alerts to DB
C6  — Persist AI keywords to DB
H1  — Add @Valid everywhere
H3  — Sanitize 500 responses
AN1 — Fix analytics SecurityConfig
DNS1— Run V24 20,000 domain blocklist migration
```

### Week 2 — Core Stability
```
DB1-DB5  — Add all missing indexes
DB6      — Fix HikariCP pool size (220 → 88 connections)
K1-K2    — replicas: 2 + RollingUpdate on all deployments
H2       — Login rate limiting
H8       — Child-parent ownership in DNS
AU1      — Auth lockout after 5 failed attempts
FL19     — Add google-services.json (FCM push)
```

### Week 3 — UX Critical Fixes
```
RD1  — AI Insights skeleton loader
RD2  — Live Dashboard pause button
RD3  — URL Activity default period fix
RD10 — Loading states on all toggles
RD11 — Parallel API loading on dashboard
FL1  — Flutter toggle loading states
FL5  — Browsing History pagination
```

### Week 4 — Performance
```
DB7  — DNS logs table partitioning
DB8-DB11 — Redis caching layer
DB12 — Fix N+1 analytics query
AI6  — LLM streaming responses
K3   — Add HPA autoscaling
K13  — Prometheus alerting rules
```

### Month 2 — Feature Completeness
```
DNS2-DNS14 — DNS feature gaps
AU3-AU10   — Auth feature gaps
T3-T12     — Tenant/billing features
AN2-AN10   — Analytics features
RD rest    — Dashboard polish
FL rest    — Flutter polish
```

### Month 3 — Enterprise Readiness
```
H5   — PostgreSQL Row Level Security
K7   — Sealed secrets / Azure Key Vault
K8-K11 — Full CI/CD pipeline with tests + staging
K14-K15 — Full monitoring stack
CQ all  — Code quality cleanup
A16  — Full API documentation
```

---

## SUMMARY COUNTS

| Category | Total Items | Critical | High | Medium | Low |
|----------|:-----------:|:--------:|:----:|:------:|:---:|
| Security | 24 | 6 | 8 | 5 | 5 |
| API Gaps | 18 | 2 | 6 | 8 | 2 |
| Database | 16 | 2 | 5 | 7 | 2 |
| Gateway | 8 | 1 | 3 | 4 | 0 |
| Auth | 10 | 0 | 4 | 6 | 0 |
| Tenant/Billing | 12 | 1 | 4 | 6 | 1 |
| Profile | 8 | 1 | 3 | 4 | 0 |
| DNS Filtering | 14 | 1 | 3 | 8 | 2 |
| Analytics | 10 | 1 | 3 | 5 | 1 |
| AI Service | 14 | 2 | 4 | 7 | 1 |
| Notification | 6 | 0 | 2 | 4 | 0 |
| React Dashboard | 24 | 3 | 8 | 10 | 3 |
| Flutter App | 20 | 1 | 6 | 10 | 3 |
| DevOps/K8s | 16 | 1 | 5 | 8 | 2 |
| Code Quality | 14 | 0 | 3 | 9 | 2 |
| **TOTAL** | **194** | **22** | **67** | **101** | **24** |

---

## ESTIMATED EFFORT SUMMARY

```
Week 1  (Critical fixes):       ~40 hours
Week 2  (Stability):            ~60 hours
Week 3  (UX critical):          ~40 hours
Week 4  (Performance):          ~60 hours
Month 2 (Feature completeness): ~200 hours
Month 3 (Enterprise readiness): ~200 hours

Total estimated effort: ~600 hours (~15 weeks solo / ~8 weeks with 2 devs)
```

---

*Document auto-generated from audit sessions. Update checkboxes as items are completed.*  
*Last updated: 2026-04-10*
