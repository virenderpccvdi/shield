import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/common_widgets.dart';

// ── Providers ─────────────────────────────────────────────────────────────────

final _childrenForReportProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  try {
    final resp = await ApiClient.instance.get(Endpoints.children);
    final raw = resp.data is List
        ? resp.data as List
        : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
    return raw.cast<Map<String, dynamic>>();
  } catch (_) {
    return [];
  }
});

final _childOverviewProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, profileId) async {
  try {
    final resp = await ApiClient.instance
        .get(Endpoints.customerOverview(profileId));
    return resp.data is Map<String, dynamic>
        ? resp.data as Map<String, dynamic>
        : <String, dynamic>{};
  } catch (_) {
    return <String, dynamic>{};
  }
});

final _browsingHistoryProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, profileId) async {
  try {
    final resp = await ApiClient.instance.get(
        Endpoints.browsingHistory(profileId),
        params: {'limit': '10'});
    final raw = resp.data is List
        ? resp.data as List
        : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
    return raw.cast<Map<String, dynamic>>();
  } catch (_) {
    return [];
  }
});

final _appUsageProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, profileId) async {
  try {
    final resp = await ApiClient.instance
        .get(Endpoints.appUsage(profileId), params: {'limit': '5'});
    final raw = resp.data is List
        ? resp.data as List
        : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
    return raw.cast<Map<String, dynamic>>();
  } catch (_) {
    return [];
  }
});

// ── Screen ────────────────────────────────────────────────────────────────────

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});
  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  String? _selectedChildId;

  @override
  Widget build(BuildContext context) {
    final childrenAsync = ref.watch(_childrenForReportProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      body: childrenAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => ErrorView(
          message: 'Failed to load children',
          onRetry: () => ref.invalidate(_childrenForReportProvider),
        ),
        data: (children) {
          if (children.isEmpty) {
            return const EmptyView(
              icon:    Icons.bar_chart,
              message: 'Add a child profile to see reports',
            );
          }

          // Auto-select first child
          final selectedId =
              _selectedChildId ?? children.first['id'].toString();

          return Column(children: [
            // Child selector
            _ChildSelector(
              children:   children,
              selectedId: selectedId,
              onSelect:   (id) => setState(() => _selectedChildId = id),
            ),

            // Report content
            Expanded(
              child: _ChildReport(profileId: selectedId),
            ),
          ]);
        },
      ),
    );
  }
}

// ── Child selector ────────────────────────────────────────────────────────────

class _ChildSelector extends StatelessWidget {
  const _ChildSelector({
    required this.children,
    required this.selectedId,
    required this.onSelect,
  });
  final List<Map<String, dynamic>> children;
  final String    selectedId;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 54,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? ShieldTheme.cardDark
            : Colors.white,
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 4,
              offset: const Offset(0, 2)),
        ],
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount:       children.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final c    = children[i];
          final id   = c['id'].toString();
          final name = c['name']?.toString() ?? 'Child';
          final sel  = id == selectedId;

          return GestureDetector(
            onTap: () => onSelect(id),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: sel
                    ? ShieldTheme.primary
                    : ShieldTheme.primary.withOpacity(0.08),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(name,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: sel
                          ? Colors.white
                          : ShieldTheme.primary)),
            ),
          );
        },
      ),
    );
  }
}

// ── Child report ──────────────────────────────────────────────────────────────

class _ChildReport extends ConsumerWidget {
  const _ChildReport({required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewAsync  = ref.watch(_childOverviewProvider(profileId));
    final browsingAsync  = ref.watch(_browsingHistoryProvider(profileId));
    final appUsageAsync  = ref.watch(_appUsageProvider(profileId));

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(_childOverviewProvider(profileId));
        ref.invalidate(_browsingHistoryProvider(profileId));
        ref.invalidate(_appUsageProvider(profileId));
      },
      child: ListView(padding: const EdgeInsets.all(16), children: [
        // KPI cards
        overviewAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error:   (_, __) => const SizedBox.shrink(),
          data: (d) => _KpiGrid(data: d),
        ),

        const SizedBox(height: 16),

        // Browsing history
        const _SectionLabel('Recent Browsing'),
        const SizedBox(height: 8),
        browsingAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error:   (_, __) => const SizedBox.shrink(),
          data: (rows) {
            if (rows.isEmpty) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: EmptyView(
                    icon: Icons.history, message: 'No browsing history yet'),
              );
            }
            return _BrowsingCard(rows: rows);
          },
        ),

        const SizedBox(height: 16),

        // App usage
        const _SectionLabel('App Usage (Today)'),
        const SizedBox(height: 8),
        appUsageAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error:   (_, __) => const SizedBox.shrink(),
          data: (rows) {
            if (rows.isEmpty) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: EmptyView(
                    icon: Icons.apps, message: 'No app usage data yet'),
              );
            }
            return _AppUsageCard(rows: rows);
          },
        ),
      ]),
    );
  }
}

// ── KPI grid ─────────────────────────────────────────────────────────────────

class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final items = [
      _Kpi('Blocked Today',    _fmt(data['blockedToday']),
          Icons.block,            ShieldTheme.danger),
      _Kpi('Total Requests',   _fmt(data['totalRequests']),
          Icons.wifi,             ShieldTheme.primary),
      _Kpi('Screen Time',      _fmtTime(data['screenTimeMinutes']),
          Icons.access_time,      ShieldTheme.warning),
      _Kpi('Apps Used',        _fmt(data['appsUsed']),
          Icons.apps,             ShieldTheme.success),
    ];

    return GridView.count(
      crossAxisCount:   2,
      shrinkWrap:       true,
      physics:          const NeverScrollableScrollPhysics(),
      mainAxisSpacing:  10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.8,
      children: items.map((k) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color:        isDark ? ShieldTheme.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: isDark ? Border.all(color: Colors.white12) : null,
          boxShadow: isDark ? null : [
            BoxShadow(color: Colors.black.withOpacity(0.05),
                blurRadius: 6, offset: const Offset(0, 2)),
          ],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
          Icon(k.icon, color: k.color, size: 18),
          const SizedBox(height: 6),
          Text(k.value, style: TextStyle(
              fontSize: 20, fontWeight: FontWeight.w700, color: k.color)),
          Text(k.label, style: TextStyle(
              fontSize: 10,
              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5))),
        ]),
      )).toList(),
    );
  }

  String _fmt(dynamic v) {
    if (v == null) return '0';
    return v.toString();
  }

  String _fmtTime(dynamic v) {
    if (v == null) return '0m';
    final mins = (v as num).toInt();
    if (mins >= 60) return '${mins ~/ 60}h ${mins % 60}m';
    return '${mins}m';
  }
}

class _Kpi {
  const _Kpi(this.label, this.value, this.icon, this.color);
  final String label, value;
  final IconData icon;
  final Color color;
}

// ── Browsing card ─────────────────────────────────────────────────────────────

class _BrowsingCard extends StatelessWidget {
  const _BrowsingCard({required this.rows});
  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color:        isDark ? ShieldTheme.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: isDark ? Border.all(color: Colors.white12) : null,
        boxShadow: isDark ? null : [
          BoxShadow(color: Colors.black.withOpacity(0.05),
              blurRadius: 6, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        children: rows.take(10).map((r) {
          final domain  = r['domain']?.toString()  ?? r['url']?.toString() ?? '—';
          final blocked = r['blocked'] as bool?    ?? false;
          final count   = r['count']  as int?      ?? 1;
          return ListTile(
            dense: true,
            leading: Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: (blocked ? ShieldTheme.danger : ShieldTheme.success)
                    .withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                blocked ? Icons.block : Icons.check_circle_outline,
                size: 16,
                color: blocked ? ShieldTheme.danger : ShieldTheme.success,
              ),
            ),
            title: Text(domain,
                style: const TextStyle(fontSize: 13),
                overflow: TextOverflow.ellipsis),
            trailing: Text('×$count',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
          );
        }).toList(),
      ),
    );
  }
}

// ── App usage card ────────────────────────────────────────────────────────────

class _AppUsageCard extends StatelessWidget {
  const _AppUsageCard({required this.rows});
  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final total = rows.fold<int>(
        0, (s, r) => s + ((r['usageMinutes'] as num?)?.toInt() ?? 0));

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color:        isDark ? ShieldTheme.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: isDark ? Border.all(color: Colors.white12) : null,
        boxShadow: isDark ? null : [
          BoxShadow(color: Colors.black.withOpacity(0.05),
              blurRadius: 6, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        children: rows.asMap().entries.map((e) {
          final r       = e.value;
          final name    = r['appName']?.toString()         ?? 'Unknown';
          final mins    = (r['usageMinutes'] as num?)?.toInt() ?? 0;
          final pct     = total > 0 ? mins / total : 0.0;
          final color   =
              ShieldTheme.chartPalette[e.key % ShieldTheme.chartPalette.length];

          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start,
                children: [
              Row(children: [
                Container(
                    width: 10, height: 10,
                    decoration:
                        BoxDecoration(color: color, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Expanded(child: Text(name,
                    style: const TextStyle(fontSize: 13),
                    overflow: TextOverflow.ellipsis)),
                Text(
                  mins >= 60
                      ? '${mins ~/ 60}h ${mins % 60}m'
                      : '${mins}m',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                ),
              ]),
              const SizedBox(height: 4),
              LinearProgressIndicator(
                value:            pct,
                color:            color,
                backgroundColor:  color.withOpacity(0.12),
                borderRadius:     BorderRadius.circular(4),
                minHeight:        6,
              ),
            ]),
          );
        }).toList(),
      ),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Text(label,
      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700));
}
