import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/models/device_model.dart';
import '../../../core/widgets/common_widgets.dart';
import 'package:intl/intl.dart';

final _devicesProvider =
    FutureProvider.autoDispose.family<List<DeviceModel>, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.devicesByProfile(pid));
  final raw = resp.data as List? ??
      (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.map((j) => DeviceModel.fromJson(j as Map<String, dynamic>)).toList();
});

class DevicesScreen extends ConsumerWidget {
  const DevicesScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final devices = ref.watch(_devicesProvider(profileId));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Devices'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_to_queue_outlined),
            tooltip: 'Set up child device',
            onPressed: () => _showLinkOptions(context),
          ),
        ],
      ),
      body: devices.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load devices',
          onRetry: () => ref.invalidate(_devicesProvider(profileId)),
        ),
        data: (list) {
          if (list.isEmpty) {
            return EmptyView(
              icon:    Icons.devices,
              message: 'No devices linked yet.',
              action: TextButton.icon(
                icon:  const Icon(Icons.add_to_queue_outlined),
                label: const Text('Set Up Child Device'),
                onPressed: () => _showLinkOptions(context),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(_devicesProvider(profileId)),
            child: ListView.builder(
              padding:     const EdgeInsets.symmetric(vertical: 8),
              itemCount:   list.length,
              itemBuilder: (_, i) => _DeviceCard(
                device:   list[i],
                onDelete: () => _confirmDelete(context, ref, list[i]),
              ),
            ),
          );
        },
      ),
    );
  }

  void _showLinkOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 20),
            const Text('Link a Child Device',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const Text(
              'Install Shield on the child\'s Android device, then tap below to pair it.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.black54, fontSize: 13),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon:  const Icon(Icons.phone_android),
                label: const Text('Set Up This Device as Child'),
                onPressed: () {
                  Navigator.pop(context);
                  context.push('/setup');
                },
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                icon:  const Icon(Icons.qr_code),
                label: const Text('Show QR Code for Device'),
                onPressed: () {
                  Navigator.pop(context);
                  _showQrCode(context);
                },
              ),
            ),
          ]),
        ),
      ),
    );
  }

  void _showQrCode(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('QR Setup Code'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Image.network(
            'https://shield.rstglobal.in/api/v1/profiles/devices/qr/$profileId/image?size=250',
            height: 250, width: 250,
            errorBuilder: (_, __, ___) => const Padding(
              padding: EdgeInsets.all(20),
              child: Text('QR code unavailable',
                  style: TextStyle(color: Colors.grey)),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Scan this with the Shield app on the child\'s device to link it automatically.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Colors.black54),
          ),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close')),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context, WidgetRef ref,
      DeviceModel device) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Remove Device'),
        content: Text('Remove "${device.deviceName}"?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok == true) {
      try {
        await ApiClient.instance.delete('/profiles/devices/${device.id}');
        ref.invalidate(_devicesProvider(profileId));
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Device removed')));
        }
      } catch (_) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Failed to remove device')));
        }
      }
    }
  }
}

class _DeviceCard extends StatelessWidget {
  const _DeviceCard({required this.device, required this.onDelete});
  final DeviceModel device;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(children: [
        Text(device.platformIcon, style: const TextStyle(fontSize: 32)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(device.deviceName,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
          if (device.platform != null)
            Text(device.platform!, style: const TextStyle(color: Colors.black45, fontSize: 12)),
          if (device.lastSeen != null)
            Text(
              'Last seen: ${DateFormat('d MMM, HH:mm').format(device.lastSeen!.toLocal())}',
              style: const TextStyle(color: Colors.black54, fontSize: 12),
            ),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color:        device.isOnline ? Colors.green.shade50 : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              device.isOnline ? 'Online' : 'Offline',
              style: TextStyle(
                fontSize:   11,
                fontWeight: FontWeight.w600,
                color: device.isOnline ? Colors.green.shade700 : Colors.grey,
              ),
            ),
          ),
          if (device.batteryLevel != null) ...[
            const SizedBox(height: 4),
            Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.battery_4_bar, size: 12,
                  color: (device.batteryLevel ?? 100) < 20 ? Colors.red : Colors.black38),
              Text('${device.batteryLevel}%',
                  style: const TextStyle(fontSize: 11, color: Colors.black54)),
            ]),
          ],
          const SizedBox(height: 4),
          GestureDetector(
            onTap: onDelete,
            child: const Icon(Icons.delete_outline, size: 16, color: Colors.red),
          ),
        ]),
      ]),
    ),
  );
}
