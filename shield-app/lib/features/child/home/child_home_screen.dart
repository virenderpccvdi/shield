import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/services/dns_vpn_service.dart';
import '../../../core/services/background_service.dart';
import '../../../core/services/storage_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ChildHomeScreen — "Protective Bubble" — Guardian's Lens Child Mode
//
// Design changes from spec:
//  · secondary (#0288D1 Sky Blue) replaces primary as action color
//  · Corner radius lifted from 18 → 24px for friendlier feel
//  · Action tiles: no border, soft glass (8% white opacity, no outline)
//  · Clock: Manrope ultralight for ethereal feel
//  · Check-in button: gradient (child primary colors)
//  · "Parent Access" ghost text stays near-invisible (5% opacity)
//  · Points pill: tonal glass, no hard border
// ─────────────────────────────────────────────────────────────────────────────

// Child-mode accent colors (secondary role)
const _kChildBlue   = Color(0xFF0288D1);
const _kChildAction = Color(0xFF039BE5);
const _kBgTop       = Color(0xFF003D72);
const _kBgBottom    = Color(0xFF005DAC);

class ChildHomeScreen extends ConsumerStatefulWidget {
  const ChildHomeScreen({super.key});
  @override
  ConsumerState<ChildHomeScreen> createState() => _ChildHomeScreenState();
}

class _ChildHomeScreenState extends ConsumerState<ChildHomeScreen>
    with WidgetsBindingObserver {

  Timer? _heartbeatTimer;
  Timer? _batteryTimer;
  Timer? _clockTimer;
  final _battery = Battery();

  int    _batteryLevel = 100;
  bool   _vpnActive    = false;
  String _timeStr      = '';
  String _dateStr      = '';
  int?   _points;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _updateClock();
    _clockTimer = Timer.periodic(const Duration(seconds: 30), (_) => _updateClock());
    _init();
  }

  void _updateClock() {
    final now = DateTime.now();
    setState(() {
      _timeStr = DateFormat('HH:mm').format(now);
      _dateStr = DateFormat('EEEE, d MMMM').format(now);
    });
  }

  Future<void> _init() async {
    final auth = ref.read(authProvider);
    await _ensureVpn(auth.dohUrl);

    final token = await StorageService.instance.read('shield_child_token');
    final pid   = auth.childProfileId;
    if (token != null && pid != null) {
      await BackgroundServiceHelper.start(token: token, profileId: pid);
    }

    _batteryLevel = await _battery.batteryLevel;
    if (mounted) setState(() {});

    _heartbeatTimer = Timer.periodic(
        const Duration(minutes: 5), (_) => _sendHeartbeat());
    _batteryTimer = Timer.periodic(
        const Duration(minutes: 10), (_) async {
          _batteryLevel = await _battery.batteryLevel;
          if (mounted) setState(() {});
          _reportBattery();
        });

    if (pid != null) {
      try {
        final resp = await ApiClient.instance.get(Endpoints.points(pid));
        final pts  = resp.data is Map
            ? ((resp.data as Map<String, dynamic>)['points'] as num?)?.toInt() ?? 0
            : 0;
        if (mounted) setState(() => _points = pts);
      } catch (_) {}
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final auth = ref.read(authProvider);
      _ensureVpn(auth.dohUrl);
    }
  }

  Future<void> _ensureVpn(String? dohUrl) async {
    final running = await DnsVpnService.isRunning();
    if (!running && dohUrl != null && dohUrl.isNotEmpty) {
      await DnsVpnService.start(dohUrl: dohUrl);
    }
    _vpnActive = await DnsVpnService.isRunning();
    if (mounted) setState(() {});
  }

  void _sendHeartbeat() async {
    try {
      await ApiClient.instance.post(Endpoints.heartbeat,
          data: {'batteryLevel': _batteryLevel});
    } catch (_) {}
  }

  void _reportBattery() async {
    try {
      await ApiClient.instance.post(Endpoints.heartbeat,
          data: {'batteryLevel': _batteryLevel});
    } catch (_) {}
  }

  Future<void> _checkin() async {
    final pid = ref.read(authProvider).childProfileId;
    if (pid == null) return;
    try {
      await ApiClient.instance.post(Endpoints.checkin(pid));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Check-in sent ✓',
                style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
            backgroundColor: const Color(0xFF2E7D32),
            behavior:        SnackBarBehavior.floating,
            shape:           RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Check-in failed. Check your connection.',
                style: GoogleFonts.inter(color: Colors.white)),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _triggerSOS() async {
    final pid = ref.read(authProvider).childProfileId;
    if (pid == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Profile not found. Please re-setup this device.')));
      }
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF7F0000),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(children: [
          const Icon(Icons.sos_rounded, color: Colors.white, size: 28),
          const SizedBox(width: 10),
          Text('Emergency Alert',
              style: GoogleFonts.manrope(
                  color: Colors.white, fontSize: 18,
                  fontWeight: FontWeight.w700)),
        ]),
        content: Text(
          'This will immediately alert your parent with your current location. '
          'Use only in a real emergency.',
          style: GoogleFonts.inter(color: Colors.white70, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel',
                style: GoogleFonts.inter(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF7F0000),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12))),
            onPressed: () => Navigator.pop(context, true),
            child: Text('SEND SOS',
                style: GoogleFonts.inter(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    double? lat;
    double? lng;
    try {
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse) {
        final pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy:  LocationAccuracy.high,
            timeLimit: Duration(seconds: 8),
          ),
        );
        lat = pos.latitude;
        lng = pos.longitude;
      }
    } catch (_) {}

    try {
      await ApiClient.instance.post(
        Endpoints.childPanic,
        data: {
          'profileId': pid,
          if (lat != null) 'latitude':  lat,
          if (lng != null) 'longitude': lng,
          'message': 'Child triggered emergency SOS from Shield app',
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Emergency alert sent to your parent.',
                style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
            backgroundColor: const Color(0xFFC62828),
            duration:  const Duration(seconds: 5),
            behavior:  SnackBarBehavior.floating,
            shape:     RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to send SOS. Check your connection.',
                style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: Colors.orange[800],
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _promptParentPin() async {
    final pin = await StorageService.instance.getParentPin();
    if (!mounted) return;

    if (pin == null || pin.isEmpty) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text('Remove Protection',
              style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
          content: Text('Remove Shield protection from this device?',
              style: GoogleFonts.inter()),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Remove')),
          ],
        ),
      );
      if (ok == true) _exitChildMode();
      return;
    }

    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text('Parent PIN Required',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
        content: TextField(
          controller:   ctrl,
          keyboardType: TextInputType.number,
          obscureText:  true,
          maxLength:    6,
          autofocus:    true,
          decoration: InputDecoration(
            labelText:  'Enter Parent PIN',
            prefixIcon: const Icon(Icons.lock_rounded),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, ctrl.text == pin),
            child: const Text('Unlock'),
          ),
        ],
      ),
    );
    ctrl.dispose();

    if (ok == true) {
      _exitChildMode();
    } else if (ok == false && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Incorrect PIN',
              style: GoogleFonts.inter(color: Colors.white)),
          backgroundColor: const Color(0xFFC62828),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _exitChildMode() async {
    await DnsVpnService.stop();
    await BackgroundServiceHelper.stop();
    await ref.read(authProvider.notifier).deactivateChildDevice();
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    _batteryTimer?.cancel();
    _clockTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final name = auth.childName ?? 'there';

    return PopScope(
      canPop: false,
      child: Scaffold(
        body: Container(
          // Guardian gradient in child mode: top dark → bottom child-blue
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [_kBgTop, _kBgBottom],
              begin:  Alignment.topCenter,
              end:    Alignment.bottomCenter,
            ),
          ),
          child: Stack(children: [
            // Polished sapphire radial overlay
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(-0.6, -0.5),
                    radius: 1.1,
                    colors: [
                      _kChildBlue.withOpacity(0.25),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),

            SafeArea(
              child: Column(children: [
                // ── Status bar ─────────────────────────────────────────────
                _StatusBar(
                    vpnActive:    _vpnActive,
                    batteryLevel: _batteryLevel),

                const Spacer(flex: 2),

                // ── Clock: Manrope ultralight ───────────────────────────────
                Text(
                  _timeStr,
                  style: GoogleFonts.manrope(
                    color:       Colors.white,
                    fontSize:    64,
                    fontWeight:  FontWeight.w200,
                    letterSpacing: -3,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _dateStr,
                  style: GoogleFonts.inter(
                    color:       Colors.white.withOpacity(0.55),
                    fontSize:    14,
                    fontWeight:  FontWeight.w400,
                  ),
                ),

                const Spacer(flex: 1),

                // ── Greeting ────────────────────────────────────────────────
                Text(
                  'Hi, $name!',
                  style: GoogleFonts.manrope(
                    color:      Colors.white,
                    fontSize:   32,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.8,
                  ),
                ),
                const SizedBox(height: 8),
                if (_points != null)
                  _PointsPill(points: _points!)
                else
                  Text(
                    "You're safe and protected",
                    style: GoogleFonts.inter(
                      color:     Colors.white.withOpacity(0.6),
                      fontSize:  14,
                    ),
                  ),

                const Spacer(flex: 2),

                // ── Action grid: protective bubble tiles ────────────────────
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _BubbleTile(
                        icon:  Icons.task_alt_rounded,
                        label: 'Tasks',
                        color: const Color(0xFF43A047),
                        onTap: () => context.push('/child/tasks'),
                      ),
                      _BubbleTile(
                        icon:  Icons.star_rounded,
                        label: 'Rewards',
                        color: const Color(0xFFFF8F00),
                        onTap: () => context.push('/child/rewards'),
                      ),
                      _BubbleTile(
                        icon:  Icons.smart_toy_rounded,
                        label: 'AI Chat',
                        color: const Color(0xFF7B1FA2),
                        onTap: () => context.push('/child/chat'),
                      ),
                    ],
                  ),
                ),

                const Spacer(flex: 2),

                // ── Check-in button: child gradient ─────────────────────────
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: _ChildButton(
                    label:     'Check In with Parent',
                    icon:      Icons.check_circle_rounded,
                    onPressed: _checkin,
                  ),
                ),
                const SizedBox(height: 10),

                // ── SOS: outlined, clearly dangerous ────────────────────────
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: SizedBox(
                    width:  double.infinity,
                    height: 50,
                    child: OutlinedButton.icon(
                      onPressed: _triggerSOS,
                      icon:  const Icon(Icons.sos_rounded,
                          color: Color(0xFFEF9A9A)),
                      label: Text('Emergency SOS',
                          style: GoogleFonts.inter(
                            color:      const Color(0xFFEF9A9A),
                            fontSize:   15,
                            fontWeight: FontWeight.w700,
                          )),
                      style: OutlinedButton.styleFrom(
                        side:  const BorderSide(
                            color: Color(0xFFEF9A9A), width: 1.5),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(24)),
                      ),
                    ),
                  ),
                ),

                // ── Ghost parent access ─────────────────────────────────────
                GestureDetector(
                  onLongPress: _promptParentPin,
                  behavior:    HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(0, 20, 0, 12),
                    child: Text('Parent Access',
                        style: GoogleFonts.inter(
                          color:    Colors.white.withOpacity(0.05),
                          fontSize: 11,
                        )),
                  ),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

// ── Status bar ────────────────────────────────────────────────────────────────

class _StatusBar extends StatelessWidget {
  const _StatusBar({required this.vpnActive, required this.batteryLevel});
  final bool vpnActive;
  final int  batteryLevel;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
    child: Row(children: [
      const Icon(Icons.shield_rounded, color: Colors.white60, size: 16),
      const SizedBox(width: 6),
      Text('Shield',
          style: GoogleFonts.manrope(
            color: Colors.white60, fontSize: 13,
            fontWeight: FontWeight.w700)),
      const Spacer(),
      // VPN protection badge (glass tonal)
      _GlassBadge(
        label: vpnActive ? 'Protected' : 'VPN Off',
        color: vpnActive
            ? const Color(0xFF2E7D32)
            : const Color(0xFFC62828),
        icon:  vpnActive
            ? Icons.security_rounded
            : Icons.security_outlined,
      ),
      const SizedBox(width: 8),
      // Battery
      Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(
          batteryLevel > 60
              ? Icons.battery_full_rounded
              : batteryLevel > 20
                  ? Icons.battery_4_bar_rounded
                  : Icons.battery_alert_rounded,
          color:  batteryLevel > 20
              ? Colors.white54
              : const Color(0xFFFF8F00),
          size:   16,
        ),
        const SizedBox(width: 2),
        Text('$batteryLevel%',
            style: GoogleFonts.inter(
              color: Colors.white60, fontSize: 11)),
      ]),
    ]),
  );
}

class _GlassBadge extends StatelessWidget {
  const _GlassBadge({
    required this.label,
    required this.color,
    required this.icon,
  });
  final String   label;
  final Color    color;
  final IconData icon;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(99),
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color:        color.withOpacity(0.25),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(label,
              style: GoogleFonts.inter(
                color: color, fontSize: 10,
                fontWeight: FontWeight.w700)),
        ]),
      ),
    ),
  );
}

// ── Bubble action tile ────────────────────────────────────────────────────────
//
// "Protective bubble" — no border, soft glass fill, rounded 24px

class _BubbleTile extends StatelessWidget {
  const _BubbleTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
  final IconData     icon;
  final String       label;
  final Color        color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width:  76,
        height: 76,
        decoration: BoxDecoration(
          // No border — glass tonal only
          color:        Colors.white.withOpacity(0.10),
          borderRadius: BorderRadius.circular(24),
        ),
        child: Center(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color:  color.withOpacity(0.20),
              shape:  BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 28),
          ),
        ),
      ),
      const SizedBox(height: 8),
      Text(label,
          style: GoogleFonts.inter(
            color:      Colors.white,
            fontSize:   12,
            fontWeight: FontWeight.w600,
          )),
    ]),
  );
}

// ── Points pill ───────────────────────────────────────────────────────────────

class _PointsPill extends StatelessWidget {
  const _PointsPill({required this.points});
  final int points;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(99),
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
        decoration: BoxDecoration(
          color:        Colors.white.withOpacity(0.12),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.star_rounded, color: Color(0xFFFFB300), size: 18),
          const SizedBox(width: 8),
          Text('$points points',
              style: GoogleFonts.manrope(
                color:      Colors.white,
                fontSize:   14,
                fontWeight: FontWeight.w700,
              )),
        ]),
      ),
    ),
  );
}

// ── Child gradient button ─────────────────────────────────────────────────────

class _ChildButton extends StatelessWidget {
  const _ChildButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });
  final String       label;
  final IconData     icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => SizedBox(
    width:  double.infinity,
    height: 52,
    child: DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_kChildAction, _kChildBlue],
          begin: Alignment.topLeft,
          end:   Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color:       _kChildBlue.withOpacity(0.35),
            blurRadius:  16,
            offset:      const Offset(0, 4),
          ),
        ],
      ),
      child: ElevatedButton.icon(
        onPressed:   onPressed,
        icon:        Icon(icon, size: 18, color: Colors.white),
        label:       Text(label,
            style: GoogleFonts.inter(
              color:      Colors.white,
              fontSize:   15,
              fontWeight: FontWeight.w700,
            )),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor:     Colors.transparent,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24)),
        ),
      ),
    ),
  );
}
