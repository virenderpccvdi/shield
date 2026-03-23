import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'constants.dart';

/// Keys used to pass child auth data between isolates via SharedPreferences.
class _BgKeys {
  static const token     = 'bg_child_token';
  static const profileId = 'bg_child_profile_id';
}

/// Save child credentials so the background isolate can read them.
/// Called when child mode is activated.
Future<void> saveChildCredentialsForBackground({
  required String token,
  required String profileId,
}) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_BgKeys.token, token);
  await prefs.setString(_BgKeys.profileId, profileId);
}

/// Clear credentials when child mode is exited.
Future<void> clearChildCredentialsForBackground() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(_BgKeys.token);
  await prefs.remove(_BgKeys.profileId);
}

/// Initialize the flutter_background_service for child location tracking.
Future<void> initBackgroundService() async {
  final service = FlutterBackgroundService();
  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: _onStart,
      autoStart: false,
      isForegroundMode: true,
      notificationChannelId: 'shield_location_channel',
      initialNotificationTitle: 'Shield Protection Active',
      initialNotificationContent: 'Keeping you safe in the background',
      foregroundServiceNotificationId: 888,
    ),
    iosConfiguration: IosConfiguration(
      autoStart: false,
      onForeground: _onStart,
      onBackground: _onIosBackground,
    ),
  );
}

@pragma('vm:entry-point')
Future<bool> _onIosBackground(ServiceInstance service) async {
  return true;
}

/// Background isolate entry point — runs in a separate Dart isolate.
/// Sends child location to the backend every 5 minutes.
@pragma('vm:entry-point')
void _onStart(ServiceInstance service) async {
  if (service is AndroidServiceInstance) {
    service.on('stopService').listen((event) => service.stopSelf());
    service.on('setAsForeground').listen((_) => service.setAsForegroundService());
    service.on('setAsBackground').listen((_) => service.setAsBackgroundService());
  }

  // Send location every 5 minutes in background
  Timer.periodic(const Duration(minutes: 5), (_) async {
    await _sendLocation(service);
  });

  // Send first location immediately
  await _sendLocation(service);
}

Future<void> _sendLocation(ServiceInstance service) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_BgKeys.token);
    final profileId = prefs.getString(_BgKeys.profileId);
    if (token == null || profileId == null) return;

    // Get location
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return;
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) return;

    Position? position;
    try {
      position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low,
          timeLimit: Duration(seconds: 20),
        ),
      ).timeout(const Duration(seconds: 25));
    } catch (_) {
      position = await Geolocator.getLastKnownPosition();
    }
    if (position == null) return;

    final speedKmh = position.speed >= 0 ? position.speed * 3.6 : 0.0;
    final body = jsonEncode({
      'profileId': profileId,
      'latitude': position.latitude,
      'longitude': position.longitude,
      'accuracy': position.accuracy,
      'altitude': position.altitude,
      'speed': speedKmh,
      'isMoving': position.speed > 0.5,
    });

    final client = HttpClient();
    client.connectionTimeout = const Duration(seconds: 10);
    try {
      final uri = Uri.parse('${AppConstants.baseUrl}/api/v1/location/child/checkin');
      final request = await client.postUrl(uri);
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      request.write(body);
      final response = await request.close();
      debugPrint('[Shield BG] Location sent: ${response.statusCode}');
    } finally {
      client.close();
    }
  } catch (e) {
    debugPrint('[Shield BG] Location send failed: $e');
  }
}
