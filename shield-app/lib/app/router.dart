import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/models/auth_state.dart';
import '../core/providers/auth_provider.dart';

// Splash + Onboarding
import '../features/splash/splash_screen.dart';
import '../features/onboarding/onboarding_screen.dart';

// Auth
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/auth/forgot_password_screen.dart';

// Setup
import '../features/setup/child_setup_screen.dart';

// Admin shell + screens
import '../features/admin/shell/admin_shell.dart';
import '../features/admin/dashboard/admin_dashboard_screen.dart';
import '../features/admin/customers/customers_screen.dart';
import '../features/admin/customers/customer_detail_screen.dart';
import '../features/admin/tenants/tenants_screen.dart';
import '../features/admin/tenants/tenant_detail_screen.dart';
import '../features/admin/analytics/admin_analytics_screen.dart';
import '../features/admin/settings/admin_settings_screen.dart';

// Parent shell + tabs
import '../features/parent/shell/parent_shell.dart';
import '../features/parent/dashboard/dashboard_screen.dart';
import '../features/parent/family/family_screen.dart';
import '../features/parent/family/new_child_screen.dart';
import '../features/parent/family/child_detail_screen.dart';
import '../features/parent/map/all_children_map_screen.dart';
import '../features/parent/alerts/alerts_screen.dart';
import '../features/parent/settings/settings_screen.dart';
import '../features/parent/notifications/notifications_screen.dart';
import '../features/parent/profile/profile_screen.dart';
import '../features/parent/reports/reports_screen.dart';

// Parent child-detail sub-screens
import '../features/parent/controls/dns_rules_screen.dart';
import '../features/parent/controls/schedule_screen.dart';
import '../features/parent/controls/time_limits_screen.dart';
import '../features/parent/controls/safe_filters_screen.dart';
import '../features/parent/controls/app_blocking_screen.dart';
import '../features/parent/controls/bedtime_screen.dart';
import '../features/parent/controls/homework_mode_screen.dart';
import '../features/parent/location/map_screen.dart';
import '../features/parent/location/location_history_screen.dart';
import '../features/parent/location/geofences_screen.dart';
import '../features/parent/activity/browsing_history_screen.dart';
import '../features/parent/activity/app_usage_screen.dart';
import '../features/parent/activity/ai_insights_screen.dart';
import '../features/parent/rewards/rewards_screen.dart';
import '../features/parent/rewards/approval_requests_screen.dart';
import '../features/parent/safety/emergency_contacts_screen.dart';
import '../features/parent/safety/battery_alerts_screen.dart';
import '../features/parent/devices/devices_screen.dart';

// Child screens
import '../features/child/home/child_home_screen.dart';
import '../features/child/tasks/child_tasks_screen.dart';
import '../features/child/rewards/child_rewards_screen.dart';
import '../features/child/chat/ai_chat_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Auth change notifier — wires GoRouter refresh to Riverpod auth state changes
// ─────────────────────────────────────────────────────────────────────────────

class _AuthNotifier extends ChangeNotifier {
  _AuthNotifier(Ref ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// routerProvider
//
// Initial route: /splash
// Redirect logic:
//   loading       → /splash (stay)
//   child         → lock to /child/** only
//   admin         → redirect to /admin/dashboard (ISP_ADMIN / GLOBAL_ADMIN)
//   parent        → redirect to /parent/dashboard (CUSTOMER)
//   unauthenticated + onboarded     → /login
//   unauthenticated + not onboarded → /onboarding
// ─────────────────────────────────────────────────────────────────────────────

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = _AuthNotifier(ref);
  ref.onDispose(notifier.dispose);

  return GoRouter(
    initialLocation:   '/splash',
    refreshListenable: notifier,

    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final path = state.matchedLocation;

      // Stay on splash while loading
      if (auth.status == AuthStatus.loading) {
        return path == '/splash' ? null : '/splash';
      }

      // ── Child mode ────────────────────────────────────────────────────────
      if (auth.status == AuthStatus.child) {
        if (auth.childSessionExpired) return '/setup?expired=true';
        if (!path.startsWith('/child')) return '/child/home';
        return null;
      }

      // ── Parent mode (covers CUSTOMER, ISP_ADMIN, GLOBAL_ADMIN) ────────────
      if (auth.status == AuthStatus.parent) {
        // Leave public pages alone (shouldn't reach here, but guard anyway)
        if (_isPublicPath(path)) {
          return auth.isAdmin ? '/admin/dashboard' : '/parent/dashboard';
        }

        // Admin users must stay in /admin/**
        if (auth.isAdmin) {
          if (path.startsWith('/parent') || path.startsWith('/child')) {
            return '/admin/dashboard';
          }
          return null;
        }

        // Non-admin (CUSTOMER) must stay in /parent/**
        if (path.startsWith('/admin') || path.startsWith('/child')) {
          return '/parent/dashboard';
        }
        return null;
      }

      // ── Unauthenticated ───────────────────────────────────────────────────
      if (_isPublicPath(path)) return null;
      return auth.isOnboarded ? '/login' : '/onboarding';
    },

    routes: [
      // ── Public (no auth required) ──────────────────────────────────────────
      GoRoute(path: '/splash',           builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/onboarding',       builder: (_, __) => const OnboardingScreen()),
      GoRoute(path: '/login',            builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register',         builder: (_, __) => const RegisterScreen()),
      GoRoute(path: '/forgot-password',  builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(
        path: '/setup',
        builder: (_, state) => ChildSetupScreen(
          sessionExpired: state.uri.queryParameters['expired'] == 'true',
        ),
      ),

      // ── Child (locked device — no parent shell) ────────────────────────────
      GoRoute(path: '/child/home',    builder: (_, __) => const ChildHomeScreen()),
      GoRoute(path: '/child/tasks',   builder: (_, __) => const ChildTasksScreen()),
      GoRoute(path: '/child/rewards', builder: (_, __) => const ChildRewardsScreen()),
      GoRoute(path: '/child/chat',    builder: (_, __) => const AiChatScreen()),

      // ── Admin (ISP_ADMIN + GLOBAL_ADMIN) with NavigationBar shell ──────────
      ShellRoute(
        builder: (_, __, child) => AdminShell(child: child),
        routes: [
          GoRoute(path: '/admin/dashboard',
              builder: (_, __) => const AdminDashboardScreen()),
          GoRoute(path: '/admin/customers',
              builder: (_, __) => const CustomersScreen()),
          GoRoute(path: '/admin/tenants',
              builder: (_, __) => const TenantsScreen()),
          GoRoute(path: '/admin/analytics',
              builder: (_, __) => const AdminAnalyticsScreen()),
          GoRoute(path: '/admin/settings',
              builder: (_, __) => const AdminSettingsScreen()),
        ],
      ),

      // ── Admin detail screens (pushed above shell) ──────────────────────────
      GoRoute(
        path: '/admin/customers/:id',
        builder: (_, s) =>
            CustomerDetailScreen(customerId: s.pathParameters['id']!),
      ),
      GoRoute(
        path: '/admin/tenants/:id',
        builder: (_, s) =>
            TenantDetailScreen(tenantId: s.pathParameters['id']!),
      ),

      // ── Parent (CUSTOMER) with NavigationBar shell ────────────────────────
      ShellRoute(
        builder: (_, __, child) => ParentShell(child: child),
        routes: [
          GoRoute(path: '/parent/dashboard',
              builder: (_, __) => const DashboardScreen()),
          GoRoute(path: '/parent/family',
              builder: (_, __) => const FamilyScreen()),
          GoRoute(path: '/parent/map',
              builder: (_, __) => const AllChildrenMapScreen()),
          GoRoute(path: '/parent/alerts',
              builder: (_, __) => const AlertsScreen()),
          GoRoute(path: '/parent/settings',
              builder: (_, __) => const SettingsScreen()),
        ],
      ),

      // ── Parent screens pushed above shell ─────────────────────────────────
      GoRoute(path: '/parent/notifications',
          builder: (_, __) => const NotificationsScreen()),
      GoRoute(path: '/parent/profile',
          builder: (_, __) => const ProfileScreen()),
      GoRoute(path: '/parent/reports',
          builder: (_, __) => const ReportsScreen()),

      // ── Family management (pushed above shell) ────────────────────────────
      GoRoute(path: '/parent/family/new',
          builder: (_, __) => const NewChildScreen()),
      GoRoute(path: '/parent/family/:id',
          builder: (_, s) => ChildDetailScreen(
              profileId: s.pathParameters['id']!)),

      // ── Child detail sub-screens ──────────────────────────────────────────
      GoRoute(path: '/parent/family/:id/dns-rules',
          builder: (_, s) => DnsRulesScreen(profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/schedule',
          builder: (_, s) => ScheduleScreen(profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/time-limits',
          builder: (_, s) => TimeLimitsScreen(profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/safe-filters',
          builder: (_, s) => SafeFiltersScreen(profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/app-blocking',
          builder: (_, s) => AppBlockingScreen(profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/bedtime',
          builder: (_, s) => BedtimeScreen(profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/homework-mode',
          builder: (_, s) => HomeworkModeScreen(profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/map',
          builder: (_, s) => MapScreen(profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/location-history',
          builder: (_, s) => LocationHistoryScreen(
              profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/geofences',
          builder: (_, s) => GeofencesScreen(profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/browsing',
          builder: (_, s) => BrowsingHistoryScreen(
              profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/app-usage',
          builder: (_, s) => AppUsageScreen(profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/ai-insights',
          builder: (_, s) => AiInsightsScreen(profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/rewards',
          builder: (_, s) => RewardsScreen(profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/approvals',
          builder: (_, s) => ApprovalRequestsScreen(
              profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/emergency-contacts',
          builder: (_, s) => EmergencyContactsScreen(
              profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/battery-alerts',
          builder: (_, s) => BatteryAlertsScreen(
              profileId: s.pathParameters['id']!)),
      GoRoute(path: '/parent/family/:id/devices',
          builder: (_, s) => DevicesScreen(profileId: s.pathParameters['id']!)),
    ],

    errorBuilder: (_, state) => Scaffold(
      body: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.error_outline, size: 64, color: Colors.red),
          const SizedBox(height: 16),
          Text('Page not found: ${state.uri}',
              style: const TextStyle(color: Colors.red)),
        ]),
      ),
    ),
  );
});

/// Public paths — no authentication required.
bool _isPublicPath(String path) =>
    path == '/splash'          ||
    path == '/onboarding'      ||
    path == '/login'           ||
    path == '/register'        ||
    path == '/forgot-password' ||
    path == '/setup'           ||
    path.startsWith('/setup');
