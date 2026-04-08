import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../notifications/notifications_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ParentShell — Material 3 NavigationBar wrapper.
// Tabs: Home | Family | Map | Alerts | Settings
// ─────────────────────────────────────────────────────────────────────────────

class ParentShell extends ConsumerWidget {
  const ParentShell({super.key, required this.child});
  final Widget child;

  static const _tabs = [
    _Tab('/parent/dashboard', Icons.home_outlined,      Icons.home,           'Home'),
    _Tab('/parent/family',    Icons.people_outline,      Icons.people,         'Family'),
    _Tab('/parent/map',       Icons.map_outlined,         Icons.map,            'Map'),
    _Tab('/parent/alerts',    Icons.notifications_none,   Icons.notifications,  'Alerts'),
    _Tab('/parent/settings',  Icons.settings_outlined,    Icons.settings,       'Settings'),
  ];

  int _indexFor(String location) {
    for (var i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location   = GoRouterState.of(context).matchedLocation;
    final current    = _indexFor(location);
    final unreadAsync = ref.watch(unreadCountProvider);
    final unread     = unreadAsync.valueOrNull ?? 0;

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: current,
        backgroundColor: Theme.of(context).brightness == Brightness.dark
            ? null
            : const Color(0xFFFFFFFF),
        onDestinationSelected: (i) {
          if (i != current) context.go(_tabs[i].path);
        },
        destinations: [
          for (final t in _tabs)
            NavigationDestination(
              icon:         Icon(t.outline),
              selectedIcon: Icon(t.filled),
              label:        t.label,
              // Alerts tab gets unread badge
              tooltip: t.label == 'Alerts' && unread > 0
                  ? '$unread unread' : t.label,
            ),
        ],
      ),
    );
  }
}

class _Tab {
  const _Tab(this.path, this.outline, this.filled, this.label);
  final String   path;
  final IconData outline;
  final IconData filled;
  final String   label;
}
