import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getShieldTheme } from './theme/theme';
import { useAuthStore } from './store/auth.store';
import { useThemeStore } from './store/theme.store';

import CustomerLayout from './layouts/CustomerLayout';
import AdminLayout from './layouts/AdminLayout';
import IspLayout from './layouts/IspLayout';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

import CustomerDashboardPage from './pages/customer/CustomerDashboardPage';
import ChildProfilePage from './pages/customer/ChildProfilePage';
import ActivityPage from './pages/customer/ActivityPage';
import RulesPage from './pages/customer/RulesPage';
import SchedulePage from './pages/customer/SchedulePage';
import LocationMapPage from './pages/customer/LocationMapPage';
import AlertsPage from './pages/customer/AlertsPage';
import RewardsPage from './pages/customer/RewardsPage';
import ReportsPage from './pages/customer/ReportsPage';
import SettingsPage from './pages/customer/SettingsPage';
import TimeLimitsPage from './pages/customer/TimeLimitsPage';
import GeofencesPage from './pages/customer/GeofencesPage';
import LocationHistoryPage from './pages/customer/LocationHistoryPage';
import AiInsightsPage from './pages/customer/AiInsightsPage';
import CustomerDevicesPage from './pages/customer/DevicesPage';

import PlatformDashboardPage from './pages/global-admin/PlatformDashboardPage';
import TenantsPage from './pages/global-admin/TenantsPage';
import UsersPage from './pages/global-admin/UsersPage';
import SystemHealthPage from './pages/global-admin/SystemHealthPage';
import DnsRulesPage from './pages/global-admin/DnsRulesPage';
import PlatformAnalyticsPage from './pages/global-admin/PlatformAnalyticsPage';
import SubscriptionPlansPage from './pages/global-admin/SubscriptionPlansPage';
import AuditLogPage from './pages/global-admin/AuditLogPage';
import DevicesPage from './pages/global-admin/DevicesPage';
import TenantDetailPage from './pages/global-admin/TenantDetailPage';
import UserDetailPage from './pages/global-admin/UserDetailPage';
import NotificationChannelsPage from './pages/global-admin/NotificationChannelsPage';
import ChildProfilesPage from './pages/global-admin/ChildProfilesPage';
import AdminChildDetailPage from './pages/global-admin/AdminChildDetailPage';

import IspDashboardPage from './pages/isp-admin/IspDashboardPage';
import CustomersPage from './pages/isp-admin/CustomersPage';
import IspAnalyticsPage from './pages/isp-admin/IspAnalyticsPage';
import IspBillingPage from './pages/isp-admin/IspBillingPage';
import BrandingPage from './pages/isp-admin/BrandingPage';
import CustomerDetailPage from './pages/isp-admin/CustomerDetailPage';

import InvoicesPage from './pages/global-admin/InvoicesPage';
import GlobalCustomersPage from './pages/global-admin/GlobalCustomersPage';
import GlobalBlocklistPage from './pages/global-admin/GlobalBlocklistPage';
import AiModelsPage from './pages/global-admin/AiModelsPage';
import FeatureManagementPage from './pages/global-admin/FeatureManagementPage';
import IspBlocklistPage from './pages/isp-admin/IspBlocklistPage';
import IspFilteringPage from './pages/isp-admin/IspFilteringPage';
import IspReportsPage from './pages/isp-admin/IspReportsPage';
import IspSettingsPage from './pages/isp-admin/IspSettingsPage';
import IspUrlActivityPage from './pages/isp-admin/IspUrlActivityPage';
import IspAppControlPage from './pages/isp-admin/IspAppControlPage';
import IspDevicesPage from './pages/isp-admin/IspDevicesPage';
import AdminUrlActivityPage from './pages/global-admin/AdminUrlActivityPage';
import RolePermissionsPage from './pages/global-admin/RolePermissionsPage';
import AdminAppControlPage from './pages/global-admin/AdminAppControlPage';
import LeadsPage from './pages/global-admin/LeadsPage';
import VisitorsPage from './pages/global-admin/VisitorsPage';
import AppControlPage from './pages/customer/AppControlPage';
import ChildAppsPage from './pages/customer/ChildAppsPage';
import SubscriptionPage from './pages/customer/SubscriptionPage';
import CheckoutSuccessPage from './pages/customer/CheckoutSuccessPage';
import CheckoutCancelPage from './pages/customer/CheckoutCancelPage';
import NewChildProfilePage from './pages/customer/NewChildProfilePage';
import IspPlansPage from './pages/isp-admin/IspPlansPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } });

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
  const theme = getShieldTheme(mode);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter basename="/app">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            <Route path="/" element={<PrivateRoute><RoleRouter /></PrivateRoute>} />

            <Route element={<PrivateRoute><CustomerLayout /></PrivateRoute>}>
              <Route path="/dashboard" element={<CustomerDashboardPage />} />
              <Route path="/profiles/:profileId" element={<ChildProfilePage />} />
              <Route path="/profiles/:profileId/activity" element={<ActivityPage />} />
              <Route path="/profiles/:profileId/rules" element={<RulesPage />} />
              <Route path="/profiles/:profileId/schedules" element={<SchedulePage />} />
              <Route path="/profiles/:profileId/rewards" element={<RewardsPage />} />
              <Route path="/profiles/:profileId/reports" element={<ReportsPage />} />
              <Route path="/time-limits" element={<TimeLimitsPage />} />
              <Route path="/geofences" element={<GeofencesPage />} />
              <Route path="/location-history" element={<LocationHistoryPage />} />
              <Route path="/ai-insights" element={<AiInsightsPage />} />
              <Route path="/app-control" element={<AppControlPage />} />
              <Route path="/profiles/:profileId/apps" element={<ChildAppsPage />} />
              <Route path="/devices" element={<CustomerDevicesPage />} />
              <Route path="/map" element={<LocationMapPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/subscription" element={<SubscriptionPage />} />
              <Route path="/profiles/new" element={<NewChildProfilePage />} />
              <Route path="/billing/success" element={<CheckoutSuccessPage />} />
              <Route path="/billing/cancel" element={<CheckoutCancelPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route path="/admin/dashboard" element={<PlatformDashboardPage />} />
              <Route path="/admin/tenants" element={<TenantsPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/dns-rules" element={<DnsRulesPage />} />
              <Route path="/admin/analytics" element={<PlatformAnalyticsPage />} />
              <Route path="/admin/plans" element={<SubscriptionPlansPage />} />
              <Route path="/admin/audit-logs" element={<AuditLogPage />} />
              <Route path="/admin/devices" element={<DevicesPage />} />
              <Route path="/admin/tenants/:tenantId" element={<TenantDetailPage />} />
              <Route path="/admin/users/:userId" element={<UserDetailPage />} />
              <Route path="/admin/health" element={<SystemHealthPage />} />
              <Route path="/admin/notifications" element={<NotificationChannelsPage />} />
              <Route path="/admin/child-profiles" element={<ChildProfilesPage />} />
              <Route path="/admin/child-profiles/:profileId" element={<AdminChildDetailPage />} />
              <Route path="/admin/invoices" element={<InvoicesPage />} />
              <Route path="/admin/customers" element={<GlobalCustomersPage />} />
              <Route path="/admin/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/admin/blocklist" element={<GlobalBlocklistPage />} />
              <Route path="/admin/ai-models" element={<AiModelsPage />} />
              <Route path="/admin/features" element={<FeatureManagementPage />} />
              <Route path="/admin/roles" element={<RolePermissionsPage />} />
              <Route path="/admin/url-activity" element={<AdminUrlActivityPage />} />
              <Route path="/admin/app-control" element={<AdminAppControlPage />} />
              <Route path="/admin/leads" element={<LeadsPage />} />
              <Route path="/admin/visitors" element={<VisitorsPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
            </Route>

            <Route element={<IspRoute><IspLayout /></IspRoute>}>
              <Route path="/isp/dashboard" element={<IspDashboardPage />} />
              <Route path="/isp/customers" element={<CustomersPage />} />
              <Route path="/isp/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/isp/branding" element={<BrandingPage />} />
              <Route path="/isp/analytics" element={<IspAnalyticsPage />} />
              <Route path="/isp/billing" element={<IspBillingPage />} />
              <Route path="/isp/plans" element={<IspPlansPage />} />
              <Route path="/isp/blocklist" element={<IspBlocklistPage />} />
              <Route path="/isp/filtering" element={<IspFilteringPage />} />
              <Route path="/isp/reports" element={<IspReportsPage />} />
              <Route path="/isp/url-activity" element={<IspUrlActivityPage />} />
              <Route path="/isp/app-control" element={<IspAppControlPage />} />
              <Route path="/isp/devices" element={<IspDevicesPage />} />
              <Route path="/billing/success" element={<CheckoutSuccessPage />} />
              <Route path="/billing/cancel" element={<CheckoutCancelPage />} />
              <Route path="/isp/settings" element={<IspSettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
