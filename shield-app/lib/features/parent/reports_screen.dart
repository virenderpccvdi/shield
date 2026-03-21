import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:dio/dio.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api_client.dart';

// Top-level function required by compute() — must not be a closure or method
Future<void> _writeFileIsolate(Map<String, dynamic> args) async {
  final path = args['path'] as String;
  final bytes = args['bytes'] as List<int>;
  await File(path).writeAsBytes(bytes, flush: true);
}

class ReportsScreen extends ConsumerStatefulWidget {
  final String profileId;
  const ReportsScreen({super.key, required this.profileId});
  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen>
    with SingleTickerProviderStateMixin {
  Map<String, dynamic> _stats = {};
  List<Map<String, dynamic>> _daily = [];
  List<Map<String, dynamic>> _topDomains = [];
  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> _appUsage = [];
  bool _loading = true;
  bool _pdfLoading = false;

  // Browsing history tab
  late TabController _tabs;
  List<Map<String, dynamic>> _history = [];
  bool _historyLoading = false;
  bool _historyHasMore = true;
  int _historyPage = 0;
  String? _historyActionFilter; // null=all, 'BLOCKED', 'ALLOWED'

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _tabs.addListener(() {
      if (_tabs.index == 2 && _history.isEmpty && !_historyLoading) _loadHistory(reset: true);
    });
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _loadHistory({bool reset = false}) async {
    if (_historyLoading) return;
    if (reset) { _historyPage = 0; _historyHasMore = true; }
    if (!_historyHasMore) return;
    setState(() => _historyLoading = true);
    try {
      final client = ref.read(dioProvider);
      final params = <String, dynamic>{'page': _historyPage, 'size': 50};
      if (_historyActionFilter != null) params['action'] = _historyActionFilter;
      final res = await client.get('/analytics/${widget.profileId}/history', queryParameters: params);
      final raw = res.data;
      final content = (raw is Map)
          ? (raw['content'] as List? ?? raw['data']?['content'] as List? ?? [])
          : (raw is List ? raw : []);
      final items = content.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      setState(() {
        if (reset) _history = items; else _history.addAll(items);
        _historyPage++;
        _historyHasMore = items.length == 50;
        _historyLoading = false;
      });
    } catch (_) {
      setState(() => _historyLoading = false);
    }
  }

  Future<void> _downloadPdf() async {
    setState(() => _pdfLoading = true);
    final client = ref.read(dioProvider);
    try {
      final response = await client.get(
        '/analytics/${widget.profileId}/report/pdf',
        options: Options(responseType: ResponseType.bytes),
      );
      final bytes = response.data as List<int>;
      final tmpDir = Directory.systemTemp;
      final file = File('${tmpDir.path}/shield-report-${widget.profileId}.pdf');
      await compute(_writeFileIsolate, {'path': file.path, 'bytes': bytes});
      final uri = Uri.file(file.path);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('PDF saved but could not open viewer. Check Downloads.')),
        );
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('PDF downloaded successfully'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to download PDF: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _pdfLoading = false);
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final client = ref.read(dioProvider);

    // Fetch all five analytics endpoints in parallel
    final results = await Future.wait([
      client.get('/analytics/${widget.profileId}/stats').catchError((_) => null),
      client.get('/analytics/${widget.profileId}/daily').catchError((_) => null),
      client.get('/analytics/${widget.profileId}/top-domains').catchError((_) => null),
      client.get('/analytics/${widget.profileId}/categories').catchError((_) => null),
      client.get('/analytics/${widget.profileId}/apps').catchError((_) => null),
    ], eagerError: false);

    try {
      final r = results[0];
      _stats = r != null
          ? Map<String, dynamic>.from((r as dynamic).data['data'] as Map? ?? {})
          : {};
    } catch (_) { _stats = {}; }

    try {
      final r = results[1];
      _daily = r != null
          ? (((r as dynamic).data['data'] as List?) ?? [])
              .map((e) => Map<String, dynamic>.from(e as Map)).toList()
          : [];
    } catch (_) { _daily = []; }

    try {
      final r = results[2];
      _topDomains = r != null
          ? (((r as dynamic).data['data'] as List?) ?? [])
              .map((e) => Map<String, dynamic>.from(e as Map)).toList()
          : [];
    } catch (_) { _topDomains = []; }

    try {
      final r = results[3];
      _categories = r != null
          ? (((r as dynamic).data['data'] as List?) ?? [])
              .map((e) => Map<String, dynamic>.from(e as Map)).toList()
          : [];
    } catch (_) { _categories = []; }

    try {
      final r = results[4];
      if (r != null) {
        final raw = (r as dynamic).data;
        final list = raw is List ? raw : (raw['data'] as List? ?? raw['content'] as List? ?? []);
        _appUsage = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _appUsage.sort((a, b) => ((b['totalMinutes'] as num?) ?? 0).compareTo((a['totalMinutes'] as num?) ?? 0));
        if (_appUsage.length > 10) _appUsage = _appUsage.sublist(0, 10);
      } else {
        _appUsage = [];
      }
    } catch (_) { _appUsage = []; }

    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports & Analytics', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          if (_pdfLoading)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
            )
          else
            IconButton(
              icon: const Icon(Icons.picture_as_pdf),
              tooltip: 'Download PDF Report',
              onPressed: _downloadPdf,
            ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: () { _load(); _loadHistory(reset: true); }),
        ],
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(icon: Icon(Icons.bar_chart), text: 'Overview'),
            Tab(icon: Icon(Icons.history), text: 'Browsing History'),
            Tab(icon: Icon(Icons.phone_android), text: 'App Usage'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          // ── TAB 1: Overview ──────────────────────────────────────────────
          _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: () async => _load(),
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  // Stats cards
                  Row(children: [
                    _StatCard(label: 'Queries', value: '${_stats['totalQueries'] ?? 0}', icon: Icons.dns, color: const Color(0xFF1565C0)),
                    const SizedBox(width: 8),
                    _StatCard(label: 'Blocked', value: '${_stats['blockedQueries'] ?? 0}', icon: Icons.block, color: Colors.red),
                    const SizedBox(width: 8),
                    _StatCard(label: 'Screen Time', value: _fmtMin(_stats['screenTimeMinutes'] as int? ?? 0), icon: Icons.phone_android, color: Colors.orange),
                  ]),
                  const SizedBox(height: 24),

                  // Daily usage chart
                  const Text('Daily Usage', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 200,
                    child: _daily.isEmpty
                      ? const Center(child: Text('No daily data', style: TextStyle(color: Colors.grey)))
                      : LineChart(
                          LineChartData(
                            gridData: const FlGridData(show: true, drawVerticalLine: false),
                            titlesData: FlTitlesData(
                              leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 40, getTitlesWidget: (v, _) => Text('${v.toInt()}', style: const TextStyle(fontSize: 10, color: Colors.grey)))),
                              bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (v, _) {
                                final idx = v.toInt();
                                if (idx < 0 || idx >= _daily.length) return const SizedBox.shrink();
                                final date = _daily[idx]['date'] as String? ?? '';
                                return Padding(padding: const EdgeInsets.only(top: 4), child: Text(date.length >= 5 ? date.substring(5) : date, style: const TextStyle(fontSize: 9, color: Colors.grey)));
                              })),
                              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                            ),
                            borderData: FlBorderData(show: false),
                            lineBarsData: [
                              LineChartBarData(
                                spots: _daily.asMap().entries.map((e) => FlSpot(e.key.toDouble(), (e.value['queries'] as num? ?? 0).toDouble())).toList(),
                                isCurved: true,
                                color: const Color(0xFF1565C0),
                                barWidth: 2,
                                dotData: const FlDotData(show: false),
                                belowBarData: BarAreaData(show: true, color: const Color(0xFF1565C0).withAlpha(30)),
                              ),
                            ],
                          ),
                        ),
                  ),
                  const SizedBox(height: 24),

                  // Top domains
                  const Text('Top Domains', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 8),
                  if (_topDomains.isEmpty)
                    const Center(child: Padding(padding: EdgeInsets.all(16), child: Text('No domain data', style: TextStyle(color: Colors.grey))))
                  else
                    ...List.generate(
                      _topDomains.length > 10 ? 10 : _topDomains.length,
                      (i) {
                        final d = _topDomains[i];
                        final count = d['count'] as int? ?? d['queries'] as int? ?? 0;
                        final maxCount = (_topDomains.first['count'] as int? ?? _topDomains.first['queries'] as int? ?? 1);
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(children: [
                            SizedBox(width: 24, child: Text('${i + 1}', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.grey.shade500, fontSize: 13))),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(d['domain'] as String? ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                const SizedBox(height: 2),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(2),
                                  child: LinearProgressIndicator(
                                    value: maxCount > 0 ? count / maxCount : 0,
                                    minHeight: 4,
                                    backgroundColor: Colors.grey.shade200,
                                    color: (d['blocked'] == true) ? Colors.red : const Color(0xFF1565C0),
                                  ),
                                ),
                              ]),
                            ),
                            const SizedBox(width: 8),
                            Text('$count', style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
                          ]),
                        );
                      },
                    ),
                  const SizedBox(height: 24),

                  // Category breakdown
                  const Text('Categories', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 12),
                  if (_categories.isEmpty)
                    const Center(child: Padding(padding: EdgeInsets.all(16), child: Text('No category data', style: TextStyle(color: Colors.grey))))
                  else
                    SizedBox(
                      height: 200,
                      child: PieChart(
                        PieChartData(
                          sections: _categories.asMap().entries.map((e) {
                            final cat = e.value;
                            final value = (cat['count'] as num? ?? cat['queries'] as num? ?? 0).toDouble();
                            return PieChartSectionData(
                              value: value,
                              title: cat['category'] as String? ?? '',
                              titleStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.white),
                              radius: 60,
                              color: _pieColors[e.key % _pieColors.length],
                            );
                          }).toList(),
                          sectionsSpace: 2,
                          centerSpaceRadius: 30,
                        ),
                      ),
                    ),
                  const SizedBox(height: 80),
                ],
              ),
            ),
          ),

          // ── TAB 2: App Usage ─────────────────────────────────────────────
          _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: () async => _load(),
                child: _appUsage.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.phone_android, size: 48, color: Colors.grey),
                            SizedBox(height: 12),
                            Text('No app usage data yet',
                              style: TextStyle(color: Colors.grey, fontSize: 15),
                              textAlign: TextAlign.center),
                            SizedBox(height: 8),
                            Text('App usage appears once the child uses the Shield app on their device.',
                              style: TextStyle(color: Colors.grey, fontSize: 12),
                              textAlign: TextAlign.center),
                          ],
                        ),
                      ),
                    )
                  : ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      children: [
                        const Text('App Usage (Top 10)',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                        const SizedBox(height: 16),
                        ...() {
                          final maxMins = (_appUsage.first['totalMinutes'] as num?)?.toDouble() ?? 1.0;
                          return _appUsage.map((app) {
                            final mins = ((app['totalMinutes'] as num?) ?? 0).toDouble();
                            final blocked = (app['blockedCount'] as num?) ?? 0;
                            final ratio = maxMins > 0 ? (mins / maxMins).clamp(0.0, 1.0) : 0.0;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      SizedBox(
                                        width: 130,
                                        child: Text(
                                          app['appName'] as String? ?? '',
                                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      Expanded(
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(3),
                                          child: LinearProgressIndicator(
                                            value: ratio,
                                            minHeight: 8,
                                            backgroundColor: Colors.grey.shade200,
                                            color: const Color(0xFF1565C0),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      SizedBox(
                                        width: 48,
                                        child: Text(
                                          _fmtMin(mins.toInt()),
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: Colors.grey.shade700,
                                          ),
                                          textAlign: TextAlign.right,
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (blocked > 0)
                                    Padding(
                                      padding: const EdgeInsets.only(left: 130, top: 2),
                                      child: Text(
                                        '$blocked blocked attempts',
                                        style: TextStyle(fontSize: 10, color: Colors.red.shade400),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          }).toList();
                        }(),
                        const SizedBox(height: 32),
                      ],
                    ),
              ),

          // ── TAB 3: Browsing History ──────────────────────────────────────
          Column(
            children: [
              // Filter chips
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    const Text('Filter: ', style: TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(width: 8),
                    _filterChip('All', null),
                    const SizedBox(width: 6),
                    _filterChip('Blocked', 'BLOCKED'),
                    const SizedBox(width: 6),
                    _filterChip('Allowed', 'ALLOWED'),
                  ],
                ),
              ),
              Expanded(
                child: _history.isEmpty && _historyLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _history.isEmpty
                    ? const Center(child: Text('No browsing history yet.\nHistory appears once the child uses the internet.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey)))
                    : NotificationListener<ScrollNotification>(
                        onNotification: (n) {
                          if (n is ScrollEndNotification && n.metrics.extentAfter < 200) {
                            _loadHistory();
                          }
                          return false;
                        },
                        child: ListView.separated(
                          itemCount: _history.length + (_historyHasMore ? 1 : 0),
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (_, i) {
                            if (i == _history.length) {
                              return _historyLoading
                                ? const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator()))
                                : TextButton(onPressed: () => _loadHistory(), child: const Text('Load more'));
                            }
                            final entry = _history[i];
                            final blocked = entry['action'] == 'BLOCKED';
                            final domain = entry['domain']?.toString() ?? '';
                            final time = entry['queriedAt']?.toString() ?? '';
                            final category = entry['category']?.toString() ?? '';
                            return ListTile(
                              dense: true,
                              leading: Icon(
                                blocked ? Icons.block : Icons.language,
                                color: blocked ? Colors.red : Colors.green,
                                size: 20,
                              ),
                              title: Text(domain,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: blocked ? Colors.red.shade700 : null,
                                )),
                              subtitle: Text(
                                '${category.isNotEmpty ? "$category · " : ""}${_fmtTime(time)}',
                                style: const TextStyle(fontSize: 11)),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: blocked ? Colors.red.shade50 : Colors.green.shade50,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  blocked ? 'BLOCKED' : 'ALLOWED',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: blocked ? Colors.red.shade700 : Colors.green.shade700,
                                  )),
                              ),
                            );
                          },
                        ),
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, String? value) {
    final selected = _historyActionFilter == value;
    return FilterChip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      selected: selected,
      selectedColor: value == 'BLOCKED' ? Colors.red.shade100 : value == 'ALLOWED' ? Colors.green.shade100 : Colors.blue.shade100,
      onSelected: (_) {
        setState(() => _historyActionFilter = value);
        _loadHistory(reset: true);
      },
    );
  }

  String _fmtTime(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month} ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
    } catch (_) { return iso; }
  }

  String _fmtMin(int m) {
    if (m >= 60) return '${m ~/ 60}h${m % 60 > 0 ? ' ${m % 60}m' : ''}';
    return '${m}m';
  }

  static const _pieColors = [
    Color(0xFF1565C0), Color(0xFF43A047), Color(0xFFFFA726), Color(0xFFE53935),
    Color(0xFF1976D2), Color(0xFF00897B), Color(0xFFF4511E), Color(0xFF1E88E5),
    Color(0xFFD81B60), Color(0xFF039BE5),
  ];
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
            Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey), textAlign: TextAlign.center),
          ]),
        ),
      ),
    );
  }
}
