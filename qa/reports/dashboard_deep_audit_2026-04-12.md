# Shield React Dashboard — Deep Audit Report
**Date:** 2026-04-12
**Auditor:** Senior Frontend Review (Claude Opus 4.6)
**Codebase:** `/var/www/ai/FamilyShield/shield-dashboard/`

---

## 1. Tech Stack Verification

| Dependency | Declared | Status |
|---|---|---|
| React | ^19.2.5 | OK |
| MUI Material | ^7.3.8 | OK |
| MUI X Date Pickers | ^8.27.2 | OK |
| Vite | ^6.2.0 | OK |
| Zustand | ^5.0.3 | OK |
| TanStack Query | ^5.97.0 | OK |
| react-router-dom | ^7.14.0 | OK |
| recharts | ^2.15.0 | OK |
| i18next | ^25.8.14 | OK |
| @stomp/stompjs | ^7.0.0 | OK |
| @stripe/stripe-js | ^8.9.0 | OK |
| @vis.gl/react-google-maps | ^1.7.1 | OK |
| dayjs | ^1.11.19 | OK |
| TypeScript | ^5.8.0 | OK |

---

## 2. Complete Page Inventory

### 2.1 Auth Pages (5 pages, public)
| Route | Component | Description |
|---|---|---|
| `/login` | LoginPage | Email/password + MFA/OTP flow |
| `/register` | RegisterPage | Name/email/password registration |
| `/forgot-password` | ForgotPasswordPage | Email-based password reset request |
| `/reset-password` | ResetPasswordPage | Token-based password reset |
| `/family/invite` | FamilyInviteAcceptPage | Accept family invite via token |
| `/co-parent/accept` | CoParentAcceptPage | Accept co-parent invitation |

### 2.2 Customer Pages (44 pages)
| Route | Component | Description |
|---|---|---|
| `/dashboard` | CustomerDashboardPage | Overview with child cards, stats, charts |
| `/profiles` | CustomerChildProfilesPage | List all child profiles |
| `/profiles/new` | NewChildProfilePage | Create new child profile |
| `/profiles/:profileId` | ChildProfilePage | Single child detail view |
| `/profiles/:profileId/activity` | ActivityPage | DNS activity log for a child |
| `/profiles/:profileId/rules` | RulesPage | DNS category rules per child |
| `/profiles/:profileId/schedules` | SchedulePage | Time schedules for a child |
| `/profiles/:profileId/rewards` | RewardsPage | Reward tasks per child |
| `/profiles/:profileId/reports` | ReportsPage | Weekly/daily reports per child |
| `/profiles/:profileId/apps` | ChildAppsPage | App list per child |
| `/time-limits` | TimeLimitsPage | Global time limit settings |
| `/geofences` | GeofencesPage | Manage geofence zones |
| `/location-history` | LocationHistoryPage | Historical location data |
| `/ai-insights` | AiInsightsPage | AI-generated insights |
| `/app-control` | AppControlPage | Content filter controls |
| `/devices` | CustomerDevicesPage | Manage linked devices |
| `/map` | LocationMapPage | Live Google Maps view |
| `/alerts` | AlertsPage | Alert feed with filtering |
| `/subscription` | SubscriptionPage | Subscription/plan management |
| `/billing/success` | CheckoutSuccessPage | Stripe checkout success |
| `/billing/cancel` | CheckoutCancelPage | Stripe checkout cancel |
| `/family-members` | FamilyMembersPage | Manage family members/invites |
| `/settings` | SettingsPage | Profile, password, MFA, notifications, data |
| `/homework` | HomeworkModePage | Homework mode activation |
| `/approvals` | ApprovalRequestsPage | Approve child requests |
| `/app-budgets` | AppBudgetsPage | App time budgets |
| `/safe-filters` | SafeFiltersPage | Safe search filters |
| `/emergency-contacts` | EmergencyContactsPage | Emergency contacts |
| `/bedtime` | BedtimeLockPage | Bedtime lock schedule |
| `/school-zone` | SchoolZonePage | School zone settings |
| `/family-rules` | FamilyRulesPage | Family-wide rules |
| `/battery-alerts` | BatteryAlertsPage | Battery level alerts |
| `/screen-time-requests` | ScreenTimeRequestsPage | Screen time extension requests |
| `/suspicious-activity` | SuspiciousActivityPage | Suspicious activity reports |
| `/co-parent` | CoParentPage | Co-parent management |
| `/app-usage` | AppUsagePage | App usage analytics |
| `/checkin-reminders` | CheckinReminderPage | Check-in reminder setup |
| `/browsing-history` | BrowsingHistoryPage | DNS browsing history |
| `/location-share` | LocationSharePage | Location sharing settings |
| `/ai-chat` | AiChatSettingsPage | AI chat configuration |
| `/access-schedule` | AccessSchedulePage | Internet access schedule |
| `/achievements` | AchievementsPage | Gamification achievements |
| `/safe-filters-report` | SafeFiltersReportPage | Safe filter analytics |

### 2.3 Global Admin Pages (30 pages)
| Route | Component | Description |
|---|---|---|
| `/admin/dashboard` | PlatformDashboardPage | Platform-wide stats, charts, tables |
| `/admin/alerts` | PlatformAlertsPage | Platform alerts (shared component) |
| `/admin/tenants` | TenantsPage | ISP tenant management |
| `/admin/tenants/:tenantId` | TenantDetailPage | Single tenant detail |
| `/admin/users` | UsersPage | User management |
| `/admin/users/:userId` | UserDetailPage | Single user detail |
| `/admin/dns-rules` | DnsRulesPage | Global DNS rule management |
| `/admin/analytics` | AdminAnalyticsPage | Admin analytics dashboard |
| `/admin/platform-analytics` | PlatformAnalyticsPage | Platform-wide analytics |
| `/admin/plans` | SubscriptionPlansPage | Subscription plan CRUD |
| `/admin/audit-logs` | AuditLogPage | Audit log viewer |
| `/admin/devices` | DevicesPage | Platform device inventory |
| `/admin/health` | SystemHealthPage | Service status, restart, logs |
| `/admin/notifications` | NotificationChannelsPage | Notification channel config |
| `/admin/child-profiles` | ChildProfilesPage | All child profiles platform-wide |
| `/admin/child-profiles/:profileId` | AdminChildDetailPage | Admin child detail view |
| `/admin/invoices` | InvoicesPage | Platform-wide invoices |
| `/admin/customers` | GlobalCustomersPage | All customers platform-wide |
| `/admin/customers/:id` | GlobalAdminCustomerDetailPage | Customer detail (admin view) |
| `/admin/blocklist` | GlobalBlocklistPage | Global domain blocklist |
| `/admin/ai-models` | AiModelsPage | AI model configuration |
| `/admin/ai-insights` | AdminAiInsightsPage | Admin AI insights |
| `/admin/features` | FeatureManagementPage | Feature flag management |
| `/admin/roles` | RolePermissionsPage | Role/permission matrix |
| `/admin/url-activity` | AdminUrlActivityPage | Platform URL activity |
| `/admin/app-control` | AdminAppControlPage | Platform app control |
| `/admin/leads` | LeadsPage | CRM lead management |
| `/admin/visitors` | VisitorsPage | Website visitor analytics |
| `/admin/isp-reports` | IspActivityReportPage | ISP activity reports |
| `/admin/settings` | SettingsPage | (reuses Customer SettingsPage) |
| `/admin/platform` | PlatformAdminPage | Platform admin tools |

### 2.4 ISP Admin Pages (24 pages)
| Route | Component | Description |
|---|---|---|
| `/isp/dashboard` | IspDashboardPage | ISP overview stats, charts |
| `/isp/live-dashboard` | IspLiveDashboardPage | Real-time live metrics |
| `/isp/alerts` | PlatformAlertsPage | ISP alerts (shared component) |
| `/isp/customers` | CustomersPage | ISP customer management |
| `/isp/customers/:id` | CustomerDetailPage | Customer detail |
| `/isp/customers/import` | BulkImportPage | Bulk CSV customer import |
| `/isp/branding` | BrandingPage | White-label branding |
| `/isp/analytics` | IspAnalyticsPage | ISP analytics dashboard |
| `/isp/billing` | IspBillingPage | ISP billing management |
| `/isp/plans` | IspPlansPage | ISP plan configuration |
| `/isp/my-plan` | IspMyPlanPage | ISP's own subscription |
| `/isp/blocklist` | IspBlocklistPage | ISP domain blocklist |
| `/isp/filtering` | IspFilteringPage | ISP DNS filtering rules |
| `/isp/dns` | IspDnsPage | ISP DNS management |
| `/isp/reports` | IspReportsPage | ISP report generation |
| `/isp/url-activity` | IspUrlActivityPage | ISP URL activity logs |
| `/isp/app-control` | IspAppControlPage | ISP app control settings |
| `/isp/devices` | IspDevicesPage | ISP device management |
| `/isp/child-profiles` | IspChildProfilesPage | ISP child profiles |
| `/isp/child-profiles/:profileId` | IspChildDetailPage | ISP child detail |
| `/isp/settings` | IspSettingsPage | ISP settings |
| `/isp/ai-insights` | IspAiInsightsPage | ISP AI insights |
| `/isp/communications` | CommunicationsPage | ISP customer comms |
| `/isp/analytics-export` | AnalyticsExportPage | Data export tools |
| `/billing/success` | CheckoutSuccessPage | Stripe success (ISP billing) |
| `/billing/cancel` | CheckoutCancelPage | Stripe cancel (ISP billing) |

### 2.5 Shared Pages
| Route | Component | Description |
|---|---|---|
| `*` | NotFoundPage | 404 catch-all |

**Total: 103+ routes across all roles**

---

## 3. Feature Matrix Per Role

| Feature | GLOBAL_ADMIN | ISP_ADMIN | CUSTOMER |
|---|---|---|---|
| Dashboard with stats | Working | Working | Working |
| Dark mode toggle | Working | Working | Working |
| Language switcher (EN/HI) | Working | Working | Working |
| Error boundary | Working | Working | Working |
| WebSocket real-time sync | N/A | N/A | Working |
| Alert badge (bell icon) | Partial* | Partial* | Working |
| Search bar | Non-functional | Non-functional | Non-functional |
| Role-based routing | Working | Working | Working |
| Collapsible sidebar | Working | Working | Working |
| Mobile responsive drawer | Working | Working | Working |
| Bottom navigation (mobile) | N/A | N/A | Working |
| JWT token refresh | Working | Working | Working |
| MFA/OTP login | Working | Working | Working |
| Stripe billing | Working | Working | Working |
| CSV/JSON/Excel export | Working | Working | Working |
| Google Maps integration | N/A | N/A | Working |
| AI insights | Working | Working | Working |
| Skip to content (a11y) | Working | N/A | N/A |

*Admin/ISP alert badge hardcoded to 0, not connected to alert store.

---

## 4. Bug List

### Critical (P0)
None found.

### High (P1)

| # | Bug | File:Line | Impact |
|---|---|---|---|
| B1 | **Search bar is non-functional** in all 3 layouts. The `InputBase` has no `onChange`, no state, no filtering logic. It is purely decorative. | `CustomerLayout.tsx:496`, `AdminLayout.tsx:443`, `IspLayout.tsx:421` | Users expect search to work; currently does nothing |
| B2 | **`useRoleGuard` navigates to `/unauthorized`** which has no matching route — will show 404 | `useRoleGuard.ts:15` | Unauthorized users see generic 404 instead of proper message |
| B3 | **Admin/ISP notification badge hardcoded to 0** — not connected to `useAlertStore` or `useRealtimeSync` | `AdminLayout.tsx:468`, `IspLayout.tsx:446` | Admin/ISP admins never see notification counts |
| B4 | **Admin layout reuses Customer SettingsPage** at `/admin/settings` — this page calls customer-specific endpoints (profile data, MFA setup) that may not be appropriate for admin context | `App.tsx:295` | Admin settings may show broken/misleading customer-oriented features |
| B5 | **WebSocket URL construction inconsistency**: `useRealtimeSync.ts` uses dynamic host detection, but `useWebSocket.ts` hardcodes `wss://${window.location.host}/ws/websocket` — fails on `localhost` dev | `useWebSocket.ts:22` vs `useRealtimeSync.ts:29` | WebSocket breaks in local development for pages using `useWebSocket` |

### Medium (P2)

| # | Bug | File:Line | Impact |
|---|---|---|---|
| B6 | **`useRealtimeSync` only called in CustomerLayout** — Admin and ISP layouts don't get real-time cache invalidation | `CustomerLayout.tsx:143` | Admin/ISP dashboards require manual refresh to see changes |
| B7 | **Alert store is in-memory only** (not persisted) — alerts disappear on page reload | `alert.store.ts` | Users lose alert history on refresh |
| B8 | **`isAuthenticated()` only checks `accessToken` existence**, not expiry — expired JWT still routes to protected pages (interceptor will 401 and refresh, but there's a flash) | `auth.store.ts:30` | Brief flash of authenticated content before redirect on expired tokens |
| B9 | **`NotFoundPage` uses hardcoded `#F8FAFC` background** — ignores dark mode theme | `NotFoundPage.tsx:11` | 404 page looks broken in dark mode |
| B10 | **Billing routes `/billing/success` and `/billing/cancel` are duplicated** in both Customer and ISP route sections — the Customer routes take precedence, ISP users hitting these routes get Customer layout | `App.tsx:238-239` and `App.tsx:318-319` | ISP admin checkout callbacks render inside wrong layout |
| B11 | **`correlationId` in axios.ts is a session-singleton** — same ID for entire browser session, not per-request | `axios.ts:4` | Misleading correlation — all requests from one session share same ID |

### Low (P3)

| # | Bug | File:Line | Impact |
|---|---|---|---|
| B12 | **Help button does nothing** in all 3 layouts — no `onClick`, no navigation | `CustomerLayout.tsx:506`, `AdminLayout.tsx:452`, `IspLayout.tsx:432` | Dead button |
| B13 | **No `<meta name="description">` in index.html** | `index.html` | Minor SEO issue (though dashboard is auth-gated) |
| B14 | **Favicon references `/shield.svg`** but no verification it exists in `public/` | `index.html:5` | Potential missing favicon |

---

## 5. UX Issues

### Per-Layout Issues

**All Layouts:**
- Search bar exists visually but is completely non-functional. This creates a broken expectation.
- Help icon (?) is a dead button with no action.
- Sidebar collapse state is not persisted across sessions.

**CustomerLayout:**
- Bottom navigation `value` state (`bottomNav`) is disconnected from the actual route — tapping "Dashboard" then navigating via sidebar doesn't update bottom nav highlight.
- 44 pages in sidebar means heavy scrolling even with sections — consider "Favorites" or "Recently Visited" at top.
- Section headers are collapsible but default to ALL expanded — overwhelming first impression.

**AdminLayout:**
- Only layout with "Skip to main content" accessibility link — Customer and ISP layouts are missing it.
- 30+ nav items in 3 sections — no search/filter for nav items.

**IspLayout:**
- ISP sidebar has "My Plan" and "Customer Plans" — naming could be clearer ("My Subscription" vs "Customer Plans").

### Per-Page Pattern Issues
- **Empty states**: 67 pages reference EmptyState or "No ... found" — good coverage.
- **Loading states**: 98 pages use Skeleton/CircularProgress/isLoading — excellent coverage.
- **Error handling**: Pages using TanStack Query get retry (max 1) on non-401/403/404. Pages using raw `api.get` with `useState` have try/catch patterns. Coverage is inconsistent.

---

## 6. Code Quality Metrics

### Type Safety
- **188 `any` types** across 40 files — concentrated in API layer (`auth.api.ts`:5, `profile.api.ts`:4, `dns.api.ts`:7, `location.api.ts`:7, `analytics.api.ts`:4, `rewards.api.ts`:3) and admin pages (`PlatformDashboardPage`:17, `PlatformAnalyticsPage`:12, `AdminAnalyticsPage`:14)
- API layer functions almost universally use `any` for request/response data — no typed DTOs
- Dashboard page interfaces are defined inline (per-page) rather than in shared type files

### Dead Code
- `useRoleGuard` hook is defined but appears unused — route guards are handled by `PrivateRoute`/`AdminRoute`/`IspRoute` wrapper components in App.tsx
- `profile.store.ts` defines `selectedProfileId` and `selectedProfile()` but pages typically use route params or local state instead
- `useJwt` and `useIsExpired` hooks — `useIsExpired` does not appear to be used anywhere; `useJwt` may have limited usage
- CSS classes in `index.css` like `.glass-card`, `.drag-over`, `.dark-skeleton`, `.search-bar` — several are likely unused (MUI handles styling inline)

### Bundle Analysis
- **Total build size**: ~3.0 MB (dist/)
- **Chunk splitting strategy** (vite.config.ts): 7 manual chunks — vendor-react, vendor-mui, vendor-query, vendor-charts, vendor-maps, vendor-i18n, vendor-misc + per-page lazy chunks
- **Chunk warning limit**: 600 KB — well configured
- All 103+ pages are lazy-loaded via `React.lazy()` — excellent code splitting

### i18n Coverage
- **2 languages**: English (en.json, 95 lines) and Hindi (hi.json, 95 lines)
- **~95 translation keys** covering nav, common, auth, dashboard, tenants, users, dns, alerts, settings
- **1,180 `t()` calls** across 100 page files — excellent adoption
- **Gap**: Many page-specific strings are hardcoded in English (button labels, table headers, descriptions inside page components), not in i18n files. The 95 keys cover maybe 15% of the actual UI strings.

### Performance
- **107 useMemo/useCallback** occurrences across 38 files — moderate memoization
- **No React.memo** usage on any component — all rerender on parent changes
- Chart components (recharts) are lazy-loaded via page chunks — good
- Google Maps loaded only on map pages — good
- `QueryClient` staleTime: 30s — reasonable default
- No virtualization for long lists (alerts, activity logs, etc.) — could be an issue with large datasets

---

## 7. Auth Flow Analysis

1. **Login**: Email/password -> API `/auth/login` -> returns JWT + optional MFA flag
2. **MFA**: If `mfaRequired`, auto-sends OTP email via `/auth/mfa/email/send`, user enters 6-digit code, validates via `/auth/mfa/validate`
3. **Token storage**: Zustand persist middleware -> localStorage (`shield-auth` key)
4. **Protected routes**: `PrivateRoute` checks `isAuthenticated()` (token existence), `AdminRoute`/`IspRoute` check role
5. **Token refresh**: Axios response interceptor catches 401, uses refresh token via `/auth/refresh`, queues concurrent requests
6. **Logout**: Clears store, navigates to `/login`. Server-side blacklist via Redis (mentioned in MEMORY.md)
7. **Auth event**: `auth:logout` CustomEvent dispatched on interceptor failure, caught by `AuthLogoutListener` for SPA navigation

**Issues:**
- `isAuthenticated()` doesn't check token expiry — relies on server 401 + refresh cycle
- No automatic logout on idle timeout
- No CSRF token handling (JWT-based, so typically acceptable)

---

## 8. Real-Time (WebSocket) Analysis

### useRealtimeSync (Customer layout only)
- Connects to STOMP broker at `/ws/websocket`
- Subscribes to 3 topics:
  - `/topic/sync/{userId}` — user-specific events (DNS_RULES_CHANGED, SCHEDULE_CHANGED, BUDGET_CHANGED, PROFILE_CHANGED, ALERT)
  - `/topic/tenant/{tenantId}` — tenant-wide events (DNS_RULES_CHANGED, PROFILE_CHANGED, DEVICE_CHANGED)
  - `/topic/alerts/{tenantId}` — critical alerts (SOS, geofence breach)
- Invalidates TanStack Query caches on relevant events
- Shows browser Notification for critical events (SOS_ALERT, PANIC_ALERT, GEOFENCE_BREACH, CRITICAL severity)
- Auto-reconnects with 5s delay

### useWebSocket (generic hook)
- Used by individual pages (LocationMapPage for live location)
- Hardcodes `wss://` protocol — will fail over non-SSL connections (not an issue in production)

**Gap**: Admin and ISP layouts don't use `useRealtimeSync` — no automatic cache invalidation for admin actions.

---

## 9. Notification System

- **Bell icon badge**: CustomerLayout shows unread count from `useAlertStore`. Admin/ISP layouts show hardcoded `0`.
- **In-app alerts**: Stored in Zustand (memory-only), max 200 items. `addAlert()`, `markRead()`, `markAllRead()`.
- **Browser notifications**: Requested on first load. Shown for SOS, PANIC, GEOFENCE_BREACH, CRITICAL severity.
- **Toast/Snackbar**: Used per-page for action feedback (save success, error messages). Not centralized.
- **No notification persistence**: Alerts lost on page refresh.

---

## 10. Theme / Guardian's Lens Compliance

### Compliance Checklist

| Rule | Status | Notes |
|---|---|---|
| No 1px solid borders for structure | Compliant | Cards use tonal lift + shadow, no structural borders in light mode |
| Ghost border: outlineVariant @ 20% only where needed | Compliant | Dark mode only, via `outlineVar` |
| Manrope for H1-H4, Inter for H5-caption | Compliant | Correctly configured in theme.ts and CSS |
| Guardian Shadow: blur 32, spread -4, on_surface @ 6% | Compliant | `guardianShadow` exported, used in StatCard |
| Glassmorphism AppBar | Compliant | `backdrop-filter: blur(20px)`, 88% opacity |
| Primary #005DAC | Compliant | ds.primary = '#005DAC' |
| primaryContainer #1976D2 | Compliant | ds.primaryContainer = '#1976D2' |
| Surface tiers (no-line system) | Compliant | 6 light tiers + 6 dark tiers defined |
| Gradient buttons | Compliant | MuiButton contained has `linear-gradient(135deg, #004A8F, primary)` |
| 24px border-radius buttons | Compliant | `borderRadius: 24` on MuiButton |
| 12px shape radius | Compliant | `shape.borderRadius: 12` |
| Dual-font Google Fonts loading | Compliant | Preconnect + swap in index.html |

### Deviations

| Item | Issue |
|---|---|
| **LoginPage gradient** uses `#4F46E5`/`#7C3AED` (Indigo/Violet) not the brand `#005DAC` primary | Intentional design choice for auth pages, but diverges from Guardian's Lens primary |
| **NotFoundPage** hardcodes `#F8FAFC` background, `#1565C0` icon color — ignores theme | Should use `theme.palette.background.default` |
| **StatCard** hardcodes its own DS tokens instead of importing from theme.ts | Duplicated design tokens risk drift |
| **Admin sidebar accent** uses `#7C3AED` (purple) — different from primary hierarchy | Intentional role differentiation, acceptable |

---

## 11. Accessibility Audit

| Criterion | Status | Notes |
|---|---|---|
| Skip to main content | Partial | Only in AdminLayout. Missing in Customer/ISP layouts. |
| Keyboard navigation | Partial | MUI components provide built-in keyboard support. Custom components (search bar, user dropdown) lack explicit keyboard handlers. |
| ARIA labels | Partial | Nav toggle buttons have aria-labels. Search input has `aria-label`. Most custom interactive elements lack ARIA. |
| Color contrast | Good | Primary #005DAC on white = 7.3:1 (AA+AAA). Text colors pass WCAG AA. |
| Focus visible | Good | Global `:focus-visible` outline in index.css (2px solid #1565C0). |
| Screen reader | Partial | No `aria-live` regions for dynamic content (alerts, notifications). No `role="status"` on loading indicators. |
| Dark mode contrast | Good | Dark text on dark surfaces uses appropriate lightened values. |
| Mobile touch targets | Good | MUI minHeight 42px on list items, 60px toolbar, 60px bottom nav. |

---

## 12. Mobile Layout Assessment

| Area | Status | Notes |
|---|---|---|
| Customer mobile | Good | Temporary drawer + bottom navigation bar (5 items). `pb: 76px` on main content avoids overlap. |
| Admin mobile | Good | Temporary drawer on hamburger tap. No bottom nav. |
| ISP mobile | Good | Temporary drawer on hamburger tap. No bottom nav. |
| Responsive breakpoint | `md` (900px) | Consistent across all 3 layouts |
| Tables on mobile | Acceptable | `TableContainer` with overflow scroll. No column hiding. |
| Charts on mobile | Good | `ResponsiveContainer` wraps all recharts. |
| Maps on mobile | Good | Google Maps API handles responsive natively. |
| Search bar hidden | OK | Hidden below 480px (CSS) and `xs` (MUI). |

---

## 13. Recommendations (Top 15)

### Must Fix (P1)

1. **Implement search functionality or remove the search bar.** The current non-functional search creates broken UX expectations. At minimum, add a command palette (Ctrl+K) that filters sidebar nav items.

2. **Connect Admin/ISP notification badges to the alert store** and add `useRealtimeSync()` to AdminLayout and IspLayout. Currently these roles get zero real-time updates.

3. **Fix the duplicate `/billing/success` and `/billing/cancel` routes.** ISP admin checkout callbacks render inside the Customer layout. Move ISP billing routes to `/isp/billing/success` and `/isp/billing/cancel`.

4. **Add `/unauthorized` route** or change `useRoleGuard.ts` to redirect to the appropriate dashboard instead of a non-existent route.

5. **Fix `NotFoundPage` to use theme colors** instead of hardcoded light-mode values. Dark mode makes this page look broken.

### Should Fix (P2)

6. **Type the API layer properly.** Replace all 188 `any` types with proper DTOs. Create a `src/types/` directory with shared interfaces matching backend API responses. This is the #1 code quality gap.

7. **Persist alert store to localStorage** (or at least sessionStorage) so alerts survive page refresh. Add a `persist` middleware like auth/theme/profile stores already use.

8. **Add "Skip to main content" links** to CustomerLayout and IspLayout for accessibility parity with AdminLayout.

9. **Fix bottom navigation sync in CustomerLayout.** The `bottomNav` state index is independent of the current route. Derive it from `location.pathname` instead.

10. **Fix WebSocket URL in `useWebSocket.ts`** to use the same dynamic URL construction as `useRealtimeSync.ts` for local development compatibility.

### Nice to Have (P3)

11. **Expand i18n coverage.** The 95 translation keys cover <15% of UI strings. Page-specific strings (button labels, table headers, descriptions) need extraction. Consider automated key extraction tools.

12. **Add React.memo to heavy child components** (StatCard, table rows, chart wrappers) to reduce unnecessary re-renders on parent state changes.

13. **Add list virtualization** (react-window or @tanstack/virtual) for activity logs, alert lists, and user tables that can grow to hundreds of items.

14. **Clean up dead code:** Remove `useRoleGuard` (unused), unused CSS classes in index.css, and audit `useJwt`/`useIsExpired` hook usage.

15. **Create a separate AdminSettingsPage** instead of reusing the Customer SettingsPage for `/admin/settings`. Admin settings should show platform configuration, not customer profile features.

---

## 14. Summary Statistics

| Metric | Value |
|---|---|
| Total routes | 103 |
| Customer pages | 44 |
| Global Admin pages | 30 |
| ISP Admin pages | 24 |
| Auth pages | 5 |
| Total TypeScript LOC (pages only) | ~45,346 |
| `any` type occurrences | 188 |
| i18n `t()` call sites | 1,180 |
| Translation keys (per language) | 95 |
| Languages supported | 2 (EN, HI) |
| useMemo/useCallback sites | 107 |
| React.memo usage | 0 |
| Loading state coverage | 98/103 pages |
| Empty state coverage | 67/103 pages |
| Lazy-loaded pages | 103/103 (100%) |
| Build output size | ~3.0 MB |
| Manual chunk splits | 7 vendor chunks |
| P1 bugs | 5 |
| P2 bugs | 6 |
| P3 bugs | 3 |
