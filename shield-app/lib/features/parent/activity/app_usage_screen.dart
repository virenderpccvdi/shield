import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

final _appUsageProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.appUsage(pid));
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.cast<Map<String, dynamic>>();
});

class AppUsageScreen extends ConsumerWidget {
  const AppUsageScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usage = ref.watch(_appUsageProvider(profileId));
    return Scaffold(
      appBar: AppBar(title: const Text('App Usage')),
      body: usage.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load app usage',
          onRetry: () => ref.invalidate(_appUsageProvider(profileId)),
        ),
        data: (list) {
          if (list.isEmpty) {
            return const EmptyView(
              icon:    Icons.pie_chart_outline,
              message: 'No app usage data yet',
            );
          }
          // Total minutes
          final total = list.fold<int>(0,
              (sum, a) => sum + ((a['minutesUsed'] as num?)?.toInt() ?? 0));

          return ListView(children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(children: [
                    const Text('Total Today', style: TextStyle(color: Colors.black45)),
                    Text(_formatMins(total),
                        style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold,
                            color: Color(0xFF1565C0))),
                  ]),
                ),
              ),
            ),
            const SectionHeader('By App'),
            ...list.map((a) {
              final mins  = (a['minutesUsed'] as num?)?.toInt() ?? 0;
              final pct   = total > 0 ? mins / total : 0.0;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Row(children: [
                  CircleAvatar(
                    radius:          18,
                    backgroundColor: Colors.grey.shade100,
                    child: Text(
                      (a['appName'] as String? ?? '?')[0].toUpperCase(),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(a['appName']?.toString() ?? a['packageName']?.toString() ?? '',
                        style: const TextStyle(fontWeight: FontWeight.w500)),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value:           pct,
                        minHeight:       6,
                        backgroundColor: Colors.grey.shade200,
                      ),
                    ),
                  ])),
                  const SizedBox(width: 8),
                  Text(_formatMins(mins),
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                ]),
              );
            }),
            const SizedBox(height: 24),
          ]);
        },
      ),
    );
  }

  String _formatMins(int mins) {
    final h = mins ~/ 60; final m = mins % 60;
    if (h == 0) return '${m}m';
    if (m == 0) return '${h}h';
    return '${h}h ${m}m';
  }
}
