import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

// ── Provider ─────────────────────────────────────────────────────────────────

final _schedulesProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, profileId) async {
  if (profileId.isEmpty) return [];
  try {
    final res = await ref.read(dioProvider).get('/dns/schedules/$profileId');
    final raw = res.data['data'];
    final list = raw is List ? raw : (raw is Map ? (raw['content'] ?? raw['items'] ?? []) : []);
    return (list as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  } catch (_) {
    return [];
  }
});

// ── Screen ───────────────────────────────────────────────────────────────────

/// Parent-facing read-only schedule viewer.
///
/// Displays the active access schedules for a child profile — when they can
/// and cannot use the internet. A status indicator at the top shows whether
/// the child is currently in an allowed or blocked window.
class ScheduleViewerScreen extends ConsumerWidget {
  final String profileId;
  const ScheduleViewerScreen({super.key, required this.profileId});

  // ── Current-access logic ─────────────────────────────────────────────────

  /// Returns true if the current time/day falls inside ANY active schedule window.
  static bool _isCurrentlyAllowed(List<Map<String, dynamic>> schedules) {
    final now = DateTime.now();
    final dayKey = _dowKey(now.weekday);
    final nowMinutes = now.hour * 60 + now.minute;

    for (final s in schedules) {
      if ((s['active'] as bool? ?? s['enabled'] as bool? ?? true) == false) continue;

      // Check if today is covered by this schedule
      final days = s['days'] as Map<String, dynamic>? ?? s['scheduleDays'] as Map<String, dynamic>? ?? {};
      final todayCovered = days[dayKey] == true ||
          // also try LIST form: ["monday","tuesday",...]
          (s['days'] is List && (s['days'] as List).any(
              (d) => d.toString().toLowerCase() == dayKey));

      if (!todayCovered) continue;

      // Parse the time window
      final startStr = s['startTime']?.toString() ?? s['start_time']?.toString() ?? '';
      final endStr = s['endTime']?.toString() ?? s['end_time']?.toString() ?? '';
      final start = _parseMinutes(startStr);
      final end = _parseMinutes(endStr);
      if (start == null || end == null) continue;

      // blockOutside=true means ALLOW inside window, BLOCK outside
      // blockOutside=false means BLOCK inside window (e.g. bedtime blocker)
      final blockOutside = s['blockOutside'] as bool? ?? s['block_outside'] as bool? ?? true;

      final inWindow = nowMinutes >= start && nowMinutes <= end;
      if (blockOutside && inWindow) return true;
      if (!blockOutside && !inWindow) return true;
    }

    return false;
  }

  static String _dowKey(int weekday) {
    const keys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return keys[weekday - 1];
  }

  static int? _parseMinutes(String s) {
    final parts = s.split(':');
    if (parts.length < 2) return null;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    return h * 60 + m;
  }

  static String _fmtTime(String raw) {
    final mins = _parseMinutes(raw);
    if (mins == null) return raw;
    final h = mins ~/ 60;
    final m = mins % 60;
    final period = h >= 12 ? 'PM' : 'AM';
    final displayH = h > 12 ? h - 12 : (h == 0 ? 12 : h);
    return '$displayH:${m.toString().padLeft(2, '0')} $period';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedulesAsync = ref.watch(_schedulesProvider(profileId));

    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text(
          'Access Schedule',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(_schedulesProvider(profileId)),
          ),
        ],
      ),
      body: schedulesAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 2),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 5),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 5),
          ]),
        ),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off_rounded, size: 56, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              const Text('Could not load schedules',
                  style: TextStyle(color: ShieldTheme.textSecondary)),
              const SizedBox(height: 12),
              TextButton.icon(
                onPressed: () => ref.invalidate(_schedulesProvider(profileId)),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (schedules) {
          final allowed = _isCurrentlyAllowed(schedules);
          final active = schedules.where((s) =>
              (s['active'] as bool? ?? s['enabled'] as bool? ?? true) == true).toList();

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(_schedulesProvider(profileId)),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
              children: [
                // ── Current access status ──────────────────────────────
                _AccessStatusBanner(allowed: allowed),
                const SizedBox(height: 16),

                // ── Info if no schedules ───────────────────────────────
                if (schedules.isEmpty) ...[
                  _InfoCard(
                    icon: Icons.event_available_rounded,
                    title: 'No schedules configured',
                    text: 'No access schedules have been set for this profile. '
                        'Internet access is unrestricted. '
                        'Configure schedules from the dashboard.',
                    color: ShieldTheme.primary,
                  ),
                ],

                // ── Schedule cards ─────────────────────────────────────
                if (schedules.isNotEmpty) ...[
                  _SectionLabel(
                    label: '${active.length} active schedule${active.length == 1 ? '' : 's'}',
                  ),
                  const SizedBox(height: 10),
                  ...schedules.map((s) => _ScheduleCard(schedule: s, fmtTime: _fmtTime)),
                ],

                // ── Info card ──────────────────────────────────────────
                if (schedules.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  _InfoCard(
                    icon: Icons.info_outline_rounded,
                    text: 'To add, edit or remove schedules, visit the parent dashboard. '
                        'Changes take effect immediately on the child\'s device.',
                    color: ShieldTheme.textSecondary,
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _AccessStatusBanner extends StatelessWidget {
  final bool allowed;
  const _AccessStatusBanner({required this.allowed});

  @override
  Widget build(BuildContext context) {
    final color = allowed ? ShieldTheme.success : ShieldTheme.danger;
    final label = allowed ? 'ALLOWED' : 'BLOCKED';
    final icon = allowed ? Icons.check_circle_rounded : Icons.block_rounded;
    final emoji = allowed ? '✅' : '🚫';

    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color.withOpacity(0.12), color.withOpacity(0.04)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3), width: 1.5),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Current Status',
                style: TextStyle(
                  fontSize: 12,
                  color: ShieldTheme.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  Text(
                    'Internet: ',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: ShieldTheme.textPrimary,
                    ),
                  ),
                  Text(
                    '$label $emoji',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: color,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                allowed
                    ? 'Child is in an allowed access window'
                    : 'Outside all allowed access windows',
                style: const TextStyle(fontSize: 11, color: ShieldTheme.textSecondary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  final Map<String, dynamic> schedule;
  final String Function(String) fmtTime;

  const _ScheduleCard({required this.schedule, required this.fmtTime});

  static const _dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  static const _dayShort = {
    'monday': 'Mon',
    'tuesday': 'Tue',
    'wednesday': 'Wed',
    'thursday': 'Thu',
    'friday': 'Fri',
    'saturday': 'Sat',
    'sunday': 'Sun',
  };

  List<String> _activeDays() {
    final daysField = schedule['days'];
    if (daysField is Map) {
      return _dayOrder.where((d) => daysField[d] == true).toList();
    } else if (daysField is List) {
      final lowered = daysField.map((d) => d.toString().toLowerCase()).toList();
      return _dayOrder.where((d) => lowered.contains(d)).toList();
    }
    return [];
  }

  @override
  Widget build(BuildContext context) {
    final name = schedule['name']?.toString() ?? schedule['scheduleName']?.toString() ?? 'Schedule';
    final isActive = schedule['active'] as bool? ?? schedule['enabled'] as bool? ?? true;
    final startStr = schedule['startTime']?.toString() ?? schedule['start_time']?.toString() ?? '';
    final endStr = schedule['endTime']?.toString() ?? schedule['end_time']?.toString() ?? '';
    final blockOutside = schedule['blockOutside'] as bool? ?? schedule['block_outside'] as bool? ?? true;
    final activeDays = _activeDays();

    final color = isActive ? ShieldTheme.primary : ShieldTheme.textSecondary;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isActive ? ShieldTheme.divider : Colors.grey.shade200,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header row ────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.schedule_rounded, color: color, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    name,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: isActive ? ShieldTheme.textPrimary : ShieldTheme.textSecondary,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isActive
                        ? ShieldTheme.success.withOpacity(0.1)
                        : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isActive
                          ? ShieldTheme.success.withOpacity(0.3)
                          : Colors.grey.shade300,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        margin: const EdgeInsets.only(right: 5),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isActive ? ShieldTheme.success : Colors.grey,
                        ),
                      ),
                      Text(
                        isActive ? 'Active' : 'Inactive',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: isActive ? ShieldTheme.success : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),
          const Divider(height: 1, indent: 16, endIndent: 16),
          const SizedBox(height: 12),

          // ── Days chips row ────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Wrap(
              spacing: 4,
              runSpacing: 4,
              children: _dayOrder.map((day) {
                final isOn = activeDays.contains(day);
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isOn ? color.withOpacity(0.12) : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isOn ? color.withOpacity(0.4) : Colors.grey.shade200,
                    ),
                  ),
                  child: Text(
                    _dayShort[day] ?? day,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isOn ? color : Colors.grey.shade400,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 12),

          // ── Time window row ───────────────────────────────────────────
          if (startStr.isNotEmpty && endStr.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: Row(
                children: [
                  const Icon(Icons.access_time_rounded, size: 16, color: ShieldTheme.textSecondary),
                  const SizedBox(width: 8),
                  Text(
                    '${fmtTime(startStr)} – ${fmtTime(endStr)}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: ShieldTheme.textPrimary,
                    ),
                  ),
                ],
              ),
            ),

          // ── blockOutside badge ────────────────────────────────────────
          if (blockOutside)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: ShieldTheme.warning.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: ShieldTheme.warning.withOpacity(0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Icon(Icons.block_rounded, size: 13, color: ShieldTheme.warning),
                    SizedBox(width: 5),
                    Text(
                      'Blocks internet outside this window',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: ShieldTheme.warning,
                      ),
                    ),
                  ],
                ),
              ),
            ),

          const SizedBox(height: 14),
        ],
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 11,
        color: ShieldTheme.textSecondary,
        letterSpacing: 0.8,
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String? title;
  final String text;
  final Color color;

  const _InfoCard({
    required this.icon,
    required this.text,
    required this.color,
    this.title,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) ...[
                  Text(
                    title!,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: color,
                    ),
                  ),
                  const SizedBox(height: 4),
                ],
                Text(
                  text,
                  style: TextStyle(fontSize: 13, color: color, height: 1.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
