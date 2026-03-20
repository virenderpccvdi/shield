import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/auth_state.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/auth/forgot_password_screen.dart';
import '../features/auth/child_device_setup_screen.dart';
import '../features/auth/biometric_gate.dart';
import '../features/shell/main_shell.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/family/family_screen.dart';
import '../features/family/child_detail_screen.dart';
import '../features/family/new_child_profile_screen.dart';
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
import '../features/parent/panic_alert_screen.dart';
import '../features/child/child_tasks_screen.dart';
import '../features/child/child_sos_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);
  return GoRouter(
    initialLocation: auth.isChildMode ? '/child' : (auth.isAuthenticated ? '/dashboard' : '/login'),
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final isAuth = authState.isAuthenticated;
      final isChildMode = authState.isChildMode;
      final publicRoutes = ['/login', '/register', '/forgot-password', '/child-setup'];
      final isPublicRoute = publicRoutes.contains(state.matchedLocation);
      // Child mode: always redirect to /child
      if (isChildMode && isAuth && state.matchedLocation != '/child') return '/child';
      if (!isAuth && !isPublicRoute) return '/login';
      if (isAuth && !isChildMode && isPublicRoute) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(path: '/child-setup', builder: (_, __) => const ChildDeviceSetupScreen()),
      GoRoute(path: '/child', builder: (_, __) => const ChildAppScreen()),
      GoRoute(path: '/child/tasks', builder: (_, __) => const ChildTasksScreen()),
      GoRoute(path: '/child/sos', builder: (_, __) => const ChildSosScreen()),
      ShellRoute(
        builder: (context, state, child) => BiometricGate(child: MainShell(child: child)),
        routes: [
          GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
          GoRoute(path: '/family', builder: (_, __) => const FamilyScreen()),
          GoRoute(path: '/family/new', builder: (_, __) => const NewChildProfileScreen()),
          GoRoute(path: '/family/:profileId', builder: (_, state) => ChildDetailScreen(profileId: state.pathParameters['profileId']!)),
          GoRoute(path: '/map', builder: (_, __) => const MapScreen()),
          GoRoute(path: '/alerts', builder: (_, __) => const AlertsScreen()),
          GoRoute(path: '/alerts/sos', builder: (_, __) => const PanicAlertScreen()),
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
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(body: Center(child: Text('Page not found: ${state.uri}'))),
  );
});
