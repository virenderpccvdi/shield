import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../core/api_client.dart';
import '../../core/badge_service.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

final alertsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  try {
    final res = await ref.read(dioProvider).get('/notifications/my/unread');
    return res.data['data'] as List? ?? [];
  } catch (e) {
    debugPrint('Alerts provider error: $e');
    return [];
  }
});

final spoofingAlertsProvider = FutureProvider.autoDispose.family<List<dynamic>, String>((ref, profileId) async {
  try {
    final res = await ref.read(dioProvider).get('/location/$profileId/spoofing-alerts');
    return res.data['data'] as List? ?? [];
  } catch (e) {
    debugPrint('Spoofing alerts provider error for $profileId: $e');
    return [];
  }
});

class AlertsScreen extends ConsumerStatefulWidget {
  final int initialTab;
  const AlertsScreen({super.key, this.initialTab = 0});

  @override
  ConsumerState<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends ConsumerState<AlertsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabs;
  List<_SosEvent> _sosEvents = [];
  bool _sosLoading = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this, initialIndex: widget.initialTab);
    // Clear badge when user opens alerts
    BadgeService.clear();
    _loadSosEvents();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _loadSosEvents() async {
    setState(() => _sosLoading = true);
    try {
      final client = ref.read(dioProvider);
      final profilesRes = await client.get('/profiles/children');
      final _apd = (profilesRes.data is Map) ? profilesRes.data['data'] : profilesRes.data;
      final profiles = (_apd is List ? _apd : (_apd is Map ? (_apd['content'] ?? _apd['items'] ?? []) : [])) as List? ?? [];

      // Filter valid profiles, then fetch all SOS events in parallel
      final validProfiles = profiles
          .where((p) => (p['id']?.toString() ?? '').isNotEmpty)
          .toList();

      final perProfileResults = await Future.wait(
        validProfiles.map((p) async {
          final profileId = p['id']?.toString() ?? '';
          final childName = p['name']?.toString() ?? 'Child';
          try {
            // GET /{profileId}/sos?all=true returns all events
            final res = await client.get('/location/$profileId/sos', queryParameters: {'all': 'true'});
            final items = res.data['data'] as List? ?? [];
            return items.map((item) {
              final m = item as Map<String, dynamic>;
              return _SosEvent(
                id: m['id']?.toString() ?? '',
                childName: childName,
                profileId: profileId,
                status: m['status']?.toString() ?? 'ACTIVE',
                latitude: _parseDouble(m['latitude']),
                longitude: _parseDouble(m['longitude']),
                message: m['message']?.toString() ?? '',
                timestamp: m['timestamp']?.toString() ?? m['createdAt']?.toString() ?? '',
              );
            }).toList();
          } catch (e) {
            debugPrint('SOS fetch for profile $profileId: $e');
            return <_SosEvent>[];
          }
        }),
        eagerError: false,
      );

      final allEvents = perProfileResults.expand((list) => list).toList();

      // Sort: active first, then newest
      allEvents.sort((a, b) {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return b.timestamp.compareTo(a.timestamp);
      });

      if (mounted) setState(() { _sosEvents = allEvents; _sosLoading = false; });
    } catch (e) {
      debugPrint('SOS events load error: $e');
      if (mounted) {
        setState(() => _sosLoading = false);
        showShieldError(context, e, fallback: 'Failed to load SOS events');
      }
    }
  }

  double? _parseDouble(dynamic v) {
    if (v == null) return null;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  bool get _hasActiveSos => _sosEvents.any((e) => e.isActive);

  Future<void> _acknowledge(String eventId) async {
    try {
      await ref.read(dioProvider).post('/location/sos/$eventId/acknowledge');
      _loadSosEvents();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('SOS acknowledged'), backgroundColor: ShieldTheme.success, behavior: SnackBarBehavior.floating),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: ShieldTheme.danger, behavior: SnackBarBehavior.floating),
        );
      }
    }
  }

  Future<void> _resolve(String eventId) async {
    try {
      await ref.read(dioProvider).post('/location/sos/$eventId/resolve');
      _loadSosEvents();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('SOS resolved'), backgroundColor: ShieldTheme.success, behavior: SnackBarBehavior.floating),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: ShieldTheme.danger, behavior: SnackBarBehavior.floating),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final alertsAsync = ref.watch(alertsProvider);
    final activeSosCount = _sosEvents.where((e) => e.isActive).length;

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
          tabs: [
            const Tab(text: 'Notifications'),
            const Tab(text: 'Location Alerts'),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('SOS Panic'),
                  if (activeSosCount > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      width: 18, height: 18,
                      decoration: const BoxDecoration(color: ShieldTheme.danger, shape: BoxShape.circle),
                      child: Center(
                        child: Text(
                          activeSosCount > 9 ? '9+' : '$activeSosCount',
                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Red banner visible from any tab when there are active SOS events
          if (_hasActiveSos)
            _SosActiveBanner(
              count: activeSosCount,
              onTap: () => _tabs.animateTo(2),
            ),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                // Tab 1: regular notifications
                alertsAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(child: Text('Error: $e')),
                  data: (alerts) {
                    BadgeService.setCount(alerts.length);
                    if (alerts.isEmpty) {
                      return const ShieldEmptyState(
                        icon: Icons.notifications_none,
                        title: 'No new alerts',
                        subtitle: 'You\'re all caught up!',
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
                          final severity = a['severity'] as String? ?? '';
                          final isCritical = severity == 'CRITICAL' || a['type'] == 'PANIC_BUTTON';
                          final isHigh = severity == 'HIGH';
                          final isMedium = severity == 'MEDIUM';
                          final Color alertColor;
                          if (isCritical || isHigh) {
                            alertColor = ShieldTheme.danger;
                          } else if (isMedium) {
                            alertColor = ShieldTheme.warning;
                          } else {
                            alertColor = ShieldTheme.textSecondary;
                          }
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: alertColor.withOpacity(0.12),
                                child: Icon(
                                  (isCritical || isHigh) ? Icons.warning_amber_rounded : Icons.info_outline,
                                  color: alertColor,
                                ),
                              ),
                              title: Text(a['title'] ?? a['type'] ?? 'Alert',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                              subtitle: Text(a['message'] ?? '', style: const TextStyle(fontSize: 12)),
                              trailing: Text(_timeAgo(a['createdAt']),
                                  style: const TextStyle(fontSize: 11, color: ShieldTheme.textSecondary)),
                            ),
                          );
                        },
                      ),
                    );
                  },
                ),

                // Tab 2: location spoofing alerts
                const _SpoofingAlertsTab(),

                // Tab 3: SOS Panic events
                _SosPanicTab(
                  events: _sosEvents,
                  loading: _sosLoading,
                  onRefresh: _loadSosEvents,
                  onAcknowledge: _acknowledge,
                  onResolve: _resolve,
                ),
              ],
            ),
          ),
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

// ── SOS Active Banner ───────────────────────────────────────────────────────

class _SosActiveBanner extends StatefulWidget {
  final int count;
  final VoidCallback onTap;
  const _SosActiveBanner({required this.count, required this.onTap});

  @override
  State<_SosActiveBanner> createState() => _SosActiveBannerState();
}

class _SosActiveBannerState extends State<_SosActiveBanner> with SingleTickerProviderStateMixin {
  late AnimationController _pulse;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 800))..repeat(reverse: true);
    _opacity = Tween<double>(begin: 0.7, end: 1.0).animate(_pulse);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      child: FadeTransition(
        opacity: _opacity,
        child: Container(
          width: double.infinity,
          color: ShieldTheme.danger,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(children: [
            const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                widget.count == 1
                    ? 'Active SOS Alert — a child needs help! Tap to respond'
                    : '${widget.count} Active SOS Alerts — children need help! Tap to respond',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ),
            const Icon(Icons.arrow_forward_ios, color: Colors.white70, size: 14),
          ]),
        ),
      ),
    );
  }
}

// ── SOS Event model ─────────────────────────────────────────────────────────

class _SosEvent {
  final String id, childName, profileId, status, message, timestamp;
  final double? latitude, longitude;
  const _SosEvent({
    required this.id,
    required this.childName,
    required this.profileId,
    required this.status,
    required this.message,
    required this.timestamp,
    this.latitude,
    this.longitude,
  });
  bool get isActive => status == 'ACTIVE';
  bool get isAcknowledged => status == 'ACKNOWLEDGED';
}

// ── SOS Panic Tab ────────────────────────────────────────────────────────────

class _SosPanicTab extends StatelessWidget {
  final List<_SosEvent> events;
  final bool loading;
  final Future<void> Function() onRefresh;
  final Future<void> Function(String) onAcknowledge;
  final Future<void> Function(String) onResolve;

  const _SosPanicTab({
    required this.events,
    required this.loading,
    required this.onRefresh,
    required this.onAcknowledge,
    required this.onResolve,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Column(children: [
          ShieldCardSkeleton(lines: 4),
          SizedBox(height: 12),
          ShieldCardSkeleton(lines: 3),
        ]),
      );
    }

    if (events.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: SizedBox(
            height: 400,
            child: const ShieldEmptyState(
              icon: Icons.health_and_safety_rounded,
              title: 'No SOS alerts',
              subtitle: 'Everyone is safe.',
            ),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: events.length,
        itemBuilder: (_, i) => _SosEventCard(
          event: events[i],
          onAcknowledge: onAcknowledge,
          onResolve: onResolve,
        ),
      ),
    );
  }
}

class _SosEventCard extends StatelessWidget {
  final _SosEvent event;
  final Future<void> Function(String) onAcknowledge;
  final Future<void> Function(String) onResolve;

  const _SosEventCard({
    required this.event,
    required this.onAcknowledge,
    required this.onResolve,
  });

  String _timeAgo(String ts) {
    if (ts.isEmpty) return '';
    try {
      final d = DateTime.parse(ts).toLocal();
      final diff = DateTime.now().difference(d);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inHours < 1) return '${diff.inMinutes}m ago';
      if (diff.inDays < 1) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (_) { return ts; }
  }

  Color get _statusColor {
    switch (event.status) {
      case 'ACTIVE': return ShieldTheme.danger;
      case 'ACKNOWLEDGED': return ShieldTheme.warning;
      case 'RESOLVED': return ShieldTheme.success;
      default: return ShieldTheme.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasLocation = event.latitude != null && event.longitude != null
        && ((event.latitude ?? 0.0) != 0.0 || (event.longitude ?? 0.0) != 0.0);

    return Card(
      color: event.isActive ? ShieldTheme.danger.withOpacity(0.04) : ShieldTheme.cardBg,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: event.isActive ? ShieldTheme.danger.withOpacity(0.35) : ShieldTheme.divider,
          width: event.isActive ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _statusColor,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(13)),
            ),
            child: Row(children: [
              _PulsingDot(active: event.isActive),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('SOS from ${event.childName}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                Text(_timeAgo(event.timestamp),
                    style: const TextStyle(color: Colors.white70, fontSize: 12)),
              ])),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(event.status,
                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
              ),
            ]),
          ),
          // Map or no-location notice
          if (hasLocation)
            SizedBox(
              height: 180,
              child: GoogleMap(
                initialCameraPosition: CameraPosition(
                  target: LatLng(event.latitude ?? 0.0, event.longitude ?? 0.0),
                  zoom: 15,
                ),
                markers: {
                  Marker(
                    markerId: MarkerId('sos_${event.id}'),
                    position: LatLng(event.latitude ?? 0.0, event.longitude ?? 0.0),
                    icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
                    infoWindow: InfoWindow(title: '${event.childName} SOS'),
                  ),
                },
                zoomControlsEnabled: false,
                scrollGesturesEnabled: false,
                rotateGesturesEnabled: false,
                tiltGesturesEnabled: false,
                myLocationEnabled: false,
                liteModeEnabled: true,
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                const Icon(Icons.location_off, color: ShieldTheme.textSecondary, size: 18),
                const SizedBox(width: 8),
                Text(
                  event.message.isNotEmpty ? event.message : 'Location unavailable',
                  style: const TextStyle(color: ShieldTheme.textSecondary, fontSize: 13),
                ),
              ]),
            ),
          // Actions (only for active/acknowledged)
          if (!event.status.contains('RESOLVED'))
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Row(children: [
                if (event.isActive)
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: event.id.isEmpty ? null : () => onAcknowledge(event.id),
                      icon: const Icon(Icons.check, size: 18),
                      label: const Text('Acknowledge'),
                      style: FilledButton.styleFrom(backgroundColor: ShieldTheme.warning),
                    ),
                  ),
                if (event.isActive) const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: event.id.isEmpty ? null : () => onResolve(event.id),
                    icon: const Icon(Icons.check_circle, size: 18),
                    label: const Text('Resolve'),
                    style: FilledButton.styleFrom(backgroundColor: ShieldTheme.success),
                  ),
                ),
              ]),
            ),
        ],
      ),
    );
  }
}

class _PulsingDot extends StatefulWidget {
  final bool active;
  const _PulsingDot({required this.active});

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..repeat(reverse: true);
    _scale = Tween<double>(begin: 0.7, end: 1.3).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) {
      return Container(width: 12, height: 12, decoration: const BoxDecoration(color: Colors.white70, shape: BoxShape.circle));
    }
    return ScaleTransition(
      scale: _scale,
      child: Container(width: 12, height: 12, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle)),
    );
  }
}

// ── Spoofing Alerts Tab ──────────────────────────────────────────────────────

class _SpoofingAlertsTab extends ConsumerWidget {
  const _SpoofingAlertsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
      final profilesRes = await client.get('/profiles/children');
      final _spd = (profilesRes.data is Map) ? profilesRes.data['data'] : profilesRes.data;
      final profiles = (_spd is List ? _spd : (_spd is Map ? (_spd['content'] ?? _spd['items'] ?? []) : [])) as List? ?? [];

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
        } catch (e) {
          debugPrint('Spoofing alerts fetch for $profileId: $e');
        }
      }

      allAlerts.sort((a, b) => b.detectedAt.compareTo(a.detectedAt));
      if (mounted) setState(() { _alerts = allAlerts; _loading = false; });
    } catch (e) {
      debugPrint('Spoofing alerts load error: $e');
      if (mounted) {
        setState(() => _loading = false);
        showShieldError(context, e, fallback: 'Failed to load location alerts');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Column(children: [
          ShieldCardSkeleton(lines: 4),
          SizedBox(height: 12),
          ShieldCardSkeleton(lines: 3),
        ]),
      );
    }

    if (_alerts.isEmpty) {
      return const ShieldEmptyState(
        icon: Icons.gps_fixed,
        title: 'No location spoofing detected',
        subtitle: 'All location signals look normal.',
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
        return 'Location changed faster than humanly possible.${alert.speed != null ? ' Speed: ${(alert.speed ?? 0.0).toStringAsFixed(1)} km/h.' : ''}';
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
        side: BorderSide(color: ShieldTheme.warning.withOpacity(0.3), width: 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: ShieldTheme.warning.withOpacity(0.12),
              child: const Icon(Icons.gps_off, color: ShieldTheme.warning, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(alert.childName,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                Text(_typeLabel,
                    style: const TextStyle(color: ShieldTheme.warning, fontSize: 12, fontWeight: FontWeight.w600)),
              ]),
            ),
            Text(_timeAgo(alert.detectedAt),
                style: const TextStyle(fontSize: 11, color: ShieldTheme.textSecondary)),
          ]),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: ShieldTheme.warning.withOpacity(0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(_typeDescription,
                style: const TextStyle(fontSize: 12, color: ShieldTheme.warning)),
          ),
        ]),
      ),
    );
  }
}
