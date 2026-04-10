import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key, required this.profileId, this.childName});
  final String profileId;
  final String? childName;
  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  GoogleMapController? _mapController;
  LatLng? _location;
  String? _error;
  bool _loading = true;
  DateTime? _lastSeen;

  @override
  void initState() { super.initState(); _fetch(); }

  Future<void> _fetch() async {
    setState(() { _loading = true; _error = null; });
    try {
      final resp = await ApiClient.instance.get(Endpoints.locationLatest(widget.profileId));
      final d = resp.data as Map<String, dynamic>?;
      if (d != null && d['latitude'] != null) {
        final lat = (d['latitude'] as num).toDouble();
        final lng = (d['longitude'] as num).toDouble();
        _location = LatLng(lat, lng);
        _lastSeen = d['createdAt'] != null
            ? DateTime.tryParse(d['createdAt'].toString())
            : null;
        _mapController?.animateCamera(CameraUpdate.newLatLngZoom(_location!, 15));
      }
      setState(() => _loading = false);
    } catch (_) {
      setState(() { _loading = false; _error = 'Location not available.'; });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.childName ?? 'Live Location'),
      actions: [
        IconButton(icon: const Icon(Icons.refresh), onPressed: _fetch),
      ],
    ),
    body: Stack(children: [
      GoogleMap(
        initialCameraPosition: CameraPosition(
          target: _location ?? const LatLng(20.5937, 78.9629), // India default
          zoom:   _location != null ? 15 : 5,
        ),
        onMapCreated: (ctrl) => _mapController = ctrl,
        markers: _location != null
            ? {
                Marker(
                  markerId: const MarkerId('child'),
                  position: _location!,
                  infoWindow: InfoWindow(
                    title:   widget.childName ?? 'Child',
                    snippet: _lastSeen != null
                        ? 'Last seen: ${_lastSeen!.toLocal().toString().substring(0, 16)}'
                        : null,
                  ),
                )
              }
            : {},
      ),

      if (_loading)
        const Center(child: CircularProgressIndicator()),

      if (_error != null && !_loading)
        Center(child: Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.location_off, size: 48, color: Colors.grey),
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: Colors.black54)),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _fetch, child: const Text('Retry')),
            ]),
          ),
        )),

      if (_lastSeen != null && !_loading)
        Positioned(
          bottom: 16, left: 16, right: 16,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                const Icon(Icons.access_time, size: 16, color: Colors.black45),
                const SizedBox(width: 6),
                Text(
                  'Last seen ${_lastSeen!.toLocal().toString().substring(0, 16)}',
                  style: const TextStyle(color: Colors.black54, fontSize: 13),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('History'),
                ),
              ]),
            ),
          ),
        ),
    ]),
  );
}
