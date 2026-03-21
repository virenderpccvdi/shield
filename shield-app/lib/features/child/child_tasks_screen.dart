import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';

class ChildTasksScreen extends ConsumerStatefulWidget {
  const ChildTasksScreen({super.key});
  @override
  ConsumerState<ChildTasksScreen> createState() => _ChildTasksScreenState();
}

class _ChildTasksScreenState extends ConsumerState<ChildTasksScreen>
    with WidgetsBindingObserver {
  List<Map<String, dynamic>> _tasks = [];
  bool _loading = true;
  bool _isRefreshing = false;
  int _totalPoints = 0;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    // Auto-refresh every 30s so new tasks from parent appear without manual pull
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _load(background: true));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _refreshTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _load();
  }

  Future<void> _load({bool background = false}) async {
    if (background) {
      // Background refresh: keep existing data visible, show subtle progress indicator
      if (mounted) setState(() => _isRefreshing = true);
    } else {
      // Initial load: show full loading spinner
      if (mounted) setState(() => _loading = true);
    }
    try {
      final auth = ref.read(authProvider);
      final profileId = auth.childProfileId;
      if (profileId == null || profileId.isEmpty) {
        if (mounted) setState(() { _tasks = []; _loading = false; _isRefreshing = false; });
        return;
      }
      final client = ref.read(dioProvider);
      // GET /rewards/tasks/{profileId} — returns List<TaskResponse> directly (no wrapper)
      final res = await client.get('/rewards/tasks/$profileId');
      final raw = res.data;
      final list = raw is List ? raw : (raw is Map ? (raw['data'] as List? ?? []) : <dynamic>[]);
      final newTasks = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      final newPoints = newTasks
          .where((t) => t['status'] == 'APPROVED')
          .fold(0, (sum, t) => sum + (t['rewardPoints'] as int? ?? 0));
      if (mounted) setState(() {
        _tasks = newTasks;
        _totalPoints = newPoints;
        _loading = false;
        _isRefreshing = false;
      });
    } catch (_) {
      if (mounted) setState(() { _loading = false; _isRefreshing = false; });
    }
  }

  Future<void> _completeTask(String taskId) async {
    try {
      final auth = ref.read(authProvider);
      final profileId = auth.childProfileId;
      final client = ref.read(dioProvider);
      await client.post(
        '/rewards/tasks/$taskId/complete',
        queryParameters: {'profileId': profileId},
      );
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Task submitted for parent approval!'),
            backgroundColor: Colors.green,
          ),
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

    // Split tasks by status
    final pendingTasks = _tasks.where((t) {
      final s = t['status'] as String? ?? 'PENDING';
      return s == 'PENDING';
    }).toList();
    final submittedTasks = _tasks.where((t) => t['status'] == 'SUBMITTED').toList();
    final approvedTasks  = _tasks.where((t) => t['status'] == 'APPROVED').toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Tasks', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : Column(
          children: [
            // Subtle refresh indicator — keeps list visible while refreshing in background
            if (_isRefreshing) const LinearProgressIndicator(),
            Expanded(child: RefreshIndicator(
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
                        Text('$_totalPoints points earned',
                          style: TextStyle(color: Colors.grey.shade700)),
                      ]),
                      const Spacer(),
                      Text('$_totalPoints',
                        style: const TextStyle(
                          fontSize: 32, fontWeight: FontWeight.w800, color: Colors.amber,
                        )),
                    ]),
                  ),
                ),
                const SizedBox(height: 20),

                // Pending tasks — to do
                if (pendingTasks.isNotEmpty) ...[
                  Text('To Do (${pendingTasks.length})',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 8),
                  ...pendingTasks.map((task) {
                    final points = task['rewardPoints'] as int? ?? task['rewardMinutes'] as int? ?? 0;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              const Icon(Icons.circle_outlined, color: Colors.grey),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(task['title'] ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.amber.shade100,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Text('+$points pts',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                              ),
                            ]),
                            if (task['description'] != null &&
                                (task['description'] as String).isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(left: 32, top: 4),
                                child: Text(task['description'],
                                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
                              ),
                            Padding(
                              padding: const EdgeInsets.only(left: 32, top: 8),
                              child: FilledButton.tonal(
                                onPressed: () => _completeTask(task['id'].toString()),
                                child: const Text('Mark as Done'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 20),
                ],

                // Submitted (waiting approval)
                if (submittedTasks.isNotEmpty) ...[
                  Text('Waiting for Approval (${submittedTasks.length})',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16,
                      color: Colors.orange)),
                  const SizedBox(height: 8),
                  ...submittedTasks.map((task) {
                    final points = task['rewardPoints'] as int? ?? 0;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      color: Colors.orange.shade50,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              const Icon(Icons.hourglass_top, color: Colors.orange),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(task['title'] ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.amber.shade100,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Text('+$points pts',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                              ),
                            ]),
                            const Padding(
                              padding: EdgeInsets.only(left: 32, top: 8),
                              child: Text('Waiting for parent approval...',
                                style: TextStyle(
                                  color: Colors.orange, fontSize: 13, fontStyle: FontStyle.italic)),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 20),
                ],

                // Completed (approved by parent)
                if (approvedTasks.isNotEmpty) ...[
                  Text('Completed (${approvedTasks.length})',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 8),
                  ...approvedTasks.map((task) {
                    final points = task['rewardPoints'] as int? ?? 0;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      color: Colors.green.shade50,
                      child: ListTile(
                        leading: const Icon(Icons.check_circle, color: Colors.green),
                        title: Text(task['title'] ?? '',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.lineThrough,
                          )),
                        trailing: Text('+$points pts',
                          style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.green)),
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
                      Text('No tasks yet',
                        style: TextStyle(fontWeight: FontWeight.w600, color: Colors.grey, fontSize: 16)),
                      Text('Your parent will assign tasks for you to earn rewards!',
                        textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
                    ]),
                  )),
              ],
            ),
          )),
          ],
        ),
    );
  }
}
