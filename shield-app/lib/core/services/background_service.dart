import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import 'package:installed_apps/installed_apps.dart';
import 'package:geolocator/geolocator.dart';
import '../constants.dart';

// ── Background isolate entry point ────────────────────────────────────────────

@pragma('vm:entry-point')
void onBgServiceStart(ServiceInstance service) async {
  // Runs in a separate isolate — cannot use FlutterSecureStorage.
  // Credentials were copied to SharedPreferences in saveChildCredentialsForBg().
  final prefs = await SharedPreferences.getInstance();

  service.on('stop').listen((_) => service.stopSelf());

  // Heartbeat every 5 minutes
  Timer.periodic(const Duration(minutes: 5), (_) => _sendHeartbeat(prefs));

  // Location every 10 minutes
  Timer.periodic(const Duration(minutes: 10), (_) => _sendLocation(prefs));

  // App sync every hour
  Timer.periodic(const Duration(hours: 1), (_) => _syncApps(prefs));
}

Future<void> _sendHeartbeat(SharedPreferences prefs) async {
  final token     = prefs.getString(AppConstants.bgKeyToken);
  final profileId = prefs.getString(AppConstants.bgKeyProfileId);
  if (token == null || profileId == null) return;
  try {
    await Dio().post(
      '${AppConstants.baseUrl}/profiles/devices/heartbeat',
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );
  } catch (_) {}
}

Future<void> _sendLocation(SharedPreferences prefs) async {
  final token     = prefs.getString(AppConstants.bgKeyToken);
  final profileId = prefs.getString(AppConstants.bgKeyProfileId);
  if (token == null || profileId == null) return;
  try {
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
    ).timeout(const Duration(seconds: 10));
    await Dio().post(
      '${AppConstants.baseUrl}/location/update',
      data: {
        'profileId': profileId,
        'latitude':  pos.latitude,
        'longitude': pos.longitude,
        'accuracy':  pos.accuracy,
      },
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );
  } catch (_) {}
}

Future<void> _syncApps(SharedPreferences prefs) async {
  final token = prefs.getString(AppConstants.bgKeyToken);
  if (token == null) return;
  try {
    final apps = await InstalledApps.getInstalledApps(true, true);
    final list = apps.map((a) => {
      'packageName': a.packageName,
      'appName':     a.name,
    }).toList();
    await Dio().post(
      '${AppConstants.baseUrl}/profiles/apps/sync',
      data: {'apps': list},
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );
  } catch (_) {}
}

// ── Setup (called once in main.dart) ─────────────────────────────────────────

class BackgroundServiceHelper {
  static Future<void> configure() async {
    final service = FlutterBackgroundService();
    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart:        onBgServiceStart,
        autoStart:      false,   // started manually only on child devices
        isForegroundMode: true,
        notificationChannelId: 'shield_child',
        initialNotificationTitle: 'Shield Protection Active',
        initialNotificationContent: 'Your device is protected.',
        foregroundServiceNotificationId: 888,
      ),
      iosConfiguration: IosConfiguration(autoStart: false),
    );
  }

  /// Copy child credentials to SharedPreferences so the background isolate can read them.
  /// Call this BEFORE starting the service.
  static Future<void> saveCredentials({
    required String token,
    required String profileId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.bgKeyToken,     token);
    await prefs.setString(AppConstants.bgKeyProfileId, profileId);
  }

  static Future<void> start({required String token, required String profileId}) async {
    await saveCredentials(token: token, profileId: profileId);
    try {
      final service = FlutterBackgroundService();
      final isRunning = await service.isRunning();
      if (!isRunning) await service.startService();
    } catch (e) {
      // Android 14 ForegroundServiceStartNotAllowedException — not fatal
      debugPrint('[Shield] Background service start failed: $e');
    }
  }

  static Future<void> stop() async {
    try {
      final service = FlutterBackgroundService();
      service.invoke('stop');
    } catch (_) {}
  }
}
