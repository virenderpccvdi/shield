# Shield React Dashboard Audit Report
**Date:** 2026-04-12 | **Auditor:** Claude | **Path:** `/var/www/ai/FamilyShield/shield-dashboard/`

---

## Architecture Overview

The Shield dashboard is a React 19 SPA built with Vite 6, MUI v7, Zustand 5 for state management, TanStack React Query 5 for server state, and react-router-dom 7. It serves three role-based experiences (Customer, ISP Admin, Global Admin) from a single codebase using role-gated route wrappers. All 120+ pages are lazy-loaded via `React.lazy()`. The app communicates with the backend through an Axios client with JWT auth, automatic token refresh, and correlation ID injection. Real-time updates flow via STOMP WebSocket.

## File Structure & Component Count

| Category            | Count |
|---------------------|-------|
| Total source files  | 150   |
| TSX components      | 126   |
| TS modules          | 21    |
| Customer pages      | 42    |
| Global Admin pages  | 27    |
| ISP Admin pages     | 22    |
| Auth pages          | 5     |
| Shared components   | 15    |
| Layouts             | 3     |
| Hooks               | 4     |
| Zustand stores      | 4     |
| API modules         | 7     |
| i18n files          | 3     |

**Directory structure:**
```
src/
  api/          — axios client + domain API modules (auth, profile, dns, location, rewards, analytics, billing)
  components/   — shared UI (ErrorBoundary, StatCard, charts, dialogs, skeletons)
  hooks/        — useWebSocket, useRealtimeSync, useJwt, useRoleGuard
  i18n/         — en.json, hi.json + config
  layouts/      — CustomerLayout, AdminLayout, IspLayout (sidebar + appbar + outlet)
  pages/        — auth/, customer/, admin/, global-admin/, isp-admin/, shared
  store/        — auth, theme, alert, profile (Zustand)
  theme/        — MUI theme with "Guardian's Lens" design system
```

## Top 10 Issues

### 1. Hardcoded WebSocket URL (Severity: HIGH)
**File:** `src/hooks/useRealtimeSync.ts:28`
The fallback WebSocket URL is hardcoded to `wss://shield.rstglobal.in/ws`. If `VITE_WS_URL` is unset in production, this works by coincidence, but it blocks staging/dev environments and is fragile. Should derive from `window.location.host` like `useWebSocket.ts` already does.

### 2. Hardcoded Domain in Multiple Pages (Severity: HIGH)
**Files:** `DevicesPage.tsx:99`, `SystemHealthPage.tsx:111`, `NotificationChannelsPage.tsx:205`
The domain `shield.rstglobal.in` is hardcoded in DNS URL construction and APK download URLs. These should be centralized in a config constant or environment variable.

### 3. Pervasive `any` Types (Severity: MEDIUM)
**188 occurrences across 40 files.** API modules like `profile.api.ts`, `dns.api.ts`, `auth.api.ts` use `(data: any)` extensively. This defeats TypeScript's safety guarantees for API payloads and reduces IDE autocompletion value. Critical API interfaces should be typed.

### 4. `useRoleGuard` Hook is Dead Code (Severity: LOW)
**File:** `src/hooks/useRoleGuard.ts`
This hook is defined but never imported by any page. Role guarding is handled entirely by `PrivateRoute`, `AdminRoute`, and `IspRoute` in `App.tsx`. The hook can be removed or the routing approach unified.

### 5. Auth Tokens Persisted in localStorage (Severity: MEDIUM)
**File:** `src/store/auth.store.ts`
Zustand's `persist` middleware stores `accessToken` and `refreshToken` in `localStorage` (key: `shield-auth`). This is vulnerable to XSS. While httpOnly cookies would be ideal, at minimum the refresh token should not be stored in localStorage. The access token's short TTL mitigates risk somewhat.

### 6. Low Accessibility Coverage (Severity: MEDIUM)
Only 22 `aria-label`/`aria-*` attribute usages across 10 files out of 126 TSX files. Key gaps:
- Sidebar navigation items lack `aria-current="page"` for active state
- Section collapse toggles lack `aria-expanded`
- The search bar has good `aria-label` but most icon-only buttons across pages lack labels
- Bottom navigation on mobile lacks meaningful `aria-label` attributes
- No skip-to-content link

### 7. Customer Layout Can Access ISP/Admin Routes (Severity: MEDIUM)
**File:** `src/App.tsx:218`
Customer routes (`/dashboard`, `/profiles`, etc.) use `PrivateRoute` which only checks `isAuthenticated()`. A `GLOBAL_ADMIN` user can navigate to `/dashboard` and see the customer layout. The `AdminRoute` and `IspRoute` redirect away from wrong roles, but `PrivateRoute` does not. An admin manually navigating to `/profiles` would see the customer view.

### 8. Notification Permission Request at Module Level (Severity: LOW)
**File:** `src/hooks/useRealtimeSync.ts:8-9`
`Notification.requestPermission()` is called at module import time (top-level side effect). This triggers the browser permission prompt before the user has context. Best practice is to request after a user interaction (e.g., clicking "Enable notifications").

### 9. No Test Files Exist (Severity: HIGH)
Zero test files (`*.test.tsx`, `*.spec.ts`) in the entire `src/` directory. No testing library in `package.json` (no vitest, jest, or testing-library). For a 126-component app handling auth, billing, and child safety, this is a significant risk.

### 10. Duplicate Animation Definitions (Severity: LOW)
**Files:** `src/index.css` and `src/theme/theme.ts`
Keyframe animations (`fadeInUp`, `fadeIn`, `slideInLeft`, `shimmer`) are defined in both the CSS file and the MUI `CssBaseline` overrides. Additionally, `LoginPage.tsx` defines its own `@keyframes` inline. Should consolidate to one source.

## Mobile Responsiveness Assessment

**Rating: Good**

Strengths:
- `CustomerLayout` has a proper mobile implementation: temporary drawer, bottom navigation bar (5 items), responsive padding
- Search bar hidden at xs breakpoint, simplified at sm
- Toolbar and content areas use responsive `sx` props (`xs`/`md` breakpoints)
- `useMediaQuery(breakpoints.down('md'))` correctly drives mobile layout
- Bottom nav padding (`pb: '76px'` on xs) prevents content from being hidden behind the fixed bottom bar

Weaknesses:
- Bottom navigation `value` state is not synced with the actual route (purely local state via `useState(0)`). Navigating via sidebar then opening bottom nav shows incorrect active tab.
- No landscape-specific handling. On mobile landscape, the 60px toolbar + 60px bottom nav consume significant vertical space.
- `NotFoundPage` uses hardcoded `bgcolor: '#F8FAFC'` instead of theme token, so dark mode renders incorrectly.

## Bundle Size Analysis

**Total dist/assets size: 3.0 MB** (121 JS chunks + 1 CSS file)

| Chunk | Size | Notes |
|-------|------|-------|
| vendor-mui | 588 KB | Largest; MUI + Emotion. Expected for MUI v7. |
| vendor-charts | 360 KB | Recharts + D3. Only loaded on chart pages. |
| vendor-misc | 200 KB | Remaining node_modules (Stripe, STOMP, dayjs, etc.) |
| vendor-react | 192 KB | React 19 + ReactDOM + Router + Scheduler |
| index (app shell) | 84 KB | Main bundle with routes, layouts, theme |
| vendor-query | 80 KB | TanStack Query + Axios + Zustand |
| vendor-i18n | 56 KB | i18next |
| vendor-maps | 24 KB | Google Maps wrapper (small; actual SDK loaded at runtime) |

**Assessment:** Well-structured. The `manualChunks` in vite.config.ts does a thorough job of splitting vendors into cacheable groups. All 120+ pages are code-split via `React.lazy`. The largest page chunk is `CustomerDashboardPage` at 40 KB. No individual page exceeds 32 KB except the dashboard. Total vendor payload is ~1.5 MB which is typical for an MUI + charting app. Gzip would bring this to ~400-500 KB transferred.

**Note:** `sourcemap: false` in production build is correct. `chunkSizeWarningLimit: 600` is set, only vendor-mui exceeds it.

## Recommendations (Top 5)

1. **Add a test framework and write critical-path tests.** Install vitest + @testing-library/react. Prioritize: auth flow (login/logout/token refresh), role-based routing, and the API interceptor (401 handling, queue drain). This is the single highest-value improvement.

2. **Centralize environment configuration.** Create a `src/config.ts` that exports `API_URL`, `WS_URL`, `DOMAIN`, `APK_URL` etc., derived from `import.meta.env` with sensible fallbacks using `window.location`. Eliminate all scattered hardcoded domains.

3. **Type the API layer.** Replace `any` in API modules with proper request/response interfaces. Start with `auth.api.ts` and `profile.api.ts` which are the most used. This will catch breaking backend changes at compile time.

4. **Improve accessibility.** Add `aria-current="page"` to active nav items, `aria-expanded` to collapsible sections, `aria-label` to all icon-only buttons, and a skip-to-content link. Consider an automated a11y audit with axe-core.

5. **Fix bottom navigation route sync.** The `bottomNav` state in `CustomerLayout` should derive from `location.pathname` rather than being independent local state. Map routes to nav indices using a lookup, or use react-router's location to set the active tab.
