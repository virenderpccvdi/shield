import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:installed_apps/installed_apps.dart';
import 'package:installed_apps/app_info.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/app_lock_service.dart';
import 'pin_verify_dialog.dart';

/// Riverpod providers for child app data
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
  } catch (_) {
    return {};
  }
});

final childTasksProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, profileId) async {
  final client = ref.read(dioProvider);
  try {
    final res = await client.get('/rewards/tasks', queryParameters: {'profileId': profileId});
    return (res.data['data'] as List? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  } catch (_) {
    return [];
  }
});

class ChildAppScreen extends ConsumerStatefulWidget {
  const ChildAppScreen({super.key});
  @override
  ConsumerState<ChildAppScreen> createState() => _ChildAppScreenState();
}

class _ChildAppScreenState extends ConsumerState<ChildAppScreen> {
  bool _sosSending = false;
  bool _checkingIn = false;
  String? _sosResult;
  String? _checkInResult;
  Timer? _heartbeatTimer;
  Timer? _locationTimer;
  Timer? _appsTimer;

  @override
  void initState() {
    super.initState();
    // Start heartbeat immediately, then every 30 seconds
    _sendHeartbeat();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) => _sendHeartbeat());
    // Background location update every 2 minutes
    _locationTimer = Timer.periodic(const Duration(minutes: 2), (_) => _sendBackgroundLocation());
    // Sync installed apps on startup, then every 30 minutes
    _syncInstalledApps();
    _appsTimer = Timer.periodic(const Duration(minutes: 30), (_) => _syncInstalledApps());
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    _locationTimer?.cancel();
    _appsTimer?.cancel();
    super.dispose();
  }

  Future<void> _sendHeartbeat() async {
    try {
      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      if (profileId == null) return;
      await client.post('/profiles/devices/heartbeat', data: {'profileId': profileId});
    } catch (_) {}
  }

  Future<void> _sendBackgroundLocation() async {
    try {
      final position = await _getCurrentPosition();
      if (position == null) return;
      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      if (profileId == null) return;
      await client.post('/location/child/checkin', data: {
        'profileId': profileId,
        'latitude': position.latitude,
        'longitude': position.longitude,
      });
    } catch (_) {}
  }

  Future<void> _syncInstalledApps() async {
    try {
      final List<AppInfo> apps = await InstalledApps.getInstalledApps(true, false);
      if (apps.isEmpty) return;
      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      if (profileId == null) return;
      // Send non-system apps to backend (limit to 200)
      // Note: getInstalledApps(excludeSystemApps=true) already filters system apps
      final appList = apps
          .take(200)
          .map((a) => {
                'packageName': a.packageName,
                'appName': a.name,
                'versionName': a.versionName,
                'systemApp': false,
                'usageTodayMinutes': 0,
              })
          .toList();
      await client.post('/profiles/apps/sync', data: {
        'profileId': profileId,
        'apps': appList,
      });
    } catch (_) {}
  }

  Future<Position?> _getCurrentPosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Location services are disabled. Please enable them.')),
        );
      }
      return null;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location permission denied.')),
          );
        }
        return null;
      }
    }
    if (permission == LocationPermission.deniedForever) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Location permission permanently denied. Please enable in settings.')),
        );
      }
      return null;
    }

    return await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      ),
    ).timeout(const Duration(seconds: 12), onTimeout: () {
      throw Exception('Location timeout');
    });
  }

  Future<void> _sendSos() async {
    setState(() { _sosSending = true; _sosResult = null; });
    try {
      final position = await _getCurrentPosition();
      if (position == null) {
        setState(() { _sosSending = false; _sosResult = 'Could not get location'; });
        return;
      }

      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      await client.post('/location/child/panic', data: {
        'profileId': profileId,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'message': 'Child SOS alert',
      });

      setState(() { _sosResult = 'SOS sent! Your family has been alerted.'; });
    } catch (e) {
      setState(() { _sosResult = 'Failed to send SOS. Please try again.'; });
    } finally {
      setState(() { _sosSending = false; });
    }
  }

  Future<void> _checkIn() async {
    setState(() { _checkingIn = true; _checkInResult = null; });
    try {
      final position = await _getCurrentPosition();
      if (position == null) {
        setState(() { _checkingIn = false; _checkInResult = 'Could not get location. Please enable location access.'; });
        return;
      }
      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      await client.post('/location/child/checkin', data: {
        'profileId': profileId,
        'latitude': position.latitude,
        'longitude': position.longitude,
      });
      setState(() { _checkInResult = 'Checked in successfully!'; });
    } catch (e) {
      final msg = e.toString().contains('timeout')
          ? 'Location timed out. Check-in failed.'
          : 'Check-in failed. Try again.';
      setState(() { _checkInResult = msg; });
    } finally {
      if (mounted) setState(() { _checkingIn = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final profileId = auth.childProfileId ?? '';
    final usageSummary = ref.watch(childUsageSummaryProvider(profileId));
    final tasks = ref.watch(childTasksProvider(profileId));

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        // Child cannot leave the app without parent PIN
        final locked = await AppLockService.isChildLocked();
        if (locked && context.mounted) {
          PinVerifyDialog.show(
            context,
            title: 'Exit App',
            description: 'Enter the parent PIN to exit the Shield app',
            onSuccess: () => SystemNavigator.pop(),
          );
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
      appBar: AppBar(
        title: Text('Hi, ${auth.childName ?? auth.name ?? 'there'}!', style: const TextStyle(fontWeight: FontWeight.w700)),
        centerTitle: true,
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.lock_outline, size: 20),
            tooltip: 'Parent access',
            onPressed: () {
              PinVerifyDialog.show(
                context,
                title: 'Parent Access',
                description: 'Enter parent PIN',
                onSuccess: () async {
                  if (!context.mounted) return;
                  final choice = await showModalBottomSheet<String>(
                    context: context,
                    builder: (_) => SafeArea(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const ListTile(title: Text('Parent Options', style: TextStyle(fontWeight: FontWeight.w700))),
                          ListTile(
                            leading: const Icon(Icons.exit_to_app, color: Colors.red),
                            title: const Text('Exit Child Mode'),
                            subtitle: const Text('Remove child mode from this device'),
                            onTap: () => Navigator.pop(context, 'exit'),
                          ),
                          ListTile(
                            leading: const Icon(Icons.cancel_outlined),
                            title: const Text('Cancel'),
                            onTap: () => Navigator.pop(context, null),
                          ),
                        ],
                      ),
                    ),
                  );
                  if (choice == 'exit' && context.mounted) {
                    await ref.read(authProvider.notifier).logout();
                    if (context.mounted) context.go('/login');
                  }
                },
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(childUsageSummaryProvider(profileId));
          ref.invalidate(childTasksProvider(profileId));
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // --- SOS / Panic Button ---
            Center(
              child: Column(
                children: [
                  GestureDetector(
                    onTap: _sosSending ? null : _sendSos,
                    child: Container(
                      width: 160,
                      height: 160,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.red.shade700,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.red.withAlpha(100),
                            blurRadius: 24,
                            spreadRadius: 4,
                          ),
                        ],
                      ),
                      child: Center(
                        child: _sosSending
                            ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 3)
                            : const Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.warning_amber_rounded, size: 48, color: Colors.white),
                                  SizedBox(height: 4),
                                  Text('SOS', style: TextStyle(
                                    fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white,
                                    letterSpacing: 2,
                                  )),
                                ],
                              ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Tap for emergency alert',
                    style: TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                  if (_sosResult != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      _sosResult!,
                      style: TextStyle(
                        color: _sosResult!.contains('sent') ? Colors.green : Colors.red,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 24),

            // --- Check-In Button ---
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _checkingIn ? null : _checkIn,
                icon: _checkingIn
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.check_circle_outline),
                label: const Text('Check In', style: TextStyle(fontSize: 16)),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  backgroundColor: const Color(0xFF1565C0),
                ),
              ),
            ),
            if (_checkInResult != null) ...[
              const SizedBox(height: 6),
              Text(
                _checkInResult!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: _checkInResult!.contains('success') ? Colors.green : Colors.red,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ],
            const SizedBox(height: 24),

            // --- Today's Usage Summary ---
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.bar_chart, color: Color(0xFF1565C0)),
                        SizedBox(width: 8),
                        Text("Today's Usage", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    usageSummary.when(
                      data: (data) {
                        if (data.isEmpty) {
                          return const Text('No usage data yet today.', style: TextStyle(color: Colors.grey));
                        }
                        final screenMinutes = data['screenTimeMinutes'] as int? ?? 0;
                        final hours = screenMinutes ~/ 60;
                        final mins = screenMinutes % 60;
                        final queries = data['dnsQueries'] as int? ?? 0;
                        final blocked = data['blockedQueries'] as int? ?? 0;
                        return Column(
                          children: [
                            _UsageRow(icon: Icons.phone_android, label: 'Screen Time', value: '${hours}h ${mins}m'),
                            _UsageRow(icon: Icons.dns, label: 'DNS Queries', value: '$queries'),
                            _UsageRow(icon: Icons.block, label: 'Blocked', value: '$blocked'),
                          ],
                        );
                      },
                      loading: () => const Center(child: Padding(
                        padding: EdgeInsets.all(12),
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )),
                      error: (_, __) => const Text('Could not load usage data.', style: TextStyle(color: Colors.grey)),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // --- Tasks from Rewards ---
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.emoji_events, color: Color(0xFFFFA726)),
                        SizedBox(width: 8),
                        Text('My Tasks', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    tasks.when(
                      data: (taskList) {
                        if (taskList.isEmpty) {
                          return const Padding(
                            padding: EdgeInsets.symmetric(vertical: 8),
                            child: Text('No tasks assigned yet.', style: TextStyle(color: Colors.grey)),
                          );
                        }
                        return Column(
                          children: taskList.map((task) {
                            final completed = task['completed'] == true;
                            final points = task['points'] as int? ?? 0;
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(
                                completed ? Icons.check_circle : Icons.radio_button_unchecked,
                                color: completed ? Colors.green : Colors.grey,
                              ),
                              title: Text(
                                task['title'] as String? ?? 'Task',
                                style: TextStyle(
                                  decoration: completed ? TextDecoration.lineThrough : null,
                                  color: completed ? Colors.grey : null,
                                ),
                              ),
                              trailing: Chip(
                                label: Text('$points pts', style: const TextStyle(fontSize: 12)),
                                backgroundColor: Colors.amber.shade50,
                                side: BorderSide.none,
                                padding: EdgeInsets.zero,
                              ),
                            );
                          }).toList(),
                        );
                      },
                      loading: () => const Center(child: Padding(
                        padding: EdgeInsets.all(12),
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )),
                      error: (_, __) => const Text('Could not load tasks.', style: TextStyle(color: Colors.grey)),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }
}

class _UsageRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _UsageRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.grey.shade600),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(fontSize: 14)),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        ],
      ),
    );
  }
}
