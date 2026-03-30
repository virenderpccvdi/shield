import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';
import 'package:intl/intl.dart';

final _insightsProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.aiInsights(pid));
  final raw = resp.data as Map<String, dynamic>? ?? {};
  return (raw['data'] as Map<String, dynamic>?) ?? raw;
});

class AiInsightsScreen extends ConsumerWidget {
  const AiInsightsScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final insights = ref.watch(_insightsProvider(profileId));
    return Scaffold(
      appBar: AppBar(title: const Text('AI Insights')),
      body: insights.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'AI insights not available',
          onRetry: () => ref.invalidate(_insightsProvider(profileId)),
        ),
        data: (d) => ListView(children: [
          // Summary card
          Padding(
            padding: const EdgeInsets.all(16),
            child: Card(
              color: const Color(0xFF0D47A1),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Row(children: [
                    Icon(Icons.psychology, color: Colors.white70, size: 18),
                    SizedBox(width: 6),
                    Text('AI Summary', style: TextStyle(color: Colors.white70, fontSize: 12)),
                  ]),
                  const SizedBox(height: 8),
                  Text(
                    d['summary']?.toString() ?? 'No insights available for this period.',
                    style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.5),
                  ),
                ]),
              ),
            ),
          ),

          // Risk level
          if (d['riskLevel'] != null) ...[
            const SectionHeader('Risk Assessment'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _riskCard(d['riskLevel'].toString()),
            ),
          ],

          // Recommendations
          if (d['recommendations'] != null) ...[
            const SectionHeader('Recommendations'),
            ...(d['recommendations'] as List? ?? []).map((r) => ListTile(
              leading: const Icon(Icons.lightbulb_outline, color: Colors.amber),
              title:   Text(r.toString()),
            )),
          ],

          // Anomalies
          if (d['anomalies'] != null) ...[
            const SectionHeader('Unusual Activity'),
            ...(d['anomalies'] as List? ?? []).map((a) {
              final item = a as Map<String, dynamic>;
              return ListTile(
                leading: const Icon(Icons.warning_amber, color: Colors.orange),
                title:   Text(item['description']?.toString() ?? ''),
                subtitle: item['detectedAt'] != null
                    ? Text(DateFormat('d MMM, HH:mm').format(
                        DateTime.parse(item['detectedAt'].toString()).toLocal()))
                    : null,
              );
            }),
          ],

          const SizedBox(height: 24),
        ]),
      ),
    );
  }

  Widget _riskCard(String level) {
    Color color; IconData icon; String desc;
    switch (level.toUpperCase()) {
      case 'HIGH':
        color = Colors.red; icon = Icons.dangerous;
        desc  = 'High risk activity detected. Review alerts immediately.';
        break;
      case 'MEDIUM':
        color = Colors.orange; icon = Icons.warning;
        desc  = 'Some concerning patterns detected. Review when possible.';
        break;
      default:
        color = Colors.green; icon = Icons.check_circle;
        desc  = 'Everything looks normal. No concerning patterns detected.';
    }
    return Card(
      child: ListTile(
        leading: Icon(icon, color: color, size: 32),
        title:   Text(level.toUpperCase(),
            style: TextStyle(color: color, fontWeight: FontWeight.bold)),
        subtitle: Text(desc),
      ),
    );
  }
}
