import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/models/child_profile.dart';
import '../../../core/widgets/common_widgets.dart';

final _childDetailProvider =
    FutureProvider.autoDispose.family<ChildProfile, String>((ref, id) async {
  final resp = await ApiClient.instance.get(Endpoints.childById(id));
  final raw = resp.data as Map<String, dynamic>;
  return ChildProfile.fromJson((raw['data'] as Map<String, dynamic>?) ?? raw);
});

// ── Feature sections + tiles ──────────────────────────────────────────────────

class _Section {
  const _Section(this.title, this.tiles);
  final String title;
  final List<_Tile> tiles;
}

class _Tile {
  const _Tile(this.icon, this.label, this.route, {this.color});
  final IconData icon;
  final String label;
  final String route; // relative suffix appended to /parent/family/{id}/
  final Color? color;
}

const _sections = [
  _Section('Internet Controls', [
    _Tile(Icons.dns,           'DNS Rules',      'dns-rules',     color: Color(0xFF2563EB)),
    _Tile(Icons.filter_list,   'Safe Filters',   'safe-filters',  color: Color(0xFF1E40AF)),
    _Tile(Icons.apps_outlined, 'App Blocking',   'app-blocking',  color: Color(0xFF7B1FA2)),
    _Tile(Icons.history_edu,   'Browsing History','browsing',     color: Color(0xFF00695C)),
  ]),
  _Section('Screen Time', [
    _Tile(Icons.schedule,      'Schedule',       'schedule',      color: Color(0xFF2E7D32)),
    _Tile(Icons.timer_outlined,'Time Limits',    'time-limits',   color: Color(0xFFF57F17)),
    _Tile(Icons.bedtime,       'Bedtime',        'bedtime',       color: Color(0xFF4A148C)),
    _Tile(Icons.school,        'Homework Mode',  'homework-mode', color: Color(0xFF1B5E20)),
  ]),
  _Section('Location', [
    _Tile(Icons.map,            'Live Map',          'map',               color: Color(0xFF2563EB)),
    _Tile(Icons.history,        'Location History',  'location-history',  color: Color(0xFF37474F)),
    _Tile(Icons.fence,          'Geofences',         'geofences',         color: Color(0xFFE65100)),
  ]),
  _Section('Activity & Insights', [
    _Tile(Icons.phone_android,  'App Usage',       'app-usage',    color: Color(0xFF6A1B9A)),
    _Tile(Icons.psychology,     'AI Insights',     'ai-insights',  color: Color(0xFF1E40AF)),
  ]),
  _Section('Rewards & Tasks', [
    _Tile(Icons.star,           'Rewards',          'rewards',      color: Color(0xFFF9A825)),
    _Tile(Icons.thumb_up,       'Approvals',        'approvals',    color: Color(0xFF558B2F)),
  ]),
  _Section('Safety', [
    _Tile(Icons.contacts,       'Emergency Contacts','emergency-contacts', color: Color(0xFFC62828)),
    _Tile(Icons.battery_alert,  'Battery Alerts',    'battery-alerts',     color: Color(0xFFEF6C00)),
    _Tile(Icons.devices,        'Devices',           'devices',            color: Color(0xFF37474F)),
  ]),
];

// ── Screen ────────────────────────────────────────────────────────────────────

class ChildDetailScreen extends ConsumerWidget {
  const ChildDetailScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(_childDetailProvider(profileId));

    return Scaffold(
      body: profile.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => Scaffold(
          appBar: AppBar(title: const Text('Child Detail')),
          body: ErrorView(
            message: 'Failed to load profile',
            onRetry: () => ref.invalidate(_childDetailProvider(profileId)),
          ),
        ),
        data: (child) => _buildBody(context, child),
      ),
    );
  }

  Widget _buildBody(BuildContext context, ChildProfile child) {
    return CustomScrollView(slivers: [
      // ── Collapsible header ────────────────────────────────────────────────
      SliverAppBar(
        expandedHeight: 180,
        pinned: true,
        flexibleSpace: FlexibleSpaceBar(
          title: Text(child.name,
              style: const TextStyle(fontWeight: FontWeight.bold)),
          background: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF1E40AF), Color(0xFF1E40AF), Color(0xFF2563EB)],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
            ),
            child: Center(
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: Colors.white24,
                  backgroundImage: child.avatarUrl != null
                      ? NetworkImage(child.avatarUrl!) : null,
                  child: child.avatarUrl == null
                      ? Text(child.initials, style: const TextStyle(
                          color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold))
                      : null,
                ),
                const SizedBox(height: 8),
                if (child.age != null)
                  Text('Age ${child.age}',
                      style: const TextStyle(color: Colors.white70, fontSize: 13)),
              ]),
            ),
          ),
        ),
      ),

      // ── Quick action buttons ──────────────────────────────────────────────
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Expanded(child: _quickBtn(
              context, 'Live Map', Icons.map, const Color(0xFF2563EB),
              () => context.push('/parent/family/$profileId/map'),
            )),
            const SizedBox(width: 8),
            Expanded(child: _quickBtn(
              context, 'Alerts', Icons.notifications, Colors.red,
              () => context.go('/parent/alerts'),
            )),
            const SizedBox(width: 8),
            Expanded(child: _quickBtn(
              context, 'Devices', Icons.devices, Colors.grey.shade700,
              () => context.push('/parent/family/$profileId/devices'),
            )),
          ]),
        ),
      ),

      // ── Feature sections ──────────────────────────────────────────────────
      for (final section in _sections) ...[
        SliverToBoxAdapter(child: SectionHeader(section.title)),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount:   3,
              mainAxisSpacing:  8,
              crossAxisSpacing: 8,
              childAspectRatio: 0.85,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, i) {
                final tile = section.tiles[i];
                return FeatureTile(
                  icon:  tile.icon,
                  label: tile.label,
                  color: tile.color,
                  onTap: () => context.push(
                    '/parent/family/$profileId/${tile.route}',
                  ),
                );
              },
              childCount: section.tiles.length,
            ),
          ),
        ),
      ],
      const SliverToBoxAdapter(child: SizedBox(height: 32)),
    ]);
  }

  Widget _quickBtn(BuildContext context, String label, IconData icon,
      Color color, VoidCallback onTap) =>
      ElevatedButton.icon(
        onPressed: onTap,
        icon:  Icon(icon, size: 16),
        label: Text(label, style: const TextStyle(fontSize: 12)),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 40),
          padding: const EdgeInsets.symmetric(horizontal: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
}
