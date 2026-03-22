import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:dio/dio.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:intl/intl.dart';
import '../../core/api_client.dart';
import '../../core/shield_widgets.dart';
import '../../app/theme.dart';

// ── Reports Hub — child profile selector shown when no profileId provided ──

class ReportsHubScreen extends ConsumerStatefulWidget {
  const ReportsHubScreen({super.key});

  @override
  ConsumerState<ReportsHubScreen> createState() => _ReportsHubScreenState();
}

class _ReportsHubScreenState extends ConsumerState<ReportsHubScreen> {
  List<Map<String, dynamic>> _profiles = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadProfiles();
  }

  Future<void> _loadProfiles() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/profiles/children');
      final raw = res.data;
      final d = raw is Map ? (raw['data'] ?? raw) : raw;
      final list = d is List
          ? d
          : (d is Map ? (d['content'] ?? d['items'] ?? []) : []) as List;
      setState(() {
        _profiles = list
            .where((e) => (e['id']?.toString() ?? '').isNotEmpty)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadProfiles),
        ],
      ),
      body: _loading
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: Column(children: [
                ShieldCardSkeleton(lines: 3),
                SizedBox(height: 12),
                ShieldCardSkeleton(lines: 3),
              ]))
          : _profiles.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.bar_chart, size: 56, color: ShieldTheme.textSecondary),
                        const SizedBox(height: 16),
                        const Text('No child profiles found',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        const Text('Add a child profile first to see their reports.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: ShieldTheme.textSecondary)),
                        const SizedBox(height: 20),
                        FilledButton.icon(
                          onPressed: () => context.go('/family/new'),
                          icon: const Icon(Icons.add),
                          label: const Text('Add Child'),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadProfiles,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      const Text('Select a child to view their reports',
                          style: TextStyle(
                              fontSize: 13, color: ShieldTheme.textSecondary)),
                      const SizedBox(height: 12),
                      ..._profiles.map((p) {
                        final name = p['name'] as String? ?? 'Child';
                        final initial = name.isNotEmpty ? name[0].toUpperCase() : 'C';
                        final filterLevel = p['filterLevel'] as String? ?? '';
                        final online = p['online'] == true;
                        final colors = [
                          ShieldTheme.primary, ShieldTheme.primaryLight,
                          ShieldTheme.success, ShieldTheme.danger,
                        ];
                        final avatarColor =
                            colors[name.codeUnitAt(0) % colors.length];

                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: ShieldTheme.divider),
                          ),
                          child: Material(
                            color: Colors.transparent,
                            borderRadius: BorderRadius.circular(16),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(16),
                              onTap: () => context.go(
                                  '/family/${p['id']}/reports'),
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 24,
                                      backgroundColor: avatarColor,
                                      child: Text(initial,
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 18,
                                              fontWeight: FontWeight.w700)),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(name,
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w700,
                                                  fontSize: 15)),
                                          const SizedBox(height: 2),
                                          Row(children: [
                                            Icon(
                                              online
                                                  ? Icons.wifi
                                                  : Icons.wifi_off,
                                              size: 12,
                                              color: online
                                                  ? ShieldTheme.successLight
                                                  : ShieldTheme.textSecondary,
                                            ),
                                            const SizedBox(width: 4),
                                            Flexible(
                                              child: Text(
                                                online ? 'Online' : 'Offline',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: online
                                                      ? ShieldTheme.successLight
                                                      : ShieldTheme
                                                          .textSecondary,
                                                ),
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                            if (filterLevel.isNotEmpty) ...[
                                              const SizedBox(width: 8),
                                              Flexible(
                                                child: Text(
                                                  filterLevel,
                                                  style: const TextStyle(
                                                      fontSize: 11,
                                                      color: ShieldTheme
                                                          .textSecondary),
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                ),
                                              ),
                                            ],
                                          ]),
                                        ],
                                      ),
                                    ),
                                    const Icon(Icons.bar_chart_rounded,
                                        color: ShieldTheme.primary, size: 20),
                                    const SizedBox(width: 4),
                                    const Icon(Icons.chevron_right,
                                        color: ShieldTheme.textSecondary,
                                        size: 20),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ],
                  ),
                ),
    );
  }
}

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

  DateTime _startDate = DateTime.now().subtract(const Duration(days: 30));
  DateTime _endDate   = DateTime.now();

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
      final params = <String, dynamic>{'page': _historyPage, 'size': 50, 'period': 'TODAY'};
      if (_historyActionFilter == 'BLOCKED') {
        params['blockedOnly'] = 'true';
      } else if (_historyActionFilter == 'ALLOWED') {
        params['blockedOnly'] = 'false';
      }
      final res = await client.get('/dns/history/${widget.profileId}', queryParameters: params);
      final raw = res.data;
      final data = raw is Map ? (raw['data'] ?? raw) : raw;
      final content = (data is Map)
          ? (data['content'] as List? ?? [])
          : (data is List ? data : []);
      final items = content.map((e) {
        final m = Map<String, dynamic>.from(e as Map);
        // Map wasBlocked boolean to action string
        final wasBlocked = m['wasBlocked'] == true;
        m['action'] = wasBlocked ? 'BLOCKED' : 'ALLOWED';
        return m;
      }).toList();
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
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('PDF downloaded successfully'), backgroundColor: ShieldTheme.success, behavior: SnackBarBehavior.floating),
          );
        }
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('PDF saved to Downloads folder'), backgroundColor: ShieldTheme.success, behavior: SnackBarBehavior.floating),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to download PDF: $e'), backgroundColor: ShieldTheme.danger, behavior: SnackBarBehavior.floating),
        );
      }
    } finally {
      if (mounted) setState(() => _pdfLoading = false);
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final client = ref.read(dioProvider);

    final from = _startDate.toIso8601String().split('T')[0];
    final to   = _endDate.toIso8601String().split('T')[0];
    final dateParams = <String, dynamic>{'from': from, 'to': to};

    // Fetch all five analytics endpoints in parallel
    final results = await Future.wait([
      client.get('/analytics/${widget.profileId}/stats', queryParameters: dateParams).catchError((_) => null),
      client.get('/analytics/${widget.profileId}/daily', queryParameters: dateParams).catchError((_) => null),
      client.get('/analytics/${widget.profileId}/top-domains', queryParameters: dateParams).catchError((_) => null),
      client.get('/analytics/${widget.profileId}/categories', queryParameters: dateParams).catchError((_) => null),
      client.get('/analytics/${widget.profileId}/top-apps').catchError((_) => null),
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
              .map((e) => Map<String, dynamic>.from((e is Map ? e : <String, dynamic>{}))).toList()
          : [];
    } catch (_) { _daily = []; }

    try {
      final r = results[2];
      _topDomains = r != null
          ? (((r as dynamic).data['data'] as List?) ?? [])
              .map((e) => Map<String, dynamic>.from((e is Map ? e : <String, dynamic>{}))).toList()
          : [];
    } catch (_) { _topDomains = []; }

    try {
      final r = results[3];
      _categories = r != null
          ? (((r as dynamic).data['data'] as List?) ?? [])
              .map((e) => Map<String, dynamic>.from((e is Map ? e : <String, dynamic>{}))).toList()
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
            Tab(icon: Icon(Icons.phone_android), text: 'App Usage'),
            Tab(icon: Icon(Icons.history), text: 'History'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          // ── TAB 1: Overview ──────────────────────────────────────────────
          _loading
            ? const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 4),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 3),
          ]))
            : RefreshIndicator(
                onRefresh: () async => _load(),
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  // Quick links
                  _buildQuickLinks(context),
                  const SizedBox(height: 12),

                  // Date range selector
                  _buildDateRangeRow(context),

                  // Stats cards
                  Row(children: [
                    _StatCard(label: 'Queries', value: '${_stats['totalQueries'] ?? 0}', icon: Icons.dns, color: ShieldTheme.primary),
                    const SizedBox(width: 8),
                    _StatCard(label: 'Blocked', value: '${_stats['blockedQueries'] ?? 0}', icon: Icons.block, color: ShieldTheme.danger),
                    const SizedBox(width: 8),
                    _StatCard(label: 'Screen Time', value: _fmtMin(_stats['screenTimeMinutes'] as int? ?? 0), icon: Icons.phone_android, color: ShieldTheme.warning),
                  ]),
                  const SizedBox(height: 24),

                  // Daily usage chart
                  const Text('Daily Usage', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 200,
                    child: _daily.isEmpty
                      ? const Center(child: Text('No daily data', style: const TextStyle(color: ShieldTheme.textSecondary)))
                      : SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: SizedBox(
                            width: MediaQuery.of(context).size.width > 360
                                ? MediaQuery.of(context).size.width - 32
                                : 340,
                            child: LineChart(
                          LineChartData(
                            gridData: const FlGridData(show: true, drawVerticalLine: false),
                            titlesData: FlTitlesData(
                              leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 40, getTitlesWidget: (v, _) => Text('${v.toInt()}', style: const TextStyle(fontSize: 10, color: ShieldTheme.textSecondary)))),
                              bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (v, _) {
                                final idx = v.toInt();
                                if (idx < 0 || idx >= _daily.length) return const SizedBox.shrink();
                                final date = _daily[idx]['date'] as String? ?? '';
                                return Padding(padding: const EdgeInsets.only(top: 4), child: Text(date.length >= 5 ? date.substring(5) : date, style: const TextStyle(fontSize: 9, color: ShieldTheme.textSecondary)));
                              })),
                              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                            ),
                            borderData: FlBorderData(show: false),
                            lineBarsData: [
                              LineChartBarData(
                                spots: _daily.asMap().entries.map((e) => FlSpot(e.key.toDouble(), (e.value['queries'] as num? ?? 0).toDouble())).toList(),
                                isCurved: true,
                                color: ShieldTheme.primary,
                                barWidth: 2,
                                dotData: const FlDotData(show: false),
                                belowBarData: BarAreaData(show: true, color: ShieldTheme.primary.withOpacity(0.10)),
                              ),
                            ],
                          ),
                        ),
                          ),
                        ),
                  ),
                  const SizedBox(height: 24),

                  // Top domains
                  const Text('Top Domains', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 8),
                  if (_topDomains.isEmpty)
                    const Center(child: Padding(padding: EdgeInsets.all(16), child: Text('No domain data', style: const TextStyle(color: ShieldTheme.textSecondary))))
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
                            SizedBox(width: 24, child: Text('${i + 1}', style: const TextStyle(fontWeight: FontWeight.w700, color: ShieldTheme.textSecondary, fontSize: 13))),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(d['domain'] as String? ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                const SizedBox(height: 2),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(2),
                                  child: LinearProgressIndicator(
                                    value: maxCount > 0 ? count / maxCount : 0,
                                    minHeight: 4,
                                    backgroundColor: ShieldTheme.divider,
                                    color: (d['blocked'] == true) ? ShieldTheme.danger : ShieldTheme.primary,
                                  ),
                                ),
                              ]),
                            ),
                            const SizedBox(width: 8),
                            Text('$count', style: const TextStyle(fontSize: 12, color: ShieldTheme.textSecondary, fontWeight: FontWeight.w600)),
                          ]),
                        );
                      },
                    ),
                  const SizedBox(height: 24),

                  // Category breakdown
                  const Text('Categories', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 12),
                  if (_categories.isEmpty)
                    const Center(child: Padding(padding: EdgeInsets.all(16), child: Text('No category data', style: const TextStyle(color: ShieldTheme.textSecondary))))
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
            ? const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 4),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 3),
          ]))
            : RefreshIndicator(
                onRefresh: () async => _load(),
                child: _appUsage.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.phone_android, size: 48, color: ShieldTheme.textSecondary),
                            SizedBox(height: 12),
                            Text('No app usage data yet',
                              style: TextStyle(color: ShieldTheme.textSecondary, fontSize: 15),
                              textAlign: TextAlign.center),
                            SizedBox(height: 8),
                            Text('App usage appears once the child uses the Shield app on their device.',
                              style: TextStyle(color: ShieldTheme.textSecondary, fontSize: 12),
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
                                      Flexible(
                                        flex: 3,
                                        child: Text(
                                          app['appName'] as String? ?? '',
                                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                          overflow: TextOverflow.ellipsis,
                                          maxLines: 1,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        flex: 4,
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(3),
                                          child: LinearProgressIndicator(
                                            value: ratio,
                                            minHeight: 8,
                                            backgroundColor: ShieldTheme.divider,
                                            color: ShieldTheme.primary,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        _fmtMin(mins.toInt()),
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: ShieldTheme.textSecondary,
                                        ),
                                        textAlign: TextAlign.right,
                                      ),
                                    ],
                                  ),
                                  if (blocked > 0)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Text(
                                        '$blocked blocked attempts',
                                        style: const TextStyle(fontSize: 10, color: ShieldTheme.dangerLight),
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
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
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
              ),
              Expanded(
                child: _history.isEmpty && _historyLoading
                  ? const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 4),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 3),
          ]))
                  : _history.isEmpty
                    ? const Center(child: Text('No browsing history yet.\nHistory appears once the child uses the internet.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: ShieldTheme.textSecondary)))
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
                                color: blocked ? ShieldTheme.danger : ShieldTheme.success,
                                size: 20,
                              ),
                              title: Text(domain,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: blocked ? ShieldTheme.danger : null,
                                ),
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1),
                              subtitle: Text(
                                '${category.isNotEmpty ? "$category · " : ""}${_fmtTime(time)}',
                                style: const TextStyle(fontSize: 11)),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: blocked ? ShieldTheme.danger.withOpacity(0.08) : ShieldTheme.success.withOpacity(0.08),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  blocked ? 'BLOCKED' : 'ALLOWED',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: blocked ? ShieldTheme.danger : ShieldTheme.success,
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

  Widget _buildQuickLinks(BuildContext context) {
    final links = [
      {'icon': Icons.history, 'label': 'Browsing History', 'route': '/family/${widget.profileId}/browsing-history'},
      {'icon': Icons.block, 'label': 'Top Blocked', 'tab': 2}, // switch to history tab with blocked filter
      {'icon': Icons.phone_android, 'label': 'Screen Time', 'tab': 1}, // switch to app usage tab
      {'icon': Icons.auto_awesome, 'label': 'AI Insights', 'route': '/family/${widget.profileId}/ai-insights'},
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: links.map((l) {
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ActionChip(
              avatar: Icon(l['icon'] as IconData, size: 16, color: ShieldTheme.primary),
              label: Text(l['label'] as String, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              backgroundColor: ShieldTheme.primary.withOpacity(0.06),
              side: BorderSide(color: ShieldTheme.primary.withOpacity(0.15)),
              onPressed: () {
                if (l.containsKey('route')) {
                  context.push(l['route'] as String);
                } else if (l.containsKey('tab')) {
                  _tabs.animateTo(l['tab'] as int);
                  if (l['tab'] == 2 && l['label'] == 'Top Blocked') {
                    setState(() => _historyActionFilter = 'BLOCKED');
                    _loadHistory(reset: true);
                  }
                }
              },
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildDateRangeRow(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 0, 0, 12),
      child: Row(children: [
        Expanded(
          child: OutlinedButton.icon(
            icon: const Icon(Icons.calendar_today, size: 14),
            label: Text(
              '${DateFormat('MMM d').format(_startDate)} – ${DateFormat('MMM d').format(_endDate)}',
              style: const TextStyle(fontSize: 12),
            ),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 8),
              side: BorderSide(color: ShieldTheme.divider),
            ),
            onPressed: () async {
              final picked = await showDateRangePicker(
                context: context,
                firstDate: DateTime.now().subtract(const Duration(days: 365)),
                lastDate: DateTime.now(),
                initialDateRange: DateTimeRange(start: _startDate, end: _endDate),
                builder: (ctx, child) => Theme(
                  data: Theme.of(ctx).copyWith(
                    colorScheme: ColorScheme.light(primary: ShieldTheme.primary),
                  ),
                  child: child!,
                ),
              );
              if (picked != null) {
                setState(() { _startDate = picked.start; _endDate = picked.end; });
                _load();
              }
            },
          ),
        ),
        const SizedBox(width: 8),
        IconButton(
          icon: const Icon(Icons.refresh, size: 18),
          onPressed: _load,
          style: IconButton.styleFrom(
            side: BorderSide(color: ShieldTheme.divider),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
      ]),
    );
  }

  Widget _filterChip(String label, String? value) {
    final selected = _historyActionFilter == value;
    return FilterChip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      selected: selected,
      selectedColor: value == 'BLOCKED' ? ShieldTheme.danger.withOpacity(0.12) : value == 'ALLOWED' ? ShieldTheme.success.withOpacity(0.12) : ShieldTheme.primary.withOpacity(0.12),
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
            Text(label, style: const TextStyle(fontSize: 11, color: ShieldTheme.textSecondary), textAlign: TextAlign.center),
          ]),
        ),
      ),
    );
  }
}
