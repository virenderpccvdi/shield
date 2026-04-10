# Shield Platform — Detailed Codebase Review

**Date**: 2026-04-10  
**Type**: Full Code-Quality Audit  
**Scope**: All 11 Java microservices + FastAPI AI service + React Dashboard + Flutter App  
**Overall Score**: **6.5 / 10**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [shield-auth](#1-shield-auth)
3. [shield-gateway](#2-shield-gateway)
4. [shield-tenant](#3-shield-tenant)
5. [shield-profile](#4-shield-profile)
6. [shield-dns](#5-shield-dns)
7. [shield-location](#6-shield-location)
8. [shield-notification](#7-shield-notification)
9. [shield-rewards](#8-shield-rewards)
10. [shield-analytics](#9-shield-analytics)
11. [shield-admin](#10-shield-admin)
12. [shield-ai (Python/FastAPI)](#11-shield-ai-pythonfastapi)
13. [Cross-Cutting Issues](#cross-cutting-issues)
14. [Dependency Analysis](#dependency-analysis)
15. [Missing Patterns & Best Practices](#missing-patterns--best-practices)
16. [Prioritised Recommendations](#prioritised-recommendations)
17. [All Services Summary Table](#all-services-summary-table)

---

## Executive Summary

The Shield platform is built on a **well-structured microservices architecture** using Spring Boot 4.0.3, Spring Cloud 2025.1.1, and FastAPI. The codebase demonstrates mature engineering patterns — JWT gateway auth, circuit breakers, Eureka service discovery, HikariCP connection pooling. However, **critical security vulnerabilities** exist that block production use:

| Category | Score | Status |
|----------|-------|--------|
| Architecture | 9/10 | ✅ Strong |
| Feature Completeness | 8/10 | ✅ Good |
| Security | 4/10 | 🔴 Critical gaps |
| Input Validation | 3/10 | 🔴 Almost none |
| Performance | 7/10 | ⚠ Needs caching |
| Observability | 5/10 | ⚠ Partial |
| Test Coverage | 2/10 | 🔴 No visible tests |
| Kubernetes/DevOps | 5/10 | ⚠ Single replica, no HA |

---

## 1. shield-auth

**Port**: 8281 | **Main Class**: `AuthApplication.java`

### SecurityConfig — permitAll Paths
```
/api/v1/auth/**         — all public auth endpoints
/internal/**            — service-to-service
/actuator/health/**
/v3/api-docs/**
/swagger-ui/**
```

### Controllers & Endpoints

| Controller | Endpoint | Method | Description |
|-----------|----------|--------|-------------|
| AuthController | `/api/v1/auth/register` | POST | Self-service registration (CUSTOMER role) |
| AuthController | `/api/v1/auth/login` | POST | Email + password → JWT pair |
| AuthController | `/api/v1/auth/refresh` | POST | Refresh access token |
| AuthController | `/api/v1/auth/logout` | POST | Blacklist JWT in Redis |
| AuthController | `/api/v1/auth/verify-email` | POST | OTP-based email verification |
| AuthController | `/api/v1/auth/send-verification-email` | POST | Resend OTP email |
| AuthController | `/api/v1/auth/forgot-password` | POST | Send password reset email |
| AuthController | `/api/v1/auth/reset-password` | POST | Reset with token |
| AuthController | `/api/v1/auth/change-password` | PUT | Authenticated password change |
| AuthController | `/api/v1/auth/me` | GET | Current user profile |
| AuthController | `/api/v1/auth/me` | PUT | Update own profile |
| AuthController | `/api/v1/auth/account` | DELETE | Delete own account |
| AuthController | `/api/v1/auth/mfa/setup` | POST | Generate TOTP secret + QR code |
| AuthController | `/api/v1/auth/mfa/verify` | POST | Verify TOTP code, enable MFA |
| AuthController | `/api/v1/auth/mfa/disable` | POST | Disable MFA |
| AuthController | `/api/v1/auth/mfa/validate` | POST | Validate TOTP at login |
| AuthController | `/api/v1/auth/mfa/email/send` | POST | Send email OTP (MFA fallback) |
| AuthController | `/api/v1/auth/pin/setup` | POST | Set 4-6 digit app PIN |
| AuthController | `/api/v1/auth/pin/verify` | POST | Verify app PIN |
| AuthController | `/api/v1/auth/pin/reset` | POST | Reset app PIN |
| AuthController | `/api/v1/auth/child/token` | POST | Issue child device JWT |
| AuthController | `/api/v1/auth/users` | GET | (GLOBAL_ADMIN) Paginated user list |
| AuthController | `/api/v1/auth/admin/register` | POST | (ADMIN) Create user with explicit role |
| AuthController | `/api/v1/auth/admin/users/{id}` | PUT | (ADMIN) Update any user |
| AuthController | `/api/v1/auth/admin/users/{id}` | DELETE | (ADMIN) Deactivate user |
| AuthController | `/api/v1/auth/admin/users/{id}/reset-password` | POST | (ADMIN) Force password reset |
| InternalAuthController | `/internal/users/create-customer` | POST | Bulk customer creation |

### Entity: User

```java
// auth.users table
private UUID id;
private String email;           // UNIQUE, max 254, lowercase
private String passwordHash;    // BCrypt cost=12
private String name;            // max 100
private String phone;           // max 20
private UserRole role;          // CUSTOMER | ISP_ADMIN | GLOBAL_ADMIN
private UUID tenantId;          // nullable for GLOBAL_ADMIN
private boolean emailVerified;  // default false
private boolean active;         // default true (soft delete flag)
private Instant lastLoginAt;
private int failedLoginAttempts; // lockout at 5
private Instant lockedUntil;     // 30-min lockout
private boolean mfaEnabled;
private String mfaSecret;        // TOTP secret (base32)
private String mfaBackupCodes;   // stored as TEXT (comma-separated)
private boolean appPinEnabled;
private String appPin;           // hashed 4-6 digit PIN
private boolean biometricEnabled;
private Instant deletedAt;       // soft delete
```

### Business Logic

**Login Flow:**
```
1. Load user by email (constant-time DUMMY_HASH if not found → prevents enumeration)
2. Check emailVerified == true
3. Check active == true, lockedUntil < now
4. BCrypt.matches(rawPassword, passwordHash)
5. On failure: increment failedLoginAttempts; if >= 5 → set lockedUntil = now+30min
6. On success: reset attempts, update lastLoginAt
7. If mfaEnabled: return MFA_REQUIRED response (no JWT yet)
8. If not MFA: issue accessToken (24h HS512) + refreshToken (UUID in Redis, 30d TTL)
```

**JWT Claims:**
```json
{
  "sub": "userId",
  "email": "user@example.com",
  "role": "CUSTOMER",
  "tenant_id": "uuid",
  "profile_id": "uuid",      // child tokens only
  "iat": 1712800000,
  "exp": 1712886400
}
```

**Token Revocation (Redis):**
```
Key: shield:blacklist:userId
Value: logout_timestamp (Instant.toEpochMilli())
TTL: access token expiry duration
Logic: reject any token where iat <= logout_timestamp
```

### Issues Found

| # | Issue | Severity | Code Location |
|---|-------|----------|--------------|
| 1 | `sendEmailOtp()` accepts raw `Map<String,String>` — no @Valid | 🔴 HIGH | AuthController |
| 2 | OTP uses `Math.random()` — weak entropy | 🟠 HIGH | AuthService.generateOtp() |
| 3 | No rate limiting on `/forgot-password`, `/send-verification-email` | 🔴 HIGH | Missing |
| 4 | MFA backup codes stored as TEXT — no consumption logic | 🟡 MEDIUM | User entity |
| 5 | `adminUpdateUser()` accepts raw `Map<String,Object>` — no @Valid | 🟠 HIGH | AuthController |
| 6 | Password reset Base64(userId:otp) — reversible, no expiry check in some paths | 🟡 MEDIUM | AuthService |
| 7 | `generateRandomPassword()` duplicated in InternalAuthController | 🟢 LOW | DRY violation |
| 8 | Admin-created users skip email verification | 🟡 MEDIUM | AuthService.adminRegister() |
| 9 | CUSTOMER can have `tenantId=null` after admin update | 🟡 MEDIUM | AuthController.adminUpdateUser() |

### Fix Examples

```java
// Issue 1 — Replace Map with validated DTO:
public record SendOtpRequest(
    @NotBlank @Email String email
) {}

// Issue 2 — Use SecureRandom:
private static final SecureRandom SECURE_RANDOM = new SecureRandom();
String otp = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));

// Issue 3 — Add rate limiting in gateway config:
- id: auth-otp-limiter
  uri: lb://SHIELD-AUTH
  predicates:
    - Path=/api/v1/auth/forgot-password,/api/v1/auth/send-verification-email
  filters:
    - name: RequestRateLimiter
      args:
        redis-rate-limiter.replenishRate: 3
        redis-rate-limiter.burstCapacity: 5
        key-resolver: "#{@ipKeyResolver}"
```

---

## 2. shield-gateway

**Port**: 8280 | **Main Class**: `GatewayApplication.java`

### Architecture
Spring Cloud Gateway (WebFlux, non-blocking). Acts as:
- SSL termination (handled by AKS ingress / Nginx upstream)
- JWT validation (global filter, order -100)
- Rate limiting (Redis-backed)
- Circuit breakers (Resilience4j)
- Request correlation (X-Correlation-ID)
- Header injection (X-User-Id, X-User-Role, X-Tenant-Id, X-Profile-Id)

### JwtAuthenticationFilter Logic

```java
// Flow:
1. Check if path starts with PUBLIC_PREFIXES → skip filter
2. Extract Bearer token from Authorization header
3. Parse JWT → validate signature (HS512, 64-char secret)
4. Check exp claim → throw 401 if expired
5. Check Redis: LRANGE shield:blacklist:{userId} → reject if iat <= logout_time
6. Remap CHILD_APP role → CUSTOMER for downstream services
7. Inject headers: X-User-Id, X-User-Role, X-Tenant-Id, X-Profile-Id
8. Strip Authorization header before forwarding

PUBLIC_PREFIXES = [
  "/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh",
  "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password",
  "/api/v1/auth/verify-email", "/api/v1/auth/mfa/validate",
  "/api/v1/billing/", "/api/v1/admin/contact/submit",
  "/api/v1/admin/visitors/track", "/actuator/health",
  "/actuator/info", "/api/v1/ai/actuator/health", "/docs/", "/public/"
]
```

### Route Configuration

```yaml
routes:
  - id: shield-auth
    uri: lb://SHIELD-AUTH
    predicates: [Path=/api/v1/auth/**]
    filters: [CircuitBreaker(authCB)]

  - id: shield-tenant
    uri: lb://SHIELD-TENANT
    predicates: [Path=/api/v1/tenants/**]
    filters: [CircuitBreaker(tenantCB)]

  - id: shield-profile
    uri: lb://SHIELD-PROFILE
    predicates: [Path=/api/v1/profiles/**,/profiles/**]
    filters: [CircuitBreaker(profileCB)]

  - id: shield-dns
    uri: lb://SHIELD-DNS
    predicates: [Path=/api/v1/dns/**]
    filters: [CircuitBreaker(dnsCB)]

  - id: shield-location
    uri: lb://SHIELD-LOCATION
    predicates: [Path=/api/v1/location/**]
    filters: [CircuitBreaker(locationCB)]

  - id: shield-notification
    uri: lb://SHIELD-NOTIFICATION
    predicates: [Path=/api/v1/notifications/**]
    filters: [CircuitBreaker(notificationCB)]

  - id: shield-notification-ws
    uri: lb:ws://SHIELD-NOTIFICATION
    predicates: [Path=/ws/**]
    # No circuit breaker — WebSocket stays open

  - id: shield-rewards
    uri: lb://SHIELD-REWARDS
    predicates: [Path=/api/v1/rewards/**]
    filters: [CircuitBreaker(rewardsCB)]

  - id: shield-analytics
    uri: lb://SHIELD-ANALYTICS
    predicates: [Path=/api/v1/analytics/**]
    filters: [CircuitBreaker(analyticsCB)]

  - id: shield-admin
    uri: lb://SHIELD-ADMIN
    predicates: [Path=/api/v1/admin/**,/api/v1/billing/**]
    filters: [CircuitBreaker(adminCB)]

  - id: shield-ai
    uri: lb://SHIELD-AI
    predicates: [Path=/api/v1/ai/**]
    filters: [CircuitBreaker(aiCB)]
```

### Resilience4j Config
```yaml
circuitbreaker:
  slidingWindowSize: 10
  failureRateThreshold: 50
  waitDurationInOpenState: 10s
  permittedCallsInHalfOpen: 3

timelimiter:
  timeoutDuration: 5s     # downstream must respond in 5s

retry:
  maxAttempts: 2          # GET requests only
  waitDuration: 500ms
```

### Rate Limiting
```yaml
default:
  replenishRate: 50       # 50 req/s per user
  burstCapacity: 100

auth (login/register):
  replenishRate: 5        # 5 req/s per IP
  burstCapacity: 10
```

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | PUBLIC_PREFIXES hardcoded in Java class — requires redeploy to add new public endpoint | 🟡 MEDIUM |
| 2 | JWT claim key inconsistency — falls back to camelCase `tenantId` if `tenant_id` missing | 🟢 LOW |
| 3 | No request body logging — blind to malformed payloads | 🟢 LOW |
| 4 | Retry on GET only — POST idempotency not checked | 🟡 MEDIUM |
| 5 | No `X-Frame-Options` / `Content-Security-Policy` response headers added at gateway | 🟠 HIGH |

---

## 3. shield-tenant

**Port**: 8282 | **Main Class**: `TenantApplication.java`

### SecurityConfig
```
All requests: .anyRequest().permitAll()
Auth delegated entirely to header checks in controllers
```

### Controllers & Endpoints

| Endpoint | Method | Auth Check | Notes |
|----------|--------|-----------|-------|
| `/api/v1/tenants` | GET | GLOBAL_ADMIN | Paginated, filter by q/page/size |
| `/api/v1/tenants` | POST | GLOBAL_ADMIN | Create ISP tenant |
| `/api/v1/tenants/{id}` | GET | GLOBAL_ADMIN or own | |
| `/api/v1/tenants/{id}` | PUT | GLOBAL_ADMIN or own | |
| `/api/v1/tenants/{id}` | DELETE | GLOBAL_ADMIN | Soft delete |
| `/api/v1/tenants/me` | GET | ISP_ADMIN | Own tenant only |
| `/api/v1/tenants/slug/{slug}` | GET | GLOBAL_ADMIN | |
| `/api/v1/tenants/{id}/features/{feature}` | PATCH | GLOBAL_ADMIN | Toggle feature flag |
| `/api/v1/tenants/{id}/quotas` | GET/PUT | GLOBAL_ADMIN | max_customers etc. |
| `/api/v1/tenants/{id}/branding` | GET/PUT | ISP_ADMIN | White-label branding |
| `/api/v1/tenants/{id}/sync-features` | POST | GLOBAL_ADMIN | Re-apply plan defaults |
| `/api/v1/tenants/{id}/allowlist` | GET/POST/DELETE | ISP_ADMIN | ISP domain allowlist |
| `/api/v1/tenants/{id}/blocklist` | GET/POST/DELETE | ISP_ADMIN | ISP domain blocklist |

### Entity: Tenant

```java
private UUID id;
private UUID tenantId;          // same as id (legacy field)
private String slug;            // unique, max 63 (e.g. "rst-global")
private String name;            // max 150
private String contactEmail;
private String contactPhone;
private String logoUrl;
private String primaryColor;    // hex, default "#1565C0"
private String plan;            // STARTER | GROWTH | ENTERPRISE
private int maxCustomers;       // default 100
private int maxProfilesPerCustomer; // default 5
private Map<String, Boolean> features; // JSONB column
private boolean isActive;
private Instant trialEndsAt;
private Instant subscriptionEndsAt;
private Instant deletedAt;      // soft delete
// White-label:
private String brandName;
private String brandColor;
private String brandLogoUrl;
private String supportEmail;
private String supportPhone;
```

### PLAN_DEFAULTS (hardcoded in TenantService)

```java
PLAN_DEFAULTS = Map.of(
  "STARTER", Map.of(
    "maxCustomers", 50, "maxProfiles", 3,
    "features", Map.of("gps_tracking", false, "ai_monitoring", false,
                       "dns_filtering", true, "content_reporting", true, ...)
  ),
  "GROWTH", Map.of(...),
  "ENTERPRISE", Map.of(...)
)
```

**Issue**: Plan defaults are hardcoded Java maps. Changing pricing/features requires a code change + redeploy. Should be DB-driven.

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | `toggleFeature()` accepts raw `Map<String,Boolean>` — no @Valid, no allowed-keys validation | 🟠 HIGH |
| 2 | Plan defaults hardcoded in Java — can't be changed without redeploy | 🟡 MEDIUM |
| 3 | Internal branding endpoint returns branding with no auth check | 🟡 MEDIUM |
| 4 | safeCount() uses native SQL instead of JPA | 🟢 LOW |
| 5 | No audit log when features are toggled or quotas changed | 🟡 MEDIUM |
| 6 | Soft-deleted tenants still queryable by slug | 🟢 LOW |

---

## 4. shield-profile

**Port**: 8283 | **Main Class**: `ProfileApplication.java`

### SecurityConfig
```
All requests: .anyRequest().permitAll()
Auth via X-User-Role / X-Tenant-Id headers in controllers
```

### Controllers & Key Endpoints

**CustomerController:**
```
POST   /api/v1/profiles/customers              createCustomer (ISP_ADMIN)
GET    /api/v1/profiles/customers              listCustomers  (ISP_ADMIN, paginated)
GET    /api/v1/profiles/customers/me           getMyCustomer  (CUSTOMER)
GET    /api/v1/profiles/customers/{id}         getCustomer    (ISP_ADMIN)
PUT    /api/v1/profiles/customers/{id}         updateCustomer (ISP_ADMIN)
DELETE /api/v1/profiles/customers/{id}         deleteCustomer (ISP_ADMIN)
GET    /profiles/customers/{id}/children       listChildren   (ISP_ADMIN or CUSTOMER)
POST   /profiles/children                      createChild    (CUSTOMER)
GET    /profiles/children/{id}                 getChild       (CUSTOMER)
PUT    /profiles/children/{id}                 updateChild    (CUSTOMER)
DELETE /profiles/children/{id}                 deleteChild    (CUSTOMER)
```

**DeviceController:**
```
GET    /profiles/devices                       listDevices    (CUSTOMER)
POST   /profiles/pairing-codes                 generatePairingQr (CUSTOMER)
POST   /profiles/pairing-codes/redeem          redeemPairingCode (CHILD_APP)
DELETE /profiles/devices/{id}                  unpairDevice   (CUSTOMER)
```

**FamilyController:**
```
POST   /profiles/{id}/co-parents/invite        inviteCoParent
GET    /profiles/{id}/co-parents               listCoParents
DELETE /profiles/{id}/co-parents/{coId}        removeCoParent
POST   /profiles/{id}/emergency-contacts        addEmergencyContact
GET    /profiles/{id}/emergency-contacts        listEmergencyContacts
DELETE /profiles/{id}/emergency-contacts/{id}  removeEmergencyContact
```

**InternalProfileController:**
```
POST   /internal/profiles/provision            Create profile on registration
GET    /internal/profiles/{profileId}          Get profile (called by DNS, Location, etc.)
GET    /internal/profiles/by-user/{userId}     Get profiles for user
```

### Entities

**Customer:**
```java
private UUID id;
private UUID userId;        // FK → auth.users
private UUID tenantId;      // FK → tenant.tenants
private String name;
private String email;
private String phone;
private CustomerStatus status;  // ACTIVE, SUSPENDED, DELETED
private Instant deletedAt;
```

**ChildProfile:**
```java
private UUID id;
private UUID customerId;    // FK → profile.customers
private UUID tenantId;
private String name;        // max 100
private Integer age;
private FilterLevel filterLevel;  // RELAXED, MODERATE, STRICT, MAXIMUM
private String dnsClientId; // e.g. "jake-0000" for DoH URL
private String dohUrl;      // full DoH URL
private String deviceType;  // ANDROID, iOS
private String os;
private boolean isActive;
```

**Device:**
```java
private UUID id;
private UUID profileId;     // FK → child_profiles
private UUID tenantId;
private String deviceName;
private String deviceModel;
private String osVersion;
private String fcmToken;    // Firebase push token
private Instant lastSeenAt;
private int batteryLevel;
private Instant updatedAt;
```

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | `/profiles/customers/me` trusts X-User-Id header without verifying it belongs to an actual customer | 🟠 HIGH |
| 2 | `parseUuid(String)` returns null silently on exception — no error propagation | 🟡 MEDIUM |
| 3 | Tenant ownership not re-validated on child create — ISP_ADMIN could create child under wrong tenant | 🟡 MEDIUM |
| 4 | No child profile count check against `maxProfilesPerCustomer` quota on creation | 🟡 MEDIUM |
| 5 | Pairing code brute-force possible — 4-hex suffix is only 65,536 combinations | 🟠 HIGH |
| 6 | Missing @Valid on UpdateCustomerRequest and CreateChildProfileRequest | 🟠 HIGH |

---

## 5. shield-dns

**Port**: 8284 | **Main Class**: `DnsApplication.java`

### SecurityConfig
```
/internal/** → permitAll (internal service calls)
All requests → permitAll
```

### Controllers & Key Endpoints

| Controller | Key Endpoints |
|-----------|---------------|
| DnsRulesController | GET/PUT `/dns/rules/{profileId}` — categories, allowlist, blocklist, filter-level |
| FilterCategoryController | GET `/dns/categories` — all 30 content categories |
| ScheduleController | GET/PUT `/dns/schedules/{profileId}` — time-based access |
| AccessScheduleController | CRUD `/dns/access-schedules/{profileId}` — rule-based schedules |
| TimeLimitsController | GET/PUT/POST `/dns/time-limits/{profileId}` — daily budget |
| AppTimeBudgetController | GET/PUT `/dns/budgets/{profileId}` — per-app limits |
| BrowsingHistoryController | GET/DELETE `/dns/history/{profileId}` |
| ApprovalRequestController | GET/POST/PATCH `/dns/approval-requests` |
| ExtensionRequestController | GET/POST/PATCH `/dns/budgets/extension-requests` |
| ScreenTimeRequestController | GET/POST/PATCH `/dns/screen-time-requests` |
| InternalDnsController | POST `/internal/dns/provision`, GET `/internal/dns/rules/{id}` |

### 30 Content Categories

```
Always Blocked (cannot be turned off):
01 Adult & Pornography      02 Child Safety (CSAM)
03 Malware & Ransomware     04 Phishing & Fraud
05 Piracy & Downloads       06 Weapons & Firearms
07 Violence & Gore          08 Drugs & Narcotics
09 Terrorism & Extremism    10 Dark Web & Proxies

High Risk (configurable):
11 Gambling                 12 Self-Harm & Suicide
13 Hate Speech              14 Adult Dating (18+)

Medium Risk (social/gaming):
15 Social Media (all)       16 TikTok
17 Discord                  18 Online Gaming
19 Gaming Chat & Voice      20 Streaming Video
21 YouTube (unrestricted)   22 Anonymous Chat
23 VPN & Proxy Bypass       24 Cryptocurrency
25 Online Betting (Sports)

Low Risk (parent choice):
26 Music Streaming          27 WhatsApp & Messaging
28 Online Shopping          29 News (general)
30 Forums & Discussion
```

### Entity: DnsRules

```java
private UUID id;
private UUID profileId;     // unique FK
private UUID tenantId;
// Blocked categories as JSON array
private List<String> blockedCategories;
// Custom per-profile lists
private List<String> customAllowlist;   // JSONB
private List<String> customBlocklist;   // JSONB
// Config flags
private FilterLevel filterLevel;
private boolean safeSearchEnabled;
private boolean youtubeSafeMode;
private boolean socialMediaBlock;
// Bedtime lock
private boolean bedtimeLockEnabled;
private LocalTime bedtimeStart;
private LocalTime bedtimeEnd;
// Homework mode
private boolean homeworkModeEnabled;
private LocalTime homeworkStart;
private LocalTime homeworkEnd;
```

### Scheduled Jobs

```java
@Scheduled(fixedDelay = 60_000)   // every 60s
HomeworkModeExpiryJob.checkAndExpire()

@Scheduled(fixedDelay = 300_000)  // every 5min
ApprovalExpiryJob.expireOldRequests()

@Scheduled(cron = "0 0 0 * * *")  // midnight
BedtimeLockService.resetDailyBudgets()

@Scheduled(cron = "0 0 2 * * *")  // 2AM
DnsRulesSyncJob.syncAllToAdGuard()
```

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | No @Valid on DnsRules update requests | 🟠 HIGH |
| 2 | AdGuardClient makes direct HTTP calls with no circuit breaker | 🟡 MEDIUM |
| 3 | Approval requests have no expiry time by default | 🟡 MEDIUM |
| 4 | Profile-tenant ownership not validated (anyone with profileId can read rules) | 🟠 HIGH |
| 5 | `customAllowlist`/`customBlocklist` domain format not validated (no IDN normalization) | 🟡 MEDIUM |
| 6 | Budget enforcement job runs every 60s — 1-minute bypass window possible | 🟢 LOW |

---

## 6. shield-location

**Port**: 8285 | **Main Class**: `ShieldLocationApplication.java`

### SecurityConfig
```
/internal/location/** → permitAll
/public/**            → permitAll
All requests          → permitAll
```

### Controllers & Key Endpoints

| Controller | Key Endpoints |
|-----------|---------------|
| LocationController | POST `/location/checkin`, GET `/location/{id}/current`, GET `/location/{id}/history` |
| GeofenceController | CRUD `/location/geofences/{profileId}` |
| SosController | POST `/location/sos/trigger`, GET `/location/sos/{id}/history` |
| NamedPlaceController | CRUD `/location/places/{profileId}` |
| LocationSharingController | POST/GET/DELETE `/location/sharing/{profileId}` |
| BatteryAlertController | GET/PUT `/location/battery-alerts/{profileId}` |
| CheckinReminderController | CRUD `/location/checkin-reminders/{profileId}` |
| InternalLocationController | POST `/internal/location/checkin` (from Flutter app) |
| PublicLocationController | GET `/public/location/share/{token}` (no auth) |

### Entity: LocationPoint

```java
private UUID id;
private UUID profileId;
private UUID tenantId;
private BigDecimal latitude;
private BigDecimal longitude;
private BigDecimal accuracy;       // meters
private Integer altitude;
private Float speed;               // m/s
private Float bearing;             // degrees
private Integer batteryLevel;      // 0-100
private String provider;           // GPS, NETWORK, FUSED
private boolean isMocked;          // spoofing flag
private boolean isOnline;
private Instant recordedAt;
private Instant createdAt;
```

### Entity: Geofence

```java
private UUID id;
private UUID profileId;
private String name;               // "Home", "School"
private BigDecimal latitude;
private BigDecimal longitude;
private Integer radiusMeters;      // e.g. 200
private String type;               // HOME, SCHOOL, CUSTOM
private boolean alertOnEnter;
private boolean alertOnExit;
private boolean isActive;
```

### Spoofing Detection

```java
// SpoofingDetectionService heuristics:
1. isMocked flag from Android (easy to bypass with root)
2. Speed > 150 km/h between consecutive points
3. Accuracy > 200m (low accuracy = network-only)
4. Missing altitude (spoofing often lacks altitude data)
```

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | Spoofing detection relies on Android flag (trivially bypassed on rooted devices) | 🟡 MEDIUM |
| 2 | Location data stored in plaintext — sensitive PII | 🟡 MEDIUM |
| 3 | `/public/location/share/{token}` returns full lat/lon — no precision reduction | 🟡 MEDIUM |
| 4 | Location history has no auto-purge — data grows indefinitely | 🟡 MEDIUM |
| 5 | Internal checkin endpoint has no service authentication | 🟠 HIGH |
| 6 | No rate limiting on checkin — device could flood DB with location records | 🟠 HIGH |

---

## 7. shield-notification

**Port**: 8286 | **Main Class**: `NotificationApplication.java`

### SecurityConfig
```
/internal/**  → permitAll
/ws/**        → permitAll (WebSocket)
All requests  → permitAll
```

### Controllers & Key Endpoints

| Controller | Key Endpoints |
|-----------|---------------|
| NotificationController | GET `/notifications/{userId}`, POST `/notifications/{id}/mark-read` |
| PreferenceController | GET/PUT `/notifications/preferences/{userId}` |
| FcmTokenController | POST `/notifications/fcm/token`, DELETE `/notifications/fcm/token/{token}` |
| ChannelAdminController | GET/PUT `/notifications/channels` (GLOBAL_ADMIN) |
| IspCommunicationController | POST/GET `/notifications/isp-communications` |
| InternalNotifyController | POST `/internal/notify` — event dispatch |
| InternalEmailController | POST `/internal/email/send` |
| InternalBillingNotificationController | POST `/internal/billing-notify/invoice-paid` |
| WebSocket | `/ws` — STOMP endpoint with SockJS |

### Event Types (RabbitMQ Consumer)

```java
// ShieldEventConsumer listens to:
"shield.geofence.breach"      → Push + Email alert to parent
"shield.sos.triggered"        → Urgent push + SMS + Email
"shield.budget.exceeded"      → Push notification
"shield.anomaly.detected"     → Push + Email
"shield.weekly.digest"        → Email only
"shield.invoice.paid"         → Email
"shield.subscription.confirmed" → Email
```

### WebSocket Topics

```
/topic/tenant/{tenantId}     → All DNS events for ISP live dashboard
/user/queue/alerts           → User-specific alerts (SOS, geofence breach)
/topic/location/{profileId}  → Real-time location updates
```

### Notification Channels

```java
// NotificationChannel types:
EMAIL    — SMTP (configured per tenant or platform default)
SMS      — Twilio
PUSH     — Firebase Cloud Messaging (FCM)
TELEGRAM — Telegram Bot API
WHATSAPP — WhatsApp Business API
WEBHOOK  — Custom HTTP callback
```

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | **CRITICAL: SMTP_PASS in .env is visible to all developers with repo access** | 🔴 CRITICAL |
| 2 | **CRITICAL: All API keys in .env — Anthropic, DeepSeek, Google Maps, Stripe, Twilio** | 🔴 CRITICAL |
| 3 | No rate limiting on `/internal/email/send` — could flood SMTP quota | 🟠 HIGH |
| 4 | Firebase `google-services.json` must exist at runtime — no graceful degradation | 🟡 MEDIUM |
| 5 | No duplicate suppression — same geofence event can trigger multiple emails | 🟡 MEDIUM |
| 6 | WhatsApp/Telegram services have `return null` stubs for error cases | 🟡 MEDIUM |
| 7 | WebSocket auth only validates token at connect time — not per-message | 🟢 LOW |

---

## 8. shield-rewards

**Port**: 8287 | **Main Class**: `ShieldRewardsApplication.java`

### SecurityConfig
```
/internal/rewards/**  → permitAll
All requests          → permitAll
```

### Controllers & Key Endpoints

| Controller | Key Endpoints |
|-----------|---------------|
| RewardsController | GET/POST `/rewards/{profileId}/tasks`, PUT `/rewards/tasks/{id}/complete`, GET `/rewards/{id}/balance` |
| BadgeController | GET `/rewards/achievements/{profileId}`, POST `/rewards/achievements/{id}/unlock` |
| InternalRewardsController | POST `/internal/rewards/award` — called by other services |

### Entities

```java
// Task
private UUID id;
private UUID profileId;
private UUID parentId;       // who created task
private String title;
private String description;
private Integer pointsReward;
private TaskStatus status;   // PENDING, COMPLETED, APPROVED, REJECTED, EXPIRED
private Instant dueDate;
private Instant completedAt;

// RewardBank
private UUID id;
private UUID profileId;
private int balance;         // current points
private int totalEarned;
private int totalSpent;

// RewardTransaction
private UUID id;
private UUID profileId;
private TransactionType type; // EARN, REDEEM, BONUS, DEDUCT
private int amount;
private String description;

// Badge
private UUID id;
private String name;         // "Reading Star", "Scholar"
private String description;
private String iconUrl;
private int pointsRequired;

// Achievement
private UUID id;
private UUID profileId;
private UUID badgeId;
private Instant unlockedAt;
```

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | No cooldown on task completion — same task can be completed multiple times | 🟠 HIGH |
| 2 | Race condition on point redemption — concurrent requests could overdraft balance | 🟡 MEDIUM |
| 3 | Point values hardcoded in business logic — no admin configuration | 🟢 LOW |
| 4 | No parent approval required for task completion (auto-approved) | 🟡 MEDIUM |
| 5 | Badge criteria hardcoded — can't add new badges without code change | 🟢 LOW |

---

## 9. shield-analytics

**Port**: 8289 | **Main Class**: `ShieldAnalyticsApplication.java`

### SecurityConfig
```
/internal/analytics/**   → permitAll
/api/v1/analytics/**     → permitAll (NOTE: all analytics publicly readable!)
All requests             → permitAll
```

### Controllers & Key Endpoints

| Controller | Key Endpoints |
|-----------|---------------|
| AnalyticsController | GET `/{profileId}/stats`, `/{profileId}/history`, `/{profileId}/daily`, `/{profileId}/categories`, `/{profileId}/top-domains`, `/{profileId}/report/pdf` |
| AnalyticsController | GET `/tenant/{tenantId}/overview`, `/tenant/{tenantId}/daily`, `/tenant/{tenantId}/hourly`, `/tenant/{tenantId}/categories` |
| AnalyticsController | GET `/platform/overview`, `/platform/daily` (GLOBAL_ADMIN) |
| TenantUsageDashboardController | GET `/tenant/overview`, `/tenant/customers`, `/tenant/hourly` |
| SocialAlertController | GET/POST `/{profileId}/social-alerts`, `/tenant/{tenantId}/social-alerts` |
| InternalAnalyticsController | POST `/internal/analytics/log`, POST `/internal/analytics/log/bulk` |
| ExportController | GET `/{profileId}/export/csv`, `/{profileId}/export/pdf` |

### Entity: DnsQueryLog

```java
// analytics.dns_query_logs (partitioned by quarter)
private UUID id;
private UUID profileId;
private UUID tenantId;
private String domain;           // e.g. "pornhub.com"
private String action;           // "BLOCKED" | "ALLOWED"
private String category;         // "adult", "gaming", "malware"
private String clientIp;
private UUID deviceId;
private Instant queriedAt;
private Instant createdAt;
```

### DnsQueryLogRepository — Custom Queries

```java
// Profile-level:
countByProfileIdAndQueriedAtBetween(UUID profileId, Instant from, Instant to)
countByProfileIdAndActionAndQueriedAtBetween(...)
findByProfileIdAndQueriedAtBetween(..., Pageable pageable)
findTopBlockedDomains(UUID profileId, Instant from, Instant to, int limit)
findCategoryBreakdown(UUID profileId, Instant from, Instant to)
findDailyBreakdown(UUID profileId, Instant from)
findHourlyBreakdown(UUID profileId, Instant from, Instant to)

// Tenant-level:
countByTenantIdAndQueriedAtBetween(UUID tenantId, Instant from, Instant to)
countByTenantIdAndActionAndQueriedAtBetween(...)
findTenantTopBlockedDomains(UUID tenantId, Instant from, Instant to, int limit)
findTenantBlockedCategories(UUID tenantId, Instant from, Instant to)
findTenantDailyBreakdown(UUID tenantId, Instant from)

// Platform-level:
findPlatformDailyBreakdown(Instant from)
findPlatformBlockedCategories(Instant from, Instant to)
findTopTenantsByQueries(Instant from, Instant to, int limit)

// Social monitoring:
findLateNightQueries(UUID profileId, Instant from)
findNewCategories(UUID profileId, Instant from)
findQueriesByCategories(UUID profileId, List<String> categories, Instant from)
```

### Caching Config

```java
@Cacheable(cacheNames = "analytics:stats",   key = "#profileId + ':' + #period")
@Cacheable(cacheNames = "analytics:tenant",  key = "#tenantId + ':' + #period")
@Cacheable(cacheNames = "analytics:daily",   key = "#tenantId + ':' + #days")
// TTL configured in Redis but not visible — default appears to be indefinite
```

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | **`/api/v1/analytics/**` is FULLY PUBLIC** — any caller can read any profile's DNS history by UUID | 🔴 CRITICAL |
| 2 | No PII filtering — domain names stored and returned verbatim | 🟡 MEDIUM |
| 3 | Cache TTL not explicitly configured — may cache stale data indefinitely | 🟡 MEDIUM |
| 4 | `periodToRange()` defaults to "today" (midnight–now) — shows 0 if no data today | 🟠 HIGH (UX bug, now fixed in frontend) |
| 5 | AiBatchScheduler has no pagination limit — can OOM on large tenants | 🟡 MEDIUM |
| 6 | Social alert deduplication not visible — same pattern can trigger multiple alerts | 🟡 MEDIUM |

---

## 10. shield-admin

**Port**: 8290 | **Main Class**: `ShieldAdminApplication.java`

### SecurityConfig
```
/api/v1/admin/tr069/webhook → permitAll (PUBLIC — TR-069 ACS calls this)
/api/v1/billing/webhook     → permitAll (PUBLIC — Stripe calls this)
All requests                → permitAll
```

### Controllers & Key Endpoints

| Controller | Key Endpoints |
|-----------|---------------|
| BrandingController | GET/PUT `/admin/branding`, POST `/admin/branding/upload-logo` |
| Tr069Controller | POST `/admin/tr069/webhook` — device provisioning |
| BillingController | GET `/billing/invoices`, POST `/billing/checkout`, POST `/billing/webhook` |
| StripeWebhookController | POST `/billing/webhook` (Stripe events) |
| SubscriptionPlanController | GET/POST/PUT `/admin/plans` |
| GlobalBlocklistController | GET/POST/DELETE `/admin/global-blocklist` |
| ComplianceController | GET/POST `/admin/compliance/gdpr/{userId}` — GDPR export/delete |
| AuditLogController | GET `/admin/audit-logs` |
| ContactController | POST `/admin/contact/submit` (PUBLIC) |
| VisitorController | POST `/admin/visitors/track` (PUBLIC) |
| AiSettingsController | GET/PUT `/admin/ai-settings` |
| BulkImportController | POST `/admin/bulk-import` — CSV customer import |
| BulkSuspendController | POST `/admin/bulk-suspend` |
| PlatformController | GET `/admin/platform/overview` |

### Entity: Invoice

```java
private UUID id;
private UUID tenantId;
private UUID customerId;
private String stripeInvoiceId;
private String stripePaymentIntentId;
private BigDecimal amount;
private String currency;           // "inr"
private InvoiceStatus status;      // PENDING, PAID, FAILED, REFUNDED
private String description;
private byte[] pdfData;            // stored inline in DB (problematic for large PDFs)
private Instant issuedAt;
private Instant paidAt;
private Instant dueDate;
```

### Entity: SubscriptionPlan

```java
private UUID id;
private String name;               // "STARTER", "GROWTH", "ENTERPRISE"
private String displayName;
private BigDecimal monthlyPrice;
private BigDecimal annualPrice;
private int maxCustomers;
private int maxProfilesPerCustomer;
private Map<String, Object> features;  // JSONB
private boolean isActive;
private int displayOrder;
```

### Stripe Integration

```java
// BillingService key methods:
createCheckoutSession(userId, tenantId, planId) → Stripe Checkout URL
processWebhookEvent(payload, signature)         → Handle payment events
getSubscription(userId, tenantId)               → Current subscription info
cancelSubscription(tenantId)                    → Cancel at period end

// Stripe webhook events handled:
checkout.session.completed    → Activate subscription
invoice.paid                  → Send invoice email
invoice.payment_failed        → Notify failure
customer.subscription.deleted → Deactivate tenant
```

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | **TR-069 webhook has NO signature validation** — any caller can trigger device provisioning | 🔴 CRITICAL |
| 2 | **Stripe webhook missing `Webhook.constructEvent()` signature check** | 🔴 CRITICAL |
| 3 | Invoice PDF stored as `byte[]` in DB — no size limit, could bloat DB | 🟡 MEDIUM |
| 4 | GDPR export ZIP not encrypted — sensitive data in plaintext archive | 🟡 MEDIUM |
| 5 | Contact form no CAPTCHA/rate limiting — spam risk | 🟡 MEDIUM |
| 6 | Visitor tracking (public endpoint) no consent mechanism | 🟡 MEDIUM |
| 7 | Bulk import no file size/type validation | 🟠 HIGH |
| 8 | `PlatformController` returns all tenant data with no pagination | 🟢 LOW |

---

## 11. shield-ai (Python/FastAPI)

**Port**: 8291 | **Main File**: `main.py`

### Application Setup

```python
app = FastAPI(title="Shield AI Service", version="1.0.0")

# CORS — CRITICAL ISSUE:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # ← allows ANY web origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Routers & Endpoints

```
GET  /api/v1/ai/model/health         — Model health, version, feature count
GET  /api/v1/ai/actuator/health      — Liveness check (public, gateway bypass)

GET  /api/v1/ai/{profile_id}/weekly  — Weekly digest (LLM-generated narrative)
GET  /api/v1/ai/{profile_id}/insights — Risk scoring (SLEEP, GAMING, SOCIAL, etc.)

POST /api/v1/ai/analyze/batch        — IsolationForest anomaly detection
GET  /api/v1/ai/{profile_id}/keywords — Profile keyword list
POST /api/v1/ai/{profile_id}/keywords — Set keywords

GET  /api/v1/ai/{profile_id}/mental-health — Mental health risk signals
GET  /api/v1/ai/alerts               — Active anomaly alerts (?min_score, ?severity, ?limit)
POST /api/v1/ai/alerts/{id}/feedback — Feedback on alert accuracy

POST /api/v1/ai/train                — Trigger IsolationForest retrain (?days_back=30)
GET  /api/v1/ai/train/status         — Training job status (from /tmp file)

POST /api/v1/ai/config/reload        — Hot-reload LLM provider config (from /tmp file)
GET  /api/v1/ai/config/current       — Current config (keys masked)

POST /api/v1/ai/chat                 — Parent AI Q&A (LLM with child context)
POST /api/v1/ai/safe-chat            — Child safe chatbot (filtered LLM)
GET  /api/v1/ai/safe-chat/health     — Safe chat liveness
```

### SafeChat Request/Response

```python
class SafeChatRequest(BaseModel):
    profile_id: str
    message: str       # NO max_length validation!
    age_group: str     # "child_6_12" | "child_13_17"
    conversation_history: list = []

# Pre-filter blocked keywords:
BLOCKED_KEYWORDS = ["weapon", "gun", "knife", "drug", "alcohol", "sex",
                    "porn", "nude", "hack", "bypass", "kill", ...]

# Logic:
if keyword_count >= 2: return safety_fallback_response
response = call_deepseek(system_prompt_for_age_group, message)
if post_filter_detects_keywords(response): return safety_fallback_response
return response
```

### Database Connection

```python
DB_PASSWORD = os.getenv("DB_PASSWORD", "Shield@2026#Secure")  # hardcoded default!
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_SSL = os.getenv("DB_SSL", "false")

engine = create_async_engine(
    f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    pool_size=5,
    max_overflow=10,
    connect_args={"ssl": DB_SSL.lower() == "true"}
)
```

### LLM Routing

```python
async def call_llm(prompt, system_prompt, max_tokens=512):
    try:
        # Primary: DeepSeek
        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": prompt}],
            max_tokens=max_tokens
        )
        return response.choices[0].message.content

    except Exception:
        # Fallback: Claude Haiku
        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            system=system_prompt
        )
        return response.content[0].text
```

### IsolationForest Model (11 Features)

```python
FEATURES = [
    "query_count",          # total DNS queries in period
    "block_count",          # total blocked queries
    "unique_domains",       # distinct domains visited
    "adult_queries",        # queries matching adult category
    "gaming_queries",       # queries matching gaming
    "social_queries",       # queries matching social media
    "after_hours_queries",  # queries between 22:00–06:00
    "day_of_week",          # 0=Monday, 6=Sunday
    "hour_of_day",          # 0-23
    "new_domains",          # domains not seen in prior week
    "block_rate"            # blocked / total
]

# Training:
model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
model.fit(X_train)

# Inference:
score = model.decision_function(X_sample)  # negative = more anomalous
is_anomaly = score < -0.05
```

### Issues Found

| # | Issue | Severity |
|---|-------|----------|
| 1 | **CORS `allow_origins=["*"]`** — any website can call AI endpoints | 🔴 CRITICAL |
| 2 | **Hardcoded DB password fallback in code** — exposed in git history | 🔴 CRITICAL |
| 3 | **No `@auth` validation** — any caller can query any profile's AI data by UUID | 🔴 CRITICAL |
| 4 | **AI alerts stored in-memory dict** — lost on every pod restart | 🔴 CRITICAL |
| 5 | **Training status via /tmp file** — lost on restart, race conditions | 🟠 HIGH |
| 6 | **Config reload via /tmp file** — insecure, no auth | 🔴 CRITICAL |
| 7 | `SafeChatRequest.message` has no max_length | 🟡 MEDIUM |
| 8 | Keyword filter easily bypassed with spaces/leetspeak | 🟡 MEDIUM |
| 9 | DeepSeek→Claude fallback silent — billing confusion | 🟢 LOW |
| 10 | No request rate limiting on any endpoint | 🟠 HIGH |

### Fix for Issue 1 (CORS):

```python
# Replace:
allow_origins=["*"]

# With:
allow_origins=[
    "https://shield.rstglobal.in",
    "http://localhost:5173",  # dev only
]
```

### Fix for Issue 3 (Missing Auth):

```python
# Add header validation to all profile endpoints:
from fastapi import Header, HTTPException

async def get_profile_id(
    profile_id: str,
    x_user_id: str = Header(None),
    x_user_role: str = Header(None),
    x_profile_id: str = Header(None)
):
    if x_user_role == "GLOBAL_ADMIN":
        return profile_id
    if x_profile_id != profile_id and x_user_role not in ("ISP_ADMIN", "CUSTOMER"):
        raise HTTPException(status_code=403, detail="Access denied")
    return profile_id
```

---

## Cross-Cutting Issues

### 🔴 CRITICAL SECURITY FINDINGS

| # | Issue | Affected | Fix |
|---|-------|----------|-----|
| C1 | **All API keys in .env file (Anthropic, DeepSeek, Stripe, Twilio, Google Maps)** | notification, ai, admin | Move to Kubernetes Secrets + HashiCorp Vault |
| C2 | **Hardcoded DB password in shield-ai source code** | ai | Remove default value; fail fast if env var missing |
| C3 | **TR-069 webhook has no signature validation** | admin | Add HMAC-SHA256 validation |
| C4 | **Stripe webhook has no signature check** | admin | Use `Webhook.constructEvent(payload, sig, secret)` |
| C5 | **CORS allows all origins on AI service** | ai | Restrict to known frontend domains |
| C6 | **`/api/v1/analytics/**` publicly readable without auth** | analytics | Add requireAuth check; validate caller's tenantId |
| C7 | **AI alerts stored in-memory** | ai | Persist to `analytics.social_alerts` table |
| C8 | **AI config reloaded from /tmp** | ai | Use environment variables or config server |

### 🟠 HIGH PRIORITY CODE ISSUES

| # | Issue | Services | Impact |
|---|-------|----------|--------|
| H1 | Missing `@Valid` on request bodies | auth, profile, dns, rewards, admin | Injection, invalid data |
| H2 | OTP uses `Math.random()` (weak entropy) | auth | Predictable OTPs |
| H3 | No rate limiting on OTP/contact/checkin endpoints | auth, admin, location | Abuse, spam |
| H4 | No service-to-service auth on `/internal/**` | all services | Gateway bypass = open access |
| H5 | Profile UUID not validated against caller's tenant | analytics, dns, ai | Cross-tenant data leak |
| H6 | Pairing code is 4-hex (65K combinations) — brute-forceable | profile | Device hijacking |
| H7 | Location checkin endpoint has no rate limit | location | DB flood |
| H8 | Bulk import has no file validation | admin | SSRF, malformed data |

### 🟡 MEDIUM PRIORITY ISSUES

| # | Issue | Services |
|---|-------|----------|
| M1 | No audit logging for sensitive operations | auth, tenant, admin |
| M2 | Plan defaults hardcoded in Java | tenant |
| M3 | SafeChat keyword filter bypassable with leetspeak | ai |
| M4 | Duplicate code: `generateRandomPassword()` | auth |
| M5 | MFA backup codes stored as TEXT, not usable | auth |
| M6 | Approval requests have no expiry default | dns |
| M7 | PDF stored as byte[] in database | admin |
| M8 | No deduplication on notification dispatch | notification |
| M9 | Cache TTL not configured | analytics |
| M10 | Location data not auto-purged | location |

### 🟢 LOW PRIORITY

| # | Issue |
|---|-------|
| L1 | Unused dead code (AdGuardClient stub) |
| L2 | DRY violations (password generation in 2 places) |
| L3 | Magic numbers scattered (5 attempts, 30min lock, 24h token) |
| L4 | No API versioning strategy beyond `/api/v1/` prefix |
| L5 | Native SQL queries instead of JPA Criteria |

---

## Dependency Analysis

### Backend (Java — Spring Boot 4.0.3)

| Dependency | Version | Status |
|-----------|---------|--------|
| Spring Boot | 4.0.3 | ✅ Latest |
| Spring Cloud | 2025.1.1 | ✅ Latest |
| Spring Security | 7.0.x | ✅ Latest (via Boot) |
| JJWT | 0.13.0 | ✅ Current |
| MapStruct | 1.6.3 | ✅ Current |
| SpringDoc OpenAPI | 3.0.2 | ✅ Latest for Boot 4.x |
| Logstash Logback | 8.0 | ✅ Current |
| Flyway | 10.x | ✅ Compatible |
| HikariCP | Bundled | ✅ Spring-managed |
| Resilience4j | 2.x | ✅ Current |

**No known CVEs in declared dependency versions.**

### Frontend (React 19 + MUI v7)

| Dependency | Version | Notes |
|-----------|---------|-------|
| React | 19.2.4 | Latest |
| MUI | 7.3.8 | Latest |
| Vite | 6.2.x | Latest |
| React Query | 5.x | Latest |
| @stomp/stompjs | 7.x | WebSocket client |
| Recharts | 2.x | Charts |
| Leaflet | 1.x | Maps |
| Stripe.js | Latest | Payments |

### Python AI Service

| Dependency | Version | Notes |
|-----------|---------|-------|
| FastAPI | 0.115.x | Latest |
| scikit-learn | 1.5.x | IsolationForest |
| SQLAlchemy | 2.0.x (async) | DB ORM |
| anthropic | 0.43.x | Claude SDK |
| asyncpg | 0.29.x | PostgreSQL async driver |

---

## Missing Patterns & Best Practices

| Pattern | Status | Priority | Effort |
|---------|--------|----------|--------|
| `@Valid` on all request bodies | ❌ Missing | 🔴 Critical | Low (hours) |
| Secrets management (Vault/K8s Secrets) | ❌ Missing | 🔴 Critical | Medium (days) |
| Service-to-service auth (mTLS or API key) | ❌ Missing | 🟠 High | High (week) |
| Redis `@Cacheable` active on hot paths | ⚠ Partial | 🟡 Medium | Low (hours) |
| Distributed tracing (Sleuth + Zipkin) | ⚠ Config exists | 🟡 Medium | Low |
| Centralized log aggregation (ELK) | ❌ Missing | 🟡 Medium | Medium |
| Circuit breaker on external API calls | ❌ Missing | 🟠 High | Low |
| Prometheus metrics per service | ⚠ Actuator only | 🟡 Medium | Low |
| Rate limiting per user (not just per IP) | ❌ Missing | 🟠 High | Medium |
| API gateway response size limit | ❌ Missing | 🟢 Low | Low |
| OpenAPI spec validation (request schema) | ❌ Missing | 🟡 Medium | Medium |
| GDPR data minimization / auto-purge | ❌ Missing | 🟡 Medium | Medium |
| Automated security scanning (OWASP ZAP) | ❌ Missing | 🟠 High | Medium |
| Unit tests (any service) | ❌ Not found | 🟡 Medium | High |
| Integration tests | ❌ Not found | 🟡 Medium | High |

---

## Prioritised Recommendations

### Week 1 — Stop the Bleeding (Security)

```bash
# 1. Move all secrets to Kubernetes Secrets
kubectl create secret generic shield-secrets \
  --from-literal=ANTHROPIC_API_KEY=xxx \
  --from-literal=DEEPSEEK_API_KEY=xxx \
  --from-literal=STRIPE_API_KEY=xxx \
  --from-literal=SMTP_PASSWORD=xxx \
  --namespace=shield-prod

# 2. Remove hardcoded defaults from shield-ai/db/database.py
# Before:
DB_PASSWORD = os.getenv("DB_PASSWORD", "Shield@2026#Secure")
# After:
DB_PASSWORD = os.getenv("DB_PASSWORD")
if not DB_PASSWORD:
    raise RuntimeError("DB_PASSWORD environment variable is required")

# 3. Fix CORS in shield-ai/main.py
allow_origins=["https://shield.rstglobal.in"]

# 4. Add Stripe webhook signature verification (shield-admin)
Event event = Webhook.constructEvent(payload, sigHeader,
    System.getenv("STRIPE_WEBHOOK_SECRET"));

# 5. Add TR-069 HMAC validation
String expectedSig = computeHmac(payload, tr069Secret);
if (!expectedSig.equals(incomingSig)) throw new ForbiddenException();
```

### Week 2 — Input Validation (All Services)

```java
// Add @Valid to ALL controller endpoints:

// shield-auth — AuthController.java
public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {}
public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {}

// Add validation annotations to DTOs:
public record RegisterRequest(
    @NotBlank @Email @Size(max=254) String email,
    @NotBlank @Size(min=8, max=72) String password,
    @NotBlank @Size(max=100) String name,
    @Pattern(regexp="^[+]?[0-9]{10,15}$") String phone
) {}

// Replace Map<String,String> request bodies with typed DTOs:
// Bad:  public ResponseEntity<?> sendOtp(@RequestBody Map<String,String> body)
// Good: public ResponseEntity<?> sendOtp(@Valid @RequestBody SendOtpRequest req)
```

### Week 3 — Fix Analytics Security

```java
// shield-analytics SecurityConfig.java — Fix public access:
// Before:
http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());

// After:
http.authorizeHttpRequests(auth -> auth
    .requestMatchers("/internal/analytics/**").permitAll()
    .requestMatchers("/actuator/health/**").permitAll()
    .anyRequest().authenticated()  // requires X-User-Id header
);

// Add ownership validation in AnalyticsController:
private void validateAccess(UUID profileId, String userRole, UUID callerTenantId) {
    if ("GLOBAL_ADMIN".equals(userRole)) return;
    // Verify profile belongs to caller's tenant
    UUID profileTenantId = dnsQueryLogRepository.findTenantByProfileId(profileId);
    if (!callerTenantId.equals(profileTenantId))
        throw ShieldException.forbidden("Access denied to profile " + profileId);
}
```

### Month 1 — High Availability

```yaml
# Update ALL k8s/base/*/deployment.yaml:

# Before:
replicas: 1
strategy:
  type: Recreate

# After:
replicas: 2
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0

# Add PodDisruptionBudget for critical services:
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: shield-auth-pdb
  namespace: shield-prod
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: shield-auth
```

### Month 2 — AI Service Hardening

```python
# Persist alerts to database (replace in-memory dict):
class AlertPersistenceService:
    async def save_alert(self, db: AsyncSession, alert: AlertItem):
        record = SocialAlert(
            profile_id=alert.profile_id,
            alert_type=alert.alert_type,
            severity=alert.severity,
            score=alert.score,
            message=alert.message,
            created_at=datetime.utcnow()
        )
        db.add(record)
        await db.commit()

# Use Redis for training status (replace /tmp):
import redis.asyncio as aioredis
redis_client = aioredis.from_url(os.getenv("REDIS_URL"))

async def set_training_status(status: dict):
    await redis_client.setex(
        "shield:ai:training:status",
        3600,  # 1 hour TTL
        json.dumps(status)
    )
```

---

## All Services Summary Table

| Service | Main Class | # Controllers | # Entities | Risk Level | Top Issue |
|---------|-----------|:---:|:---:|:---:|-----------|
| **shield-auth** | AuthApplication | 2 | User (1) | 🟠 HIGH | Weak OTP entropy, no rate limiting on OTP |
| **shield-gateway** | GatewayApplication | 1 (filter) | — | 🟡 MEDIUM | Public paths hardcoded in Java |
| **shield-tenant** | TenantApplication | 1 | Tenant (1) | 🟡 MEDIUM | Plan defaults hardcoded, no audit log |
| **shield-profile** | ProfileApplication | 4 | Customer, ChildProfile, Device + 3 | 🟠 HIGH | Missing auth on /me, UUID brute-force on pairing |
| **shield-dns** | DnsApplication | 8 | DnsRules, Schedule + 8 | 🟡 MEDIUM | No @Valid, profile ownership not validated |
| **shield-location** | ShieldLocationApplication | 7 | LocationPoint, Geofence + 5 | 🟡 MEDIUM | Spoofing detection weak, no location rate limit |
| **shield-notification** | NotificationApplication | 6 | Notification, DeviceToken + 3 | 🔴 CRITICAL | API keys in .env, SMTP credentials exposed |
| **shield-rewards** | ShieldRewardsApplication | 3 | Task, Badge, RewardBank + 2 | 🟢 LOW | Task completion race condition |
| **shield-analytics** | ShieldAnalyticsApplication | 4 | DnsQueryLog, UsageSummary + 2 | 🔴 CRITICAL | Public analytics API — any caller reads any profile |
| **shield-admin** | ShieldAdminApplication | 11 | Invoice, AuditLog + 10 | 🔴 CRITICAL | TR-069/Stripe webhooks unsigned |
| **shield-ai** | main.py (FastAPI) | 9 routers | — | 🔴 CRITICAL | CORS wildcard, hardcoded password, no auth, alerts in-memory |

---

## Final Verdict

### Overall Code Quality: **6.5 / 10**

**What's Working Well:**
- Solid microservices separation with clear bounded contexts
- JWT gateway filter is well-implemented
- Spring Boot 4.x + Spring Cloud 2025.x — bleeding-edge, correct
- Flyway migrations — properly versioned, all schemas separate
- Resilience4j circuit breakers — configured correctly
- HikariCP connection pooling — well-tuned per service
- MapStruct DTOs — clean mapping layer
- Business logic reasonably well-organised in service layer

**Critical Blockers for Production (must fix before go-live):**
1. 🔴 Move all secrets out of .env and source code
2. 🔴 Fix public analytics API (`/api/v1/analytics/**`)
3. 🔴 Add TR-069 + Stripe webhook signature validation
4. 🔴 Fix AI service CORS + remove hardcoded DB password
5. 🔴 Persist AI alerts to database (not in-memory)
6. 🟠 Add `@Valid` to all controller endpoints
7. 🟠 Rate-limit OTP, contact form, and location checkin
8. 🟠 Change K8s strategy to RollingUpdate with replicas: 2

**Estimated effort to production-ready:**
- Critical security fixes: **1-2 weeks**
- Full hardening (validation, HA, caching, tests): **4-6 weeks**
- Enterprise-grade (mTLS, full observability, chaos testing): **3 months**

---

*Document: /doc/14-codebase-review-detailed.md | Generated: 2026-04-10 | Shield Platform v1.0*
