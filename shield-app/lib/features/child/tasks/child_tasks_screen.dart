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

class ChildTasksScreen extends ConsumerWidget {
  const ChildTasksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
                    onComplete: () => _complete(context, ref, t))),
              ],
              if (submitted.isNotEmpty) ...[
                _SectionLabel('Waiting for Approval',
                    color: const Color(0xFFFFB300)),
                ...submitted.map((t) => _TaskTile(task: t, onComplete: null)),
              ],
              if (completed.isNotEmpty) ...[
                _SectionLabel('Completed', color: const Color(0xFF4CAF50)),
                ...completed.map((t) => _TaskTile(task: t, onComplete: null)),
              ],
              if (rejected.isNotEmpty) ...[
                _SectionLabel('Needs Redo', color: const Color(0xFFEF5350)),
                ...rejected.map((t) => _TaskTile(
                    task: t,
                    onComplete: () => _complete(context, ref, t))),
              ],
            ],
            ),
          );
        },
      ),
    );
  }

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
            content: Text('Task complete! +${task['points'] ?? 0} points',
                style: GoogleFonts.inter(
                    color: Colors.white, fontWeight: FontWeight.w600)),
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
  const _TaskTile({required this.task, required this.onComplete});
  final Map<String, dynamic> task;
  final VoidCallback? onComplete;

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
                onTap:        onComplete,
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
                      Container(
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
                                color: Colors.white, fontSize: 12,
                                fontWeight: FontWeight.w700)),
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
