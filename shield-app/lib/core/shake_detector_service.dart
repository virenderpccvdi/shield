import 'dart:async';
import 'dart:math';
import 'package:flutter/services.dart';
import 'package:sensors_plus/sensors_plus.dart';

/// Detects a rapid shake gesture (3 shakes within 1500ms) and invokes a
/// callback — used to trigger the child SOS alert from any app state.
///
/// Algorithm:
///  - Listen to accelerometerEventStream
///  - Magnitude = sqrt(x²+y²+z²) - 9.8 (remove gravity component)
///  - A "shake" is registered when magnitude > 15 m/s²
///  - Collect timestamps of shakes; when 3 fall within a 1500ms window → SOS
///  - After trigger, enforce a 10-second debounce before the next trigger
class ShakeDetectorService {
  static const double _threshold = 15.0;       // m/s² above gravity
  static const int _requiredShakes = 3;
  static const int _windowMs = 1500;
  static const int _debounceMs = 10000;

  VoidCallback? _onShakeSos;
  StreamSubscription<AccelerometerEvent>? _subscription;
  final List<int> _shakeTimes = [];
  int? _lastTriggerMs;

  void setOnShakeSos(VoidCallback callback) {
    _onShakeSos = callback;
  }

  void start() {
    _subscription?.cancel();
    _subscription = accelerometerEventStream(
      samplingPeriod: SensorInterval.gameInterval,
    ).listen(_onAccelerometer, onError: (_) {/* best-effort */});
  }

  void stop() {
    _subscription?.cancel();
    _subscription = null;
    _shakeTimes.clear();
  }

  void _onAccelerometer(AccelerometerEvent event) {
    final magnitude = sqrt(
      event.x * event.x + event.y * event.y + event.z * event.z,
    ) - 9.8;

    if (magnitude < _threshold) return;

    final now = DateTime.now().millisecondsSinceEpoch;

    // Respect debounce — ignore shakes too soon after last trigger
    if (_lastTriggerMs != null && now - _lastTriggerMs! < _debounceMs) return;

    _shakeTimes.add(now);

    // Keep only shakes within the rolling window
    _shakeTimes.removeWhere((t) => now - t > _windowMs);

    if (_shakeTimes.length >= _requiredShakes) {
      _lastTriggerMs = now;
      _shakeTimes.clear();
      _fireSos();
    }
  }

  void _fireSos() {
    // Vibrate 3× as haptic confirmation
    HapticFeedback.heavyImpact();
    Future.delayed(const Duration(milliseconds: 200), () {
      HapticFeedback.heavyImpact();
      Future.delayed(const Duration(milliseconds: 200), () {
        HapticFeedback.heavyImpact();
      });
    });

    _onShakeSos?.call();
  }
}
