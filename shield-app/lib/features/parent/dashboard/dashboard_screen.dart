import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
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
    // Fetch children first to get the first profile's ID
    final childrenResp = await ApiClient.instance.get(Endpoints.children);
    final rawChildren = childrenResp.data is List
        ? childrenResp.data as List
        : (childrenResp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
    if (rawChildren.isEmpty) return <String, dynamic>{};

    final firstId = (rawChildren.first as Map<String, dynamic>)['id']?.toString();
    if (firstId == null) return <String, dynamic>{};

    // Fetch 7-day daily stats for this profile
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

    final greeting = _greeting();

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_dashChildrenProvider);
          ref.invalidate(_dashAlertsProvider);
          ref.invalidate(_dashActivityProvider);
        },
        child: CustomScrollView(slivers: [
          // ── Gradient hero header ────────────────────────────────────────────
          _HeroHeader(greeting: greeting, auth: auth),

          // ── KPI stat row ────────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: children.when(
              loading: () => const _KpiSkeleton(),
              error:   (_, __) => const SizedBox.shrink(),
              data:    (list) => _KpiRow(
                children:      list.length,
                online:        list.where((c) => c.isActive).length,
                alertsAsync:   alerts,
              ),
            ),
          ),

          // ── Activity chart ──────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: activity.when(
              loading: () => const _ChartSkeleton(),
              error:   (_, __) => const SizedBox.shrink(),
              data:    (data) => _ActivityChart(data: data),
            ),
          ),

          // ── Children list ───────────────────────────────────────────────────
          const SliverToBoxAdapter(child: SectionHeader('Your Children')),
          children.when(
            loading: () => const SliverToBoxAdapter(
              child: Center(child: CircularProgressIndicator())),
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
                    icon:    Icons.child_friendly,
                    message: 'No child profiles yet.\nTap + to add your first child.',
                    action: ElevatedButton.icon(
                      onPressed: () => context.push('/parent/family/new'),
                      icon: const Icon(Icons.add), label: const Text('Add Child'),
                    ),
                  ),
                );
              }
              return SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => _ChildCard(child: list[i]),
                  childCount: list.length,
                ),
              );
            },
          ),

          // ── Recent alerts ────────────────────────────────────────────────────
          const SliverToBoxAdapter(child: SectionHeader('Recent Alerts')),
          alerts.when(
            loading: () => const SliverToBoxAdapter(
                child: Center(child: CircularProgressIndicator())),
            error:   (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
            data: (list) {
              if (list.isEmpty) {
                return const SliverToBoxAdapter(
                  child: EmptyView(
                      icon: Icons.notifications_none,
                      message: 'No recent alerts'),
                );
              }
              return SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => _AlertTile(alert: list[i]),
                  childCount: list.length,
                ),
              );
            },
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ]),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/parent/family/new'),
        child: const Icon(Icons.person_add),
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

// ── Hero header ───────────────────────────────────────────────────────────────

class _HeroHeader extends StatelessWidget {
  const _HeroHeader({required this.greeting, required this.auth});
  final String    greeting;
  final dynamic   auth;

  @override
  Widget build(BuildContext context) => SliverAppBar(
    expandedHeight: 160,
    pinned: true,
    backgroundColor: ShieldTheme.primary,
    flexibleSpace: FlexibleSpaceBar(
      background: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF1E40AF), Color(0xFF1E40AF), Color(0xFF2563EB)],
            begin: Alignment.topLeft, end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(Icons.shield, color: Colors.white, size: 22),
                const SizedBox(width: 6),
                const Text('Shield',
                    style: TextStyle(color: Colors.white,
                        fontSize: 16, fontWeight: FontWeight.w600)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.notifications_outlined,
                      color: Colors.white),
                  onPressed: () => context.push('/parent/alerts'),
                ),
              ]),
              const SizedBox(height: 12),
              Text(greeting,
                  style: TextStyle(
                      color: Colors.white.withOpacity(0.75), fontSize: 14)),
              const SizedBox(height: 4),
              const Text('Family Dashboard',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 24, fontWeight: FontWeight.w700,
                      letterSpacing: -0.5)),
            ]),
          ),
        ),
      ),
    ),
  );
}

// ── KPI row ───────────────────────────────────────────────────────────────────

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
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
    child: Row(children: [
      Expanded(child: _KpiCard(
        label: 'Children',
        value: '$children',
        icon:  Icons.people,
        color: ShieldTheme.primary,
      )),
      const SizedBox(width: 8),
      Expanded(child: _KpiCard(
        label: 'Online',
        value: '$online',
        icon:  Icons.devices,
        color: ShieldTheme.success,
      )),
      const SizedBox(width: 8),
      Expanded(child: alertsAsync.when(
        loading: () => const _KpiCard(label: 'Alerts', value: '—',
            icon: Icons.notifications, color: ShieldTheme.warning),
        error:   (_, __) => const _KpiCard(label: 'Alerts', value: '—',
            icon: Icons.notifications, color: ShieldTheme.warning),
        data: (list) => _KpiCard(
          label: 'Alerts',
          value: '${list.where((a) => !a.isRead).length}',
          icon:  Icons.notifications,
          color: list.any((a) => a.isCritical)
              ? ShieldTheme.danger : ShieldTheme.warning,
        ),
      )),
    ]),
  );
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
  final String   label;
  final String   value;
  final IconData icon;
  final Color    color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color:        isDark ? ShieldTheme.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: isDark
            ? Border.all(color: Colors.white12)
            : null,
        boxShadow:    isDark ? null : [
          BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 8, offset: const Offset(0, 2))
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color:        color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 16),
          ),
        ]),
        const SizedBox(height: 10),
        Text(value,
            style: TextStyle(
                fontSize: 24, fontWeight: FontWeight.w700, color: color)),
        const SizedBox(height: 2),
        Text(label,
            style: TextStyle(
                fontSize: 11,
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5))),
      ]),
    );
  }
}

class _KpiSkeleton extends StatelessWidget {
  const _KpiSkeleton();
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
    child: Row(children: List.generate(3, (_) => Expanded(child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Container(
        height: 90,
        decoration: BoxDecoration(
          color: Colors.grey.withOpacity(0.15),
          borderRadius: BorderRadius.circular(14),
        ),
      ),
    )))),
  );
}

// ── Activity chart ─────────────────────────────────────────────────────────────

class _ActivityChart extends StatelessWidget {
  const _ActivityChart({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final isDark    = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? ShieldTheme.cardDark : Colors.white;

    final blocked  = (data['blockedRequests'] as num?)?.toDouble() ?? 0;

    // Use real daily breakdown when available, otherwise fallback to single bar
    final dailyList = (data['daily'] as List?)
        ?.whereType<Map<String, dynamic>>()
        .toList() ?? [];
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

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color:        cardColor,
        borderRadius: BorderRadius.circular(16),
        border: isDark ? Border.all(color: Colors.white12) : null,
        boxShadow:    isDark ? null : [
          BoxShadow(color: Colors.black.withOpacity(0.06),
              blurRadius: 8, offset: const Offset(0, 2))
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Blocked Requests',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text('Last 7 days',
                  style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5))),
            ]),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color:        ShieldTheme.danger.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '${blocked.toInt()} blocked',
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600,
                  color: ShieldTheme.danger),
            ),
          ),
        ]),
        const SizedBox(height: 24),
        SizedBox(
          height: 120,
          child: LineChart(
            LineChartData(
              gridData:    FlGridData(
                show: true,
                drawVerticalLine: false,
                getDrawingHorizontalLine: (_) => FlLine(
                  color: isDark ? Colors.white10 : Colors.black12,
                  strokeWidth: 1,
                ),
              ),
              titlesData:  FlTitlesData(
                leftTitles:   const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles:  const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                topTitles:    const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    getTitlesWidget: (v, _) {
                      final days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
                      final i = v.toInt();
                      if (i < 0 || i >= days.length) return const SizedBox.shrink();
                      return Text(days[i],
                          style: TextStyle(
                              fontSize: 10,
                              color: Theme.of(context)
                                  .colorScheme.onSurface.withOpacity(0.45)));
                    },
                  ),
                ),
              ),
              borderData:  FlBorderData(show: false),
              lineBarsData: [
                LineChartBarData(
                  spots:          spots,
                  isCurved:       true,
                  color:          ShieldTheme.danger,
                  barWidth:       2.5,
                  dotData:        const FlDotData(show: false),
                  belowBarData:   BarAreaData(
                    show:  true,
                    color: ShieldTheme.danger.withOpacity(0.08),
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
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
    height: 180,
    decoration: BoxDecoration(
      color: Colors.grey.withOpacity(0.12),
      borderRadius: BorderRadius.circular(16),
    ),
  );
}

// ── Child card ─────────────────────────────────────────────────────────────────

class _ChildCard extends StatelessWidget {
  const _ChildCard({required this.child});
  final ChildProfile child;

  @override
  Widget build(BuildContext context) {
    final theme  = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Card(
      child: InkWell(
        onTap: () => context.push('/parent/family/${child.id}'),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            // Avatar
            CircleAvatar(
              radius: 26,
              backgroundColor: ShieldTheme.primary.withOpacity(0.12),
              backgroundImage: child.avatarUrl != null
                  ? NetworkImage(child.avatarUrl!) : null,
              child: child.avatarUrl == null
                  ? Text(child.initials,
                      style: const TextStyle(
                          color: ShieldTheme.primary,
                          fontWeight: FontWeight.bold, fontSize: 18))
                  : null,
            ),
            const SizedBox(width: 14),

            // Info
            Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(child.name,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 4),
              Wrap(spacing: 6, children: [
                if (child.age != null)
                  _chip('Age ${child.age}', ShieldTheme.primary),
                if (child.filterLevel != null)
                  _chip(child.filterLevel!, Colors.purple),
              ]),
            ])),

            // Status
            Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
              _statusPill(child.isActive),
              const SizedBox(height: 4),
              const Icon(Icons.chevron_right, color: Colors.black45, size: 18),
            ]),
          ]),
        ),
      ),
    );
  }

  Widget _chip(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(
      color: color.withOpacity(0.1),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(label,
        style: TextStyle(
            fontSize: 10, color: color, fontWeight: FontWeight.w600)),
  );

  Widget _statusPill(bool online) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: online ? Colors.green.shade50 : Colors.grey.shade100,
      borderRadius: BorderRadius.circular(8),
    ),
    child: Text(
      online ? 'Online' : 'Offline',
      style: TextStyle(
        fontSize: 10, fontWeight: FontWeight.w600,
        color: online ? Colors.green.shade700 : Colors.grey,
      ),
    ),
  );
}

// ── Alert tile ────────────────────────────────────────────────────────────────

class _AlertTile extends StatelessWidget {
  const _AlertTile({required this.alert});
  final AlertModel alert;

  Color get _iconColor {
    if (alert.isCritical)          return Colors.red;
    if (alert.type == 'BATTERY')   return const Color(0xFFC2410C);
    if (alert.type == 'GEOFENCE')  return const Color(0xFF2563EB);
    return Colors.grey;
  }

  IconData get _icon {
    if (alert.isCritical)          return Icons.sos;
    if (alert.type == 'BATTERY')   return Icons.battery_alert;
    if (alert.type == 'GEOFENCE')  return Icons.location_on;
    if (alert.type == 'SCHEDULE')  return Icons.schedule;
    return Icons.notifications;
  }

  @override
  Widget build(BuildContext context) => ListTile(
    leading: CircleAvatar(
      backgroundColor: _iconColor.withOpacity(0.1),
      child: Icon(_icon, color: _iconColor, size: 20),
    ),
    title:    Text(alert.title,
        style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
    subtitle: Text(alert.message,
        maxLines: 1, overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontSize: 12)),
    trailing: Text(
      _formatTime(alert.createdAt),
      style: const TextStyle(fontSize: 11, color: Colors.black54),
    ),
    onTap: () => context.go('/parent/alerts'),
  );

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    if (now.difference(dt).inHours < 24) return DateFormat('HH:mm').format(dt);
    if (now.difference(dt).inDays  <  7) return DateFormat('EEE').format(dt);
    return DateFormat('d MMM').format(dt);
  }
}
