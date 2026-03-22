import 'dart:async';
import 'package:battery_plus/battery_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// CS-04: Battery Alert Service
///
/// Runs a periodic timer every 5 minutes to read the device battery level
/// and report it to the Shield backend. The backend handles threshold checks
/// and sends push notifications to the parent when battery is low.
class BatteryService {
  static const _reportIntervalMinutes = 5;

  final _battery = Battery();
  Timer? _timer;
  Dio? _dio;
  String? _profileId;

  /// Start the periodic battery reporting loop.
  /// [dio] — the authenticated Dio instance from the Riverpod dioProvider.
  /// Safe to call multiple times — cancels any existing timer first.
  void start({required Dio dio, required String profileId}) {
    stop();
    _dio = dio;
    _profileId = profileId;
    // Report immediately on start, then every 5 minutes
    _reportBattery();
    _timer = Timer.periodic(
      const Duration(minutes: _reportIntervalMinutes),
      (_) => _reportBattery(),
    );
    debugPrint('[BatteryService] Started for profile=$profileId');
  }

  /// Stop the periodic reporting timer.
  void stop() {
    _timer?.cancel();
    _timer = null;
    _dio = null;
    _profileId = null;
  }

  Future<void> _reportBattery() async {
    final dio = _dio;
    final profileId = _profileId;
    if (dio == null || profileId == null || profileId.isEmpty) return;
    try {
      final level = await _battery.batteryLevel;
      await dio.post(
        '/location/battery/$profileId/report',
        data: {'batteryPercent': level},
      );
      debugPrint('[BatteryService] Reported battery=$level% for profile=$profileId');
    } catch (e) {
      debugPrint('[BatteryService] Failed to report battery: $e');
    }
  }
}
