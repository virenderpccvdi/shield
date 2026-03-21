import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:dio/dio.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api_client.dart';

class ReportsScreen extends ConsumerStatefulWidget {
  final String profileId;
  const ReportsScreen({super.key, required this.profileId});
  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  Map<String, dynamic> _stats = {};
  List<Map<String, dynamic>> _daily = [];
  List<Map<String, dynamic>> _topDomains = [];
  List<Map<String, dynamic>> _categories = [];
  bool _loading = true;
  bool _pdfLoading = false;

  @override
  void initState() {
    super.initState();
    _load();
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
      await file.writeAsBytes(bytes, flush: true);
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

    try {
      final statsRes = await client.get('/analytics/${widget.profileId}/stats');
      _stats = Map<String, dynamic>.from(statsRes.data['data'] as Map? ?? {});
    } catch (_) { _stats = {}; }

    try {
      final dailyRes = await client.get('/analytics/${widget.profileId}/daily');
      _daily = ((dailyRes.data['data'] as List?) ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) { _daily = []; }

    try {
      final domainsRes = await client.get('/analytics/${widget.profileId}/top-domains');
      _topDomains = ((domainsRes.data['data'] as List?) ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) { _topDomains = []; }

    try {
      final catRes = await client.get('/analytics/${widget.profileId}/categories');
      _categories = ((catRes.data['data'] as List?) ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) { _categories = []; }

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
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
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
    );
  }

  String _fmtMin(int m) {
    if (m >= 60) return '${m ~/ 60}h${m % 60 > 0 ? ' ${m % 60}m' : ''}';
    return '${m}m';
  }

  static const _pieColors = [
    Color(0xFF1565C0), Color(0xFF43A047), Color(0xFFFFA726), Color(0xFFE53935),
    Color(0xFF8E24AA), Color(0xFF00897B), Color(0xFFF4511E), Color(0xFF3949AB),
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
