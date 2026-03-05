import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../core/api_client.dart';
import '../parent/quick_control_sheet.dart';

class ChildDetailScreen extends ConsumerStatefulWidget {
  final String profileId;
  const ChildDetailScreen({super.key, required this.profileId});
  @override
  ConsumerState<ChildDetailScreen> createState() => _ChildDetailScreenState();
}

class _ChildDetailScreenState extends ConsumerState<ChildDetailScreen> with SingleTickerProviderStateMixin {
  late TabController _tabs;
  Map<String, dynamic>? _profile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this);
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/profile/my/${widget.profileId}');
      setState(() { _profile = res.data['data']; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final name = _profile?['name'] ?? 'Child';
    return Scaffold(
      appBar: AppBar(
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            tooltip: 'Quick Controls',
            onPressed: () => QuickControlSheet.show(context, ref, widget.profileId),
          ),
        ],
        bottom: TabBar(controller: _tabs, isScrollable: true, tabs: const [
          Tab(text: 'Activity'), Tab(text: 'Controls'), Tab(text: 'Location'), Tab(text: 'Insights'),
        ]),
      ),
      body: TabBarView(controller: _tabs, children: [
        _ActivityTab(profileId: widget.profileId),
        _ControlsTab(profileId: widget.profileId),
        _LocationTab(profileId: widget.profileId),
        _InsightsTab(profileId: widget.profileId),
      ]),
    );
  }

  @override
  void dispose() { _tabs.dispose(); super.dispose(); }
}

class _ActivityTab extends ConsumerWidget {
  final String profileId;
  const _ActivityTab({required this.profileId});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<Response>(
      future: ref.read(dioProvider).get('/dns/activity/$profileId?limit=50'),
      builder: (ctx, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
        final events = (snap.data?.data['data'] as List?) ?? [];
        if (events.isEmpty) return const Center(child: Text('No recent activity'));
        return ListView.builder(
          itemCount: events.length,
          itemBuilder: (_, i) {
            final e = events[i] as Map<String, dynamic>;
            final blocked = e['action'] == 'BLOCKED';
            return ListTile(
              dense: true,
              leading: Icon(blocked ? Icons.block : Icons.check_circle, color: blocked ? Colors.red : Colors.green, size: 20),
              title: Text(e['domain'] ?? '', style: const TextStyle(fontSize: 13)),
              subtitle: Text(e['category'] ?? '', style: const TextStyle(fontSize: 11)),
              trailing: Text(e['timestamp'] != null ? _fmt(e['timestamp']) : '', style: const TextStyle(fontSize: 11, color: Colors.grey)),
            );
          },
        );
      },
    );
  }
  String _fmt(String ts) { try { final d = DateTime.parse(ts).toLocal(); return '${d.hour}:${d.minute.toString().padLeft(2,'0')}'; } catch (_) { return ts; } }
}

class _ControlsTab extends StatelessWidget {
  final String profileId;
  const _ControlsTab({required this.profileId});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Parental Controls', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 12),
        _NavCard(
          icon: Icons.dns, title: 'DNS Content Rules',
          subtitle: 'Block categories of content',
          onTap: () => context.go('/family/$profileId/dns-rules'),
        ),
        _NavCard(
          icon: Icons.schedule, title: 'Internet Schedule',
          subtitle: 'Set weekly access times',
          onTap: () => context.go('/family/$profileId/schedule'),
        ),
        _NavCard(
          icon: Icons.timer, title: 'Time Limits',
          subtitle: 'Daily screen time budgets',
          onTap: () => context.go('/family/$profileId/time-limits'),
        ),
        const Divider(height: 32),
        const Text('Rewards & Reports', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 12),
        _NavCard(
          icon: Icons.emoji_events, title: 'Rewards & Tasks',
          subtitle: 'Manage tasks and reward bank',
          color: Colors.amber,
          onTap: () => context.go('/family/$profileId/rewards'),
        ),
        _NavCard(
          icon: Icons.bar_chart, title: 'Reports & Analytics',
          subtitle: 'Usage charts and insights',
          color: Colors.teal,
          onTap: () => context.go('/family/$profileId/reports'),
        ),
        const Divider(height: 32),
        const Text('Devices', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 12),
        _NavCard(
          icon: Icons.devices, title: 'Manage Devices',
          subtitle: 'Add or remove child devices',
          color: Colors.deepPurple,
          onTap: () => context.go('/family/$profileId/devices'),
        ),
      ],
    );
  }
}

class _LocationTab extends StatelessWidget {
  final String profileId;
  const _LocationTab({required this.profileId});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Location Features', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 12),
        _NavCard(
          icon: Icons.fence, title: 'Geofences',
          subtitle: 'Set up safe zones on the map',
          color: const Color(0xFF1565C0),
          onTap: () => context.go('/family/$profileId/geofences'),
        ),
        _NavCard(
          icon: Icons.place, title: 'Saved Places',
          subtitle: 'Manage frequently visited locations',
          color: Colors.green,
          onTap: () => context.go('/family/$profileId/places'),
        ),
        _NavCard(
          icon: Icons.route, title: 'Location History',
          subtitle: 'Route playback and timeline',
          color: Colors.deepOrange,
          onTap: () => context.go('/family/$profileId/location-history'),
        ),
      ],
    );
  }
}

class _InsightsTab extends StatelessWidget {
  final String profileId;
  const _InsightsTab({required this.profileId});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('AI & Insights', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 12),
        _NavCard(
          icon: Icons.psychology, title: 'AI Behavioral Insights',
          subtitle: 'Risk analysis and recommendations',
          color: Colors.purple,
          onTap: () => context.go('/family/$profileId/ai-insights'),
        ),
        _NavCard(
          icon: Icons.bar_chart, title: 'Full Reports',
          subtitle: 'Detailed usage analytics',
          color: Colors.teal,
          onTap: () => context.go('/family/$profileId/reports'),
        ),
      ],
    );
  }
}

class _NavCard extends StatelessWidget {
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  final Color color;
  const _NavCard({required this.icon, required this.title, required this.subtitle, required this.onTap, this.color = const Color(0xFF1565C0)});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withAlpha(30),
          child: Icon(icon, color: color),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
        trailing: Icon(Icons.chevron_right, color: Colors.grey.shade400),
        onTap: onTap,
      ),
    );
  }
}
