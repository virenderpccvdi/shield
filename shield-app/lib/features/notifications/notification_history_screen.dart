import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';

// ── Model ──────────────────────────────────────────────────────────────────

class NotificationItem {
  final String id;
  final String type;
  final String title;
  final String message;
  final DateTime createdAt;
  final bool read;

  const NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.createdAt,
    required this.read,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? 'INFO',
      title: json['title']?.toString() ?? json['type']?.toString() ?? 'Notification',
      message: json['message']?.toString() ?? json['body']?.toString() ?? '',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      read: json['read'] == true || json['isRead'] == true,
    );
  }
}

// ── Providers ──────────────────────────────────────────────────────────────

final notificationHistoryProvider = FutureProvider.autoDispose<List<NotificationItem>>((ref) async {
  try {
    final client = ref.read(dioProvider);
    // Try paginated endpoint first
    final res = await client.get(
      '/notifications/my',
      queryParameters: {'page': 0, 'size': 100, 'sort': 'createdAt,desc'},
    );
    final data = res.data['data'];
    List raw;
    if (data is Map) {
      raw = (data['content'] ?? data['items'] ?? data['notifications'] ?? []) as List;
    } else if (data is List) {
      raw = data;
    } else {
      raw = [];
    }
    return raw.map((e) => NotificationItem.fromJson(e as Map<String, dynamic>)).toList();
  } catch (_) {
    // Fallback: unread only
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/notifications/my/unread');
      final raw = res.data['data'] as List? ?? [];
      return raw.map((e) => NotificationItem.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }
});

final unreadNotifCountProvider = FutureProvider.autoDispose<int>((ref) async {
  try {
    final client = ref.read(dioProvider);
    final res = await client.get('/notifications/my/unread-count');
    final data = res.data['data'];
    if (data is int) return data;
    if (data is Map) return (data['count'] as int? ?? data['unreadCount'] as int? ?? 0);
    return 0;
  } catch (_) {
    // Fall back to counting unread from history
    try {
      final history = await ref.read(notificationHistoryProvider.future);
      return history.where((n) => !n.read).length;
    } catch (_) {
      return 0;
    }
  }
});

// ── Screen ─────────────────────────────────────────────────────────────────

class NotificationHistoryScreen extends ConsumerStatefulWidget {
  const NotificationHistoryScreen({super.key});

  @override
  ConsumerState<NotificationHistoryScreen> createState() => _NotificationHistoryScreenState();
}

class _NotificationHistoryScreenState extends ConsumerState<NotificationHistoryScreen> {
  bool _markingRead = false;

  Future<void> _markAllRead() async {
    setState(() => _markingRead = true);
    try {
      await ref.read(dioProvider).put('/notifications/my/read-all');
    } catch (_) {
      // best-effort — ignore error, still refresh
    } finally {
      if (mounted) {
        setState(() => _markingRead = false);
        ref.invalidate(notificationHistoryProvider);
        ref.invalidate(unreadNotifCountProvider);
      }
    }
  }

  Future<void> _clearAll() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear All Notifications'),
        content: const Text('This will delete all notification history. This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: ShieldTheme.dangerLight),
            child: const Text('Clear All'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(dioProvider).delete('/notifications/my/all');
    } catch (_) {
      // best-effort
    }
    if (mounted) {
      ref.invalidate(notificationHistoryProvider);
      ref.invalidate(unreadNotifCountProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final histAsync = ref.watch(notificationHistoryProvider);

    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('Alerts & Notifications', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          if (_markingRead)
            const Padding(
              padding: EdgeInsets.all(14),
              child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else
            IconButton(
              icon: const Icon(Icons.done_all_rounded),
              tooltip: 'Mark all as read',
              onPressed: _markAllRead,
            ),
          IconButton(
            icon: const Icon(Icons.delete_sweep_rounded),
            tooltip: 'Clear all',
            onPressed: _clearAll,
          ),
        ],
      ),
      body: histAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorState(onRetry: () => ref.invalidate(notificationHistoryProvider)),
        data: (items) {
          if (items.isEmpty) return const _EmptyState();
          final grouped = _groupByDate(items);
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(notificationHistoryProvider);
              ref.invalidate(unreadNotifCountProvider);
            },
            child: ListView.builder(
              padding: const EdgeInsets.only(bottom: 24),
              itemCount: _countItems(grouped),
              itemBuilder: (context, index) => _buildItem(context, grouped, index),
            ),
          );
        },
      ),
    );
  }

  // ── Grouping helpers ──────────────────────────────────────────────────────

  Map<String, List<NotificationItem>> _groupByDate(List<NotificationItem> items) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final weekAgo = today.subtract(const Duration(days: 7));

    final groups = <String, List<NotificationItem>>{};

    for (final item in items) {
      final d = DateTime(item.createdAt.year, item.createdAt.month, item.createdAt.day);
      final String key;
      if (!d.isBefore(today)) {
        key = 'Today';
      } else if (!d.isBefore(yesterday)) {
        key = 'Yesterday';
      } else if (!d.isBefore(weekAgo)) {
        key = 'This Week';
      } else {
        key = 'Older';
      }
      groups.putIfAbsent(key, () => []).add(item);
    }
    // Ensure order
    final ordered = <String, List<NotificationItem>>{};
    for (final k in ['Today', 'Yesterday', 'This Week', 'Older']) {
      if (groups.containsKey(k)) ordered[k] = groups[k]!;
    }
    return ordered;
  }

  int _countItems(Map<String, List<NotificationItem>> grouped) {
    int count = 0;
    for (final list in grouped.values) {
      count += 1 + list.length; // header + items
    }
    return count;
  }

  Widget _buildItem(BuildContext context, Map<String, List<NotificationItem>> grouped, int index) {
    // Flatten to [(header | item), ...]
    final flat = <dynamic>[];
    for (final entry in grouped.entries) {
      flat.add(_GroupHeader(label: entry.key));
      flat.addAll(entry.value);
    }
    final item = flat[index];
    if (item is _GroupHeader) {
      return _DateHeaderTile(label: item.label);
    }
    return _NotificationTile(item: item as NotificationItem);
  }
}

class _GroupHeader {
  final String label;
  const _GroupHeader({required this.label});
}

// ── Date header ────────────────────────────────────────────────────────────

class _DateHeaderTile extends StatelessWidget {
  final String label;
  const _DateHeaderTile({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: ShieldTheme.textSecondary,
          letterSpacing: 1.0,
        ),
      ),
    );
  }
}

// ── Notification tile ──────────────────────────────────────────────────────

class _NotificationTile extends StatelessWidget {
  final NotificationItem item;
  const _NotificationTile({required this.item});

  @override
  Widget build(BuildContext context) {
    final (iconData, color) = _iconAndColor(item.type);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
      decoration: BoxDecoration(
        color: item.read ? Colors.white : color.withOpacity(0.04),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: item.read ? ShieldTheme.divider : color.withOpacity(0.25),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Colored icon
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(iconData, color: color, size: 22),
            ),
            const SizedBox(width: 12),
            // Text
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(
                      child: Text(
                        item.title,
                        style: TextStyle(
                          fontWeight: item.read ? FontWeight.w600 : FontWeight.w700,
                          fontSize: 14,
                          color: ShieldTheme.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _relativeTime(item.createdAt),
                      style: const TextStyle(fontSize: 11, color: ShieldTheme.textSecondary),
                    ),
                  ]),
                  if (item.message.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      item.message,
                      style: const TextStyle(fontSize: 12, color: ShieldTheme.textSecondary, height: 1.4),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 6),
                  _TypeChip(type: item.type, color: color),
                ],
              ),
            ),
            // Unread dot
            if (!item.read) ...[
              const SizedBox(width: 8),
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 4),
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
            ],
          ],
        ),
      ),
    );
  }

  (IconData, Color) _iconAndColor(String type) {
    switch (type.toUpperCase()) {
      case 'SOS':
      case 'PANIC_BUTTON':
      case 'PANIC':
        return (Icons.sos_rounded, ShieldTheme.dangerLight);
      case 'GEOFENCE':
      case 'GEOFENCE_BREACH':
      case 'GEOFENCE_ENTRY':
      case 'GEOFENCE_EXIT':
        return (Icons.location_on_rounded, const Color(0xFFF57C00));
      case 'BLOCKED':
      case 'DNS_BLOCK':
      case 'CONTENT_BLOCKED':
        return (Icons.block_rounded, ShieldTheme.primary);
      case 'AI_ANOMALY':
      case 'ANOMALY':
      case 'AI_INSIGHT':
        return (Icons.psychology_rounded, const Color(0xFF7B1FA2));
      case 'SCHEDULE':
      case 'SCHEDULE_START':
      case 'SCHEDULE_END':
        return (Icons.schedule_rounded, ShieldTheme.successLight);
      case 'TIME_LIMIT':
      case 'TIME_BUDGET':
        return (Icons.hourglass_bottom_rounded, const Color(0xFFBF360C));
      case 'REWARD':
      case 'REWARD_EARNED':
        return (Icons.star_rounded, const Color(0xFFFFA000));
      case 'DEVICE':
      case 'DEVICE_OFFLINE':
      case 'DEVICE_ONLINE':
        return (Icons.devices_rounded, ShieldTheme.accent);
      default:
        return (Icons.notifications_rounded, ShieldTheme.textSecondary);
    }
  }

  String _relativeTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) {
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return 'Yesterday $h:$m';
    }
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[dt.month - 1]} ${dt.day}';
  }
}

class _TypeChip extends StatelessWidget {
  final String type;
  final Color color;
  const _TypeChip({required this.type, required this.color});

  String get _label {
    final map = {
      'SOS': 'SOS',
      'PANIC_BUTTON': 'SOS',
      'PANIC': 'SOS',
      'GEOFENCE': 'Geofence',
      'GEOFENCE_BREACH': 'Geofence',
      'GEOFENCE_ENTRY': 'Geofence Entry',
      'GEOFENCE_EXIT': 'Geofence Exit',
      'BLOCKED': 'Blocked',
      'DNS_BLOCK': 'Blocked Site',
      'CONTENT_BLOCKED': 'Blocked Content',
      'AI_ANOMALY': 'AI Anomaly',
      'ANOMALY': 'AI Anomaly',
      'AI_INSIGHT': 'AI Insight',
      'SCHEDULE': 'Schedule',
      'SCHEDULE_START': 'Schedule On',
      'SCHEDULE_END': 'Schedule Off',
      'TIME_LIMIT': 'Time Limit',
      'TIME_BUDGET': 'Time Budget',
      'REWARD': 'Reward',
      'REWARD_EARNED': 'Reward Earned',
      'DEVICE': 'Device',
      'DEVICE_OFFLINE': 'Device Offline',
      'DEVICE_ONLINE': 'Device Online',
    };
    return map[type.toUpperCase()] ?? type.replaceAll('_', ' ');
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        _label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}

// ── Empty state ────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: ShieldTheme.primary.withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.shield_rounded, size: 44, color: ShieldTheme.primary),
            ),
            const SizedBox(height: 20),
            const Text(
              'No alerts yet',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: ShieldTheme.textPrimary),
            ),
            const SizedBox(height: 8),
            const Text(
              'Geofence breaches, SOS alerts, blocked sites,\nand AI anomalies will appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: ShieldTheme.textSecondary, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Error state ────────────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off_rounded, size: 56, color: ShieldTheme.textSecondary),
            const SizedBox(height: 16),
            const Text('Could not load notifications',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const Text('Check your connection and try again.',
              style: TextStyle(fontSize: 13, color: ShieldTheme.textSecondary)),
            const SizedBox(height: 20),
            SizedBox(
              width: 160,
              child: FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Retry'),
                style: FilledButton.styleFrom(minimumSize: const Size(160, 44)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
