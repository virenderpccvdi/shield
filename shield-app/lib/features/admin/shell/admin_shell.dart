import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/models/auth_state.dart';
import '../../../core/providers/auth_provider.dart';

// ─────────────────────────────────────────────────────────────────────────────
// AdminShell — NavigationBar for ISP_ADMIN and GLOBAL_ADMIN.
// Tabs adapt based on role:
//   ISP_ADMIN     → Dashboard · Customers · Analytics · Settings
//   GLOBAL_ADMIN  → Dashboard · Tenants   · Analytics · Settings
// ─────────────────────────────────────────────────────────────────────────────

class AdminShell extends ConsumerWidget {
  const AdminShell({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final tabs = _tabsFor(auth);
    final location = GoRouterState.of(context).matchedLocation;
    final current  = _indexFor(location, tabs);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: current,
        onDestinationSelected: (i) {
          if (i != current) context.go(tabs[i].path);
        },
        destinations: tabs.map((t) => NavigationDestination(
          icon:         Icon(t.outline),
          selectedIcon: Icon(t.filled),
          label:        t.label,
        )).toList(),
      ),
    );
  }

  List<_Tab> _tabsFor(AuthState auth) {
    final customersTab = auth.isGlobalAdmin
        ? const _Tab('/admin/tenants',   Icons.business_outlined,   Icons.business,    'Tenants')
        : const _Tab('/admin/customers', Icons.people_outline,       Icons.people,      'Customers');

    return [
      const _Tab('/admin/dashboard', Icons.dashboard_outlined, Icons.dashboard,       'Dashboard'),
      customersTab,
      const _Tab('/admin/analytics', Icons.bar_chart_outlined,  Icons.bar_chart,      'Analytics'),
      const _Tab('/admin/settings',  Icons.settings_outlined,   Icons.settings,       'Settings'),
    ];
  }

  int _indexFor(String location, List<_Tab> tabs) {
    for (var i = 0; i < tabs.length; i++) {
      if (location.startsWith(tabs[i].path)) return i;
    }
    return 0;
  }
}

class _Tab {
  const _Tab(this.path, this.outline, this.filled, this.label);
  final String   path;
  final IconData outline;
  final IconData filled;
  final String   label;
}
