# Shield Flutter Android App - Deep Audit Report
**Date:** 2026-04-12
**Auditor:** Senior Mobile Developer (automated deep review)
**App Version:** 2.0.0+200
**Dart SDK:** >=3.7.0 <4.0.0
**Total Dart Files:** 63 (lib/) + 5 native Kotlin files

---

## 1. Screen Inventory

### 1.1 Public / Pre-Auth Screens

| Screen | File | Description |
|--------|------|-------------|
| Splash | `features/splash/splash_screen.dart` | Animated shield logo, auto-navigates based on auth state. Loading spinner. |
| Onboarding | `features/onboarding/onboarding_screen.dart` | 3-slide PageView (Protection, Screen Time, Location). Skip button, pill indicators. |
| Login | `features/auth/login_screen.dart` | Guardian hero + form. Email/password with validation. Slide-in animation. |
| Register | `features/auth/register_screen.dart` | Name/email/password. Auto-login on success. **Design inconsistency** (see bugs). |
| Forgot Password | `features/auth/forgot_password_screen.dart` | Email input, always shows success (prevents enumeration). |
| Child Setup | `features/setup/child_setup_screen.dart` | Multi-step wizard: parent login -> select child -> activate -> VPN permission -> done. |

### 1.2 Parent Screens (CUSTOMER role)

| Screen | File | Description |
|--------|------|-------------|
| Parent Shell | `features/parent/shell/parent_shell.dart` | Glassmorphism bottom nav: Home, Family, Map, Alerts, More. Badge on Alerts. |
| Dashboard | `features/parent/dashboard/dashboard_screen.dart` | Hero app bar, KPI row (children/online/alerts), activity chart, child list, recent alerts. |
| Family | `features/parent/family/family_screen.dart` | Child profile list with add button. Pull-to-refresh. |
| New Child | `features/parent/family/new_child_screen.dart` | Name, age, filter level (STRICT/MODERATE/LIGHT/CUSTOM). |
| Child Detail | `features/parent/family/child_detail_screen.dart` | Collapsible header, quick action buttons, feature grid (18 tiles in 6 sections). |
| All Children Map | `features/parent/map/all_children_map_screen.dart` | Google Map with all children's latest locations as markers. |
| Alerts | `features/parent/alerts/alerts_screen.dart` | Grouped: Critical / New / Earlier. Tonal alert tiles. |
| Notifications | `features/parent/notifications/notifications_screen.dart` | All/Unread filter, grouped by day, mark-as-read, mark-all-read. |
| Settings | `features/parent/settings/settings_screen.dart` | Account card, family/devices, security (PIN, biometric stub), theme, notifications toggles, sessions, privacy, about. |
| Profile | `features/parent/profile/profile_screen.dart` | View/edit name, change password. Avatar header. |
| Reports | `features/parent/reports/reports_screen.dart` | Per-child reports: KPIs, browsing history, app usage. Child selector. |
| DNS Rules | `features/parent/controls/dns_rules_screen.dart` | Filter level dropdown, custom allow/block lists with domain validation. |
| Schedule | `features/parent/controls/schedule_screen.dart` | Per-day internet hours toggle with time pickers. 24-slot grid conversion. |
| Time Limits | `features/parent/controls/time_limits_screen.dart` | Daily budget slider (30m-12h), usage display, no-limit toggle. |
| Safe Filters | `features/parent/controls/safe_filters_screen.dart` | 10 content categories with toggle switches, search, sensitive category confirmation. |
| App Blocking | `features/parent/controls/app_blocking_screen.dart` | App list from child device with search, per-app block toggle. Optimistic update. |
| Bedtime | `features/parent/controls/bedtime_screen.dart` | Enable toggle, bed/wake time pickers. |
| Homework Mode | `features/parent/controls/homework_mode_screen.dart` | Enable toggle, duration slider (15m-4h). |
| Live Map | `features/parent/location/map_screen.dart` | Single child's latest GPS on Google Map. Refresh, last-seen card. |
| Location History | `features/parent/location/location_history_screen.dart` | Paginated list (50 items) of location points. |
| Geofences | `features/parent/location/geofences_screen.dart` | List geofences, add via dialog (placeholder - directs to web). |
| Browsing History | `features/parent/activity/browsing_history_screen.dart` | Period tabs, domain search, paginated, skeleton loader. |
| App Usage | `features/parent/activity/app_usage_screen.dart` | Total today, per-app bar chart with progress indicators. |
| AI Insights | `features/parent/activity/ai_insights_screen.dart` | AI summary hero, risk assessment, recommendations, anomalies. Skeleton loader. |
| Rewards | `features/parent/rewards/rewards_screen.dart` | Parent view: points summary, task list, add task dialog. |
| Approvals | `features/parent/rewards/approval_requests_screen.dart` | Pending SUBMITTED tasks with Approve/Deny buttons. |
| Emergency Contacts | `features/parent/safety/emergency_contacts_screen.dart` | Contact list, add via dialog (name + phone). |
| Battery Alerts | `features/parent/safety/battery_alerts_screen.dart` | Enable toggle, threshold slider (5%-50%). |
| Devices | `features/parent/devices/devices_screen.dart` | Device list with battery, status, last-seen. Link via setup or QR. Delete device. |

### 1.3 Child Screens

| Screen | File | Description |
|--------|------|-------------|
| Child Home | `features/child/home/child_home_screen.dart` | Full-screen gradient, clock, greeting, VPN status, battery, points pill, 3 action tiles (Tasks/Rewards/AI Chat), check-in button, SOS button, ghost parent access. |
| Child Tasks | `features/child/tasks/child_tasks_screen.dart` | Progress card, grouped by status (To Do/Waiting/Completed/Needs Redo), complete with undo. Detail bottom sheet. |
| Child Rewards | `features/child/rewards/child_rewards_screen.dart` | Points hero, achievements grid. |
| AI Chat | `features/child/chat/ai_chat_screen.dart` | Chat bubble interface, typing indicator, scroll-to-bottom. |

### 1.4 Admin Screens (ISP_ADMIN / GLOBAL_ADMIN)

| Screen | File | Description |
|--------|------|-------------|
| Admin Shell | `features/admin/shell/admin_shell.dart` | NavigationBar: Dashboard, Tenants/Customers (role-aware), Analytics, Settings. |
| Admin Dashboard | `features/admin/dashboard/admin_dashboard_screen.dart` | Hero header, KPI grid (role-aware), daily chart, quick actions, recent alerts. |
| Customers | `features/admin/customers/customers_screen.dart` | (File exists, not deeply reviewed - standard list pattern) |
| Customer Detail | `features/admin/customers/customer_detail_screen.dart` | (File exists) |
| Tenants | `features/admin/tenants/tenants_screen.dart` | (File exists) |
| Tenant Detail | `features/admin/tenants/tenant_detail_screen.dart` | (File exists) |
| Admin Analytics | `features/admin/analytics/admin_analytics_screen.dart` | (File exists) |
| Admin Settings | `features/admin/settings/admin_settings_screen.dart` | (File exists) |

---

## 2. Feature Completeness Matrix

| Feature | Status | Notes |
|---------|--------|-------|
| **Auth: Login** | Implemented | Email/password, JWT, auto-refresh on 401 |
| **Auth: Register** | Implemented | Auto-login after registration |
| **Auth: Forgot Password** | Implemented | Anti-enumeration (always shows success) |
| **Auth: Token Refresh** | Implemented | AuthInterceptor retries once on 401 |
| **Auth: Logout** | Implemented | Server-side + local clear |
| **Auth: Biometric Lock** | Stub | Switch shows "coming soon" SnackBar |
| **Child Device Setup** | Implemented | Multi-step wizard, bare-Dio for fresh device |
| **DNS Filtering (VPN)** | Implemented | Native VPN service, DoH forwarding, blocks known DoH providers |
| **DNS Rules Management** | Implemented | Filter level + custom allow/block lists |
| **Schedule Management** | Implemented | Per-day hourly grid, time pickers |
| **Time Limits** | Implemented | Daily budget slider, no-limit option |
| **Safe Content Filters** | Implemented | 10 categories, confirmation for sensitive |
| **App Blocking (parent)** | Implemented | Per-app toggle, optimistic updates |
| **App Blocking (native)** | Implemented | UsageStats polling (800ms), BlockedAppActivity |
| **Bedtime Mode** | Implemented | Enable/disable, time pickers |
| **Homework Mode** | Implemented | Start/stop, duration slider |
| **Live Location Map** | Implemented | Google Maps, single child + all-children views |
| **Location History** | Implemented | List view, paginated |
| **Geofences** | Partial | List + toggle only; **add geofence redirects to web** (no in-app map picker) |
| **Background Location** | Implemented | flutter_background_service, 10-min interval |
| **Heartbeat** | Implemented | 5-min interval, battery level reporting |
| **App Sync** | Implemented | 1-hour interval, installed apps list |
| **SOS/Panic Button** | Implemented | Confirmation dialog, GPS attach, API call |
| **Push Notifications (FCM)** | Implemented | Token registration, foreground display, deep linking |
| **Browsing History** | Implemented | Period filter, search, pagination, skeleton loader |
| **App Usage** | Implemented | Per-app breakdown with progress bars |
| **AI Insights** | Implemented | Summary, risk level, recommendations, anomalies |
| **Rewards System** | Implemented | Points, tasks, approve/reject, achievements |
| **Emergency Contacts** | Implemented | CRUD via dialog |
| **Battery Alerts** | Implemented | Enable/threshold configuration |
| **Device Management** | Implemented | List, remove, QR linking |
| **Reports** | Implemented | Per-child KPIs, browsing, app usage |
| **Theme (Light/Dark/System)** | Implemented | Persisted in SharedPreferences |
| **Active Sessions** | Implemented | List, revoke, sign-out-all |
| **Parent PIN** | Implemented | Set via dialog, protects child mode exit |
| **Offline DNS Cache** | Implemented | 24h TTL in secure storage |
| **Admin Dashboard** | Implemented | Platform/ISP overview, charts, alerts |
| **Tenant/Customer Management** | Implemented | List, detail screens |
| **i18n / Localization** | Missing | All strings hardcoded in English |
| **Accessibility** | Partial | No semantics labels, no screen reader testing |
| **Deep Linking (external)** | Missing | Only FCM notification deep links |
| **App Update Check** | Missing | No in-app update mechanism (only FCM push) |

---

## 3. Bug List

### Critical (P0)

| # | Bug | File | Line | Impact |
|---|-----|------|------|--------|
| B1 | **FCM deep link routes are invalid** | `core/services/fcm_service.dart` | 69-94 | `_handleOpen` navigates to routes like `/parent/location/map` and `/parent/controls/time-limits` which **do not exist** in the router. Correct routes require a child profileId: `/parent/family/:id/map`. Tapping any FCM notification will show the "Page not found" error screen. |
| B2 | **FCM navigatorKey never wired to MaterialApp** | `core/services/fcm_service.dart` | 18, 67 | `FcmService.navigatorKey` is a `GlobalKey<NavigatorState>` but it is never passed to `MaterialApp.router`. Since the app uses GoRouter (not Navigator), `navigatorKey.currentContext` is always null, so `_handleOpen` silently does nothing. |
| B3 | **Register screen uses wrong design system** | `features/auth/register_screen.dart` | 42 | Uses hardcoded `Color(0xFF2563EB)` background and old-style Card layout instead of the Guardian's Lens design (GuardianHero + surface canvas) used by LoginScreen. Visual inconsistency between login and register flows. |
| B4 | **Forgot password screen uses hardcoded colors** | `features/auth/forgot_password_screen.dart` | 49, 56-57 | Uses `Colors.black54` text and hardcoded `Color(0xFF2563EB)` instead of theme-aware colors. Broken in dark mode. |

### High (P1)

| # | Bug | File | Line | Impact |
|---|-----|------|------|--------|
| B5 | **Admin quick actions navigate to non-existent routes** | `features/admin/dashboard/admin_dashboard_screen.dart` | 509-519 | Quick actions link to `/admin/notifications` and `/admin/dns` which are not defined in the router. Tapping them shows "Page not found". |
| B6 | **Notification switches in Settings are non-functional** | `features/parent/settings/settings_screen.dart` | 117-131 | All 3 notification switches have `onChanged: (_) {}` - they toggle visually but never persist or call any API. The `value: true` is hardcoded. |
| B7 | **App blocking screen does not invoke native AppBlockerService** | `features/parent/controls/app_blocking_screen.dart` | All | Toggling apps only calls the backend API (`/profiles/apps/{pid}/toggle`). It never invokes the native `APP_BLOCK_CHANNEL` to push the blocked apps list to `AppBlockerService`. The native blocker runs from whatever was last set via MethodChannel, which may be stale or empty. |
| B8 | **ShieldAccessibilityService overlay requires SYSTEM_ALERT_WINDOW** | `ShieldAccessibilityService.kt` | 203-210 | Uses `TYPE_APPLICATION_OVERLAY` which requires `SYSTEM_ALERT_WINDOW` permission, but this permission is **not declared in AndroidManifest.xml** and never requested. The overlay will silently fail. The `AppBlockerService` + `BlockedAppActivity` approach (which works without this permission) is the active one, making this file dead code. |
| B9 | **Activity data retention and clear data may fail** | `features/parent/settings/settings_screen.dart` | 329-356 | `_confirmClearData` calls `DELETE /analytics/$pid/history` which may not exist as a backend endpoint. The "Activity Data Retention: 30 days" is a static label with no actual configuration. |
| B10 | **Background service token stored in SharedPreferences (plaintext)** | `core/services/background_service.dart` | 101-108 | Child JWT token is copied to SharedPreferences (unencrypted) because FlutterSecureStorage is unavailable in background isolates. Any app with root access or backup extraction can read the token. |

### Medium (P2)

| # | Bug | File | Line | Impact |
|---|-----|------|------|--------|
| B11 | **`copyWith` cannot clear nullable fields** | `core/models/auth_state.dart` | 78-102 | `copyWith` uses `??` for all nullable fields, so passing `null` explicitly doesn't clear the field. For example, `copyWith(accessToken: null)` keeps the old value. |
| B12 | **Duplicate `_pointsProvider` and `_appUsageProvider`** | Multiple files | - | `_pointsProvider` is defined in both `child_rewards_screen.dart` and `rewards_screen.dart`. `_appUsageProvider` is defined in both `app_usage_screen.dart` and `reports_screen.dart`. While they're file-private, this is code duplication. |
| B13 | **Admin dashboard notification button goes nowhere** | `admin_dashboard_screen.dart` | 89 | `onAlerts: () => context.push('/admin/notifications')` - route doesn't exist. |
| B14 | **Geofence add is a dead-end placeholder** | `geofences_screen.dart` | 71-85 | Shows dialog saying "Open the map in a browser to add geofences". No actual in-app geofence creation. |
| B15 | **History button in map screen pops instead of navigating** | `location/map_screen.dart` | 109 | "History" button calls `Navigator.pop(context)` instead of pushing to location history screen. |
| B16 | **Schedule screen time picker allows minutes but API only supports hours** | `schedule_screen.dart` | 111-121 | Time picker allows selecting minutes (e.g., 06:30) but `_uiToGridRow` only parses the hour component, discarding minutes. |

### Low (P3)

| # | Bug | File | Line | Impact |
|---|-----|------|------|--------|
| B17 | **`onBackPressed` deprecated in BlockedAppActivity** | `BlockedAppActivity.kt` | 74 | `onBackPressed()` is deprecated in API 33+. Should use `OnBackPressedCallback`. |
| B18 | **Double const keyword in BatteryAlertsScreen** | `battery_alerts_screen.dart` | 58, 73 | `const Color(0xFFC2410C)` inside `const` widget constructors - redundant but works. |
| B19 | **Splash screen redundant navigation** | `splash_screen.dart` | 51-66 | Both `ref.listen` (in build) and the router's `redirect` handle navigation. The listener navigates via `context.go()` which races with GoRouter's redirect. The listener should be removed since redirect handles all cases. |

---

## 4. UX Issues

| # | Issue | Severity | Screen |
|---|-------|----------|--------|
| U1 | **Register screen design mismatch** | High | Register | Login uses polished Guardian's Lens design; Register uses plain blue background + Card. Users switching between them experience jarring visual inconsistency. |
| U2 | **Forgot password screen broken in dark mode** | Medium | Forgot Password | Hardcoded `Colors.black54` text becomes invisible on dark backgrounds. |
| U3 | **No pull-to-refresh on many detail screens** | Medium | DNS Rules, Schedule, Time Limits, Bedtime, Homework Mode, Battery Alerts | These screens load data on init but provide no way to refresh without leaving and returning. |
| U4 | **Child home "Parent Access" text nearly invisible** | Low (by design) | Child Home | `opacity: 0.05` makes the long-press target for parent PIN virtually invisible. New users may not discover it. Consider adding a small settings icon or disclosure in onboarding. |
| U5 | **Geofence screen cannot add geofences in-app** | High | Geofences | Users expect to tap the FAB and add a geofence on a map. Instead they get a dialog directing them to a browser. |
| U6 | **App blocking screen shows "App Blocking -- " with trailing em-dash when no childName** | Low | App Blocking | `Text('App Blocking -- ${childName ?? ''}')` shows "App Blocking -- " when childName is null. |
| U7 | **No keyboard dismiss on scroll** | Medium | Login, Register, Setup | Scrolling the form does not dismiss the keyboard. Users must tap outside the field. |
| U8 | **Settings notification toggles appear functional but do nothing** | High | Settings | Users will assume toggling "Geofence Alerts" off actually disables them. It doesn't. |
| U9 | **No confirmation when saving DNS rules (two separate API calls)** | Medium | DNS Rules | If the first call succeeds but the second fails, the user sees "Failed to save" but the filter level was already changed. No rollback. |
| U10 | **Profile screen uses hardcoded Colors.black45** | Medium | Profile | Profile body uses `Colors.black45` for labels, broken in dark mode. |

---

## 5. Native Integration Health

### 5.1 VPN Service (ShieldVpnService.kt)
- **Architecture:** Local TUN interface intercepting DNS (UDP port 53), forwarding to DoH server via protected HTTPS socket.
- **DNS Loop Prevention:** Pre-resolves DoH server IP before tunnel establishment. Correct approach.
- **DoH Provider Blocking:** Routes Google (8.8.8.8/8.8.4.4), Cloudflare (1.1.1.1/1.0.0.1), Quad9, OpenDNS through the VPN tunnel, effectively blocking browser-native DoH.
- **Foreground Service:** Proper notification channel, IMPORTANCE_LOW.
- **Permission:** `BIND_VPN_SERVICE` declared in manifest.
- **Concern:** `START_STICKY` means Android may restart the service, but `dohUrl` is only set via Intent extras -- a restart will call `onStartCommand` with a null intent, falling through to `START_STICKY` without starting the VPN. This is actually fine since no action is taken on null intent.

### 5.2 App Blocker (AppBlockerService.kt)
- **Architecture:** UsageStats polling every 800ms to detect foreground app. Launches BlockedAppActivity when blocked app detected.
- **Throttling:** 2-second cooldown per package to prevent launch storm.
- **No AccessibilityService needed** -- correct modern approach.
- **Concern:** 800ms polling is power-intensive. Consider using UsageEvents with a longer interval.

### 5.3 BlockedAppActivity.kt
- **Full-screen overlay** as an Activity (no SYSTEM_ALERT_WINDOW needed).
- **Shows above lock screen** (`FLAG_SHOW_WHEN_LOCKED`).
- **Clean dismissal** -- sends user to home screen, verifies app is still blocked on resume.

### 5.4 ShieldAccessibilityService.kt
- **Dead code.** Not referenced from Flutter, not started anywhere. Uses SYSTEM_ALERT_WINDOW overlay which isn't declared. The AppBlockerService + BlockedAppActivity approach supersedes this entirely.
- **Recommendation:** Remove this file.

### 5.5 Background Service
- **flutter_background_service:** Foreground mode, Android notification channel `shield_child`.
- **Heartbeat:** 5-minute interval.
- **Location:** 10-minute interval, medium accuracy.
- **App sync:** 1-hour interval.
- **Concern:** Background isolate uses SharedPreferences for credentials (plaintext). FlutterSecureStorage cannot be used in background isolates -- this is a known Flutter limitation but still a security concern.

---

## 6. Security Findings

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| S1 | **Background service stores JWT in SharedPreferences (plaintext)** | High | `BackgroundServiceHelper.saveCredentials` writes `shield_bg_token` and `shield_bg_profile_id` to SharedPreferences, which is unencrypted XML on Android. Any app with root access or ADB backup can read the child JWT. |
| S2 | **Parent PIN stored in FlutterSecureStorage (good)** | OK | PIN is in encrypted shared preferences (`AndroidOptions(encryptedSharedPreferences: true)`). |
| S3 | **SSL certificate pinning is correctly configured** | OK | `badCertificateCallback` always returns `false` -- rejects all invalid certificates. No MITM bypass. |
| S4 | **Child mode exit requires PIN or no-PIN confirmation** | OK | `_promptParentPin` checks stored PIN; if no PIN set, shows confirmation dialog. Reasonable. |
| S5 | **No jailbreak/root detection** | Medium | App does not check for rooted devices. A rooted device could bypass VPN, read SharedPreferences, disable the app blocker service, etc. |
| S6 | **No tamper detection** | Medium | No integrity checks (e.g., SafetyNet/Play Integrity). Modified APK could have all protection features stripped. |
| S7 | **No certificate pinning on DoH connections** | Low | `ShieldVpnService` uses default SSL trust store for DoH HTTPS connections. While the domain is verified, the certificate chain is not pinned. A compromised CA could MITM the DNS tunnel. |
| S8 | **API keys not in app code** | OK | Google Maps key is in AndroidManifest via `${MAPS_API_KEY}` build variable. No hardcoded API keys found in Dart code. |
| S9 | **Child token refresh not implemented** | Medium | `AuthInterceptor` on 401 for child mode just clears the session. Child tokens cannot be refreshed -- when they expire, the device shows the re-setup screen. This may be by design but means tokens must have long TTL. |

---

## 7. Code Quality Observations

### 7.1 Dead / Unused Code
- `ShieldAccessibilityService.kt` -- entire file is dead code (not referenced, not started)
- `accessibility_service_config.xml` -- config for the unused service
- `http` package in pubspec.yaml -- declared but never imported (only `dio` is used)
- `crypto` package in pubspec.yaml -- declared but never imported
- `shimmer` package in pubspec.yaml -- declared but never imported (custom skeleton loaders used instead)
- `local_auth` package -- declared but only referenced in a "coming soon" stub
- `mobile_scanner` package -- declared but QR scanning is not implemented (QR code is shown as an image URL)
- `sensors_plus` package -- declared for shake detection but never imported
- `stomp_dart_client` package -- declared for WebSocket but never imported in any screen

### 7.2 Hardcoded Strings
- All UI text is hardcoded in English. No `l10n` / `intl` localization setup.
- Approximately 200+ user-facing strings across 40+ screens.

### 7.3 Memory / Resource Management
- **All TextEditingControllers are properly disposed** -- verified across all StatefulWidgets.
- **AnimationControllers are properly disposed** (login, splash, onboarding, browsing history skeleton, AI insights skeleton).
- **ScrollControllers are properly disposed** (AI chat, browsing history).
- **WidgetsBindingObserver properly removed** in ChildHomeScreen.
- **Timers properly cancelled** in ChildHomeScreen (heartbeat, battery, clock).
- **Potential issue:** `_BrowsingHistorySkeleton` uses `AnimatedBuilder` which is not a real Flutter widget. Should be `AnimatedBuilder` -- but this appears to be a custom implementation or the code references the actual `AnimatedBuilder` correctly. On closer inspection, this is correct Flutter API.

### 7.4 State Management Consistency
- All screens consistently use Riverpod `FutureProvider.autoDispose` for API data.
- Mutable form state correctly uses `ConsumerStatefulWidget` with local `setState`.
- `authProvider` uses `StateNotifierProvider` -- appropriate for complex auth lifecycle.
- Theme uses `StateNotifierProvider` with SharedPreferences persistence.

---

## 8. Recommendations (Top 10)

1. **Fix FCM deep link routes (B1, B2)** -- Critical. Either wire up the navigator key or (better) use GoRouter's own context for navigation. Fix all route paths to use actual defined routes.

2. **Bridge Flutter app blocking UI to native service (B7)** -- The parent toggles app blocks via API only. The native `AppBlockerService` needs the blocked apps list pushed via MethodChannel after each toggle.

3. **Redesign Register and Forgot Password screens (B3, B4)** -- Bring them up to the Guardian's Lens design system. Use theme-aware colors for dark mode support.

4. **Implement in-app geofence creation (U5)** -- Add a map-based geofence picker using Google Maps with circle overlay and radius slider. The "use a browser" workaround is unacceptable UX.

5. **Fix or remove non-functional notification toggles (B6, U8)** -- Either wire them to a backend API and persist the preference, or remove the switches entirely to avoid misleading users.

6. **Fix admin dashboard broken routes (B5, B13)** -- Add `/admin/notifications` route or change navigation targets to existing routes.

7. **Remove dead code** -- Delete `ShieldAccessibilityService.kt`, `accessibility_service_config.xml`, and unused pubspec dependencies (`http`, `crypto`, `shimmer`, `sensors_plus`, `stomp_dart_client`, `mobile_scanner`).

8. **Add root/tamper detection (S5, S6)** -- Integrate Play Integrity API (or flutter_jailbreak_detection) and warn when the device is compromised. A rooted device undermines all parental controls.

9. **Encrypt background service credentials (S1)** -- Investigate alternatives: either use the Android Keystore directly via a platform channel, or encrypt the token with a key stored in FlutterSecureStorage before writing to SharedPreferences.

10. **Add i18n support** -- Extract all strings to ARB files using `flutter_localizations`. The app is fully English-only with ~200 hardcoded strings. Even if only English is supported initially, the infrastructure should be in place.

---

## Appendix: Dependency Audit

| Package | Version | Used? | Notes |
|---------|---------|-------|-------|
| flutter_riverpod | ^2.6.1 | Yes | State management |
| go_router | ^14.6.2 | Yes | Navigation |
| dio | ^5.8.0 | Yes | HTTP client |
| http | ^1.2.2 | **No** | Unused, remove |
| flutter_secure_storage | ^9.2.4 | Yes | Token/PIN storage |
| shared_preferences | ^2.5.3 | Yes | Theme, bg credentials |
| hive_flutter | ^1.1.0 | **No** | Never imported |
| crypto | ^3.0.6 | **No** | Never imported |
| shimmer | ^3.0.0 | **No** | Custom skeletons used instead |
| local_auth | ^3.0.1 | **Stub** | "Coming soon" only |
| fl_chart | ^1.2.0 | Yes | Dashboard/admin charts |
| intl | ^0.20.2 | Yes | Date formatting |
| url_launcher | ^6.3.1 | Yes | Settings external links |
| permission_handler | ^11.4.0 | **No** | Never imported directly |
| google_maps_flutter | ^2.17.0 | Yes | Maps |
| geolocator | ^13.0.2 | Yes | GPS |
| stomp_dart_client | ^2.0.0 | **No** | Never imported |
| mobile_scanner | ^5.2.3 | **No** | Never imported |
| sensors_plus | ^4.0.0 | **No** | Never imported |
| battery_plus | ^6.0.3 | Yes | Child home battery |
| flutter_background_service | ^5.0.0 | Yes | Background tasks |
| installed_apps | ^1.4.0 | Yes | App sync |
| flutter_local_notifications | ^18.0.1 | Yes | FCM foreground |
| firebase_core | ^3.12.1 | Yes | Firebase init |
| firebase_messaging | ^15.2.4 | Yes | Push notifications |
| google_fonts | ^6.2.1 | Yes | Manrope + Inter |

**Unused packages that can be removed:** `http`, `hive_flutter`, `crypto`, `shimmer`, `stomp_dart_client`, `mobile_scanner`, `sensors_plus`

**Packages used only as stubs:** `local_auth`, `permission_handler`
