import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:intl/intl.dart';
import '../../core/api_client.dart';

class LocationHistoryScreen extends ConsumerStatefulWidget {
  final String profileId;
  const LocationHistoryScreen({super.key, required this.profileId});
  @override
  ConsumerState<LocationHistoryScreen> createState() => _LocationHistoryScreenState();
}

class _LocationHistoryScreenState extends ConsumerState<LocationHistoryScreen> {
  final Completer<GoogleMapController> _mapController = Completer();
  List<Map<String, dynamic>> _points = [];
  bool _loading = false;
  DateTime _selectedDate = DateTime.now();
  int _playbackIndex = 0;
  bool _playing = false;
  Timer? _playTimer;

  static const _defaultCamera = CameraPosition(target: LatLng(20.5937, 78.9629), zoom: 5);

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _playTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    setState(() { _loading = true; _playing = false; _playbackIndex = 0; });
    _playTimer?.cancel();

    final from = DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day);
    final to = from.add(const Duration(days: 1));
    final fmt = DateFormat('yyyy-MM-dd\'T\'HH:mm:ss');

    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/location/${widget.profileId}/history',
        queryParameters: {'from': fmt.format(from), 'to': fmt.format(to)});
      _points = ((res.data['data'] as List?) ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)).toList();

      // Move camera to first point
      if (_points.isNotEmpty) {
        final first = _points.first;
        final lat = _d(first['latitude']);
        final lng = _d(first['longitude']);
        if (lat != null && lng != null && _mapController.isCompleted) {
          final c = await _mapController.future;
          c.animateCamera(CameraUpdate.newLatLngZoom(LatLng(lat, lng), 14));
        }
      }
    } catch (e) {
      debugPrint('[Shield] Location history load failed: $e');
      if (mounted) {
        setState(() {
          _points = [];
          _loading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not load location history'), backgroundColor: Colors.orange),
        );
      }
      return;
    }
    if (mounted) setState(() => _loading = false);
  }

  double? _d(dynamic v) {
    if (v == null) return null;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  Set<Polyline> _buildPolyline() {
    if (_points.isEmpty) return {};
    final end = _playing ? _playbackIndex + 1 : _points.length;
    final coords = <LatLng>[];
    for (int i = 0; i < end && i < _points.length; i++) {
      final lat = _d(_points[i]['latitude']);
      final lng = _d(_points[i]['longitude']);
      if (lat != null && lng != null) coords.add(LatLng(lat, lng));
    }
    if (coords.isEmpty) return {};
    return {
      Polyline(
        polylineId: const PolylineId('route'),
        points: coords,
        color: const Color(0xFF1565C0),
        width: 4,
      ),
    };
  }

  Set<Marker> _buildMarkers() {
    if (_points.isEmpty) return {};
    final markers = <Marker>{};

    // Start marker
    final sLat = _d(_points.first['latitude']);
    final sLng = _d(_points.first['longitude']);
    if (sLat != null && sLng != null) {
      markers.add(Marker(
        markerId: const MarkerId('start'),
        position: LatLng(sLat, sLng),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        infoWindow: const InfoWindow(title: 'Start'),
      ));
    }

    // Current playback or end marker
    final endIdx = _playing ? _playbackIndex.clamp(0, _points.length - 1) : _points.length - 1;
    final eLat = _d(_points[endIdx]['latitude']);
    final eLng = _d(_points[endIdx]['longitude']);
    if (eLat != null && eLng != null) {
      markers.add(Marker(
        markerId: const MarkerId('current'),
        position: LatLng(eLat, eLng),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
        infoWindow: InfoWindow(title: _playing ? 'Current' : 'End'),
      ));
    }

    return markers;
  }

  void _togglePlayback() {
    if (_points.length < 2) return;
    if (_playing) {
      _playTimer?.cancel();
      setState(() => _playing = false);
    } else {
      setState(() { _playing = true; _playbackIndex = 0; });
      _playTimer = Timer.periodic(const Duration(milliseconds: 500), (timer) async {
        if (_playbackIndex >= _points.length - 1) {
          timer.cancel();
          setState(() => _playing = false);
          return;
        }
        setState(() => _playbackIndex++);
        // Move camera
        final lat = _d(_points[_playbackIndex]['latitude']);
        final lng = _d(_points[_playbackIndex]['longitude']);
        if (lat != null && lng != null && _mapController.isCompleted) {
          final c = await _mapController.future;
          c.animateCamera(CameraUpdate.newLatLng(LatLng(lat, lng)));
        }
      });
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 90)),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      _loadHistory();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Location History', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: Column(
        children: [
          // Date picker bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Colors.white,
            child: Row(children: [
              const Icon(Icons.calendar_today, size: 18, color: Color(0xFF1565C0)),
              const SizedBox(width: 8),
              TextButton(
                onPressed: _pickDate,
                child: Text(DateFormat('EEEE, MMM d, yyyy').format(_selectedDate),
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
              const Spacer(),
              Text('${_points.length} points', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            ]),
          ),
          // Map
          Expanded(
            flex: 3,
            child: _loading
              ? const Center(child: CircularProgressIndicator())
              : GoogleMap(
                  initialCameraPosition: _defaultCamera,
                  onMapCreated: (c) {
                    if (!_mapController.isCompleted) _mapController.complete(c);
                  },
                  polylines: _buildPolyline(),
                  markers: _buildMarkers(),
                  myLocationEnabled: false,
                  zoomControlsEnabled: true,
                ),
          ),
          // Playback controls
          Container(
            padding: const EdgeInsets.all(12),
            color: Colors.white,
            child: Column(
              children: [
                if (_points.isNotEmpty) ...[
                  Slider(
                    value: _playbackIndex.toDouble(),
                    min: 0,
                    max: (_points.length - 1).toDouble().clamp(0, double.infinity),
                    onChanged: (v) => setState(() => _playbackIndex = v.round()),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        icon: Icon(_playing ? Icons.pause_circle_filled : Icons.play_circle_filled,
                          color: const Color(0xFF1565C0), size: 40),
                        onPressed: _togglePlayback,
                      ),
                      const SizedBox(width: 8),
                      if (_points.isNotEmpty)
                        Text(
                          '${_playbackIndex + 1} / ${_points.length}',
                          style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w600),
                        ),
                      if (_playing) ...[
                        const SizedBox(width: 16),
                        Text(_points[_playbackIndex]['timestamp'] != null
                          ? _formatTime(_points[_playbackIndex]['timestamp'])
                          : '', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                      ],
                    ],
                  ),
                ] else if (!_loading)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('No location data for this date', style: TextStyle(color: Colors.grey)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(String ts) {
    try {
      return DateFormat('h:mm a').format(DateTime.parse(ts).toLocal());
    } catch (_) { return ts; }
  }
}
