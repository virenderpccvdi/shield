import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';

final alertsProvider = FutureProvider<List<dynamic>>((ref) async {
  try {
    final res = await ref.read(dioProvider).get('/notifications/my/unread');
    return res.data['data'] as List? ?? [];
  } catch (_) { return []; }
});

class AlertsScreen extends ConsumerWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alertsAsync = ref.watch(alertsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Alerts', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [IconButton(icon: const Icon(Icons.done_all), onPressed: () => ref.invalidate(alertsProvider))],
      ),
      body: alertsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (alerts) => alerts.isEmpty
          ? const Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.notifications_none, size: 64, color: Colors.grey),
              SizedBox(height: 16),
              Text('No new alerts', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.grey)),
              Text('You\'re all caught up!', style: TextStyle(color: Colors.grey)),
            ]))
          : RefreshIndicator(
              onRefresh: () => ref.refresh(alertsProvider.future),
              child: ListView.builder(
                itemCount: alerts.length,
                itemBuilder: (_, i) {
                  final a = alerts[i] as Map<String, dynamic>;
                  final isHigh = a['severity'] == 'HIGH' || a['type'] == 'PANIC_BUTTON';
                  return Card(
                    margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: isHigh ? Colors.red.shade100 : Colors.orange.shade100,
                        child: Icon(isHigh ? Icons.warning : Icons.info_outline,
                          color: isHigh ? Colors.red : Colors.orange),
                      ),
                      title: Text(a['title'] ?? a['type'] ?? 'Alert', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      subtitle: Text(a['message'] ?? '', style: const TextStyle(fontSize: 12)),
                      trailing: Text(_timeAgo(a['createdAt']), style: const TextStyle(fontSize: 11, color: Colors.grey)),
                    ),
                  );
                },
              ),
            ),
      ),
    );
  }

  String _timeAgo(String? ts) {
    if (ts == null) return '';
    try {
      final d = DateTime.parse(ts);
      final diff = DateTime.now().difference(d);
      if (diff.inMinutes < 1) return 'just now';
      if (diff.inHours < 1) return '${diff.inMinutes}m ago';
      if (diff.inDays < 1) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (_) { return ''; }
  }
}
