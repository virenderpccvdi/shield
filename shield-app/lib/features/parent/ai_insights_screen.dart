import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';

class AiInsightsScreen extends ConsumerStatefulWidget {
  final String profileId;
  const AiInsightsScreen({super.key, required this.profileId});
  @override
  ConsumerState<AiInsightsScreen> createState() => _AiInsightsScreenState();
}

class _AiInsightsScreenState extends ConsumerState<AiInsightsScreen> {
  List<Map<String, dynamic>> _insights = [];
  Map<String, dynamic> _weekly = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final client = ref.read(dioProvider);

    try {
      final insightsRes = await client.get('/ai/${widget.profileId}/insights');
      _insights = ((insightsRes.data['data'] as List?) ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) { _insights = []; }

    try {
      final weeklyRes = await client.get('/ai/${widget.profileId}/weekly');
      _weekly = Map<String, dynamic>.from(weeklyRes.data['data'] as Map? ?? {});
    } catch (_) { _weekly = {}; }

    if (mounted) setState(() => _loading = false);
  }

  Color _severityColor(String? severity) {
    switch (severity?.toUpperCase()) {
      case 'HIGH': case 'CRITICAL': return Colors.red;
      case 'MEDIUM': return Colors.orange;
      case 'LOW': return Colors.green;
      default: return Colors.blue;
    }
  }

  IconData _severityIcon(String? severity) {
    switch (severity?.toUpperCase()) {
      case 'HIGH': case 'CRITICAL': return Icons.error;
      case 'MEDIUM': return Icons.warning;
      case 'LOW': return Icons.info;
      default: return Icons.lightbulb;
    }
  }

  @override
  Widget build(BuildContext context) {
    final riskScore = _weekly['riskScore'] as num? ?? 0;
    final riskLevel = riskScore > 70 ? 'High' : riskScore > 40 ? 'Medium' : 'Low';
    final riskColor = riskScore > 70 ? Colors.red : riskScore > 40 ? Colors.orange : Colors.green;

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Insights', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
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
                  // Risk score card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 80,
                            height: 80,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                CircularProgressIndicator(
                                  value: riskScore / 100,
                                  strokeWidth: 8,
                                  backgroundColor: Colors.grey.shade200,
                                  color: riskColor,
                                ),
                                Text('${riskScore.toInt()}', style: TextStyle(
                                  fontSize: 22, fontWeight: FontWeight.w800, color: riskColor)),
                              ],
                            ),
                          ),
                          const SizedBox(width: 20),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Risk Score', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                                const SizedBox(height: 4),
                                Text(riskLevel, style: TextStyle(
                                  fontSize: 24, fontWeight: FontWeight.w800, color: riskColor)),
                                const SizedBox(height: 4),
                                Text(_weekly['summary'] as String? ?? 'No weekly summary available',
                                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Weekly summary stats
                  if (_weekly.isNotEmpty) ...[
                    const Text('Weekly Summary', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    const SizedBox(height: 12),
                    Row(children: [
                      _WeeklyStat(label: 'Avg Screen', value: '${_weekly['avgScreenTime'] ?? 0}m', icon: Icons.phone_android),
                      const SizedBox(width: 8),
                      _WeeklyStat(label: 'Blocked', value: '${_weekly['totalBlocked'] ?? 0}', icon: Icons.block),
                      const SizedBox(width: 8),
                      _WeeklyStat(label: 'Anomalies', value: '${_weekly['anomalyCount'] ?? 0}', icon: Icons.psychology),
                    ]),
                    const SizedBox(height: 20),
                  ],

                  // Insights list
                  Row(children: [
                    const Text('Behavioral Insights', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    const Spacer(),
                    Text('${_insights.length} insights', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                  ]),
                  const SizedBox(height: 12),
                  if (_insights.isEmpty)
                    const Center(child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Column(children: [
                        Icon(Icons.psychology, size: 48, color: Colors.grey),
                        SizedBox(height: 12),
                        Text('No insights yet', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.grey)),
                        Text('AI analysis will appear after enough data is collected',
                          textAlign: TextAlign.center, style: TextStyle(color: Colors.grey, fontSize: 13)),
                      ]),
                    ))
                  else
                    ..._insights.map((insight) {
                      final severity = insight['severity'] as String?;
                      final color = _severityColor(severity);
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              CircleAvatar(
                                radius: 18,
                                backgroundColor: color.withAlpha(30),
                                child: Icon(_severityIcon(severity), color: color, size: 20),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(children: [
                                      Expanded(child: Text(insight['title'] as String? ?? '',
                                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: color.withAlpha(20),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Text(severity ?? 'INFO',
                                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
                                      ),
                                    ]),
                                    const SizedBox(height: 4),
                                    Text(insight['message'] as String? ?? insight['description'] as String? ?? '',
                                      style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
                                    if (insight['recommendation'] != null) ...[
                                      const SizedBox(height: 6),
                                      Container(
                                        padding: const EdgeInsets.all(8),
                                        decoration: BoxDecoration(
                                          color: Colors.blue.shade50,
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Row(children: [
                                          Icon(Icons.lightbulb, size: 14, color: Colors.blue.shade700),
                                          const SizedBox(width: 6),
                                          Expanded(child: Text(insight['recommendation'],
                                            style: TextStyle(fontSize: 12, color: Colors.blue.shade700))),
                                        ]),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
    );
  }
}

class _WeeklyStat extends StatelessWidget {
  final String label, value;
  final IconData icon;
  const _WeeklyStat({required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            Icon(icon, color: const Color(0xFF1565C0), size: 22),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ]),
        ),
      ),
    );
  }
}
