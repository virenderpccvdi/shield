import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/auth_state.dart';
import '../core/fcm_service.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/auth/forgot_password_screen.dart';
import '../features/auth/child_device_setup_screen.dart';
import '../features/auth/biometric_gate.dart';
import '../features/auth/app_lock_wrapper.dart';
import '../features/auth/pin_setup_screen.dart';
import '../features/shell/main_shell.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/family/family_screen.dart';
import '../features/family/child_detail_screen.dart';
import '../features/family/new_child_profile_screen.dart';
import '../features/family/co_parent_screen.dart';
import '../features/location/map_screen.dart';
import '../features/alerts/alerts_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/child_app/child_app_screen.dart';
import '../features/parent/dns_rules_screen.dart';
import '../features/parent/schedule_screen.dart';
import '../features/parent/time_limits_screen.dart';
import '../features/parent/rewards_screen.dart';
import '../features/parent/reports_screen.dart';
import '../features/parent/geofences_screen.dart';
import '../features/parent/places_screen.dart';
import '../features/parent/location_history_screen.dart';
import '../features/parent/ai_insights_screen.dart';
import '../features/parent/devices_screen.dart';
import '../features/parent/app_blocking_screen.dart';
import '../features/child/child_tasks_screen.dart';
import '../features/child/child_rewards_screen.dart';
import '../features/child/child_sos_screen.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/notifications/notification_history_screen.dart';
import '../features/parent/location_share_screen.dart';
import '../features/parent/checkin_reminder_screen.dart';
import '../features/child_app/ai_chat_screen.dart';
import '../features/child_app/achievements_screen.dart';
import '../features/parent/schedule_viewer_screen.dart';
import '../features/parent/panic_alert_screen.dart';

// ── Auth change notifier — drives GoRouter refresh without recreating it ────

class _AuthChangeNotifier extends ChangeNotifier {
  ProviderSubscription<AuthState>? _sub;

  _AuthChangeNotifier(Ref ref) {
    _sub = ref.listen(authProvider, (_, __) => notifyListeners());
  }

  @override
  void dispose() {
    _sub?.close();
    super.dispose();
  }
}

// ── Router provider — created ONCE, refreshed via notifier ─────────────────

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = _AuthChangeNotifier(ref);
  ref.onDispose(notifier.dispose);

  final initial = ref.read(authProvider);

  return GoRouter(
    navigatorKey: FcmService.navigatorKey,
    initialLocation: initial.isChildMode
        ? '/child'
        : (initial.isAuthenticated ? '/dashboard' : '/login'),
    refreshListenable: notifier,
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final isAuth = authState.isAuthenticated;
      final isChildMode = authState.isChildMode;
      // /child-setup is accessible to both authenticated parents and unauthenticated
      // users (e.g. first-time child device setup).  It must NOT be in publicRoutes
      // or an authenticated parent navigating to it will be bounced back to /dashboard.
      final publicRoutes = ['/login', '/register', '/forgot-password'];
      final isPublicRoute = publicRoutes.contains(state.matchedLocation);
      // Child mode: always redirect to /child (but NOT during setup or child sub-screens)
      if (isChildMode && isAuth &&
          !state.matchedLocation.startsWith('/child') &&
          state.matchedLocation != '/child-setup') return '/child';
      if (!isAuth && !isPublicRoute && state.matchedLocation != '/onboarding' && state.matchedLocation != '/child-setup') return '/login';
      if (isAuth && !isChildMode && isPublicRoute) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(path: '/child-setup', builder: (_, __) => const ChildDeviceSetupScreen()),
      GoRoute(path: '/onboarding', builder: (_, __) => const OnboardingScreen()),
      GoRoute(path: '/child', builder: (_, __) => const ChildAppScreen()),
      GoRoute(path: '/child/tasks', builder: (_, __) => const ChildTasksScreen()),
      GoRoute(path: '/child/rewards', builder: (_, __) => const ChildRewardsScreen()),
      GoRoute(path: '/child/sos', builder: (_, __) => const ChildSosScreen()),
      GoRoute(path: '/achievements', builder: (_, __) => const AchievementsScreen()),
      GoRoute(path: '/chat', builder: (_, __) => const AiChatScreen()),
      // PIN setup route (accessible within authenticated parent session)
      GoRoute(path: '/pin-setup', builder: (_, __) => const PinSetupScreen()),

      ShellRoute(
        builder: (context, state, child) =>
            AppLockWrapper(child: BiometricGate(child: MainShell(child: child))),
        routes: [
          GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
          GoRoute(path: '/family', builder: (_, __) => const FamilyScreen()),
          GoRoute(path: '/family/new', builder: (_, __) => const NewChildProfileScreen()),
          GoRoute(path: '/family/members', builder: (_, __) => const CoParentScreen()),
          GoRoute(path: '/family/:profileId', builder: (_, state) => ChildDetailScreen(profileId: state.pathParameters['profileId']!)),
          GoRoute(
            path: '/map',
            builder: (_, state) => MapScreen(
              profileId: state.uri.queryParameters['profileId'],
            ),
          ),
          GoRoute(path: '/alerts', builder: (_, __) => const AlertsScreen()),
          GoRoute(path: '/alerts/sos', builder: (_, __) => const AlertsScreen(initialTab: 2)),
          GoRoute(path: '/alerts/panic', builder: (_, __) => const PanicAlertScreen()),
          GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
          // Parent screens with profileId
          GoRoute(path: '/family/:profileId/dns-rules', builder: (_, state) => DnsRulesScreen(profileId: state.pathParameters['profileId']!)),
          GoRoute(path: '/family/:profileId/schedule', builder: (_, state) => ScheduleScreen(profileId: state.pathParameters['profileId']!)),
          GoRoute(path: '/family/:profileId/time-limits', builder: (_, state) => TimeLimitsScreen(profileId: state.pathParameters['profileId']!)),
          GoRoute(path: '/family/:profileId/rewards', builder: (_, state) => RewardsScreen(profileId: state.pathParameters['profileId']!)),
          GoRoute(path: '/family/:profileId/reports', builder: (_, state) => ReportsScreen(profileId: state.pathParameters['profileId']!)),
          GoRoute(path: '/family/:profileId/geofences', builder: (_, state) => GeofencesScreen(profileId: state.pathParameters['profileId']!)),
          GoRoute(path: '/family/:profileId/places', builder: (_, state) => PlacesScreen(profileId: state.pathParameters['profileId']!)),
          GoRoute(path: '/family/:profileId/location-history', builder: (_, state) => LocationHistoryScreen(profileId: state.pathParameters['profileId']!)),
          GoRoute(path: '/family/:profileId/ai-insights', builder: (_, state) => AiInsightsScreen(profileId: state.pathParameters['profileId']!)),
          GoRoute(path: '/family/:profileId/devices', builder: (_, state) => DevicesScreen(profileId: state.pathParameters['profileId']!)),
          GoRoute(
            path: '/family/:profileId/app-blocking',
            builder: (_, state) => AppBlockingScreen(
              profileId: state.pathParameters['profileId']!,
              childName: state.uri.queryParameters['name'] ?? 'Child',
            ),
          ),
          GoRoute(path: '/notifications', builder: (_, __) => const NotificationHistoryScreen()),
          GoRoute(
            path: '/family/:profileId/location-share',
            builder: (_, state) => LocationShareScreen(profileId: state.pathParameters['profileId']!),
          ),
          GoRoute(
            path: '/family/:profileId/checkin-reminder',
            builder: (_, state) => CheckinReminderScreen(profileId: state.pathParameters['profileId']!),
          ),
          GoRoute(
            path: '/family/:profileId/schedule-viewer',
            builder: (_, state) => ScheduleViewerScreen(profileId: state.pathParameters['profileId']!),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(body: Center(child: Text('Page not found: ${state.uri}'))),
  );
});
