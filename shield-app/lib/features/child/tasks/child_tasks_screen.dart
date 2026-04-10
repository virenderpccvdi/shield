import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/theme.dart';
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

class ChildTasksScreen extends ConsumerStatefulWidget {
  const ChildTasksScreen({super.key});
  @override
  ConsumerState<ChildTasksScreen> createState() => _ChildTasksScreenState();
}

class _ChildTasksScreenState extends ConsumerState<ChildTasksScreen> {
  @override
  Widget build(BuildContext context) {
    final tasks = ref.watch(_childTasksProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor: const Color(0xFF003D72),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text('My Tasks',
            style: GoogleFonts.manrope(
                color: Colors.white, fontWeight: FontWeight.w700, fontSize: 18)),
        leading: IconButton(
          icon:      const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: tasks.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: Colors.white)),
        error: (e, _) => Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color:        Colors.white.withOpacity(0.10),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.error_outline_rounded,
                  color: Colors.white70, size: 40),
            ),
            const SizedBox(height: 16),
            Text('Could not load tasks',
                style: GoogleFonts.inter(color: Colors.white70, fontSize: 14)),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => ref.invalidate(_childTasksProvider),
              child: Text('Try Again',
                  style: GoogleFonts.inter(
                      color: Colors.white, fontWeight: FontWeight.w600)),
            ),
          ]),
        ),
        data: (list) {
          if (list.isEmpty) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color:        Colors.white.withOpacity(0.10),
                  shape:        BoxShape.circle,
                ),
                child: const Icon(Icons.task_alt_rounded,
                    color: Colors.white60, size: 48),
              ),
              const SizedBox(height: 16),
              Text('No tasks yet!',
                  style: GoogleFonts.manrope(
                      color: Colors.white, fontSize: 18,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text('Your parent will assign tasks here.',
                  style: GoogleFonts.inter(
                      color: Colors.white.withOpacity(0.55), fontSize: 13)),
            ]));
          }

          final pending   = list.where((t) => t['status'] == 'PENDING').toList();
          final submitted = list.where((t) => t['status'] == 'SUBMITTED').toList();
          final completed = list.where((t) => t['status'] == 'APPROVED').toList();
          final rejected  = list.where((t) => t['status'] == 'REJECTED').toList();

          return RefreshIndicator(
            color: Colors.white,
            backgroundColor: const Color(0xFF003D72),
            onRefresh: () async {
              ref.invalidate(_childTasksProvider);
              await ref.read(_childTasksProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 100, 24, 32),
              children: [
              // Progress summary
              _TaskProgressCard(
                total:    list.length,
                done:     completed.length,
                pending:  pending.length + submitted.length,
              ),
              const SizedBox(height: 20),

              if (pending.isNotEmpty) ...[
                _SectionLabel('To Do', color: Colors.white),
                ...pending.map((t) => _TaskTile(
                    task: t,
                    onTap: () => _showTaskDetail(context, t),
                    onComplete: () => _complete(context, ref, t))),
              ],
              if (submitted.isNotEmpty) ...[
                _SectionLabel('Waiting for Approval',
                    color: const Color(0xFFFFB300)),
                ...submitted.map((t) => _TaskTile(
                    task: t,
                    onTap: () => _showTaskDetail(context, t),
                    onComplete: null)),
              ],
              if (completed.isNotEmpty) ...[
                _SectionLabel('Completed', color: const Color(0xFF4CAF50)),
                ...completed.map((t) => _TaskTile(
                    task: t,
                    onTap: () => _showTaskDetail(context, t),
                    onComplete: null)),
              ],
              if (rejected.isNotEmpty) ...[
                _SectionLabel('Needs Redo', color: const Color(0xFFEF5350)),
                ...rejected.map((t) => _TaskTile(
                    task: t,
                    onTap: () => _showTaskDetail(context, t),
                    onComplete: () => _complete(context, ref, t))),
              ],
            ],
            ),
          );
        },
      ),
    );
  }

  // FL11: Task detail bottom sheet
  void _showTaskDetail(BuildContext context, Map<String, dynamic> task) {
    final title       = task['title']?.toString() ?? '';
    final description = task['description']?.toString();
    final points      = task['points'] ?? 0;
    final dueDate     = task['dueDate']?.toString();

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0D2137),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Ds.radiusChild)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                width: 40, height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(title,
                style: GoogleFonts.manrope(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Colors.white)),
            if (description != null && description.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(description,
                  style: GoogleFonts.inter(
                      color: Colors.white.withOpacity(0.65),
                      fontSize: 14,
                      height: 1.5)),
            ],
            const SizedBox(height: 18),
            Wrap(spacing: 8, runSpacing: 8, children: [
              _InfoChip(
                  Icons.star_rounded, '+$points pts', const Color(0xFFFFB300)),
              if (dueDate != null && dueDate.isNotEmpty)
                _InfoChip(
                    Icons.calendar_today_rounded, dueDate, Ds.info),
            ]),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  // FL12: Complete with undo snack bar
  void _complete(BuildContext context, WidgetRef ref,
      Map<String, dynamic> task) async {
    final pid    = ref.read(authProvider).childProfileId ?? '';
    final taskId = task['id']?.toString() ?? '';
    try {
      await ApiClient.instance.post(Endpoints.taskComplete(pid, taskId));
      ref.invalidate(_childTasksProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Task completed! +${task['points'] ?? 0} pts',
                style: GoogleFonts.inter(
                    color: Colors.white, fontWeight: FontWeight.w600)),
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: 'Undo',
              textColor: Colors.white,
              onPressed: () => _uncomplete(context, ref, taskId),
            ),
            backgroundColor: const Color(0xFF2E7D32),
          ),
        );
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to complete task — please try again',
                style: GoogleFonts.inter(color: Colors.white)),
          ),
        );
      }
    }
  }

  // FL12: Undo task completion — revert to PENDING
  Future<void> _uncomplete(
      BuildContext context, WidgetRef ref, String taskId) async {
    try {
      // PUT /rewards/tasks/{id} with status reset to PENDING
      await ApiClient.instance.put(
        '/rewards/tasks/$taskId',
        data: {'status': 'PENDING'},
      );
      ref.invalidate(_childTasksProvider);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not undo — please contact parent',
                style: GoogleFonts.inter(color: Colors.white)),
          ),
        );
      }
    }
  }
}

// ── Info chip used in task detail sheet ───────────────────────────────────────

class _InfoChip extends StatelessWidget {
  const _InfoChip(this.icon, this.label, this.color);
  final IconData icon;
  final String   label;
  final Color    color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color:        color.withOpacity(0.15),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 5),
          Text(label,
              style: GoogleFonts.inter(
                  fontSize: 12, fontWeight: FontWeight.w600, color: color)),
        ]),
      );
}

// ── Progress card ─────────────────────────────────────────────────────────────

class _TaskProgressCard extends StatelessWidget {
  const _TaskProgressCard({
    required this.total,
    required this.done,
    required this.pending,
  });
  final int total, done, pending;

  @override
  Widget build(BuildContext context) {
    final progress = total == 0 ? 0.0 : done / total;
    return ClipRRect(
      borderRadius: BorderRadius.circular(Ds.radiusChild),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color:        Colors.white.withOpacity(0.10),
            borderRadius: BorderRadius.circular(Ds.radiusChild),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('$done of $total tasks done',
                      style: GoogleFonts.manrope(
                          color: Colors.white, fontSize: 18,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text('$pending remaining',
                      style: GoogleFonts.inter(
                          color: Colors.white.withOpacity(0.55), fontSize: 12)),
                ]),
              ),
              Text('${(progress * 100).round()}%',
                  style: GoogleFonts.manrope(
                      color: const Color(0xFF4CAF50),
                      fontSize: 28, fontWeight: FontWeight.w800)),
            ]),
            const SizedBox(height: 14),
            GuardianProgressBar(
              value:  progress,
              height: 8,
              color:  const Color(0xFF4CAF50),
            ),
          ]),
        ),
      ),
    );
  }
}

// ── Section label ─────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text, {required this.color});
  final String text;
  final Color  color;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(4, 16, 0, 8),
    child: Text(
      text.toUpperCase(),
      style: GoogleFonts.inter(
          fontSize: 11, fontWeight: FontWeight.w700,
          letterSpacing: 0.8, color: color.withOpacity(0.75)),
    ),
  );
}

// ── Task tile ─────────────────────────────────────────────────────────────────

class _TaskTile extends StatelessWidget {
  const _TaskTile({
    required this.task,
    required this.onComplete,
    this.onTap,
  });
  final Map<String, dynamic> task;
  final VoidCallback? onComplete;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final status    = task['status']?.toString() ?? 'PENDING';
    final isDone    = status == 'APPROVED';
    final isWaiting = status == 'SUBMITTED';
    final isRejected = status == 'REJECTED';
    final points    = task['points'] ?? 0;

    final (Color statusColor, IconData statusIcon) = isDone
        ? (const Color(0xFF4CAF50), Icons.check_circle_rounded)
        : isWaiting
            ? (const Color(0xFFFFB300), Icons.hourglass_top_rounded)
            : isRejected
                ? (const Color(0xFFEF5350), Icons.cancel_rounded)
                : (Colors.white, Icons.radio_button_unchecked_rounded);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Ds.radiusChild),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: Container(
            decoration: BoxDecoration(
              color:        Colors.white.withOpacity(isDone ? 0.06 : 0.11),
              borderRadius: BorderRadius.circular(Ds.radiusChild),
            ),
            child: Material(
              color:        Colors.transparent,
              borderRadius: BorderRadius.circular(Ds.radiusChild),
              child: InkWell(
                borderRadius: BorderRadius.circular(Ds.radiusChild),
                splashColor:  Colors.white.withOpacity(0.05),
                // FL11: show detail on tap anywhere; onComplete only on "Done" button
                onTap: onTap,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(children: [
                    Icon(statusIcon, color: statusColor, size: 22),
                    const SizedBox(width: 12),

                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(task['title']?.toString() ?? '',
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w600, fontSize: 14,
                              color: isDone
                                  ? Colors.white.withOpacity(0.45)
                                  : Colors.white,
                              decoration: isDone
                                  ? TextDecoration.lineThrough : null,
                              decorationColor: Colors.white38,
                            )),
                        const SizedBox(height: 4),
                        Row(children: [
                          const Icon(Icons.star_rounded,
                              color: Color(0xFFFFB300), size: 12),
                          const SizedBox(width: 3),
                          Text('$points points',
                              style: GoogleFonts.inter(
                                  fontSize: 11,
                                  color: isDone
                                      ? Colors.white.withOpacity(0.35)
                                      : const Color(0xFFFFB300),
                                  fontWeight: FontWeight.w600)),
                        ]),
                      ],
                    )),

                    if (onComplete != null)
                      GestureDetector(
                        onTap: onComplete,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 7),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF43A047), Color(0xFF2E7D32)],
                            ),
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text('Done',
                              style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
