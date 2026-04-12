# Shield Platform — Backend Audit Report

**Date:** 2026-04-12  
**Auditor:** Claude Opus 4.6 (automated)  
**Scope:** Architecture, security, database, scalability, code quality  
**Platform:** Spring Boot 4.0.5 / Spring Cloud 2025.1.1 / Java 21 / PostgreSQL 18

---

## 1. Architecture Diagram

```
                   +-----------+
                   |   Nginx   |  (TLS termination, static site)
                   +-----+-----+
                         |
                  +------+------+
                  |   Gateway   |  :8280  (WebFlux, JWT filter, rate limiter, circuit breakers)
                  +------+------+
                         |
        +--------+-------+-------+--------+--------+--------+--------+--------+--------+
        |        |       |       |        |        |        |        |        |        |
     Auth:8281  Tenant  Profile  DNS   Location  Notif.  Rewards  Analytics  Admin   AI
                :8282   :8283   :8284   :8285    :8286   :8287    :8289     :8290  :8291
        |        |       |       |        |        |        |        |        |    (Python)
        +--------+-------+-------+--------+--------+--------+--------+--------+
                         |                          |
                   PostgreSQL:5432            Redis:6379
                   (HAProxy → Patroni)        (blacklist, rate limit, cache)
                         |
                 +-------+-------+
                 | Eureka :8261  |  (service registry)
                 | Config :8288  |  (centralized config)
                 +---------------+
```

**14 modules** in the reactor build (shield-common is a library JAR, shield-dns-resolver is a standalone service :8292).

---

## 2. Service-by-Service Health Check

| Service | Port | SecurityConfig | GatewayAuthFilter | Flyway Migrations | GlobalExceptionHandler |
|---------|------|---------------|-------------------|-------------------|----------------------|
| shield-auth | 8281 | Yes (permitAll /api/v1/auth/**) | No (issuer, not needed) | V1-V10 (auth schema) | Yes (via shield-common) |
| shield-tenant | 8282 | Yes | Yes | V1-V10 (tenant schema) | Yes |
| shield-profile | 8283 | Yes | Yes | V1-V18 (profile schema) | Yes |
| shield-dns | 8284 | Yes | Yes | V1-V23 (dns schema) | Yes |
| shield-location | 8285 | Yes | Yes | V1-V9 (location schema) | Yes |
| shield-notification | 8286 | Yes | Yes | V1-V5 (notification schema) | Yes |
| shield-rewards | 8287 | Yes | Yes | V1-V6 (rewards schema) | Yes |
| shield-analytics | 8289 | Yes | Yes | V1-V8 (analytics schema) | Yes |
| shield-admin | 8290 | Yes | Yes | V1-V17 (admin schema) | Yes |
| shield-dns-resolver | 8292 | Yes | Yes | N/A (reads DNS rules) | Yes |
| shield-gateway | 8280 | N/A (WebFlux) | N/A (is the filter) | N/A | Custom error handler |
| shield-eureka | 8261 | Basic auth | N/A | N/A | N/A |
| shield-config | 8288 | N/A | N/A | N/A | N/A |

**Verdict:** All services have consistent security configurations. Every service behind the gateway uses GatewayAuthFilter + `anyRequest().authenticated()` except shield-auth (which is the JWT issuer itself and uses permitAll for its own endpoints).

---

## 3. Security Assessment

### 3.1 Authentication & Authorization
- **JWT:** HS512 with 64-byte secret, 1-hour access tokens, 30-day refresh tokens (rotated on use)
- **MFA:** TOTP-based, with backup codes stored on User entity
- **Password policy:** 8-128 chars, regex enforced (upper + lower + digit + special), bcrypt(12)
- **Password history:** Last 5 passwords checked on change
- **Account lockout:** 5 failed attempts = 30-min DB lock + 15-min Redis rate limit
- **Brute-force protection:** Redis-based per-email failure counter + gateway IP rate limit (5 req/s on login/register)
- **User enumeration prevention:** Constant-time bcrypt against dummy hash for non-existent emails; forgotPassword always returns 200
- **Token blacklist:** Redis-based epoch-second blacklist; gateway checks `iat <= blacklistTs`
- **Refresh token rotation:** Old token deleted immediately on refresh; new one issued
- **Session tracking:** SHA-256 fingerprint (UA + IP), new-device push notification

### 3.2 CORS
- Single allowed origin from config (`shield.app.url`), credentials enabled
- Explicit method and header whitelists; max-age 3600s
- **Adequate** for single-domain deployment

### 3.3 Rate Limiting
- **Global default:** 50 req/s (burst 100) per user/IP via Redis token bucket
- **Auth endpoints:** 5 req/s (burst 10) per IP for login and register
- Key resolvers: `userKeyResolver` (authenticated) and `ipKeyResolver` (public)
- **Note:** ipKeyResolver may see Nginx's IP if X-Forwarded-For is not properly extracted (see Issue #2)

### 3.4 Input Validation
- Auth DTOs: `@NotBlank`, `@Email`, `@Size`, `@Pattern` on all request fields
- `@Valid` used in controllers (enforced by GlobalExceptionHandler's MethodArgumentNotValidException handler)
- `adminUpdateUser` accepts raw `Map<String, Object>` -- less strict but checked programmatically

### 3.5 Internal Endpoints
- `/internal/**` is permitted without authentication in all service SecurityConfigs
- Gateway does NOT route `/internal/**` paths (no gateway route has /internal/ predicate)
- **Risk:** If services are directly reachable (not just via loopback), internal endpoints are unprotected
- **Mitigation:** Services bind to localhost and are only reachable via gateway; Nginx blocks non-gateway traffic

---

## 4. Database Schema Review

- **9 separate Flyway schemas** (auth, tenant, profile, dns, location, notification, rewards, analytics, admin)
- **Total migrations:** ~100+ SQL files across all services
- Each service owns its schema; no cross-schema JOINs at the DB level (inter-service calls use HTTP)
- **Performance indexes:** Dedicated migration files (V*_performance_indexes.sql) in all 9 schemas
- **updated_at triggers:** Explicit trigger migrations in all schemas
- **Soft deletes:** User entity uses `@SQLDelete` + `@SQLRestriction("deleted_at IS NULL")`; ChildProfile has V10 soft-delete migration
- **BaseEntity:** UUID primary key (generated), tenant_id, created_at (audit), updated_at (audit)

### Notable Schema Patterns
- Tenant isolation via `tenant_id` column on BaseEntity (all entities inherit it)
- JSONB used for DNS allowlists/blocklists and schedule grids
- Analytics has partition-ready migrations (V7)

---

## 5. Top 10 Issues

### CRITICAL

**1. `Math.random()` used for OTP generation (Security)**  
`AuthService.java` lines 136, 160, 422, 484 and `InternalAuthController.java` use `Math.random()` for OTP and password generation. `Math.random()` uses a non-cryptographic PRNG and is predictable. Must use `java.security.SecureRandom`.  
*Files:* `shield-auth/src/main/java/.../service/AuthService.java`, `shield-auth/src/main/java/.../controller/InternalAuthController.java`

**2. Rate limiter IP resolution may be bypassed behind reverse proxy**  
`ipKeyResolver` in `GatewayConfig.java` uses `getRemoteAddress()` which returns the TCP peer address. Behind Nginx, this is always `127.0.0.1`. The resolver should read `X-Forwarded-For` or `X-Real-IP` header instead.  
*File:* `shield-gateway/src/main/java/.../config/GatewayConfig.java`

### HIGH

**3. Internal endpoints lack network-level protection**  
`/internal/**` is `permitAll()` in all service SecurityConfigs. While the gateway does not route these paths externally, there is no explicit firewall rule or Spring Security IP whitelist to prevent direct access if ports become exposed. A simple `hasIpAddress("127.0.0.1")` matcher would add defense-in-depth.  
*Files:* All SecurityConfig.java files

**4. Child token has 365-day expiry with no revocation mechanism**  
`JwtUtils.generateChildToken()` issues tokens valid for 1 year. The blacklist mechanism keys on `userId`, but child tokens use `profileId` as the subject. If a child profile is deleted or deactivated, the child token remains valid for up to a year.  
*File:* `shield-common/src/main/java/.../security/JwtUtils.java` line 52

**5. `ChildProfileService` uses `static final RestTemplate` for inter-service calls**  
A shared static `RestTemplate` instance without connection pooling configuration, timeouts, or retry logic. Should use a Spring-managed `RestClient` or `WebClient` bean with proper timeout and circuit breaker settings.  
*File:* `shield-profile/src/main/java/.../service/ChildProfileService.java` line 43

### MEDIUM

**6. Session revocation blacklists ALL tokens for the user, not just the session's**  
`revokeSession()` sets a Redis blacklist timestamp for the entire userId, invalidating tokens across ALL devices/sessions, not just the targeted session. This means revoking one session logs out every device.  
*File:* `shield-auth/src/main/java/.../service/AuthService.java` lines 766-779

**7. No `@Transactional(readOnly = true)` on read-only methods in AuthService**  
`listUsers()`, `getMe()`, `getSessions()` perform read-only queries but lack `@Transactional(readOnly = true)`, missing Hibernate dirty-checking optimizations and read-replica routing opportunities. Other services (89 occurrences across 33 files) do use it properly.  
*File:* `shield-auth/src/main/java/.../service/AuthService.java`

**8. `FetchType.EAGER` on `ProfileBadge.badge` relationship**  
Only one EAGER fetch found (`shield-rewards/.../entity/ProfileBadge.java:29`), but it will load the full Badge entity for every ProfileBadge query. Should be LAZY with explicit fetch join where needed.  
*File:* `shield-rewards/src/main/java/.../entity/ProfileBadge.java`

**9. Gateway Authorization header stripped but not re-added for service-to-service calls**  
`JwtAuthenticationFilter` removes the `Authorization` header before forwarding to downstream services (line 138). This is good for security, but means downstream services cannot verify token claims independently if needed, relying entirely on gateway-injected headers.  
*This is a design decision, not a bug -- but worth documenting as it creates a single point of trust.*

**10. Duplicate password generation logic**  
`generateRandomPassword()` is duplicated in `AuthService.java` (lines 208-227) and `InternalAuthController.java` (lines 127-143) with identical logic. Should be extracted to a shared utility.  
*Files:* `shield-auth/src/main/java/.../service/AuthService.java`, `shield-auth/src/main/java/.../controller/InternalAuthController.java`

---

## 6. Scalability Assessment

### Strengths
- **Stateless services:** No server-side session state; JWT + Redis enables horizontal scaling
- **Service registry:** Eureka with `lb://` URIs allows adding instances without config changes
- **Circuit breakers:** Resilience4j on all gateway routes with tuned thresholds (10-window, 50% failure rate)
- **Rate limiting:** Redis-backed token bucket scales across gateway instances
- **Connection pools:** HikariCP configured per-service (max 8, min 2) -- appropriate for current scale
- **Batch inserts:** Hibernate batch_size=25, ordered inserts/updates enabled
- **Schema separation:** Each service owns its schema, enabling independent scaling and migration

### Concerns
- **Single Redis instance:** No sentinel/cluster; Redis failure would disable rate limiting, blacklists, and refresh tokens
- **Single Eureka instance:** No peer replication configured; Eureka failure would prevent new service discovery
- **Synchronous inter-service HTTP calls:** `ChildProfileService` calls DNS provisioning synchronously; failures are caught but increase latency
- **No message queue:** Service-to-service communication is all HTTP; event-driven patterns (audit logging, notification dispatch) would benefit from RabbitMQ/Kafka
- **Analytics partitioning:** V7 migration prepares for partitioning but it's not clear if it's active

### Scaling Path
1. Redis Sentinel or Cluster for HA
2. Eureka peer awareness or switch to Kubernetes service discovery
3. RabbitMQ for async events (audit logs, notifications, DNS provisioning)
4. Read replicas for analytics-heavy queries
5. Connection pool tuning as load grows (current max 8 is conservative)

---

## 7. Top 5 Recommendations

1. **Replace `Math.random()` with `SecureRandom` in all OTP and password generation.** This is a cryptographic weakness. Create a shared `SecurityUtils.generateOtp()` and `SecurityUtils.generatePassword()` in shield-common using `SecureRandom`.

2. **Fix IP-based rate limiting behind Nginx.** Update `ipKeyResolver` to read `X-Forwarded-For` header (first hop), with fallback to `getRemoteAddress()`. Without this fix, all requests share one rate-limit bucket when behind the reverse proxy.

3. **Add IP whitelist for `/internal/**` endpoints.** Add a Spring Security `hasIpAddress("127.0.0.1/8")` restriction on internal endpoints as defense-in-depth, so that even if ports are accidentally exposed, internal APIs remain protected.

4. **Implement child token revocation.** Either key the blacklist on `profileId` for child tokens, or add a short-lived child token with refresh mechanism. A 365-day irrevocable token is a significant risk if a device is lost or a profile is deleted.

5. **Replace static `RestTemplate` with Spring-managed `RestClient` bean.** Configure connection timeouts, read timeouts, and connection pool settings. Consider making DNS provisioning async (fire-and-forget with retry queue) to reduce profile creation latency.

---

## Summary

The Shield platform demonstrates a well-structured microservices architecture with strong security fundamentals: JWT with blacklist revocation, MFA, bcrypt(12), brute-force protection, input validation, PII masking in logs, and audit logging via AOP. The codebase is consistent across 14 modules with shared patterns from shield-common.

The most urgent fix is replacing `Math.random()` with `SecureRandom` for OTP generation (Issue #1). The rate limiter IP bypass (Issue #2) should also be addressed before production traffic scales. All other issues are medium-priority improvements that would strengthen an already solid foundation.

**Overall assessment: GOOD -- production-ready with the two critical fixes above.**
