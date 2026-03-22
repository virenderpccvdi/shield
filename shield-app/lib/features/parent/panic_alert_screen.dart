import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api_client.dart';
import '../../core/shield_widgets.dart';

class PanicAlertScreen extends ConsumerStatefulWidget {
  const PanicAlertScreen({super.key});
  @override
  ConsumerState<PanicAlertScreen> createState() => _PanicAlertScreenState();
}

class _PanicAlertScreenState extends ConsumerState<PanicAlertScreen> {
  List<Map<String, dynamic>> _alerts = [];
  bool _loading = true;
  final Completer<GoogleMapController> _mapController = Completer();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/location/sos/active');
      _alerts = ((res.data['data'] as List?) ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) { _alerts = []; }
    if (mounted) setState(() => _loading = false);
  }

  double? _d(dynamic v) {
    if (v == null) return null;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  Future<void> _acknowledge(String alertId) async {
    try {
      final client = ref.read(dioProvider);
      await client.post('/location/sos/$alertId/acknowledge');
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Alert acknowledged'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _callChild(String? phone) async {
    if (phone == null || phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No phone number available')),
      );
      return;
    }
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SOS Alerts', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: _alerts.isNotEmpty ? Colors.red.shade50 : null,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
        ? const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 4),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 3),
          ]))
        : RefreshIndicator(
            onRefresh: () async => _load(),
            child: _alerts.isEmpty
              ? const Center(child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.check_circle, size: 64, color: Colors.green),
                    SizedBox(height: 16),
                    Text('No active SOS alerts', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                    SizedBox(height: 8),
                    Text('Everyone is safe', style: TextStyle(color: Colors.grey)),
                  ],
                ))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: _alerts.length,
                  itemBuilder: (_, i) {
                    final alert = _alerts[i];
                    final lat = _d(alert['latitude']);
                    final lng = _d(alert['longitude']);
                    final childName = alert['childName'] as String? ?? alert['profileName'] as String? ?? 'Child';

                    return Card(
                      color: Colors.red.shade50,
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Alert header
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.red.shade700,
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                            ),
                            child: Row(children: [
                              const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 28),
                              const SizedBox(width: 12),
                              Expanded(child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('SOS from $childName',
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                                  Text(_formatTime(alert['timestamp'] as String? ?? alert['createdAt'] as String? ?? ''),
                                    style: const TextStyle(color: Colors.white70, fontSize: 12)),
                                ],
                              )),
                            ]),
                          ),
                          // Map
                          if (lat != null && lng != null)
                            SizedBox(
                              height: 200,
                              child: GoogleMap(
                                initialCameraPosition: CameraPosition(target: LatLng(lat, lng), zoom: 15),
                                markers: {
                                  Marker(
                                    markerId: MarkerId('sos_$i'),
                                    position: LatLng(lat, lng),
                                    icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
                                    infoWindow: InfoWindow(title: '$childName SOS'),
                                  ),
                                },
                                zoomControlsEnabled: false,
                                scrollGesturesEnabled: false,
                                rotateGesturesEnabled: false,
                                tiltGesturesEnabled: false,
                                myLocationEnabled: false,
                                liteModeEnabled: true,
                              ),
                            )
                          else
                            const Padding(
                              padding: EdgeInsets.all(16),
                              child: Text('Location not available', style: TextStyle(color: Colors.grey)),
                            ),
                          // Actions
                          Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(children: [
                              Expanded(
                                child: FilledButton.icon(
                                  onPressed: () => _acknowledge(alert['id'].toString()),
                                  icon: const Icon(Icons.check),
                                  label: const Text('Acknowledge'),
                                  style: FilledButton.styleFrom(backgroundColor: Colors.green),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: () => _callChild(alert['phone'] as String?),
                                  icon: const Icon(Icons.phone, color: Color(0xFF1565C0)),
                                  label: const Text('Call Child'),
                                ),
                              ),
                            ]),
                          ),
                        ],
                      ),
                    );
                  },
                ),
          ),
    );
  }

  String _formatTime(String ts) {
    if (ts.isEmpty) return '';
    try {
      final d = DateTime.parse(ts).toLocal();
      final diff = DateTime.now().difference(d);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inHours < 1) return '${diff.inMinutes} minutes ago';
      if (diff.inDays < 1) return '${diff.inHours} hours ago';
      return '${diff.inDays} days ago';
    } catch (_) { return ts; }
  }
}
