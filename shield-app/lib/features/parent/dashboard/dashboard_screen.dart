import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/models/child_profile.dart';
import '../../../core/models/alert_model.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/common_widgets.dart';
import '../../../app/theme.dart';

// ── Providers ─────────────────────────────────────────────────────────────────

final _dashChildrenProvider = FutureProvider.autoDispose<List<ChildProfile>>((ref) async {
  final resp = await ApiClient.instance.get(Endpoints.children);
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.map((j) => ChildProfile.fromJson(j as Map<String, dynamic>)).toList();
});

final _dashAlertsProvider = FutureProvider.autoDispose<List<AlertModel>>((ref) async {
  final resp = await ApiClient.instance.get(Endpoints.alerts, params: {'limit': '5'});
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['content'] as List?
          ?? (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.map((j) => AlertModel.fromJson(j as Map<String, dynamic>)).toList();
});

final _dashActivityProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  try {
    final childrenResp = await ApiClient.instance.get(Endpoints.children);
    final rawChildren = childrenResp.data is List
        ? childrenResp.data as List
        : (childrenResp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
    if (rawChildren.isEmpty) return <String, dynamic>{};

    final firstId = (rawChildren.first as Map<String, dynamic>)['id']?.toString();
    if (firstId == null) return <String, dynamic>{};

    final dailyResp = await ApiClient.instance.get(
        '/analytics/$firstId/daily', params: {'days': '7'});
    final daily = dailyResp.data is List
        ? dailyResp.data as List
        : (dailyResp.data as Map<String, dynamic>?)?['data'] as List? ?? [];

    int totalBlocked = 0;
    int totalQueries = 0;
    for (final d in daily) {
      final m = d as Map<String, dynamic>;
      totalBlocked += ((m['totalBlocks'] ?? m['blockedQueries'] ?? m['blocked'] ?? 0) as num).toInt();
      totalQueries += ((m['totalQueries'] ?? 0) as num).toInt();
    }
    return {
      'blockedRequests': totalBlocked,
      'totalRequests':   totalQueries,
      'daily':           daily,
    };
  } catch (_) {
    return <String, dynamic>{};
  }
});

// ── Screen ────────────────────────────────────────────────────────────────────

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth     = ref.watch(authProvider);
    final children = ref.watch(_dashChildrenProvider);
    final alerts   = ref.watch(_dashAlertsProvider);
    final activity = ref.watch(_dashActivityProvider);
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: RefreshIndicator(
        displacement: 120,
        color:        Theme.of(context).colorScheme.primary,
        onRefresh: () async {
          ref.invalidate(_dashChildrenProvider);
          ref.invalidate(_dashAlertsProvider);
          ref.invalidate(_dashActivityProvider);
        },
        child: CustomScrollView(slivers: [

          // ── Guardian hero app bar ─────────────────────────────────────────
          SliverPersistentHeader(
            pinned: true,
            delegate: _HeroDelegate(
              greeting:         _greeting(),
              userName:         auth.role ?? 'Parent',
              onAlertsPressed:  () => context.push('/parent/alerts'),
            ),
          ),

          // ── 24px safe-zone top padding ────────────────────────────────────
          const SliverToBoxAdapter(child: SizedBox(height: 8)),

          // ── KPI stat row ──────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: children.when(
              loading: () => const _KpiSkeleton(),
              error:   (_, __) => const SizedBox.shrink(),
              data:    (list) => _KpiRow(
                children:    list.length,
                online:      list.where((c) => c.isActive).length,
                alertsAsync: alerts,
              ),
            ),
          ),

          // ── Activity chart ─────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: activity.when(
              loading: () => const _ChartSkeleton(),
              error:   (_, __) => const SizedBox.shrink(),
              data:    (data) => _ActivityChart(data: data),
            ),
          ),

          // ── Children section ───────────────────────────────────────────────
          const SliverToBoxAdapter(
            child: SectionHeader('Your Children'),
          ),
          children.when(
            loading: () => const SliverToBoxAdapter(
              child: Center(child: Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator(),
              ))),
            error: (e, _) => SliverToBoxAdapter(
              child: ErrorView(
                message: 'Failed to load profiles',
                onRetry: () => ref.invalidate(_dashChildrenProvider),
              ),
            ),
            data: (list) {
              if (list.isEmpty) {
                return SliverToBoxAdapter(
                  child: EmptyView(
                    icon:    Icons.child_friendly_rounded,
                    message: 'No child profiles yet.\nTap + to add your first child.',
                    action:  GuardianButton(
                      label:     'Add Child',
                      icon:      Icons.person_add_alt_1_rounded,
                      onPressed: () => context.push('/parent/family/new'),
                    ),
                  ),
                );
              }
              return SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => _ChildTile(child: list[i]),
                  childCount: list.length,
                ),
              );
            },
          ),

          // ── Recent alerts section ──────────────────────────────────────────
          const SliverToBoxAdapter(child: SectionHeader('Recent Alerts')),
          alerts.when(
            loading: () => const SliverToBoxAdapter(
                child: Center(child: Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(),
                ))),
            error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
            data: (list) {
              if (list.isEmpty) {
                return const SliverToBoxAdapter(
                  child: EmptyView(
                    icon:    Icons.notifications_none_rounded,
                    message: 'No recent alerts. All quiet.'),
                );
              }
              // Alert tiles: each in its own surfaceContainerLow rounded tile
              // No dividers — 8px spacing between items is all we need
              return SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => Padding(
                      padding: EdgeInsets.only(
                          bottom: i < list.length - 1 ? 8 : 0),
                      child: _AlertTile(alert: list[i]),
                    ),
                    childCount: list.length,
                  ),
                ),
              );
            },
          ),

          // Bottom padding (accounts for glass nav bar height)
          SliverToBoxAdapter(child: SizedBox(height: 100 + bottomPad)),
        ]),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed:   () => context.push('/parent/family/new'),
        tooltip:     'Add child',
        child:       const Icon(Icons.person_add_alt_1_rounded),
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }
}

// ── Hero persistent header delegate ──────────────────────────────────────────

class _HeroDelegate extends SliverPersistentHeaderDelegate {
  _HeroDelegate({
    required this.greeting,
    required this.userName,
    required this.onAlertsPressed,
  });
  final String greeting;
  final String userName;
  final VoidCallback onAlertsPressed;

  @override
  double get minExtent => 72;
  @override
  double get maxExtent => 200;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final t = (shrinkOffset / maxExtent).clamp(0.0, 1.0);

    return GuardianHero(
      height:       maxExtent - shrinkOffset,
      bottomRadius: 0,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 16, 16),
          child: Stack(children: [
            // Asymmetric headline layout (left text, right action)
            Align(
              alignment: Alignment.bottomLeft,
              child: Opacity(
                opacity: (1 - t * 2).clamp(0.0, 1.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(greeting,
                        style: GoogleFonts.inter(
                            color: Colors.white.withOpacity(0.7),
                            fontSize: 13, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 2),
                    Text('Family Dashboard',
                        style: GoogleFonts.manrope(
                            color: Colors.white, fontSize: 28,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.8)),
                  ],
                ),
              ),
            ),

            // Collapsed title (shown when scrolled)
            Align(
              alignment: Alignment.centerLeft,
              child: Opacity(
                opacity: (t * 2 - 1).clamp(0.0, 1.0),
                child: Text('Dashboard',
                    style: GoogleFonts.manrope(
                        color: Colors.white, fontSize: 18,
                        fontWeight: FontWeight.w700)),
              ),
            ),

            // Actions — far right (intentional asymmetry)
            Positioned(
              right: 0, top: 0,
              child: _HeaderIconButton(
                icon:  Icons.notifications_outlined,
                onTap: onAlertsPressed,
              ),
            ),
          ]),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(_HeroDelegate old) =>
      old.greeting != greeting || old.userName != userName;
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => IconButton(
    icon:      Icon(icon, color: Colors.white, size: 22),
    onPressed: onTap,
    style:     IconButton.styleFrom(
      backgroundColor: Colors.white.withOpacity(0.12),
      shape: const CircleBorder(),
    ),
  );
}

// ── KPI row: 3 tonal stat cards ───────────────────────────────────────────────

class _KpiRow extends StatelessWidget {
  const _KpiRow({
    required this.children,
    required this.online,
    required this.alertsAsync,
  });
  final int      children;
  final int      online;
  final AsyncValue<List<AlertModel>> alertsAsync;

  @override
  Widget build(BuildContext context) {
    final unreadAlerts = alertsAsync.valueOrNull
        ?.where((a) => !a.isRead).length ?? 0;
    final hasCritical = alertsAsync.valueOrNull?.any((a) => a.isCritical) ?? false;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      child: Row(children: [
        Expanded(child: StatCard(
          label: 'Children',
          value: '$children',
          icon:  Icons.group_rounded,
          color: Ds.primary,
        )),
        const SizedBox(width: 12),
        Expanded(child: StatCard(
          label: 'Online',
          value: '$online',
          icon:  Icons.devices_rounded,
          color: Ds.success,
        )),
        const SizedBox(width: 12),
        Expanded(child: StatCard(
          label: 'Alerts',
          value: '$unreadAlerts',
          icon:  Icons.notifications_rounded,
          color: hasCritical ? Ds.danger : Ds.warning,
        )),
      ]),
    );
  }
}

class _KpiSkeleton extends StatelessWidget {
  const _KpiSkeleton();
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
    child: Row(children: List.generate(3, (_) => Expanded(child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Container(
        height: 88,
        decoration: BoxDecoration(
          color:        Theme.of(context).colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(14),
        ),
      ),
    )))),
  );
}

// ── Activity chart: tonal card, no border ─────────────────────────────────────

class _ActivityChart extends StatelessWidget {
  const _ActivityChart({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final cs    = Theme.of(context).colorScheme;
    final blocked = (data['blockedRequests'] as num?)?.toDouble() ?? 0;

    final dailyList = (data['daily'] as List?)
        ?.whereType<Map<String, dynamic>>().toList() ?? [];
    final spots = dailyList.length >= 2
        ? List<FlSpot>.generate(dailyList.length, (i) {
            final val = ((dailyList[i]['totalBlocks']
                ?? dailyList[i]['blockedQueries']
                ?? dailyList[i]['blocked']
                ?? 0) as num).toDouble();
            return FlSpot(i.toDouble(), val);
          })
        : List<FlSpot>.generate(7, (i) => FlSpot(i.toDouble(),
            i == 6 ? blocked : (blocked * (0.5 + i * 0.07)).clamp(0, double.infinity)));

    return GuardianCard(
      padding: const EdgeInsets.all(20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Editorial header: big number left + label — asymmetric
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  '${blocked.toInt()}',
                  style: GoogleFonts.manrope(
                    fontSize: 36, fontWeight: FontWeight.w800,
                    letterSpacing: -1.2,
                    color: Ds.danger,
                  ),
                ),
                Text('THREATS BLOCKED',
                    style: GoogleFonts.inter(
                      fontSize: 10, fontWeight: FontWeight.w700,
                      letterSpacing: 0.8, color: cs.onSurfaceVariant)),
              ]),
            ),
            // Small secondary info chip — right side asymmetry
            StatusChip('7 days', color: cs.onSurfaceVariant),
          ],
        ),

        const SizedBox(height: 24),

        SizedBox(
          height: 110,
          child: LineChart(
            LineChartData(
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                getDrawingHorizontalLine: (_) => FlLine(
                  color: cs.outlineVariant.withOpacity(0.3),
                  strokeWidth: 0.5,
                ),
              ),
              titlesData: FlTitlesData(
                leftTitles:   const AxisTitles(
                    sideTitles: SideTitles(showTitles: false)),
                rightTitles:  const AxisTitles(
                    sideTitles: SideTitles(showTitles: false)),
                topTitles:    const AxisTitles(
                    sideTitles: SideTitles(showTitles: false)),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true, reservedSize: 22,
                    getTitlesWidget: (v, _) {
                      final days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                      final i = v.toInt();
                      if (i < 0 || i >= days.length) {
                        return const SizedBox.shrink();
                      }
                      return Text(days[i],
                          style: GoogleFonts.inter(
                            fontSize: 10, fontWeight: FontWeight.w600,
                            color: cs.onSurfaceVariant));
                    },
                  ),
                ),
              ),
              borderData: FlBorderData(show: false),
              lineBarsData: [
                LineChartBarData(
                  spots:    spots,
                  isCurved: true,
                  color:    Ds.danger,
                  barWidth: 2,
                  dotData:  const FlDotData(show: false),
                  belowBarData: BarAreaData(
                    show:  true,
                    color: Ds.danger.withOpacity(0.07),
                  ),
                ),
              ],
            ),
          ),
        ),
      ]),
    );
  }
}

class _ChartSkeleton extends StatelessWidget {
  const _ChartSkeleton();
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
    child: Container(
      height: 180,
      decoration: BoxDecoration(
        color:        Theme.of(context).colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
      ),
    ),
  );
}

// ── Child tile: surface tier, no divider ──────────────────────────────────────
//
// Each child gets its own surfaceContainerLow rounded tile.
// 16px vertical spacing between tiles (not dividers).

class _ChildTile extends StatelessWidget {
  const _ChildTile({required this.child});
  final ChildProfile child;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color:        cs.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(16),
          boxShadow:    Ds.guardianShadow(opacity: 0.04),
        ),
        child: Material(
          color:        Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap:        () => context.push('/parent/family/${child.id}'),
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                // Avatar: tonal circle, no border
                Container(
                  width:  50,
                  height: 50,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: cs.primary.withOpacity(0.10),
                  ),
                  child: child.avatarUrl != null
                      ? ClipOval(child: Image.network(child.avatarUrl!, fit: BoxFit.cover))
                      : Center(
                          child: Text(child.initials,
                              style: GoogleFonts.manrope(
                                  color: cs.primary,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 18)),
                        ),
                ),
                const SizedBox(width: 14),

                // Info — left-aligned
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(child.name,
                      style: GoogleFonts.manrope(
                          fontWeight: FontWeight.w700, fontSize: 15,
                          color: cs.onSurface)),
                  const SizedBox(height: 4),
                  Wrap(spacing: 6, runSpacing: 4, children: [
                    if (child.age != null)
                      StatusChip('Age ${child.age}'),
                    if (child.filterLevel != null)
                      StatusChip(child.filterLevel!,
                          color: const Color(0xFF6A1B9A)),
                  ]),
                ])),

                // Status pill (far right — intentional asymmetry)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    StatusChip(
                      child.isActive ? 'Online' : 'Offline',
                      color: child.isActive ? Ds.success : cs.onSurfaceVariant,
                    ),
                    const SizedBox(height: 4),
                    Icon(Icons.chevron_right_rounded,
                        color: cs.onSurfaceVariant.withOpacity(0.5), size: 18),
                  ],
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Alert tile: surface tier rounded tile, no divider ─────────────────────────

class _AlertTile extends StatelessWidget {
  const _AlertTile({required this.alert});
  final AlertModel alert;

  Color get _iconColor {
    if (alert.isCritical)          return Ds.danger;
    if (alert.type == 'BATTERY')   return Ds.warning;
    if (alert.type == 'GEOFENCE')  return Ds.primary;
    if (alert.type == 'SCHEDULE')  return const Color(0xFF6A1B9A);
    return Ds.info;
  }

  IconData get _icon {
    if (alert.isCritical)          return Icons.sos_rounded;
    if (alert.type == 'BATTERY')   return Icons.battery_alert_rounded;
    if (alert.type == 'GEOFENCE')  return Icons.location_on_rounded;
    if (alert.type == 'SCHEDULE')  return Icons.schedule_rounded;
    return Icons.notifications_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap:    () => context.go('/parent/alerts'),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color:        cs.surfaceContainerLow,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(children: [
            // Tonal icon container
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color:        _iconColor.withOpacity(0.10),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(_icon, color: _iconColor, size: 18),
            ),
            const SizedBox(width: 12),

            // Text
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(alert.title,
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                      fontWeight: FontWeight.w600, fontSize: 13,
                      color: cs.onSurface)),
              const SizedBox(height: 2),
              Text(alert.message,
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                      fontSize: 11, color: cs.onSurfaceVariant)),
            ])),

            // Time — far right
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Text(
                _formatTime(alert.createdAt),
                style: GoogleFonts.inter(
                    fontSize: 10, fontWeight: FontWeight.w500,
                    color: cs.onSurfaceVariant),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    if (now.difference(dt).inHours < 24) return DateFormat('HH:mm').format(dt);
    if (now.difference(dt).inDays  <  7) return DateFormat('EEE').format(dt);
    return DateFormat('d MMM').format(dt);
  }
}
