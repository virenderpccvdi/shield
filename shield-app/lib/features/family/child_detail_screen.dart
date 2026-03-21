import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../parent/quick_control_sheet.dart';

// Provider for spoofing check — returns true if spoofing detected within 24h
final spoofingBannerProvider = FutureProvider.autoDispose.family<bool, String>((ref, profileId) async {
  try {
    final res = await ref.read(dioProvider).get(
      '/location/$profileId/spoofing-alerts',
      queryParameters: {'limit': 1},
    );
    final items = res.data['data'] as List? ?? [];
    if (items.isEmpty) return false;
    final first = items.first as Map<String, dynamic>;
    final tsStr = first['detectedAt']?.toString() ?? first['detected_at']?.toString() ?? '';
    if (tsStr.isEmpty) return true; // alert exists but no timestamp — show banner
    final ts = DateTime.tryParse(tsStr);
    if (ts == null) return true;
    return DateTime.now().difference(ts).inHours < 24;
  } catch (_) {
    return false;
  }
});

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
  bool _showSpoofingDetails = false;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this);
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/profiles/children/${widget.profileId}');
      setState(() { _profile = res.data['data']; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final name = _profile?['name'] ?? 'Child';
    final spoofingAsync = ref.watch(spoofingBannerProvider(widget.profileId));

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
      body: Column(
        children: [
          // Spoofing banner — only shown when detected within 24h
          spoofingAsync.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (detected) => detected
                ? GestureDetector(
                    onTap: () => setState(() => _showSpoofingDetails = !_showSpoofingDetails),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: double.infinity,
                      color: Colors.amber.shade100,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 18),
                            const SizedBox(width: 8),
                            const Expanded(
                              child: Text(
                                'Possible GPS spoofing detected',
                                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Colors.orange),
                              ),
                            ),
                            Icon(_showSpoofingDetails ? Icons.expand_less : Icons.expand_more,
                                color: Colors.orange, size: 18),
                          ]),
                          if (_showSpoofingDetails) ...[
                            const SizedBox(height: 6),
                            const Text(
                              'An anomaly was detected in the location data within the last 24 hours. '
                              'This may indicate the use of a GPS spoofing app. '
                              'Check Location Alerts in the Alerts tab for details.',
                              style: TextStyle(fontSize: 12, color: Colors.brown),
                            ),
                          ],
                        ],
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
          // Main content
          Expanded(
            child: TabBarView(controller: _tabs, children: [
              _ActivityTab(profileId: widget.profileId),
              _ControlsTab(profileId: widget.profileId),
              _LocationTab(profileId: widget.profileId),
              _InsightsTab(profileId: widget.profileId),
            ]),
          ),
        ],
      ),
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
      future: ref.read(dioProvider).get('/analytics/$profileId/history', queryParameters: {'page': 0, 'size': 50}),
      builder: (ctx, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
        final raw = snap.data?.data['data'];
        final events = (raw is Map ? (raw['content'] ?? raw['items'] ?? []) : raw) as List? ?? [];
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
              trailing: Text(_fmt(e['queriedAt'] ?? e['timestamp']), style: const TextStyle(fontSize: 11, color: Colors.grey)),
            );
          },
        );
      },
    );
  }
  String _fmt(String ts) { try { final d = DateTime.parse(ts).toLocal(); return '${d.hour}:${d.minute.toString().padLeft(2,'0')}'; } catch (_) { return ts; } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Controls Tab — enhanced with real-time status and quick stats
// ─────────────────────────────────────────────────────────────────────────────

class _ControlsTabData {
  final bool internetOn;
  final String scheduleLabel;
  final int blockedToday;
  final int timeUsedMinutes;
  final int activeDevices;
  final bool hasActiveOverride;
  const _ControlsTabData({
    required this.internetOn,
    required this.scheduleLabel,
    required this.blockedToday,
    required this.timeUsedMinutes,
    required this.activeDevices,
    required this.hasActiveOverride,
  });
}

class _ControlsTab extends ConsumerStatefulWidget {
  final String profileId;
  const _ControlsTab({required this.profileId});

  @override
  ConsumerState<_ControlsTab> createState() => _ControlsTabState();
}

class _ControlsTabState extends ConsumerState<_ControlsTab> {
  _ControlsTabData? _data;
  bool _loading = true;
  bool _toggling = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    if (!mounted) return;
    setState(() => _loading = true);
    final client = ref.read(dioProvider);

    // Parallel fetch — tolerate individual failures
    final results = await Future.wait([
      _safeFetch(() => client.get('/dns/schedules/${widget.profileId}/status')),
      _safeFetch(() => client.get('/dns/budgets/${widget.profileId}/today')),
      _safeFetch(() => client.get('/analytics/${widget.profileId}/stats/today')),
      _safeFetch(() => client.get('/profiles/devices/profile/${widget.profileId}')),
    ]);

    final scheduleRes = results[0];
    final budgetRes   = results[1];
    final statsRes    = results[2];
    final devicesRes  = results[3];

    // Parse internet status
    bool internetOn = true;
    String scheduleLabel = 'Checking…';
    bool hasActiveOverride = false;
    if (scheduleRes != null) {
      final d = scheduleRes.data['data'] as Map<String, dynamic>? ?? {};
      final overrideMode = d['overrideMode']?.toString();
      final scheduleMode = d['currentMode']?.toString() ?? d['mode']?.toString() ?? '';
      hasActiveOverride = overrideMode != null && overrideMode.isNotEmpty;
      if (overrideMode == 'BLOCK_ALL') {
        internetOn = false;
        scheduleLabel = 'Manually paused';
      } else if (overrideMode == 'ALLOW_ALL') {
        internetOn = true;
        scheduleLabel = 'Override: all allowed';
      } else if (scheduleMode == 'BLOCKED') {
        internetOn = false;
        final until = d['blockedUntil']?.toString() ?? '';
        scheduleLabel = until.isNotEmpty ? 'Blocked until $until' : 'Schedule: blocked';
      } else if (scheduleMode == 'ALLOWED') {
        internetOn = true;
        final until = d['allowedUntil']?.toString() ?? '';
        scheduleLabel = until.isNotEmpty ? 'Free time until $until' : 'Schedule: allowed';
      } else if (scheduleMode == 'SCHOOL') {
        internetOn = false;
        final until = d['blockedUntil']?.toString() ?? '4:00 PM';
        scheduleLabel = 'School Hours — blocked until $until';
      } else {
        scheduleLabel = 'Normal schedule';
      }
    } else {
      scheduleLabel = 'Status unavailable';
    }

    // Parse time budget
    int timeUsedMinutes = 0;
    if (budgetRes != null) {
      final d = budgetRes.data['data'] as Map<String, dynamic>? ?? {};
      timeUsedMinutes = (d['usedMinutes'] ?? d['used_minutes'] ?? 0) as int;
    }

    // Parse blocked today count
    int blockedToday = 0;
    if (statsRes != null) {
      final d = statsRes.data['data'] as Map<String, dynamic>? ?? {};
      blockedToday = (d['blockedToday'] ?? d['blocked_today'] ?? d['blocked'] ?? 0) as int;
    }

    // Parse active devices count
    int activeDevices = 0;
    if (devicesRes != null) {
      final raw = devicesRes.data['data'];
      if (raw is List) {
        activeDevices = raw.length;
      } else if (raw is Map) {
        final items = raw['content'] ?? raw['items'] ?? raw['devices'] ?? [];
        activeDevices = (items as List).length;
      }
    }

    if (mounted) {
      setState(() {
        _data = _ControlsTabData(
          internetOn: internetOn,
          scheduleLabel: scheduleLabel,
          blockedToday: blockedToday,
          timeUsedMinutes: timeUsedMinutes,
          activeDevices: activeDevices,
          hasActiveOverride: hasActiveOverride,
        );
        _loading = false;
      });
    }
  }

  Future<Response?> _safeFetch(Future<Response> Function() fn) async {
    try { return await fn(); } catch (_) { return null; }
  }

  Future<void> _toggleInternet(bool turnOn) async {
    setState(() => _toggling = true);
    final client = ref.read(dioProvider);
    try {
      if (turnOn) {
        // Turn ON: cancel any block override — resume normal schedule
        await client.delete('/dns/schedules/${widget.profileId}/override');
      } else {
        // Turn OFF: apply BLOCK_ALL override (0 = indefinite)
        await client.post(
          '/dns/rules/${widget.profileId}/override',
          data: {'overrideType': 'BLOCK_ALL', 'durationMinutes': 0},
        );
      }
      await _loadData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: ShieldTheme.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _toggling = false);
    }
  }

  Future<void> _cancelOverride() async {
    setState(() => _toggling = true);
    try {
      await ref.read(dioProvider).delete('/dns/schedules/${widget.profileId}/override');
      await _loadData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to cancel override: $e'), backgroundColor: ShieldTheme.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _toggling = false);
    }
  }

  String _formatTime(int minutes) {
    if (minutes <= 0) return '0m';
    if (minutes < 60) return '${minutes}m';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return m == 0 ? '${h}h' : '${h}h ${m}m';
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── 1. Internet Status Card ────────────────────────────────────
          _buildInternetStatusCard(),
          const SizedBox(height: 12),

          // ── 2. Quick Stats Row ─────────────────────────────────────────
          _buildQuickStatsRow(),
          const SizedBox(height: 20),

          // ── 3. Navigation Cards ────────────────────────────────────────
          _SectionLabel(label: 'Parental Controls'),
          const SizedBox(height: 10),
          _NavCard(
            icon: Icons.dns_rounded,
            title: 'DNS Content Rules',
            subtitle: 'Block categories of content',
            color: ShieldTheme.primary,
            onTap: () => context.go('/family/${widget.profileId}/dns-rules'),
          ),
          _NavCard(
            icon: Icons.schedule_rounded,
            title: 'Internet Schedule',
            subtitle: 'Set weekly access times',
            color: const Color(0xFF0277BD),
            onTap: () => context.go('/family/${widget.profileId}/schedule'),
          ),
          _NavCard(
            icon: Icons.timer_rounded,
            title: 'Time Limits',
            subtitle: 'Daily screen time budgets',
            color: ShieldTheme.warning,
            onTap: () => context.go('/family/${widget.profileId}/time-limits'),
          ),
          const SizedBox(height: 16),
          _SectionLabel(label: 'Rewards & Reports'),
          const SizedBox(height: 10),
          _NavCard(
            icon: Icons.emoji_events_rounded,
            title: 'Rewards & Tasks',
            subtitle: 'Manage tasks and reward bank',
            color: Colors.amber.shade700,
            onTap: () => context.go('/family/${widget.profileId}/rewards'),
          ),
          _NavCard(
            icon: Icons.bar_chart_rounded,
            title: 'Reports & Analytics',
            subtitle: 'Usage charts and insights',
            color: Colors.teal,
            onTap: () => context.go('/family/${widget.profileId}/reports'),
          ),
          const SizedBox(height: 16),
          _SectionLabel(label: 'Devices'),
          const SizedBox(height: 10),
          _NavCard(
            icon: Icons.block_rounded,
            title: 'App Blocking',
            subtitle: 'Block apps on child\'s device',
            color: Colors.red.shade700,
            onTap: () => context.go('/family/${widget.profileId}/app-blocking'),
          ),
          _NavCard(
            icon: Icons.devices_rounded,
            title: 'Manage Devices',
            subtitle: 'Add or remove child devices',
            color: Colors.blue.shade800,
            onTap: () => context.go('/family/${widget.profileId}/devices'),
          ),
          _NavCard(
            icon: Icons.phonelink_setup_rounded,
            title: 'Child Device Setup',
            subtitle: 'Guided QR setup for child\'s phone',
            color: Colors.blue.shade700,
            onTap: () => context.go('/child-setup'),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildInternetStatusCard() {
    final on = _data?.internetOn ?? true;
    final label = _data?.scheduleLabel ?? '';
    final hasOverride = _data?.hasActiveOverride ?? false;

    return Container(
      decoration: BoxDecoration(
        gradient: ShieldTheme.heroGradient,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Stack(
        children: [
          // Decorative glow circle
          Positioned(
            right: -20, top: -20,
            child: Container(
              width: 120, height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.06),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header row: status badge + toggle
                Row(
                  children: [
                    // Status badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: on
                            ? Colors.green.shade400.withOpacity(0.25)
                            : Colors.red.shade400.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: on ? Colors.green.shade300 : Colors.red.shade300,
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            on ? Icons.shield_rounded : Icons.shield_outlined,
                            size: 14,
                            color: on ? Colors.green.shade300 : Colors.red.shade300,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            on ? 'Protected' : 'Unprotected',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: on ? Colors.green.shade300 : Colors.red.shade300,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    // Toggle
                    if (_loading || _toggling)
                      const SizedBox(
                        width: 24, height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(Colors.white),
                        ),
                      )
                    else
                      Transform.scale(
                        scale: 1.1,
                        child: Switch(
                          value: on,
                          onChanged: _toggleInternet,
                          thumbColor: WidgetStateProperty.resolveWith((s) =>
                            s.contains(WidgetState.selected) ? Colors.green.shade300 : Colors.red.shade300),
                          trackColor: WidgetStateProperty.resolveWith((s) =>
                            s.contains(WidgetState.selected)
                                ? Colors.green.shade800.withOpacity(0.6)
                                : Colors.red.shade900.withOpacity(0.5)),
                          trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                // Big label
                Text(
                  on ? 'Internet ON' : 'Internet OFF',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 4),
                // Schedule state
                if (!_loading && label.isNotEmpty)
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.white.withOpacity(0.75),
                    ),
                  ),
                // Cancel override button
                if (!_loading && hasOverride && !_toggling) ...[
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: _cancelOverride,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withOpacity(0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.undo_rounded, size: 14, color: Colors.white),
                          SizedBox(width: 6),
                          Text(
                            'Cancel override — restore schedule',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickStatsRow() {
    return Row(
      children: [
        Expanded(child: _StatBox(
          icon: Icons.block_rounded,
          label: 'Blocked Today',
          value: _loading ? '—' : '${_data?.blockedToday ?? 0}',
          color: ShieldTheme.danger,
        )),
        const SizedBox(width: 10),
        Expanded(child: _StatBox(
          icon: Icons.access_time_rounded,
          label: 'Time Used',
          value: _loading ? '—' : _formatTime(_data?.timeUsedMinutes ?? 0),
          color: ShieldTheme.warning,
        )),
        const SizedBox(width: 10),
        Expanded(child: _StatBox(
          icon: Icons.devices_rounded,
          label: 'Devices',
          value: _loading ? '—' : '${_data?.activeDevices ?? 0}',
          color: ShieldTheme.primary,
        )),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 13,
        color: ShieldTheme.textSecondary,
        letterSpacing: 0.6,
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  const _StatBox({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ShieldTheme.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30, height: 30,
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 17),
            alignment: Alignment.center,
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: ShieldTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: ShieldTheme.textSecondary),
          ),
        ],
      ),
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
          color: Colors.blue,
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
  const _NavCard({required this.icon, required this.title, required this.subtitle, required this.onTap, this.color = ShieldTheme.primary});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: ShieldTheme.divider),
            ),
            child: Row(
              children: [
                // Left accent bar
                Container(
                  width: 4,
                  height: 62,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(16),
                      bottomLeft: Radius.circular(16),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                // Icon container
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, color: color, size: 20),
                ),
                const SizedBox(width: 14),
                // Text
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: ShieldTheme.textPrimary)),
                      const SizedBox(height: 2),
                      Text(subtitle, style: const TextStyle(fontSize: 12, color: ShieldTheme.textSecondary)),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: ShieldTheme.textSecondary.withOpacity(0.5), size: 20),
                const SizedBox(width: 12),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
