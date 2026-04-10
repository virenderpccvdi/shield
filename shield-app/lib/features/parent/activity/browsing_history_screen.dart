import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';
import 'package:intl/intl.dart';

final _browsingProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.browsingHistory(pid),
      params: {'period': 'TODAY', 'limit': '100'});
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.whereType<Map<String, dynamic>>().toList();
});

class BrowsingHistoryScreen extends ConsumerStatefulWidget {
  const BrowsingHistoryScreen({super.key, required this.profileId});
  final String profileId;
  @override
  ConsumerState<BrowsingHistoryScreen> createState() => _BrowsingHistoryState();
}

class _BrowsingHistoryState extends ConsumerState<BrowsingHistoryScreen> {
  String _period = 'TODAY';
  static const _periods = ['TODAY','WEEK','MONTH','ALL'];

  @override
  Widget build(BuildContext context) {
    final history = ref.watch(_browsingProvider(widget.profileId));
    return Scaffold(
      appBar: AppBar(title: const Text('Browsing History')),
      body: Column(children: [
        // Period tabs
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: _periods.map((p) => Expanded(child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: ChoiceChip(
                label:    Text(p, style: const TextStyle(fontSize: 12)),
                selected: _period == p,
                onSelected: (_) {
                  setState(() => _period = p);
                  ref.invalidate(_browsingProvider(widget.profileId));
                },
              ),
            ))).toList(),
          ),
        ),

        Expanded(
          child: history.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error:   (e, _) => ErrorView(
              message: 'Failed to load browsing history',
              onRetry: () => ref.invalidate(_browsingProvider(widget.profileId)),
            ),
            data: (list) {
              if (list.isEmpty) {
                return const EmptyView(
                  icon:    Icons.history,
                  message: 'No browsing history for this period',
                );
              }
              return ListView.builder(
                itemCount:   list.length,
                itemBuilder: (_, i) {
                  final item     = list[i];
                  final blocked  = item['isBlocked'] as bool? ?? false;
                  final dt       = DateTime.tryParse(item['visitedAt']?.toString() ?? '');
                  return ListTile(
                    leading: CircleAvatar(
                      radius:          18,
                      backgroundColor: blocked ? Colors.red.shade50 : Colors.grey.shade100,
                      child: Icon(
                        blocked ? Icons.block : Icons.language,
                        size:  16,
                        color: blocked ? Colors.red : Colors.black45,
                      ),
                    ),
                    title:    Text(
                      item['domain']?.toString() ?? item['url']?.toString() ?? '',
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                    ),
                    trailing: SizedBox(
                      width: 56,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (blocked)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                              decoration: BoxDecoration(
                                color: Colors.red.shade50,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text('Blocked',
                                  style: TextStyle(color: Colors.red, fontSize: 10)),
                            ),
                          if (dt != null)
                            Text(DateFormat('HH:mm').format(dt.toLocal()),
                                style: const TextStyle(fontSize: 11, color: Colors.black54)),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ]),
    );
  }
}
