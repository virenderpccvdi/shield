import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/badge_service.dart';

final alertsProvider = FutureProvider<List<dynamic>>((ref) async {
  try {
    final res = await ref.read(dioProvider).get('/notifications/my/unread');
    return res.data['data'] as List? ?? [];
  } catch (_) {
    return [];
  }
});

final spoofingAlertsProvider = FutureProvider.family<List<dynamic>, String>((ref, profileId) async {
  try {
    final res = await ref.read(dioProvider).get('/location/$profileId/spoofing-alerts');
    return res.data['data'] as List? ?? [];
  } catch (_) {
    return [];
  }
});

class AlertsScreen extends ConsumerStatefulWidget {
  const AlertsScreen({super.key});

  @override
  ConsumerState<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends ConsumerState<AlertsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    // Clear badge when user opens alerts
    BadgeService.clear();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final alertsAsync = ref.watch(alertsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Alerts', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all),
            tooltip: 'Mark all read',
            onPressed: () async {
              await BadgeService.clear();
              ref.invalidate(alertsProvider);
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Notifications'),
            Tab(text: 'Location Alerts'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          // Tab 1: regular notifications
          alertsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
            data: (alerts) {
              // Update badge count with current unread count
              BadgeService.setCount(alerts.length);
              if (alerts.isEmpty) {
                return const Center(
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.notifications_none, size: 64, color: Colors.grey),
                    SizedBox(height: 16),
                    Text('No new alerts', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.grey)),
                    Text('You\'re all caught up!', style: TextStyle(color: Colors.grey)),
                  ]),
                );
              }
              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(alertsProvider);
                  await BadgeService.clear();
                },
                child: ListView.builder(
                  itemCount: alerts.length,
                  itemBuilder: (_, i) {
                    final a = alerts[i] as Map<String, dynamic>;
                    final isHigh = a['severity'] == 'HIGH' || a['type'] == 'PANIC_BUTTON';
                    return Card(
                      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: isHigh ? Colors.red.shade100 : Colors.orange.shade100,
                          child: Icon(isHigh ? Icons.warning : Icons.info_outline,
                              color: isHigh ? Colors.red : Colors.orange),
                        ),
                        title: Text(a['title'] ?? a['type'] ?? 'Alert',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        subtitle: Text(a['message'] ?? '', style: const TextStyle(fontSize: 12)),
                        trailing: Text(_timeAgo(a['createdAt']),
                            style: const TextStyle(fontSize: 11, color: Colors.grey)),
                      ),
                    );
                  },
                ),
              );
            },
          ),

          // Tab 2: location spoofing alerts
          const _SpoofingAlertsTab(),
        ],
      ),
    );
  }

  String _timeAgo(String? ts) {
    if (ts == null) return '';
    try {
      final d = DateTime.parse(ts);
      final diff = DateTime.now().difference(d);
      if (diff.inMinutes < 1) return 'just now';
      if (diff.inHours < 1) return '${diff.inMinutes}m ago';
      if (diff.inDays < 1) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (_) {
      return '';
    }
  }
}

class _SpoofingAlertsTab extends ConsumerWidget {
  const _SpoofingAlertsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // We show a combined view for all children profiles
    // Fetch profiles first, then spoofing alerts for each
    return _SpoofingAlertsView();
  }
}

class _SpoofingAlertsView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_SpoofingAlertsView> createState() => _SpoofingAlertsViewState();
}

class _SpoofingAlertsViewState extends ConsumerState<_SpoofingAlertsView> {
  List<_SpoofingAlert> _alerts = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      // Get all child profiles
      final profilesRes = await client.get('/profiles/children');
      final profiles = profilesRes.data['data'] as List? ?? [];

      final allAlerts = <_SpoofingAlert>[];
      for (final p in profiles) {
        final profileId = p['id']?.toString() ?? '';
        final childName = p['name']?.toString() ?? 'Child';
        if (profileId.isEmpty) continue;
        try {
          final res = await client.get('/location/$profileId/spoofing-alerts');
          final items = res.data['data'] as List? ?? [];
          for (final item in items) {
            final m = item as Map<String, dynamic>;
            allAlerts.add(_SpoofingAlert(
              childName: childName,
              profileId: profileId,
              type: m['type']?.toString() ?? 'SPOOFING',
              detectedAt: m['detectedAt']?.toString() ?? m['detected_at']?.toString() ?? '',
              details: m['details']?.toString() ?? m['reason']?.toString() ?? '',
              speed: m['speed'] as double?,
              accuracy: m['accuracy'] as double?,
            ));
          }
        } catch (_) {
          // Skip failed child — continue with others
        }
      }

      // Sort newest first
      allAlerts.sort((a, b) => b.detectedAt.compareTo(a.detectedAt));
      if (mounted) setState(() { _alerts = allAlerts; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    if (_alerts.isEmpty) {
      return const Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.gps_fixed, size: 64, color: Colors.green),
          SizedBox(height: 16),
          Text('No spoofing detected', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.grey)),
          Text('All location signals look normal.', style: TextStyle(color: Colors.grey)),
        ]),
      );
    }

    return RefreshIndicator(
      onRefresh: () async => _load(),
      child: ListView.builder(
        itemCount: _alerts.length,
        itemBuilder: (_, i) => _SpoofingAlertCard(alert: _alerts[i]),
      ),
    );
  }
}

class _SpoofingAlert {
  final String childName, profileId, type, detectedAt, details;
  final double? speed, accuracy;
  const _SpoofingAlert({
    required this.childName,
    required this.profileId,
    required this.type,
    required this.detectedAt,
    required this.details,
    this.speed,
    this.accuracy,
  });
}

class _SpoofingAlertCard extends StatelessWidget {
  final _SpoofingAlert alert;
  const _SpoofingAlertCard({required this.alert});

  String get _typeLabel {
    switch (alert.type) {
      case 'IMPOSSIBLE_SPEED': return 'Impossible Speed';
      case 'PERFECT_ACCURACY': return 'Suspicious GPS Accuracy';
      case 'MOCK_LOCATION': return 'Mock Location Detected';
      case 'TELEPORTATION': return 'Teleportation Detected';
      default: return alert.type.replaceAll('_', ' ');
    }
  }

  String get _typeDescription {
    switch (alert.type) {
      case 'IMPOSSIBLE_SPEED':
        return 'Location changed faster than humanly possible.${alert.speed != null ? ' Speed: ${alert.speed!.toStringAsFixed(1)} km/h.' : ''}';
      case 'PERFECT_ACCURACY':
        return 'GPS accuracy was suspiciously perfect (0m), which is a known spoofing indicator.';
      case 'MOCK_LOCATION':
        return 'Device reported a mock/fake location. Developer options may be enabled.';
      case 'TELEPORTATION':
        return 'Location jumped a large distance in a very short time without travel.';
      default:
        return alert.details.isNotEmpty ? alert.details : 'Possible GPS location spoofing detected.';
    }
  }

  String _timeAgo(String ts) {
    if (ts.isEmpty) return '';
    try {
      final d = DateTime.parse(ts);
      final diff = DateTime.now().difference(d);
      if (diff.inMinutes < 1) return 'just now';
      if (diff.inHours < 1) return '${diff.inMinutes}m ago';
      if (diff.inDays < 1) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.orange.shade200, width: 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: Colors.orange.shade100,
              child: const Icon(Icons.gps_off, color: Colors.orange, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(alert.childName,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                Text(_typeLabel,
                    style: TextStyle(color: Colors.orange.shade800, fontSize: 12, fontWeight: FontWeight.w600)),
              ]),
            ),
            Text(_timeAgo(alert.detectedAt),
                style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ]),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(_typeDescription,
                style: TextStyle(fontSize: 12, color: Colors.orange.shade900)),
          ),
        ]),
      ),
    );
  }
}
