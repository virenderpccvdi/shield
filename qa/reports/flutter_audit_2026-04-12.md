# Shield Flutter App Audit Report

**Date:** 2026-04-12  
**Auditor:** Claude Opus 4.6  
**App version:** 2.0.0+200  
**Flutter:** 3.41 / Dart >=3.7.0  

---

## 1. Architecture Overview

The app follows a clean feature-based architecture:

```
lib/
  app/          - app.dart, router.dart, theme.dart
  core/
    api/        - ApiClient (Dio singleton), AuthInterceptor, Endpoints
    constants.dart
    models/     - auth_state, child_profile, device_model, alert_model
    providers/  - auth_provider, theme_provider
    services/   - background_service, dns_vpn_service, fcm_service, storage_service
    widgets/    - common_widgets.dart (design system components)
  features/
    admin/      - dashboard, customers, tenants, analytics, settings (ShellRoute)
    auth/       - login, register, forgot_password
    child/      - home, tasks, rewards, ai_chat
    onboarding/ - onboarding_screen
    parent/     - dashboard, family, map, alerts, settings + 15 sub-screens (ShellRoute)
    setup/      - child_setup_screen
    splash/     - splash_screen
```

**Native Kotlin layer** (5 files):
- `MainActivity.kt` - MethodChannel bridge (VPN + App Blocker)
- `ShieldVpnService.kt` - Local TUN VPN for DoH DNS filtering
- `AppBlockerService.kt` - UsageStats polling (800ms) foreground service
- `BlockedAppActivity.kt` - Full-screen block UI (replaces overlay)
- `ShieldAccessibilityService.kt` - Legacy overlay blocker (unused in manifest)

**Routing:** GoRouter with Riverpod-driven redirect. Four auth states: loading, unauthenticated, parent, child. Role-based routing (CUSTOMER -> parent shell, ADMIN -> admin shell, child -> locked child shell).

---

## 2. Dependency Health

| Package | Pinned | Status |
|---------|--------|--------|
| flutter_riverpod | ^2.6.1 | **OUTDATED** - Riverpod 3.x exists (blocked per memory); functional but old API |
| go_router | ^14.6.2 | **OUTDATED** - 15+ exists (blocked per memory); OK for now |
| dio | ^5.8.0 | Current |
| http | ^1.2.2 | **Redundant** - dio is used everywhere; http is unused |
| flutter_secure_storage | ^9.2.4 | Current |
| firebase_core/messaging | ^3.12.1/^15.2.4 | Current |
| google_maps_flutter | ^2.17.0 | Current |
| geolocator | ^13.0.2 | Current |
| flutter_background_service | ^5.0.0 | Current |
| installed_apps | ^1.4.0 | Current |
| mobile_scanner | ^5.2.3 | Current |
| battery_plus | ^6.0.3 | Current |
| hive_flutter | ^1.1.0 | **Unused** - not imported anywhere in lib/ |
| crypto | ^3.0.6 | **Unused** - not imported anywhere in lib/ |
| shimmer | ^3.0.0 | **Unused** - not imported anywhere in lib/ |

**Key blocked upgrades** (per project memory): riverpod 3, go_router 15+. These are intentionally held back.

---

## 3. Native Integration Assessment

### VPN DNS Service (ShieldVpnService.kt) - GOOD
- Proper TUN interface intercepting UDP port 53
- Pre-resolves DoH server IP before establishing tunnel (avoids DNS loop)
- Uses `protect()` on raw sockets to exclude DoH traffic from VPN
- Blocks known public DoH IPs (Google, Cloudflare, Quad9, OpenDNS) to force DNS through tunnel
- Correct HTTP/1.1 raw socket implementation with TLS SNI

### App Blocker (AppBlockerService.kt) - GOOD
- UsageStats polling every 800ms (not AccessibilityService - good choice)
- Launches BlockedAppActivity (full-screen) instead of TYPE_APPLICATION_OVERLAY
- 2-second throttle prevents repeated launches for same blocked app
- SharedPreferences for blocked package list (accessible from service)

### Background Service (background_service.dart) - ACCEPTABLE
- Heartbeat every 5min, location every 10min, app sync every 1hr
- Uses SharedPreferences (not FlutterSecureStorage) for background isolate - correct, since FSS is unavailable in isolates
- Token stored in SharedPreferences for background access

### FCM (fcm_service.dart) - GOOD
- Proper background handler with @pragma('vm:entry-point')
- Foreground notifications via flutter_local_notifications
- Deep link routing by notification type (GEOFENCE, SOS, BEDTIME, etc.)

---

## 4. Top 10 Issues Found

### CRITICAL

**1. SSL Certificate Pinning is Inverted (Security)**  
`api_client.dart` line 38-43: The `badCertificateCallback` returns `true` when the host matches the pinned domain, but this callback is only invoked for **bad** certificates. Returning `true` means "accept bad certificates for our domain." This effectively disables SSL validation for the Shield API while rejecting bad certs for other hosts. The logic should be: **always return false** from this callback (reject bad certs), and implement actual certificate pinning separately by comparing the certificate fingerprint.

**2. Child Token Stored in SharedPreferences (Security)**  
`background_service.dart` line 104-108: The child JWT token is copied to plain SharedPreferences (`shield_bg_token`) for background isolate access. SharedPreferences on Android is stored as an unencrypted XML file in the app's data directory. A rooted device or ADB backup could extract the token. Consider using EncryptedSharedPreferences or a native KeyStore bridge.

**3. Refresh Token Race Condition**  
`auth_interceptor.dart` line 74-117: When multiple API calls fail with 401 simultaneously, each one independently attempts a token refresh. This creates a race condition where multiple refresh requests hit the server, potentially invalidating tokens. Need a mutex/lock so only the first 401 triggers a refresh, and others wait for the result.

### HIGH

**4. AppBlockerService Foreground Service Type Mismatch**  
`AndroidManifest.xml` line 74: `AppBlockerService` uses `foregroundServiceType="dataSync"` but it performs UI monitoring, not data synchronization. Android 14+ enforces foreground service type restrictions. This should be `specialUse` with a PROPERTY_SPECIAL_USE_FGS_SUBTYPE explanation, similar to the VPN service.

**5. ShieldAccessibilityService Dead Code**  
`ShieldAccessibilityService.kt` exists (241 lines) but is NOT registered in AndroidManifest.xml. It uses `TYPE_APPLICATION_OVERLAY` which requires `SYSTEM_ALERT_WINDOW` permission (not declared). This is dead code that should be removed to reduce attack surface and APK size.

**6. Retry Dio Instance Bypasses SSL Pinning**  
`auth_interceptor.dart` line 101: The retry after token refresh uses `Dio(BaseOptions(baseUrl: AppConstants.baseUrl))` - a fresh Dio instance without the SSL pinning configuration from ApiClient. The refresh Dio (line 75) has the same problem. All network calls should go through ApiClient.

**7. Background Service Token Never Refreshes**  
The background isolate stores a token in SharedPreferences at setup time but has no refresh mechanism. When the child token expires, heartbeat/location/app-sync silently fail forever. The background service should detect 401s and attempt token refresh or notify the foreground.

### MEDIUM

**8. Three Unused Dependencies**  
`hive_flutter`, `crypto`, and `shimmer` are declared in pubspec.yaml but never imported. The `http` package is also redundant since Dio handles all HTTP. These inflate the APK and increase dependency risk.

**9. Spawning Unbounded Threads in VPN Proxy**  
`ShieldVpnService.kt` line 190: Each DNS query spawns a new `Thread()`. Under heavy DNS load this could create hundreds of threads. Should use a thread pool (`Executors.newFixedThreadPool`) with a bounded size.

**10. No Offline Error Differentiation**  
API errors fall through to a generic "Something went wrong" message (`auth_provider.dart` line 316). While network-specific errors are caught (timeout, connection error), server errors (500, 502, 503) show the generic message. Users cannot tell if Shield servers are down vs. a local issue.

---

## 5. State Management Review

**Pattern:** Riverpod 2.x with `StateNotifierProvider` for auth and `FutureProvider.autoDispose` for screen-level data.

**Strengths:**
- Auth state is centralized in a single `AuthNotifier` (StateNotifier)
- GoRouter redirect is wired to auth changes via `ChangeNotifier` bridge
- Screen-level providers use `autoDispose` correctly (no memory leaks)
- `AsyncValue.when()` pattern used consistently for loading/error/data states
- `ref.invalidate()` for pull-to-refresh is idiomatic

**Weaknesses:**
- **No dedicated providers for most features.** Screens like DashboardScreen define private `FutureProvider`s inline (e.g., `_dashChildrenProvider`). This means the data cannot be shared or invalidated from other screens.
- **ApiClient.instance used directly in providers** instead of being injected. This makes testing difficult.
- **No repository layer.** Providers call ApiClient directly, mixing network concerns with state management.
- **StateNotifier is legacy.** Riverpod 2.x introduced Notifier/AsyncNotifier as preferred patterns. The codebase uses the older StateNotifier API exclusively.

**Consistency:** Good. All screens follow the same pattern: FutureProvider + .when() + ErrorView/EmptyView. The common_widgets.dart component library enforces visual consistency.

---

## 6. Top 5 Recommendations

1. **Fix SSL pinning logic immediately.** The current `badCertificateCallback` does the opposite of what's intended. Replace with proper certificate fingerprint comparison or use a package like `http_certificate_pinning`.

2. **Add a token refresh mutex.** Wrap the 401 refresh logic in a Completer-based lock so concurrent requests share a single refresh attempt. This prevents token invalidation cascades.

3. **Remove dead code and unused dependencies.** Delete `ShieldAccessibilityService.kt`, remove `hive_flutter`, `crypto`, `shimmer`, and `http` from pubspec.yaml. This reduces APK size and maintenance burden.

4. **Introduce a repository layer.** Create `lib/core/repositories/` with classes like `ChildRepository`, `DnsRepository`, etc. that encapsulate API calls. Inject these into providers instead of calling `ApiClient.instance` directly. This enables unit testing and reduces coupling.

5. **Implement background token refresh.** The background service should detect 401 responses and either refresh the token using a stored refresh token, or send a local notification prompting the user to re-authenticate. Currently, expired tokens cause silent failure of all background operations.
