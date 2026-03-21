import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:installed_apps/installed_apps.dart';
import 'package:installed_apps/app_info.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/app_lock_service.dart';
import 'pin_verify_dialog.dart';

final childUsageSummaryProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, profileId) async {
  final client = ref.read(dioProvider);
  try {
    final res = await client.get('/analytics/dns/$profileId/stats');
    final d = res.data['data'] as Map? ?? {};
    return {
      'dnsQueries': d['totalQueries'] ?? 0,
      'blockedQueries': d['totalBlocked'] ?? 0,
      'screenTimeMinutes': 0,
    };
  } catch (_) { return {}; }
});

final childTasksProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, profileId) async {
  final client = ref.read(dioProvider);
  try {
    final res = await client.get('/rewards/tasks', queryParameters: {'profileId': profileId});
    return (res.data['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  } catch (_) { return []; }
});

final childBankProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, profileId) async {
  final client = ref.read(dioProvider);
  try {
    final res = await client.get('/rewards/bank/$profileId');
    final data = res.data['data'] as Map? ?? res.data as Map? ?? {};
    return Map<String, dynamic>.from(data);
  } catch (_) { return {}; }
});

final childGeofencesProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, profileId) async {
  final client = ref.read(dioProvider);
  try {
    final res = await client.get('/profiles/geofences', queryParameters: {'profileId': profileId});
    return (res.data['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  } catch (_) { return []; }
});

/// Check-in status stored in SharedPreferences
class CheckInState {
  final bool isCheckedIn;
  final String? checkedInAt;
  const CheckInState({this.isCheckedIn = false, this.checkedInAt});

  static Future<CheckInState> load(String profileId) async {
    final prefs = await SharedPreferences.getInstance();
    final isIn = prefs.getBool('checkin_$profileId') ?? false;
    final at = prefs.getString('checkin_at_$profileId');
    return CheckInState(isCheckedIn: isIn, checkedInAt: at);
  }

  static Future<void> save(String profileId, {required bool isIn, String? at}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('checkin_$profileId', isIn);
    if (at != null) await prefs.setString('checkin_at_$profileId', at);
    else await prefs.remove('checkin_at_$profileId');
  }
}

class ChildAppScreen extends ConsumerStatefulWidget {
  const ChildAppScreen({super.key});
  @override
  ConsumerState<ChildAppScreen> createState() => _ChildAppScreenState();
}

class _ChildAppScreenState extends ConsumerState<ChildAppScreen> with TickerProviderStateMixin {
  bool _sosSending = false;
  String? _sosResult;
  bool _loading = true;
  bool _checkingIn = false;
  bool _isCheckedIn = false;
  String? _checkedInAt;
  int _batteryPct = -1;
  late AnimationController _sosController;
  Timer? _heartbeatTimer;
  Timer? _locationTimer;
  Timer? _appsTimer;

  @override
  void initState() {
    super.initState();
    _sosController = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat(reverse: true);
    _loadInitialState();
    _sendHeartbeat();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) => _sendHeartbeat());
    _sendBackgroundLocation();
    _locationTimer = Timer.periodic(const Duration(seconds: 30), (_) => _sendBackgroundLocation());
    _syncInstalledApps();
    _appsTimer = Timer.periodic(const Duration(minutes: 30), (_) => _syncInstalledApps());
  }

  @override
  void dispose() {
    _sosController.dispose();
    _heartbeatTimer?.cancel();
    _locationTimer?.cancel();
    _appsTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadInitialState() async {
    final profileId = ref.read(authProvider).childProfileId ?? '';
    final state = await CheckInState.load(profileId);
    try {
      final battery = Battery();
      _batteryPct = await battery.batteryLevel;
    } catch (_) {}
    if (mounted) {
      setState(() {
        _isCheckedIn = state.isCheckedIn;
        _checkedInAt = state.checkedInAt;
        _loading = false;
      });
    }
  }

  Future<void> _sendHeartbeat() async {
    try {
      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      if (profileId == null) return;
      final data = <String, String>{'profileId': profileId, 'appVersion': '1.0.0'};
      try {
        final battery = Battery();
        final level = await battery.batteryLevel;
        data['batteryPct'] = level.toString();
        if (mounted) setState(() => _batteryPct = level);
      } catch (_) {}
      await client.post('/profiles/devices/heartbeat', data: data);
    } catch (e) {
      debugPrint('[Shield] Heartbeat failed: $e');
    }
  }

  Future<void> _sendBackgroundLocation() async {
    try {
      final position = await _getCurrentPosition();
      if (position == null) return;
      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      if (profileId == null) return;
      final speedKmh = position.speed >= 0 ? position.speed * 3.6 : 0.0;
      await client.post('/location/child/checkin', data: {
        'profileId': profileId,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'altitude': position.altitude,
        'speed': speedKmh,
        'heading': position.heading >= 0 ? position.heading : null,
        'isMoving': position.speed > 0.5,
        if (_batteryPct >= 0) 'batteryPct': _batteryPct,
      });
      if (speedKmh > 0) {
        try {
          await client.post('/profiles/devices/heartbeat', data: {
            'profileId': profileId,
            'speedKmh': speedKmh.toStringAsFixed(1),
          });
        } catch (_) {}
      }
    } catch (e) {
      debugPrint('[Shield] Background location failed: $e');
    }
  }

  Future<void> _syncInstalledApps() async {
    try {
      final List<AppInfo> apps = await InstalledApps.getInstalledApps(true, false);
      if (apps.isEmpty) return;
      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      if (profileId == null) return;
      final appList = apps.take(200).map((a) => {
        'packageName': a.packageName,
        'appName': a.name,
        'versionName': a.versionName,
        'systemApp': false,
        'usageTodayMinutes': 0,
      }).toList();
      await client.post('/profiles/apps/sync', data: {'profileId': profileId, 'apps': appList});
    } catch (e) {
      debugPrint('[Shield] App sync failed: $e');
    }
  }

  Future<Position?> _getCurrentPosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return null;
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return null;
    }
    if (permission == LocationPermission.deniedForever) return null;
    return await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        timeLimit: Duration(seconds: 15),
      ),
    ).timeout(const Duration(seconds: 18), onTimeout: () async {
      return await Geolocator.getLastKnownPosition() ?? (throw Exception('Location timeout'));
    });
  }

  Future<void> _sendSos() async {
    setState(() { _sosSending = true; _sosResult = null; });
    try {
      // Confirm before sending
      final confirm = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (_) => AlertDialog(
          title: const Row(children: [
            Icon(Icons.warning_amber_rounded, color: Colors.red, size: 28),
            SizedBox(width: 8),
            Text('Send SOS Alert?', style: TextStyle(fontWeight: FontWeight.w800)),
          ]),
          content: const Text('This will immediately alert your parents with your current location. Only use in a real emergency.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              child: const Text('Yes, Send SOS'),
            ),
          ],
        ),
      );
      if (confirm != true) { setState(() => _sosSending = false); return; }

      // Don't abort — send SOS regardless of GPS availability
      final position = await _getCurrentPosition().catchError((_) => null);
      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      await client.post('/location/child/panic', data: {
        'profileId': profileId,
        'latitude': position?.latitude ?? 0.0,
        'longitude': position?.longitude ?? 0.0,
        'accuracy': position?.accuracy,
        'message': position == null
            ? 'Child SOS alert — location unavailable'
            : 'Child SOS alert',
      });
      setState(() { _sosResult = '✓ SOS sent! Your family has been alerted.'; });
    } catch (e) {
      setState(() { _sosResult = 'Failed to send SOS. Please try again.'; });
    } finally {
      if (mounted) setState(() => _sosSending = false);
    }
  }

  Future<void> _handleCheckIn() async {
    if (_isCheckedIn) {
      // Check out — requires parent PIN
      PinVerifyDialog.show(
        context,
        title: 'Check Out',
        description: 'Enter the parent PIN to check out',
        onSuccess: () async {
          setState(() => _checkingIn = true);
          try {
            final position = await _getCurrentPosition();
            final client = ref.read(dioProvider);
            final profileId = ref.read(authProvider).childProfileId;
            if (profileId != null && position != null) {
              await client.post('/location/child/checkin', data: {
                'profileId': profileId,
                'latitude': position.latitude,
                'longitude': position.longitude,
                'message': 'Child checked out',
              });
            }
            final now = DateTime.now();
            await CheckInState.save(profileId!, isIn: false);
            if (mounted) {
              setState(() {
                _isCheckedIn = false;
                _checkedInAt = null;
                _checkingIn = false;
              });
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Checked out successfully'), backgroundColor: Colors.orange),
              );
            }
          } catch (_) {
            if (mounted) setState(() => _checkingIn = false);
          }
        },
      );
    } else {
      // Check in
      setState(() => _checkingIn = true);
      try {
        final position = await _getCurrentPosition();
        if (position == null) {
          if (mounted) {
            setState(() => _checkingIn = false);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Could not get location. Please enable location access.'), backgroundColor: Colors.orange),
            );
          }
          return;
        }
        final client = ref.read(dioProvider);
        final profileId = ref.read(authProvider).childProfileId;
        await client.post('/location/child/checkin', data: {
          'profileId': profileId,
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracy': position.accuracy,
          'message': 'Child checked in',
        });
        final now = DateTime.now().toIso8601String();
        await CheckInState.save(profileId!, isIn: true, at: now);
        if (mounted) {
          setState(() {
            _isCheckedIn = true;
            _checkedInAt = now;
            _checkingIn = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('✓ Checked in! Parent notified.'), backgroundColor: Colors.green),
          );
        }
      } catch (e) {
        if (mounted) {
          setState(() => _checkingIn = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Check-in failed: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final profileId = auth.childProfileId ?? '';
    final usageSummary = ref.watch(childUsageSummaryProvider(profileId));
    final tasks = ref.watch(childTasksProvider(profileId));
    final bank = ref.watch(childBankProvider(profileId));

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final locked = await AppLockService.isChildLocked();
        if (locked && context.mounted) {
          PinVerifyDialog.show(context,
            title: 'Exit App',
            description: 'Enter the parent PIN to exit Shield',
            onSuccess: () => SystemNavigator.pop(),
          );
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : CustomScrollView(
                slivers: [
                  // ── Sliver App Bar ────────────────────────────────────────
                  SliverAppBar(
                    expandedHeight: 140,
                    floating: false,
                    pinned: true,
                    automaticallyImplyLeading: false,
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    foregroundColor: Colors.white,
                    actions: [
                      if (_batteryPct >= 0)
                        Padding(
                          padding: const EdgeInsets.only(right: 4),
                          child: _BatteryChip(level: _batteryPct),
                        ),
                      IconButton(
                        icon: const Icon(Icons.lock_outline, size: 20),
                        tooltip: 'Parent access',
                        onPressed: () => _showParentOptions(context),
                      ),
                    ],
                    flexibleSpace: FlexibleSpaceBar(
                      titlePadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                      title: Row(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Flexible(
                            child: Text('Hi, ${auth.childName ?? auth.name ?? 'there'}! 👋',
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white,
                                shadows: [Shadow(color: Colors.black26, blurRadius: 4)]),
                              maxLines: 1, overflow: TextOverflow.ellipsis),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: _isCheckedIn ? Colors.green.shade700 : Colors.white24,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(_isCheckedIn ? '● In' : '○ Out',
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
                          ),
                        ],
                      ),
                      background: Stack(
                        children: [
                          Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                // Deep blue always — white text is always readable on this header
                                colors: [Color(0xFF1565C0), Color(0xFF0D47A1), Color(0xFF1A237E)],
                              ),
                            ),
                          ),
                          Positioned(
                            right: -20,
                            top: -20,
                            child: Opacity(
                              opacity: 0.08,
                              child: Icon(Icons.shield, size: 180, color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  SliverPadding(
                    padding: const EdgeInsets.all(16),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([

                        // ── SOS Button ──────────────────────────────────────
                        _SosButton(
                          sending: _sosSending,
                          result: _sosResult,
                          controller: _sosController,
                          onTap: _sosSending ? null : _sendSos,
                        ),
                        const SizedBox(height: 16),

                        // ── Check In / Check Out ─────────────────────────────
                        _CheckInCard(
                          isCheckedIn: _isCheckedIn,
                          checkedInAt: _checkedInAt,
                          loading: _checkingIn,
                          onTap: _checkingIn ? null : _handleCheckIn,
                        ),
                        const SizedBox(height: 16),

                        // ── Quick Stats Row ──────────────────────────────────
                        usageSummary.when(
                          data: (data) => _StatsRow(data: data),
                          loading: () => const SizedBox(height: 80, child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
                          error: (_, __) => const SizedBox.shrink(),
                        ),
                        const SizedBox(height: 16),

                        // ── Tasks ────────────────────────────────────────────
                        _TasksCard(tasksAsync: tasks, profileId: profileId),
                        const SizedBox(height: 16),

                        // ── Rewards ──────────────────────────────────────────
                        _RewardsCard(bankAsync: bank, profileId: profileId),
                        const SizedBox(height: 16),

                        // ── Safe Zones ───────────────────────────────────────
                        _GeofenceCard(profileId: profileId),
                        const SizedBox(height: 80),
                      ]),
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  void _showParentOptions(BuildContext context) {
    PinVerifyDialog.show(
      context,
      title: 'Parent Access',
      description: 'Enter parent PIN',
      onSuccess: () async {
        if (!context.mounted) return;
        final choice = await showModalBottomSheet<String>(
          context: context,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
          builder: (_) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(width: 40, height: 4, margin: const EdgeInsets.symmetric(vertical: 12), decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
                const ListTile(title: Text('Parent Options', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18))),
                ListTile(
                  leading: const CircleAvatar(backgroundColor: Color(0xFFFFEBEE), child: Icon(Icons.exit_to_app, color: Colors.red)),
                  title: const Text('Exit Child Mode', style: TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: const Text('Remove parental controls from this device'),
                  onTap: () => Navigator.pop(context, 'exit'),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        );
        if (choice == 'exit' && context.mounted) {
          // Unsubscribe from APK-update topic before logging out of child mode
          try {
            await FirebaseMessaging.instance.unsubscribeFromTopic('shield-child-devices');
            debugPrint('[Shield] Unsubscribed from topic shield-child-devices');
          } catch (e) {
            debugPrint('[Shield] Topic unsubscribe failed: $e');
          }
          await ref.read(authProvider.notifier).logout();
          if (context.mounted) context.go('/login');
        }
      },
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _SosButton extends StatelessWidget {
  final bool sending;
  final String? result;
  final AnimationController controller;
  final VoidCallback? onTap;
  const _SosButton({required this.sending, this.result, required this.controller, this.onTap});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Column(
        children: [
          Text('Emergency SOS', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: colorScheme.onSurface)),
          const SizedBox(height: 4),
          const Text('Press and hold in an emergency', style: TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: onTap,
            child: AnimatedBuilder(
              animation: controller,
              builder: (_, child) => Container(
                width: 130,
                height: 130,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.red.shade600,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.red.withOpacity(0.3 + controller.value * 0.3),
                      blurRadius: 20 + controller.value * 20,
                      spreadRadius: 2 + controller.value * 6,
                    ),
                  ],
                ),
                child: Center(
                  child: sending
                      ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 3)
                      : const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.warning_amber_rounded, size: 40, color: Colors.white),
                            SizedBox(height: 2),
                            Text('SOS', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 3)),
                          ],
                        ),
                ),
              ),
            ),
          ),
          if (result != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: result!.contains('✓') ? Colors.green.shade50 : Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(result!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: result!.contains('✓') ? Colors.green.shade700 : Colors.red.shade700,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CheckInCard extends StatelessWidget {
  final bool isCheckedIn;
  final String? checkedInAt;
  final bool loading;
  final VoidCallback? onTap;
  const _CheckInCard({required this.isCheckedIn, this.checkedInAt, required this.loading, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isCheckedIn
              ? [const Color(0xFF1B5E20), const Color(0xFF2E7D32)]   // green — checked in
              : [const Color(0xFF1565C0), const Color(0xFF0D47A1)],  // blue  — not checked in
          // Always use deep saturated colours — white text must be readable on this card
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: (isCheckedIn ? Colors.green : Colors.blue).withOpacity(0.25),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.18),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isCheckedIn ? Icons.location_on : Icons.location_off_outlined,
              color: Colors.white, size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  isCheckedIn ? 'Checked In ✓' : 'Not Checked In',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  isCheckedIn && checkedInAt != null
                      ? 'Since ${_formatTime(checkedInAt!)}'
                      : isCheckedIn ? 'Parents can see you' : 'Tap to share location',
                  style: TextStyle(color: Colors.white.withOpacity(0.82), fontSize: 11),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 88,
            child: ElevatedButton(
              onPressed: onTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: isCheckedIn ? Colors.green.shade700 : const Color(0xFF1565C0),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                elevation: 0,
              ),
              child: loading
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(
                      isCheckedIn ? 'Check Out' : 'Check In',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                      maxLines: 1,
                    ),
            ),
          ),
        ],
      ),
    );
  }

  static String _formatTime(String iso) {
    try {
      final d = DateTime.parse(iso).toLocal();
      final h = d.hour.toString().padLeft(2, '0');
      final m = d.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) { return 'today'; }
  }
}

class _StatsRow extends StatelessWidget {
  final Map<String, dynamic> data;
  const _StatsRow({required this.data});

  @override
  Widget build(BuildContext context) {
    final queries = data['dnsQueries'] as int? ?? 0;
    final blocked = data['blockedQueries'] as int? ?? 0;
    final screenMins = data['screenTimeMinutes'] as int? ?? 0;
    final blockPct = queries > 0 ? ((blocked / queries) * 100).round() : 0;
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.bar_chart_rounded, color: colorScheme.primary, size: 20),
            const SizedBox(width: 8),
            Text("Today's Activity", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: colorScheme.onSurface)),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: _StatTile(icon: Icons.dns_rounded, label: 'Requests', value: '$queries', color: colorScheme.primary)),
            const SizedBox(width: 10),
            Expanded(child: _StatTile(icon: Icons.block_rounded, label: 'Blocked', value: '$blockPct%', color: Colors.red.shade400)),
            const SizedBox(width: 10),
            Expanded(child: _StatTile(icon: Icons.timer_rounded, label: 'Screen', value: screenMins > 0 ? '${screenMins}m' : '--', color: Colors.orange.shade600)),
          ]),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  const _StatTile({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: color.withOpacity(0.12), shape: BoxShape.circle),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(height: 8),
        Text(value, style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: color)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurface.withOpacity(0.55), fontWeight: FontWeight.w500)),
      ]),
    );
  }
}

class _TasksCard extends ConsumerStatefulWidget {
  final AsyncValue<List<Map<String, dynamic>>> tasksAsync;
  final String profileId;
  const _TasksCard({required this.tasksAsync, required this.profileId});

  @override
  ConsumerState<_TasksCard> createState() => _TasksCardState();
}

class _TasksCardState extends ConsumerState<_TasksCard> {
  // Optimistic overrides: taskId -> true (completed)
  final Map<String, bool> _optimistic = {};
  final Set<String> _completing = {};

  Future<void> _completeTask(Map<String, dynamic> task) async {
    final id = task['id']?.toString();
    if (id == null) return;
    if (_completing.contains(id)) return;
    if (_optimistic[id] == true || task['completed'] == true) return;

    setState(() {
      _optimistic[id] = true;
      _completing.add(id);
    });

    try {
      final client = ref.read(dioProvider);
      await client.patch('/rewards/tasks/$id/complete');
      final pts = task['points'] as int? ?? 0;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Task completed! +$pts points 🎉'),
            backgroundColor: Colors.green.shade700,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
        ref.invalidate(childTasksProvider(widget.profileId));
      }
    } catch (e) {
      // Revert optimistic update on failure
      if (mounted) {
        setState(() => _optimistic.remove(id));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Could not complete task. Please try again.'),
            backgroundColor: Colors.red.shade700,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _completing.remove(id));
    }
  }

  bool _isDone(Map<String, dynamic> task) {
    final id = task['id']?.toString() ?? '';
    return _optimistic[id] == true || task['completed'] == true;
  }

  @override
  Widget build(BuildContext context) {
    final tasksAsync = widget.tasksAsync;
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(10)),
                  child: Icon(Icons.emoji_events_rounded, color: Colors.amber.shade700, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(child: Text('My Tasks', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Theme.of(context).colorScheme.onSurface))),
                tasksAsync.maybeWhen(
                  data: (tasks) {
                    final done = tasks.where((t) => _isDone(t)).length;
                    final total = tasks.length;
                    if (total == 0) return const SizedBox.shrink();
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: done == total ? Colors.green.shade50 : Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: done == total ? Colors.green.shade200 : Colors.blue.shade100),
                      ),
                      child: Text('$done/$total done',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                              color: done == total ? Colors.green.shade700 : Colors.blue.shade700)),
                    );
                  },
                  orElse: () => const SizedBox.shrink(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          tasksAsync.when(
            data: (tasks) {
              if (tasks.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                  child: Center(
                    child: Column(children: [
                      Icon(Icons.check_circle_outline, size: 40, color: Colors.grey.shade300),
                      const SizedBox(height: 8),
                      Text('No tasks assigned yet',
                          style: TextStyle(color: Colors.grey.shade500, fontSize: 14)),
                      const SizedBox(height: 4),
                      Text('Your parent will assign tasks here 🎯',
                          style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
                    ]),
                  ),
                );
              }
              final totalPts = tasks.fold<int>(0, (s, t) => s + ((t['points'] as int?) ?? 0));
              final earnedPts = tasks.where((t) => _isDone(t))
                  .fold<int>(0, (s, t) => s + ((t['points'] as int?) ?? 0));
              return Column(
                children: [
                  if (totalPts > 0)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [Colors.amber.shade400, Colors.orange.shade400]),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(children: [
                          const Icon(Icons.stars_rounded, color: Colors.white, size: 22),
                          const SizedBox(width: 8),
                          Expanded(child: Text('$earnedPts / $totalPts points earned',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14))),
                          Text('${totalPts > 0 ? (earnedPts * 100 / totalPts).round() : 0}%',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
                        ]),
                      ),
                    ),
                  ...tasks.map((task) {
                    final done = _isDone(task);
                    final pts = task['points'] as int? ?? 0;
                    final taskId = task['id']?.toString() ?? '';
                    final isCompleting = _completing.contains(taskId);
                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(14),
                        onTap: (!done && !isCompleting) ? () => _completeTask(task) : null,
                        child: Container(
                          margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: done ? Colors.green.shade50 : Theme.of(context).colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                                color: done ? Colors.green.shade200 : Colors.grey.shade200,
                                width: done ? 1.5 : 1),
                          ),
                          child: Row(children: [
                            Container(
                              width: 28, height: 28,
                              decoration: BoxDecoration(
                                color: done ? Colors.green.shade100 : Colors.grey.shade100,
                                shape: BoxShape.circle,
                              ),
                              child: isCompleting
                                  ? Padding(
                                      padding: const EdgeInsets.all(5),
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.green.shade600),
                                    )
                                  : Icon(done ? Icons.check_rounded : Icons.circle_outlined,
                                        color: done ? Colors.green.shade700 : Colors.grey.shade400, size: 18),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Text(
                              task['title'] as String? ?? 'Task',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                decoration: done ? TextDecoration.lineThrough : null,
                                color: done ? Colors.grey.shade500 : Theme.of(context).colorScheme.onSurface,
                              ),
                            )),
                            if (!done && !isCompleting)
                              Padding(
                                padding: const EdgeInsets.only(right: 6),
                                child: Text('Tap to complete',
                                  style: TextStyle(fontSize: 10, color: Colors.blue.shade400, fontWeight: FontWeight.w500)),
                              ),
                            if (pts > 0)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: done ? Colors.green.shade100 : Colors.amber.shade100,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Icon(Icons.star_rounded, size: 12,
                                      color: done ? Colors.green.shade600 : Colors.amber.shade700),
                                  const SizedBox(width: 3),
                                  Text('$pts', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800,
                                      color: done ? Colors.green.shade700 : Colors.amber.shade800)),
                                ]),
                              ),
                          ]),
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 8),
                ],
              );
            },
            loading: () => const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            error: (_, __) => Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: Text('Could not load tasks', style: TextStyle(color: Colors.grey.shade500)),
            ),
          ),
        ],
      ),
    );
  }
}

class _BatteryChip extends StatelessWidget {
  final int level;
  const _BatteryChip({required this.level});

  @override
  Widget build(BuildContext context) {
    final color = level < 20 ? Colors.red.shade300 : level < 50 ? Colors.orange.shade300 : Colors.green.shade300;
    final icon = level < 20 ? Icons.battery_alert : level < 50 ? Icons.battery_3_bar : Icons.battery_full;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 3),
        Text('$level%', style: TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

// ── Rewards Card (home screen teaser) ────────────────────────────────────────

class _RewardsCard extends ConsumerWidget {
  final AsyncValue<Map<String, dynamic>> bankAsync;
  final String profileId;
  const _RewardsCard({required this.bankAsync, required this.profileId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colorScheme = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: () => context.push('/child/rewards'),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [colorScheme.primary, colorScheme.primaryContainer],
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: colorScheme.primary.withOpacity(0.3),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.emoji_events_rounded, color: Colors.amber, size: 30),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('My Rewards',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 3),
                  bankAsync.when(
                    data: (bank) {
                      final pts = bank['pointsBalance'] as int? ?? 0;
                      final mins = bank['minutesBalance'] as int? ?? 0;
                      final streak = bank['streakDays'] as int? ?? 0;
                      return Row(children: [
                        _MiniStat(label: '$pts pts', icon: Icons.stars_rounded, color: Colors.amber.shade300),
                        const SizedBox(width: 12),
                        _MiniStat(label: '${mins}m time', icon: Icons.timer_rounded, color: Colors.lightBlue.shade200),
                        if (streak > 0) ...[
                          const SizedBox(width: 12),
                          _MiniStat(label: '$streak day streak', icon: Icons.local_fire_department_rounded, color: Colors.orange.shade300),
                        ],
                      ]);
                    },
                    loading: () => Text('Loading...', style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 12)),
                    error: (_, __) => Text('Tap to view rewards', style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 12)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right_rounded, color: Colors.white70, size: 26),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  const _MiniStat({required this.label, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 13, color: color),
      const SizedBox(width: 3),
      Text(label,
          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
    ]);
  }
}

// ── Geofence Card (child read-only safe zones view) ───────────────────────────

class _GeofenceCard extends ConsumerWidget {
  final String profileId;
  const _GeofenceCard({required this.profileId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final geofencesAsync = ref.watch(childGeofencesProvider(profileId));
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.shield_outlined, color: colorScheme.primary, size: 20),
            const SizedBox(width: 8),
            Text('My Safe Zones',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: colorScheme.onSurface)),
          ]),
          const SizedBox(height: 14),
          geofencesAsync.when(
            data: (zones) {
              if (zones.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text('No zones configured',
                        style: TextStyle(color: colorScheme.onSurface.withOpacity(0.45), fontSize: 13)),
                  ),
                );
              }
              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: zones.map((zone) {
                  final name = zone['name'] as String? ?? 'Zone';
                  final type = (zone['type'] as String? ?? '').toUpperCase();
                  final isRestricted = type == 'RESTRICTED' || type == 'SCHOOL';
                  return Chip(
                    avatar: Icon(
                      isRestricted ? Icons.block_rounded : Icons.home_rounded,
                      size: 16,
                      color: isRestricted ? Colors.red.shade700 : Colors.green.shade700,
                    ),
                    label: Text(name,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isRestricted ? Colors.red.shade800 : Colors.green.shade800,
                        )),
                    backgroundColor: isRestricted ? Colors.red.shade50 : Colors.green.shade50,
                    side: BorderSide(
                      color: isRestricted ? Colors.red.shade200 : Colors.green.shade200,
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                  );
                }).toList(),
              );
            },
            loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
            error: (_, __) => Text('Could not load zones',
                style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}
