# 07 — Web Dashboard

## Overview

The Shield web dashboard is a **React 19 + TypeScript** SPA served by Nginx from:
```
/var/www/ai/FamilyShield/shield-dashboard/dist/
```

It serves all four roles — Global Admin, ISP Admin, Customer (parent), — each seeing a different layout based on their JWT role.

---

## Tech Stack

| Component | Version (2026) |
|-----------|----------------|
| React | **19.2.4** |
| TypeScript | **5.7.x** |
| MUI (Material UI) | **v7.3.8** |
| Zustand (state) | **5.0.x** |
| Axios | **1.7.x** |
| React Query (TanStack) | **5.x** |
| Recharts | **2.15.x** |
| Leaflet + react-leaflet | **4.2.x** |
| Vite | **6.2.x** |
| Node.js (build) | **25.6.1** |
| React Router | **7.x** (or go via React 19 built-in) |

---

## Project Structure

```
/var/www/ai/FamilyShield/shield-dashboard/
├── src/
│   ├── main.tsx                — Vite entry point
│   ├── App.tsx                 — BrowserRouter + theme provider
│   ├── theme/
│   │   ├── theme.ts            — MUI v7 theme (Shield primary: #1976D2)
│   │   └── tenant-theme.ts     — Dynamic tenant branding support
│   ├── api/
│   │   ├── axios.ts            — Axios instance + interceptors
│   │   ├── auth.api.ts
│   │   ├── profile.api.ts
│   │   ├── dns.api.ts
│   │   ├── location.api.ts
│   │   ├── analytics.api.ts
│   │   └── rewards.api.ts
│   ├── store/
│   │   ├── auth.store.ts       — Zustand: user, token, tenant
│   │   ├── profile.store.ts    — Selected child, profile list
│   │   └── alert.store.ts      — Unread alert count, live alerts
│   ├── layouts/
│   │   ├── AdminLayout.tsx     — Global Admin sidebar layout
│   │   ├── IspLayout.tsx       — ISP Admin sidebar layout
│   │   └── CustomerLayout.tsx  — Customer layout (child cards top)
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── ForgotPasswordPage.tsx
│   │   ├── global-admin/
│   │   │   ├── PlatformDashboardPage.tsx
│   │   │   ├── TenantsPage.tsx
│   │   │   ├── TenantDetailPage.tsx
│   │   │   ├── GlobalBlocklistPage.tsx
│   │   │   └── AiModelsPage.tsx
│   │   ├── isp-admin/
│   │   │   ├── IspDashboardPage.tsx
│   │   │   ├── CustomersPage.tsx
│   │   │   ├── CustomerDetailPage.tsx
│   │   │   ├── BrandingPage.tsx
│   │   │   └── IspBlocklistPage.tsx
│   │   └── customer/
│   │       ├── CustomerDashboardPage.tsx
│   │       ├── ChildProfilePage.tsx
│   │       ├── ActivityPage.tsx
│   │       ├── RulesPage.tsx
│   │       ├── SchedulePage.tsx
│   │       ├── TimeLimitsPage.tsx
│   │       ├── LocationMapPage.tsx
│   │       ├── LocationHistoryPage.tsx
│   │       ├── GeofencesPage.tsx
│   │       ├── AlertsPage.tsx
│   │       ├── AiInsightsPage.tsx
│   │       ├── RewardsPage.tsx
│   │       ├── DevicesPage.tsx
│   │       ├── ReportsPage.tsx
│   │       └── SettingsPage.tsx
│   ├── components/
│   │   ├── charts/
│   │   │   ├── UsageRingChart.tsx     — Daily budget ring (Recharts)
│   │   │   ├── WeeklyBarChart.tsx     — 7-day usage bars
│   │   │   └── BlockTrendLine.tsx     — Block count over time
│   │   ├── map/
│   │   │   ├── LiveMapView.tsx        — Leaflet map with child pins
│   │   │   ├── GeofenceDrawer.tsx     — Draw circle/polygon
│   │   │   └── LocationHistory.tsx   — Route playback
│   │   ├── dns/
│   │   │   ├── LiveActivityFeed.tsx   — WebSocket DNS query stream
│   │   │   └── CategoryToggles.tsx   — 80+ category switches
│   │   ├── schedule/
│   │   │   └── ScheduleGrid.tsx      — 24h×7 drag-paint grid
│   │   └── shared/
│   │       ├── ChildCard.tsx          — Profile card on dashboard
│   │       ├── AlertBanner.tsx
│   │       └── LoadingOverlay.tsx
│   └── hooks/
│       ├── useWebSocket.ts            — STOMP WebSocket connection
│       ├── useJwt.ts                  — Parse JWT, check expiry
│       └── useRoleGuard.ts            — Redirect if wrong role
├── public/
│   ├── favicon.ico
│   └── shield-logo.svg
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Pages — Customer Role

### Customer Dashboard (`/dashboard`)

```
┌──────────────────────────────────────────────────────────────────┐
│  Shield      [🔔 3]   [Account ▾]                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │ Jake           │  │ Emma           │  │  + Add Child   │    │
│  │ ● Online       │  │ ○ Offline      │  │                │    │
│  │ YouTube 1h32m  │  │ Last seen 15m  │  │                │    │
│  │ 3 blocks today │  │ 0 blocks today │  │                │    │
│  │ [ PAUSE ]      │  │ [ PAUSE ]      │  │                │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
│                                                                  │
│  Recent Alerts                                                   │
│  • Jake tried to access tiktok.com — BLOCKED         [2 min ago]│
│  • Emma arrived at School                            [8:12am]   │
│  • Jake's battery at 18%                             [1h ago]   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

### Child Rules Page (`/profiles/:id/rules`)

```
Content Categories
────────────────────────────────────────────
[🔞 Adult Content     ] [OFF] ────────────────
[🎰 Gambling          ] [OFF]
[🎮 Gaming            ] [ON ]  → Time limit: 3h/day
[📱 Social Media      ] [ON ]  → Time limit: 2h/day
[📺 Streaming         ] [ON ]  → Time limit: 2h/day
[💊 Drugs             ] [OFF]
[🔫 Violence/Weapons  ] [OFF]
[🦠 Malware           ] [ALWAYS ON — cannot disable]
[🎣 Phishing          ] [ALWAYS ON — cannot disable]
[🔒 VPN/Proxy         ] [OFF]

Safety Features
────────────────────────────────────────────
[✓] Force SafeSearch (Google, Bing, DuckDuckGo)
[✓] YouTube Restricted Mode
[✓] Block Ad Networks & Trackers
[✓] Block Cryptocurrency Sites

Custom Allow List
────────────────────────────────────────────
+ school.edu    + khanacademy.org
[ + Add domain... ]

Custom Block List
────────────────────────────────────────────
+ fortnite.com
[ + Add domain... ]
```

---

### Schedule Builder Page (`/profiles/:id/schedules`)

```
Visual 24h × 7-day schedule grid

          12am 1  2  3  4  5  6  7  8  9 10 11 12 1pm 2  3  4  5  6  7  8  9 10 11
Monday   [  blocked  ][  allowed  ][     blocked - school    ][  allowed  ][blocked]
Tuesday  [  blocked  ][  allowed  ][     blocked - school    ][  allowed  ][blocked]
...

Legend: ■ Internet blocked  □ Internet allowed

Quick presets: [School Hours] [Bedtime] [Weekend] [Homework Mode] [Reset All]

Modes (toggle below grid):
[ ] Homework Mode — block social & gaming, allow educational
[ ] Focus Mode — all blocked except whitelist
[ ] Dinner Mode — all blocked (6pm–7pm daily)
```

---

### Live Activity Feed (`/profiles/:id/activity`)

Real-time WebSocket stream rendered as a virtual scrolling list:

```
[17:32:14] youtube.com             ✓ ALLOWED     Gaming   Jake's iPhone
[17:32:15] googlevideo.com         ✓ ALLOWED     Video    Jake's iPhone
[17:32:18] tiktok.com              ✗ BLOCKED     Social   Jake's iPhone  [Allow]
[17:32:19] ads.doubleclick.net     ✗ BLOCKED     Ads      Jake's iPhone
[17:32:22] roblox.com              ✗ BLOCKED     Gaming   Jake's iPhone  [Allow]
```

Filters: All / Blocked Only / Allowed Only | Search domain | Time range

---

### GPS Map Page (`/map`)

Leaflet map centred on the furthest child from home. Options:
- Toggle satellite / street view
- All children shown simultaneously
- Tap marker → child info card
- Draw geofence button (circle or polygon)
- "Show History" → route playback for selected child

---

## Pages — ISP Admin Role

### ISP Dashboard

Summary cards:
- Total active customers
- New accounts this week
- Top blocked categories
- Customer satisfaction NPS

Customer table: searchable, sortable, click to drill into customer.

### Branding Page (`/isp/branding`)

Live preview of ISP white-label config:
- App name, logo upload, primary/secondary colour picker
- Support email and URL
- Privacy policy and Terms of Service URL
- "Preview Flutter Theme" button — shows mock screenshots

---

## Pages — Global Admin Role

### Platform Dashboard (`/admin/dashboard`)

System-wide metrics:
- Total ISP tenants (active / suspended)
- Total customers across all tenants
- Total DNS queries today
- Global block rate
- AI alert volume
- Infrastructure health (services up/down)

### Tenant Management (`/admin/tenants`)

DataGrid with: ISP name, plan, customers, status, feature flags.
Click → Tenant Detail: edit plan, edit feature flags, view stats, billing.

---

## WebSocket Connection

```typescript
// src/hooks/useWebSocket.ts
import { Client } from '@stomp/stompjs';

export function useWebSocket(customerId: string) {
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    const stompClient = new Client({
      brokerURL: `wss://shield.rstglobal.in/ws/shield-ws`,
      onConnect: () => {
        stompClient.subscribe(`/topic/alerts/${customerId}`, (msg) => {
          const alert = JSON.parse(msg.body);
          useAlertStore.getState().addAlert(alert);
        });
      },
      reconnectDelay: 5000,
    });
    stompClient.activate();
    setClient(stompClient);
    return () => stompClient.deactivate();
  }, [customerId]);

  return client;
}
```

---

## Build & Deploy

```bash
cd /var/www/ai/FamilyShield/shield-dashboard

# Install dependencies
npm install

# Build for production
npm run build
# Output: dist/ folder

# Nginx serves dist/ automatically — no restart needed
# Just copy the built files to the nginx root:
# /var/www/ai/FamilyShield/shield-dashboard/dist/
```

**vite.config.ts:**
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8280',  // Dev: proxy to API gateway
      '/ws': { target: 'ws://localhost:8286', ws: true }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,   // No source maps in production
    chunkSizeWarningLimit: 1000,
  }
})
```
