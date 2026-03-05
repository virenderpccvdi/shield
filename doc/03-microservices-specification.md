# 03 — Microservices Specification

## Maven Multi-Module Parent POM Structure

```xml
<!-- /var/www/ai/Shield/pom.xml -->
<groupId>com.shield</groupId>
<artifactId>shield-platform</artifactId>
<version>1.0.0-SNAPSHOT</version>
<packaging>pom</packaging>

<modules>
  <module>shield-common</module>
  <module>shield-eureka</module>
  <module>shield-config</module>
  <module>shield-gateway</module>
  <module>shield-auth</module>
  <module>shield-tenant</module>
  <module>shield-profile</module>
  <module>shield-dns</module>
  <module>shield-location</module>
  <module>shield-notification</module>
  <module>shield-rewards</module>
  <module>shield-analytics</module>
  <module>shield-admin</module>
</modules>

<properties>
  <java.version>21</java.version>
  <spring-boot.version>4.0.3</spring-boot.version>
  <spring-cloud.version>2025.1.1</spring-cloud.version>
  <jjwt.version>0.13.0</jjwt.version>
  <mapstruct.version>1.6.3</mapstruct.version>
  <lombok.version>1.18.36</lombok.version>
  <springdoc.version>3.0.2</springdoc.version>
  <!-- Observability (same as SmartTrack pattern) -->
  <micrometer.version>1.14.2</micrometer.version>
  <logstash-encoder.version>8.0</logstash-encoder.version>
</properties>

<!-- Key dependencies (all business services) -->
<!-- MapStruct: entity ↔ DTO mapping (preferred over manual mapping) -->
<!-- Resilience4j: circuit breakers for service-to-service HTTP calls -->
<!-- Logstash JSON encoder: structured logging for ELK/Loki -->
<!-- Micrometer + Zipkin: distributed tracing (X-Correlation-ID propagation) -->
```

---

## 1. shield-common

**Purpose:** Shared library used by all other services. Contains DTOs, exceptions, security utilities, base entities, and constants.

**Contents:**
```
src/main/java/com/shield/common/
├── dto/
│   ├── ApiResponse.java          — standard wrapper: {success, data, message, timestamp}
│   ├── PagedResponse.java        — pagination wrapper
│   ├── ErrorResponse.java        — error details with field errors
│   └── ...                       — all shared DTOs
├── exception/
│   ├── ShieldException.java
│   ├── TenantNotFoundException.java
│   ├── ProfileNotFoundException.java
│   ├── UnauthorizedException.java
│   └── GlobalExceptionHandler.java  — @RestControllerAdvice
├── security/
│   ├── JwtUtils.java             — JWT sign/validate (HS512, JJWT 0.12.5)
│   ├── TenantContext.java        — ThreadLocal tenant_id holder
│   └── SecurityConstants.java   — roles, claim names
├── model/
│   ├── BaseEntity.java           — id (UUID), createdAt, updatedAt, tenantId
│   └── AuditEntity.java          — + createdBy, updatedBy
└── util/
    ├── SlugUtils.java            — generate DNS-safe slugs for child IDs
    └── PageUtils.java
```

**Key pattern — BaseEntity:**
```java
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @CreatedDate
    @Column(updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
```

---

## 2. shield-eureka (Port: 8261)

**Purpose:** Spring Cloud Eureka Server — service registry. All microservices register here and discover each other.

**Dependencies:** `spring-cloud-starter-netflix-eureka-server`

**application.yml:**
```yaml
server.port: 8261
eureka:
  instance.hostname: localhost
  client:
    register-with-eureka: false
    fetch-registry: false
spring.security.user:
  name: eureka
  password: ${EUREKA_PASSWORD}
```

---

## 3. shield-config (Port: 8288)

**Purpose:** Spring Cloud Config Server — centralised configuration for all services. Uses native (filesystem) profile in Phase 1.

**Config files location:** `/var/www/ai/Shield/config-repo/`

Files:
- `application.yml` — shared config for all services
- `shield-auth.yml`
- `shield-profile.yml`
- `shield-dns.yml`
- etc.

---

## 4. shield-gateway (Port: 8280)

**Purpose:** API Gateway — single entry point for all clients.

**Key responsibilities:**
- JWT validation (HS512) — rejects requests with missing/invalid tokens
- Extracts `userId`, `role`, `tenantId` from JWT → adds as headers
- Routes requests to downstream services (via Eureka service discovery)
- Rate limiting: 100 req/min per IP via Redis
- CORS configuration for React dashboard origin
- Circuit breaker (Resilience4j) on all downstream routes

**Routes configuration:**
```yaml
spring.cloud.gateway.routes:
  - id: auth-service
    uri: lb://shield-auth
    predicates: [Path=/api/v1/auth/**]
    filters: [StripPrefix=0]  # No JWT filter on auth

  - id: profile-service
    uri: lb://shield-profile
    predicates: [Path=/api/v1/profiles/**, /api/v1/devices/**, /api/v1/children/**]
    filters: [JwtAuthFilter, TenantFilter]

  - id: dns-service
    uri: lb://shield-dns
    predicates: [Path=/api/v1/dns/**, /api/v1/rules/**, /api/v1/schedules/**]
    filters: [JwtAuthFilter, TenantFilter, RoleFilter=CUSTOMER]

  - id: location-service
    uri: lb://shield-location
    predicates: [Path=/api/v1/location/**, /api/v1/geofences/**]
    filters: [JwtAuthFilter, TenantFilter]

  - id: child-app
    uri: lb://shield-location
    predicates: [Path=/api/v1/child/**]
    filters: [ChildTokenFilter]  # Validates CHILD_APP role token
```

---

## 5. shield-auth (Port: 8281)

**Purpose:** Authentication and authorisation for all user types.

**Database schema:** `auth`

**Key entities:**
```
users               — all users (global admin, ISP admin, customer, child app)
refresh_tokens      — opaque refresh tokens stored in Redis + DB
password_reset      — time-limited reset tokens
login_audit         — login attempts for security monitoring
```

**Endpoints:**
```
POST /api/v1/auth/register          — Customer self-registration
POST /api/v1/auth/login             — Login → JWT access + refresh token
POST /api/v1/auth/refresh           — Refresh access token
POST /api/v1/auth/logout            — Blacklist tokens in Redis
POST /api/v1/auth/forgot-password   — Send reset email
POST /api/v1/auth/reset-password    — Apply new password
POST /api/v1/auth/child/token       — Issue CHILD_APP token (device PIN)
GET  /api/v1/auth/me                — Current user info
```

**JWT Tokens:**
- **Access token:** HS512, 1-hour expiry, in Authorization header
- **Refresh token:** Opaque UUID, 30-day expiry, stored in Redis with TTL
- **Child token:** HS512 with `CHILD_APP` role, 365-day expiry (stored on device)

**Multi-tenant login flow:**
1. Client POSTs `{email, password, tenantSlug?}`
2. Service looks up user by email + tenant_id (or global_admin table if no tenant)
3. BCrypt verify password
4. Build JWT with `{sub, email, role, tenant_id}`
5. Store refresh token in Redis: `rt:{userId}` → UUID with 30d TTL
6. Return `{accessToken, refreshToken, user}`

---

## 6. shield-tenant (Port: 8282)

**Purpose:** Manages the ISP tenant hierarchy — Global Admin operations, ISP onboarding, feature flags, quotas.

**Database schema:** `tenant`

**Key entities:**
```
tenants             — ISP tenants (id, name, slug, plan_tier, feature_flags, status)
tenant_branding     — logo, colors, app_name, support_url, legal_text
tenant_quotas       — max_customers, max_profiles, log_retention_days
isP_admins          — ISP admin users linked to tenant
plan_tiers          — STARTER, FAMILY, PREMIUM, ENTERPRISE
feature_flags       — per-tenant enabled features (JSON: gps, ai, social_scan, ...)
tenant_audit        — all admin actions on tenants
```

**Feature Flag Schema (JSON in `tenants.feature_flags`):**
```json
{
  "gps_tracking": true,
  "ai_monitoring": false,
  "social_scanning": false,
  "panic_button": true,
  "reward_system": true,
  "advanced_schedules": true,
  "log_retention_days": 30,
  "max_children_per_account": 10,
  "max_devices_per_child": 5
}
```

**Key endpoints (Global Admin only):**
```
GET    /api/v1/admin/tenants              — List all ISP tenants
POST   /api/v1/admin/tenants             — Create new ISP tenant
PUT    /api/v1/admin/tenants/{id}        — Update tenant config
DELETE /api/v1/admin/tenants/{id}        — Deactivate tenant
GET    /api/v1/admin/tenants/{id}/stats  — Tenant usage stats
PUT    /api/v1/admin/tenants/{id}/features — Update feature flags
GET    /api/v1/admin/dashboard           — Platform-wide dashboard
```

**Key endpoints (ISP Admin):**
```
GET    /api/v1/tenant/me                 — Own tenant info
GET    /api/v1/tenant/customers          — List customers
POST   /api/v1/tenant/customers          — Create customer account
PUT    /api/v1/tenant/branding           — Update ISP branding
GET    /api/v1/tenant/analytics          — ISP analytics dashboard
POST   /api/v1/tenant/blocklist          — Add ISP-level blocked domain
```

---

## 7. shield-profile (Port: 8283)

**Purpose:** Core service for managing customer accounts, child profiles, and registered devices.

**Database schema:** `profile`

**Key entities:**
```
customers           — household accounts (1 per family subscription)
child_profiles      — per-child managed entities
devices             — registered devices linked to child profiles
profile_settings    — DNS client ID, filter level, age group
family_members      — co-parent accounts (up to 4 per household)
```

**Important — DNS Client ID generation:**
When a child profile is created, the service:
1. Generates a unique DNS slug (e.g. `jake-smith-3f2a`)
2. Calls **AdGuard Home REST API** to create a DNS Client with this ID
3. Stores the client ID in `child_profiles.dns_client_id`
4. Returns the DoH URL: `https://{clientId}.dns.shield.rstglobal.in/dns-query`

**Key endpoints:**
```
GET    /api/v1/children                  — List child profiles
POST   /api/v1/children                  — Create child profile (+ AdGuard client)
PUT    /api/v1/children/{id}             — Update profile
DELETE /api/v1/children/{id}             — Delete profile (+ AdGuard client)
GET    /api/v1/children/{id}/doh-url     — Get DoH endpoint URL for device setup

GET    /api/v1/devices                   — List devices for all children
POST   /api/v1/devices                   — Register device to child profile
DELETE /api/v1/devices/{id}              — Remove device
GET    /api/v1/devices/qr/{childId}      — Generate QR code for Private DNS setup
POST   /api/v1/devices/{id}/transfer     — Transfer device to different child profile

GET    /api/v1/family                    — Get family members
POST   /api/v1/family/invite             — Invite co-parent via email
PUT    /api/v1/family/{memberId}/role    — Set primary/secondary guardian
```

---

## 8. shield-dns (Port: 8284)

**Purpose:** Manages all DNS filtering rules via AdGuard Home REST API. Handles content categories, custom allow/block lists, time schedules, and app-specific time budgets.

**Database schema:** `dns`

**Key entities:**
```
dns_rules           — per-profile filtering rules (category enables, allow/block lists)
schedules           — time-based internet access schedules (24h × 7-day grid)
time_budgets        — per-app daily time limits and current usage
schedule_presets    — school_hours, bedtime, homework_mode, focus_mode
dns_query_log       — recent queries (hot cache in Redis, cold in ClickHouse)
blocked_domains     — custom per-profile or per-tenant domain blocks
content_categories  — 80+ categories with AdGuard filter list mappings
```

**Time Budget Enforcement:**
```
When AdGuard logs a query to youtube.com:
  1. DNS service reads Redis key: budget:{profileId}:youtube → current_minutes_used
  2. Compare with limit in dns_rules.time_budgets.youtube_minutes
  3. If limit reached → publish to Redis: adguard.block.apply:{adguardClientId}
  4. DNS service calls AdGuard REST API to add youtube.com to client's custom block list
  5. At midnight → Redis key expires → AdGuard block removed (budget reset)
```

**Key endpoints:**
```
GET    /api/v1/rules/{profileId}               — Get all filtering rules
PUT    /api/v1/rules/{profileId}/categories    — Enable/disable content categories
PUT    /api/v1/rules/{profileId}/allowlist     — Update custom allow list
PUT    /api/v1/rules/{profileId}/blocklist     — Update custom block list
GET    /api/v1/rules/{profileId}/activity      — Live DNS query feed (WebSocket sub)

GET    /api/v1/schedules/{profileId}           — Get weekly schedule
PUT    /api/v1/schedules/{profileId}           — Update schedule grid
POST   /api/v1/schedules/{profileId}/preset    — Apply preset (SCHOOL/BEDTIME/HOMEWORK)
POST   /api/v1/schedules/{profileId}/override  — Temporary override (pause/resume)

GET    /api/v1/budgets/{profileId}             — Get time budgets
PUT    /api/v1/budgets/{profileId}             — Update time budgets
GET    /api/v1/budgets/{profileId}/today       — Today's usage per app
POST   /api/v1/budgets/{profileId}/extend      — Grant time extension (parent)
POST   /api/v1/budgets/{profileId}/request     — Child requests extension

GET    /api/v1/categories                      — List all 80+ content categories
```

**Content Categories (80+):**
```
ADULT, GAMBLING, SOCIAL_MEDIA, GAMING, STREAMING, VIOLENCE, DRUGS, WEAPONS,
PHISHING, MALWARE, RANSOMWARE, SPYWARE, CRYPTOCURRENCY, DATING, VPN, PROXY,
CULTS, EXTREMISM, HATE_SPEECH, TERRORISM, SELF_HARM, EATING_DISORDERS,
NEWS, EDUCATION, SHOPPING, TRAVEL, SPORTS, MUSIC, SEARCH_ENGINES, EMAIL,
MESSAGING, FORUMS, BLOGS, DOWNLOADS, FILE_SHARING, TORRENT, HACKING,
ADVERTISING, TRACKING, ANALYTICS, CDN, ...
```

---

## 9. shield-location (Port: 8285)

**Purpose:** GPS tracking, geofence management, location history, panic/SOS button, driving mode detection.

**Database schema:** `location`

**Key entities:**
```
location_points     — GPS coordinates (profileId, lat, lng, accuracy, speed, timestamp)
geofences           — polygon/circle zones per customer account
named_places        — named locations (Home, School, Sports Club) with radius
place_visits        — arrival/departure log per named place
panic_events        — SOS alerts with GPS coords and timestamp
driving_sessions    — detected driving sessions (speed > threshold)
```

**GPS Data Flow:**
```
Flutter child app (background_locator)
  → POST /api/v1/child/location/update  (every 60s)
  → Location service stores in PostgreSQL (TimescaleDB-compatible partitioning)
  → Checks all active geofences for this profile
  → If geofence breached → publish to Redis: shield.alerts.{customerId}
  → Notification service receives → FCM push to parent
```

**Key endpoints:**
```
GET  /api/v1/location/{profileId}/live       — Current GPS position
GET  /api/v1/location/{profileId}/history    — Location history (date range)
GET  /api/v1/location/{profileId}/speed      — Current speed (driving detection)

POST /api/v1/geofences                       — Create geofence (circle or polygon)
GET  /api/v1/geofences                       — List all geofences
PUT  /api/v1/geofences/{id}                  — Update geofence
DELETE /api/v1/geofences/{id}                — Delete geofence

POST /api/v1/places                          — Create named place
GET  /api/v1/places                          — List named places
GET  /api/v1/places/{id}/visits              — Arrival/departure history

POST /api/v1/child/location/update           — Child app: upload GPS (CHILD_APP token)
POST /api/v1/child/location/checkin          — Child app: manual check-in
POST /api/v1/child/location/panic            — Child app: SOS panic button
```

**Panic Button flow:**
```
1. Child taps SOS button in Flutter app
2. POST /api/v1/child/location/panic with {lat, lng, accuracy, timestamp}
3. Location service creates panic_event record
4. Publishes EMERGENCY alert to: shield.alerts.{customerId} with HIGH priority
5. Notification service sends IMMEDIATE FCM push to all family members
   — Subject: "SOS from Jake!"
   — Body: "Jake has sent an emergency alert from [address]"
   — Includes GPS coordinates and deep link to map view
6. If configured: auto-dial parent's phone number
```

---

## 10. shield-notification (Port: 8286)

**Purpose:** Unified notification service for push (FCM/APNs), email, WebSocket.

**Key responsibilities:**
- Android push via Firebase Cloud Messaging (FCM)
- iOS push via APNs (flutter_apns_only integration)
- Email via SMTP (supports: Zoho, SendGrid, Gmail, any SMTP)
- WebSocket STOMP server for live DNS activity feed
- Weekly report email generation (HTML template)
- Alert preference management (which alerts, which channel, quiet hours)

**Topics/Templates:**
```
BLOCK_ALERT         — Domain blocked for child
TIME_LIMIT_REACHED  — App daily limit reached
GEOFENCE_BREACH     — Child left/entered geofence
PANIC_SOS           — Emergency SOS (HIGH priority, bypasses quiet hours)
NEW_DEVICE          — Unknown device on network
AI_CONCERN          — AI detected unusual pattern
BEDTIME_ACTIVATED   — Bedtime schedule activated
LOW_BATTERY         — Child's phone battery < 20%
DEVICE_OFFLINE      — Child's device offline > 30 min
WEEKLY_SUMMARY      — Monday 8am weekly digest
REWARD_EARNED       — Task approved, reward credited
```

**FCM Configuration:**
```yaml
firebase:
  service-account-file: /var/www/ai/Shield/config/firebase-service-account.json
  # Parent app push topic per tenant: tenant_{tenantId}_{customerId}
  # Emergency SOS — data-only message with priority: high
```

---

## 11. shield-rewards (Port: 8287)

**Purpose:** Gamification layer — tasks/chores that children complete to earn screen time.

**Database schema:** `rewards`

**Key entities:**
```
tasks               — parent-created tasks (name, description, reward_minutes, status)
task_completions    — child marks task done, parent approves
reward_bank         — per-profile reward minutes balance
achievements        — earned badges and streaks
achievement_types   — badge definitions (Screen Time Champion, Focus Master, etc.)
streak_counters     — daily streak tracking per profile
```

**Key endpoints:**
```
GET    /api/v1/rewards/{profileId}/tasks          — List tasks
POST   /api/v1/rewards/{profileId}/tasks          — Create task
PUT    /api/v1/rewards/{profileId}/tasks/{id}     — Update task
DELETE /api/v1/rewards/{profileId}/tasks/{id}     — Delete task

POST   /api/v1/child/rewards/tasks/{id}/complete  — Child marks complete (CHILD_APP)
PUT    /api/v1/rewards/tasks/{id}/approve         — Parent approves → credits bank
PUT    /api/v1/rewards/tasks/{id}/reject          — Parent rejects with message

GET    /api/v1/rewards/{profileId}/bank           — Current reward balance
POST   /api/v1/rewards/{profileId}/use            — Redeem minutes from bank
POST   /api/v1/rewards/{profileId}/bonus          — Parent grants ad-hoc bonus time

GET    /api/v1/rewards/{profileId}/achievements   — Earned badges
GET    /api/v1/rewards/{profileId}/streaks        — Current streak data
```

---

## 12. shield-analytics (Port: 8289)

**Purpose:** DNS query log analytics using ClickHouse (or PostgreSQL partitioned tables in Phase 1), usage charts, and PDF reports.

> **Phase 1 Note:** Use PostgreSQL 18 with table partitioning for DNS logs. Migrate to ClickHouse in Phase 2 when query volumes grow.

**Key tables (PostgreSQL partitioned by day):**
```sql
CREATE TABLE dns_query_logs (
    id           BIGSERIAL,
    tenant_id    UUID        NOT NULL,
    customer_id  UUID        NOT NULL,
    profile_id   UUID        NOT NULL,
    domain       TEXT        NOT NULL,
    category     TEXT,
    action       TEXT        NOT NULL, -- ALLOWED / BLOCKED
    reason       TEXT,
    device_id    UUID,
    queried_at   TIMESTAMPTZ NOT NULL,
    response_ms  INTEGER
) PARTITION BY RANGE (queried_at);
```

**Key endpoints:**
```
GET /api/v1/analytics/{profileId}/usage/today     — Today's app usage stats
GET /api/v1/analytics/{profileId}/usage/week      — 7-day usage chart data
GET /api/v1/analytics/{profileId}/top-domains     — Top accessed domains
GET /api/v1/analytics/{profileId}/blocked         — Block event history
GET /api/v1/analytics/{profileId}/report/pdf      — Generate PDF report
GET /api/v1/analytics/tenant/summary              — ISP-level aggregated stats
GET /api/v1/analytics/platform/dashboard          — Global Admin dashboard data
```

---

## 13. shield-ai (Port: 8291 — Python FastAPI)

Full details in [09-ai-monitoring-service.md](09-ai-monitoring-service.md).

**Key routes:**
```
GET  /ai/{profileId}/weekly         — Weekly AI summary
GET  /ai/{profileId}/insights       — Current risk indicators
POST /ai/analyze/batch              — Batch DNS log analysis (called by analytics-service)
POST /ai/keywords                   — Set/update custom keyword watch list
GET  /ai/model/health               — Model health and accuracy metrics
```
