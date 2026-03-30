import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/common_widgets.dart';

// ── Providers ─────────────────────────────────────────────────────────────────

final _analyticsOverviewProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
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

final _analyticsDailyProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final auth = ref.read(authProvider);
  final path = auth.isGlobalAdmin
      ? Endpoints.platformDaily
      : Endpoints.ispDaily;
  try {
    final resp = await ApiClient.instance.get(path, params: {'days': '30'});
    final raw  = resp.data is List
        ? resp.data as List
        : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
    return raw.cast<Map<String, dynamic>>();
  } catch (_) {
    return [];
  }
});

// ── Screen ────────────────────────────────────────────────────────────────────

class AdminAnalyticsScreen extends ConsumerStatefulWidget {
  const AdminAnalyticsScreen({super.key});
  @override
  ConsumerState<AdminAnalyticsScreen> createState() =>
      _AdminAnalyticsScreenState();
}

class _AdminAnalyticsScreenState extends ConsumerState<AdminAnalyticsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final overview = ref.watch(_analyticsOverviewProvider);
    final daily    = ref.watch(_analyticsDailyProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Analytics'),
        bottom: TabBar(
          controller: _tabs,
          labelColor:       Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor:   Colors.white,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Trends'),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_analyticsOverviewProvider);
          ref.invalidate(_analyticsDailyProvider);
        },
        child: TabBarView(
          controller: _tabs,
          children: [
            // ── Overview tab ──────────────────────────────────────────────
            _OverviewTab(overviewAsync: overview),

            // ── Trends tab ────────────────────────────────────────────────
            _TrendsTab(dailyAsync: daily),
          ],
        ),
      ),
    );
  }
}

// ── Overview tab ──────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.overviewAsync});
  final AsyncValue<Map<String, dynamic>> overviewAsync;

  @override
  Widget build(BuildContext context) => overviewAsync.when(
    loading: () => const Center(child: CircularProgressIndicator()),
    error:   (e, _) => ErrorView(message: 'Failed to load analytics'),
    data: (d) => ListView(padding: const EdgeInsets.all(16), children: [
      _StatGrid(stats: [
        _Stat('Total Requests',     _fmt(d['totalRequests']),
            Icons.wifi,             ShieldTheme.primary),
        _Stat('Blocked',            _fmt(d['blockedRequests']),
            Icons.block,            ShieldTheme.danger),
        _Stat('Active Devices',     _fmt(d['activeDevices']),
            Icons.devices,          ShieldTheme.secondary),
        _Stat('Customers',          _fmt(d['totalCustomers']),
            Icons.people,           ShieldTheme.success),
        _Stat('Children Protected', _fmt(d['totalChildren']),
            Icons.child_care,       ShieldTheme.accent),
        _Stat('Alerts Today',       _fmt(d['alertsToday']),
            Icons.notifications,    ShieldTheme.warning),
      ]),

      const SizedBox(height: 20),
      if (d['topBlockedCategories'] != null)
        _CategoryPieChart(categories: d['topBlockedCategories'] as List),
    ]),
  );

  String _fmt(dynamic v) {
    if (v == null) return '0';
    final n = (v as num).toDouble();
    if (n >= 1000000) return '${(n/1000000).toStringAsFixed(1)}M';
    if (n >= 1000)    return '${(n/1000).toStringAsFixed(1)}K';
    return v.toString();
  }
}

// ── Trends tab ────────────────────────────────────────────────────────────────

class _TrendsTab extends StatelessWidget {
  const _TrendsTab({required this.dailyAsync});
  final AsyncValue<List<Map<String, dynamic>>> dailyAsync;

  @override
  Widget build(BuildContext context) => dailyAsync.when(
    loading: () => const Center(child: CircularProgressIndicator()),
    error:   (_, __) => ErrorView(message: 'Failed to load trends'),
    data: (rows) {
      if (rows.isEmpty) {
        return const EmptyView(
          icon:    Icons.bar_chart,
          message: 'No trend data available yet',
        );
      }
      return ListView(padding: const EdgeInsets.all(16), children: [
        _TrendChart(
          title:  'Blocked Requests (30 days)',
          color:  ShieldTheme.danger,
          rows:   rows,
          field:  'blockedRequests',
        ),
        const SizedBox(height: 16),
        _TrendChart(
          title:  'Active Devices (30 days)',
          color:  ShieldTheme.success,
          rows:   rows,
          field:  'activeDevices',
        ),
      ]);
    },
  );
}

// ── Widgets ───────────────────────────────────────────────────────────────────

class _Stat {
  const _Stat(this.label, this.value, this.icon, this.color);
  final String   label, value;
  final IconData icon;
  final Color    color;
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.stats});
  final List<_Stat> stats;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GridView.count(
      crossAxisCount:  2,
      shrinkWrap:      true,
      physics:         const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.6,
      children: stats.map((s) => Container(
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
        child: Column(crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
          Icon(s.icon, color: s.color, size: 20),
          const SizedBox(height: 8),
          Text(s.value, style: TextStyle(
              fontSize: 22, fontWeight: FontWeight.w700, color: s.color)),
          Text(s.label, style: TextStyle(
              fontSize: 10,
              color: Theme.of(context)
                  .colorScheme.onSurface.withOpacity(0.5))),
        ]),
      )).toList(),
    );
  }
}

class _TrendChart extends StatelessWidget {
  const _TrendChart({
    required this.title,
    required this.color,
    required this.rows,
    required this.field,
  });
  final String   title, field;
  final Color    color;
  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    final isDark  = Theme.of(context).brightness == Brightness.dark;
    final display = rows.length > 30 ? rows.sublist(rows.length - 30) : rows;
    final spots = display.asMap().entries.map((e) =>
        FlSpot(e.key.toDouble(),
            (e.value[field] as num? ?? 0).toDouble())).toList();

    return Container(
      padding: const EdgeInsets.all(16),
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
        Text(title,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        SizedBox(
          height: 130,
          child: LineChart(LineChartData(
            gridData: FlGridData(
              show: true, drawVerticalLine: false,
              getDrawingHorizontalLine: (_) => FlLine(
                  color: isDark ? Colors.white10 : Colors.black12,
                  strokeWidth: 1),
            ),
            titlesData: const FlTitlesData(
              leftTitles:   AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles:  AxisTitles(sideTitles: SideTitles(showTitles: false)),
              topTitles:    AxisTitles(sideTitles: SideTitles(showTitles: false)),
              bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
            ),
            borderData: FlBorderData(show: false),
            lineBarsData: [
              LineChartBarData(
                spots:       spots,
                isCurved:    true,
                color:       color,
                barWidth:    2.5,
                dotData:     const FlDotData(show: false),
                belowBarData: BarAreaData(
                    show: true, color: color.withOpacity(0.08)),
              ),
            ],
          )),
        ),
      ]),
    );
  }
}

class _CategoryPieChart extends StatelessWidget {
  const _CategoryPieChart({required this.categories});
  final List categories;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final items  = categories.take(5).toList();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color:        isDark ? ShieldTheme.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: isDark ? Border.all(color: Colors.white12) : null,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Top Blocked Categories',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(
            child: SizedBox(
              height: 150,
              child: PieChart(PieChartData(
                sections: items.asMap().entries.map((e) {
                  final cat = e.value as Map<String, dynamic>;
                  return PieChartSectionData(
                    value: (cat['count'] as num? ?? 1).toDouble(),
                    color: ShieldTheme.chartPalette[
                        e.key % ShieldTheme.chartPalette.length],
                    title: '',
                    radius: 50,
                  );
                }).toList(),
                sectionsSpace: 2,
                centerSpaceRadius: 30,
              )),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: items.asMap().entries.map((e) {
                final cat   = e.value as Map<String, dynamic>;
                final color = ShieldTheme.chartPalette[
                    e.key % ShieldTheme.chartPalette.length];
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(children: [
                    Container(width: 10, height: 10,
                        decoration: BoxDecoration(
                            color: color, shape: BoxShape.circle)),
                    const SizedBox(width: 6),
                    Expanded(child: Text(
                      cat['category']?.toString() ?? '—',
                      style: const TextStyle(fontSize: 11),
                      overflow: TextOverflow.ellipsis,
                    )),
                  ]),
                );
              }).toList(),
            ),
          ),
        ]),
      ]),
    );
  }
}
