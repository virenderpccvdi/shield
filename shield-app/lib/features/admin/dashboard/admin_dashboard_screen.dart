import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:google_fonts/google_fonts.dart';
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
      backgroundColor: Ds.surface,
      body: RefreshIndicator(
        color: Ds.primary,
        onRefresh: () async {
          ref.invalidate(_adminOverviewProvider);
          ref.invalidate(_adminDailyProvider);
          ref.invalidate(_recentAlertsAdminProvider);
        },
        child: CustomScrollView(slivers: [
          // ── Guardian hero app bar ─────────────────────────────────────────
          SliverPersistentHeader(
            pinned: true,
            delegate: _AdminHeroDelegate(
              title: auth.isGlobalAdmin ? 'Platform Overview' : 'ISP Dashboard',
              subtitle: DateFormat('EEEE, d MMMM y').format(DateTime.now()),
              role: auth.displayRole,
              isGlobal: auth.isGlobalAdmin,
              onAlerts: () => context.push('/admin/notifications'),
            ),
          ),

          // ── KPI grid ─────────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: overview.when(
              loading: () => const _KpiSkeleton(),
              error:   (_, __) => const SizedBox.shrink(),
              data:    (d) => _KpiSection(data: d, isGlobal: auth.isGlobalAdmin),
            ),
          ),

          // ── Daily chart ───────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: daily.when(
              loading: () => const _ChartSkeleton(),
              error:   (_, __) => const SizedBox.shrink(),
              data:    (rows) => _DailyChart(rows: rows),
            ),
          ),

          // ── Quick actions ─────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: _QuickActions(isGlobal: auth.isGlobalAdmin),
          ),

          // ── Recent alerts ─────────────────────────────────────────────────
          const SliverToBoxAdapter(child: SectionHeader('Recent Alerts')),
          alerts.when(
            loading: () => const SliverToBoxAdapter(
                child: Center(child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator()))),
            error:   (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
            data: (list) {
              if (list.isEmpty) {
                return const SliverToBoxAdapter(
                  child: EmptyView(
                      icon:    Icons.notifications_none_rounded,
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
          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ]),
      ),
    );
  }
}

// ── Hero persistent header ────────────────────────────────────────────────────

class _AdminHeroDelegate extends SliverPersistentHeaderDelegate {
  _AdminHeroDelegate({
    required this.title,
    required this.subtitle,
    required this.role,
    required this.isGlobal,
    required this.onAlerts,
  });
  final String        title, subtitle, role;
  final bool          isGlobal;
  final VoidCallback  onAlerts;

  @override double get minExtent => 72;
  @override double get maxExtent => 180;

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
            // Expanded content
            Align(
              alignment: Alignment.bottomLeft,
              child: Opacity(
                opacity: (1 - t * 2).clamp(0.0, 1.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Icon(
                        isGlobal
                            ? Icons.admin_panel_settings_rounded
                            : Icons.business_rounded,
                        color: Colors.white.withOpacity(0.60), size: 14,
                      ),
                      const SizedBox(width: 6),
                      Text(role,
                          style: GoogleFonts.inter(
                              color: Colors.white.withOpacity(0.60),
                              fontSize: 12, fontWeight: FontWeight.w500)),
                    ]),
                    const SizedBox(height: 6),
                    Text(title,
                        style: GoogleFonts.manrope(
                            color: Colors.white, fontSize: 26,
                            fontWeight: FontWeight.w800, letterSpacing: -0.7)),
                    const SizedBox(height: 2),
                    Text(subtitle,
                        style: GoogleFonts.inter(
                            color: Colors.white.withOpacity(0.50),
                            fontSize: 12)),
                  ],
                ),
              ),
            ),
            // Collapsed title
            Align(
              alignment: Alignment.centerLeft,
              child: Opacity(
                opacity: (t * 2 - 1).clamp(0.0, 1.0),
                child: Text(title,
                    style: GoogleFonts.manrope(
                        color: Colors.white, fontSize: 18,
                        fontWeight: FontWeight.w700)),
              ),
            ),
            // Notifications button
            Positioned(
              right: 0, top: 0,
              child: IconButton(
                icon: const Icon(Icons.notifications_outlined,
                    color: Colors.white, size: 22),
                onPressed: onAlerts,
                style: IconButton.styleFrom(
                    backgroundColor: Colors.white.withOpacity(0.12),
                    shape: const CircleBorder()),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(_AdminHeroDelegate old) =>
      old.title != title || old.role != role;
}

// ── KPI section ───────────────────────────────────────────────────────────────

class _KpiSection extends StatelessWidget {
  const _KpiSection({required this.data, required this.isGlobal});
  final Map<String, dynamic> data;
  final bool                 isGlobal;

  @override
  Widget build(BuildContext context) {
    final kpis = isGlobal
        ? [
            _Kpi('Tenants',        '${data['totalTenants'] ?? 0}',
                Icons.business_rounded,      Ds.primary),
            _Kpi('Total Users',    _fmt(data['totalUsers']),
                Icons.people_rounded,         Ds.info),
            _Kpi('Active Devices', _fmt(data['activeDevices']),
                Icons.devices_rounded,        Ds.success),
            _Kpi('Blocked Today',  _fmt(data['blockedToday']),
                Icons.block_rounded,          Ds.danger),
          ]
        : [
            _Kpi('Customers',      '${data['totalCustomers'] ?? 0}',
                Icons.people_rounded,         Ds.primary),
            _Kpi('Active Devices', _fmt(data['activeDevices']),
                Icons.devices_rounded,        Ds.info),
            _Kpi('Blocked Today',  _fmt(data['blockedToday']),
                Icons.block_rounded,          Ds.danger),
            _Kpi('Alerts',         _fmt(data['openAlerts']),
                Icons.notifications_rounded,  Ds.warning),
          ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      child: GridView.count(
        crossAxisCount:   2,
        shrinkWrap:       true,
        physics:          const NeverScrollableScrollPhysics(),
        mainAxisSpacing:  10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.9,
        children: kpis.map((k) => _KpiCard(kpi: k)).toList(),
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
  const _KpiCard({required this.kpi});
  final _Kpi kpi;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color:        cs.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(Ds.radiusDefault),
        boxShadow:    Ds.guardianShadow(opacity: 0.05),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color:        kpi.color.withOpacity(0.10),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(kpi.icon, color: kpi.color, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment:  MainAxisAlignment.center,
            children: [
              Text(kpi.value,
                  style: GoogleFonts.manrope(
                      fontSize: 22, fontWeight: FontWeight.w800,
                      color: kpi.color, letterSpacing: -0.5)),
              Text(kpi.label,
                  style: GoogleFonts.inter(
                      fontSize: 11, color: cs.onSurfaceVariant)),
            ],
          )),
        ]),
      ),
    );
  }
}

class _KpiSkeleton extends StatelessWidget {
  const _KpiSkeleton();
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      child: GridView.count(
        crossAxisCount: 2, shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.9,
        children: List.generate(4, (_) => Container(
          decoration: BoxDecoration(
            color: cs.surfaceContainerLow,
            borderRadius: BorderRadius.circular(Ds.radiusDefault),
          ),
        )),
      ),
    );
  }
}

// ── Daily chart ───────────────────────────────────────────────────────────────

class _DailyChart extends StatelessWidget {
  const _DailyChart({required this.rows});
  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    final cs          = Theme.of(context).colorScheme;
    final displayRows = rows.isNotEmpty ? rows.take(7).toList() : _sample();

    final blocked = displayRows.asMap().entries.map((e) =>
        FlSpot(e.key.toDouble(),
            (e.value['blockedRequests'] as num? ?? 0).toDouble())).toList();
    final allowed = displayRows.asMap().entries.map((e) =>
        FlSpot(e.key.toDouble(),
            (e.value['allowedRequests'] as num? ?? 0).toDouble())).toList();

    return GuardianCard(
      padding: const EdgeInsets.all(20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text('Request Trends',
                style: GoogleFonts.manrope(
                    fontSize: 15, fontWeight: FontWeight.w700,
                    color: cs.onSurface)),
          ),
          _Legend(Ds.danger,  'Blocked'),
          const SizedBox(width: 14),
          _Legend(Ds.success, 'Allowed'),
          const SizedBox(width: 4),
          StatusChip('7 days', color: cs.onSurfaceVariant),
        ]),
        const SizedBox(height: 20),
        SizedBox(
          height: 140,
          child: LineChart(LineChartData(
            gridData: FlGridData(
              show: true, drawVerticalLine: false,
              getDrawingHorizontalLine: (_) => FlLine(
                  color: cs.outlineVariant.withOpacity(0.3), strokeWidth: 0.5),
            ),
            titlesData: FlTitlesData(
              leftTitles:   const AxisTitles(
                  sideTitles: SideTitles(showTitles: false)),
              rightTitles:  const AxisTitles(
                  sideTitles: SideTitles(showTitles: false)),
              topTitles:    const AxisTitles(
                  sideTitles: SideTitles(showTitles: false)),
              bottomTitles: AxisTitles(sideTitles: SideTitles(
                showTitles: true, reservedSize: 22,
                getTitlesWidget: (v, _) {
                  final days = ['Mo','Tu','We','Th','Fr','Sa','Su'];
                  final i = v.toInt();
                  if (i < 0 || i >= days.length) {
                    return const SizedBox.shrink();
                  }
                  return Text(days[i],
                      style: GoogleFonts.inter(
                          fontSize: 10, color: cs.onSurfaceVariant));
                },
              )),
            ),
            borderData: FlBorderData(show: false),
            lineBarsData: [
              _line(blocked, Ds.danger),
              _line(allowed, Ds.success),
            ],
          )),
        ),
      ]),
    );
  }

  LineChartBarData _line(List<FlSpot> spots, Color color) =>
      LineChartBarData(
        spots:        spots,
        isCurved:     true,
        color:        color,
        barWidth:     2.5,
        dotData:      const FlDotData(show: false),
        belowBarData: BarAreaData(show: true, color: color.withOpacity(0.07)),
      );

  List<Map<String, dynamic>> _sample() => List.generate(7, (i) => {
    'blockedRequests': 200 + i * 30,
    'allowedRequests': 800 + i * 50,
  });
}

class _Legend extends StatelessWidget {
  const _Legend(this.color, this.label);
  final Color  color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(width: 8, height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 4),
      Text(label,
          style: GoogleFonts.inter(
              fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant)),
    ],
  );
}

class _ChartSkeleton extends StatelessWidget {
  const _ChartSkeleton();
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
      child: Container(
        height: 190,
        decoration: BoxDecoration(
            color:        cs.surfaceContainerLow,
            borderRadius: BorderRadius.circular(Ds.radiusDefault)),
      ),
    );
  }
}

// ── Quick actions ─────────────────────────────────────────────────────────────

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.isGlobal});
  final bool isGlobal;

  @override
  Widget build(BuildContext context) {
    final actions = isGlobal
        ? [
            _Action(Icons.business_rounded,      'Tenants',    '/admin/tenants',       Ds.primary),
            _Action(Icons.bar_chart_rounded,      'Analytics',  '/admin/analytics',     Ds.info),
            _Action(Icons.notifications_rounded,  'Alerts',     '/admin/notifications', Ds.warning),
            _Action(Icons.settings_rounded,       'Settings',   '/admin/settings',      Ds.onSurfaceVariant),
          ]
        : [
            _Action(Icons.people_rounded,         'Customers',  '/admin/customers',     Ds.primary),
            _Action(Icons.bar_chart_rounded,      'Analytics',  '/admin/analytics',     Ds.info),
            _Action(Icons.notifications_rounded,  'Alerts',     '/admin/notifications', Ds.warning),
            _Action(Icons.dns_rounded,            'DNS Rules',  '/admin/dns',           const Color(0xFF00838F)),
          ];

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SectionHeader('Quick Access'),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: GridView.count(
          crossAxisCount:   4,
          shrinkWrap:       true,
          physics:          const NeverScrollableScrollPhysics(),
          mainAxisSpacing:  8,
          crossAxisSpacing: 8,
          children: actions.map((a) => _ActionBtn(action: a)).toList(),
        ),
      ),
    ]);
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
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color:        cs.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(Ds.radiusDefault),
        boxShadow:    Ds.guardianShadowSmall(),
      ),
      child: Material(
        color:        Colors.transparent,
        borderRadius: BorderRadius.circular(Ds.radiusDefault),
        child: InkWell(
          onTap:        () => context.push(action.route),
          borderRadius: BorderRadius.circular(Ds.radiusDefault),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color:        action.color.withOpacity(0.10),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(action.icon, color: action.color, size: 20),
            ),
            const SizedBox(height: 6),
            Text(action.label,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                    fontSize: 10, color: cs.onSurface,
                    fontWeight: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }
}

// ── Alert tile ────────────────────────────────────────────────────────────────

class _AdminAlertTile extends StatelessWidget {
  const _AdminAlertTile({required this.alert});
  final Map<String, dynamic> alert;

  @override
  Widget build(BuildContext context) {
    final cs    = Theme.of(context).colorScheme;
    final type  = alert['alertType']?.toString() ?? alert['type']?.toString() ?? '';
    final color = type == 'SOS' || type == 'CRITICAL'
        ? Ds.danger
        : type == 'BATTERY'
            ? Ds.warning
            : Ds.info;
    final icon = type == 'SOS'
        ? Icons.sos_rounded
        : type == 'BATTERY'
            ? Icons.battery_alert_rounded
            : Icons.notifications_rounded;

    return GuardianCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      margin:  const EdgeInsets.fromLTRB(24, 0, 24, 8),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color:        color.withOpacity(0.10),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(alert['title']?.toString() ?? 'Alert',
              style: GoogleFonts.inter(
                  fontWeight: FontWeight.w600, fontSize: 13, color: cs.onSurface)),
          const SizedBox(height: 2),
          Text(alert['message']?.toString() ?? '',
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(
                  fontSize: 12, color: cs.onSurfaceVariant)),
        ])),
        Text(
          _time(alert['createdAt']?.toString()),
          style: GoogleFonts.inter(
              fontSize: 10, color: cs.onSurfaceVariant,
              fontWeight: FontWeight.w500),
        ),
      ]),
    );
  }

  String _time(String? s) {
    if (s == null) return '';
    final dt = DateTime.tryParse(s);
    if (dt == null) return '';
    return DateFormat('HH:mm').format(dt.toLocal());
  }
}
