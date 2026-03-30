import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

final _geofencesProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.geofences(pid));
  final raw = resp.data as List? ??
      (resp.data as Map<String, dynamic>?)?['content'] as List? ?? [];
  return raw.cast<Map<String, dynamic>>();
});

class GeofencesScreen extends ConsumerWidget {
  const GeofencesScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fences = ref.watch(_geofencesProvider(profileId));
    return Scaffold(
      appBar: AppBar(title: const Text('Geofences')),
      body: fences.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load geofences',
          onRetry: () => ref.invalidate(_geofencesProvider(profileId)),
        ),
        data: (list) {
          if (list.isEmpty) {
            return EmptyView(
              icon:    Icons.fence,
              message: 'No geofences set up yet.\nAdd safe zones like home and school.',
              action: ElevatedButton.icon(
                onPressed: () => _showAddDialog(context),
                icon:  const Icon(Icons.add),
                label: const Text('Add Geofence'),
              ),
            );
          }
          return ListView.builder(
            itemCount:   list.length,
            itemBuilder: (_, i) {
              final fence = list[i];
              return Card(
                child: ListTile(
                  leading:  const CircleAvatar(
                    backgroundColor: Color(0xFFE8F5E9),
                    child: Icon(Icons.fence, color: Color(0xFF2E7D32)),
                  ),
                  title:    Text(fence['name']?.toString() ?? 'Geofence'),
                  subtitle: Text('Radius: ${fence['radiusMeters'] ?? 200}m'),
                  trailing: Switch(
                    value:     fence['isActive'] as bool? ?? true,
                    onChanged: (_) {},
                  ),
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddDialog(context),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showAddDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Add Geofence'),
        content: const Text('Open the map in a browser to add geofences with precise location.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}
