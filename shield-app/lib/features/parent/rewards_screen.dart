import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class RewardsScreen extends ConsumerStatefulWidget {
  final String profileId;
  const RewardsScreen({super.key, required this.profileId});
  @override
  ConsumerState<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends ConsumerState<RewardsScreen> {
  List<Map<String, dynamic>> _tasks = [];
  Map<String, dynamic> _bank = {};
  List<Map<String, dynamic>> _achievements = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      // Fetch tasks, bank balance, and achievements in parallel
      final results = await Future.wait([
        client.get('/rewards/tasks/${widget.profileId}'),
        client.get('/rewards/bank/${widget.profileId}').catchError((_) => null),
        client.get('/rewards/${widget.profileId}/achievements').catchError((_) => null),
      ], eagerError: false);

      final tasksRes = results[0] as dynamic;
      final rawTasks = tasksRes.data is List
          ? tasksRes.data as List
          : (tasksRes.data['data'] as List? ?? []);
      _tasks = rawTasks.map((e) => Map<String, dynamic>.from(e as Map)).toList();

      try {
        final bankRes = results[1];
        _bank = bankRes != null
            ? Map<String, dynamic>.from((bankRes as dynamic).data['data'] as Map? ?? {})
            : {};
      } catch (_) { _bank = {}; }

      try {
        final achRes = results[2];
        if (achRes != null) {
          final raw = (achRes as dynamic).data;
          final list = raw is List ? raw : (raw is Map ? (raw['data'] as List? ?? []) : <dynamic>[]);
          _achievements = list.map((a) => <String, dynamic>{
            'name': (a as Map)['name'] ?? '',
            'description': a['description'] ?? '',
            'earned': a['earned'] ?? false,
            'points': a['points'] ?? 0,
          }).toList();
        } else {
          _achievements = [];
        }
      } catch (_) { _achievements = []; }
    } catch (_) {
      _tasks = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _approveTask(String taskId) async {
    try {
      final client = ref.read(dioProvider);
      await client.post('/rewards/tasks/$taskId/approve', data: {'approved': true});
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Task approved! Reward credited.'),
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

  Future<void> _rejectTask(String taskId) async {
    try {
      final client = ref.read(dioProvider);
      await client.post('/rewards/tasks/$taskId/reject', data: {'approved': false});
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Task rejected.'),
          backgroundColor: ShieldTheme.warning,
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

  Future<void> _createTask() async {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final pointsCtrl = TextEditingController(text: '10');

    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Create Task', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            const SizedBox(height: 16),
            TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Task Title', prefixIcon: Icon(Icons.task))),
            const SizedBox(height: 12),
            TextField(controller: descCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Description (optional)', prefixIcon: Icon(Icons.description))),
            const SizedBox(height: 12),
            TextField(controller: pointsCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Reward Points', prefixIcon: Icon(Icons.star))),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Create Task'),
            ),
          ],
        ),
      ),
    );

    if (result == true && titleCtrl.text.isNotEmpty) {
      try {
        final client = ref.read(dioProvider);
        await client.post('/rewards/tasks', data: {
          'profileId': widget.profileId,
          'title': titleCtrl.text,
          'description': descCtrl.text,
          'rewardPoints': int.tryParse(pointsCtrl.text) ?? 10,
          'rewardMinutes': 30,
        });
        _load();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Failed to create: $e'),
            backgroundColor: ShieldTheme.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final balance = _bank['pointsBalance'] as int? ?? 0;
    final totalEarned = _bank['totalEarnedPoints'] as int? ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Rewards & Tasks', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _createTask,
        icon: const Icon(Icons.add),
        label: const Text('New Task'),
        backgroundColor: ShieldTheme.primary,
        foregroundColor: Colors.white,
      ),
      body: _loading
        ? const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 4),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 3),
          ]))
        : RefreshIndicator(
            onRefresh: () async => _load(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Bank card
                Card(
                  color: ShieldTheme.primary,
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Row(children: [
                      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Reward Bank', style: TextStyle(color: Colors.white70, fontSize: 13)),
                        const SizedBox(height: 4),
                        Text('$balance pts', style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
                        Text('Total earned: $totalEarned pts', style: const TextStyle(color: Colors.white60, fontSize: 12)),
                      ]),
                      const Spacer(),
                      const Icon(Icons.emoji_events, color: ShieldTheme.warning, size: 48),
                    ]),
                  ),
                ),
                const SizedBox(height: 20),
                // Task section
                Row(children: [
                  const Text('Tasks', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const Spacer(),
                  Text('${_tasks.length} total', style: const TextStyle(color: ShieldTheme.textSecondary, fontSize: 13)),
                ]),
                const SizedBox(height: 12),
                if (_tasks.isEmpty)
                  const ShieldEmptyState(
                    icon: Icons.task_alt,
                    title: 'No pending tasks',
                    subtitle: 'Tasks your child completes will appear here',
                  )
                else
                  ..._tasks.map((task) {
                    final status = task['status'] as String? ?? 'PENDING';
                    final completed = status == 'APPROVED';
                    final pendingApproval = status == 'SUBMITTED';
                    final points = task['rewardPoints'] as int? ?? task['points'] as int? ?? task['rewardMinutes'] as int? ?? 0;

                    Color cardBgColor;
                    Color statusIconColor;
                    IconData statusIcon;
                    if (completed) {
                      cardBgColor = ShieldTheme.success.withOpacity(0.06);
                      statusIconColor = ShieldTheme.success;
                      statusIcon = Icons.check_circle;
                    } else if (pendingApproval) {
                      cardBgColor = ShieldTheme.primary.withOpacity(0.06);
                      statusIconColor = ShieldTheme.primary;
                      statusIcon = Icons.hourglass_top;
                    } else {
                      cardBgColor = ShieldTheme.warning.withOpacity(0.06);
                      statusIconColor = ShieldTheme.warning;
                      statusIcon = Icons.circle_outlined;
                    }

                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      color: cardBgColor,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              Icon(statusIcon, color: statusIconColor),
                              const SizedBox(width: 8),
                              Expanded(child: Text(task['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600))),
                              Chip(
                                label: Text('+$points pts', style: const TextStyle(fontSize: 11)),
                                backgroundColor: ShieldTheme.warning.withOpacity(0.1),
                                side: BorderSide.none,
                                padding: EdgeInsets.zero,
                              ),
                            ]),
                            if (task['description'] != null && (task['description'] as String).isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(left: 32, top: 4),
                                child: Text(task['description'], style: const TextStyle(fontSize: 13, color: ShieldTheme.textSecondary)),
                              ),
                            if (pendingApproval)
                              Padding(
                                padding: const EdgeInsets.only(left: 32, top: 8),
                                child: Row(children: [
                                  FilledButton.tonal(
                                    onPressed: () => _approveTask(task['id'].toString()),
                                    style: FilledButton.styleFrom(
                                      backgroundColor: ShieldTheme.success.withOpacity(0.15),
                                      foregroundColor: ShieldTheme.success,
                                    ),
                                    child: const Text('Approve'),
                                  ),
                                  const SizedBox(width: 8),
                                  OutlinedButton(
                                    onPressed: () => _rejectTask(task['id'].toString()),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: ShieldTheme.danger,
                                      side: const BorderSide(color: ShieldTheme.danger),
                                    ),
                                    child: const Text('Reject'),
                                  ),
                                ]),
                              ),
                          ],
                        ),
                      ),
                    );
                  }),

                // Achievements section
                const SizedBox(height: 24),
                Row(children: [
                  const Icon(Icons.emoji_events, color: ShieldTheme.warning, size: 20),
                  const SizedBox(width: 8),
                  const Text('Achievements', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const Spacer(),
                  Text('${_achievements.where((a) => a['earned'] == true).length}/${_achievements.length}',
                    style: const TextStyle(color: ShieldTheme.textSecondary, fontSize: 13)),
                ]),
                const SizedBox(height: 12),
                if (_achievements.isEmpty)
                  const ShieldEmptyState(
                    icon: Icons.emoji_events,
                    title: 'No achievements yet',
                    subtitle: 'Achievements will appear as your child reaches milestones',
                  )
                else
                  ..._achievements.map((a) {
                    final earned = a['earned'] == true;
                    final points = a['points'] as int? ?? 0;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      color: earned ? ShieldTheme.warning.withOpacity(0.06) : null,
                      child: ListTile(
                        leading: Icon(
                          Icons.emoji_events,
                          color: earned ? ShieldTheme.warning : ShieldTheme.divider,
                          size: 28,
                        ),
                        title: Text(a['name'] as String? ?? '',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: earned ? null : ShieldTheme.textSecondary,
                          )),
                        subtitle: Text(a['description'] as String? ?? '',
                          style: TextStyle(
                            fontSize: 12,
                            color: earned ? ShieldTheme.textSecondary : ShieldTheme.divider,
                          )),
                        trailing: earned
                          ? Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: ShieldTheme.warning.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text('+$points pts',
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: ShieldTheme.warning)),
                            )
                          : const Icon(Icons.lock_outline, color: ShieldTheme.divider, size: 18),
                      ),
                    );
                  }),
                const SizedBox(height: 80),
              ],
            ),
          ),
    );
  }
}
