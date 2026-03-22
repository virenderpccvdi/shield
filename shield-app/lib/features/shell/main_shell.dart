import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/badge_service.dart';

// Riverpod provider that holds the current unread badge count
final badgeCountProvider = StateProvider<int>((ref) => 0);

class MainShell extends ConsumerStatefulWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  Timer? _badgeTimer;

  @override
  void initState() {
    super.initState();
    _loadBadge();
    // Refresh badge count every 30 seconds to pick up new notifications
    _badgeTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadBadge());
  }

  @override
  void dispose() {
    _badgeTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadBadge() async {
    final count = await BadgeService.getCount();
    if (mounted) ref.read(badgeCountProvider.notifier).state = count;
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final badgeCount = ref.watch(badgeCountProvider);

    int currentIndex = 0;
    if (location.startsWith('/family')) currentIndex = 1;
    else if (location.startsWith('/map')) currentIndex = 2;
    else if (location.startsWith('/alerts')) currentIndex = 3;
    else if (location.startsWith('/settings')) currentIndex = 4;

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (i) {
          switch (i) {
            case 0: context.go('/dashboard'); break;
            case 1: context.go('/family'); break;
            case 2: context.go('/map'); break;
            case 3:
              // Clear badge when tapping alerts
              BadgeService.clear();
              ref.read(badgeCountProvider.notifier).state = 0;
              context.go('/alerts');
              break;
            case 4: context.go('/settings'); break;
          }
        },
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Icons.people_outlined),
            selectedIcon: Icon(Icons.people),
            label: 'Family',
          ),
          const NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map),
            label: 'Map',
          ),
          NavigationDestination(
            icon: _BadgedIcon(count: badgeCount, icon: Icons.notifications_outlined),
            selectedIcon: _BadgedIcon(count: badgeCount, icon: Icons.notifications),
            label: 'Alerts',
          ),
          const NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}

class _BadgedIcon extends StatelessWidget {
  final int count;
  final IconData icon;
  const _BadgedIcon({required this.count, required this.icon});

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return Icon(icon);
    return Badge(
      label: Text(count > 99 ? '99+' : count.toString()),
      child: Icon(icon),
    );
  }
}
