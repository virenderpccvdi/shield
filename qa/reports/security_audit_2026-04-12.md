# Shield Platform Security Audit Report
**Date:** 2026-04-12
**Auditor:** Automated Security Review (Claude)
**Scope:** OWASP Top 10 audit of Shield parental control platform
**Classification:** CONFIDENTIAL

---

## Executive Summary

The Shield platform demonstrates a solid security posture with proper JWT HS512 authentication, BCrypt-12 password hashing, Redis-backed token blacklisting, brute-force protection, and gateway-level rate limiting. However, this audit identified **3 critical**, **4 high**, and **5 medium** severity findings. The most urgent issues are: (1) `Math.random()` used for OTP generation instead of `SecureRandom`, making OTPs predictable; (2) the production JWT secret is hardcoded in multiple committed files (MEMORY.md, secrets-template, CI workflows, qa scripts); and (3) Kubernetes deployments lack `securityContext` constraints across all 15 services. For a platform handling children's location data and browsing patterns, these findings require immediate remediation.

---

## OWASP Top 10 Checklist

### A01:2021 — Broken Access Control

**Rating:** ⚠️ WARNING

**Strengths:**
- Gateway JWT filter (order -100) validates tokens before routing
- Redis blacklist revokes tokens on logout (epoch-second comparison)
- Role-based checks (GLOBAL_ADMIN, ISP_ADMIN, CUSTOMER) enforced in controllers
- Tenant isolation verified in ISP_ADMIN operations (callerTenantId vs targetTenantId)
- Authorization header stripped before forwarding to downstream services

**Findings:**
- **[HIGH] No `@PreAuthorize` annotations used anywhere** — all RBAC checks are manual string comparisons in controller methods (e.g., `if (!"GLOBAL_ADMIN".equals(role))`). This is error-prone and lacks compile-time enforcement. A single missed check grants unauthorized access.
- **[MEDIUM] Public-path header passthrough** — For public endpoints (login, register, etc.), the gateway calls `chain.filter(exchange)` without stripping incoming `X-User-Id`/`X-User-Role` headers. While downstream auth endpoints mostly ignore these, any new endpoint added to a public path could inadvertently trust injected headers.
- **[LOW] No Kubernetes NetworkPolicy** — No network policies found in k8s manifests, meaning any pod can communicate with any other pod in the cluster.

---

### A02:2021 — Cryptographic Failures

**Rating:** ❌ FAIL

**Findings:**
- **[CRITICAL] `Math.random()` used for OTP generation** — `AuthService.java` lines 136, 160, 422, 484 and `InternalAuthController.java` lines 131-135 use `Math.random()` (a PRNG) to generate 6-digit email verification OTPs, password-reset OTPs, and random passwords. `Math.random()` is not cryptographically secure and its output is predictable. The `MfaService` correctly uses `SecureRandom` — but the main auth flows do not.
  - **File:** `/var/www/ai/FamilyShield/shield-auth/src/main/java/com/rstglobal/shield/auth/service/AuthService.java`
  - **Impact:** An attacker could predict OTP values and take over accounts via password-reset or email-verification flows.

- **[HIGH] JWT secret exposed in committed files** — The production JWT secret (`7a9f3b2c...`) appears in:
  - `k8s/secrets/secrets-template.yaml` (line 28) — template comment includes the actual value
  - `.github/workflows/qa.yml` (lines 116, 212) — CI workflow
  - `qa/ci/start_services.sh` — QA startup script
  - `tasks/MASTER_PLAN.md` — planning document
  - While `.env` is gitignored, the secret itself is committed in other files. Anyone with repo read access can forge valid JWTs.

- **[MEDIUM] Fallback passwords in application.yml** — Several services use hardcoded fallback credentials:
  - `shield-eureka`: `${EUREKA_PASSWORD:ShieldEureka2026}`
  - `shield-location`: `password: changeme` (DB fallback)
  - `shield-location/notification`: `${RABBITMQ_PASSWORD:Shield@Rabbit2026}`
  - `config-repo/application.yml`: `${DB_PASSWORD:changeme}`

---

### A03:2021 — Injection

**Rating:** ✅ PASS (with notes)

**Strengths:**
- All JPA `@Query` native queries use parameterized bindings (`:param` or `?` positional)
- `JdbcTemplate.queryForObject` uses `?` parameter placeholders
- `entityManager.createNativeQuery` calls use `.setParameter()` for user-derived values
- No string concatenation of user input into SQL queries found

**Notes:**
- `PlatformController.queryCount()` uses hardcoded SQL strings with no user input — safe
- `TenantController.safeCount()` uses positional parameters — safe
- The `document.write()` in `AdminAnalyticsPage` writes static report HTML — low XSS risk
- React dashboard uses JSX (auto-escaped); only one `dangerouslySetInnerHTML` found in MUI vendor code (library-level, not app code)

---

### A04:2021 — Insecure Design

**Rating:** ⚠️ WARNING

**Findings:**
- **[MEDIUM] Password sent in plaintext via email** — `adminResetPassword()` (AuthService line 204) calls `notificationClient.sendAdminPasswordResetEmail(email, name, newPassword)` with the raw password. While this is admin-initiated, email is not a secure channel for credential delivery.
- **[LOW] 6-digit OTP with 24-hour TTL** — Verification and password-reset OTPs are 6-digit (1M combinations) with a 24-hour expiry window. Combined with the `Math.random()` weakness, this is exploitable.

---

### A05:2021 — Security Misconfiguration

**Rating:** ⚠️ WARNING

**Strengths:**
- CORS is properly restricted to `shield.rstglobal.in` (not `*`)
- CORS specifies exact allowed headers and methods
- `allowCredentials(true)` is set with a specific origin (not wildcard)
- Eureka discovery locator disabled (`enabled: false`) — no auto-exposure of services

**Findings:**
- **[CRITICAL] No `securityContext` in ANY Kubernetes deployment** — All 15 deployment manifests (auth, gateway, admin, dns, etc.) lack:
  - `runAsNonRoot: true`
  - `readOnlyRootFilesystem: true`
  - `allowPrivilegeEscalation: false`
  - Containers run as root by default, enabling container escape attacks.
  - **Files:** All `k8s/base/*/deployment.yaml`

- **[MEDIUM] Security headers missing from gateway** — The gateway does not add `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, or `Content-Security-Policy` response headers. These are configured in the K8s ingress annotations (`k8s/ingress/ingress-prod.yaml`) but not at the application level. Direct-access or non-K8s deployments lack protection.

- **[MEDIUM] Actuator endpoints exposed** — `/actuator/health` and `/actuator/info` are in `PUBLIC_PREFIXES`. While health checks are common, `/actuator/info` can leak version data.

---

### A06:2021 — Vulnerable and Outdated Components

**Rating:** ✅ PASS

- Spring Boot 4.0.5 (latest stable), Spring Security 7.0.4
- JJWT 0.13.0 (current)
- BCrypt cost factor 12 (strong)
- GitHub Security: 0 code scanning / 0 Dependabot / 0 secret scanning alerts (as of 2026-04-10)
- All 25 Dependabot PRs processed

---

### A07:2021 — Identification and Authentication Failures

**Rating:** ✅ PASS

**Strengths:**
- BCrypt with cost factor 12 for password hashing
- Constant-time comparison on login (dummy hash for non-existent emails prevents timing-based enumeration)
- Redis-backed brute-force protection: 5 attempts, 15-minute lockout per email
- Database-level account lock: 5 attempts, 30-minute lockout per user
- MFA support with TOTP (uses `SecureRandom` correctly)
- JWT access tokens expire in 1 hour, refresh tokens in 30 days
- Redis blacklist for token revocation on logout
- Password history tracking prevents reuse
- Email verification required before login

**Notes:**
- MFA is optional (not enforced for admin accounts — consider mandatory MFA for GLOBAL_ADMIN)

---

### A08:2021 — Software and Data Integrity Failures

**Rating:** ⚠️ WARNING

- **[LOW]** CI/CD pipeline uses hardcoded test JWT secret (not the production one, correctly differentiated with `ci-shield-test-only-` prefix)
- K8s secrets template instructs to base64-encode (not encrypt) — standard K8s, but consider sealed-secrets or external vault

---

### A09:2021 — Security Logging and Monitoring Failures

**Rating:** ✅ PASS

- Audit logging via `AuditClient` for login, registration, and sensitive operations
- Login records IP address and user agent
- Session tracking with fingerprint
- `AuditLoggingFilter` in gateway logs correlation IDs
- Prometheus (9190) + Grafana (3190) + Zipkin (9412) monitoring stack

---

### A10:2021 — Server-Side Request Forgery (SSRF)

**Rating:** ✅ PASS

- Inter-service communication uses Eureka service discovery (`lb://SERVICE-NAME`)
- No user-controlled URL parameters observed in backend services
- Internal endpoints (`/internal/**`) are network-restricted (not exposed via gateway public routes)

---

## Critical Findings Summary

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | CRITICAL | `Math.random()` for OTP/password generation | `shield-auth/../AuthService.java:136,160,422,484` |
| 2 | CRITICAL | JWT secret hardcoded in committed files | `k8s/secrets/secrets-template.yaml`, `.github/workflows/qa.yml`, `qa/ci/start_services.sh` |
| 3 | CRITICAL | No securityContext in K8s deployments | All 15 `k8s/base/*/deployment.yaml` files |
| 4 | HIGH | No `@PreAuthorize` — all RBAC is manual string checks | All `*Controller.java` files |
| 5 | HIGH | Fallback passwords in application.yml | `shield-eureka`, `shield-location`, `config-repo` |
| 6 | HIGH | Production DB/SMTP/Redis passwords in committed files | `shield-ai/`, `qa/ci/`, `infra/vector/` |
| 7 | MEDIUM | Public-path header passthrough (X-User-Id injection) | `JwtAuthenticationFilter.java:83-85` |
| 8 | MEDIUM | Plaintext password sent via email | `AuthService.java:204` |
| 9 | MEDIUM | No security response headers at gateway level | `shield-gateway` |
| 10 | MEDIUM | Actuator /info exposed publicly | `JwtAuthenticationFilter.java:55` |
| 11 | MEDIUM | No Kubernetes NetworkPolicy | `k8s/` directory |

---

## Secrets Exposure Check

| Secret Type | In .env (gitignored) | Exposed in Committed Files |
|-------------|---------------------|---------------------------|
| JWT Secret | Yes | YES — secrets-template.yaml, qa.yml, MASTER_PLAN.md, MEMORY.md |
| DB Password | Yes | YES — shield-ai/db/database.py, qa/ci/start_services.sh |
| SMTP Password | Yes | YES — qa/ci/start_services.sh |
| Redis Password | Yes | YES — qa/ci/start_services.sh |
| Eureka Password | Yes | YES — application.yml fallback defaults |
| RabbitMQ Password | Yes | YES — application.yml fallback defaults |
| Stripe Keys | Yes | No (only in .env) |
| API Keys (Anthropic/DeepSeek) | Yes | No (only in .env) |
| Google Maps API Key | Yes | No (loaded via env vars in dashboard/.env, Flutter local.properties) |
| Admin Password | N/A | YES — MEMORY.md (committed in .claude/ directory) |

---

## Recommendations (Ranked by Severity)

### Critical (Fix Immediately)

1. **Replace `Math.random()` with `SecureRandom`** in `AuthService.java` and `InternalAuthController.java` for all OTP and password generation. The `MfaService` already has the correct pattern to follow.

2. **Rotate the JWT secret immediately** — the current secret is exposed in git history. After rotation:
   - Remove the plaintext value from `k8s/secrets/secrets-template.yaml`
   - Replace CI values with distinct test-only secrets
   - Use `git filter-branch` or BFG to purge from history if the repo is shared

3. **Add `securityContext` to all K8s deployments:**
   ```yaml
   securityContext:
     runAsNonRoot: true
     runAsUser: 1000
     readOnlyRootFilesystem: true
     allowPrivilegeEscalation: false
   ```

### High (Fix This Sprint)

4. **Adopt `@PreAuthorize` annotations** for role enforcement instead of manual string comparison. This provides compile-time guarantees and centralized policy management.

5. **Remove all fallback passwords from application.yml** — require env vars with no defaults for all credentials. Services should fail to start if secrets are missing.

6. **Audit and remove hardcoded credentials** from `shield-ai/db/database.py`, `qa/ci/start_services.sh`, and `infra/vector/refresh_client_profiles.sh`. Use env var references only.

### Medium (Fix This Month)

7. **Strip X-User-* headers on public paths** — add header removal in the `isPublic()` branch of `JwtAuthenticationFilter`.

8. **Add security response headers** at the gateway level (HSTS, X-Frame-Options, CSP, X-Content-Type-Options) — do not rely solely on nginx/ingress config.

9. **Send password-reset links instead of plaintext passwords** in admin-initiated reset flow.

10. **Restrict actuator /info endpoint** — remove it from PUBLIC_PREFIXES or disable the info endpoint.

11. **Add Kubernetes NetworkPolicies** to restrict inter-pod communication to only required paths.

12. **Enforce MFA for GLOBAL_ADMIN accounts** — admin accounts have the highest privilege and should require a second factor.

---

*End of Report*
