import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../core/api_client.dart';
import '../../core/api/endpoints.dart';

// ---------------------------------------------------------------------------
// Data models
// ---------------------------------------------------------------------------

class _ChildLocation {
  final String profileId;
  final String name;
  final double latitude;
  final double longitude;
  final String? address;
  final bool isBreaching;
  final int? batteryPct;
  final double? speedKmh;

  const _ChildLocation({
    required this.profileId,
    required this.name,
    required this.latitude,
    required this.longitude,
    this.address,
    this.isBreaching = false,
    this.batteryPct,
    this.speedKmh,
  });
}

class _Geofence {
  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final double radiusMeters;
  final bool breached;

  const _Geofence({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
    required this.breached,
  });
}

double? _parseDouble(dynamic value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is int) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class MapScreen extends ConsumerStatefulWidget {
  /// When set, shows only this child's location. When null, shows all children.
  final String? profileId;

  const MapScreen({super.key, this.profileId});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  final Completer<GoogleMapController> _mapController = Completer();

  List<_ChildLocation> _locations = [];
  List<_Geofence> _geofences = [];
  bool _loading = true;
  String? _error;
  int _refreshKey = 0; // incremented to force provider re-fetch on refresh

  static const CameraPosition _defaultCamera = CameraPosition(
    target: LatLng(20.5937, 78.9629), // India centre fallback
    zoom: 5,
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(dioProvider);
      List<_ChildLocation> locs = [];

      if (widget.profileId != null) {
        // Single-child mode: fetch from /location/:profileId/latest
        final res =
            await client.get(Endpoints.latestLocation(widget.profileId!));
        final raw = res.data['data'] as Map<String, dynamic>?;
        if (raw != null) {
          final lat = _parseDouble(raw['latitude']);
          final lng = _parseDouble(raw['longitude']);
          if (lat != null && lng != null) {
            locs.add(_ChildLocation(
              profileId: widget.profileId!,
              name: raw['profileName'] as String? ?? 'Child',
              latitude: lat,
              longitude: lng,
              address: raw['address'] as String?,
              isBreaching: raw['isBreaching'] as bool? ?? false,
              batteryPct: raw['batteryPct'] as int?,
              speedKmh: _parseDouble(raw['speedKmh']),
            ));
          }
        }
      } else {
        // Multi-child mode: fetch children list, then each child's latest location
        final childRes = await client.get(Endpoints.children);
        final childData = childRes.data['data'];
        List<Map<String, dynamic>> children = [];
        if (childData is List) {
          children = childData
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
        } else if (childData is Map && childData.containsKey('content')) {
          children = (childData['content'] as List? ?? [])
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
        }

        // Fetch each child's location in parallel, ignoring failures
        final futures = children.map((child) async {
          final pid = child['id'] as String? ?? child['profileId'] as String?;
          if (pid == null) return null;
          try {
            final locRes = await client.get(Endpoints.latestLocation(pid));
            final raw = locRes.data['data'] as Map<String, dynamic>?;
            if (raw == null) return null;
            final lat = _parseDouble(raw['latitude']);
            final lng = _parseDouble(raw['longitude']);
            if (lat == null || lng == null) return null;
            return _ChildLocation(
              profileId: pid,
              name: child['name'] as String? ??
                  raw['profileName'] as String? ??
                  'Child',
              latitude: lat,
              longitude: lng,
              address: raw['address'] as String?,
              isBreaching: raw['isBreaching'] as bool? ?? false,
              batteryPct: raw['batteryPct'] as int?,
              speedKmh: _parseDouble(raw['speedKmh']),
            );
          } catch (_) {
            return null;
          }
        });
        final results = await Future.wait(futures);
        locs = results.whereType<_ChildLocation>().toList();
      }

      // Fetch geofences for each profile that has locations
      final fences = <_Geofence>[];
      final profileIds = locs.map((l) => l.profileId).toSet();
      for (final pid in profileIds) {
        try {
          final fenceRes = await client.get(Endpoints.geofences(pid));
          final fenceData = fenceRes.data['data'];
          final List<dynamic> rawList;
          if (fenceData is List) {
            rawList = fenceData;
          } else if (fenceData is Map && fenceData.containsKey('content')) {
            rawList = fenceData['content'] as List? ?? [];
          } else {
            rawList = [];
          }
          for (final f in rawList) {
            final fMap = Map<String, dynamic>.from(f as Map);
            final lat = _parseDouble(fMap['latitude'] ?? fMap['centerLat']);
            final lng = _parseDouble(fMap['longitude'] ?? fMap['centerLng']);
            final radius = _parseDouble(
                fMap['radiusMeters'] ?? fMap['radius'] ?? fMap['radiusMeter']);
            if (lat == null || lng == null || radius == null) continue;
            fences.add(_Geofence(
              id: '${pid}_${fMap['id'] ?? fences.length}',
              name: fMap['name'] as String? ?? 'Zone',
              latitude: lat,
              longitude: lng,
              radiusMeters: radius,
              breached: fMap['breached'] as bool? ??
                  fMap['isBreached'] as bool? ??
                  false,
            ));
          }
        } catch (_) {
          // Geofences are optional; ignore per-profile errors
        }
      }

      setState(() {
        _locations = locs;
        _geofences = fences;
        _loading = false;
      });

      // Move camera to first child's location
      if (_locations.isNotEmpty && _mapController.isCompleted) {
        final first = _locations.first;
        final controller = await _mapController.future;
        controller.animateCamera(
          CameraUpdate.newLatLngZoom(
            LatLng(first.latitude, first.longitude),
            14,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to load location data';
        _loading = false;
      });
    }
  }

  Future<void> _onRefresh() async {
    setState(() => _refreshKey++);
    await _load();
    // After load, camera has already been moved in _load()
  }

  // ---- Map overlays --------------------------------------------------------

  Set<Marker> _buildMarkers() {
    final markers = <Marker>{};
    for (int i = 0; i < _locations.length; i++) {
      final loc = _locations[i];
      markers.add(Marker(
        markerId: MarkerId('child_${loc.profileId}'),
        position: LatLng(loc.latitude, loc.longitude),
        // Blue hue for safe children; red hue when breaching a geofence
        icon: BitmapDescriptor.defaultMarkerWithHue(
          loc.isBreaching
              ? BitmapDescriptor.hueRed
              : BitmapDescriptor.hueAzure,
        ),
        infoWindow: InfoWindow(
          title: loc.name,
          snippet: [
            if (loc.address != null) loc.address!
            else '${loc.latitude.toStringAsFixed(4)}, ${loc.longitude.toStringAsFixed(4)}',
            if (loc.batteryPct != null && loc.batteryPct! > 0) '🔋 ${loc.batteryPct}%',
            if (loc.speedKmh != null && loc.speedKmh! > 0) '🚗 ${loc.speedKmh!.toStringAsFixed(1)} km/h',
          ].join(' · '),
        ),
      ));
    }
    return markers;
  }

  Set<Circle> _buildCircles() {
    const fillAlpha = 0x28; // ~16% opacity
    const strokeAlpha = 0xCC; // ~80% opacity
    final circles = <Circle>{};
    for (int i = 0; i < _geofences.length; i++) {
      final fence = _geofences[i];
      final fillColor = fence.breached
          ? Color.fromARGB(fillAlpha, 229, 57, 53)   // red fill
          : Color.fromARGB(fillAlpha, 56, 142, 60);  // green fill
      final strokeColor = fence.breached
          ? Color.fromARGB(strokeAlpha, 229, 57, 53)  // red stroke
          : Color.fromARGB(strokeAlpha, 56, 142, 60); // green stroke

      circles.add(Circle(
        circleId: CircleId('geofence_${fence.id}'),
        center: LatLng(fence.latitude, fence.longitude),
        radius: fence.radiusMeters,
        fillColor: fillColor,
        strokeColor: strokeColor,
        strokeWidth: 2,
      ));
    }
    return circles;
  }

  // ---- Build ---------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = widget.profileId != null
        ? (_locations.isNotEmpty ? '${_locations.first.name} — Location' : 'Location')
        : 'Family Location';

    return Scaffold(
      appBar: AppBar(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _onRefresh,
            tooltip: 'Refresh locations',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildErrorState()
              : Column(
                  children: [
                    Expanded(
                      flex: 3,
                      child: _buildMap(theme),
                    ),
                    Expanded(
                      flex: 2,
                      child: _buildLocationList(theme),
                    ),
                  ],
                ),
    );
  }

  Widget _buildMap(ThemeData theme) {
    if (_locations.isEmpty) {
      // Show map at default position with empty state overlay
      return Stack(
        children: [
          GoogleMap(
            initialCameraPosition: _defaultCamera,
            onMapCreated: (c) {
              if (!_mapController.isCompleted) _mapController.complete(c);
            },
            zoomControlsEnabled: true,
            mapToolbarEnabled: false,
            myLocationButtonEnabled: false,
          ),
          // Semi-transparent empty-state banner
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              color: Colors.black54,
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.location_off, color: Colors.white70, size: 32),
                  SizedBox(height: 6),
                  Text(
                    'Location unavailable',
                    style: TextStyle(color: Colors.white70, fontSize: 14),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    return GoogleMap(
      initialCameraPosition: _defaultCamera,
      onMapCreated: (controller) {
        if (!_mapController.isCompleted) {
          _mapController.complete(controller);
          // Move to first child after map is ready
          Future.microtask(() async {
            if (_locations.isNotEmpty) {
              final first = _locations.first;
              controller.animateCamera(
                CameraUpdate.newLatLngZoom(
                  LatLng(first.latitude, first.longitude),
                  14,
                ),
              );
            }
          });
        }
      },
      markers: _buildMarkers(),
      circles: _buildCircles(),
      myLocationEnabled: false,
      myLocationButtonEnabled: false,
      zoomControlsEnabled: true,
      mapToolbarEnabled: false,
    );
  }

  Widget _buildLocationList(ThemeData theme) {
    if (_locations.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.location_off, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 8),
            Text(
              'No location data available',
              style: TextStyle(color: Colors.grey.shade600),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _onRefresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Text(
            '${_locations.length} child${_locations.length == 1 ? '' : 'ren'} tracked',
            style: theme.textTheme.labelMedium
                ?.copyWith(color: Colors.grey.shade600),
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: _locations.length,
            itemBuilder: (_, i) {
              final loc = _locations[i];
              final color = loc.isBreaching
                  ? Colors.red.shade700
                  : Colors.blue.shade700;
              final statusLabel =
                  loc.isBreaching ? 'Outside safe zone' : 'In safe zone';
              return ListTile(
                leading: CircleAvatar(
                  backgroundColor: color,
                  child: Text(
                    loc.name.isNotEmpty
                        ? loc.name[0].toUpperCase()
                        : '?',
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                ),
                title: Text(
                  loc.name,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      loc.address ?? '${loc.latitude.toStringAsFixed(4)}, ${loc.longitude.toStringAsFixed(4)}',
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12),
                    ),
                    if ((loc.batteryPct != null && loc.batteryPct! > 0) || (loc.speedKmh != null && loc.speedKmh! > 0))
                      Row(children: [
                        if (loc.batteryPct != null && loc.batteryPct! > 0) ...[
                          Icon(Icons.battery_full, size: 12,
                            color: loc.batteryPct! < 20 ? Colors.red : loc.batteryPct! < 50 ? Colors.orange : Colors.green),
                          const SizedBox(width: 2),
                          Text('${loc.batteryPct}%', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                          const SizedBox(width: 8),
                        ],
                        if (loc.speedKmh != null && loc.speedKmh! > 0) ...[
                          Icon(Icons.speed, size: 12, color: Colors.grey.shade500),
                          const SizedBox(width: 2),
                          Text('${loc.speedKmh!.toStringAsFixed(1)} km/h', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                        ],
                      ]),
                  ],
                ),
                trailing: Chip(
                  label: Text(
                    statusLabel,
                    style: const TextStyle(fontSize: 11),
                  ),
                  backgroundColor:
                      loc.isBreaching ? Colors.red.shade50 : Colors.green.shade50,
                  side: BorderSide(
                    color: loc.isBreaching
                        ? Colors.red.shade300
                        : Colors.green.shade300,
                  ),
                  padding: EdgeInsets.zero,
                  visualDensity: VisualDensity.compact,
                ),
                onTap: () async {
                  if (_mapController.isCompleted) {
                    final controller = await _mapController.future;
                    controller.animateCamera(
                      CameraUpdate.newLatLngZoom(
                        LatLng(loc.latitude, loc.longitude),
                        16,
                      ),
                    );
                  }
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 56, color: Colors.red),
            const SizedBox(height: 12),
            Text(
              _error!,
              style: const TextStyle(fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _onRefresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
