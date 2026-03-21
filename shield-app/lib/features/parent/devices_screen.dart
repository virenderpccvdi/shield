import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';

class DevicesScreen extends ConsumerStatefulWidget {
  final String profileId;
  const DevicesScreen({super.key, required this.profileId});
  @override
  ConsumerState<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends ConsumerState<DevicesScreen> {
  List<Map<String, dynamic>> _devices = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/profiles/devices/profile/${widget.profileId}');
      _devices = ((res.data['data'] as List?) ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) { _devices = []; }
    if (mounted) setState(() => _loading = false);
  }

  IconData _deviceIcon(String? type) {
    switch (type?.toUpperCase()) {
      case 'PHONE': case 'MOBILE': return Icons.phone_android;
      case 'TABLET': return Icons.tablet;
      case 'LAPTOP': case 'COMPUTER': return Icons.laptop;
      case 'DESKTOP': return Icons.desktop_windows;
      default: return Icons.devices;
    }
  }

  Future<void> _addDevice() async {
    final nameCtrl = TextEditingController();
    String type = 'PHONE';

    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Add Device', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
              const SizedBox(height: 16),
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Device Name', prefixIcon: Icon(Icons.devices))),
              const SizedBox(height: 16),
              const Text('Device Type', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, children: [
                for (final t in ['PHONE', 'TABLET', 'LAPTOP', 'DESKTOP'])
                  ChoiceChip(
                    avatar: Icon(_deviceIcon(t), size: 16),
                    label: Text(t),
                    selected: type == t,
                    onSelected: (_) => setSheetState(() => type = t),
                  ),
              ]),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Add Device'),
              ),
            ],
          ),
        ),
      ),
    );

    if (result == true && nameCtrl.text.isNotEmpty) {
      try {
        final client = ref.read(dioProvider);
        await client.post('/profiles/devices', data: {
          'profileId': widget.profileId,
          'name': nameCtrl.text,
          'deviceType': type,
        });
        _load();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Device added'), backgroundColor: Colors.green),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Future<void> _deleteDevice(String deviceId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Device'),
        content: const Text('Are you sure you want to remove this device?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Remove'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        final client = ref.read(dioProvider);
        await client.delete('/profiles/devices/$deviceId');
        _load();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Devices', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addDevice,
        icon: const Icon(Icons.add),
        label: const Text('Add Device'),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: () async => _load(),
            child: _devices.isEmpty
              ? const Center(child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.devices, size: 64, color: Colors.grey),
                    SizedBox(height: 16),
                    Text('No devices registered', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.grey)),
                    Text('Add a device to start monitoring', style: TextStyle(color: Colors.grey, fontSize: 13)),
                  ],
                ))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _devices.length,
                  itemBuilder: (_, i) {
                    final d = _devices[i];
                    final online = _isOnline(d);
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: online ? Colors.green.shade50 : Colors.grey.shade100,
                              child: Icon(_deviceIcon(d['deviceType'] as String?),
                                color: online ? Colors.green : Colors.grey),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(d['name'] as String? ?? 'Device',
                                    style: const TextStyle(fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 2),
                                  Row(children: [
                                    Container(
                                      width: 8, height: 8,
                                      decoration: BoxDecoration(
                                        color: online ? Colors.green : Colors.grey,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      online
                                          ? 'Online'
                                          : (d['lastSeenAt'] != null
                                              ? 'Last seen ${_formatTime(d['lastSeenAt'] as String)}'
                                              : 'Offline'),
                                      style: TextStyle(fontSize: 12, color: online ? Colors.green : Colors.grey),
                                    ),
                                  ]),
                                  if (d['batteryPct'] != null || d['speedKmh'] != null) ...[
                                    const SizedBox(height: 4),
                                    Row(children: [
                                      if (d['batteryPct'] != null) ...[
                                        Icon(Icons.battery_full, size: 14,
                                          color: (d['batteryPct'] as num).toInt() < 20 ? Colors.red
                                              : (d['batteryPct'] as num).toInt() < 50 ? Colors.orange
                                              : Colors.green),
                                        const SizedBox(width: 2),
                                        Text('${(d['batteryPct'] as num).toInt()}%',
                                          style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                                        const SizedBox(width: 8),
                                      ],
                                      if (d['speedKmh'] != null && (d['speedKmh'] as num) > 0) ...[
                                        Icon(Icons.speed, size: 14, color: Colors.grey.shade500),
                                        const SizedBox(width: 2),
                                        Text('${(d['speedKmh'] as num).toStringAsFixed(1)} km/h',
                                          style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                                      ],
                                    ]),
                                  ],
                                ],
                              ),
                            ),
                            if (d['dnsClientId'] != null)
                              Tooltip(
                                message: 'DNS Client: ${d['dnsClientId']}',
                                child: const Icon(Icons.dns, size: 18, color: Colors.grey),
                              ),
                            const SizedBox(width: 4),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                              onPressed: () => _deleteDevice(d['id'].toString()),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
          ),
    );
  }

  /// Returns true if lastSeenAt is within the last 5 minutes.
  /// Falls back to the backend `online` boolean only if lastSeenAt is absent.
  bool _isOnline(Map<String, dynamic> device) {
    final lastSeen = device['lastSeenAt'] as String?;
    if (lastSeen != null) {
      final ts = DateTime.tryParse(lastSeen);
      if (ts != null) {
        return DateTime.now().difference(ts.toLocal()).inMinutes < 5;
      }
    }
    return device['online'] == true;
  }

  String _formatTime(String ts) {
    try {
      final d = DateTime.parse(ts);
      final diff = DateTime.now().difference(d);
      if (diff.inMinutes < 1) return 'just now';
      if (diff.inHours < 1) return '${diff.inMinutes}m ago';
      if (diff.inDays < 1) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (_) { return ts; }
  }
}
