import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class BrowsingHistoryScreen extends ConsumerStatefulWidget {
  final String profileId;
  const BrowsingHistoryScreen({super.key, required this.profileId});
  @override
  ConsumerState<BrowsingHistoryScreen> createState() => _BrowsingHistoryScreenState();
}

class _BrowsingHistoryScreenState extends ConsumerState<BrowsingHistoryScreen> {
  List<Map<String, dynamic>> _entries = [];
  bool _loading = true;
  String _filter = 'ALL'; // ALL, BLOCKED, ALLOWED

  int _totalToday = 0;
  int _blockedToday = 0;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);

      // Build query params for history endpoint
      final params = <String, dynamic>{
        'page': 0,
        'size': 100,
        'period': 'TODAY',
      };
      if (_filter == 'BLOCKED' || _filter == 'ALLOWED') {
        params['blockedOnly'] = _filter == 'BLOCKED' ? 'true' : 'false';
      }

      // Fetch history and stats in parallel
      final results = await Future.wait([
        client.get('/dns/history/${widget.profileId}', queryParameters: params),
        client.get('/dns/history/${widget.profileId}/stats').catchError((_) => null),
      ]);

      // Parse paginated history response
      final res = results[0];
      final data = res.data['data'] ?? res.data;
      final content = (data is Map ? (data['content'] ?? []) : (data is List ? data : [])) as List;

      final entries = content.map<Map<String, dynamic>>((e) {
        if (e is! Map) return {};
        final m = Map<String, dynamic>.from(e);
        // Map wasBlocked boolean to action string
        final wasBlocked = m['wasBlocked'] == true;
        m['action'] = wasBlocked ? 'BLOCKED' : 'ALLOWED';
        return m;
      }).toList();

      // Parse stats response
      int totalToday = 0;
      int blockedToday = 0;
      final statsRes = results[1];
      if (statsRes != null) {
        final stats = statsRes.data['data'] ?? statsRes.data;
        if (stats is Map) {
          totalToday = stats['totalToday'] as int? ?? 0;
          blockedToday = stats['blockedToday'] as int? ?? 0;
        }
      }

      setState(() {
        _entries = entries;
        _totalToday = totalToday;
        _blockedToday = blockedToday;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
      debugPrint('Browsing history error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final blockRate = _totalToday > 0
        ? ((_blockedToday / _totalToday) * 100).toStringAsFixed(1)
        : '0.0';

    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('Browsing History', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: Column(children: [
        // Stats summary chips
        if (!_loading && _totalToday > 0)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Row(children: [
              _StatChip(
                icon: Icons.dns,
                label: '$_totalToday queries',
                color: ShieldTheme.primary,
              ),
              const SizedBox(width: 8),
              _StatChip(
                icon: Icons.block,
                label: '$_blockedToday blocked',
                color: ShieldTheme.dangerLight,
              ),
              const SizedBox(width: 8),
              _StatChip(
                icon: Icons.shield,
                label: '$blockRate% blocked',
                color: ShieldTheme.warning,
              ),
            ]),
          ),
        // Filter chips
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: Row(children: [
            for (final f in ['ALL', 'BLOCKED', 'ALLOWED'])
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(f[0] + f.substring(1).toLowerCase()),
                  selected: _filter == f,
                  onSelected: (_) { setState(() => _filter = f); _load(); },
                  selectedColor: f == 'BLOCKED' ? ShieldTheme.dangerLight.withOpacity(0.2) : ShieldTheme.success.withOpacity(0.2),
                ),
              ),
          ]),
        ),
        Expanded(
          child: _loading
              ? const Padding(padding: EdgeInsets.all(16), child: ShieldCardSkeleton(lines: 6))
              : _entries.isEmpty
                  ? const ShieldEmptyState(icon: Icons.history, title: 'No browsing data yet')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        itemCount: _entries.length,
                        itemBuilder: (_, i) {
                          final e = _entries[i];
                          final domain = e['domain']?.toString() ?? '—';
                          final action = e['action']?.toString() ?? 'ALLOWED';
                          final blocked = action == 'BLOCKED';
                          final time = e['queriedAt']?.toString() ?? e['time']?.toString() ?? '';
                          final category = e['category']?.toString() ?? '';
                          return Container(
                            margin: const EdgeInsets.only(bottom: 4),
                            decoration: BoxDecoration(
                              color: ShieldTheme.cardBg,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: blocked ? ShieldTheme.dangerLight.withOpacity(0.3) : ShieldTheme.divider),
                            ),
                            child: ListTile(
                              dense: true,
                              leading: Icon(
                                blocked ? Icons.block : Icons.check_circle_outline,
                                color: blocked ? ShieldTheme.dangerLight : ShieldTheme.success,
                                size: 20,
                              ),
                              title: Text(domain, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13), overflow: TextOverflow.ellipsis),
                              subtitle: Text('${category.isNotEmpty ? "$category · " : ""}${_timeAgo(time)}',
                                  style: TextStyle(fontSize: 11, color: ShieldTheme.textSecondary)),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: blocked ? ShieldTheme.dangerLight.withOpacity(0.1) : ShieldTheme.success.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(blocked ? 'Blocked' : 'Allowed',
                                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: blocked ? ShieldTheme.dangerLight : ShieldTheme.success)),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ]),
    );
  }

  String _timeAgo(String iso) {
    if (iso.isEmpty) return '';
    try {
      final diff = DateTime.now().difference(DateTime.parse(iso));
      if (diff.inMinutes < 1) return 'just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (_) { return ''; }
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _StatChip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Flexible(
              child: Text(label,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
