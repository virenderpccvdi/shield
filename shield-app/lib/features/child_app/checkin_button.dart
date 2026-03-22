import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../app/theme.dart';

/// State for the "I'm Here" check-in button.
enum _CheckInStatus { idle, loading, success, error }

/// A prominent teal "I'm Here" button that sends the child's current GPS
/// location to the parent with a single tap.
///
/// Flow:
///  1. Tap → request GPS → POST /location/child/checkin
///  2. Success → pulse-green animation + "Location sent to Mom & Dad ✓"
///  3. Error   → "Could not send location. Check GPS permissions."
///  4. Auto-resets to idle after 3 seconds
class CheckInButton extends ConsumerStatefulWidget {
  const CheckInButton({super.key});

  @override
  ConsumerState<CheckInButton> createState() => _CheckInButtonState();
}

class _CheckInButtonState extends ConsumerState<CheckInButton>
    with SingleTickerProviderStateMixin {
  _CheckInStatus _status = _CheckInStatus.idle;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnim;
  Timer? _resetTimer;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _pulseAnim = Tween<double>(begin: 1.0, end: 1.06).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _resetTimer?.cancel();
    super.dispose();
  }

  Future<void> _handleTap() async {
    if (_status == _CheckInStatus.loading) return;

    setState(() => _status = _CheckInStatus.loading);

    try {
      final position = await _getPosition();
      if (position == null) {
        _setResult(_CheckInStatus.error);
        return;
      }

      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      if (profileId == null) {
        _setResult(_CheckInStatus.error);
        return;
      }

      await client.post('/location/child/checkin', data: {
        'profileId': profileId,
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'altitude': position.altitude,
        'message': 'I am here',
      });

      _setResult(_CheckInStatus.success);
    } catch (_) {
      _setResult(_CheckInStatus.error);
    }
  }

  void _setResult(_CheckInStatus status) {
    if (!mounted) return;
    setState(() => _status = status);

    if (status == _CheckInStatus.success) {
      _pulseController.repeat(reverse: true);
    }

    _resetTimer?.cancel();
    _resetTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() => _status = _CheckInStatus.idle);
        _pulseController.stop();
        _pulseController.reset();
      }
    });
  }

  Future<Position?> _getPosition() async {
    try {
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
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      ).timeout(const Duration(seconds: 15), onTimeout: () async {
        return await Geolocator.getLastKnownPosition() ??
            (throw Exception('Location timeout'));
      });
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = _status == _CheckInStatus.loading;
    final isSuccess = _status == _CheckInStatus.success;
    final isError = _status == _CheckInStatus.error;

    final Color btnColor = isSuccess
        ? ShieldTheme.success
        : isError
            ? ShieldTheme.danger
            : ShieldTheme.primary; // Shield blue

    final String label = isSuccess
        ? 'Location sent to Mom & Dad \u2713'
        : isError
            ? 'Could not send location. Check GPS permissions.'
            : "I'm Here";

    final IconData icon = isSuccess
        ? Icons.check_circle_rounded
        : isError
            ? Icons.location_off_rounded
            : Icons.location_on_rounded;

    return ScaleTransition(
      scale: _pulseAnim,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isLoading ? null : _handleTap,
          borderRadius: BorderRadius.circular(16),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isSuccess
                    ? [ShieldTheme.success, const Color(0xFF1B5E20)]
                    : isError
                        ? [ShieldTheme.danger, const Color(0xFFB71C1C)]
                        : [
                            ShieldTheme.primary,
                            ShieldTheme.primaryDark,
                          ],
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: btnColor.withOpacity(0.30),
                  blurRadius: 14,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (isLoading)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2.5,
                    ),
                  )
                else
                  Icon(icon, color: Colors.white, size: 22),
                const SizedBox(width: 10),
                Flexible(
                  child: Text(
                    isLoading ? 'Getting location...' : label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
