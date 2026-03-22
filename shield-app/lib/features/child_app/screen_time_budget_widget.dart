import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:async';
import '../../core/api_client.dart';
import '../../app/theme.dart';

/// Riverpod provider — fetches app-level daily screen time budgets for a
/// profile.  Returns the raw list from the /dns/app-budgets/{profileId}
/// endpoint, or an empty list on error.
final _screenTimeBudgetProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>(
  (ref, profileId) async {
    if (profileId.isEmpty) return [];
    final client = ref.read(dioProvider);
    final res = await client.get('/dns/app-budgets/$profileId');
    final raw = res.data['data'];
    final list = raw is List ? raw : [];
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  },
);

/// CS-11: Daily Screen Time Limit Display
///
/// Shows the child a progress bar of how much screen time has been used today
/// versus their daily limit.  Refreshes automatically every 5 minutes.
///
/// Placement: inserted in the [ChildAppScreen] SliverList between the
/// "Request More Screen Time" card and the Tasks card.
class ScreenTimeBudgetWidget extends ConsumerStatefulWidget {
  final String profileId;
  const ScreenTimeBudgetWidget({super.key, required this.profileId});

  @override
  ConsumerState<ScreenTimeBudgetWidget> createState() =>
      _ScreenTimeBudgetWidgetState();
}

class _ScreenTimeBudgetWidgetState
    extends ConsumerState<ScreenTimeBudgetWidget> {
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    // Auto-refresh every 5 minutes to keep the display current.
    _refreshTimer = Timer.periodic(const Duration(minutes: 5), (_) {
      if (mounted) {
        ref.invalidate(_screenTimeBudgetProvider(widget.profileId));
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final budgetAsync =
        ref.watch(_screenTimeBudgetProvider(widget.profileId));

    return budgetAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (budgets) {
        if (budgets.isEmpty) return const SizedBox.shrink();

        // Sum all per-app budgets to get the total daily allowance.
        final totalMin = budgets.fold<int>(
            0, (sum, b) => sum + ((b['dailyLimitMin'] as num?)?.toInt() ?? 0));
        final usedMin = budgets.fold<int>(
            0, (sum, b) => sum + ((b['usedTodayMin'] as num?)?.toInt() ?? 0));

        if (totalMin <= 0) return const SizedBox.shrink();

        final remainingMin = (totalMin - usedMin).clamp(0, totalMin);
        final fraction = (usedMin / totalMin).clamp(0.0, 1.0);

        final Color barColor = fraction > 0.8
            ? ShieldTheme.danger
            : fraction > 0.5
                ? ShieldTheme.warning
                : ShieldTheme.success;

        final colorScheme = Theme.of(context).colorScheme;
        final theme = Theme.of(context);

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colorScheme.surface,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 3))
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: barColor.withOpacity(0.10),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.timer_rounded,
                        color: barColor, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Screen Time Today',
                      style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: colorScheme.onSurface),
                    ),
                  ),
                  // Remaining time badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: barColor.withOpacity(0.10),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: barColor.withOpacity(0.25), width: 1),
                    ),
                    child: Text(
                      '$remainingMin min left',
                      style: TextStyle(
                          color: barColor,
                          fontWeight: FontWeight.w700,
                          fontSize: 12),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Progress bar
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: fraction,
                  minHeight: 10,
                  backgroundColor: barColor.withOpacity(0.15),
                  valueColor: AlwaysStoppedAnimation<Color>(barColor),
                ),
              ),
              const SizedBox(height: 6),
              // Caption
              Text(
                '$usedMin of $totalMin minutes used',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: colorScheme.onSurface.withOpacity(0.55)),
              ),
              // Warning hint when close to limit
              if (fraction >= 0.8) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: barColor.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        fraction >= 1.0
                            ? Icons.timer_off_rounded
                            : Icons.warning_amber_rounded,
                        color: barColor,
                        size: 14,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        fraction >= 1.0
                            ? 'Daily limit reached'
                            : 'Almost at your daily limit!',
                        style: TextStyle(
                            color: barColor,
                            fontWeight: FontWeight.w600,
                            fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
