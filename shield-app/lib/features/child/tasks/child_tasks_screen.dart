import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/common_widgets.dart';

final _childTasksProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final pid = ref.read(authProvider).childProfileId ?? '';
  final resp = await ApiClient.instance.get(Endpoints.tasks(pid));
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.whereType<Map<String, dynamic>>().toList();
});

class ChildTasksScreen extends ConsumerWidget {
  const ChildTasksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasks = ref.watch(_childTasksProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF1E40AF),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text('My Tasks'),
        leading: IconButton(
          icon:      const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: tasks.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Colors.white)),
        error:   (e, _) => Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.error_outline, color: Colors.white54, size: 48),
            const SizedBox(height: 12),
            const Text('Could not load tasks', style: TextStyle(color: Colors.white54)),
            TextButton(
              onPressed: () => ref.invalidate(_childTasksProvider),
              child: const Text('Retry', style: TextStyle(color: Colors.white70)),
            ),
          ]),
        ),
        data: (list) {
          if (list.isEmpty) {
            return const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.task_alt, color: Colors.white30, size: 64),
              SizedBox(height: 12),
              Text('No tasks yet!', style: TextStyle(color: Colors.white54, fontSize: 16)),
            ]));
          }
          final pending   = list.where((t) => t['status'] == 'PENDING').toList();
          final submitted = list.where((t) => t['status'] == 'SUBMITTED').toList();
          final completed = list.where((t) => t['status'] == 'APPROVED').toList();
          final rejected  = list.where((t) => t['status'] == 'REJECTED').toList();
          return ListView(children: [
            if (pending.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text('TO DO', style: TextStyle(color: Colors.white54,
                    fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1)),
              ),
              ...pending.map((t) => _TaskCard(task: t, onComplete: () {
                _complete(context, ref, t);
              })),
            ],
            if (submitted.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text('WAITING FOR APPROVAL', style: TextStyle(color: Colors.white54,
                    fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1)),
              ),
              ...submitted.map((t) => _TaskCard(task: t, onComplete: null)),
            ],
            if (completed.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text('COMPLETED', style: TextStyle(color: Colors.white30,
                    fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1)),
              ),
              ...completed.map((t) => _TaskCard(task: t, onComplete: null)),
            ],
            if (rejected.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text('REJECTED', style: TextStyle(color: Colors.red,
                    fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1)),
              ),
              ...rejected.map((t) => _TaskCard(task: t, onComplete: () {
                _complete(context, ref, t);
              })),
            ],
          ]);
        },
      ),
    );
  }

  void _complete(BuildContext context, WidgetRef ref, Map<String, dynamic> task) async {
    final pid    = ref.read(authProvider).childProfileId ?? '';
    final taskId = task['id']?.toString() ?? '';
    try {
      await ApiClient.instance.post(Endpoints.taskComplete(pid, taskId));
      ref.invalidate(_childTasksProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Task complete! +${task['points'] ?? 0} points 🌟'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to complete task — please try again')));
      }
    }
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({required this.task, required this.onComplete});
  final Map<String, dynamic> task;
  final VoidCallback? onComplete;

  @override
  Widget build(BuildContext context) {
    final status = task['status']?.toString() ?? 'PENDING';
    final done = status == 'APPROVED';
    final submitted = status == 'SUBMITTED';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Container(
        decoration: BoxDecoration(
          color:        Colors.white.withOpacity(done ? 0.05 : 0.1),
          borderRadius: BorderRadius.circular(16),
          border:       Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: ListTile(
          leading: Icon(
            done ? Icons.check_circle :
            submitted ? Icons.hourglass_top :
            Icons.radio_button_unchecked,
            color: done ? Colors.green :
                   submitted ? Colors.amber : Colors.white54,
          ),
          title: Text(task['title']?.toString() ?? '',
              style: TextStyle(
                color:      done ? Colors.white38 : Colors.white,
                decoration: done ? TextDecoration.lineThrough : null,
              )),
          subtitle: Text('${task['points'] ?? 0} pts',
              style: TextStyle(color: done ? Colors.white24 : const Color(0xFFFFC107))),
          trailing: onComplete != null
              ? ElevatedButton(
                  onPressed: onComplete,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4CAF50),
                    minimumSize: const Size(72, 32),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                  ),
                  child: const Text('Done', style: TextStyle(fontSize: 12, color: Colors.white)),
                )
              : null,
        ),
      ),
    );
  }
}
