import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class AppBlockingScreen extends ConsumerStatefulWidget {
  final String profileId;
  final String childName;
  const AppBlockingScreen({
    super.key,
    required this.profileId,
    required this.childName,
  });
  @override
  ConsumerState<AppBlockingScreen> createState() => _AppBlockingScreenState();
}

class _AppBlockingScreenState extends ConsumerState<AppBlockingScreen> {
  List<Map<String, dynamic>> _apps = [];
  bool _loading = true;
  String? _error;
  String _search = '';
  bool _showBlockedOnly = false;

  @override
  void initState() {
    super.initState();
    _loadApps();
  }

  Future<void> _loadApps() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await ref.read(dioProvider).get(
        '/profiles/apps/${widget.profileId}',
        queryParameters: {'excludeSystem': false},
      );
      final raw = res.data['data'];
      final list = raw is List ? raw : (raw is Map ? (raw['content'] as List? ?? []) : []);
      setState(() {
        _apps = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _apps.sort((a, b) {
          // Blocked apps first, then by name
          final aBlocked = a['blocked'] == true ? 0 : 1;
          final bBlocked = b['blocked'] == true ? 0 : 1;
          if (aBlocked != bBlocked) return aBlocked - bBlocked;
          return (a['appName'] ?? '').toString().compareTo((b['appName'] ?? '').toString());
        });
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _toggleBlock(Map<String, dynamic> app) async {
    final pkg = app['packageName'] as String;
    final nowBlocked = !(app['blocked'] == true);
    // Optimistically update UI
    setState(() {
      final idx = _apps.indexWhere((a) => a['packageName'] == pkg);
      if (idx >= 0) _apps[idx] = {..._apps[idx], 'blocked': nowBlocked};
    });
    try {
      await ref.read(dioProvider).patch(
        '/profiles/apps/${widget.profileId}/$pkg',
        data: {'blocked': nowBlocked},
      );
    } catch (e) {
      // Revert on error
      setState(() {
        final idx = _apps.indexWhere((a) => a['packageName'] == pkg);
        if (idx >= 0) _apps[idx] = {..._apps[idx], 'blocked': !nowBlocked};
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _setTimeLimit(Map<String, dynamic> app) async {
    final pkg = app['packageName'] as String;
    final current = app['timeLimitMinutes'] as int? ?? 0;
    int? picked = await _showTimeLimitDialog(current);
    if (picked == null) return;
    try {
      await ref.read(dioProvider).patch(
        '/profiles/apps/${widget.profileId}/$pkg',
        data: {'timeLimitMinutes': picked},
      );
      setState(() {
        final idx = _apps.indexWhere((a) => a['packageName'] == pkg);
        if (idx >= 0) _apps[idx] = {..._apps[idx], 'timeLimitMinutes': picked};
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<int?> _showTimeLimitDialog(int currentMinutes) async {
    int? selected = currentMinutes == 0 ? null : currentMinutes;
    final options = [30, 60, 90, 120, 180, 240, 300, 0];
    return showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Daily Time Limit'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: options.map((m) => RadioListTile<int>(
            title: Text(m == 0 ? 'No limit' : _formatMinutes(m)),
            value: m,
            groupValue: selected,
            onChanged: (v) {
              Navigator.pop(ctx, v);
            },
          )).toList(),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        ],
      ),
    );
  }

  String _formatMinutes(int m) {
    if (m < 60) return '${m}m';
    final h = m ~/ 60;
    final rem = m % 60;
    return rem == 0 ? '${h}h' : '${h}h ${rem}m';
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _apps.where((a) {
      final name = (a['appName'] ?? a['packageName'] ?? '').toString().toLowerCase();
      final matchSearch = _search.isEmpty || name.contains(_search.toLowerCase());
      final matchFilter = !_showBlockedOnly || a['blocked'] == true;
      return matchSearch && matchFilter;
    }).toList();

    final blockedCount = _apps.where((a) => a['blocked'] == true).length;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('App Blocking', style: TextStyle(fontWeight: FontWeight.w700)),
            Text(widget.childName, style: const TextStyle(fontSize: 12, color: Colors.white70)),
          ],
        ),
        backgroundColor: ShieldTheme.primary,
        foregroundColor: Colors.white,
        actions: [
          if (blockedCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Chip(
                label: Text('$blockedCount blocked',
                    style: const TextStyle(color: Colors.white, fontSize: 12)),
                backgroundColor: Colors.red.shade700,
                padding: EdgeInsets.zero,
              ),
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadApps,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: TextField(
              onChanged: (v) => setState(() => _search = v),
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Search apps...',
                hintStyle: const TextStyle(color: Colors.white60),
                prefixIcon: const Icon(Icons.search, color: Colors.white60),
                filled: true,
                fillColor: Colors.white.withAlpha(30),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
            ),
          ),
        ),
      ),
      body: _loading
          ? const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 4),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 3),
          ]))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: Colors.red),
                      const SizedBox(height: 12),
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      ElevatedButton(onPressed: _loadApps, child: const Text('Retry')),
                    ],
                  ),
                )
              : _apps.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.phone_android, size: 64, color: Colors.grey.shade400),
                          const SizedBox(height: 12),
                          const Text('No apps detected yet.',
                              style: TextStyle(color: Colors.grey, fontSize: 16)),
                          const SizedBox(height: 8),
                          const Text('Apps appear after the child opens the Shield app.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey, fontSize: 13)),
                        ],
                      ),
                    )
                  : Column(
                      children: [
                        // Filter row
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                          child: Row(
                            children: [
                              Text('${filtered.length} apps',
                                  style: const TextStyle(color: Colors.grey, fontSize: 13)),
                              const Spacer(),
                              FilterChip(
                                label: const Text('Blocked only'),
                                selected: _showBlockedOnly,
                                onSelected: (v) => setState(() => _showBlockedOnly = v),
                                selectedColor: Colors.red.shade100,
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
                            itemBuilder: (_, i) => _AppTile(
                              app: filtered[i],
                              onToggle: () => _toggleBlock(filtered[i]),
                              onTimeLimit: () => _setTimeLimit(filtered[i]),
                            ),
                          ),
                        ),
                      ],
                    ),
    );
  }
}

class _AppTile extends StatelessWidget {
  final Map<String, dynamic> app;
  final VoidCallback onToggle;
  final VoidCallback onTimeLimit;
  const _AppTile({required this.app, required this.onToggle, required this.onTimeLimit});

  @override
  Widget build(BuildContext context) {
    final blocked = app['blocked'] == true;
    final appName = app['appName']?.toString() ?? app['packageName']?.toString() ?? 'Unknown';
    final pkg = app['packageName']?.toString() ?? '';
    final timeLimitMin = app['timeLimitMinutes'] as int? ?? 0;
    final usageMin = app['usageTodayMinutes'] as int? ?? 0;
    final isSystem = app['systemApp'] == true;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: blocked ? Colors.red.shade100 : Colors.blue.shade50,
        child: Icon(
          blocked ? Icons.block : Icons.apps,
          color: blocked ? Colors.red : Colors.blueGrey,
          size: 22,
        ),
      ),
      title: Text(
        appName,
        style: TextStyle(
          fontWeight: FontWeight.w600,
          decoration: blocked ? TextDecoration.lineThrough : null,
          color: blocked ? Colors.red.shade700 : null,
        ),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(pkg, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          Row(
            children: [
              if (usageMin > 0) ...[
                Icon(Icons.access_time, size: 11, color: Colors.orange.shade700),
                const SizedBox(width: 2),
                Text('${_fmt(usageMin)} today',
                    style: TextStyle(fontSize: 11, color: Colors.orange.shade700)),
                const SizedBox(width: 8),
              ],
              if (timeLimitMin > 0) ...[
                const Icon(Icons.timer, size: 11, color: Colors.blueGrey),
                const SizedBox(width: 2),
                Text('limit: ${_fmt(timeLimitMin)}',
                    style: const TextStyle(fontSize: 11, color: Colors.blueGrey)),
              ],
              if (isSystem)
                const Text(' • system', style: TextStyle(fontSize: 10, color: Colors.grey)),
            ],
          ),
        ],
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: Icon(Icons.timer_outlined,
                size: 20,
                color: timeLimitMin > 0 ? Colors.blue : Colors.grey.shade400),
            tooltip: 'Set time limit',
            onPressed: onTimeLimit,
          ),
          Switch(
            value: blocked,
            onChanged: (_) => onToggle(),
            activeColor: Colors.red,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ],
      ),
      isThreeLine: true,
    );
  }

  static String _fmt(int m) {
    if (m < 60) return '${m}m';
    final h = m ~/ 60;
    final rem = m % 60;
    return rem == 0 ? '${h}h' : '${h}h ${rem}m';
  }
}
