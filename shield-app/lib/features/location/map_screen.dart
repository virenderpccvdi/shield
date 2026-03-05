import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../core/api_client.dart';

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});
  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  final Completer<GoogleMapController> _mapController = Completer();
  List<Map<String, dynamic>> _locations = [];
  List<Map<String, dynamic>> _geofences = [];
  bool _loading = true;
  String? _error;

  static const CameraPosition _defaultCamera = CameraPosition(
    target: LatLng(20.5937, 78.9629), // India center as default
    zoom: 5,
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final client = ref.read(dioProvider);

      // Fetch latest locations for all children
      final locRes = await client.get('/location/my/latest');
      final locData = locRes.data['data'] as List? ?? [];

      // Fetch geofences
      List<Map<String, dynamic>> fences = [];
      try {
        final fenceRes = await client.get('/location/geofences');
        fences = (fenceRes.data['data'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      } catch (_) {
        // Geofences endpoint may not exist yet; ignore
      }

      setState(() {
        _locations = locData.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _geofences = fences;
        _loading = false;
      });

      // Move camera to first child's location if available
      if (_locations.isNotEmpty) {
        final first = _locations.first;
        final lat = _parseDouble(first['latitude']);
        final lng = _parseDouble(first['longitude']);
        if (lat != null && lng != null) {
          final controller = await _mapController.future;
          controller.animateCamera(CameraUpdate.newLatLngZoom(LatLng(lat, lng), 14));
        }
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to load locations';
        _loading = false;
      });
    }
  }

  double? _parseDouble(dynamic value) {
    if (value == null) return null;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  Set<Marker> _buildMarkers() {
    final markers = <Marker>{};
    for (int i = 0; i < _locations.length; i++) {
      final loc = _locations[i];
      final lat = _parseDouble(loc['latitude']);
      final lng = _parseDouble(loc['longitude']);
      if (lat == null || lng == null) continue;

      final name = loc['profileName'] as String? ?? 'Child ${i + 1}';
      final address = loc['address'] as String? ?? 'Unknown location';

      markers.add(Marker(
        markerId: MarkerId('child_$i'),
        position: LatLng(lat, lng),
        infoWindow: InfoWindow(title: name, snippet: address),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
      ));
    }
    return markers;
  }

  Set<Circle> _buildCircles() {
    final circles = <Circle>{};
    for (int i = 0; i < _geofences.length; i++) {
      final fence = _geofences[i];
      final lat = _parseDouble(fence['latitude']);
      final lng = _parseDouble(fence['longitude']);
      final radius = _parseDouble(fence['radiusMeters'] ?? fence['radius']);
      if (lat == null || lng == null || radius == null) continue;

      circles.add(Circle(
        circleId: CircleId('geofence_$i'),
        center: LatLng(lat, lng),
        radius: radius,
        fillColor: const Color(0x301565C0),
        strokeColor: const Color(0xFF1565C0),
        strokeWidth: 2,
      ));
    }
    return circles;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Location', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _load,
            tooltip: 'Refresh locations',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Google Map
                SizedBox(
                  height: MediaQuery.of(context).size.height * 0.5,
                  child: _error != null
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline, size: 48, color: Colors.red),
                              const SizedBox(height: 8),
                              Text(_error!, style: const TextStyle(color: Colors.red)),
                              const SizedBox(height: 8),
                              ElevatedButton(onPressed: _load, child: const Text('Retry')),
                            ],
                          ),
                        )
                      : GoogleMap(
                          initialCameraPosition: _defaultCamera,
                          onMapCreated: (controller) {
                            if (!_mapController.isCompleted) {
                              _mapController.complete(controller);
                            }
                          },
                          markers: _buildMarkers(),
                          circles: _buildCircles(),
                          myLocationEnabled: true,
                          myLocationButtonEnabled: true,
                          zoomControlsEnabled: true,
                          mapToolbarEnabled: false,
                        ),
                ),
                // Child location list
                Expanded(
                  child: _locations.isEmpty
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.location_off, size: 48, color: Colors.grey),
                              SizedBox(height: 8),
                              Text('No location data available', style: TextStyle(color: Colors.grey)),
                            ],
                          ),
                        )
                      : ListView.builder(
                          itemCount: _locations.length,
                          itemBuilder: (_, i) {
                            final loc = _locations[i];
                            final lat = _parseDouble(loc['latitude']);
                            final lng = _parseDouble(loc['longitude']);
                            return ListTile(
                              leading: const CircleAvatar(
                                backgroundColor: Color(0xFF1565C0),
                                child: Icon(Icons.person, color: Colors.white),
                              ),
                              title: Text(loc['profileName'] as String? ?? 'Child ${i + 1}'),
                              subtitle: Text(
                                lat != null && lng != null
                                    ? '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}'
                                    : 'No coordinates',
                              ),
                              trailing: Text(
                                loc['address'] as String? ?? 'Unknown',
                                style: const TextStyle(fontSize: 12, color: Colors.grey),
                              ),
                              onTap: () async {
                                if (lat != null && lng != null) {
                                  final controller = await _mapController.future;
                                  controller.animateCamera(
                                    CameraUpdate.newLatLngZoom(LatLng(lat, lng), 16),
                                  );
                                }
                              },
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
