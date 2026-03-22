import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../app/theme.dart';

/// CS-10: Quick Panic Button Widget
///
/// A prominent, pulsing SOS button displayed as a card on the child's home
/// screen.  Tapping opens a confirmation dialog; on confirm it posts an SOS
/// alert to /location/child/panic with the last-known GPS position.
///
/// Design deliberately mirrors the inline [_SosButton] in child_app_screen.dart
/// but is self-contained so it can be dropped anywhere without state coupling.
class PanicButtonWidget extends ConsumerStatefulWidget {
  const PanicButtonWidget({super.key});

  @override
  ConsumerState<PanicButtonWidget> createState() => _PanicButtonWidgetState();
}

class _PanicButtonWidgetState extends ConsumerState<PanicButtonWidget>
    with SingleTickerProviderStateMixin {
  bool _isSending = false;
  String? _result;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.06).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<Position?> _getPosition() async {
    try {
      final svc = await Geolocator.isLocationServiceEnabled();
      if (!svc) return null;
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
        if (perm == LocationPermission.denied) return null;
      }
      if (perm == LocationPermission.deniedForever) return null;
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.bestForNavigation,
          timeLimit: Duration(seconds: 10),
        ),
      ).timeout(
        const Duration(seconds: 12),
        onTimeout: () async =>
            await Geolocator.getLastKnownPosition() ??
            (throw Exception('Location timeout')),
      );
    } catch (_) {
      return Geolocator.getLastKnownPosition().then((p) => p);
    }
  }

  Future<void> _triggerSOS() async {
    if (_isSending) return;

    final confirm = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.warning_amber_rounded,
                color: ShieldTheme.danger, size: 28),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'Send SOS Alert?',
                style: TextStyle(
                    fontWeight: FontWeight.w800, color: ShieldTheme.danger),
              ),
            ),
          ],
        ),
        content: const Text(
          'This will immediately notify your parent / guardian with your current location.\n\nOnly use in a real emergency.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: ShieldTheme.danger,
              minimumSize: const Size(120, 44),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('YES, SEND SOS',
                style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.8)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() {
      _isSending = true;
      _result = null;
    });
    HapticFeedback.heavyImpact();

    try {
      final position = await _getPosition();
      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;

      await client.post('/location/child/panic', data: {
        'profileId': profileId,
        'latitude': position?.latitude ?? 0.0,
        'longitude': position?.longitude ?? 0.0,
        if (position != null) 'accuracy': position.accuracy,
        'message': position == null
            ? 'Quick panic button — location unavailable'
            : 'Quick panic button triggered',
      });

      if (mounted) {
        setState(
            () => _result = '\u2713 SOS sent! Your family has been alerted.');
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('\u2713 SOS Alert Sent! Help is on the way.'),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 5),
        ));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _result = 'Failed to send SOS. Please try again.');
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('SOS failed: $e'),
          backgroundColor: ShieldTheme.warning,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
              color: ShieldTheme.danger.withOpacity(0.12),
              blurRadius: 16,
              offset: const Offset(0, 4))
        ],
        border: Border.all(
            color: ShieldTheme.danger.withOpacity(0.18), width: 1.5),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: ShieldTheme.danger.withOpacity(0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.sos_rounded,
                    color: ShieldTheme.danger, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Quick SOS',
                      style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: colorScheme.onSurface),
                    ),
                    Text(
                      'Hold the button to send an emergency alert',
                      style: TextStyle(
                          fontSize: 11,
                          color:
                              colorScheme.onSurface.withOpacity(0.55)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          AnimatedBuilder(
            animation: _pulseAnimation,
            builder: (ctx, child) => Transform.scale(
              scale: _pulseAnimation.value,
              child: GestureDetector(
                onLongPress: _isSending ? null : _triggerSOS,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFFE53935), Color(0xFFB71C1C)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: ShieldTheme.danger.withOpacity(
                            0.35 + _pulseAnimation.value * 0.20),
                        blurRadius: 18 + _pulseAnimation.value * 14,
                        spreadRadius: 2 + _pulseAnimation.value * 4,
                      ),
                    ],
                  ),
                  child: _isSending
                      ? const Center(
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 3),
                        )
                      : const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.sos_rounded,
                                color: Colors.white, size: 40),
                            SizedBox(height: 4),
                            Text(
                              'HELP',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 14,
                                  letterSpacing: 2),
                            ),
                            Text(
                              'hold to send',
                              style: TextStyle(
                                  color: Colors.white70, fontSize: 9),
                            ),
                          ],
                        ),
                ),
              ),
            ),
          ),
          if (_result != null) ...[
            const SizedBox(height: 14),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: _result!.contains('\u2713')
                    ? ShieldTheme.success.withOpacity(0.08)
                    : ShieldTheme.danger.withOpacity(0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                _result!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: _result!.contains('\u2713')
                      ? ShieldTheme.success
                      : ShieldTheme.danger,
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
