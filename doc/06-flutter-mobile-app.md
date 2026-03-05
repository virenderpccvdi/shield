# 06 — Flutter Mobile App

## Overview

The Shield Flutter app is a **single codebase** for iOS and Android that:
- Serves as the **parent app** (full feature set — monitoring, GPS, alerts, settings)
- Serves as the **child mini-app** (limited view — SOS panic button, task list, usage summary)
- Supports **multi-tenant flavors** — each ISP builds their own branded version from the same code

**Target version:** Flutter **3.41.0** / Dart **3.7.0**
**Current on server:** Flutter 3.27.4 — run `flutter upgrade` before building

---

## Project Structure

```
/var/www/ai/FamilyShield/shield-app/
├── lib/
│   ├── main.dart                   — Entry point, flavor detection, DI setup
│   ├── main_development.dart       — Dev flavor
│   ├── main_production.dart        — Prod flavor
│   ├── app/
│   │   ├── app.dart               — MaterialApp, theme, router
│   │   ├── router.dart            — go_router routes + guards
│   │   └── theme.dart             — Design system tokens (per-flavor)
│   ├── core/
│   │   ├── api/
│   │   │   ├── api_client.dart    — Dio instance + interceptors
│   │   │   ├── auth_interceptor.dart — JWT inject + 401 refresh
│   │   │   └── endpoints.dart     — All API endpoint constants
│   │   ├── auth/
│   │   │   ├── auth_provider.dart — Riverpod auth state
│   │   │   └── token_storage.dart — flutter_secure_storage wrapper
│   │   ├── websocket/
│   │   │   └── ws_client.dart     — STOMP WebSocket client (stomp_dart_client)
│   │   └── notifications/
│   │       ├── fcm_service.dart   — Firebase FCM setup + handlers
│   │       └── notification_handler.dart — Route push taps to screen
│   ├── features/
│   │   ├── auth/                  — Login, register, forgot password screens
│   │   ├── dashboard/             — Parent home dashboard
│   │   ├── profile/               — Child profile management
│   │   ├── dns/                   — DNS rules, categories, live activity
│   │   ├── schedules/             — Visual schedule builder
│   │   ├── time_limits/           — App time budget controls
│   │   ├── location/              — GPS map, geofences, location history
│   │   ├── alerts/                — Alert centre, AI insights
│   │   ├── rewards/               — Task builder, reward bank
│   │   ├── devices/               — Device management, QR registration
│   │   ├── reports/               — Usage charts, PDF export
│   │   ├── settings/              — Account, notifications, subscription
│   │   └── child_app/             — Child-facing screens (SOS, tasks, usage)
│   └── shared/
│       ├── widgets/               — Common UI components
│       ├── models/                — Freezed data classes
│       └── utils/                 — Helpers
├── flavors/
│   ├── shield/                    — Default Shield flavor assets
│   └── isp_template/              — Template for ISP white-label builds
├── android/
│   └── app/src/
│       ├── main/                  — Shield (default)
│       ├── isp_template/          — ISP flavor (copy/rename per ISP)
├── ios/
│   └── Runner/
│       └── AppConfig.xcconfig     — Per-flavor iOS config
├── pubspec.yaml
└── .env.development / .env.production
```

---

## pubspec.yaml — Key Dependencies (2026)

```yaml
name: shield_app
description: Shield — Smart Family Internet Protection
version: 1.0.0+1

environment:
  sdk: ">=3.7.0 <4.0.0"
  flutter: ">=3.41.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter

  # State Management
  flutter_riverpod: ^2.6.1
  riverpod_annotation: ^2.6.1

  # Navigation
  go_router: ^14.6.2

  # HTTP & API
  dio: ^5.8.0
  retrofit: ^4.4.1

  # WebSocket (STOMP)
  stomp_dart_client: ^3.1.0

  # Authentication & Storage
  flutter_secure_storage: ^9.2.4
  shared_preferences: ^2.5.3

  # Push Notifications
  firebase_core: ^3.13.0
  firebase_messaging: ^15.2.4
  flutter_local_notifications: ^18.0.1
  flutter_apns_only: ^1.3.0          # iOS APNs

  # Maps & Location (same API key as SmartTrack)
  google_maps_flutter: ^2.9.0      # Uses shared Google Maps API key
  geolocator: ^13.0.2
  geocoding: ^3.0.0
  # Background GPS — same pattern as SmartTrack
  workmanager: ^0.5.2              # Background task scheduling
  flutter_foreground_task: ^8.11.0 # Foreground service for live GPS tracking

  # Charts & UI
  fl_chart: ^0.70.0
  cached_network_image: ^3.4.1
  shimmer: ^3.0.0
  lottie: ^3.3.1
  flutter_svg: ^2.0.16

  # Utils
  intl: ^0.20.2
  url_launcher: ^6.3.1
  share_plus: ^10.1.4
  image_picker: ^1.1.2
  qr_flutter: ^4.1.0
  mobile_scanner: ^6.0.2          # QR code scanner for device registration
  permission_handler: ^11.4.0

  # Multi-flavor
  flutter_flavor: ^3.0.1

  # Error tracking
  sentry_flutter: ^8.12.0

  # Code gen (build_runner)
  freezed_annotation: ^2.4.4
  json_annotation: ^4.9.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0
  build_runner: ^2.4.13
  freezed: ^2.5.7
  json_serializable: ^6.9.0
  riverpod_generator: ^2.6.1
  retrofit_generator: ^9.1.9
  go_router_builder: ^2.7.1
```

---

## Google Maps API Key

Shield uses the same Google Maps API key as SmartTrack (shared server / same Google project):

```
API Key: AIzaSyDXazeaKnjxYsnwE-Vb-gfapzhr566mo2M
```

**Android — AndroidManifest.xml:**
```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="AIzaSyDXazeaKnjxYsnwE-Vb-gfapzhr566mo2M" />
```

**iOS — AppDelegate.swift:**
```swift
GMSServices.provideAPIKey("AIzaSyDXazeaKnjxYsnwE-Vb-gfapzhr566mo2M")
```

> Features enabled: Maps SDK for Android/iOS, Geocoding API, Places API

---

## Navigation Structure (go_router)

```
/                         → redirects to /dashboard or /login
/login
/register
/forgot-password

/dashboard                — Parent home (bottom nav: Home)
  /dashboard/quick-control  — Quick action bottom sheet

/family                   — Child profiles list (bottom nav: Family)
  /family/add-child
  /family/:profileId
    /family/:profileId/overview
    /family/:profileId/activity      — Live DNS feed (WebSocket)
    /family/:profileId/rules         — Category toggles
    /family/:profileId/schedules     — Visual grid builder
    /family/:profileId/time-limits   — Per-app daily budgets
    /family/:profileId/devices
    /family/:profileId/rewards
    /family/:profileId/reports
    /family/:profileId/ai-insights

/map                      — GPS map (bottom nav: Map)
  /map/history/:profileId
  /map/geofences
  /map/geofences/add
  /map/places
  /map/panic/:eventId      — SOS full-screen alert

/alerts                   — Alert centre (bottom nav: Alerts)
  /alerts/:alertId         — Alert detail
  /alerts/ai/:profileId    — AI monitoring detail

/settings                 — Account settings (bottom nav: Settings)
  /settings/account
  /settings/subscription
  /settings/notifications
  /settings/router-setup
  /settings/family-members
  /settings/help

# Child app routes (CHILD_APP token — limited access)
/child/home               — Task list + SOS button + usage summary
/child/tasks
/child/sos                — Full-screen SOS button
```

---

## Screen Specifications

### Parent App — Home Dashboard (`/dashboard`)

**State:** `DashboardProvider` subscribes to:
- `GET /api/v1/children` — load all child cards
- WebSocket `/topic/alerts/{customerId}` — live alert badge
- Redis online status for each profile

**UI Layout:**
```
AppBar: "Shield" | notification bell (badge count) | settings icon
Body:
  ┌─────────────────────────────────────────┐
  │  Jake  ●online  YouTube 1h32m  3 blocks │  PAUSE
  ├─────────────────────────────────────────┤
  │  Emma  ●offline 15m ago  0 blocks       │  PAUSE
  └─────────────────────────────────────────┘
FAB: Quick Control (pause all / homework / bedtime)
Bottom Nav: Home | Family | Map | Alerts | Settings
```

---

### Child Profile — Activity Tab (`/family/:id/activity`)

Real-time DNS query feed via WebSocket STOMP.

```dart
// lib/features/dns/providers/activity_provider.dart
@riverpod
Stream<DnsQueryEvent> liveActivity(LiveActivityRef ref, String profileId) async* {
  final client = ref.watch(wsClientProvider);
  await client.subscribe('/topic/activity/$profileId');
  yield* client.events.map((frame) => DnsQueryEvent.fromJson(frame.body));
}
```

Feed shows: `[timestamp] domain.com — BLOCKED (Adult Content)` in red/green.
Tap any entry: Allow Once / Always Allow / Always Block.

---

### Schedule Builder (`/family/:id/schedules`)

24-column × 7-row grid. Each cell = 1 hour.
Tap to toggle. Long-press + drag to fill a range.

```
         0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
Monday  [■][■][■][■][■][■][■][□][■][■][■][■][■][■][■][■][□][□][□][□][□][□][■][■]
Tuesday [■][■][■][■][■][■][■][□][■][■][■][■][■][■][■][■][□][□][□][□][□][□][■][■]
...

■ = blocked (red)   □ = allowed (green)

Preset buttons: [School Hours] [Bedtime] [Weekend] [Homework] [Reset]
```

---

### GPS Map (`/map`)

```dart
// lib/features/location/screens/live_map_screen.dart
GoogleMap(
  initialCameraPosition: CameraPosition(target: _center, zoom: 13),
  markers: _buildChildMarkers(profiles, locations),
  circles: _buildGeofenceOverlays(geofences),
  onMapCreated: (c) => _controller = c,
  myLocationEnabled: false,   // Parent's own location not shown
)
```

Child pin taps → bottom sheet:
- Name + avatar
- "Last seen 2 min ago"
- Battery: 76%
- Current mode: School Hours
- [View History] [Set Geofence]

---

### Panic Alert (`/map/panic/:eventId`)

Full-screen emergency view triggered by FCM high-priority push:

```
┌────────────────────────────────────────┐
│          🚨 SOS FROM JAKE               │
│                                        │
│   [Map showing Jake's location]        │
│                                        │
│   📍 23 High Street, Dublin 2          │
│   ⏰ 2026-03-04 17:45:32               │
│   🎯 Accuracy: ±12m                    │
│                                        │
│  ┌─────────────────────────────────┐   │
│  │  📞  CALL JAKE NOW              │   │
│  └─────────────────────────────────┘   │
│                                        │
│  [ Mark as Acknowledged ]              │
└────────────────────────────────────────┘
```

---

### Child App — Home (`/child/home`)

Shown when app is opened with a CHILD_APP token (device registered to child):

```
┌────────────────────────────────────────┐
│  Hi Jake! 👋                           │
│                                        │
│  Today's Usage:                        │
│  YouTube  [████████░░] 1h 32m / 2h    │
│  TikTok   [██░░░░░░░░] 24m / 2h       │
│  Total    [█████░░░░░] 2h 36m / 5h    │
│                                        │
│  Tasks (2 pending):                    │
│  ☐ Make your bed (+15min YouTube)      │
│  ☐ Read 20 pages (+30min any)          │
│                                        │
│  Reward bank: 45 min                   │
│                                        │
│  ┌───────────────────────────────────┐ │
│  │       🆘  I NEED HELP (SOS)       │ │
│  └───────────────────────────────────┘ │
│                                        │
│  [ Check In — I'm Home ]               │
└────────────────────────────────────────┘
```

The SOS button is always visible. Tapping it asks for confirmation, then fires:
```dart
await locationService.sendPanic(lat, lng, accuracy);
// → POST /api/v1/child/location/panic
```

---

## Flutter Flavor System

Each ISP gets a branded build without forking the code.

```bash
# Default Shield build
flutter build apk --flavor shield -t lib/main_production.dart

# ISP: Vodafone
flutter build apk --flavor vodafone -t lib/main_production.dart

# ISP: Custom
flutter build apk --flavor custom_isp -t lib/main_production.dart
```

Flavor configuration:
```dart
// lib/main_production.dart
void main() {
  FlavorConfig(
    flavor: Flavor.shield,          // or Flavor.vodafone
    name: "Shield",
    color: const Color(0xFF1976D2),
    variables: {
      "apiBaseUrl": "https://shield.rstglobal.in/api/v1",
      "wsUrl": "wss://shield.rstglobal.in/ws",
      "supportEmail": "support@rstglobal.in",
    },
  );
  runApp(const ProviderScope(child: ShieldApp()));
}
```

---

## API Client (Dio)

```dart
// lib/core/api/api_client.dart
Dio createDio(String baseUrl) {
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 30),
    headers: {'Accept': 'application/json'},
  ));

  dio.interceptors.addAll([
    AuthInterceptor(tokenStorage),     // Inject Bearer token
    RetryInterceptor(dio),             // Auto-refresh on 401
    LogInterceptor(requestBody: false), // Debug logging
  ]);

  return dio;
}
```

---

## Push Notification Handling

```dart
// lib/core/notifications/notification_handler.dart
class NotificationHandler {
  void handleMessage(RemoteMessage message) {
    final type = message.data['type'];
    switch (type) {
      case 'PANIC_SOS':
        // Navigate to /map/panic/{eventId} immediately
        // Bypass quiet hours
        router.go('/map/panic/${message.data['eventId']}');
      case 'BLOCK_ALERT':
        // Show snackbar, increment badge
        break;
      case 'GEOFENCE_BREACH':
        // Show banner with map thumbnail
        break;
      case 'AI_CONCERN':
        // Navigate to /alerts/ai/{profileId}
        break;
    }
  }
}
```

---

## Build & Deploy

```bash
# Upgrade Flutter to latest stable (do on server)
flutter upgrade

# Build release APK
cd /var/www/ai/FamilyShield/shield-app
flutter build apk --release --flavor shield -t lib/main_production.dart

# Copy to nginx static folder
cp build/app/outputs/flutter-apk/app-shield-release.apk \
   /var/www/ai/FamilyShield/static/shield-latest.apk

# Update version file
echo '{"version":"1.0.0","build":1,"min_build":1,"download_url":"https://shield.rstglobal.in/shield-latest.apk"}' \
   > /var/www/ai/FamilyShield/static/app-version.json
```
