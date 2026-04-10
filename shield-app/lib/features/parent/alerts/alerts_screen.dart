import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/models/alert_model.dart';
import '../../../core/widgets/common_widgets.dart';

final _alertsProvider = FutureProvider.autoDispose<List<AlertModel>>((ref) async {
  final resp = await ApiClient.instance.get(Endpoints.alerts);
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['content'] as List?
          ?? (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.map((j) => AlertModel.fromJson(j as Map<String, dynamic>)).toList();
});

class AlertsScreen extends ConsumerWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerts = ref.watch(_alertsProvider);
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Ds.surface,
      appBar: AppBar(
        title: Text('Alerts',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
      ),
      body: alerts.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load alerts',
          onRetry: () => ref.invalidate(_alertsProvider),
        ),
        data: (list) {
          if (list.isEmpty) {
            return const EmptyView(
              icon:    Icons.notifications_none_rounded,
              message: 'No alerts yet.\nYou\'ll see safety and schedule alerts here.',
            );
          }

          // Group into critical / unread / read
          final critical  = list.where((a) => a.isCritical).toList();
          final unread    = list.where((a) => !a.isCritical && !a.isRead).toList();
          final read      = list.where((a) => !a.isCritical && a.isRead).toList();

          return RefreshIndicator(
            color: cs.primary,
            onRefresh: () async => ref.invalidate(_alertsProvider),
            child: CustomScrollView(slivers: [
              if (critical.isNotEmpty) ...[
                const SliverToBoxAdapter(
                  child: SectionHeader('Critical', trailing: _CriticalBadge()),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 4),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _AlertTile(alert: critical[i]),
                      ),
                      childCount: critical.length,
                    ),
                  ),
                ),
              ],
              if (unread.isNotEmpty) ...[
                const SliverToBoxAdapter(child: SectionHeader('New')),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 4),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _AlertTile(alert: unread[i]),
                      ),
                      childCount: unread.length,
                    ),
                  ),
                ),
              ],
              if (read.isNotEmpty) ...[
                const SliverToBoxAdapter(child: SectionHeader('Earlier')),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _AlertTile(alert: read[i]),
                      ),
                      childCount: read.length,
                    ),
                  ),
                ),
              ],
            ]),
          );
        },
      ),
    );
  }
}

class _CriticalBadge extends StatelessWidget {
  const _CriticalBadge();
  @override
  Widget build(BuildContext context) =>
      const StatusChip('Needs attention', color: Ds.danger);
}

// ── Alert tile ────────────────────────────────────────────────────────────────

class _AlertTile extends StatelessWidget {
  const _AlertTile({required this.alert});
  final AlertModel alert;

  Color get _iconColor {
    if (alert.isCritical)          return Ds.danger;
    if (alert.type == 'BATTERY')   return Ds.warning;
    if (alert.type == 'GEOFENCE')  return Ds.primary;
    if (alert.type == 'SCHEDULE')  return const Color(0xFF6A1B9A);
    return Ds.info;
  }

  IconData get _icon {
    if (alert.isCritical)          return Icons.sos_rounded;
    if (alert.type == 'BATTERY')   return Icons.battery_alert_rounded;
    if (alert.type == 'GEOFENCE')  return Icons.location_on_rounded;
    if (alert.type == 'SCHEDULE')  return Icons.schedule_rounded;
    return Icons.notifications_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final cs        = Theme.of(context).colorScheme;
    final iconColor = _iconColor;
    final isRead    = alert.isRead && !alert.isCritical;

    return DecoratedBox(
      decoration: BoxDecoration(
        color:        alert.isCritical
            ? Ds.dangerContainer
            : cs.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(Ds.radiusDefault),
        boxShadow:    Ds.guardianShadow(opacity: alert.isCritical ? 0.06 : 0.04),
      ),
      child: Material(
        color:        Colors.transparent,
        borderRadius: BorderRadius.circular(Ds.radiusDefault),
        child: InkWell(
          borderRadius: BorderRadius.circular(Ds.radiusDefault),
          onTap: () {},
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              // Tonal icon container
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color:        iconColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(_icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),

              // Content
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(
                      child: Text(alert.title,
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(
                            fontWeight: isRead ? FontWeight.w500 : FontWeight.w700,
                            fontSize: 13,
                            color: alert.isCritical ? Ds.danger : cs.onSurface,
                          )),
                    ),
                    if (!isRead)
                      Container(
                        width: 6, height: 6,
                        margin: const EdgeInsets.only(left: 6),
                        decoration: BoxDecoration(
                          color: alert.isCritical ? Ds.danger : cs.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ]),
                  if (alert.childName != null) ...[
                    const SizedBox(height: 2),
                    Text(alert.childName!,
                        style: GoogleFonts.inter(
                          fontSize: 11, fontWeight: FontWeight.w600,
                          color: cs.primary,
                        )),
                  ],
                  const SizedBox(height: 3),
                  Text(alert.message,
                      maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                          fontSize: 12, color: cs.onSurfaceVariant, height: 1.4)),
                ],
              )),

              // Time — far right (asymmetric)
              Padding(
                padding: const EdgeInsets.only(left: 10),
                child: Text(
                  _formatTime(alert.createdAt),
                  style: GoogleFonts.inter(
                      fontSize: 10, fontWeight: FontWeight.w500,
                      color: cs.onSurfaceVariant),
                  textAlign: TextAlign.right,
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    if (now.difference(dt).inHours < 24) return DateFormat('HH:mm').format(dt);
    if (now.difference(dt).inDays  <  7) return DateFormat('EEE').format(dt);
    return DateFormat('d MMM').format(dt);
  }
}
