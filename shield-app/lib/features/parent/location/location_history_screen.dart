import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';
import 'package:intl/intl.dart';

class LocationHistoryScreen extends ConsumerWidget {
  const LocationHistoryScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(_historyProvider(profileId));
    return Scaffold(
      appBar: AppBar(title: const Text('Location History')),
      body: history.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load history',
          onRetry: () => ref.invalidate(_historyProvider(profileId)),
        ),
        data: (list) {
          if (list.isEmpty) {
            return const EmptyView(
              icon:    Icons.location_history,
              message: 'No location history yet',
            );
          }
          return ListView.builder(
            itemCount:   list.length,
            itemBuilder: (_, i) {
              final item = list[i];
              final dt   = DateTime.tryParse(item['createdAt']?.toString() ?? '');
              return ListTile(
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFE3F2FD),
                  child: Icon(Icons.location_on, color: Color(0xFF2563EB), size: 18),
                ),
                title: Text(
                  item['address']?.toString() ?? '${item['latitude']}, ${item['longitude']}',
                ),
                subtitle: dt != null
                    ? Text(DateFormat('d MMM yyyy, HH:mm').format(dt.toLocal()))
                    : null,
                trailing: const Icon(Icons.chevron_right, color: Colors.black45),
              );
            },
          );
        },
      ),
    );
  }
}

final _historyProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.locationHistory(pid),
      params: {'limit': '50'});
  final raw = resp.data as List? ??
      (resp.data as Map<String, dynamic>?)?['content'] as List? ?? [];
  return raw.whereType<Map<String, dynamic>>().toList();
});
