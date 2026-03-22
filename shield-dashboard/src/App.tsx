import { lazy, Suspense, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, CircularProgress, Box } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getShieldTheme } from './theme/theme';
import { useAuthStore } from './store/auth.store';
import { useThemeStore } from './store/theme.store';
import { ErrorBoundary } from './components/ErrorBoundary';

// Layouts are small — keep eager so nav renders instantly
import CustomerLayout from './layouts/CustomerLayout';
import AdminLayout from './layouts/AdminLayout';
import IspLayout from './layouts/IspLayout';

// ── Auth pages (loaded on first visit, always small) ─────────────────────────
const LoginPage               = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage            = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage      = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const FamilyInviteAcceptPage  = lazy(() => import('./pages/auth/FamilyInviteAcceptPage'));
const ResetPasswordPage       = lazy(() => import('./pages/auth/ResetPasswordPage'));

// ── Customer pages ────────────────────────────────────────────────────────────
const CustomerDashboardPage    = lazy(() => import('./pages/customer/CustomerDashboardPage'));
const ChildProfilePage         = lazy(() => import('./pages/customer/ChildProfilePage'));
const ActivityPage             = lazy(() => import('./pages/customer/ActivityPage'));
const RulesPage                = lazy(() => import('./pages/customer/RulesPage'));
const SchedulePage             = lazy(() => import('./pages/customer/SchedulePage'));
const LocationMapPage          = lazy(() => import('./pages/customer/LocationMapPage'));
const AlertsPage               = lazy(() => import('./pages/customer/AlertsPage'));
const RewardsPage              = lazy(() => import('./pages/customer/RewardsPage'));
const ReportsPage              = lazy(() => import('./pages/customer/ReportsPage'));
const SettingsPage             = lazy(() => import('./pages/customer/SettingsPage'));
const TimeLimitsPage           = lazy(() => import('./pages/customer/TimeLimitsPage'));
const GeofencesPage            = lazy(() => import('./pages/customer/GeofencesPage'));
const LocationHistoryPage      = lazy(() => import('./pages/customer/LocationHistoryPage'));
const AiInsightsPage           = lazy(() => import('./pages/customer/AiInsightsPage'));
const CustomerDevicesPage      = lazy(() => import('./pages/customer/DevicesPage'));
const AppControlPage           = lazy(() => import('./pages/customer/AppControlPage'));
const ChildAppsPage            = lazy(() => import('./pages/customer/ChildAppsPage'));
const SubscriptionPage         = lazy(() => import('./pages/customer/SubscriptionPage'));
const CheckoutSuccessPage      = lazy(() => import('./pages/customer/CheckoutSuccessPage'));
const CheckoutCancelPage       = lazy(() => import('./pages/customer/CheckoutCancelPage'));
const NewChildProfilePage      = lazy(() => import('./pages/customer/NewChildProfilePage'));
const CustomerChildProfilesPage = lazy(() => import('./pages/customer/CustomerChildProfilesPage'));
const FamilyMembersPage        = lazy(() => import('./pages/customer/FamilyMembersPage'));
const HomeworkModePage         = lazy(() => import('./pages/customer/HomeworkModePage'));
const ApprovalRequestsPage     = lazy(() => import('./pages/customer/ApprovalRequestsPage'));
const AppBudgetsPage           = lazy(() => import('./pages/customer/AppBudgetsPage'));
const SafeFiltersPage          = lazy(() => import('./pages/customer/SafeFiltersPage'));
const EmergencyContactsPage    = lazy(() => import('./pages/customer/EmergencyContactsPage'));
const BedtimeLockPage          = lazy(() => import('./pages/customer/BedtimeLockPage'));
const SchoolZonePage           = lazy(() => import('./pages/customer/SchoolZonePage'));
const BatteryAlertsPage        = lazy(() => import('./pages/customer/BatteryAlertsPage'));
const FamilyRulesPage          = lazy(() => import('./pages/customer/FamilyRulesPage'));
const ScreenTimeRequestsPage   = lazy(() => import('./pages/customer/ScreenTimeRequestsPage'));
const SuspiciousActivityPage   = lazy(() => import('./pages/customer/SuspiciousActivityPage'));
const CoParentPage             = lazy(() => import('./pages/customer/CoParentPage'));
const CoParentAcceptPage       = lazy(() => import('./pages/customer/CoParentAcceptPage'));
const AppUsagePage             = lazy(() => import('./pages/customer/AppUsagePage'));
const CheckinReminderPage      = lazy(() => import('./pages/customer/CheckinReminderPage'));
const BrowsingHistoryPage      = lazy(() => import('./pages/customer/BrowsingHistoryPage'));
const LocationSharePage        = lazy(() => import('./pages/customer/LocationSharePage'));
const AiChatSettingsPage       = lazy(() => import('./pages/customer/AiChatSettingsPage'));
const AccessSchedulePage       = lazy(() => import('./pages/customer/AccessSchedulePage'));
const AchievementsPage         = lazy(() => import('./pages/customer/AchievementsPage'));

// ── Global-admin pages ────────────────────────────────────────────────────────
const PlatformDashboardPage    = lazy(() => import('./pages/global-admin/PlatformDashboardPage'));
const TenantsPage              = lazy(() => import('./pages/global-admin/TenantsPage'));
const UsersPage                = lazy(() => import('./pages/global-admin/UsersPage'));
const SystemHealthPage         = lazy(() => import('./pages/global-admin/SystemHealthPage'));
const DnsRulesPage             = lazy(() => import('./pages/global-admin/DnsRulesPage'));
const PlatformAnalyticsPage    = lazy(() => import('./pages/global-admin/PlatformAnalyticsPage'));
const AdminAnalyticsPage       = lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const SubscriptionPlansPage    = lazy(() => import('./pages/global-admin/SubscriptionPlansPage'));
const AuditLogPage             = lazy(() => import('./pages/global-admin/AuditLogPage'));
const DevicesPage              = lazy(() => import('./pages/global-admin/DevicesPage'));
const TenantDetailPage         = lazy(() => import('./pages/global-admin/TenantDetailPage'));
const UserDetailPage           = lazy(() => import('./pages/global-admin/UserDetailPage'));
const NotificationChannelsPage = lazy(() => import('./pages/global-admin/NotificationChannelsPage'));
const ChildProfilesPage        = lazy(() => import('./pages/global-admin/ChildProfilesPage'));
const AdminChildDetailPage     = lazy(() => import('./pages/global-admin/AdminChildDetailPage'));
const InvoicesPage             = lazy(() => import('./pages/global-admin/InvoicesPage'));
const GlobalCustomersPage      = lazy(() => import('./pages/global-admin/GlobalCustomersPage'));
const GlobalBlocklistPage      = lazy(() => import('./pages/global-admin/GlobalBlocklistPage'));
const AiModelsPage             = lazy(() => import('./pages/global-admin/AiModelsPage'));
const FeatureManagementPage    = lazy(() => import('./pages/global-admin/FeatureManagementPage'));
const RolePermissionsPage      = lazy(() => import('./pages/global-admin/RolePermissionsPage'));
const AdminUrlActivityPage     = lazy(() => import('./pages/global-admin/AdminUrlActivityPage'));
const AdminAppControlPage      = lazy(() => import('./pages/global-admin/AdminAppControlPage'));
const AdminAiInsightsPage      = lazy(() => import('./pages/global-admin/AdminAiInsightsPage'));
const LeadsPage                = lazy(() => import('./pages/global-admin/LeadsPage'));
const VisitorsPage             = lazy(() => import('./pages/global-admin/VisitorsPage'));
const PlatformAdminPage        = lazy(() => import('./pages/admin/PlatformAdminPage'));

// ── ISP-admin pages ───────────────────────────────────────────────────────────
const IspDashboardPage     = lazy(() => import('./pages/isp-admin/IspDashboardPage'));
const CustomersPage        = lazy(() => import('./pages/isp-admin/CustomersPage'));
const IspAnalyticsPage     = lazy(() => import('./pages/isp-admin/IspAnalyticsPage'));
const IspBillingPage       = lazy(() => import('./pages/isp-admin/IspBillingPage'));
const BrandingPage         = lazy(() => import('./pages/isp-admin/BrandingPage'));
const CustomerDetailPage   = lazy(() => import('./pages/isp-admin/CustomerDetailPage'));
const IspBlocklistPage     = lazy(() => import('./pages/isp-admin/IspBlocklistPage'));
const IspFilteringPage     = lazy(() => import('./pages/isp-admin/IspFilteringPage'));
const IspReportsPage       = lazy(() => import('./pages/isp-admin/IspReportsPage'));
const IspSettingsPage      = lazy(() => import('./pages/isp-admin/IspSettingsPage'));
const IspUrlActivityPage   = lazy(() => import('./pages/isp-admin/IspUrlActivityPage'));
const IspAppControlPage    = lazy(() => import('./pages/isp-admin/IspAppControlPage'));
const IspDevicesPage       = lazy(() => import('./pages/isp-admin/IspDevicesPage'));
const IspChildProfilesPage = lazy(() => import('./pages/isp-admin/IspChildProfilesPage'));
const IspChildDetailPage   = lazy(() => import('./pages/isp-admin/IspChildDetailPage'));
const IspPlansPage         = lazy(() => import('./pages/isp-admin/IspPlansPage'));
const IspAiInsightsPage    = lazy(() => import('./pages/isp-admin/IspAiInsightsPage'));
const BulkImportPage       = lazy(() => import('./pages/isp-admin/BulkImportPage'));
const CommunicationsPage   = lazy(() => import('./pages/isp-admin/CommunicationsPage'));
const AnalyticsExportPage  = lazy(() => import('./pages/isp-admin/AnalyticsExportPage'));
const IspLiveDashboardPage = lazy(() => import('./pages/isp-admin/IspLiveDashboardPage'));

// ── Shared pages ──────────────────────────────────────────────────────────────
const PlatformAlertsPage   = lazy(() => import('./pages/PlatformAlertsPage'));
const NotFoundPage         = lazy(() => import('./pages/NotFoundPage'));

// ─────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: (failureCount, error: unknown) => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      onError: (error: unknown) => {
        console.error('[QueryClient] Mutation error:', error);
      },
    },
  },
});

function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
      <CircularProgress size={36} />
    </Box>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuth = useAuthStore((s) => s.isAuthenticated());
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ISP_ADMIN') return <Navigate to="/isp/dashboard" replace />;
  if (user.role !== 'GLOBAL_ADMIN') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function IspRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'GLOBAL_ADMIN') return <Navigate to="/admin/dashboard" replace />;
  if (user.role !== 'ISP_ADMIN') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RoleRouter() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'GLOBAL_ADMIN') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'ISP_ADMIN') return <Navigate to="/isp/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  const mode = useThemeStore((s) => s.mode);
  const theme = useMemo(() => getShieldTheme(mode), [mode]);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter basename="/app">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login"           element={<LoginPage />} />
              <Route path="/register"        element={<RegisterPage />} />
              <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
              <Route path="/family/invite"   element={<FamilyInviteAcceptPage />} />
              <Route path="/reset-password"  element={<ResetPasswordPage />} />
              <Route path="/co-parent/accept" element={<CoParentAcceptPage />} />

              <Route path="/" element={<PrivateRoute><RoleRouter /></PrivateRoute>} />

              {/* ── Customer ── */}
              <Route element={<PrivateRoute><ErrorBoundary><CustomerLayout /></ErrorBoundary></PrivateRoute>}>
                <Route path="/dashboard"                          element={<CustomerDashboardPage />} />
                <Route path="/profiles/:profileId"                element={<ChildProfilePage />} />
                <Route path="/profiles/:profileId/activity"       element={<ActivityPage />} />
                <Route path="/profiles/:profileId/rules"          element={<RulesPage />} />
                <Route path="/profiles/:profileId/schedules"      element={<SchedulePage />} />
                <Route path="/profiles/:profileId/rewards"        element={<RewardsPage />} />
                <Route path="/profiles/:profileId/reports"        element={<ReportsPage />} />
                <Route path="/profiles/:profileId/apps"           element={<ChildAppsPage />} />
                <Route path="/time-limits"                        element={<TimeLimitsPage />} />
                <Route path="/geofences"                          element={<GeofencesPage />} />
                <Route path="/location-history"                   element={<LocationHistoryPage />} />
                <Route path="/ai-insights"                        element={<AiInsightsPage />} />
                <Route path="/app-control"                        element={<AppControlPage />} />
                <Route path="/devices"                            element={<CustomerDevicesPage />} />
                <Route path="/map"                                element={<LocationMapPage />} />
                <Route path="/alerts"                             element={<AlertsPage />} />
                <Route path="/subscription"                       element={<SubscriptionPage />} />
                <Route path="/profiles"                           element={<CustomerChildProfilesPage />} />
                <Route path="/profiles/new"                       element={<NewChildProfilePage />} />
                <Route path="/billing/success"                    element={<CheckoutSuccessPage />} />
                <Route path="/billing/cancel"                     element={<CheckoutCancelPage />} />
                <Route path="/family-members"                     element={<FamilyMembersPage />} />
                <Route path="/settings"                           element={<SettingsPage />} />
                <Route path="/homework"                           element={<HomeworkModePage />} />
                <Route path="/approvals"                          element={<ApprovalRequestsPage />} />
                <Route path="/app-budgets"                        element={<AppBudgetsPage />} />
                <Route path="/safe-filters"                       element={<SafeFiltersPage />} />
                <Route path="/emergency-contacts"                 element={<EmergencyContactsPage />} />
                <Route path="/bedtime"                            element={<BedtimeLockPage />} />
                <Route path="/school-zone"                        element={<SchoolZonePage />} />
                <Route path="/family-rules"                       element={<FamilyRulesPage />} />
                <Route path="/battery-alerts"                     element={<BatteryAlertsPage />} />
                <Route path="/screen-time-requests"               element={<ScreenTimeRequestsPage />} />
                <Route path="/suspicious-activity"               element={<SuspiciousActivityPage />} />
                <Route path="/co-parent"                          element={<CoParentPage />} />
                <Route path="/app-usage"                          element={<AppUsagePage />} />
                <Route path="/checkin-reminders"                  element={<CheckinReminderPage />} />
                <Route path="/browsing-history"                   element={<BrowsingHistoryPage />} />
                <Route path="/location-share"                     element={<LocationSharePage />} />
                <Route path="/ai-chat"                            element={<AiChatSettingsPage />} />
                <Route path="/access-schedule"                    element={<AccessSchedulePage />} />
                <Route path="/achievements"                       element={<AchievementsPage />} />
              </Route>

              {/* ── Global Admin ── */}
              <Route element={<AdminRoute><ErrorBoundary><AdminLayout /></ErrorBoundary></AdminRoute>}>
                <Route path="/admin/dashboard"                    element={<PlatformDashboardPage />} />
                <Route path="/admin/alerts"                       element={<PlatformAlertsPage />} />
                <Route path="/admin/tenants"                      element={<TenantsPage />} />
                <Route path="/admin/tenants/:tenantId"            element={<TenantDetailPage />} />
                <Route path="/admin/users"                        element={<UsersPage />} />
                <Route path="/admin/users/:userId"                element={<UserDetailPage />} />
                <Route path="/admin/dns-rules"                    element={<DnsRulesPage />} />
                <Route path="/admin/analytics"                    element={<AdminAnalyticsPage />} />
                <Route path="/admin/platform-analytics"           element={<PlatformAnalyticsPage />} />
                <Route path="/admin/plans"                        element={<SubscriptionPlansPage />} />
                <Route path="/admin/audit-logs"                   element={<AuditLogPage />} />
                <Route path="/admin/devices"                      element={<DevicesPage />} />
                <Route path="/admin/health"                       element={<SystemHealthPage />} />
                <Route path="/admin/notifications"                element={<NotificationChannelsPage />} />
                <Route path="/admin/child-profiles"               element={<ChildProfilesPage />} />
                <Route path="/admin/child-profiles/:profileId"    element={<AdminChildDetailPage />} />
                <Route path="/admin/invoices"                     element={<InvoicesPage />} />
                <Route path="/admin/customers"                    element={<GlobalCustomersPage />} />
                <Route path="/admin/customers/:id"                element={<CustomerDetailPage />} />
                <Route path="/admin/blocklist"                    element={<GlobalBlocklistPage />} />
                <Route path="/admin/ai-models"                    element={<AiModelsPage />} />
                <Route path="/admin/ai-insights"                  element={<AdminAiInsightsPage />} />
                <Route path="/admin/features"                     element={<FeatureManagementPage />} />
                <Route path="/admin/roles"                        element={<RolePermissionsPage />} />
                <Route path="/admin/url-activity"                 element={<AdminUrlActivityPage />} />
                <Route path="/admin/app-control"                  element={<AdminAppControlPage />} />
                <Route path="/admin/leads"                        element={<LeadsPage />} />
                <Route path="/admin/visitors"                     element={<VisitorsPage />} />
                <Route path="/admin/settings"                     element={<SettingsPage />} />
                <Route path="/admin/platform"                     element={<PlatformAdminPage />} />
              </Route>

              {/* ── ISP Admin ── */}
              <Route element={<IspRoute><ErrorBoundary><IspLayout /></ErrorBoundary></IspRoute>}>
                <Route path="/isp/dashboard"                      element={<IspDashboardPage />} />
                <Route path="/isp/alerts"                         element={<PlatformAlertsPage />} />
                <Route path="/isp/customers"                      element={<CustomersPage />} />
                <Route path="/isp/customers/:id"                  element={<CustomerDetailPage />} />
                <Route path="/isp/branding"                       element={<BrandingPage />} />
                <Route path="/isp/analytics"                      element={<IspAnalyticsPage />} />
                <Route path="/isp/billing"                        element={<IspBillingPage />} />
                <Route path="/isp/plans"                          element={<IspPlansPage />} />
                <Route path="/isp/blocklist"                      element={<IspBlocklistPage />} />
                <Route path="/isp/filtering"                      element={<IspFilteringPage />} />
                <Route path="/isp/reports"                        element={<IspReportsPage />} />
                <Route path="/isp/url-activity"                   element={<IspUrlActivityPage />} />
                <Route path="/isp/app-control"                    element={<IspAppControlPage />} />
                <Route path="/isp/devices"                        element={<IspDevicesPage />} />
                <Route path="/isp/child-profiles"                 element={<IspChildProfilesPage />} />
                <Route path="/isp/child-profiles/:profileId"      element={<IspChildDetailPage />} />
                <Route path="/billing/success"                    element={<CheckoutSuccessPage />} />
                <Route path="/billing/cancel"                     element={<CheckoutCancelPage />} />
                <Route path="/isp/settings"                       element={<IspSettingsPage />} />
                <Route path="/isp/ai-insights"                    element={<IspAiInsightsPage />} />
                <Route path="/isp/customers/import"              element={<BulkImportPage />} />
                <Route path="/isp/communications"                element={<CommunicationsPage />} />
                <Route path="/isp/analytics-export"              element={<AnalyticsExportPage />} />
                <Route path="/isp/live-dashboard"               element={<IspLiveDashboardPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
