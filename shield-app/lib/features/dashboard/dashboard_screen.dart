import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../core/auth_state.dart';
import '../../core/api_client.dart';

final dashboardProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ref.read(dioProvider);
  try {
    final profilesRes = await client.get('/profiles/children');
    final d = profilesRes.data['data'];
    final profiles = (d is Map ? (d['content'] ?? d['items'] ?? [d]) : d) as List? ?? [];

    int activeAlerts = 0;
    int blockedToday = 0;

    // Fetch alerts count
    try {
      final alertsRes = await client.get('/notifications/my/unread');
      final alertData = alertsRes.data['data'];
      activeAlerts = alertData is List ? alertData.length : (alertData?['totalElements'] ?? 0) as int;
    } catch (_) {}

    // Fetch blocked count across all profiles
    for (final profile in profiles) {
      try {
        final profileId = profile['id']?.toString();
        if (profileId == null) continue;
        final statsRes = await client.get('/analytics/$profileId/stats', queryParameters: {'period': 'TODAY'});
        final stats = statsRes.data['data'] ?? statsRes.data;
        blockedToday += (stats['blockedQueries'] as int? ?? stats['blocked'] as int? ?? 0);
      } catch (_) {}
    }

    return {
      'totalProfiles': profiles.length,
      'activeAlerts': activeAlerts,
      'blockedToday': blockedToday,
      'profiles': profiles,
    };
  } catch (_) {
    return {'totalProfiles': 0, 'activeAlerts': 0, 'blockedToday': 0, 'profiles': []};
  }
});

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final dashAsync = ref.watch(dashboardProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          const Icon(Icons.shield, color: Color(0xFF1565C0)),
          const SizedBox(width: 8),
          const Text('Shield', style: TextStyle(fontWeight: FontWeight.w800)),
        ]),
        actions: [
          IconButton(
            icon: const Icon(Icons.sos, color: Colors.red),
            tooltip: 'SOS Alerts',
            onPressed: () => context.go('/alerts/sos'),
          ),
          IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () => context.go('/alerts')),
        ],
      ),
      body: dashAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (data) => RefreshIndicator(
          onRefresh: () => ref.refresh(dashboardProvider.future),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Good ${_greeting()}, ${auth.name?.split(' ').first ?? 'Parent'}!',
                  style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text('Here\'s your family\'s activity overview', style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey.shade600)),
                const SizedBox(height: 20),
                Row(children: [
                  _StatCard(label: 'Children', value: '${data['totalProfiles'] ?? 0}', icon: Icons.people, color: const Color(0xFF1565C0)),
                  const SizedBox(width: 12),
                  _StatCard(label: 'Active Alerts', value: '${data['activeAlerts'] ?? 0}', icon: Icons.warning_amber, color: Colors.orange),
                  const SizedBox(width: 12),
                  _StatCard(label: 'Blocked Today', value: '${data['blockedToday'] ?? 0}', icon: Icons.block, color: Colors.red),
                ]),
                const SizedBox(height: 24),
                Text('Children', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                if ((data['profiles'] as List?)?.isEmpty ?? true)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(children: [
                        Icon(Icons.child_care, size: 48, color: Colors.grey.shade400),
                        const SizedBox(height: 12),
                        const Text('No child profiles yet', style: TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        const Text('Add your first child profile to start monitoring and protecting them.', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: () => context.go('/family/new'),
                          icon: const Icon(Icons.add),
                          label: const Text('Add Child'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF1565C0),
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ]),
                    ),
                  )
                else
                  ...(data['profiles'] as List).map((p) => _ProfileCard(profile: p as Map<String, dynamic>)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 6),
              Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
              Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey), textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  final Map<String, dynamic> profile;
  const _ProfileCard({required this.profile});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFF1565C0),
          child: Text((profile['name'] as String? ?? 'C').substring(0, 1).toUpperCase(),
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        ),
        title: Text(profile['name'] ?? 'Child', style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('${profile['age'] ?? ''} years • ${profile['filterLevel'] ?? 'MODERATE'}'),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(
              color: profile['online'] == true ? Colors.green : Colors.grey,
              shape: BoxShape.circle,
            )),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right),
          ],
        ),
        onTap: () => context.go('/family/${profile['id']}'),
      ),
    );
  }
}
