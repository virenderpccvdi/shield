import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

final _tasksProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.tasks(pid));
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.whereType<Map<String, dynamic>>().toList();
});

final _pointsProvider =
    FutureProvider.autoDispose.family<int, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.points(pid));
  return ((resp.data as Map<String, dynamic>?)?['points'] as num?)?.toInt() ?? 0;
});

class RewardsScreen extends ConsumerWidget {
  const RewardsScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasks  = ref.watch(_tasksProvider(profileId));
    final points = ref.watch(_pointsProvider(profileId));

    return Scaffold(
      appBar: AppBar(title: const Text('Rewards & Tasks')),
      body: ListView(children: [
        // Points summary
        points.when(
          loading: () => const SizedBox.shrink(),
          error:   (_, __) => const SizedBox.shrink(),
          data: (p) => Padding(
            padding: const EdgeInsets.all(16),
            child: Card(
              color: const Color(0xFFF9A825),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Row(children: [
                  const Icon(Icons.star, color: Colors.white, size: 40),
                  const SizedBox(width: 16),
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('$p', style: const TextStyle(
                        color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
                    const Text('Total Points', style: TextStyle(color: Colors.white70)),
                  ]),
                ]),
              ),
            ),
          ),
        ),

        // Tasks
        const SectionHeader('Tasks'),
        tasks.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error:   (e, _) => ErrorView(
            message: 'Failed to load tasks',
            onRetry: () => ref.invalidate(_tasksProvider(profileId)),
          ),
          data: (list) {
            if (list.isEmpty) {
              return EmptyView(
                icon:    Icons.task_alt,
                message: 'No tasks yet. Add tasks to motivate your child.',
                action: ElevatedButton.icon(
                  onPressed: () => _showAddTask(context, profileId),
                  icon:  const Icon(Icons.add),
                  label: const Text('Add Task'),
                ),
              );
            }
            return Column(children: list.map((t) => _TaskTile(
              task:      t,
              profileId: profileId,
              onChanged: () => ref.invalidate(_tasksProvider(profileId)),
            )).toList());
          },
        ),
      ]),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddTask(context, profileId),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showAddTask(BuildContext context, String profileId) {
    final title = TextEditingController();
    final points = TextEditingController(text: '10');
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Add Task'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: title,
              decoration: const InputDecoration(labelText: 'Task description')),
          const SizedBox(height: 8),
          TextField(controller: points, keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Points reward')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (title.text.isEmpty) return;
              await ApiClient.instance.post(Endpoints.tasks(profileId), data: {
                'title': title.text, 'points': int.tryParse(points.text) ?? 10,
              });
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({required this.task, required this.profileId, required this.onChanged});
  final Map<String, dynamic> task;
  final String profileId;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final status = task['status']?.toString() ?? 'PENDING';
    final done = status == 'APPROVED';
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: done ? Colors.green.shade50 : Colors.grey.shade100,
          child: Icon(done ? Icons.check_circle : Icons.radio_button_unchecked,
              color: done ? Colors.green : Colors.grey),
        ),
        title:    Text(task['title']?.toString() ?? '',
            style: TextStyle(
                decoration: done ? TextDecoration.lineThrough : null,
                color:      done ? Colors.black38 : null)),
        subtitle: Text('${task['points'] ?? 0} pts'),
        trailing: Text(
            done ? 'Done' : status == 'SUBMITTED' ? 'Review' : status == 'REJECTED' ? 'Rejected' : 'Pending',
            style: TextStyle(
                color: done ? Colors.green :
                       status == 'SUBMITTED' ? Colors.blue :
                       status == 'REJECTED' ? Colors.red : const Color(0xFF92400E),
                fontWeight: FontWeight.w600)),
      ),
    );
  }
}
