import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/models/child_profile.dart';

// Reuses familyChildrenProvider from family_screen
final _allLocationsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final childrenResp = await ApiClient.instance.get(Endpoints.children);
  final raw = childrenResp.data is List
      ? childrenResp.data as List
      : (childrenResp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  final children = raw.map((j) => ChildProfile.fromJson(j as Map<String, dynamic>)).toList();

  final locations = <Map<String, dynamic>>[];
  for (final c in children) {
    try {
      final resp = await ApiClient.instance.get(Endpoints.locationLatest(c.id));
      final d = resp.data as Map<String, dynamic>?;
      if (d != null && d['latitude'] != null) {
        locations.add({...d, 'childName': c.name, 'childId': c.id});
      }
    } catch (_) {}
  }
  return locations;
});

class AllChildrenMapScreen extends ConsumerStatefulWidget {
  const AllChildrenMapScreen({super.key});
  @override
  ConsumerState<AllChildrenMapScreen> createState() => _AllChildrenMapState();
}

class _AllChildrenMapState extends ConsumerState<AllChildrenMapScreen> {
  GoogleMapController? _ctrl;

  @override
  Widget build(BuildContext context) {
    final locations = ref.watch(_allLocationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Map'),
        actions: [
          IconButton(
            icon:      const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_allLocationsProvider),
          ),
        ],
      ),
      body: locations.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (_, __) => Stack(children: [
          GoogleMap(
            initialCameraPosition: const CameraPosition(
                target: LatLng(20.5937, 78.9629), zoom: 5),
            onMapCreated: (c) => _ctrl = c,
          ),
          const Center(child: Card(child: Padding(
            padding: EdgeInsets.all(16),
            child: Text('Could not load locations'),
          ))),
        ]),
        data: (list) {
          final markers = list.map((l) {
            final lat = (l['latitude'] as num).toDouble();
            final lng = (l['longitude'] as num).toDouble();
            return Marker(
              markerId:    MarkerId(l['childId'].toString()),
              position:    LatLng(lat, lng),
              infoWindow:  InfoWindow(title: l['childName'].toString()),
            );
          }).toSet();

          return GoogleMap(
            initialCameraPosition: markers.isNotEmpty
                ? CameraPosition(target: markers.first.position, zoom: 13)
                : const CameraPosition(target: LatLng(20.5937, 78.9629), zoom: 5),
            onMapCreated: (c) {
              _ctrl = c;
              if (markers.isNotEmpty) {
                c.animateCamera(CameraUpdate.newLatLngZoom(markers.first.position, 13));
              }
            },
            markers: markers,
          );
        },
      ),
    );
  }
}
