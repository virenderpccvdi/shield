import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/common_widgets.dart';

// ── Providers ─────────────────────────────────────────────────────────────────

final _adminOverviewProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final auth = ref.read(authProvider);
  final path = auth.isGlobalAdmin
      ? Endpoints.platformOverview
      : Endpoints.ispOverview;
  try {
    final resp = await ApiClient.instance.get(path);
    return resp.data is Map<String, dynamic>
        ? resp.data as Map<String, dynamic>
        : <String, dynamic>{};
  } catch (_) {
    return <String, dynamic>{};
  }
});

final _adminDailyProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final auth = ref.read(authProvider);
  final path = auth.isGlobalAdmin
      ? Endpoints.platformDaily
      : Endpoints.ispDaily;
  try {
    final resp = await ApiClient.instance.get(path);
    final raw  = resp.data is List
        ? resp.data as List
        : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
    return raw.whereType<Map<String, dynamic>>().toList();
  } catch (_) {
    return [];
  }
});

final _recentAlertsAdminProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  try {
    final resp = await ApiClient.instance.get(Endpoints.alerts, params: {'limit': '8'});
    final raw = resp.data is List
        ? resp.data as List
        : (resp.data as Map<String, dynamic>?)?['content'] as List?
            ?? (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
    return raw.whereType<Map<String, dynamic>>().toList();
  } catch (_) {
    return [];
  }
});

// ── Screen ────────────────────────────────────────────────────────────────────

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth     = ref.watch(authProvider);
    final overview = ref.watch(_adminOverviewProvider);
    final daily    = ref.watch(_adminDailyProvider);
    final alerts   = ref.watch(_recentAlertsAdminProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_adminOverviewProvider);
          ref.invalidate(_adminDailyProvider);
          ref.invalidate(_recentAlertsAdminProvider);
        },
        child: CustomScrollView(slivers: [
          // ── Header ─────────────────────────────────────────────────────────
          SliverAppBar(
            expandedHeight: 150,
            pinned: true,
            backgroundColor: auth.isGlobalAdmin
                ? const Color(0xFF1E40AF)
                : const Color(0xFF1E40AF),
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: auth.isGlobalAdmin
                        ? [const Color(0xFF0D0E3F), const Color(0xFF1E40AF)]
                        : [const Color(0xFF1E40AF), const Color(0xFF2563EB)],
                    begin: Alignment.topLeft,
                    end:   Alignment.bottomRight,
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Icon(
                            auth.isGlobalAdmin
                                ? Icons.admin_panel_settings
                                : Icons.business,
                            color: Colors.white70, size: 18,
                          ),
                          const SizedBox(width: 6),
                          Text(auth.displayRole,
                              style: const TextStyle(
                                  color: Colors.white70, fontSize: 13)),
                          const Spacer(),
                          IconButton(
                            icon: const Icon(Icons.notifications_outlined,
                                color: Colors.white),
                            onPressed: () => context.push('/admin/notifications'),
                          ),
                        ]),
                        const SizedBox(height: 8),
                        Text(
                          auth.isGlobalAdmin
                              ? 'Platform Overview'
                              : 'ISP Dashboard',
                          style: const TextStyle(
                              color: Colors.white, fontSize: 22,
                              fontWeight: FontWeight.w700, letterSpacing: -0.5),
                        ),
                        Text(
                          DateFormat('EEEE, d MMMM y').format(DateTime.now()),
                          style: TextStyle(
                              color: Colors.white.withOpacity(0.55),
                              fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

          // ── KPI Cards ──────────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: overview.when(
              loading: () => const _KpiSkeleton(),
              error:   (_, __) => const SizedBox.shrink(),
              data:    (d) => _KpiSection(data: d, auth: auth),
            ),
          ),

          // ── Daily chart ────────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: daily.when(
              loading: () => const _ChartSkeleton(),
              error:   (_, __) => const SizedBox.shrink(),
              data:    (rows) => _DailyChart(rows: rows),
            ),
          ),

          // ── Quick actions ──────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: _QuickActions(isGlobal: auth.isGlobalAdmin),
          ),

          // ── Recent alerts ──────────────────────────────────────────────────
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
                  (_, i) => _AdminAlertTile(alert: list[i]),
                  childCount: list.length,
                ),
              );
            },
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ]),
      ),
    );
  }
}

// ── KPI section ───────────────────────────────────────────────────────────────

class _KpiSection extends StatelessWidget {
  const _KpiSection({required this.data, required this.auth});
  final Map<String, dynamic> data;
  final dynamic auth;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final kpis = auth.isGlobalAdmin
        ? [
            _Kpi('Tenants',          '${data['totalTenants'] ?? 0}',
                Icons.business,       ShieldTheme.primary),
            _Kpi('Total Users',      _fmt(data['totalUsers']),
                Icons.people,         ShieldTheme.secondary),
            _Kpi('Active Devices',   _fmt(data['activeDevices']),
                Icons.devices,        ShieldTheme.success),
            _Kpi('Blocked Today',    _fmt(data['blockedToday']),
                Icons.block,          ShieldTheme.danger),
          ]
        : [
            _Kpi('Customers',        '${data['totalCustomers'] ?? 0}',
                Icons.people,         ShieldTheme.primary),
            _Kpi('Active Devices',   _fmt(data['activeDevices']),
                Icons.devices,        ShieldTheme.secondary),
            _Kpi('Blocked Today',    _fmt(data['blockedToday']),
                Icons.block,          ShieldTheme.danger),
            _Kpi('Alerts',           _fmt(data['openAlerts']),
                Icons.notifications,  ShieldTheme.warning),
          ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: GridView.count(
        crossAxisCount:  2,
        shrinkWrap:      true,
        physics:         const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.8,
        children: kpis.map((k) => _KpiCard(kpi: k, isDark: isDark)).toList(),
      ),
    );
  }

  String _fmt(dynamic v) {
    if (v == null) return '0';
    final n = (v as num).toDouble();
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000)    return '${(n / 1000).toStringAsFixed(1)}K';
    return v.toString();
  }
}

class _Kpi {
  const _Kpi(this.label, this.value, this.icon, this.color);
  final String   label, value;
  final IconData icon;
  final Color    color;
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({required this.kpi, required this.isDark});
  final _Kpi kpi;
  final bool isDark;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color:        isDark ? ShieldTheme.cardDark : Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: isDark ? Border.all(color: Colors.white12) : null,
      boxShadow: isDark ? null : [
        BoxShadow(color: Colors.black.withOpacity(0.05),
            blurRadius: 6, offset: const Offset(0, 2)),
      ],
    ),
    child: Row(children: [
      Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color:        kpi.color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(kpi.icon, color: kpi.color, size: 20),
      ),
      const SizedBox(width: 12),
      Expanded(child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment:  MainAxisAlignment.center,
        children: [
          Text(kpi.value,
              style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w700, color: kpi.color)),
          Text(kpi.label,
              style: TextStyle(
                  fontSize: 11,
                  color: Theme.of(context)
                      .colorScheme.onSurface.withOpacity(0.5))),
        ],
      )),
    ]),
  );
}

class _KpiSkeleton extends StatelessWidget {
  const _KpiSkeleton();
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
    child: GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.8,
      children: List.generate(4, (_) => Container(
        decoration: BoxDecoration(
          color: Colors.grey.withOpacity(0.12),
          borderRadius: BorderRadius.circular(14),
        ),
      )),
    ),
  );
}

// ── Daily chart ───────────────────────────────────────────────────────────────

class _DailyChart extends StatelessWidget {
  const _DailyChart({required this.rows});
  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final displayRows = rows.isNotEmpty ? rows.take(7).toList() : _sample();

    final blocked = displayRows.asMap().entries.map((e) =>
        FlSpot(e.key.toDouble(),
            (e.value['blockedRequests'] as num? ?? 0).toDouble())).toList();
    final allowed = displayRows.asMap().entries.map((e) =>
        FlSpot(e.key.toDouble(),
            (e.value['allowedRequests'] as num? ?? 0).toDouble())).toList();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color:        isDark ? ShieldTheme.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: isDark ? Border.all(color: Colors.white12) : null,
        boxShadow: isDark ? null : [
          BoxShadow(color: Colors.black.withOpacity(0.05),
              blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Expanded(
            child: Text('Request Trends (7 days)',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          ),
          _legend(ShieldTheme.danger,   'Blocked'),
          const SizedBox(width: 12),
          _legend(ShieldTheme.success,  'Allowed'),
        ]),
        const SizedBox(height: 20),
        SizedBox(
          height: 140,
          child: LineChart(LineChartData(
            gridData: FlGridData(
              show: true, drawVerticalLine: false,
              getDrawingHorizontalLine: (_) => FlLine(
                  color: isDark ? Colors.white10 : Colors.black12,
                  strokeWidth: 1),
            ),
            titlesData: FlTitlesData(
              leftTitles:   const AxisTitles(
                  sideTitles: SideTitles(showTitles: false)),
              rightTitles:  const AxisTitles(
                  sideTitles: SideTitles(showTitles: false)),
              topTitles:    const AxisTitles(
                  sideTitles: SideTitles(showTitles: false)),
              bottomTitles: AxisTitles(sideTitles: SideTitles(
                showTitles: true,
                getTitlesWidget: (v, _) {
                  final days = ['Mo','Tu','We','Th','Fr','Sa','Su'];
                  final i = v.toInt();
                  if (i < 0 || i >= days.length) return const SizedBox.shrink();
                  return Text(days[i], style: TextStyle(
                      fontSize: 10,
                      color: Theme.of(context)
                          .colorScheme.onSurface.withOpacity(0.4)));
                },
              )),
            ),
            borderData: FlBorderData(show: false),
            lineBarsData: [
              _line(blocked, ShieldTheme.danger),
              _line(allowed, ShieldTheme.success),
            ],
          )),
        ),
      ]),
    );
  }

  LineChartBarData _line(List<FlSpot> spots, Color color) =>
      LineChartBarData(
        spots:       spots,
        isCurved:    true,
        color:       color,
        barWidth:    2.5,
        dotData:     const FlDotData(show: false),
        belowBarData: BarAreaData(show: true, color: color.withOpacity(0.07)),
      );

  Widget _legend(Color c, String label) => Row(children: [
    Container(width: 10, height: 10,
        decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
    const SizedBox(width: 4),
    Text(label, style: const TextStyle(fontSize: 11)),
  ]);

  List<Map<String, dynamic>> _sample() => List.generate(7, (i) => {
    'blockedRequests': 200 + i * 30,
    'allowedRequests': 800 + i * 50,
  });
}

class _ChartSkeleton extends StatelessWidget {
  const _ChartSkeleton();
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
    height: 190,
    decoration: BoxDecoration(
        color: Colors.grey.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16)),
  );
}

// ── Quick actions ─────────────────────────────────────────────────────────────

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.isGlobal});
  final bool isGlobal;

  @override
  Widget build(BuildContext context) {
    final actions = isGlobal
        ? [
            _Action(Icons.business,        'Tenants',      '/admin/tenants',        ShieldTheme.primary),
            _Action(Icons.bar_chart,        'Analytics',    '/admin/analytics',      ShieldTheme.secondary),
            _Action(Icons.notifications,    'Alerts',       '/admin/notifications',  ShieldTheme.warning),
            _Action(Icons.settings,         'Settings',     '/admin/settings',       Colors.blueGrey),
          ]
        : [
            _Action(Icons.people,           'Customers',    '/admin/customers',      ShieldTheme.primary),
            _Action(Icons.bar_chart,        'Analytics',    '/admin/analytics',      ShieldTheme.secondary),
            _Action(Icons.notifications,    'Alerts',       '/admin/notifications',  ShieldTheme.warning),
            _Action(Icons.dns,              'DNS Rules',    '/admin/dns',            Colors.teal),
          ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SectionHeader('Quick Access'),
        GridView.count(
          crossAxisCount:  4,
          shrinkWrap:      true,
          physics:         const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          children: actions.map((a) => _ActionBtn(action: a)).toList(),
        ),
      ]),
    );
  }
}

class _Action {
  const _Action(this.icon, this.label, this.route, this.color);
  final IconData icon;
  final String   label, route;
  final Color    color;
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({required this.action});
  final _Action action;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: () => context.push(action.route),
    borderRadius: BorderRadius.circular(14),
    child: Container(
      decoration: BoxDecoration(
        color:        action.color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(14),
        border:       Border.all(color: action.color.withOpacity(0.2)),
      ),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(action.icon, color: action.color, size: 24),
        const SizedBox(height: 6),
        Text(action.label,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 10, color: action.color,
                fontWeight: FontWeight.w600)),
      ]),
    ),
  );
}

// ── Alert tile ────────────────────────────────────────────────────────────────

class _AdminAlertTile extends StatelessWidget {
  const _AdminAlertTile({required this.alert});
  final Map<String, dynamic> alert;

  @override
  Widget build(BuildContext context) {
    final type = alert['alertType']?.toString() ?? alert['type']?.toString() ?? '';
    final color = type == 'SOS' || type == 'CRITICAL' ? Colors.red
        : type == 'BATTERY' ? Colors.orange
        : Colors.blue;
    final icon = type == 'SOS' ? Icons.sos
        : type == 'BATTERY' ? Icons.battery_alert
        : Icons.notifications;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: color.withOpacity(0.12),
        child: Icon(icon, color: color, size: 20),
      ),
      title:    Text(alert['title']?.toString() ?? 'Alert',
          style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
      subtitle: Text(alert['message']?.toString() ?? '',
          maxLines: 1, overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 12)),
      trailing: Text(
        _time(alert['createdAt']?.toString()),
        style: const TextStyle(fontSize: 11, color: Colors.black38),
      ),
    );
  }

  String _time(String? s) {
    if (s == null) return '';
    final dt = DateTime.tryParse(s);
    if (dt == null) return '';
    return DateFormat('HH:mm').format(dt.toLocal());
  }
}
