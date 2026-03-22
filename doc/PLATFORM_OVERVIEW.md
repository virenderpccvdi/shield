# Shield Platform — Complete Technical & Product Documentation

**Version:** 1.0.32 · **Last Updated:** March 2026
**Domain:** https://shield.rstglobal.in
**Java Package:** com.rstglobal.shield

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Roles & Permissions](#3-roles--permissions)
4. [Authentication & JWT Flow](#4-authentication--jwt-flow)
5. [Mobile App (Flutter)](#5-mobile-app-flutter)
6. [Web Dashboard (React)](#6-web-dashboard-react)
7. [Marketing Website](#7-marketing-website)
8. [Microservices & API Reference](#8-microservices--api-reference)
9. [Database Schema](#9-database-schema)
10. [DNS Filtering Engine](#10-dns-filtering-engine)
11. [Location & Geofencing](#11-location--geofencing)
12. [Rewards & Gamification](#12-rewards--gamification)
13. [AI & Analytics](#13-ai--analytics)
14. [Billing & Subscriptions](#14-billing--subscriptions)
15. [Notifications & Alerts](#15-notifications--alerts)
16. [Infrastructure & DevOps](#16-infrastructure--devops)
17. [Security Model](#17-security-model)

---

## 1. Product Overview

**Shield** is a family internet protection platform designed for ISPs and households. It gives parents precise, real-time control over their children's digital lives without requiring network-level configuration.

### What Shield Does

| Capability | Description |
|---|---|
| **DNS Filtering** | Blocks malware, adult content, ads, and 43 configurable content categories via a VPN-based DNS proxy on the child's Android device |
| **Screen Time** | Daily time budgets per app category with schedule overrides (school hours, bedtime, weekends) |
| **Location Safety** | Real-time GPS tracking, geofence breach alerts, named places (home/school), emergency SOS |
| **App Blocking** | Remote block/allow installed apps on child device |
| **Rewards** | Gamified task → reward → redemption loop to encourage positive behaviour |
| **AI Insights** | Anomaly detection (Isolation Forest) + LLM-powered behavioural summaries via Claude & DeepSeek |
| **Family Management** | Multi-parent (co-parent) support, QR-based child device setup |
| **White-Label ISP** | Full ISP/partner tenant system with branding, customer management, and billing |

### Business Model

```
GLOBAL_ADMIN (RST Global)
    ↓  creates
ISP_ADMIN tenants (internet service providers / resellers)
    ↓  manages
CUSTOMER households
    ↓  protects
Child devices (child profiles)
```

---

## 2. Architecture Overview

### Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Mobile App | Flutter / Dart | 3.41.0 / 3.7.0 |
| Web Dashboard | React + MUI + Vite | 19.2.4 / v7.3.8 / 6.x |
| API Gateway | Spring Cloud Gateway (WebFlux) | Boot 4.0.3 / Cloud 2025.1.1 |
| Microservices | Spring Boot | 4.0.3 |
| Auth | Spring Security + JJWT HS512 | 7.0.x / 0.13.0 |
| Service Discovery | Netflix Eureka | Spring Cloud 2025.1.1 |
| Database | PostgreSQL 18 (Patroni HA) | Port 5432 (HAProxy) |
| Migrations | Flyway | Per-service schema |
| Cache / Blacklist | Redis 7.0.15 | Port 6379 |
| DNS Engine | AdGuard Home (Docker) | Port 3080 |
| AI Service | FastAPI + scikit-learn + Claude + DeepSeek | Python 3.12 |
| Monitoring | Prometheus + Grafana + Zipkin | 9190 / 3190 / 9412 |
| Reverse Proxy | Nginx 1.24.0 + SSL (Let's Encrypt) | — |
| Container Runtime | Docker 29.1.3 | — |
| OS | Ubuntu 24.04.3, Java 21 | — |

### Service Port Map

| Service | Port | Purpose |
|---|---|---|
| Eureka | 8261 | Service discovery |
| Gateway | 8280 | Single public entry point → Nginx |
| Auth | 8281 | JWT issuance, MFA, user management |
| Tenant | 8282 | ISP tenant & plan management |
| Profile | 8283 | Child profiles, devices, family |
| DNS | 8284 | Filtering rules, schedules, budgets |
| Location | 8285 | GPS, geofences, SOS |
| Notification | 8286 | FCM, email, WebSocket |
| Rewards | 8287 | Tasks, points, achievements |
| Config | 8288 | Centralised config server |
| Analytics | 8289 | DNS logs, usage summaries |
| Admin | 8290 | Audit, billing, AI settings, CRM |
| AI (Python) | 8291 | Anomaly detection, LLM insights |

### Request Flow

```
Mobile App / Browser
        ↓  HTTPS
    Nginx :443
        ↓
    Gateway :8280
        ↓  JWT filter (validates HS512, injects X-User-Id / X-User-Role / X-Tenant-Id)
        ↓  Circuit breaker (Resilience4j)
    Microservice (via Eureka lb://)
        ↓
  PostgreSQL / Redis
```

---

## 3. Roles & Permissions

### User Roles

| Role | Token Claim | Who | Access Scope |
|---|---|---|---|
| `GLOBAL_ADMIN` | `role: "GLOBAL_ADMIN"` | RST Global staff | Full platform — all tenants, all users, all data |
| `ISP_ADMIN` | `role: "ISP_ADMIN"` | Partner ISP / reseller | Own tenant's customers, DNS rules, analytics, billing |
| `CUSTOMER` | `role: "CUSTOMER"` | End-user parent | Own family: child profiles, devices, rules, location |
| `CHILD_APP` | `role: "CHILD_APP"` | Child device token | Read-only child data (tasks, balance, DNS status) |

### Permission Matrix

| Action | GLOBAL_ADMIN | ISP_ADMIN | CUSTOMER | CHILD_APP |
|---|:---:|:---:|:---:|:---:|
| Manage tenants | ✅ | ❌ | ❌ | ❌ |
| View all users | ✅ | ❌ | ❌ | ❌ |
| Create ISP_ADMIN users | ✅ | ❌ | ❌ | ❌ |
| View tenant customers | ✅ | ✅ (own) | ❌ | ❌ |
| Create child profiles | ✅ | ❌ | ✅ | ❌ |
| Manage DNS rules | ✅ | ✅ (own) | ✅ (own) | ❌ |
| View location data | ✅ | ❌ | ✅ (own) | ❌ |
| Create geofences | ✅ | ❌ | ✅ | ❌ |
| Create tasks | ✅ | ❌ | ✅ | ❌ |
| View tasks | ✅ | ❌ | ✅ | ✅ |
| Trigger SOS | ❌ | ❌ | ❌ | ✅ |
| View AI insights | ✅ | ✅ | ✅ (own) | ❌ |
| Manage subscription plans | ✅ | ❌ | ❌ | ❌ |
| View own invoices | ✅ | ✅ | ✅ | ❌ |
| Configure platform AI | ✅ | ❌ | ❌ | ❌ |
| View audit logs | ✅ | ❌ | ❌ | ❌ |
| Manage global blocklist | ✅ | ❌ | ❌ | ❌ |
| Manage tenant blocklist | ✅ | ✅ (own) | ❌ | ❌ |

### Child App Token (CHILD_APP)

The child device token is a special limited-scope JWT:

```json
{
  "sub": "<profileId>",
  "role": "CHILD_APP",
  "tenant_id": "<parentTenantId>",
  "customer_id": "<parentUserId>",
  "profile_id": "<profileId>",
  "exp": <now + 365 days>
}
```

- Issued by `/auth/child/token` — requires parent (CUSTOMER) userId + profileId + PIN
- Gateway injects `X-User-Id = profileId` (not a userId) for child requests
- No refresh token — expires after 365 days, child must re-setup device
- On 401, the app clears child mode (restores parent session if one exists)

---

## 4. Authentication & JWT Flow

### Parent Login Flow

```
1. POST /auth/login { email, password }
   → Server validates credentials
   → If MFA enabled: returns { requiresMfa: true, tempToken }
     → POST /auth/mfa/validate { tempToken, code }
   → Returns { accessToken (HS512, 24h), refreshToken (UUID, 30d) }

2. App stores tokens in FlutterSecureStorage
   - Parent key: 'access_token'
   - Child key: 'child_access_token' (separate — never overwritten by parent session)

3. Every API request: Authorization: Bearer <accessToken>
   → Gateway validates → injects headers → upstream services trust headers

4. On 401: AuthInterceptor tries POST /auth/refresh { refreshToken }
   → Gets new accessToken
   → On refresh failure: logout() → clears all storage → redirect to /login
```

### Child Device Setup Flow

```
1. Parent scans QR code on child's phone  OR  manually enters credentials
2. QR contains: { profileId, profileName, dnsClientId }
3. Parent enters credentials on child device → POST /auth/login
4. App calls GET /profiles/children → parent selects child profile
5. App calls POST /auth/child/token { parentUserId, childProfileId, pin: "0000" }
   → Receives 365-day child JWT
6. App calls prepareVpnPermission() → Android shows VPN consent dialog
7. App fetches GET /dns/rules/{profileId} → gets dohUrl
8. App calls DnsVpnService.start(dohUrl) → VPN service starts DNS filtering
9. App stores child token + profileId → navigates to /child
```

### Token Blacklist (Logout)

```
POST /auth/logout
→ Redis: SET shield:auth:blacklist:{userId} = <logout_epoch_seconds>  TTL: 30d
→ Gateway checks on every request: if token.iat <= blacklist_ts → 401
→ All existing tokens for that user are invalidated instantly
```

---

## 5. Mobile App (Flutter)

**Package:** com.rstglobal.shield_app
**State Management:** Riverpod
**Navigation:** go_router
**HTTP Client:** Dio + AuthInterceptor
**Storage:** flutter_secure_storage
**Push:** Firebase FCM

### Screen Map

#### Authentication & Setup

| Screen | Route | Purpose |
|---|---|---|
| LoginScreen | `/login` | Email/password login |
| RegisterScreen | `/register` | New account registration |
| ForgotPasswordScreen | `/forgot-password` | Request OTP, reset password |
| ChildDeviceSetupScreen | `/child-setup` | QR scan or manual child setup |
| BiometricGate | (wrapper) | Biometric authentication for parent screens |

#### Parent Screens (require CUSTOMER login)

| Screen | Route | Purpose |
|---|---|---|
| DashboardScreen | `/dashboard` | Home: online children, active alerts, quick controls |
| FamilyScreen | `/family` | All child profiles, add new profile |
| ChildDetailScreen | `/family/:profileId` | Child profile: status, quick links to all sub-screens |
| NewChildProfileScreen | `/family/new` | Create child profile form |
| CoParentScreen | `/family/members` | Invite & manage co-parents / guardians |
| MapScreen | `/map?profileId=X` | Live GPS map, location history overlay |
| AlertsScreen | `/alerts` | Geofence breaches, SOS events, anomaly alerts |
| SettingsScreen | `/settings` | Account, MFA, notification preferences, app version |
| NotificationHistoryScreen | `/notifications` | Full notification inbox |
| DnsRulesScreen | `/family/:profileId/dns-rules` | Content categories, allowlist, blocklist |
| ScheduleScreen | `/family/:profileId/schedule` | 7-day × 24-hour filter schedule grid |
| TimeLimitsScreen | `/family/:profileId/time-limits` | Daily screen time budgets |
| RewardsScreen | `/family/:profileId/rewards` | Tasks management, approve/reject, balance |
| ReportsScreen | `/family/:profileId/reports` | DNS stats, usage reports, app usage chart |
| GeofencesScreen | `/family/:profileId/geofences` | Draw/manage geofence zones on map |
| PlacesScreen | `/family/:profileId/places` | Named places (home, school, grandma's house) |
| LocationHistoryScreen | `/family/:profileId/location-history` | Historical path replay |
| AiInsightsScreen | `/family/:profileId/ai-insights` | AI behavioural analysis, anomaly scores |
| DevicesScreen | `/family/:profileId/devices` | Registered devices, online status |
| AppBlockingScreen | `/family/:profileId/app-blocking` | Block/allow apps, set uninstall PIN |
| PanicAlertScreen | (modal) | Parent-triggered emergency broadcast |
| QuickControlSheet | (bottom sheet) | Instant toggles: pause internet, SOS, extend time |

#### Child Screens (CHILD_APP token)

| Screen | Route | Purpose |
|---|---|---|
| ChildAppScreen | `/child` | Child home: VPN status, check-in, quick actions |
| ChildTasksScreen | `/child/tasks` | View tasks assigned by parent, mark complete |
| ChildRewardsScreen | `/child/rewards` | Points balance, achievements, redemption history |
| ChildSosScreen | `/child/sos` | One-tap SOS emergency alert with GPS |
| PinVerifyDialog | (modal) | PIN gate for child to access parent controls |

### Key UI/UX Patterns

#### Dashboard Screen
- Shows real-time count of online children
- Each child card: avatar, name, online indicator, last-seen time, battery
- Active SOS banner at top (red, pulsing) if any SOS is active
- Quick action buttons: Pause Internet, View Map, View Alerts
- Pull-to-refresh; auto-refreshes every 60s

#### DNS Rules Screen
- Category grid: 43 categories in 6 groups (Ads & Tracking, Adult, Social, Apps, Safety, Misc)
- Toggle chips: tap to enable/disable a category
- Custom allowlist / blocklist: text field + chip display
- Filter level presets: Safe (defaults) → Moderate → Strict (one tap)
- Schedule grid: 7 columns (days) × 24 rows (hours) — tap to block/allow hour slots
- Preset buttons: School Hours, Bedtime, Weekend

#### Child App Screen
- VPN status indicator (active/inactive, shield icon)
- Check-in button (sends location to parent)
- Today's tasks preview (top 3)
- Points balance chip
- SOS button (prominent, red)

#### Rewards Screen (Parent)
- Task list: title, description, reward points, status badge
- Status states: PENDING → SUBMITTED → APPROVED or REJECTED
- Approve/Reject buttons per submitted task
- Balance summary: total points, total screen time earned
- FAB: "+ New Task" → dialog with title, description, points, minutes

### VPN DNS Proxy (Android)

The Shield DNS VPN creates a local TUN interface (`10.111.0.1/30`) that intercepts all UDP port-53 DNS queries and forwards them via HTTPS (DoH) to the Shield DNS server.

```
Device App
    ↓  DNS query (UDP :53)
TUN interface (10.111.0.1)
    ↓  ShieldVpnService intercepts
    ↓  protect(socket) — bypasses VPN for DoH traffic to prevent loop
    ↓  HTTPS POST /dns/{clientId}/dns-query
Shield DoH Server (AdGuard)
    ↓  filtered response
TUN interface writes response back
    ↓
Device App gets (possibly blocked) answer
```

**Known DoH provider bypass:** Routes `8.8.8.8, 1.1.1.1, 9.9.9.9, 208.67.x.x` through VPN to force fallback to UDP port 53 (which Shield intercepts), preventing apps from bypassing the filter via hardcoded DoH.

---

## 6. Web Dashboard (React)

**Base URL:** `https://shield.rstglobal.in/app/`
**Stack:** React 19 + MUI v7 + Vite 6 + TanStack Query + React Router v6
**Charts:** Recharts
**Maps:** Leaflet
**WebSocket:** @stomp/stompjs (STOMP over WebSocket for live alerts)
**Deployment:** Nginx static files at `/app/`

### Page Map by Role

#### Customer (Parent) Portal

| Page | Path | Description |
|---|---|---|
| CustomerDashboardPage | `/dashboard` | Overview: online children, today's blocked queries, active alerts, quick action cards |
| CustomerChildProfilesPage | `/profiles` | All child profiles grid |
| ChildProfilePage | `/profiles/:profileId` | Child detail with tabs: Overview, Activity, Rules, Schedule |
| ActivityPage | `/profiles/:profileId/activity` | DNS query log, daily bar chart, category breakdown ring chart |
| RulesPage | `/profiles/:profileId/rules` | Toggle categories, manage allow/block lists |
| SchedulePage | `/profiles/:profileId/schedules` | Interactive 7×24 schedule grid with drag select |
| RewardsPage | `/profiles/:profileId/rewards` | Task management, approval workflow, balance view |
| ReportsPage | `/profiles/:profileId/reports` | Usage trends, export PDF |
| ChildAppsPage | `/profiles/:profileId/apps` | App list with block toggles |
| TimeLimitsPage | `/time-limits` | Daily budget configuration |
| GeofencesPage | `/geofences` | Leaflet map, draw geofence circles |
| LocationHistoryPage | `/location-history` | GPS breadcrumb trail map |
| AiInsightsPage | `/ai-insights` | AI anomaly scores, LLM behavioural summary |
| AppControlPage | `/app-control` | Platform-wide app blocking |
| CustomerDevicesPage | `/devices` | Device registry, QR code download |
| LocationMapPage | `/map` | Live location all children |
| AlertsPage | `/alerts` | Breach events, SOS history |
| SubscriptionPage | `/subscription` | Current plan, invoice history, upgrade flow |
| FamilyMembersPage | `/family-members` | Invite/manage co-parents |
| SettingsPage | `/settings` | Profile, MFA setup, notification preferences |

#### GLOBAL_ADMIN Portal

| Page | Path | Description |
|---|---|---|
| PlatformDashboardPage | `/admin/dashboard` | Platform KPIs: tenants, customers, devices, queries/day |
| TenantsPage | `/admin/tenants` | ISP tenant list with plan, status, customer count |
| TenantDetailPage | `/admin/tenants/:id` | Tenant config, usage, customers, blocklist |
| UsersPage | `/admin/users` | All platform users with role filter |
| UserDetailPage | `/admin/users/:id` | User detail, role change, password reset |
| DnsRulesPage | `/admin/dns-rules` | Platform-wide DNS default rules |
| AdminAnalyticsPage | `/admin/analytics` | Cross-tenant analytics |
| PlatformAnalyticsPage | `/admin/platform-analytics` | Daily query volume, blocked %, device growth |
| SubscriptionPlansPage | `/admin/plans` | Create/edit billing plans, Stripe sync |
| AuditLogPage | `/admin/audit-logs` | Full audit trail with filters |
| SystemHealthPage | `/admin/health` | Service health: Eureka, DB, Redis, all microservices |
| NotificationChannelsPage | `/admin/notifications` | Email/FCM/SMTP channel config |
| InvoicesPage | `/admin/invoices` | All invoices, PDF download |
| GlobalCustomersPage | `/admin/customers` | All customers across all tenants |
| GlobalBlocklistPage | `/admin/blocklist` | Platform-wide domain blocklist |
| AiModelsPage | `/admin/ai-models` | AI provider config (Claude / DeepSeek / Custom) |
| AdminAiInsightsPage | `/admin/ai-insights` | Platform-wide anomaly reports |
| FeatureManagementPage | `/admin/features` | Feature flags per tenant |
| RolePermissionsPage | `/admin/roles` | Role × permission matrix editor |
| LeadsPage | `/admin/leads` | CRM: website contact form leads, pipeline |
| VisitorsPage | `/admin/visitors` | Website visitor analytics |
| AdminChildDetailPage | `/admin/child-profiles/:id` | Full child profile view |
| AdminUrlActivityPage | `/admin/url-activity` | DNS query log across platform |
| AdminAppControlPage | `/admin/app-control` | App blocking across platform |

#### ISP Admin Portal

| Page | Path | Description |
|---|---|---|
| IspDashboardPage | `/isp/dashboard` | Tenant KPIs: customers, devices, queries, alerts |
| CustomersPage | `/isp/customers` | Customer list, status, plan |
| CustomerDetailPage | `/isp/customers/:id` | Customer detail, child profiles, invoices |
| BrandingPage | `/isp/branding` | Logo, primary colour, custom domain |
| IspAnalyticsPage | `/isp/analytics` | Tenant DNS analytics |
| IspBillingPage | `/isp/billing` | Invoice management, billing history |
| IspPlansPage | `/isp/plans` | Plan configuration for customers |
| IspBlocklistPage | `/isp/blocklist` | Tenant blocklist management |
| IspFilteringPage | `/isp/filtering` | Default filter levels for new customers |
| IspChildDetailPage | `/isp/child-profiles/:id` | Child profile view within tenant |
| IspSettingsPage | `/isp/settings` | Tenant settings |
| IspAiInsightsPage | `/isp/ai-insights` | Tenant AI anomaly overview |

### Key UI Components

| Component | Purpose |
|---|---|
| `WeeklyBarChart` | 7-day DNS query bar chart (blocked vs allowed) — React.memo |
| `BlockTrendLine` | Line chart for blocking trend over time — React.memo |
| `UsageRingChart` | Category breakdown donut chart — React.memo |
| `ScheduleGrid` | 7×24 interactive schedule matrix with drag-select |
| `ProfileCard` | Child profile card with online indicator, battery |
| `TaskApprovalCard` | Task approval/rejection UI with status badge |
| `AlertFeed` | Live-updating alert stream via WebSocket |
| `BillingWidget` | Stripe plan display with upgrade button |

### State Management

- **TanStack Query** — server state, caching, background refetch
- **React Context** — auth state (JWT, user, role)
- **useWebSocket** — STOMP WebSocket hook with `useRef` stale-closure fix
- **useMemo/useCallback** — chart data, category lists to prevent re-renders

---

## 7. Marketing Website

**Path:** `/var/www/ai/FamilyShield/shield-website/`
**URL:** `https://shield.rstglobal.in/`
**Technology:** Static HTML5 / CSS3 / Vanilla JS (no framework)

### Pages

| File | URL | Purpose |
|---|---|---|
| `index.html` | `/` | Landing page — hero, features, pricing, download |
| `login.html` | `/login.html` | Web login (white-card design) |
| `register.html` | `/register.html` | Web registration |
| `dashboard.html` | `/dashboard.html` | Post-login redirect (role-aware: admin shows tenant management) |

### Landing Page Sections

1. **Hero** — Animated carousel with product screenshots, "Download APK" CTA, App Store / Play Store buttons (pending)
2. **Features** — 6 feature cards: DNS Filtering, Screen Time, Location, Rewards, App Blocking, AI Insights
3. **How It Works** — 4-step install guide with step numbers
4. **Pricing** — 3-tier plan cards (Basic / Family / ISP)
5. **Download** — APK download button with version badge and install instructions
6. **Contact Form** — Lead capture → CRM backend

### APK Download

```nginx
location ~* \.apk$ {
    root /var/www/ai/FamilyShield/static;
    add_header Content-Disposition 'attachment; filename="shield.apk"';
}
```

APK served at `https://shield.rstglobal.in/static/shield-app.apk`

---

## 8. Microservices & API Reference

### Gateway — Routes & Circuit Breakers

All requests enter through `https://shield.rstglobal.in` → Nginx → `localhost:8280` (Gateway).

The gateway:
1. Validates JWT (HS512)
2. Checks Redis blacklist
3. Injects `X-User-Id`, `X-User-Role`, `X-Tenant-Id` headers
4. Removes `Authorization` header (downstream services trust gateway headers)
5. Routes via Eureka service discovery (`lb://SERVICE-NAME`)
6. Applies Resilience4j circuit breakers per service

### Auth Service (Port 8281)

#### Public Endpoints

| Method | Path | Body / Params | Response |
|---|---|---|---|
| POST | `/api/v1/auth/login` | `{email, password}` | `{accessToken, refreshToken, userId, role, tenantId}` |
| POST | `/api/v1/auth/register` | `{email, password, name, phone}` | `{accessToken, ...}` |
| POST | `/api/v1/auth/refresh` | `{refreshToken}` | `{accessToken}` |
| POST | `/api/v1/auth/forgot-password` | `{email}` | 200 OK (sends OTP email) |
| POST | `/api/v1/auth/reset-password` | `{email, otp, newPassword}` | 200 OK |
| POST | `/api/v1/auth/child/token` | `{parentUserId, childProfileId, pin}` | `{accessToken (365d)}` |
| POST | `/api/v1/auth/mfa/validate` | `{tempToken, code}` | `{accessToken, refreshToken}` |

#### Authenticated Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/logout` | Any | Blacklist token in Redis |
| GET | `/api/v1/auth/me` | Any | Current user info |
| PUT | `/api/v1/auth/me` | Any | Update name, phone |
| POST | `/api/v1/auth/change-password` | Any | Change password |
| POST | `/api/v1/auth/mfa/setup` | Any | Generate TOTP QR code |
| POST | `/api/v1/auth/mfa/verify` | Any | Enable MFA with TOTP code |
| POST | `/api/v1/auth/mfa/disable` | Any | Disable MFA |
| GET | `/api/v1/auth/users` | GLOBAL_ADMIN | List all users (paginated) |
| POST | `/api/v1/auth/admin/register` | GLOBAL_ADMIN | Create user with explicit role |
| PUT | `/api/v1/auth/admin/users/{id}` | GLOBAL_ADMIN | Update user |
| DELETE | `/api/v1/auth/admin/users/{id}` | GLOBAL_ADMIN | Delete user |

### Profile Service (Port 8283)

#### Child Profiles

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/profiles/children` | CUSTOMER | Create child profile |
| GET | `/api/v1/profiles/children` | CUSTOMER | List own child profiles |
| GET | `/api/v1/profiles/children/{id}` | CUSTOMER | Get child detail |
| PUT | `/api/v1/profiles/children/{id}` | CUSTOMER | Update child profile |
| DELETE | `/api/v1/profiles/children/{id}` | CUSTOMER | Delete child profile |
| GET | `/api/v1/profiles/children/{id}/status` | CUSTOMER | Online status, battery, last seen |
| GET | `/api/v1/profiles/children/{id}/doh-url` | CUSTOMER | DNS-over-HTTPS URL for Private DNS setup |

#### Devices

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/profiles/devices` | CUSTOMER/CHILD | Register device |
| POST | `/api/v1/profiles/devices/heartbeat` | CHILD | Periodic heartbeat (location + battery) |
| GET | `/api/v1/profiles/devices/profile/{id}` | CUSTOMER | List devices for profile |
| DELETE | `/api/v1/profiles/devices/{id}` | CUSTOMER | Unregister device |
| GET | `/api/v1/profiles/devices/qr/{childId}` | CUSTOMER | QR setup data |
| GET | `/api/v1/profiles/devices/qr/{childId}/image` | CUSTOMER | QR code PNG image |

#### Device Apps

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/profiles/apps/sync` | CHILD | Upload installed app list |
| GET | `/api/v1/profiles/apps/{profileId}` | CUSTOMER | App list with block status |
| PATCH | `/api/v1/profiles/apps/{profileId}/{pkg}` | CUSTOMER | Block or unblock app |
| GET | `/api/v1/profiles/{profileId}/apps/blocked` | CHILD | Get blocked app list (for enforcement) |
| POST | `/api/v1/profiles/apps/verify-uninstall-pin` | CHILD | Verify PIN before uninstall |

#### Family

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/profiles/family/invite` | CUSTOMER | Invite co-parent by email |
| POST | `/api/v1/profiles/family/accept` | CUSTOMER | Accept invitation by token |
| GET | `/api/v1/profiles/family` | CUSTOMER | List family members |
| PUT | `/api/v1/profiles/family/{id}/role` | CUSTOMER | Update member role |
| DELETE | `/api/v1/profiles/family/{id}` | CUSTOMER | Remove family member |

### DNS Service (Port 8284)

#### Filtering Rules

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/dns/rules/{profileId}` | CUSTOMER+ | Get rules + dohUrl + categories |
| PUT | `/api/v1/dns/rules/{profileId}/categories` | CUSTOMER+ | Toggle content categories |
| PUT | `/api/v1/dns/rules/{profileId}/allowlist` | CUSTOMER+ | Update allowlist |
| PUT | `/api/v1/dns/rules/{profileId}/blocklist` | CUSTOMER+ | Update blocklist |
| PUT | `/api/v1/dns/rules/{profileId}/filter-level` | CUSTOMER+ | Apply preset level |
| POST | `/api/v1/dns/rules/{profileId}/domain/action` | CUSTOMER+ | Add/remove single domain |
| POST | `/api/v1/dns/rules/{profileId}/pause` | CUSTOMER+ | Pause filtering temporarily |
| POST | `/api/v1/dns/rules/{profileId}/resume` | CUSTOMER+ | Resume filtering |
| POST | `/api/v1/dns/rules/{profileId}/sync` | CUSTOMER+ | Force re-sync to AdGuard |
| GET | `/api/v1/dns/rules/platform` | GLOBAL_ADMIN | Platform-wide defaults |
| POST | `/api/v1/dns/rules/platform/propagate` | GLOBAL_ADMIN | Push defaults to all profiles |

#### Schedules

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/dns/schedules/{profileId}` | Get weekly schedule grid (JSON 7×24 matrix) |
| PUT | `/api/v1/dns/schedules/{profileId}` | Update schedule |
| POST | `/api/v1/dns/schedules/{profileId}/presets` | Apply named preset (SCHOOL/BEDTIME/STRICT/WEEKEND) |

#### Time Budgets

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/dns/budgets/{profileId}` | Daily time limits per category |
| PUT | `/api/v1/dns/budgets/{profileId}` | Update budgets |
| GET | `/api/v1/dns/budgets/{profileId}/usage` | Today's usage vs limit |
| POST | `/api/v1/dns/budgets/{profileId}/request-extension` | Child requests more time |

### Location Service (Port 8285)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/location/{profileId}/latest` | CUSTOMER | Latest GPS point |
| GET | `/api/v1/location/{profileId}/history` | CUSTOMER | Historical trail (paged, date range) |
| POST | `/api/v1/location/child/checkin` | CHILD | Manual check-in |
| GET | `/api/v1/location/{profileId}/speed` | CUSTOMER | Current speed estimate |
| GET | `/api/v1/location/{profileId}/spoofing-alerts` | CUSTOMER | GPS spoofing detection events |
| POST | `/api/v1/location/geofences` | CUSTOMER | Create geofence |
| GET | `/api/v1/location/geofences/{profileId}` | CUSTOMER | List geofences |
| PUT | `/api/v1/location/geofences/{id}` | CUSTOMER | Update geofence |
| DELETE | `/api/v1/location/geofences/{id}` | CUSTOMER | Delete geofence |
| GET | `/api/v1/location/geofences/{id}/events` | CUSTOMER | Enter/exit events |
| POST | `/api/v1/location/places` | CUSTOMER | Create named place |
| GET | `/api/v1/location/places/{profileId}` | CUSTOMER | List places |
| POST | `/api/v1/location/sos` | CHILD | Trigger SOS |
| GET | `/api/v1/location/sos/{profileId}` | CUSTOMER | List SOS events |
| POST | `/api/v1/location/sos/{id}/acknowledge` | CUSTOMER | Acknowledge SOS |
| POST | `/api/v1/location/sos/{id}/resolve` | CUSTOMER | Resolve SOS |

### Rewards Service (Port 8287)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/rewards/tasks` | CUSTOMER | Create task (title, description, points, minutes, dueDate) |
| GET | `/api/v1/rewards/tasks/{profileId}` | CUSTOMER/CHILD | List tasks (optional ?status= filter) |
| POST | `/api/v1/rewards/tasks/{id}/approve` | CUSTOMER | Approve completed task → credit points |
| POST | `/api/v1/rewards/tasks/{id}/reject` | CUSTOMER | Reject submitted task |
| POST | `/api/v1/rewards/tasks/{id}/complete` | CHILD | Mark task complete (status → SUBMITTED) |
| GET | `/api/v1/rewards/bank/{profileId}` | CUSTOMER/CHILD | Points balance + streak |
| POST | `/api/v1/rewards/bank/{profileId}/redeem` | CUSTOMER | Redeem points for screen time |
| POST | `/api/v1/rewards/{profileId}/bonus` | CUSTOMER | Grant bonus points |
| GET | `/api/v1/rewards/achievements/{profileId}` | CUSTOMER/CHILD | List badges earned |
| GET | `/api/v1/rewards/{profileId}/streaks` | CUSTOMER/CHILD | Current task completion streak |
| GET | `/api/v1/rewards/transactions/{profileId}` | CUSTOMER | Transaction history |

### Analytics Service (Port 8289)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/analytics/logs/{profileId}` | CUSTOMER+ | DNS query log (paged) |
| GET | `/api/v1/analytics/summaries/{profileId}` | CUSTOMER+ | Daily summaries array |
| GET | `/api/v1/analytics/{profileId}/stats` | CUSTOMER+ | Stats: totalBlocked, topCategories |
| GET | `/api/v1/analytics/platform/overview` | GLOBAL_ADMIN | Platform-wide KPIs |
| GET | `/api/v1/analytics/platform/daily` | GLOBAL_ADMIN | Daily query volume trend |
| GET | `/api/v1/analytics/tenant/{id}/overview` | ISP_ADMIN+ | Tenant analytics |

### Notification Service (Port 8286)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/notifications/my` | Any | My notifications (paged) |
| GET | `/api/v1/notifications/my/unread/count` | Any | Badge count |
| PUT | `/api/v1/notifications/{id}/read` | Any | Mark as read |
| PUT | `/api/v1/notifications/my/read-all` | Any | Mark all read |
| POST | `/api/v1/notifications/fcm/register` | Any | Register FCM token |
| GET | `/api/v1/notifications/preferences` | Any | Get notification prefs |
| PUT | `/api/v1/notifications/preferences` | Any | Update prefs |
| WS | `/ws/shield-ws` | Any (JWT) | STOMP WebSocket for live alerts |

### Tenant Service (Port 8282)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/tenants` | GLOBAL_ADMIN | List tenants (paged) |
| POST | `/api/v1/tenants` | GLOBAL_ADMIN | Create tenant |
| GET | `/api/v1/tenants/{id}` | GLOBAL_ADMIN | Tenant detail |
| PUT | `/api/v1/tenants/{id}` | GLOBAL_ADMIN | Update (name, plan, maxCustomers, features) |
| DELETE | `/api/v1/tenants/{id}` | GLOBAL_ADMIN | Soft-delete tenant |
| GET | `/api/v1/tenants/blocklist/{tenantId}` | ISP_ADMIN+ | Tenant domain blocklist |
| POST | `/api/v1/tenants/blocklist/{tenantId}` | ISP_ADMIN+ | Add domain |
| DELETE | `/api/v1/tenants/blocklist/{tenantId}/{id}` | ISP_ADMIN+ | Remove domain |

---

## 9. Database Schema

**Database:** `shield_db` on PostgreSQL 18
**Connection:** Port 5432 (HAProxy → Patroni primary)
**User:** `shield`

### Schema Layout

Each microservice owns its own PostgreSQL schema with separate Flyway migration history:

| Schema | Owner Service | Tables |
|---|---|---|
| `auth` | shield-auth | users, flyway |
| `profile` | shield-profile | customers, child_profiles, devices, device_apps, family_members, family_invites, subscription_history |
| `dns` | shield-dns | dns_rules, schedules, budget_usage, extension_requests, platform_defaults |
| `location` | shield-location | location_points (partitioned), geofences, geofence_events, sos_events, named_places, spoofing_alerts |
| `analytics` | shield-analytics | dns_query_logs (partitioned), usage_summaries |
| `notification` | shield-notification | notifications, fcm_tokens, notification_channels, notification_preferences |
| `rewards` | shield-rewards | tasks, reward_bank, reward_transactions, achievements |
| `tenant` | shield-tenant | tenants, tenant_blocklist, tenant_allowlist |
| `admin` | shield-admin | audit_logs, subscription_plans, billing_customers, invoices, global_blocklist, ai_settings, crm_leads, lead_activities, visitors, compliance_exports |

### Key Table Structures

#### `auth.users`
```sql
id              UUID PRIMARY KEY
tenant_id       UUID (NULL for GLOBAL_ADMIN)
email           VARCHAR UNIQUE (case-insensitive index)
password_hash   VARCHAR
name            VARCHAR
phone           VARCHAR
role            ENUM (GLOBAL_ADMIN, ISP_ADMIN, CUSTOMER)
is_active       BOOLEAN DEFAULT TRUE
email_verified  BOOLEAN DEFAULT FALSE
mfa_enabled     BOOLEAN DEFAULT FALSE
mfa_secret      VARCHAR (TOTP base32 secret)
last_login_at   TIMESTAMPTZ
failed_login_attempts INT DEFAULT 0
locked_until    TIMESTAMPTZ
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ (auto-updated by trigger)
deleted_at      TIMESTAMPTZ (soft delete)
```

#### `profile.child_profiles`
```sql
id              UUID PRIMARY KEY
tenant_id       UUID
customer_id     UUID → profile.customers
name            VARCHAR
avatar_url      VARCHAR
date_of_birth   DATE
age_group       ENUM (TODDLER, CHILD, TEEN, YOUNG_ADULT)
dns_client_id   VARCHAR UNIQUE (format: {name-slug}-{4hex}, e.g. "jake-a3f9")
filter_level    ENUM (MILD, MODERATE, STRICT) DEFAULT 'MODERATE'
notes           TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
deleted_at      TIMESTAMPTZ
```

#### `location.location_points` (Range-Partitioned)
```sql
id              UUID
tenant_id       UUID
profile_id      UUID
device_id       UUID
latitude        DOUBLE PRECISION
longitude       DOUBLE PRECISION
accuracy        FLOAT
altitude        FLOAT
speed           FLOAT
heading         FLOAT
battery_pct     INT
is_moving       BOOLEAN
recorded_at     TIMESTAMPTZ (partition key)
created_at      TIMESTAMPTZ
```
Partitions: `2026_Q1`, `2026_Q2`, `2026_Q3`, `2026_Q4`, `2027_Q1_plus`

#### `dns.schedules`
```sql
id              UUID PRIMARY KEY
tenant_id       UUID
profile_id      UUID UNIQUE
grid            JSONB  -- { "monday": [false×24], "tuesday": [...], ... }
active_preset   VARCHAR (SCHOOL/BEDTIME/STRICT/WEEKEND/null)
override_active BOOLEAN DEFAULT FALSE
override_type   VARCHAR (ALLOW/BLOCK)
override_ends_at TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `rewards.tasks`
```sql
id              UUID PRIMARY KEY
tenant_id       UUID
profile_id      UUID (child profile)
created_by      UUID (parent user)
title           VARCHAR
description     TEXT
reward_points   INT
reward_minutes  INT
due_date        DATE
recurrence      VARCHAR (ONCE/DAILY/WEEKLY) DEFAULT 'ONCE'
status          VARCHAR (PENDING/SUBMITTED/APPROVED/REJECTED) DEFAULT 'PENDING'
active          BOOLEAN DEFAULT TRUE
submitted_at    TIMESTAMPTZ
approved_at     TIMESTAMPTZ
approved_by     UUID
rejection_note  TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

---

## 10. DNS Filtering Engine

### Content Categories (43 total)

Categories are stored in `dns.dns_rules.enabled_categories` as a JSONB object:

| Group | Categories |
|---|---|
| **Ads & Tracking** | ads, trackers |
| **Adult** | adult, dating, gambling |
| **Security** | malware, phishing, spyware, cryptomining, ransomware |
| **Social** | social_media, chat, forums |
| **Entertainment** | gaming, streaming, music, video |
| **Productivity** | news, shopping, sports |
| **Lifestyle** | food, travel, health, fitness |
| **Youth Safety** | csam, tor, vpn, proxy, p2p |
| **Communication** | email, voip, messaging |
| **Finance** | crypto, fintech |
| **Tech** | software, cloud_storage |

### Filter Level Presets

| Level | What's Blocked by Default |
|---|---|
| **Safe (MILD)** | Malware, phishing, adult, CSAM, gambling |
| **Moderate** | + Ads, social media, gaming during school hours |
| **Strict** | + All entertainment, social, streaming, forums |
| **Custom** | Exactly what parent configures |

### Schedule Presets

| Preset | Effect |
|---|---|
| **SCHOOL** | Block gaming, social, streaming Mon–Fri 8:00–15:00 |
| **BEDTIME** | Block everything 21:00–07:00 |
| **STRICT** | Block all non-educational content all day |
| **WEEKEND** | Relaxed: allow gaming/streaming, block adult only |

### DNS Flow (Per Query)

```
1. Child device generates DNS query for domain.com
2. ShieldVpnService TUN intercepts UDP port 53
3. DNS wire-format packet forwarded via protected HTTPS socket to:
   https://shield.rstglobal.in/dns/{clientId}/dns-query
4. AdGuard Home processes with per-client filtering rules for that dnsClientId
5. If domain matches blocklist → NXDOMAIN response
6. If domain allowed → forward to upstream DNS (Google 8.8.8.8 / Cloudflare 1.1.1.1)
7. Response forwarded back through TUN to device
8. Query logged to analytics.dns_query_logs (async)
```

### DoH URL Format

```
https://{dnsClientId}.dns.shield.rstglobal.in/dns-query
e.g. https://jake-a3f9.dns.shield.rstglobal.in/dns-query
```

When AdGuard is enabled (`ADGUARD_ENABLED=true`), the DNS service syncs per-profile rules to AdGuard's client-specific filtering configuration.

---

## 11. Location & Geofencing

### Location Update Flow

```
Child device (background)
    ↓  every 5 minutes (or on movement)
POST /internal/location/update { profileId, lat, lng, accuracy, battery, speed }
    ↓
LocationService saves to location_points (partitioned table)
    ↓
Geofence breach detection:
  - For each active geofence for this profile
  - Check if point is inside/outside circle (Haversine formula)
  - If state changed: INSERT geofence_events + notify parent via WebSocket + FCM
    ↓
WebSocket STOMP broadcast to /topic/location/{parentUserId}
    ↓
Parent app/dashboard updates live map
```

### SOS Flow

```
Child taps SOS button
    ↓
POST /internal/sos/trigger { profileId, lat, lng, message }
    ↓
SOS event created (status: ACTIVE)
    ↓
FCM + WebSocket broadcast to parent (HIGH priority push)
    ↓
Parent sees SOS banner in app + receives push notification
    ↓
Parent taps "Acknowledge" → ACKNOWLEDGED
Parent taps "Resolved" → RESOLVED
```

### GPS Spoofing Detection

The location service flags suspicious updates:
- Speed > 250 km/h between consecutive points
- Altitude jump > 5000m in < 60 seconds
- Accuracy ≤ 3m (GPS spoofing apps often report perfect accuracy)
- GPS coordinates matching known simulator defaults (37.4219°N 122.0840°W etc.)

---

## 12. Rewards & Gamification

### Task Lifecycle

```
Parent creates task
  (title, description, rewardPoints, rewardMinutes, dueDate)
         ↓
   Status: PENDING
         ↓
Child marks complete
  POST /rewards/tasks/{id}/complete?profileId=X
         ↓
   Status: SUBMITTED
         ↓
Parent reviews ────────┬──────────────
                       ↓              ↓
              Parent approves    Parent rejects
  POST /tasks/{id}/approve   POST /tasks/{id}/reject
                       ↓              ↓
              Status: APPROVED   Status: REJECTED
                       ↓
        RewardBankService.creditReward()
          + balance += points
          + screenTimeCredited += minutes
          + streak days updated
          + achievement check (5-task streak = STREAK badge, etc.)
          + FCM push to child: "Task approved! +10 points"
```

### Reward Points & Redemption

- Points are credited per approved task
- Redemption: `POST /rewards/bank/{profileId}/redeem { points, minutes }`
  - Deducts points, credits bonus screen time to time budget
- Bonus: Parent can grant ad-hoc points `POST /rewards/{profileId}/bonus`

### Achievements (Badges)

| Badge | Trigger |
|---|---|
| `FIRST_TASK` | First task approved |
| `STREAK_5` | 5 consecutive days with at least one approved task |
| `STREAK_30` | 30-day streak |
| `POINTS_100` | Lifetime 100 points earned |
| `POINTS_1000` | Lifetime 1000 points earned |

---

## 13. AI & Analytics

### AI Service (Python FastAPI, Port 8291)

**File:** `/var/www/ai/FamilyShield/shield-ai/`
**Stack:** FastAPI + scikit-learn + httpx (Claude API) + DeepSeek API

#### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service health |
| POST | `/anomaly/train` | Train Isolation Forest on profile's DNS history |
| POST | `/anomaly/detect` | Score current DNS pattern vs baseline |
| POST | `/insights/summary` | Generate LLM behavioural summary |
| POST | `/insights/recommendations` | Generate parental recommendations |
| GET | `/models` | List trained models |

#### Anomaly Detection

```
Input: DNS query logs for last 7 days (domain, category, time, blocked/allowed)
Algorithm: Isolation Forest (scikit-learn)
Features:
  - Queries per hour of day (24-dim vector)
  - Category distribution (43-dim)
  - Blocked ratio
  - Unique domains per hour
Output: anomaly_score (0.0–1.0), is_anomalous (bool), triggered_at

Auto-trains on first request if no model exists for profile.
Re-trains weekly via scheduled job.
```

#### LLM Insights

The service calls Claude (primary) with fallback to DeepSeek:

```
Prompt template:
  "This child's internet activity for the week:
   - Top domains: {list}
   - Blocked attempts: {count} across {categories}
   - Screen time distribution: {chart}
   Generate a brief, age-appropriate behavioural summary
   and 3 actionable recommendations for parents."
```

### Analytics Service (Port 8289)

**Daily Aggregation Job** (scheduled 02:00 UTC):
- Queries `analytics.dns_query_logs` grouped by `(profile_id, DATE(queried_at))`
- Computes: total, blocked, allowed counts + top 10 domains + category breakdown
- Upserts into `analytics.usage_summaries`

**Frontend Charts:**
- `WeeklyBarChart` — last 7 days blocked vs allowed queries
- `BlockTrendLine` — 30-day blocking trend
- `UsageRingChart` — category breakdown donut
- `ActivityPage` — paginated raw query log with domain, category, status, time

---

## 14. Billing & Subscriptions

### Subscription Plans

| Plan | Max Profiles | Features |
|---|---|---|
| Basic | 1 | DNS filtering, basic reports |
| Family | 5 | + Location, Geofences, Rewards, AI insights |
| ISP Enterprise | Unlimited | + White-label, tenant management, CRM, bulk import |

Plans are created by GLOBAL_ADMIN in `admin.subscription_plans` with Stripe product/price IDs.

### Checkout Flow (Stripe)

```
Customer clicks "Upgrade"
    ↓
POST /api/v1/admin/billing/checkout { planId, successUrl, cancelUrl }
    ↓
BillingService creates/fetches Stripe Customer
    ↓
Creates Stripe Checkout Session (INR currency)
    ↓
Returns { checkoutUrl }
    ↓
Client redirects to Stripe hosted checkout page
    ↓
User pays → Stripe sends webhook POST /api/v1/admin/webhooks/stripe
    ↓
Shield webhook handler:
  - Verifies Stripe signature
  - On checkout.session.completed:
      UPDATE profile.customers SET subscription_status = 'ACTIVE', plan = X
      INSERT admin.invoices { amount, status: PAID, stripe_invoice_id }
      Send email: invoice-paid + subscription-confirmed templates
  - On invoice.payment_failed:
      UPDATE subscription_status = 'PAST_DUE'
      Send payment failure email
```

### Invoice PDF (3-tier fallback)

1. Try `invoice.pdf_url` from Stripe invoice object
2. Generate PDF in-memory using Java PDF library (iText)
3. Return plain-text invoice as application/pdf fallback

---

## 15. Notifications & Alerts

### Delivery Channels

| Channel | Implementation | Use Case |
|---|---|---|
| **FCM Push** | Firebase Cloud Messaging | Alerts, SOS, task updates (high priority) |
| **WebSocket** | STOMP over `/ws/shield-ws` | Live map updates, real-time alerts |
| **Email** | SMTP (configurable per tenant) | Weekly digest, billing events, invitations |
| **In-App** | `notification.notifications` table | All notification history (badge count) |

### Notification Types

| Type | Trigger | Channels |
|---|---|---|
| `GEOFENCE_BREACH` | Child enters/exits geofence | FCM + WebSocket + in-app |
| `SOS_ALERT` | Child triggers SOS | FCM (HIGH) + WebSocket + in-app |
| `TASK_SUBMITTED` | Child marks task complete | FCM + in-app |
| `TASK_APPROVED` | Parent approves task | FCM + in-app |
| `TIME_LIMIT_WARNING` | 15 min / 5 min remaining | FCM + in-app |
| `TIME_LIMIT_REACHED` | Budget exhausted | FCM + in-app |
| `AI_ANOMALY` | Unusual DNS pattern detected | FCM + in-app |
| `DEVICE_OFFLINE` | No heartbeat for 30 min | in-app |
| `WEEKLY_DIGEST` | Every Monday 08:00 | Email only |
| `INVOICE_PAID` | Stripe payment confirmed | Email + in-app |

### Weekly Digest Email

Sent every Monday at 08:00 by `WeeklyDigestService`:
- Top 5 blocked domains this week
- Screen time usage vs limit
- Completed tasks count
- Geofence events
- Any SOS events

---

## 16. Infrastructure & DevOps

### Systemd Services

All 13 Java microservices run as systemd units:

```
shield-eureka.service       (8261)
shield-config.service       (8288)
shield-gateway.service      (8280)
shield-auth.service         (8281)
shield-tenant.service       (8282)
shield-profile.service      (8283)
shield-dns.service          (8284)
shield-location.service     (8285)
shield-notification.service (8286)
shield-rewards.service      (8287)
shield-analytics.service    (8289)
shield-admin.service        (8290)
shield-ai.service           (8291) ← Python FastAPI with .venv
```

All services use:
- `User=root` (required for Java 21 on this server)
- `EnvironmentFile=/var/www/ai/FamilyShield/.env`
- JVM flags: G1GC, 512MB–1GB heap
- Auto-restart on failure

### Docker Containers

| Container | Port | Purpose |
|---|---|---|
| adguard-home | DNS 3053, Admin 3443 | DNS filtering engine |
| prometheus | 9190 | Metrics scraping |
| grafana | 3190 | Metrics dashboards |
| zipkin | 9412 | Distributed tracing |
| vector | — | Log pipeline: AdGuard → PostgreSQL |

### Nginx Configuration

```nginx
/                 → shield-website (static HTML)
/app/             → shield-dashboard (React SPA)
/api/v1/          → gateway :8280 (proxy_pass)
/ws/              → gateway :8280 (WebSocket upgrade)
/docs/            → gateway :8280 (Swagger UI)
/static/          → /var/www/ai/FamilyShield/static/ (APK download)
/dns/             → adguard-home :3053 (DoH proxy)
```

SSL: Let's Encrypt (expires 2026-06-02, auto-renew via certbot)

### PostgreSQL HA (Patroni)

- Primary at port 5454 or 5455 (swaps on failover)
- HAProxy at port 5432 always routes to current primary
- All services use port 5432 to avoid reconfiguration on failover

### Redis

- Single instance, port 6379, no password
- Key namespaces: `shield:auth:blacklist:*`, `shield:auth:refresh:*`, `shield:rate:*`
- All keys prefixed `shield:` to avoid collision with other apps on same server

---

## 17. Security Model

### Authentication Security

| Control | Implementation |
|---|---|
| Password hashing | BCrypt with cost factor 12 |
| JWT algorithm | HS512 (64-char / 512-bit secret) |
| JWT expiry | Access: 24h, Child: 365d |
| Refresh tokens | UUID stored in Redis with 30-day TTL |
| Token revocation | Redis blacklist checked on every request |
| MFA | TOTP (RFC 6238) — Google Authenticator compatible |
| Account lockout | 5 failed attempts → 15-minute lockout |
| Password reset | OTP via email, 10-minute expiry |

### API Security

| Control | Implementation |
|---|---|
| JWT validation | Gateway filter (order: -100, runs before all routes) |
| Header injection | Gateway replaces Authorization with X-User-Id etc. |
| Rate limiting | Nginx `limit_req_zone` (shared with other apps) |
| CORS | Configured per environment on gateway |
| CSRF | Disabled (stateless JWT API) |
| SQL injection | Parameterised queries via Hibernate JPA |
| XSS | React auto-escapes; no raw HTML rendering |
| Secrets | Stored in `/var/www/ai/FamilyShield/.env`, loaded via systemd EnvironmentFile |

### Data Privacy

| Control | Implementation |
|---|---|
| GDPR export | `POST /admin/compliance/export/{userId}` — exports all user data as JSON |
| Right to forget | `POST /admin/compliance/forget/{userId}` — anonymises all PII |
| Audit trail | Every admin action logged to `admin.audit_logs` with before/after values |
| Data partitioning | Each tenant's data isolated by `tenant_id` in every table |
| Child data | Location points and DNS logs partitioned quarterly; old partitions can be dropped |

### VPN / DNS Security

| Control | Implementation |
|---|---|
| DNS interception | VPN TUN interface — no root required on Android |
| Loop prevention | `protect(socket)` on DoH connection socket — bypasses VPN routing |
| DoH bypass blocking | Routes Google/Cloudflare/Quad9 IP addresses through VPN, forcing UDP fallback |
| GPS spoofing detection | Speed, accuracy, and altitude heuristics flag suspicious location updates |

---

## Appendix A — Environment Variables (.env)

| Variable | Purpose |
|---|---|
| `DB_PASSWORD` | PostgreSQL password for `shield` user |
| `JWT_SECRET` | HS512 secret (64 chars minimum) |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature secret |
| `ANTHROPIC_API_KEY` | Claude API key for AI insights |
| `DEEPSEEK_API_KEY` | DeepSeek fallback API key |
| `GOOGLE_MAPS_API_KEY` | Maps for geofences (dashboard) |
| `SMTP_HOST` | Email server hostname |
| `SMTP_PORT` | Email server port |
| `SMTP_USER` | Email auth username |
| `SMTP_PASS` | Email auth password |
| `SMTP_FROM` | Sender address |
| `ADGUARD_ENABLED` | `true` to enable AdGuard sync |
| `ADGUARD_URL` | AdGuard admin URL |
| `ADGUARD_USER` | AdGuard username |
| `ADGUARD_PASSWORD` | AdGuard password |
| `APP_DOMAIN` | `shield.rstglobal.in` |
| `EUREKA_PASSWORD` | Eureka registry password |

---

## Appendix B — Admin Credentials

| System | URL | Credentials |
|---|---|---|
| Shield Admin Portal | https://shield.rstglobal.in/app/admin/dashboard | admin@rstglobal.in / Shield@Admin2026# |
| Grafana | http://server:3190 | admin / (set on first login) |
| AdGuard Home | http://server:3443 | (set on first login) |
| Eureka | http://server:8261 | eureka / ShieldEureka2026 |

---

*Shield Platform — Built by RST Global · Powered by Spring Boot 4.x, Flutter 3.41, React 19*
