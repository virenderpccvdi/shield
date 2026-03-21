import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../core/api_client.dart';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN — list + overview map
// ─────────────────────────────────────────────────────────────────────────────

class GeofencesScreen extends ConsumerStatefulWidget {
  final String profileId;
  const GeofencesScreen({super.key, required this.profileId});
  @override
  ConsumerState<GeofencesScreen> createState() => _GeofencesScreenState();
}

class _GeofencesScreenState extends ConsumerState<GeofencesScreen> {
  final Completer<GoogleMapController> _mapController = Completer();
  List<Map<String, dynamic>> _geofences = [];
  List<Map<String, dynamic>> _breaches = [];
  bool _loading = true;

  static const _defaultCamera =
      CameraPosition(target: LatLng(20.5937, 78.9629), zoom: 5);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      // Load geofences and breach history in parallel
      final results = await Future.wait([
        client.get('/location/${widget.profileId}/geofences'),
        client.get('/location/${widget.profileId}/geofences/breaches',
            queryParameters: {'size': 20}).catchError((_) => null),
      ], eagerError: false);

      _geofences = ((results[0] as dynamic).data['data'] as List? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

      try {
        final bRes = results[1];
        if (bRes != null) {
          final raw = (bRes as dynamic).data;
          final list = raw is List ? raw : (raw is Map ? (raw['data'] as List? ?? raw['content'] as List? ?? []) : <dynamic>[]);
          _breaches = list.take(20).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        } else {
          _breaches = [];
        }
      } catch (_) { _breaches = []; }
    } catch (_) {
      _geofences = [];
      _breaches = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  String _timeAgo(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (_) { return iso; }
  }

  double? _d(dynamic v) {
    if (v == null) return null;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  double? _gfLat(Map<String, dynamic> f) =>
      _d(f['centerLat'] ?? f['latitude']);
  double? _gfLng(Map<String, dynamic> f) =>
      _d(f['centerLng'] ?? f['longitude']);

  Set<Circle> _buildCircles() {
    final circles = <Circle>{};
    for (int i = 0; i < _geofences.length; i++) {
      final f = _geofences[i];
      final lat = _gfLat(f);
      final lng = _gfLng(f);
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
      final lat = _gfLat(f);
      final lng = _gfLng(f);
      if (lat == null || lng == null) continue;
      markers.add(Marker(
        markerId: MarkerId('gf_marker_$i'),
        position: LatLng(lat, lng),
        infoWindow:
            InfoWindow(title: f['name'] as String? ?? 'Geofence ${i + 1}'),
      ));
    }
    return markers;
  }

  // ── open draw page ────────────────────────────────────────────────────────

  Future<void> _openDrawPage() async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _DrawGeofencePage(profileId: widget.profileId),
        fullscreenDialog: true,
      ),
    );
    if (saved == true) _load();
  }

  // ── edit / delete sheet (existing geofence) ───────────────────────────────

  Future<void> _editGeofence(Map<String, dynamic> existing) async {
    final nameCtrl =
        TextEditingController(text: existing['name'] as String? ?? '');
    double radius =
        _d(existing['radiusMeters'] ?? existing['radius']) ?? 200;
    final lat = _gfLat(existing);
    final lng = _gfLng(existing);
    final latCtrl = TextEditingController(text: lat?.toString() ?? '');
    final lngCtrl = TextEditingController(text: lng?.toString() ?? '');

    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
              24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Edit Geofence',
                  style: TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 18)),
              const SizedBox(height: 16),
              TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Name',
                      prefixIcon: Icon(Icons.label))),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                    child: TextField(
                        controller: latCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        decoration:
                            const InputDecoration(labelText: 'Latitude'))),
                const SizedBox(width: 12),
                Expanded(
                    child: TextField(
                        controller: lngCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        decoration:
                            const InputDecoration(labelText: 'Longitude'))),
              ]),
              const SizedBox(height: 16),
              Row(children: [
                const Text('Radius: ',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                Expanded(
                  child: Slider(
                    value: radius,
                    min: 50,
                    max: 5000,
                    divisions: 99,
                    label: '${radius.round()}m',
                    onChanged: (v) =>
                        setSheetState(() => radius = v),
                  ),
                ),
                Text('${radius.round()}m',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ]),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Update'),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red),
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
    if (parsedLat == null ||
        parsedLng == null ||
        parsedLat < -90 ||
        parsedLat > 90 ||
        parsedLng < -180 ||
        parsedLng > 180) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text(
                'Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180.'),
            backgroundColor: Colors.red));
      }
      return;
    }

    final client = ref.read(dioProvider);
    if (result == true) {
      try {
        await client.put(
            '/location/${widget.profileId}/geofences/${existing['id']}',
            data: {
              'name': nameCtrl.text,
              'centerLat': parsedLat,
              'centerLng': parsedLng,
              'radiusMeters': radius.round(),
            });
        _load();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                  content: Text('Failed: $e'),
                  backgroundColor: Colors.red));
        }
      }
    } else {
      try {
        await client.delete(
            '/location/${widget.profileId}/geofences/${existing['id']}');
        _load();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                  content: Text('Failed: $e'),
                  backgroundColor: Colors.red));
        }
      }
    }
  }

  // ── geofence type icon ────────────────────────────────────────────────────

  IconData _typeIcon(String? type) {
    switch ((type ?? '').toUpperCase()) {
      case 'HOME':
        return Icons.home;
      case 'SCHOOL':
        return Icons.school;
      case 'PARK':
        return Icons.park;
      default:
        return Icons.location_on;
    }
  }

  Color _typeColor(String? type) {
    switch ((type ?? '').toUpperCase()) {
      case 'HOME':
        return const Color(0xFF1565C0);
      case 'SCHOOL':
        return const Color(0xFF2E7D32);
      case 'PARK':
        return const Color(0xFF558B2F);
      default:
        return const Color(0xFF1565C0);
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Geofences',
            style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openDrawPage,
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_location_alt),
        label: const Text('Add Geofence',
            style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : CustomScrollView(
              slivers: [
                // Overview map
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: MediaQuery.of(context).size.height * 0.40,
                    child: GoogleMap(
                      initialCameraPosition: _defaultCamera,
                      onMapCreated: (c) {
                        if (!_mapController.isCompleted) {
                          _mapController.complete(c);
                        }
                        if (_geofences.isNotEmpty) {
                          final f = _geofences.first;
                          final lat = _gfLat(f);
                          final lng = _gfLng(f);
                          if (lat != null && lng != null) {
                            c.animateCamera(CameraUpdate.newLatLngZoom(
                                LatLng(lat, lng), 14));
                          }
                        }
                      },
                      markers: _buildMarkers(),
                      circles: _buildCircles(),
                      myLocationEnabled: true,
                      myLocationButtonEnabled: true,
                    ),
                  ),
                ),

                // Geofence list header
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: Text('Geofences (${_geofences.length})',
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
                ),

                // Geofences
                _geofences.isEmpty
                  ? SliverToBoxAdapter(
                      child: const Padding(
                        padding: EdgeInsets.all(24),
                        child: Column(
                          children: [
                            Icon(Icons.fence, size: 48, color: Colors.grey),
                            SizedBox(height: 8),
                            Text('No geofences set up',
                                style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
                            Text('Tap "Add Geofence" to draw a safe zone',
                                style: TextStyle(color: Colors.grey, fontSize: 13)),
                          ],
                        ),
                      ),
                    )
                  : SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) {
                          final f = _geofences[i];
                          final type = f['type'] as String? ?? 'OTHER';
                          final color = _typeColor(type);
                          final radius = _d(f['radiusMeters'] ?? f['radius'])?.round() ?? 200;
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: color.withValues(alpha: 0.15),
                                child: Icon(_typeIcon(type), color: color),
                              ),
                              title: Text(
                                  f['name'] as String? ?? 'Geofence ${i + 1}',
                                  style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text(
                                  '${_gfLat(f)?.toStringAsFixed(4) ?? '?'}, '
                                  '${_gfLng(f)?.toStringAsFixed(4) ?? '?'}  ·  '
                                  '${radius}m  ·  $type'),
                              trailing: const Icon(Icons.edit, size: 18),
                              onTap: () => _editGeofence(f),
                            ),
                          );
                        },
                        childCount: _geofences.length,
                      ),
                    ),

                // Recent Breaches header
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
                    child: Row(children: [
                      const Icon(Icons.notifications_active, size: 18, color: Colors.orange),
                      const SizedBox(width: 8),
                      const Text('Recent Breaches',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    ]),
                  ),
                ),

                // Breach history list
                _breaches.isEmpty
                  ? SliverToBoxAdapter(
                      child: const Padding(
                        padding: EdgeInsets.fromLTRB(16, 8, 16, 24),
                        child: Text('No recent breaches',
                            style: TextStyle(color: Colors.grey, fontSize: 13)),
                      ),
                    )
                  : SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) {
                          final breach = _breaches[i];
                          final isExit = (breach['breachType'] as String? ?? '').toUpperCase() == 'EXIT';
                          return ListTile(
                            leading: Icon(
                              isExit ? Icons.logout : Icons.login,
                              color: isExit ? Colors.orange : Colors.green,
                            ),
                            title: Text(breach['geofenceName'] as String? ?? 'Unknown',
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text(
                              '${breach['profileName'] ?? ''} · ${_timeAgo(breach['occurredAt'] as String?)}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: isExit ? Colors.orange.shade50 : Colors.green.shade50,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                isExit ? 'EXIT' : 'ENTER',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: isExit ? Colors.orange.shade700 : Colors.green.shade700,
                                ),
                              ),
                            ),
                          );
                        },
                        childCount: _breaches.length,
                      ),
                    ),

                // Bottom padding for FAB
                const SliverToBoxAdapter(child: SizedBox(height: 80)),
              ],
            ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAW GEOFENCE PAGE — full-screen map + form
// ─────────────────────────────────────────────────────────────────────────────

class _DrawGeofencePage extends StatefulWidget {
  final String profileId;
  const _DrawGeofencePage({required this.profileId});

  @override
  State<_DrawGeofencePage> createState() => _DrawGeofencePageState();
}

class _DrawGeofencePageState extends State<_DrawGeofencePage> {
  // Map state
  final Completer<GoogleMapController> _mapCtrl = Completer();
  LatLng? _center;
  double _radius = 200;

  // Form state
  final _nameCtrl = TextEditingController();
  String _type = 'HOME';
  bool _alertOnEnter = true;
  bool _alertOnExit = true;
  bool _saving = false;

  static const _defaultCenter = LatLng(20.5937, 78.9629);
  static const _types = ['HOME', 'SCHOOL', 'PARK', 'OTHER'];

  static const _typeIcons = <String, IconData>{
    'HOME': Icons.home,
    'SCHOOL': Icons.school,
    'PARK': Icons.park,
    'OTHER': Icons.location_on,
  };

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  // ── map helpers ───────────────────────────────────────────────────────────

  Set<Marker> get _markers {
    if (_center == null) return {};
    return {
      Marker(
        markerId: const MarkerId('draw_center'),
        position: _center!,
        draggable: true,
        onDragEnd: (pos) => setState(() => _center = pos),
        infoWindow: const InfoWindow(title: 'Drag to reposition'),
      ),
    };
  }

  Set<Circle> get _circles {
    if (_center == null) return {};
    return {
      Circle(
        circleId: const CircleId('draw_circle'),
        center: _center!,
        radius: _radius,
        fillColor: const Color(0x3300C853),  // green 20% opacity
        strokeColor: const Color(0xFF00C853), // green
        strokeWidth: 2,
      ),
    };
  }

  void _onMapTap(LatLng pos) {
    setState(() => _center = pos);
  }

  // ── save ──────────────────────────────────────────────────────────────────

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please enter a geofence name.')));
      return;
    }
    if (_center == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Tap on the map to set the geofence center.')));
      return;
    }

    setState(() => _saving = true);
    try {
      // Use InheritedWidget-based Riverpod access via ProviderScope context
      final client =
          ProviderScope.containerOf(context).read(dioProvider);
      await client.post('/profiles/geofences', data: {
        'profileId': widget.profileId,
        'name': name,
        'latitude': _center!.latitude,
        'longitude': _center!.longitude,
        'radius': _radius.round(),
        'type': _type,
        'alertOnEnter': _alertOnEnter,
        'alertOnExit': _alertOnExit,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('Geofence saved!'),
                backgroundColor: Color(0xFF2E7D32)));
        Navigator.of(context).pop(true); // signal parent to reload
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text('Failed to save: $e'),
                backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final hasCenter = _center != null;

    return Scaffold(
      // ── App bar ───────────────────────────────────────────────────────────
      appBar: AppBar(
        title: const Text('Draw Geofence',
            style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        actions: [
          if (_saving)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Center(
                  child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))),
            )
          else
            TextButton.icon(
              onPressed: _save,
              icon: const Icon(Icons.check, color: Colors.white),
              label: const Text('Save',
                  style: TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w700)),
            ),
        ],
      ),
      body: Column(
        children: [
          // ── Map (takes upper ~55% of screen) ────────────────────────────
          Expanded(
            flex: 55,
            child: Stack(
              children: [
                GoogleMap(
                  initialCameraPosition: const CameraPosition(
                      target: _defaultCenter, zoom: 5),
                  onMapCreated: (c) {
                    if (!_mapCtrl.isCompleted) _mapCtrl.complete(c);
                  },
                  onTap: _onMapTap,
                  markers: _markers,
                  circles: _circles,
                  myLocationEnabled: true,
                  myLocationButtonEnabled: true,
                  zoomControlsEnabled: true,
                ),
                // Instruction overlay (only when no center set yet)
                if (!hasCenter)
                  Positioned(
                    top: 12,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.black87,
                          borderRadius: BorderRadius.circular(24),
                        ),
                        child: const Text(
                          'Tap the map to place the geofence center',
                          style: TextStyle(
                              color: Colors.white, fontSize: 13),
                        ),
                      ),
                    ),
                  ),
                // Coordinates badge (after center set)
                if (hasCenter)
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: const [
                          BoxShadow(
                              color: Colors.black26,
                              blurRadius: 4,
                              offset: Offset(0, 2))
                        ],
                      ),
                      child: Text(
                        '${_center!.latitude.toStringAsFixed(5)}, '
                        '${_center!.longitude.toStringAsFixed(5)}',
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1565C0)),
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // ── Form panel (lower ~45%) ──────────────────────────────────────
          Expanded(
            flex: 45,
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                  16,
                  12,
                  16,
                  MediaQuery.of(context).viewInsets.bottom + 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Name field
                  TextField(
                    controller: _nameCtrl,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      labelText: 'Geofence Name',
                      prefixIcon: Icon(Icons.label_outline),
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                          vertical: 12, horizontal: 12),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Type dropdown
                  DropdownButtonFormField<String>(
                    value: _type,
                    decoration: const InputDecoration(
                      labelText: 'Type',
                      prefixIcon: Icon(Icons.category_outlined),
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                          vertical: 12, horizontal: 12),
                    ),
                    items: _types
                        .map((t) => DropdownMenuItem(
                              value: t,
                              child: Row(children: [
                                Icon(_typeIcons[t],
                                    size: 18,
                                    color: const Color(0xFF1565C0)),
                                const SizedBox(width: 8),
                                Text(t),
                              ]),
                            ))
                        .toList(),
                    onChanged: (v) {
                      if (v != null) setState(() => _type = v);
                    },
                  ),
                  const SizedBox(height: 12),

                  // Radius slider
                  Row(
                    children: [
                      const Icon(Icons.radio_button_unchecked,
                          size: 18, color: Color(0xFF1565C0)),
                      const SizedBox(width: 6),
                      const Text('Radius',
                          style: TextStyle(fontWeight: FontWeight.w600)),
                      Expanded(
                        child: Slider(
                          value: _radius,
                          min: 50,
                          max: 5000,
                          divisions: 99,
                          activeColor: const Color(0xFF00C853),
                          label: '${_radius.round()}m',
                          onChanged: (v) =>
                              setState(() => _radius = v),
                        ),
                      ),
                      SizedBox(
                        width: 58,
                        child: Text(
                          '${_radius.round()}m',
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF00C853)),
                        ),
                      ),
                    ],
                  ),

                  // Alert toggles
                  Row(
                    children: [
                      Expanded(
                        child: CheckboxListTile(
                          dense: true,
                          value: _alertOnEnter,
                          title: const Text('Alert on Enter',
                              style: TextStyle(fontSize: 13)),
                          controlAffinity:
                              ListTileControlAffinity.leading,
                          onChanged: (v) =>
                              setState(() => _alertOnEnter = v ?? true),
                        ),
                      ),
                      Expanded(
                        child: CheckboxListTile(
                          dense: true,
                          value: _alertOnExit,
                          title: const Text('Alert on Exit',
                              style: TextStyle(fontSize: 13)),
                          controlAffinity:
                              ListTileControlAffinity.leading,
                          onChanged: (v) =>
                              setState(() => _alertOnExit = v ?? true),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Save button
                  FilledButton.icon(
                    onPressed: _saving ? null : _save,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF1565C0),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2))
                        : const Icon(Icons.save_outlined),
                    label: Text(
                        _saving ? 'Saving...' : 'Save Geofence',
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
