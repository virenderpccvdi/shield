import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

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
  String? _errorMessage;
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
        if (mounted) setState(() { _tasks = []; _loading = false; _isRefreshing = false; _errorMessage = null; });
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
          .fold(0, (sum, t) => sum + ((t['rewardPoints'] as num?)?.toInt() ?? 0));
      if (mounted) setState(() {
        _tasks = newTasks;
        _totalPoints = newPoints;
        _loading = false;
        _isRefreshing = false;
        _errorMessage = null;
      });
    } catch (e) {
      if (mounted) setState(() {
        _loading = false;
        _isRefreshing = false;
        _errorMessage = e.toString();
      });
    }
  }

  Future<void> _completeTask(String taskId) async {
    try {
      final auth = ref.read(authProvider);
      final profileId = auth.childProfileId;
      final client = ref.read(dioProvider);
      await client.post('/rewards/tasks/$taskId/complete');
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Task submitted for parent approval!'),
          backgroundColor: ShieldTheme.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed: $e'),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
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
        ? ListView(
            padding: const EdgeInsets.all(16),
            children: const [
              ShieldCardSkeleton(lines: 3),
              SizedBox(height: 12),
              ShieldCardSkeleton(lines: 3),
              SizedBox(height: 12),
              ShieldCardSkeleton(lines: 3),
            ],
          )
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
                  color: ShieldTheme.warning.withOpacity(0.08),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(children: [
                      Icon(Icons.emoji_events, color: ShieldTheme.warning, size: 40),
                      const SizedBox(width: 12),
                      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Hi ${auth.name?.split(' ').first ?? 'there'}!',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                        Text('$_totalPoints points earned',
                          style: TextStyle(color: Colors.grey.shade700)),
                      ]),
                      const Spacer(),
                      Text('$_totalPoints',
                        style: TextStyle(
                          fontSize: 32, fontWeight: FontWeight.w800, color: ShieldTheme.warning,
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
                    final points = (task['rewardPoints'] as num?)?.toInt() ?? (task['rewardMinutes'] as num?)?.toInt() ?? 0;
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
                                  color: ShieldTheme.warning.withOpacity(0.12),
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
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16,
                      color: ShieldTheme.warning)),
                  const SizedBox(height: 8),
                  ...submittedTasks.map((task) {
                    final points = (task['rewardPoints'] as num?)?.toInt() ?? 0;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      color: ShieldTheme.warning.withOpacity(0.07),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              Icon(Icons.hourglass_top, color: ShieldTheme.warning),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(task['title'] ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: ShieldTheme.warning.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Text('+$points pts',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                              ),
                            ]),
                            Padding(
                              padding: const EdgeInsets.only(left: 32, top: 8),
                              child: Text('Waiting for parent approval...',
                                style: TextStyle(
                                  color: ShieldTheme.warning, fontSize: 13, fontStyle: FontStyle.italic)),
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
                    final points = (task['rewardPoints'] as num?)?.toInt() ?? 0;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      color: ShieldTheme.success.withOpacity(0.07),
                      child: ListTile(
                        leading: Icon(Icons.check_circle, color: ShieldTheme.success),
                        title: Text(task['title'] ?? '',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            decoration: TextDecoration.lineThrough,
                          )),
                        trailing: Text('+$points pts',
                          style: TextStyle(fontWeight: FontWeight.w700, color: ShieldTheme.success)),
                      ),
                    );
                  }),
                ],

                if (_errorMessage != null)
                  Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: ShieldTheme.danger.withOpacity(0.06),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: ShieldTheme.danger.withOpacity(0.3)),
                    ),
                    child: Column(children: [
                      Icon(Icons.error_outline, size: 48, color: ShieldTheme.danger),
                      const SizedBox(height: 12),
                      const Text('Could not load tasks',
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                      const SizedBox(height: 8),
                      Text(_errorMessage!, textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                      const SizedBox(height: 16),
                      FilledButton.tonal(onPressed: () => _load(), child: const Text('Retry')),
                    ]),
                  )
                else if (_tasks.isEmpty)
                  ShieldEmptyState(
                    icon: Icons.task_alt,
                    title: 'No tasks yet',
                    subtitle: "Your parent hasn't assigned any tasks",
                  ),
              ],
            ),
          )),
          ],
        ),
    );
  }
}
