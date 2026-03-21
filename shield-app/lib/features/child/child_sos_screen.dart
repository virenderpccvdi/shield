import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';

class ChildSosScreen extends ConsumerStatefulWidget {
  const ChildSosScreen({super.key});
  @override
  ConsumerState<ChildSosScreen> createState() => _ChildSosScreenState();
}

class _ChildSosScreenState extends ConsumerState<ChildSosScreen> with SingleTickerProviderStateMixin {
  bool _sending = false;
  bool _sent = false;
  String? _error;
  late AnimationController _pulseController;
  // Key to reset the _CountdownDisplay widget when countdown starts
  final GlobalKey<_CountdownDisplayState> _countdownKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  void _startCountdown() {
    setState(() { _sending = true; _error = null; _sent = false; });
    // The _CountdownDisplay widget owns its own timer — no setState needed here for ticks
    _countdownKey.currentState?.start(onDone: _sendSos);
  }

  void _cancelCountdown() {
    _countdownKey.currentState?.cancel();
    setState(() => _sending = false);
  }

  Future<void> _sendSos() async {
    try {
      Position? position;
      try {
        bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (serviceEnabled) {
          LocationPermission permission = await Geolocator.checkPermission();
          if (permission == LocationPermission.denied) {
            permission = await Geolocator.requestPermission();
          }
          if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
            position = await Geolocator.getCurrentPosition(
              locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
            );
          }
        }
      } catch (_) {}

      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      await client.post('/location/child/panic', data: {
        'profileId': profileId,                          // required by @NotNull validation
        'latitude': position?.latitude ?? 0.0,
        'longitude': position?.longitude ?? 0.0,
        if (position != null) 'accuracy': position.accuracy,
        'message': 'Child SOS alert${position == null ? " — location unavailable" : ""}',
      });

      setState(() { _sent = true; _sending = false; });
    } catch (e) {
      setState(() { _error = 'Failed to send SOS. Please try again.'; _sending = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _sent ? Colors.green.shade700 : Colors.red.shade900,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text('Emergency SOS', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (_sent) ...[
                  const Icon(Icons.check_circle, color: Colors.white, size: 100),
                  const SizedBox(height: 24),
                  const Text('SOS Sent!',
                    style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  const Text('Your family has been alerted.\nStay safe, help is on the way.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white70, fontSize: 16)),
                  const SizedBox(height: 40),
                  OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white),
                      minimumSize: const Size(200, 50),
                    ),
                    child: const Text('Go Back', style: TextStyle(fontSize: 16)),
                  ),
                ] else if (_sending) ...[
                  // Countdown — owned by _CountdownDisplay to avoid full-screen rebuilds
                  AnimatedBuilder(
                    animation: _pulseController,
                    builder: (_, __) => Container(
                      width: 200 + _pulseController.value * 20,
                      height: 200 + _pulseController.value * 20,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.red.withAlpha(50),
                        border: Border.all(color: Colors.white.withAlpha(80), width: 3),
                      ),
                      child: Center(
                        child: _CountdownDisplay(key: _countdownKey),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text('Sending SOS...',
                    style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  const Text('Tap cancel to stop',
                    style: TextStyle(color: Colors.white70, fontSize: 14)),
                  const SizedBox(height: 32),
                  OutlinedButton(
                    onPressed: _cancelCountdown,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white),
                      minimumSize: const Size(200, 50),
                    ),
                    child: const Text('Cancel', style: TextStyle(fontSize: 16)),
                  ),
                ] else ...[
                  // SOS button
                  const Text('Are you in danger?',
                    style: TextStyle(color: Colors.white70, fontSize: 16)),
                  const SizedBox(height: 8),
                  const Text('Press the SOS button',
                    style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 40),
                  GestureDetector(
                    onTap: _startCountdown,
                    child: AnimatedBuilder(
                      animation: _pulseController,
                      builder: (_, __) => Container(
                        width: 220 + _pulseController.value * 10,
                        height: 220 + _pulseController.value * 10,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.red,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.red.withAlpha(100 + (_pulseController.value * 80).toInt()),
                              blurRadius: 30 + _pulseController.value * 20,
                              spreadRadius: 5 + _pulseController.value * 10,
                            ),
                          ],
                        ),
                        child: const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.warning_amber_rounded, size: 60, color: Colors.white),
                              SizedBox(height: 8),
                              Text('SOS', style: TextStyle(
                                fontSize: 40, fontWeight: FontWeight.w900, color: Colors.white,
                                letterSpacing: 4,
                              )),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 24),
                    Text(_error!, style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.w600)),
                  ],
                  const SizedBox(height: 40),
                  const Text('Your location will be shared\nwith your family',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white54, fontSize: 13)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Countdown display widget — owns its own timer so only this tiny widget
// rebuilds each second, not the entire screen.
class _CountdownDisplay extends StatefulWidget {
  const _CountdownDisplay({super.key});

  @override
  _CountdownDisplayState createState() => _CountdownDisplayState();
}

class _CountdownDisplayState extends State<_CountdownDisplay> {
  int _value = 3;
  Timer? _timer;

  /// Start the countdown. Calls [onDone] when it reaches zero.
  void start({required VoidCallback onDone}) {
    _timer?.cancel();
    setState(() => _value = 3);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_value <= 1) {
        timer.cancel();
        onDone();
      } else {
        setState(() => _value--);
      }
    });
  }

  /// Cancel the countdown without calling onDone.
  void cancel() {
    _timer?.cancel();
    if (mounted) setState(() => _value = 3);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      '$_value',
      style: const TextStyle(color: Colors.white, fontSize: 80, fontWeight: FontWeight.w900),
    );
  }
}
