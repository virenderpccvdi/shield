# Shield Project — Lessons Learned

> Updated after each correction. Review at session start for relevant context.

---

## DB / Schema

### L01 — DB constraints must match codebase enums (2026-04-07)
**Mistake:** `chk_child_filter_level` constraint had old values (`STRICT/MODERATE/PERMISSIVE`) but code sent `RELAXED` → 500 on PUT /profiles/children/{id}.
**Rule:** When adding or renaming enum values in DTOs/entities, ALWAYS add a Flyway migration that updates the corresponding CHECK constraint in the same PR.
**Check:** `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'chk_...'` before assuming constraint matches code.

### L02 — Flyway autoconfiguration removed in Spring Boot 4.x
**Mistake:** Boot 4.x removed Flyway autoconfigure — services failed to migrate on first boot.
**Rule:** Every service pom.xml needs `flyway-core` (compile) + `flyway-database-postgresql` (runtime) + manual `FlywayConfig.java` with `repair()` then `migrate()` + `JpaFlywayConfig.java` for JPA ordering.

### L03 — @Builder on subclasses of BaseEntity loses parent fields
**Mistake:** `@Builder` doesn't generate builder method for `tenantId` (parent field).
**Rule:** After building with `@Builder`, always set parent-class fields with setters: `entity.setTenantId(...)`.

---

## API / Endpoints

### L04 — Auth interceptor already unwraps ApiResponse (2026-03-30)
**Mistake:** Added double-unwrap code `raw['data']` to all screens, not realizing `auth_interceptor.dart` onResponse already strips the `{success, data}` wrapper.
**Rule:** In Flutter, `resp.data` after a successful call already IS the inner data object. Use `(raw['data'] as Map?) ?? raw` pattern as safe fallback only. Never double-unwrap.

### L05 — Mobile endpoint paths must match backend controller prefixes exactly
**Mistake:** 12+ endpoints in `endpoints.dart` had wrong paths (e.g. `/api/v1/dns/schedule` vs `/dns/schedules/{id}`). Gateway strips `/api/v1/` prefix before routing.
**Rule:** When adding/changing backend controller `@RequestMapping`, immediately update `endpoints.dart` to match. Gateway route config is the source of truth for path prefix.

### L06 — Schedule save format is 24-slot hourly grid, not {startTime, endTime}
**Mistake:** `schedule_screen.dart` sent `{monday: {enabled, startTime, endTime}}` but backend `UpdateScheduleRequest` expects `{grid: {monday: [0,1,...24 ints]}}` where 1=blocked, 0=allowed.
**Rule:** Always read the Java DTO before writing the Flutter save payload. Check field names, types, and nesting.

---

## Flutter / GoRouter

### L07 — Logout requires explicit context.go(), not just state change (2026-03-30)
**Mistake:** Setting `state = AuthState.unauthenticated` alone was not reliably triggering GoRouter redirect.
**Rule:** After `logout()`, always call `context.go('/login')` explicitly. Don't rely solely on `refreshListenable` to navigate — it can miss frames or be delayed.

### L08 — Login screen overflow from bottom home indicator
**Mistake:** `SingleChildScrollView` had fixed `padding: EdgeInsets.fromLTRB(24,32,24,24)` — no bottom inset → 21px overflow on devices with home indicator.
**Rule:** Bottom padding in scroll views must include `MediaQuery.of(context).padding.bottom`. Never hardcode bottom inset.

### L09 — SafeArea must go OUTSIDE the gradient container, not inside
**Mistake:** `_BrandHeader` had `SafeArea` inside a fixed `height: 220` container. Gradient must extend behind status bar; SafeArea should only push content, not constrain the container.
**Rule:** Use `height: 220 + MediaQuery.of(context).padding.top` for gradient headers, with `Padding(top: padding.top)` inside for content offset. Or keep SafeArea inside but make it clear the height includes the inset.

---

## Spring Boot / Java

### L10 — @SpringBootApplication needs explicit scanBasePackages for shield-common
**Mistake:** `GlobalExceptionHandler` in `shield-common` was not picked up without `scanBasePackages = "com.rstglobal.shield"`.
**Rule:** Every service main class: `@SpringBootApplication(scanBasePackages = "com.rstglobal.shield")`.

### L11 — Spring Cloud Gateway 5.x property prefix changed
**Mistake:** Used `spring.cloud.gateway.routes` — no longer valid in Boot 4.x / SC 5.x.
**Rule:** Use `spring.cloud.gateway.server.webflux.routes` (and `.default-filters`, `.discovery.locator.enabled`).

### L12 — ShieldException constructor order
**Rule:** `ShieldException(String errorCode, String message, HttpStatus status)`. Use helpers: `.conflict()`, `.forbidden()`, `.badRequest()`, `.notFound(resource, id)`.

---

## Infrastructure / DevOps

### L13 — Port 8285 orphaned process causes startup failure
**Mistake:** `systemctl start shield-location` fails if a previous process still holds port 8285.
**Rule:** Before starting location service: `lsof -ti :8285 | xargs kill -9 2>/dev/null || true`.

### L14 — Systemd services must use User=root, not www-data
**Mistake:** Services using `User=www-data` couldn't access `/var/www/ai/FamilyShield/.env` or write logs.
**Rule:** All Shield systemd units use `User=root`, `EnvironmentFile=/var/www/ai/FamilyShield/.env`.

### L15 — nginx 1.24 uses `listen 443 ssl http2;` not `http2 on;`
**Mistake:** `http2 on;` directive is not supported in nginx 1.24.0.
**Rule:** Use `listen 443 ssl http2;` syntax.

---

## Process

### L16 — Verify DB constraint before assuming enum values are valid
**Pattern:** Always run `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname LIKE '%filter%'` when adding new enum values.

### L17 — Check service logs FIRST on 500/503 errors
**Pattern:** `journalctl -u shield-{service} -n 50 --no-pager | tail -60` immediately surfaces root cause. Don't guess at code before reading logs.

---

## Android VPN / DoH

### L18 — VPN DoH forwarding must NOT resolve hostname inside the tunnel (2026-04-07)
**Mistake:** `InetSocketAddress(u.host, port)` in `ShieldVpnService.openProtectedConnection()` triggers OS DNS resolution. But the VPN is already running, so that DNS query goes through the fake DNS (10.111.0.2) → intercepted by the proxy → calls `forwardToDoh()` again → infinite recursive loop → ALL DNS timeouts → no websites load.
**Rule:** Always pre-resolve the DoH server IP BEFORE calling `builder.establish()` (while normal DNS still works). Cache as `dohServerIp`. Use `InetSocketAddress(serverIp, port)` for socket connect. Keep hostname only for `sslFactory.createSocket(rawSocket, u.host, ...)` so TLS SNI and cert verification work.
**How to apply:** Any time a VPN service needs to make an outbound HTTPS connection, the target hostname must be resolved before the tunnel is up.

### L19 — Stale sentinel flags in dns.dns_rules block all internet (2026-04-07)
**Mistake:** `__budget_exhausted__: true` was stuck in Disha's `enabled_categories` JSONB even though `daily_budget_minutes` was NULL (no budget configured). This AdGuard sync flag was set incorrectly and never cleared.
**Rule:** After clearing/disabling a time budget feature, always verify the corresponding sentinel flag is also cleared: `SELECT enabled_categories->>'__budget_exhausted__' FROM dns.dns_rules WHERE profile_id = '...'`. If stuck, clear via direct SQL update.
