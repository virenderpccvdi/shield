import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';

class ChildTasksScreen extends ConsumerStatefulWidget {
  const ChildTasksScreen({super.key});
  @override
  ConsumerState<ChildTasksScreen> createState() => _ChildTasksScreenState();
}

class _ChildTasksScreenState extends ConsumerState<ChildTasksScreen> {
  List<Map<String, dynamic>> _tasks = [];
  bool _loading = true;
  int _totalPoints = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/rewards/tasks/my');
      _tasks = ((res.data['data'] as List?) ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)).toList();
      _totalPoints = _tasks
          .where((t) => t['completed'] == true || t['status'] == 'COMPLETED')
          .fold(0, (sum, t) => sum + (t['points'] as int? ?? 0));
    } catch (_) {
      _tasks = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _completeTask(String taskId) async {
    try {
      final client = ref.read(dioProvider);
      await client.post('/rewards/tasks/$taskId/complete');
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Task submitted for approval!'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final pendingTasks = _tasks.where((t) => t['completed'] != true && t['status'] != 'COMPLETED').toList();
    final completedTasks = _tasks.where((t) => t['completed'] == true || t['status'] == 'COMPLETED').toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Tasks', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: () async => _load(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Points earned card
                Card(
                  color: Colors.amber.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(children: [
                      const Icon(Icons.emoji_events, color: Colors.amber, size: 40),
                      const SizedBox(width: 12),
                      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Hi ${auth.name?.split(' ').first ?? 'there'}!',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                        Text('$_totalPoints points earned', style: TextStyle(color: Colors.grey.shade700)),
                      ]),
                      const Spacer(),
                      Text('$_totalPoints', style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: Colors.amber)),
                    ]),
                  ),
                ),
                const SizedBox(height: 20),

                // Pending tasks
                if (pendingTasks.isNotEmpty) ...[
                  Text('To Do (${pendingTasks.length})', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 8),
                  ...pendingTasks.map((task) {
                    final points = task['points'] as int? ?? task['rewardMinutes'] as int? ?? 0;
                    final status = task['status'] as String? ?? 'PENDING';
                    final pendingApproval = status == 'PENDING_APPROVAL';

                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              Icon(pendingApproval ? Icons.hourglass_top : Icons.circle_outlined,
                                color: pendingApproval ? Colors.orange : Colors.grey),
                              const SizedBox(width: 8),
                              Expanded(child: Text(task['title'] ?? '',
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15))),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.amber.shade100,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Text('+$points pts', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                              ),
                            ]),
                            if (task['description'] != null && (task['description'] as String).isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(left: 32, top: 4),
                                child: Text(task['description'], style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
                              ),
                            if (!pendingApproval)
                              Padding(
                                padding: const EdgeInsets.only(left: 32, top: 8),
                                child: FilledButton.tonal(
                                  onPressed: () => _completeTask(task['id'].toString()),
                                  child: const Text('Mark as Done'),
                                ),
                              )
                            else
                              const Padding(
                                padding: EdgeInsets.only(left: 32, top: 8),
                                child: Text('Waiting for parent approval...',
                                  style: TextStyle(color: Colors.orange, fontSize: 13, fontStyle: FontStyle.italic)),
                              ),
                          ],
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 20),
                ],

                // Completed tasks
                if (completedTasks.isNotEmpty) ...[
                  Text('Completed (${completedTasks.length})', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 8),
                  ...completedTasks.map((task) {
                    final points = task['points'] as int? ?? 0;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      color: Colors.green.shade50,
                      child: ListTile(
                        leading: const Icon(Icons.check_circle, color: Colors.green),
                        title: Text(task['title'] ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w600, decoration: TextDecoration.lineThrough)),
                        trailing: Text('+$points', style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.green)),
                      ),
                    );
                  }),
                ],

                if (_tasks.isEmpty)
                  const Center(child: Padding(
                    padding: EdgeInsets.all(48),
                    child: Column(children: [
                      Icon(Icons.task_alt, size: 64, color: Colors.grey),
                      SizedBox(height: 16),
                      Text('No tasks yet', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.grey, fontSize: 16)),
                      Text('Your parent will assign tasks for you to earn rewards!',
                        textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
                    ]),
                  )),
              ],
            ),
          ),
    );
  }
}
