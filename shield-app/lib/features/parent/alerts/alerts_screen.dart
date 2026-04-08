import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/models/alert_model.dart';
import '../../../core/widgets/common_widgets.dart';
import 'package:intl/intl.dart';

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
    return Scaffold(
      appBar: AppBar(title: const Text('Alerts')),
      body: alerts.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load alerts',
          onRetry: () => ref.invalidate(_alertsProvider),
        ),
        data: (list) {
          if (list.isEmpty) {
            return const EmptyView(
              icon:    Icons.notifications_none,
              message: 'No alerts yet.\nYou\'ll see safety and schedule alerts here.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(_alertsProvider),
            child: ListView.builder(
              itemCount:   list.length,
              itemBuilder: (_, i) => _AlertCard(alert: list[i]),
            ),
          );
        },
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.alert});
  final AlertModel alert;

  Color get _color {
    if (alert.isCritical) return Colors.red;
    if (alert.type == 'BATTERY') return Colors.orange;
    if (alert.type == 'GEOFENCE') return Colors.blue;
    if (alert.type == 'SCHEDULE') return Colors.teal;
    return Colors.grey;
  }

  IconData get _icon {
    if (alert.isCritical) return Icons.sos;
    if (alert.type == 'BATTERY') return Icons.battery_alert;
    if (alert.type == 'GEOFENCE') return Icons.location_on;
    if (alert.type == 'SCHEDULE') return Icons.schedule;
    return Icons.notifications;
  }

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: CircleAvatar(
        backgroundColor: _color.withOpacity(0.12),
        child: Icon(_icon, color: _color),
      ),
      title: Text(alert.title,
          style: TextStyle(
            fontWeight: alert.isRead ? FontWeight.normal : FontWeight.bold,
          )),
      isThreeLine: alert.childName != null,
      subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (alert.childName != null)
          Text(alert.childName!, style: const TextStyle(color: Color(0xFF2563EB), fontSize: 12)),
        Text(alert.message, maxLines: 2, overflow: TextOverflow.ellipsis),
      ]),
      trailing: Text(
        DateFormat('d MMM\nHH:mm').format(alert.createdAt.toLocal()),
        style: const TextStyle(fontSize: 11, color: Colors.black38),
        textAlign: TextAlign.right,
      ),
    ),
  );
}
