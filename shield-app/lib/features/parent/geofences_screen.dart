import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../core/api_client.dart';

class GeofencesScreen extends ConsumerStatefulWidget {
  final String profileId;
  const GeofencesScreen({super.key, required this.profileId});
  @override
  ConsumerState<GeofencesScreen> createState() => _GeofencesScreenState();
}

class _GeofencesScreenState extends ConsumerState<GeofencesScreen> {
  final Completer<GoogleMapController> _mapController = Completer();
  List<Map<String, dynamic>> _geofences = [];
  bool _loading = true;

  static const _defaultCamera = CameraPosition(target: LatLng(20.5937, 78.9629), zoom: 5);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/location/${widget.profileId}/geofences');
      _geofences = ((res.data['data'] as List?) ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) { _geofences = []; }
    if (mounted) setState(() => _loading = false);
  }

  double? _d(dynamic v) {
    if (v == null) return null;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  Set<Circle> _buildCircles() {
    final circles = <Circle>{};
    for (int i = 0; i < _geofences.length; i++) {
      final f = _geofences[i];
      final lat = _d(f['latitude']);
      final lng = _d(f['longitude']);
      final radius = _d(f['radiusMeters'] ?? f['radius']) ?? 200;
      if (lat == null || lng == null) continue;
      circles.add(Circle(
        circleId: CircleId('gf_$i'),
        center: LatLng(lat, lng),
        radius: radius,
        fillColor: const Color(0x301565C0),
        strokeColor: const Color(0xFF1565C0),
        strokeWidth: 2,
      ));
    }
    return circles;
  }

  Set<Marker> _buildMarkers() {
    final markers = <Marker>{};
    for (int i = 0; i < _geofences.length; i++) {
      final f = _geofences[i];
      final lat = _d(f['latitude']);
      final lng = _d(f['longitude']);
      if (lat == null || lng == null) continue;
      markers.add(Marker(
        markerId: MarkerId('gf_marker_$i'),
        position: LatLng(lat, lng),
        infoWindow: InfoWindow(title: f['name'] as String? ?? 'Geofence ${i + 1}'),
      ));
    }
    return markers;
  }

  Future<void> _addOrEditGeofence({Map<String, dynamic>? existing}) async {
    final nameCtrl = TextEditingController(text: existing?['name'] as String? ?? '');
    double radius = _d(existing?['radiusMeters'] ?? existing?['radius']) ?? 200;
    double? lat = _d(existing?['latitude']);
    double? lng = _d(existing?['longitude']);
    final latCtrl = TextEditingController(text: lat?.toString() ?? '');
    final lngCtrl = TextEditingController(text: lng?.toString() ?? '');

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
              Text(existing != null ? 'Edit Geofence' : 'Add Geofence',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
              const SizedBox(height: 16),
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name', prefixIcon: Icon(Icons.label))),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: TextField(controller: latCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Latitude'))),
                const SizedBox(width: 12),
                Expanded(child: TextField(controller: lngCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Longitude'))),
              ]),
              const SizedBox(height: 16),
              Row(children: [
                const Text('Radius: ', style: TextStyle(fontWeight: FontWeight.w600)),
                Expanded(
                  child: Slider(
                    value: radius,
                    min: 50,
                    max: 2000,
                    divisions: 39,
                    label: '${radius.round()}m',
                    onChanged: (v) => setSheetState(() => radius = v),
                  ),
                ),
                Text('${radius.round()}m', style: const TextStyle(fontWeight: FontWeight.w600)),
              ]),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(existing != null ? 'Update' : 'Create'),
              ),
              if (existing != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                    child: const Text('Delete'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );

    if (result == null) return;

    final parsedLat = double.tryParse(latCtrl.text.trim());
    final parsedLng = double.tryParse(lngCtrl.text.trim());
    if (parsedLat == null || parsedLng == null || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180.'), backgroundColor: Colors.red),
      );
      return;
    }

    if (result == true) {
      // Create or update
      try {
        final client = ref.read(dioProvider);
        final body = {
          'name': nameCtrl.text,
          'latitude': parsedLat,
          'longitude': parsedLng,
          'radiusMeters': radius.round(),
          'profileId': widget.profileId,
        };
        if (existing != null) {
          await client.put('/location/${widget.profileId}/geofences/${existing['id']}', data: body);
        } else {
          await client.post('/location/${widget.profileId}/geofences', data: body);
        }
        _load();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
          );
        }
      }
    } else if (existing != null) {
      // Delete
      try {
        final client = ref.read(dioProvider);
        await client.delete('/location/${widget.profileId}/geofences/${existing['id']}');
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
        title: const Text('Geofences', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _addOrEditGeofence(),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : Column(
            children: [
              // Map
              SizedBox(
                height: MediaQuery.of(context).size.height * 0.45,
                child: GoogleMap(
                  initialCameraPosition: _defaultCamera,
                  onMapCreated: (c) {
                    if (!_mapController.isCompleted) _mapController.complete(c);
                    // Zoom to first geofence
                    if (_geofences.isNotEmpty) {
                      final f = _geofences.first;
                      final lat = _d(f['latitude']);
                      final lng = _d(f['longitude']);
                      if (lat != null && lng != null) {
                        c.animateCamera(CameraUpdate.newLatLngZoom(LatLng(lat, lng), 14));
                      }
                    }
                  },
                  markers: _buildMarkers(),
                  circles: _buildCircles(),
                  myLocationEnabled: true,
                  myLocationButtonEnabled: true,
                ),
              ),
              // List
              Expanded(
                child: _geofences.isEmpty
                  ? const Center(child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.fence, size: 48, color: Colors.grey),
                        SizedBox(height: 8),
                        Text('No geofences set up', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
                        Text('Tap + to add a safe zone', style: TextStyle(color: Colors.grey, fontSize: 13)),
                      ],
                    ))
                  : ListView.builder(
                      itemCount: _geofences.length,
                      itemBuilder: (_, i) {
                        final f = _geofences[i];
                        return ListTile(
                          leading: const CircleAvatar(
                            backgroundColor: Color(0xFF1565C0),
                            child: Icon(Icons.location_on, color: Colors.white),
                          ),
                          title: Text(f['name'] as String? ?? 'Geofence ${i + 1}', style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text('Radius: ${_d(f['radiusMeters'] ?? f['radius'])?.round() ?? 200}m'),
                          trailing: const Icon(Icons.edit),
                          onTap: () => _addOrEditGeofence(existing: f),
                        );
                      },
                    ),
              ),
            ],
          ),
    );
  }
}
