import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class AppUsageScreen extends ConsumerStatefulWidget {
  final String profileId;
  const AppUsageScreen({super.key, required this.profileId});
  @override
  ConsumerState<AppUsageScreen> createState() => _AppUsageScreenState();
}

class _AppUsageScreenState extends ConsumerState<AppUsageScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _apps = [];
  int _totalMinutes = 0;
  String _period = 'today';

  static const _appColors = [
    Color(0xFF1565C0), Color(0xFF2E7D32), Color(0xFFE65100),
    Color(0xFF6A1B9A), Color(0xFFAD1457), Color(0xFF00695C),
    Color(0xFFBF360C), Color(0xFF37474F), Color(0xFF0277BD),
    Color(0xFFFF6F00),
  ];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ref.read(dioProvider).get(
        '/analytics/${widget.profileId}/app-usage',
        queryParameters: {'period': _period},
      );
      final d = res.data['data'] ?? res.data;
      final list = d is List ? d : (d is Map ? (d['apps'] ?? d['content'] ?? []) : []);
      int total = 0;
      final apps = List<Map<String, dynamic>>.from(
        list.map((e) => Map<String, dynamic>.from(e as Map)),
      );
      for (final a in apps) { total += (a['minutes'] as num? ?? 0).toInt(); }
      if (mounted) setState(() {
        _apps = apps;
        _totalMinutes = total;
        _loading = false;
      });
    } catch (_) {
      // Fallback to analytics stats if app-usage endpoint not available
      try {
        final res = await ref.read(dioProvider).get('/analytics/${widget.profileId}/stats');
        final d = res.data['data'] ?? res.data;
        if (mounted && d is Map) {
          final cats = d['categoryBreakdown'] as Map? ?? {};
          final apps = cats.entries.map((e) => {
            'appName': _formatCat(e.key.toString()),
            'category': e.key.toString(),
            'minutes': (e.value as num? ?? 0).toInt(),
          }).toList();
          int total = 0;
          for (final a in apps) { total += (a['minutes'] as int? ?? 0); }
          setState(() { _apps = List<Map<String, dynamic>>.from(apps); _totalMinutes = total; _loading = false; });
        } else {
          if (mounted) setState(() => _loading = false);
        }
      } catch (e2) {
        debugPrint('AppUsage fallback error: $e2');
        if (mounted) setState(() => _loading = false);
      }
    }
  }

  String _formatCat(String c) => c.length > 1
      ? c[0].toUpperCase() + c.substring(1).toLowerCase().replaceAll('_', ' ')
      : c;

  String _fmtMins(int m) {
    if (m <= 0) return '0m';
    if (m < 60) return '${m}m';
    return '${m ~/ 60}h ${m % 60}m';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('App Usage', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: ShieldTheme.primary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: Column(
        children: [
          // Period tabs
          Container(
            color: ShieldTheme.primary,
            child: Row(
              children: [
                for (final p in [('today', 'Today'), ('week', 'This Week'), ('month', 'Month')])
                  Expanded(child: GestureDetector(
                    onTap: () { setState(() => _period = p.$1); _load(); },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        border: Border(bottom: BorderSide(
                          color: _period == p.$1 ? Colors.white : Colors.transparent,
                          width: 2.5,
                        )),
                      ),
                      child: Text(p.$2,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: _period == p.$1 ? Colors.white : Colors.white60,
                          fontWeight: _period == p.$1 ? FontWeight.w700 : FontWeight.w500,
                          fontSize: 13,
                        )),
                    ),
                  )),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: Column(children: [
                      ShieldCardSkeleton(lines: 3), SizedBox(height: 12),
                      ShieldCardSkeleton(lines: 4),
                    ]),
                  )
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _apps.isEmpty
                        ? Center(
                            child: Column(mainAxisSize: MainAxisSize.min, children: [
                              const Icon(Icons.bar_chart_rounded, size: 64, color: ShieldTheme.divider),
                              const SizedBox(height: 16),
                              const Text('No app usage data',
                                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                              Text('No data available for ${_period == 'today' ? 'today' : 'this $_period'}',
                                style: const TextStyle(color: ShieldTheme.textSecondary)),
                            ]),
                          )
                        : ListView(
                            padding: const EdgeInsets.all(16),
                            children: [
                              // Summary card
                              Container(
                                padding: const EdgeInsets.all(20),
                                decoration: BoxDecoration(
                                  gradient: ShieldTheme.heroGradient,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Row(children: [
                                  const Icon(Icons.bar_chart_rounded, color: Colors.white, size: 36),
                                  const SizedBox(width: 16),
                                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(_fmtMins(_totalMinutes), style: const TextStyle(
                                      color: Colors.white, fontWeight: FontWeight.w800, fontSize: 28)),
                                    const Text('Total screen time', style: TextStyle(color: Colors.white70, fontSize: 13)),
                                  ]),
                                ]),
                              ),
                              const SizedBox(height: 20),

                              // Pie chart if we have data
                              if (_apps.isNotEmpty && _totalMinutes > 0) ...[
                                const Text('BREAKDOWN', style: TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 11,
                                  color: ShieldTheme.textSecondary, letterSpacing: 0.8)),
                                const SizedBox(height: 12),
                                SizedBox(
                                  height: 200,
                                  child: PieChart(PieChartData(
                                    sections: List.generate(
                                      _apps.length > 8 ? 8 : _apps.length,
                                      (i) {
                                        final app = _apps[i];
                                        final mins = (app['minutes'] as int? ?? 0);
                                        final pct = _totalMinutes > 0 ? mins / _totalMinutes * 100 : 0.0;
                                        return PieChartSectionData(
                                          value: mins.toDouble(),
                                          color: _appColors[i % _appColors.length],
                                          title: pct >= 8 ? '${pct.toStringAsFixed(0)}%' : '',
                                          radius: 70,
                                          titleStyle: const TextStyle(
                                            fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white),
                                        );
                                      },
                                    ),
                                    sectionsSpace: 2,
                                    centerSpaceRadius: 40,
                                  )),
                                ),
                                const SizedBox(height: 20),
                              ],

                              // App list
                              const Text('TOP APPS', style: TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 11,
                                color: ShieldTheme.textSecondary, letterSpacing: 0.8)),
                              const SizedBox(height: 10),
                              ..._apps.asMap().entries.map((entry) {
                                final i = entry.key;
                                final app = entry.value;
                                final mins = (app['minutes'] as int? ?? 0);
                                final pct = _totalMinutes > 0 ? mins / _totalMinutes : 0.0;
                                final color = _appColors[i % _appColors.length];
                                return Container(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: ShieldTheme.cardBg,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(color: ShieldTheme.divider),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(children: [
                                        Container(
                                          width: 38, height: 38,
                                          decoration: BoxDecoration(
                                            color: color.withOpacity(0.12),
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Icon(Icons.apps_rounded, color: color, size: 20),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(app['appName'] as String? ?? app['category'] as String? ?? 'Unknown',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700, fontSize: 14, color: ShieldTheme.textPrimary)),
                                            if (app['category'] != null && app['category'] != app['appName'])
                                              Text(app['category'] as String,
                                                style: const TextStyle(fontSize: 11.5, color: ShieldTheme.textSecondary)),
                                          ],
                                        )),
                                        Text(_fmtMins(mins), style: TextStyle(
                                          fontWeight: FontWeight.w700, fontSize: 15, color: color)),
                                      ]),
                                      const SizedBox(height: 10),
                                      Stack(children: [
                                        Container(
                                          height: 6, width: double.infinity,
                                          decoration: BoxDecoration(
                                            color: color.withOpacity(0.12),
                                            borderRadius: BorderRadius.circular(3),
                                          ),
                                        ),
                                        FractionallySizedBox(
                                          widthFactor: pct.clamp(0.0, 1.0),
                                          child: Container(
                                            height: 6,
                                            decoration: BoxDecoration(
                                              color: color,
                                              borderRadius: BorderRadius.circular(3),
                                            ),
                                          ),
                                        ),
                                      ]),
                                    ],
                                  ),
                                );
                              }),
                            ],
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}
