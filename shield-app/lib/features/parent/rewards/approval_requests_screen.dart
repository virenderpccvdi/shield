import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

final _approvalsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.approvals(pid));
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.whereType<Map<String, dynamic>>().toList();
});

class ApprovalRequestsScreen extends ConsumerWidget {
  const ApprovalRequestsScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final approvals = ref.watch(_approvalsProvider(profileId));
    return Scaffold(
      appBar: AppBar(title: const Text('Approval Requests')),
      body: approvals.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load requests',
          onRetry: () => ref.invalidate(_approvalsProvider(profileId)),
        ),
        data: (list) {
          final pending = list.where((r) => r['status'] == 'SUBMITTED').toList();
          if (pending.isEmpty) {
            return const EmptyView(
              icon:    Icons.thumb_up_outlined,
              message: 'No tasks waiting for approval',
            );
          }
          return ListView.builder(
            itemCount:   pending.length,
            itemBuilder: (_, i) => _ApprovalCard(
              request:   pending[i],
              profileId: profileId,
              onAction:  () => ref.invalidate(_approvalsProvider(profileId)),
            ),
          );
        },
      ),
    );
  }
}

class _ApprovalCard extends StatelessWidget {
  const _ApprovalCard({required this.request, required this.profileId, required this.onAction});
  final Map<String, dynamic> request;
  final String profileId;
  final VoidCallback onAction;

  Future<void> _respond(BuildContext context, bool approved) async {
    final id = request['id']?.toString() ?? '';
    try {
      final path = approved
          ? Endpoints.taskApprove(id)
          : Endpoints.taskReject(id);
      await ApiClient.instance.post(path, data: {'profileId': profileId});
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(approved ? 'Approved' : 'Denied'),
          backgroundColor: approved ? Colors.green : Colors.red,
        ));
        onAction();
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(request['title']?.toString() ?? 'Request',
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
        if (request['description'] != null)
          Text(request['description'].toString(),
              style: const TextStyle(color: Colors.black54)),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: OutlinedButton(
            onPressed: () => _respond(context, false),
            style:     OutlinedButton.styleFrom(foregroundColor: Colors.red,
                side: const BorderSide(color: Colors.red)),
            child: const Text('Deny'),
          )),
          const SizedBox(width: 8),
          Expanded(child: ElevatedButton(
            onPressed: () => _respond(context, true),
            child:     const Text('Approve'),
          )),
        ]),
      ]),
    ),
  );
}
