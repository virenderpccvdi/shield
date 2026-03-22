import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';
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
  } catch (e) {
    debugPrint('Spoofing banner check error: $e');
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
  String? _error;
  bool _showSpoofingDetails = false;

  // 5 tabs: Overview | Controls | Location | Safety | Rewards
  static const _tabCount = 5;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: _tabCount, vsync: this);
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/profiles/children/${widget.profileId}');
      setState(() { _profile = res.data['data']; _loading = false; _error = null; });
    } catch (e) {
      debugPrint('Child profile load error: $e');
      if (mounted) {
        setState(() { _loading = false; _error = e.toString(); });
        showShieldError(context, e, fallback: 'Failed to load profile');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) { return Scaffold(
      appBar: AppBar(
        title: const Text('Loading…'),
        backgroundColor: ShieldTheme.primary,
        foregroundColor: Colors.white,
      ),
      body: const Padding(
        padding: EdgeInsets.all(16),
        child: Column(children: [
          ShieldCardSkeleton(lines: 2),
          SizedBox(height: 12),
          ShieldCardSkeleton(lines: 3),
          SizedBox(height: 12),
          ShieldCardSkeleton(lines: 4),
        ]),
      ),
    ); }
    if (_error != null && _profile == null) { return Scaffold(
      appBar: AppBar(
        title: const Text('Error'),
        backgroundColor: ShieldTheme.primary,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.error_outline, size: 64, color: ShieldTheme.danger),
            const SizedBox(height: 16),
            const Text('Failed to load profile', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: ShieldTheme.textSecondary, fontSize: 13), textAlign: TextAlign.center),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () { setState(() { _loading = true; _error = null; }); _loadProfile(); },
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ]),
        ),
      ),
    ); }
    final name = _profile?['name'] ?? 'Child';
    final spoofingAsync = ref.watch(spoofingBannerProvider(widget.profileId));

    return Scaffold(
      appBar: AppBar(
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: ShieldTheme.primary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            tooltip: 'Quick Controls',
            onPressed: () => QuickControlSheet.show(context, ref, widget.profileId),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Controls'),
            Tab(text: 'Location'),
            Tab(text: 'Safety'),
            Tab(text: 'Rewards'),
          ],
        ),
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
                      color: ShieldTheme.warning.withOpacity(0.1),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            const Icon(Icons.warning_amber_rounded, color: ShieldTheme.warning, size: 18),
                            const SizedBox(width: 8),
                            const Expanded(
                              child: Text(
                                'Possible GPS spoofing detected',
                                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: ShieldTheme.warning),
                              ),
                            ),
                            Icon(_showSpoofingDetails ? Icons.expand_less : Icons.expand_more,
                                color: ShieldTheme.warning, size: 18),
                          ]),
                          if (_showSpoofingDetails) ...[
                            const SizedBox(height: 6),
                            const Text(
                              'An anomaly was detected in the location data within the last 24 hours. '
                              'This may indicate the use of a GPS spoofing app. '
                              'Check Location Alerts in the Safety tab for details.',
                              style: TextStyle(fontSize: 12, color: ShieldTheme.textSecondary),
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
              _OverviewTab(profileId: widget.profileId, profile: _profile),
              _ControlsTab(profileId: widget.profileId),
              _LocationTab(profileId: widget.profileId),
              _SafetyTab(profileId: widget.profileId),
              _RewardsTab(profileId: widget.profileId),
            ]),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() { _tabs.dispose(); super.dispose(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab — child info card + last seen location + recent activity
// ─────────────────────────────────────────────────────────────────────────────

class _OverviewTab extends ConsumerWidget {
  final String profileId;
  final Map<String, dynamic>? profile;
  const _OverviewTab({required this.profileId, required this.profile});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name       = profile?['name'] as String? ?? 'Child';
    final initial    = name.isNotEmpty ? name[0].toUpperCase() : 'C';
    final filterLevel= profile?['filterLevel'] as String? ?? 'MODERATE';
    final online     = profile?['online'] as bool? ?? false;
    final lastSeen   = profile?['lastSeenAt'] as String?;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Profile hero card ──────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: ShieldTheme.heroGradient,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(children: [
            // Avatar
            Stack(children: [
              CircleAvatar(
                radius: 36,
                backgroundColor: Colors.white.withOpacity(0.2),
                child: Text(initial, style: const TextStyle(
                    color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800)),
              ),
              Positioned(
                bottom: 2, right: 2,
                child: Container(
                  width: 16, height: 16,
                  decoration: BoxDecoration(
                    color: online ? ShieldTheme.successLight : Colors.grey.shade400,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                ),
              ),
            ]),
            const SizedBox(width: 16),
            // Info
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, style: const TextStyle(
                    color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Container(
                          width: 6, height: 6,
                          margin: const EdgeInsets.only(right: 5),
                          decoration: BoxDecoration(
                            color: online ? ShieldTheme.successLight : Colors.grey.shade400,
                            shape: BoxShape.circle,
                          ),
                        ),
                        Text(
                          online ? 'Online' : 'Offline',
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ]),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        filterLevel,
                        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
                if (lastSeen != null) ...[
                  const SizedBox(height: 6),
                  Row(children: [
                    const Icon(Icons.access_time_rounded, size: 13, color: Colors.white60),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        'Last seen ${_fmtRelative(lastSeen)}',
                        style: const TextStyle(fontSize: 12, color: Colors.white70),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ]),
                ],
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 16),

        // ── Quick action row ───────────────────────────────────────────
        Row(children: [
          _OverviewQuickBtn(
            icon: Icons.dns_rounded, label: 'DNS Rules',
            color: ShieldTheme.primary,
            onTap: () => context.go('/family/$profileId/dns-rules'),
          ),
          const SizedBox(width: 8),
          _OverviewQuickBtn(
            icon: Icons.map_rounded, label: 'Location',
            color: ShieldTheme.success,
            onTap: () => context.go('/map?profileId=$profileId'),
          ),
          const SizedBox(width: 8),
          _OverviewQuickBtn(
            icon: Icons.timer_rounded, label: 'Screen Time',
            color: ShieldTheme.warning,
            onTap: () => context.go('/family/$profileId/time-limits'),
          ),
          const SizedBox(width: 8),
          _OverviewQuickBtn(
            icon: Icons.emoji_events_rounded, label: 'Rewards',
            color: ShieldTheme.primaryLight,
            onTap: () => context.go('/family/$profileId/rewards'),
          ),
        ]),
        const SizedBox(height: 20),

        // ── Recent activity ────────────────────────────────────────────
        const _SectionLabel(label: 'Recent Activity'),
        const SizedBox(height: 10),
        _RecentActivityCard(profileId: profileId),
      ],
    );
  }

  String _fmtRelative(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (_) {
      return iso;
    }
  }
}

class _OverviewQuickBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _OverviewQuickBtn({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: ShieldTheme.cardBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: ShieldTheme.divider),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 5),
              Text(label,
                  style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecentActivityCard extends ConsumerWidget {
  final String profileId;
  const _RecentActivityCard({required this.profileId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<Response>(
      future: ref.read(dioProvider).get('/analytics/$profileId/history',
          queryParameters: {'page': 0, 'size': 10}),
      builder: (ctx, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const ShieldCardSkeleton(lines: 4);
        }
        final d = snap.data?.data;
        final inner = d is Map ? (d['data'] ?? d) : d;
        final events = inner is List ? inner : (inner is Map ? (inner['content'] ?? inner['items'] ?? []) : []) as List? ?? [];
        if (events.isEmpty) {
          return Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: ShieldTheme.cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: ShieldTheme.divider),
            ),
            child: const Center(
              child: Text('No recent activity', style: TextStyle(color: ShieldTheme.textSecondary)),
            ),
          );
        }
        return Container(
          decoration: BoxDecoration(
            color: ShieldTheme.cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: ShieldTheme.divider),
          ),
          child: ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: events.length > 8 ? 8 : events.length,
            separatorBuilder: (_, __) => const Divider(height: 1, indent: 16, endIndent: 16),
            itemBuilder: (_, i) {
              final e = events[i] as Map<String, dynamic>;
              final blocked = e['action'] == 'BLOCKED';
              return ListTile(
                dense: true,
                leading: Icon(
                  blocked ? Icons.block : Icons.check_circle,
                  color: blocked ? ShieldTheme.dangerLight : ShieldTheme.successLight,
                  size: 20,
                ),
                title: Text(e['domain'] ?? '', style: const TextStyle(fontSize: 13)),
                subtitle: Text(e['category'] ?? '', style: const TextStyle(fontSize: 11)),
                trailing: Text(
                  _fmt(e['queriedAt'] ?? e['timestamp'] ?? ''),
                  style: const TextStyle(fontSize: 11, color: ShieldTheme.textSecondary),
                ),
              );
            },
          ),
        );
      },
    );
  }

  String _fmt(String ts) {
    try {
      final d = DateTime.parse(ts).toLocal();
      return '${d.hour}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) { return ts; }
  }
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
    try { return await fn(); } catch (e) { debugPrint('ChildDetail safeFetch: $e'); return null; }
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed: $e'),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to cancel override: $e'),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
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

          // ── 3. Content & Filtering ─────────────────────────────────────
          const _SectionLabel(label: 'Content & Filtering'),
          const SizedBox(height: 10),
          _NavCard(
            icon: Icons.dns_rounded,
            title: 'DNS Content Rules',
            subtitle: 'Block categories, custom lists',
            color: ShieldTheme.primary,
            onTap: () => context.go('/family/${widget.profileId}/dns-rules'),
          ),

          // ── 4. Screen Time ─────────────────────────────────────────────
          const SizedBox(height: 16),
          const _SectionLabel(label: 'Screen Time'),
          const SizedBox(height: 10),
          _NavCard(
            icon: Icons.timer_rounded,
            title: 'Time Limits',
            subtitle: 'Daily screen time budgets per app',
            color: ShieldTheme.warning,
            onTap: () => context.go('/family/${widget.profileId}/time-limits'),
          ),
          _NavCard(
            icon: Icons.schedule_rounded,
            title: 'Internet Schedule',
            subtitle: 'Set weekly access hour grid',
            color: ShieldTheme.primaryLight,
            onTap: () => context.go('/family/${widget.profileId}/schedule'),
          ),
          _NavCard(
            icon: Icons.event_available_rounded,
            title: 'Access Schedule Viewer',
            subtitle: 'View active windows & current status',
            color: ShieldTheme.accent,
            onTap: () => context.go('/family/${widget.profileId}/schedule-viewer'),
          ),
          _NavCard(
            icon: Icons.school_rounded,
            title: 'Homework Mode',
            subtitle: 'Block distractions during study time',
            color: ShieldTheme.primaryDark,
            onTap: () => QuickControlSheet.show(context, ref, widget.profileId),
          ),
          _NavCard(
            icon: Icons.hourglass_top_rounded,
            title: 'App Time Budgets',
            subtitle: 'Per-app daily time allowances',
            color: ShieldTheme.warning,
            onTap: () => context.go('/family/${widget.profileId}/time-limits'),
          ),
          _NavCard(
            icon: Icons.pending_actions_rounded,
            title: 'Screen Time Requests',
            subtitle: 'Review and approve extra time requests',
            color: ShieldTheme.success,
            onTap: () => context.go('/family/${widget.profileId}/time-limits'),
          ),

          // ── 5. Rewards & Reports ───────────────────────────────────────
          const SizedBox(height: 16),
          const _SectionLabel(label: 'Rewards & Reports'),
          const SizedBox(height: 10),
          _NavCard(
            icon: Icons.emoji_events_rounded,
            title: 'Rewards & Tasks',
            subtitle: 'Manage tasks and reward bank',
            color: ShieldTheme.warning,
            onTap: () => context.go('/family/${widget.profileId}/rewards'),
          ),
          _NavCard(
            icon: Icons.bar_chart_rounded,
            title: 'Reports & Analytics',
            subtitle: 'Usage charts and insights',
            color: ShieldTheme.success,
            onTap: () => context.go('/family/${widget.profileId}/reports'),
          ),

          // ── 6. Devices ─────────────────────────────────────────────────
          const SizedBox(height: 16),
          const _SectionLabel(label: 'Devices'),
          const SizedBox(height: 10),
          _NavCard(
            icon: Icons.block_rounded,
            title: 'App Blocking',
            subtitle: 'Block apps on child\'s device',
            color: ShieldTheme.danger,
            onTap: () => context.go('/family/${widget.profileId}/app-blocking'),
          ),
          _NavCard(
            icon: Icons.devices_rounded,
            title: 'Manage Devices',
            subtitle: 'Add or remove child devices',
            color: ShieldTheme.primaryDark,
            onTap: () => context.go('/family/${widget.profileId}/devices'),
          ),
          _NavCard(
            icon: Icons.phonelink_setup_rounded,
            title: 'Child Device Setup',
            subtitle: 'Guided QR setup for child\'s phone',
            color: ShieldTheme.primary,
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
                            ? ShieldTheme.successLight.withOpacity(0.25)
                            : ShieldTheme.dangerLight.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: on ? ShieldTheme.successLight : ShieldTheme.dangerLight,
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            on ? Icons.shield_rounded : Icons.shield_outlined,
                            size: 14,
                            color: on ? ShieldTheme.successLight : ShieldTheme.dangerLight,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            on ? 'Protected' : 'Unprotected',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: on ? ShieldTheme.successLight : ShieldTheme.dangerLight,
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
                            s.contains(WidgetState.selected) ? ShieldTheme.successLight : ShieldTheme.dangerLight),
                          trackColor: WidgetStateProperty.resolveWith((s) =>
                            s.contains(WidgetState.selected)
                                ? ShieldTheme.success.withOpacity(0.6)
                                : ShieldTheme.danger.withOpacity(0.5)),
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

// ─────────────────────────────────────────────────────────────────────────────
// Location Tab
// ─────────────────────────────────────────────────────────────────────────────

class _LocationTab extends StatelessWidget {
  final String profileId;
  const _LocationTab({required this.profileId});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const _SectionLabel(label: 'Live Tracking'),
        const SizedBox(height: 10),
        _NavCard(
          icon: Icons.location_on_rounded,
          title: 'Live Location',
          subtitle: 'View real-time position on map',
          color: ShieldTheme.primary,
          onTap: () => context.go('/map?profileId=$profileId'),
        ),
        _NavCard(
          icon: Icons.route_rounded,
          title: 'Location History',
          subtitle: 'Route playback and timeline',
          color: ShieldTheme.warning,
          onTap: () => context.go('/family/$profileId/location-history'),
        ),
        const SizedBox(height: 16),
        const _SectionLabel(label: 'Zones & Places'),
        const SizedBox(height: 10),
        _NavCard(
          icon: Icons.fence_rounded,
          title: 'Geofences',
          subtitle: 'Set up safe zones and get breach alerts',
          color: ShieldTheme.primaryDark,
          onTap: () => context.go('/family/$profileId/geofences'),
        ),
        _NavCard(
          icon: Icons.school_rounded,
          title: 'School Zone',
          subtitle: 'Configure automatic school hours location',
          color: ShieldTheme.primaryLight,
          onTap: () => context.go('/family/$profileId/geofences'),
        ),
        _NavCard(
          icon: Icons.place_rounded,
          title: 'Saved Places',
          subtitle: 'Manage frequently visited locations',
          color: ShieldTheme.success,
          onTap: () => context.go('/family/$profileId/places'),
        ),
        const SizedBox(height: 16),
        const _SectionLabel(label: 'Sharing & Reminders'),
        const SizedBox(height: 10),
        _NavCard(
          icon: Icons.link_rounded,
          title: 'Share Location',
          subtitle: 'Create temporary shareable links',
          color: ShieldTheme.accent,
          onTap: () => context.go('/family/$profileId/location-share'),
        ),
        _NavCard(
          icon: Icons.notifications_active_rounded,
          title: 'Check-in Reminders',
          subtitle: 'Get notified if child goes silent',
          color: ShieldTheme.primaryDark,
          onTap: () => context.go('/family/$profileId/checkin-reminder'),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Safety Tab
// ─────────────────────────────────────────────────────────────────────────────

class _SafetyTab extends StatelessWidget {
  final String profileId;
  const _SafetyTab({required this.profileId});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const _SectionLabel(label: 'Emergency'),
        const SizedBox(height: 10),
        _NavCard(
          icon: Icons.contact_emergency_rounded,
          title: 'Emergency Contacts',
          subtitle: 'Manage trusted contacts for SOS',
          color: ShieldTheme.danger,
          onTap: () => context.go('/alerts/sos'),
        ),
        _NavCard(
          icon: Icons.sos_rounded,
          title: 'SOS Alerts',
          subtitle: 'View and respond to panic alerts',
          color: ShieldTheme.dangerLight,
          onTap: () => context.go('/alerts/sos'),
        ),
        const SizedBox(height: 16),
        const _SectionLabel(label: 'Monitoring'),
        const SizedBox(height: 10),
        _NavCard(
          icon: Icons.battery_alert_rounded,
          title: 'Battery Alerts',
          subtitle: 'Notify when battery is critically low',
          color: ShieldTheme.warning,
          onTap: () => context.go('/alerts'),
        ),
        _NavCard(
          icon: Icons.psychology_rounded,
          title: 'Suspicious Activity',
          subtitle: 'AI-detected anomalies and risk flags',
          color: ShieldTheme.primaryDark,
          onTap: () => context.go('/family/$profileId/ai-insights'),
        ),
        _NavCard(
          icon: Icons.gps_not_fixed_rounded,
          title: 'Location Alerts',
          subtitle: 'Geofence breaches and spoofing detection',
          color: ShieldTheme.danger,
          onTap: () => context.go('/alerts'),
        ),
        const SizedBox(height: 16),
        const _SectionLabel(label: 'AI Insights'),
        const SizedBox(height: 10),
        _NavCard(
          icon: Icons.auto_awesome_rounded,
          title: 'AI Behavioral Insights',
          subtitle: 'Risk analysis and recommendations',
          color: ShieldTheme.accent,
          onTap: () => context.go('/family/$profileId/ai-insights'),
        ),
        _NavCard(
          icon: Icons.bar_chart_rounded,
          title: 'Full Reports',
          subtitle: 'Detailed usage analytics',
          color: ShieldTheme.success,
          onTap: () => context.go('/family/$profileId/reports'),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rewards Tab
// ─────────────────────────────────────────────────────────────────────────────

class _RewardsTab extends StatelessWidget {
  final String profileId;
  const _RewardsTab({required this.profileId});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const _SectionLabel(label: 'Points & Rewards'),
        const SizedBox(height: 10),
        _NavCard(
          icon: Icons.emoji_events_rounded,
          title: 'Points & Rewards',
          subtitle: 'Manage reward bank and redeem points',
          color: ShieldTheme.warning,
          onTap: () => context.go('/family/$profileId/rewards'),
        ),
        _NavCard(
          icon: Icons.task_alt_rounded,
          title: 'Tasks',
          subtitle: 'Assign tasks and track completion',
          color: ShieldTheme.success,
          onTap: () => context.go('/family/$profileId/rewards'),
        ),
        const SizedBox(height: 16),
        const _SectionLabel(label: 'Achievements'),
        const SizedBox(height: 10),
        _NavCard(
          icon: Icons.military_tech_rounded,
          title: 'Achievements & Badges',
          subtitle: 'Celebrate milestones and good behavior',
          color: ShieldTheme.primaryLight,
          onTap: () => context.go('/achievements'),
        ),
        _NavCard(
          icon: Icons.leaderboard_rounded,
          title: 'Progress & Streaks',
          subtitle: 'Daily streaks and overall progress',
          color: ShieldTheme.primary,
          onTap: () => context.go('/family/$profileId/reports'),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared local widgets
// ─────────────────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 11,
        color: ShieldTheme.textSecondary,
        letterSpacing: 0.8,
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
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 17),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
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

class _NavCard extends StatelessWidget {
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  final Color color;
  const _NavCard({required this.icon, required this.title, required this.subtitle,
      required this.onTap, this.color = ShieldTheme.primary});

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
                      Text(title, style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 14, color: ShieldTheme.textPrimary)),
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
