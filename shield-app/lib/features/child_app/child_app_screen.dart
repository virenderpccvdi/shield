import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:installed_apps/installed_apps.dart';
import 'package:installed_apps/app_info.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/app_lock_service.dart';
import '../../core/app_blocking_service.dart';
import '../../core/battery_service.dart';
import '../../core/background_location_service.dart';
import '../../core/dns_vpn_service.dart';
import '../../core/shield_widgets.dart';
import '../../core/shake_detector_service.dart';
import '../../app/theme.dart';
import 'checkin_button.dart';
import 'pin_verify_dialog.dart';
import 'screen_time_budget_widget.dart';
import 'screen_time_request_screen.dart';
import 'ai_chat_screen.dart' show AiChatScreen;

final childUsageSummaryProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, profileId) async {
  final client = ref.read(dioProvider);
  try {
    final res = await client.get('/analytics/$profileId/stats');
    final d = res.data['data'] as Map? ?? {};
    return {
      'dnsQueries': d['totalQueries'] ?? 0,
      'blockedQueries': d['totalBlocked'] ?? 0,
      'screenTimeMinutes': 0,
    };
  } catch (_) { return {}; }
});

final childTasksProvider = FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, profileId) async {
  final client = ref.read(dioProvider);
  try {
    final res = await client.get('/rewards/tasks/$profileId');
    final raw = res.data;
    final list = raw is List ? raw : (raw is Map ? (raw['data'] as List? ?? []) : <dynamic>[]);
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  } catch (_) { return []; }
});

final childBankProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, profileId) async {
  final client = ref.read(dioProvider);
  try {
    final res = await client.get('/rewards/bank/$profileId');
    final data = res.data['data'] as Map? ?? res.data as Map? ?? {};
    return Map<String, dynamic>.from(data);
  } catch (_) { return {}; }
});

final childEmergencyContactsProvider = FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, profileId) async {
  if (profileId.isEmpty) return [];
  final client = ref.read(dioProvider);
  try {
    final res = await client.get('/profiles/$profileId/emergency-contacts');
    final raw = res.data['data'];
    final list = raw is List ? raw : [];
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  } catch (_) { return []; }
});

final childGeofencesProvider = FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, profileId) async {
  if (profileId.isEmpty) return [];
  final client = ref.read(dioProvider);
  try {
    // Geofences live in shield-location: GET /location/{profileId}/geofences
    final res = await client.get('/location/$profileId/geofences');
    final raw = res.data['data'];
    final list = raw is List ? raw : (raw is Map ? (raw['content'] ?? []) : []);
    return (list as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  } catch (_) { return []; }
});

class ChildAppScreen extends ConsumerStatefulWidget {
  const ChildAppScreen({super.key});
  @override
  ConsumerState<ChildAppScreen> createState() => _ChildAppScreenState();
}

class _ChildAppScreenState extends ConsumerState<ChildAppScreen> with TickerProviderStateMixin {
  bool _sosSending = false;
  String? _sosResult;
  bool _loading = true;
  bool _vpnActive = false;
  AppBlockingStatus _blockingStatus = AppBlockingStatus.unavailable;
  Timer? _refreshTimer;
  int _batteryPct = -1;
  late AnimationController _sosController;
  Timer? _heartbeatTimer;
  Timer? _locationTimer;
  Timer? _appsTimer;
  final ShakeDetectorService _shakeDetector = ShakeDetectorService();
  final BatteryService _batteryService = BatteryService();

  @override
  void initState() {
    super.initState();
    _sosController = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat(reverse: true);
    _loadInitialState();
    _startDnsVpn();
    _sendHeartbeat();
    // Refresh all data providers every 60 seconds for real-time feel
    _refreshTimer = Timer.periodic(const Duration(seconds: 60), (_) => _refreshProviders());
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) => _sendHeartbeat());
    _sendBackgroundLocation();
    _locationTimer = Timer.periodic(const Duration(seconds: 30), (_) => _sendBackgroundLocation());
    _syncInstalledApps();
    _appsTimer = Timer.periodic(const Duration(minutes: 30), (_) => _syncInstalledApps());
    _startAppBlocking();
    // CS-02: Panic shake gesture — start listening for rapid shakes
    _shakeDetector.setOnShakeSos(_sendShakeSos);
    _shakeDetector.start();
    // CS-04: Start battery alert reporting
    _startBatteryService();
    // Start background location service to keep tracking alive when app is minimized
    _startBackgroundService();
  }

  @override
  void dispose() {
    _sosController.dispose();
    _heartbeatTimer?.cancel();
    _locationTimer?.cancel();
    _appsTimer?.cancel();
    _refreshTimer?.cancel();
    _shakeDetector.stop();
    _batteryService.stop();
    // Note: VPN service is intentionally NOT stopped here — it should keep running
    // even if the app goes to background so filtering stays active.
    super.dispose();
  }

  /// CS-04: Start the battery level reporting service.
  void _startBatteryService() {
    final profileId = ref.read(authProvider).childProfileId ?? '';
    if (profileId.isEmpty) return;
    final dio = ref.read(dioProvider);
    _batteryService.start(dio: dio, profileId: profileId);
  }

  Future<void> _loadInitialState() async {
    try {
      final battery = Battery();
      _batteryPct = await battery.batteryLevel;
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _startBackgroundService() async {
    final auth = ref.read(authProvider);
    final profileId = auth.childProfileId;
    final token = auth.accessToken;
    if (profileId == null || token == null) return;
    // Save credentials for background isolate
    await saveChildCredentialsForBackground(token: token, profileId: profileId);
    // Start the background service
    final service = FlutterBackgroundService();
    final isRunning = await service.isRunning();
    if (!isRunning) {
      await service.startService();
    }
  }

  /// Invalidate all FutureProviders to force re-fetch (real-time updates).
  void _refreshProviders() {
    final profileId = ref.read(authProvider).childProfileId ?? '';
    if (profileId.isEmpty || !mounted) return;
    ref.invalidate(childUsageSummaryProvider(profileId));
    ref.invalidate(childTasksProvider(profileId));
    ref.invalidate(childBankProvider(profileId));
    ref.invalidate(childGeofencesProvider(profileId));
  }

  /// Fetch the child profile's DoH URL from the server and start the DNS VPN.
  /// Called on every app launch — idempotent (VPN service ignores if already running).
  Future<void> _startDnsVpn() async {
    final profileId = ref.read(authProvider).childProfileId;
    if (profileId == null) {
      debugPrint('[Shield] VPN start skipped — no profileId');
      return;
    }
    try {
      // Step 1: Try to fetch doH URL from server
      String? dohUrl;
      try {
        final client = ref.read(dioProvider);
        final res = await client.get('/dns/rules/$profileId');
        final data = res.data['data'] as Map? ?? res.data as Map? ?? {};
        dohUrl = data['dohUrl']?.toString();
        // If server returned empty dohUrl, try constructing from dnsClientId
        if ((dohUrl == null || dohUrl.isEmpty) && data['dnsClientId'] != null) {
          final dnsClientId = data['dnsClientId'].toString();
          dohUrl = 'https://shield.rstglobal.in/dns/$dnsClientId/dns-query';
          debugPrint('[Shield] Constructed dohUrl from dnsClientId: $dohUrl');
        }
      } catch (e) {
        debugPrint('[Shield] Failed to fetch DNS rules: $e');
      }

      // Step 2: If still no URL, try fetching the profile to get dnsClientId
      if (dohUrl == null || dohUrl.isEmpty) {
        try {
          final client = ref.read(dioProvider);
          final profRes = await client.get('/profiles/$profileId');
          final profData = profRes.data['data'] as Map? ?? profRes.data as Map? ?? {};
          final dnsClientId = profData['dnsClientId']?.toString();
          if (dnsClientId != null && dnsClientId.isNotEmpty) {
            dohUrl = 'https://shield.rstglobal.in/dns/$dnsClientId/dns-query';
            debugPrint('[Shield] Constructed dohUrl from profile dnsClientId: $dohUrl');
          }
        } catch (e) {
          debugPrint('[Shield] Failed to fetch profile for dnsClientId: $e');
        }
      }

      if (dohUrl == null || dohUrl.isEmpty) {
        debugPrint('[Shield] No dohUrl available — VPN cannot start');
        if (mounted) setState(() => _vpnActive = false);
        return;
      }

      // Step 3: Ensure VPN permission is granted (may have been granted during setup)
      final permissionGranted = await DnsVpnService.preparePermission();
      if (!permissionGranted) {
        debugPrint('[Shield] VPN permission denied — prompting user');
        if (mounted) {
          setState(() => _vpnActive = false);
          _promptVpnPermission(dohUrl);
        }
        return;
      }

      // Step 4: Start VPN
      final started = await DnsVpnService.start(dohUrl);
      debugPrint('[Shield] VPN start result: $started');

      // Step 5: Verify running status
      final running = await DnsVpnService.isRunning();
      if (mounted) {
        setState(() => _vpnActive = running || started);
        if (running || started) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: const Text('DNS Protection enabled'),
            backgroundColor: ShieldTheme.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            duration: const Duration(seconds: 2),
          ));
        }
      }
    } catch (e) {
      debugPrint('[Shield] VPN start failed: $e');
      if (mounted) setState(() => _vpnActive = false);
    }
  }

  /// Show a dialog explaining why VPN permission is needed, with a Retry button.
  void _promptVpnPermission(String dohUrl) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Enable DNS Protection', style: TextStyle(fontWeight: FontWeight.w700)),
        content: const Text(
          'Shield needs to create a VPN connection to filter your internet and keep you safe.\n\n'
          'Tap "Enable" and then tap "OK" on the system dialog that appears.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Later'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final started = await DnsVpnService.start(dohUrl);
              if (mounted) setState(() => _vpnActive = started);
            },
            child: const Text('Enable'),
          ),
        ],
      ),
    );
  }

  /// Fetch blocked app list from server and activate app blocking enforcement.
  Future<void> _startAppBlocking() async {
    final auth = ref.read(authProvider);
    final profileId = auth.childProfileId;
    final childName = auth.childName ?? 'Child';
    if (profileId == null) return;
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/profiles/$profileId/apps/blocked');
      final raw = res.data['data'];
      final blocked = (raw is List ? raw : [])
          .map((e) => (e as Map)['packageName']?.toString() ?? '')
          .where((p) => p.isNotEmpty)
          .toList();

      final status = await AppBlockingService.setup(
        blockedPackages: blocked,
        childName: childName,
      );
      if (mounted) setState(() => _blockingStatus = status);

      if (status == AppBlockingStatus.needsUsageStatsPermission) {
        _promptUsageStatsPermission();
      }
    } catch (e) {
      // App blocking is best-effort — not critical
      debugPrint('[Shield] App blocking setup failed: $e');
    }
  }

  void _promptUsageStatsPermission() {
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Enable App Blocking'),
        content: const Text(
          'Your parent has restricted some apps on this device.\n\n'
          'To enforce app restrictions, Shield needs Usage Access permission.\n\n'
          'Tap "Enable" → find "Shield" in the list → turn it ON.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Later')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              AppBlockingService.openUsageStatsSettings();
            },
            child: const Text('Enable'),
          ),
        ],
      ),
    );
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

      // Read real today's foreground usage per package (requires PACKAGE_USAGE_STATS)
      final usageStats = await AppBlockingService.getUsageStats();

      final appList = apps.take(200).map((a) => {
        'packageName': a.packageName,
        'appName': a.name,
        'versionName': a.versionName,
        'systemApp': false,
        'usageTodayMinutes': usageStats[a.packageName] ?? 0,
      }).toList();
      await client.post('/profiles/apps/sync', data: {'profileId': profileId, 'apps': appList});

      // Bulk-sync per-app usage so backend can enforce time budgets
      final usageReport = usageStats.entries
          .where((e) => e.value > 0)
          .map((e) => {'packageName': e.key, 'minutesUsed': e.value})
          .toList();
      if (usageReport.isNotEmpty) {
        await client.post('/dns/app-budgets/$profileId/usage/sync', data: usageReport);
      }
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
          title: Row(children: [
            Icon(Icons.warning_amber_rounded, color: ShieldTheme.danger, size: 28),
            const SizedBox(width: 8),
            const Text('Send SOS Alert?', style: TextStyle(fontWeight: FontWeight.w800)),
          ]),
          content: const Text('This will immediately alert your parents with your current location. Only use in a real emergency.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              style: FilledButton.styleFrom(backgroundColor: ShieldTheme.danger),
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

  /// CS-02: Triggered automatically when the shake gesture is detected.
  /// Posts an SOS with triggerMethod=SHAKE and shows a brief snackbar.
  Future<void> _sendShakeSos() async {
    if (_sosSending) return; // already in progress
    setState(() { _sosSending = true; _sosResult = null; });
    try {
      final position = await _getCurrentPosition().catchError((_) => null);
      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      await client.post('/location/child/panic', data: {
        'profileId': profileId,
        'latitude': position?.latitude ?? 0.0,
        'longitude': position?.longitude ?? 0.0,
        'message': 'Child SOS — shake gesture triggered',
      });
      if (mounted) {
        setState(() => _sosResult = '\u2713 SOS sent! Your family has been alerted.');
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('SOS sent via shake gesture!'),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 4),
        ));
      }
    } catch (_) {
      if (mounted) setState(() => _sosResult = 'SOS failed. Please use the button.');
    } finally {
      if (mounted) setState(() => _sosSending = false);
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
            ? _ChildLoadingSkeleton()
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
                      // DNS protection status indicator
                      Padding(
                        padding: const EdgeInsets.only(right: 2),
                        child: Tooltip(
                          message: _vpnActive ? 'DNS protection active' : 'DNS protection inactive',
                          child: Icon(
                            _vpnActive ? Icons.security : Icons.security_outlined,
                            size: 18,
                            color: _vpnActive ? Colors.greenAccent : Colors.white38,
                          ),
                        ),
                      ),
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
                              color: _vpnActive ? ShieldTheme.success : Colors.white24,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(_vpnActive ? '🛡 Safe' : '⚠ Unprotected',
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
                                colors: [ShieldTheme.primary, ShieldTheme.primaryDark, Color(0xFF1A237E)],
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

                  // ── VPN Warning Banner ───────────────────────────────
                  if (!_vpnActive && !_loading)
                    SliverToBoxAdapter(
                      child: Container(
                        margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: ShieldTheme.warning.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: ShieldTheme.warning.withOpacity(0.4)),
                        ),
                        child: Row(children: [
                          Icon(Icons.shield_outlined, color: ShieldTheme.warning, size: 20),
                          const SizedBox(width: 10),
                          Expanded(child: Text('DNS Protection is OFF',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: ShieldTheme.warning))),
                          TextButton(
                            onPressed: _startDnsVpn,
                            child: const Text('Enable', style: TextStyle(fontWeight: FontWeight.w700)),
                          ),
                        ]),
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

                        // ── FC-03: "I'm Here" one-tap check-in ───────────────
                        const CheckInButton(),
                        const SizedBox(height: 16),

                        // ── Quick Stats Row ──────────────────────────────────
                        usageSummary.when(
                          data: (data) => _StatsRow(data: data),
                          loading: () => Row(children: [
                            Expanded(child: ShieldSkeleton(height: 80, radius: 12)),
                            const SizedBox(width: 10),
                            Expanded(child: ShieldSkeleton(height: 80, radius: 12)),
                            const SizedBox(width: 10),
                            Expanded(child: ShieldSkeleton(height: 80, radius: 12)),
                          ]),
                          error: (_, __) => const SizedBox.shrink(),
                        ),
                        const SizedBox(height: 16),

                        // ── FC-02: Request Screen Time ───────────────────────
                        _RequestTimeCard(onTap: () => showScreenTimeRequestSheet(context)),
                        const SizedBox(height: 16),

                        // ── CS-11: Daily Screen Time Budget ──────────────────
                        if (profileId.isNotEmpty)
                          ScreenTimeBudgetWidget(profileId: profileId),
                        if (profileId.isNotEmpty) const SizedBox(height: 16),

                        // ── Tasks ────────────────────────────────────────────
                        _TasksCard(tasksAsync: tasks, profileId: profileId),
                        const SizedBox(height: 16),

                        // ── Rewards ──────────────────────────────────────────
                        _RewardsCard(bankAsync: bank, profileId: profileId),
                        const SizedBox(height: 16),

                        // ── Safe Zones ───────────────────────────────────────
                        _GeofenceCard(profileId: profileId),
                        const SizedBox(height: 16),

                        // ── CS-03: Speed Dial / Emergency Contacts ─────────────
                        _SpeedDialCard(profileId: profileId),
                        const SizedBox(height: 16),

                        // ── Achievements ──────────────────────────────────────
                        const _AchievementsCard(),
                        const SizedBox(height: 16),

                        // ── Learning Buddy (AI Chat) ──────────────────────────
                        const _LearningBuddyCard(),
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
                  leading: CircleAvatar(backgroundColor: ShieldTheme.danger.withOpacity(0.1), child: Icon(Icons.exit_to_app, color: ShieldTheme.danger)),
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

class _ChildLoadingSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 140,
          pinned: true,
          automaticallyImplyLeading: false,
          backgroundColor: ShieldTheme.primary,
        ),
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              ShieldSkeleton(height: 120, radius: 16),
              const SizedBox(height: 16),
              ShieldSkeleton(height: 80, radius: 16),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: ShieldSkeleton(height: 80, radius: 12)),
                const SizedBox(width: 10),
                Expanded(child: ShieldSkeleton(height: 80, radius: 12)),
                const SizedBox(width: 10),
                Expanded(child: ShieldSkeleton(height: 80, radius: 12)),
              ]),
              const SizedBox(height: 16),
              const ShieldCardSkeleton(lines: 4),
              const SizedBox(height: 16),
              const ShieldCardSkeleton(lines: 3),
            ]),
          ),
        ),
      ],
    );
  }
}

/// FC-02: Compact card that opens the screen-time request bottom sheet.
class _RequestTimeCard extends StatelessWidget {
  final VoidCallback onTap;
  const _RequestTimeCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 3))],
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: ShieldTheme.primary.withOpacity(0.10),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.timer_outlined, color: ShieldTheme.primary, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Request More Screen Time',
                    style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text('Ask your parent for extra time',
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: theme.colorScheme.onSurfaceVariant),
          ],
        ),
      ),
    );
  }
}

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
          const Text('Tap in an emergency to alert parents', style: TextStyle(fontSize: 12, color: Colors.grey)),
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
                  color: ShieldTheme.danger,
                  boxShadow: [
                    BoxShadow(
                      color: ShieldTheme.danger.withOpacity(0.3 + controller.value * 0.3),
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
                color: result!.contains('✓') ? ShieldTheme.success.withOpacity(0.08) : ShieldTheme.danger.withOpacity(0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(result!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: result!.contains('✓') ? ShieldTheme.success : ShieldTheme.danger,
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
            Expanded(child: _StatTile(icon: Icons.block_rounded, label: 'Blocked', value: '$blockPct%', color: ShieldTheme.dangerLight)),
            const SizedBox(width: 10),
            Expanded(child: _StatTile(icon: Icons.timer_rounded, label: 'Screen', value: screenMins > 0 ? '${screenMins}m' : '--', color: ShieldTheme.warning)),
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
    if (_isDone(task)) return;

    setState(() {
      _optimistic[id] = true;
      _completing.add(id);
    });

    try {
      final client = ref.read(dioProvider);
      await client.post('/rewards/tasks/$id/complete');
      final pts = task['points'] as int? ?? 0;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Task completed! +$pts points'),
          backgroundColor: ShieldTheme.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 2),
        ));
        ref.invalidate(childTasksProvider(widget.profileId));
      }
    } catch (e) {
      // Revert optimistic update on failure
      if (mounted) {
        setState(() => _optimistic.remove(id));
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Could not complete task. Please try again.'),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    } finally {
      if (mounted) setState(() => _completing.remove(id));
    }
  }

  bool _isDone(Map<String, dynamic> task) {
    final id = task['id']?.toString() ?? '';
    if (_optimistic[id] == true) return true;
    final status = task['status']?.toString().toUpperCase() ?? '';
    return status == 'COMPLETED' || status == 'SUBMITTED' || status == 'APPROVED' || task['completed'] == true;
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
                  decoration: BoxDecoration(color: ShieldTheme.warning.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                  child: Icon(Icons.emoji_events_rounded, color: ShieldTheme.warning, size: 20),
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
                        color: done == total ? ShieldTheme.success.withOpacity(0.08) : ShieldTheme.primary.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: done == total ? ShieldTheme.success.withOpacity(0.3) : ShieldTheme.primary.withOpacity(0.2)),
                      ),
                      child: Text('$done/$total done',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                              color: done == total ? ShieldTheme.success : ShieldTheme.primary)),
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
                          gradient: LinearGradient(colors: [ShieldTheme.warning, Color(0xFFE65100)]),
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
                            color: done ? ShieldTheme.success.withOpacity(0.07) : Theme.of(context).colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                                color: done ? ShieldTheme.success.withOpacity(0.3) : Colors.grey.shade200,
                                width: done ? 1.5 : 1),
                          ),
                          child: Row(children: [
                            Container(
                              width: 28, height: 28,
                              decoration: BoxDecoration(
                                color: done ? ShieldTheme.success.withOpacity(0.15) : Colors.grey.shade100,
                                shape: BoxShape.circle,
                              ),
                              child: isCompleting
                                  ? Padding(
                                      padding: const EdgeInsets.all(5),
                                      child: CircularProgressIndicator(strokeWidth: 2, color: ShieldTheme.successLight),
                                    )
                                  : Icon(done ? Icons.check_rounded : Icons.circle_outlined,
                                        color: done ? ShieldTheme.success : Colors.grey.shade400, size: 18),
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
                                  style: TextStyle(fontSize: 10, color: ShieldTheme.primaryLight, fontWeight: FontWeight.w500)),
                              ),
                            if (pts > 0)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: done ? ShieldTheme.success.withOpacity(0.12) : ShieldTheme.warning.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Icon(Icons.star_rounded, size: 12,
                                      color: done ? ShieldTheme.successLight : ShieldTheme.warning),
                                  const SizedBox(width: 3),
                                  Text('$pts', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800,
                                      color: done ? ShieldTheme.success : ShieldTheme.warning)),
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
    final color = level < 20 ? ShieldTheme.dangerLight : level < 50 ? ShieldTheme.warning : ShieldTheme.successLight;
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
                      color: isRestricted ? ShieldTheme.danger : ShieldTheme.success,
                    ),
                    label: Text(name,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isRestricted ? ShieldTheme.danger : ShieldTheme.success,
                        )),
                    backgroundColor: isRestricted ? ShieldTheme.danger.withOpacity(0.07) : ShieldTheme.success.withOpacity(0.07),
                    side: BorderSide(
                      color: isRestricted ? ShieldTheme.danger.withOpacity(0.3) : ShieldTheme.success.withOpacity(0.3),
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

/// CS-03: Speed Dial card — shows emergency contacts inline with call buttons.
class _SpeedDialCard extends ConsumerWidget {
  final String profileId;
  const _SpeedDialCard({required this.profileId});

  Future<void> _call(BuildContext context, String phone) async {
    final cleaned = phone.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri.parse('tel:$cleaned');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open phone dialer')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contactsAsync = ref.watch(childEmergencyContactsProvider(profileId));
    final colorScheme = Theme.of(context).colorScheme;
    const accentColor = Color(0xFFC62828);

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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.contact_emergency, color: accentColor, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text('Emergency Contacts',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: colorScheme.onSurface)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          contactsAsync.when(
            loading: () => const Center(child: Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: CircularProgressIndicator(strokeWidth: 2),
            )),
            error: (_, __) => Text('Could not load contacts',
              style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
            data: (contacts) {
              if (contacts.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text('No emergency contacts added.\nAsk your parent to add contacts.',
                    style: TextStyle(color: colorScheme.onSurface.withOpacity(0.45), fontSize: 13)),
                );
              }
              return Column(
                children: contacts.take(5).map((c) {
                  final name = c['name']?.toString() ?? 'Contact';
                  final phone = c['phone']?.toString() ?? '';
                  final rel = c['relationship']?.toString() ?? '';
                  final hasPhone = phone.isNotEmpty;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 20,
                          backgroundColor: accentColor.withOpacity(0.12),
                          child: Text(
                            name.isNotEmpty ? name[0].toUpperCase() : '?',
                            style: const TextStyle(fontWeight: FontWeight.w800, color: accentColor, fontSize: 16),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                              if (rel.isNotEmpty)
                                Text(rel, style: TextStyle(fontSize: 11, color: colorScheme.onSurface.withOpacity(0.55))),
                            ],
                          ),
                        ),
                        if (hasPhone) ...[
                          IconButton(
                            icon: const Icon(Icons.phone, color: Color(0xFF2E7D32), size: 22),
                            tooltip: 'Call $name',
                            onPressed: () => _call(context, phone),
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFF2E7D32).withOpacity(0.1),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ── Achievements Card ─────────────────────────────────────────────────────────

class _AchievementsCard extends StatelessWidget {
  const _AchievementsCard();

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/achievements'),
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF9A825), Color(0xFFF57F17)],
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFF9A825).withAlpha(70),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(30),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.emoji_events_rounded, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'My Achievements',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      letterSpacing: -0.2,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'View your badges and track your progress!',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12.5,
                      height: 1.3,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Colors.white70, size: 22),
          ],
        ),
      ),
    );
  }
}

// ── Learning Buddy Card ───────────────────────────────────────────────────────

class _LearningBuddyCard extends StatelessWidget {
  const _LearningBuddyCard();

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/chat'),
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF1565C0), Color(0xFF0D47A1)],
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1565C0).withAlpha(60),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(25),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.smart_toy_rounded, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Learning Buddy',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      letterSpacing: -0.2,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Ask me anything — homework, science, math & more!',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12.5,
                      height: 1.3,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Chat',
                style: TextStyle(
                  color: Color(0xFF1565C0),
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
