import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/models/alert_model.dart';
import '../../../core/widgets/common_widgets.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Notifications / Alerts centre — full list, grouped by day, mark-as-read.
// ─────────────────────────────────────────────────────────────────────────────

final _notifProvider = FutureProvider.autoDispose<List<AlertModel>>((ref) async {
  final resp = await ApiClient.instance.get(
      Endpoints.alerts, params: {'limit': '100'});
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['content'] as List?
          ?? (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw
      .map((j) => AlertModel.fromJson(j as Map<String, dynamic>))
      .toList()
    ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
});

// Unread badge count exposed to the shell
final unreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final alerts = await ref.watch(_notifProvider.future);
  return alerts.where((a) => !a.isRead).length;
});

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});
  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  // FL17: All / Unread filter
  bool _showUnreadOnly = false;

  Future<void> _markAllRead() async {
    try {
      await ApiClient.instance.post(Endpoints.markAllRead);
      ref.invalidate(_notifProvider);
    } catch (_) {}
  }

  /// Interleave day-header strings with AlertModel objects.
  List<dynamic> _groupByDay(List<AlertModel> alerts) {
    final result = <dynamic>[];
    String? lastDay;
    for (final a in alerts) {
      final day = _dayLabel(a.createdAt);
      if (day != lastDay) {
        result.add(day);
        lastDay = day;
      }
      result.add(a);
    }
    return result;
  }

  String _dayLabel(DateTime dt) {
    final now   = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d     = DateTime(dt.year, dt.month, dt.day);
    if (d == today) return 'Today';
    if (d == today.subtract(const Duration(days: 1))) return 'Yesterday';
    return DateFormat('EEEE, d MMM').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_notifProvider);
    final cs    = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Ds.surface,
      appBar: AppBar(
        backgroundColor: Ds.surface,
        title: Text('Notifications',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
        actions: [
          TextButton(
            onPressed: _markAllRead,
            child: Text('Mark all read',
                style: GoogleFonts.inter(
                    color: cs.onSurface.withOpacity(0.55), fontSize: 13)),
          ),
        ],
      ),
      body: Column(children: [
        // FL17: All / Unread segmented toggle
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
          child: Row(children: [
            _FilterChip(
              label: 'All',
              selected: !_showUnreadOnly,
              onTap: () => setState(() => _showUnreadOnly = false),
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Unread',
              selected: _showUnreadOnly,
              onTap: () => setState(() => _showUnreadOnly = true),
              badge: async.valueOrNull
                  ?.where((a) => !a.isRead)
                  .length,
            ),
          ]),
        ),

        Expanded(
          child: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => ErrorView(
              message: 'Failed to load notifications',
              onRetry: () => ref.invalidate(_notifProvider),
            ),
            data: (list) {
              final filtered = _showUnreadOnly
                  ? list.where((a) => !a.isRead).toList()
                  : list;

              if (filtered.isEmpty) {
                return EmptyView(
                  icon: Icons.notifications_none,
                  message: _showUnreadOnly
                      ? 'All caught up! No unread notifications.'
                      : 'No notifications yet.\n'
                        'Alerts for location, schedule, and safety appear here.',
                );
              }
              final grouped = _groupByDay(filtered);
              return RefreshIndicator(
                color: Ds.primary,
                onRefresh: () async => ref.invalidate(_notifProvider),
                child: ListView.builder(
                  itemCount: grouped.length,
                  itemBuilder: (_, i) {
                    final entry = grouped[i];
                    if (entry is String) {
                      return _DayHeader(label: entry);
                    }
                    final alert = entry as AlertModel;
                    return _NotifTile(
                      alert: alert,
                      onRead: () async {
                        try {
                          await ApiClient.instance
                              .post(Endpoints.markRead(alert.id));
                          ref.invalidate(_notifProvider);
                        } catch (_) {}
                      },
                    );
                  },
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}

// ── Filter chip ───────────────────────────────────────────────────────────────

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge,
  });
  final String   label;
  final bool     selected;
  final VoidCallback onTap;
  final int?     badge;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? Ds.primary : Ds.surfaceContainerLow,
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : cs.onSurface,
            ),
          ),
          if (badge != null && badge! > 0) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color:        selected
                    ? Colors.white.withOpacity(0.25)
                    : Ds.danger,
                borderRadius: BorderRadius.circular(99),
              ),
              child: Text(
                '$badge',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}

// ── Day header ────────────────────────────────────────────────────────────────

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 20, 20, 6),
    child: Text(label,
        style: TextStyle(
          fontSize: 12, fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
          color: Theme.of(context).colorScheme.primary.withOpacity(0.8),
        )),
  );
}

// ── Notification tile ─────────────────────────────────────────────────────────

class _NotifTile extends StatelessWidget {
  const _NotifTile({required this.alert, required this.onRead});
  final AlertModel  alert;
  final VoidCallback onRead;

  Color get _color {
    if (alert.isCritical)          return Colors.red;
    if (alert.type == 'BATTERY')   return const Color(0xFFC2410C);
    if (alert.type == 'GEOFENCE')  return Colors.blue;
    if (alert.type == 'SCHEDULE')  return Colors.teal;
    return Colors.grey;
  }

  IconData get _icon {
    if (alert.isCritical)          return Icons.sos;
    if (alert.type == 'BATTERY')   return Icons.battery_alert;
    if (alert.type == 'GEOFENCE')  return Icons.location_on;
    if (alert.type == 'SCHEDULE')  return Icons.schedule;
    if (alert.type == 'CONTENT')   return Icons.block;
    return Icons.notifications;
  }

  @override
  Widget build(BuildContext context) {
    final theme   = Theme.of(context);
    final isDark  = theme.brightness == Brightness.dark;
    final unread  = !alert.isRead;

    return InkWell(
      onTap: unread ? onRead : null,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
        decoration: BoxDecoration(
          color: unread
              ? _color.withOpacity(isDark ? 0.08 : 0.04)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          border: unread
              ? Border.all(color: _color.withOpacity(0.2))
              : null,
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Icon badge
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: _color.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(_icon, color: _color, size: 20),
            ),
            const SizedBox(width: 12),

            // Content
            Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: Text(alert.title,
                      style: TextStyle(
                        fontWeight: unread
                            ? FontWeight.w600 : FontWeight.w500,
                        fontSize: 14,
                      )),
                ),
                Text(
                  _timeLabel(alert.createdAt),
                  style: TextStyle(
                      fontSize: 11,
                      color: theme.colorScheme.onSurface.withOpacity(0.45)),
                ),
              ]),
              if (alert.childName != null) ...[
                const SizedBox(height: 2),
                Text(alert.childName!,
                    style: TextStyle(
                        fontSize: 12,
                        color: theme.colorScheme.primary,
                        fontWeight: FontWeight.w500)),
              ],
              const SizedBox(height: 4),
              Text(alert.message,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 13,
                      color: theme.colorScheme.onSurface.withOpacity(0.65))),
            ])),

            if (unread) ...[
              const SizedBox(width: 8),
              Container(
                width: 8, height: 8,
                decoration: BoxDecoration(color: _color, shape: BoxShape.circle),
              ),
            ],
          ]),
        ),
      ),
    );
  }

  String _timeLabel(DateTime dt) {
    final now = DateTime.now();
    if (now.difference(dt).inMinutes < 60) {
      return '${now.difference(dt).inMinutes}m ago';
    }
    if (now.difference(dt).inHours < 24) {
      return DateFormat('HH:mm').format(dt);
    }
    return DateFormat('d MMM').format(dt);
  }
}
