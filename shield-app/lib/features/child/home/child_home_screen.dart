import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:intl/intl.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/services/dns_vpn_service.dart';
import '../../../core/services/background_service.dart';
import '../../../core/services/storage_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ChildHomeScreen — the locked child interface.
//
// Key behaviours:
//  • Back button completely blocked (PopScope canPop: false)
//  • Long-press "Parent Access" footer → PIN dialog → deactivate
//  • VPN (re)started on every resume
//  • Live clock, battery monitor, heartbeat every 5 min
// ─────────────────────────────────────────────────────────────────────────────

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

  int    _batteryLevel  = 100;
  bool   _vpnActive     = false;
  String _timeStr       = '';
  String _dateStr       = '';

  // Points summary (optional — shown if endpoint available)
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

    // Try to load points
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
    // Battery level is included in the heartbeat POST payload
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
          const SnackBar(
            content: Text('Check-in sent to your parent ✓'),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Check-in failed. Check your connection.')));
      }
    }
  }

  void _triggerSOS() async {
    final pid = ref.read(authProvider).childProfileId;
    if (pid == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.red.shade900,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(children: [
          Icon(Icons.sos, color: Colors.white, size: 28),
          SizedBox(width: 10),
          Text('Emergency Alert',
              style: TextStyle(color: Colors.white, fontSize: 20)),
        ]),
        content: const Text(
          'This will immediately alert your parent with your current location. '
          'Use only in a real emergency.',
          style: TextStyle(color: Colors.white70, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: Colors.red.shade900),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('SEND SOS',
                style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await ApiClient.instance.post(Endpoints.sos(pid));
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Emergency alert sent to your parent.'),
              backgroundColor: Colors.red,
              duration: Duration(seconds: 5),
              behavior: SnackBarBehavior.floating,
            ));
        }
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('Failed to send SOS. Check your connection.')));
        }
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
          title: const Text('Remove Protection'),
          content: const Text('Remove Shield protection from this device?'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Remove'),
            ),
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
        title: const Text('Parent PIN Required'),
        content: TextField(
          controller:   ctrl,
          keyboardType: TextInputType.number,
          obscureText:  true,
          maxLength:    6,
          autofocus:    true,
          decoration: const InputDecoration(
            labelText:  'Enter Parent PIN',
            prefixIcon: Icon(Icons.lock),
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
        const SnackBar(
          content: Text('Incorrect PIN'),
          backgroundColor: Colors.red,
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
    final name = auth.childName ?? 'Child';

    return PopScope(
      canPop: false,
      child: Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF1E40AF), Color(0xFF1E40AF), Color(0xFF2563EB)],
              begin: Alignment.topCenter, end: Alignment.bottomCenter,
            ),
          ),
          child: SafeArea(
            child: Column(children: [
              // ── Status bar ─────────────────────────────────────────────────
              _StatusBar(vpnActive: _vpnActive, batteryLevel: _batteryLevel),

              const Spacer(flex: 1),

              // ── Clock ───────────────────────────────────────────────────────
              _ClockWidget(timeStr: _timeStr, dateStr: _dateStr),

              const SizedBox(height: 20),

              // ── Greeting & points ───────────────────────────────────────────
              Text('Hi, $name!',
                  style: const TextStyle(
                      color: Colors.white, fontSize: 30,
                      fontWeight: FontWeight.w700, letterSpacing: -0.5)),
              const SizedBox(height: 6),
              if (_points != null)
                _PointsPill(points: _points!)
              else
                Text('You\'re protected by Shield',
                    style: TextStyle(
                        color: Colors.white.withOpacity(0.6), fontSize: 14)),

              const Spacer(flex: 1),

              // ── Action grid ─────────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: GridView.count(
                  crossAxisCount: 3,
                  shrinkWrap:     true,
                  physics:        const NeverScrollableScrollPhysics(),
                  mainAxisSpacing:  12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.05,
                  children: [
                    _ActionTile(
                        icon: Icons.task_alt, label: 'Tasks',
                        color: const Color(0xFF4CAF50),
                        onTap: () => context.push('/child/tasks')),
                    _ActionTile(
                        icon: Icons.star_rounded, label: 'Rewards',
                        color: const Color(0xFFFFB300),
                        onTap: () => context.push('/child/rewards')),
                    _ActionTile(
                        icon: Icons.chat_bubble_outline_rounded, label: 'AI Chat',
                        color: const Color(0xFF9C27B0),
                        onTap: () => context.push('/child/chat')),
                  ],
                ),
              ),

              const Spacer(flex: 1),

              // ── Check-in button ─────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: ElevatedButton.icon(
                  onPressed: _checkin,
                  icon:  const Icon(Icons.check_circle_outline),
                  label: const Text('Check In with Parent'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF1E40AF),
                    minimumSize: const Size.fromHeight(52),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ── SOS button ──────────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: OutlinedButton.icon(
                  onPressed: _triggerSOS,
                  icon:  const Icon(Icons.sos, color: Colors.red),
                  label: const Text('Emergency SOS',
                      style: TextStyle(color: Colors.red, fontSize: 15,
                          fontWeight: FontWeight.w600)),
                  style: OutlinedButton.styleFrom(
                    side:        const BorderSide(color: Colors.red, width: 2),
                    minimumSize: const Size.fromHeight(52),
                    shape:       RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),

              // ── Hidden parent exit ──────────────────────────────────────────
              GestureDetector(
                onLongPress: _promptParentPin,
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(0, 16, 0, 12),
                  child: Text('Parent Access',
                      style: TextStyle(
                          color: Colors.white.withOpacity(0.12),
                          fontSize: 11)),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

// ── Status bar ─────────────────────────────────────────────────────────────────

class _StatusBar extends StatelessWidget {
  const _StatusBar({required this.vpnActive, required this.batteryLevel});
  final bool vpnActive;
  final int  batteryLevel;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
    child: Row(children: [
      const Icon(Icons.shield, color: Colors.white70, size: 18),
      const SizedBox(width: 5),
      const Text('Shield',
          style: TextStyle(color: Colors.white70, fontSize: 13,
              fontWeight: FontWeight.w600)),
      const Spacer(),
      // VPN badge
      _StatusBadge(
        active:  vpnActive,
        icon:    vpnActive ? Icons.security : Icons.security_outlined,
        label:   vpnActive ? 'Protected' : 'VPN Off',
        color:   vpnActive ? Colors.green.shade600 : Colors.red.shade600,
      ),
      const SizedBox(width: 8),
      // Battery
      Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(
          batteryLevel > 60 ? Icons.battery_full
              : batteryLevel > 20 ? Icons.battery_4_bar
              : Icons.battery_alert,
          color:  batteryLevel > 20 ? Colors.white60 : Colors.orange,
          size:   16,
        ),
        const SizedBox(width: 2),
        Text('$batteryLevel%',
            style: const TextStyle(color: Colors.white54, fontSize: 11)),
      ]),
    ]),
  );
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({
    required this.active,
    required this.icon,
    required this.label,
    required this.color,
  });
  final bool     active;
  final IconData icon;
  final String   label;
  final Color    color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color:        color.withOpacity(0.25),
      borderRadius: BorderRadius.circular(8),
      border:       Border.all(color: color.withOpacity(0.5)),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 11, color: color),
      const SizedBox(width: 4),
      Text(label, style: TextStyle(color: color, fontSize: 10,
          fontWeight: FontWeight.w600)),
    ]),
  );
}

// ── Clock ──────────────────────────────────────────────────────────────────────

class _ClockWidget extends StatelessWidget {
  const _ClockWidget({required this.timeStr, required this.dateStr});
  final String timeStr, dateStr;

  @override
  Widget build(BuildContext context) => Column(children: [
    Text(timeStr,
        style: const TextStyle(
            color: Colors.white, fontSize: 52,
            fontWeight: FontWeight.w200, letterSpacing: -2)),
    const SizedBox(height: 4),
    Text(dateStr,
        style: TextStyle(
            color: Colors.white.withOpacity(0.55), fontSize: 14)),
  ]);
}

// ── Points pill ────────────────────────────────────────────────────────────────

class _PointsPill extends StatelessWidget {
  const _PointsPill({required this.points});
  final int points;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
    decoration: BoxDecoration(
      color:        Colors.white.withOpacity(0.12),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.star_rounded, color: Color(0xFFFFB300), size: 18),
      const SizedBox(width: 6),
      Text('$points points',
          style: const TextStyle(
              color: Colors.white, fontSize: 14,
              fontWeight: FontWeight.w600)),
    ]),
  );
}

// ── Action tile ────────────────────────────────────────────────────────────────

class _ActionTile extends StatelessWidget {
  const _ActionTile({
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
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(18),
    child: Container(
      decoration: BoxDecoration(
        color:        Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(18),
        border:       Border.all(color: Colors.white.withOpacity(0.12)),
      ),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color:        color.withOpacity(0.2),
            shape:        BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 26),
        ),
        const SizedBox(height: 8),
        Text(label,
            style: const TextStyle(
                color: Colors.white, fontSize: 12,
                fontWeight: FontWeight.w500)),
      ]),
    ),
  );
}
