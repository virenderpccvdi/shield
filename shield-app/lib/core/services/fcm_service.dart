import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';
import '../api/api_client.dart';
import '../api/endpoints.dart';

// Top-level handler — required by Firebase (must be outside any class)
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM] Background message: ${message.messageId}');
}

class FcmService {
  FcmService._();

  static final navigatorKey = GlobalKey<NavigatorState>();
  static final _localNotifs = FlutterLocalNotificationsPlugin();

  static Future<void> init() async {
    await _initLocalNotifications();
    await _setupFcm();
  }

  static Future<void> _initLocalNotifications() async {
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios     = DarwinInitializationSettings();
    await _localNotifs.initialize(
      const InitializationSettings(android: android, iOS: ios),
    );
    const channel = AndroidNotificationChannel(
      'shield_alerts', 'Shield Alerts',
      description: 'Safety alerts from Shield parental controls',
      importance:  Importance.max,
    );
    await _localNotifs
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  static Future<void> _setupFcm() async {
    await FirebaseMessaging.instance.requestPermission();
    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
    FirebaseMessaging.onMessageOpenedApp.listen(_handleOpen);
  }

  static void _showForegroundNotification(RemoteMessage msg) {
    final n = msg.notification;
    if (n == null) return;
    _localNotifs.show(
      msg.hashCode,
      n.title,
      n.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'shield_alerts', 'Shield Alerts',
          importance: Importance.max, priority: Priority.high,
        ),
      ),
    );
  }

  static void _handleOpen(RemoteMessage msg) {
    final notifType = msg.data['type'] as String? ?? '';
    final profileId = msg.data['profileId'] as String? ?? msg.data['childId'] as String?;
    final ctx = navigatorKey.currentContext;
    if (ctx == null) return;
    final router = GoRouter.of(ctx);
    switch (notifType) {
      case 'GEOFENCE':
        if (profileId != null && profileId.isNotEmpty) {
          router.go('/parent/family/$profileId/map');
        } else {
          router.go('/parent/map');
        }
        break;
      case 'BUDGET_EXCEEDED':
        if (profileId != null && profileId.isNotEmpty) {
          router.go('/parent/family/$profileId/time-limits');
        } else {
          router.go('/parent/alerts');
        }
        break;
      case 'ANOMALY':
        if (profileId != null && profileId.isNotEmpty) {
          router.go('/parent/family/$profileId/ai-insights');
        } else {
          router.go('/parent/alerts');
        }
        break;
      case 'SOS':
      case 'PANIC':
        if (profileId != null && profileId.isNotEmpty) {
          router.go('/parent/family/$profileId/map');
        } else {
          router.go('/parent/map');
        }
        break;
      case 'BEDTIME':
        if (profileId != null && profileId.isNotEmpty) {
          router.go('/parent/family/$profileId/bedtime');
        } else {
          router.go('/parent/alerts');
        }
        break;
      case 'DNS_ALERT':
        if (profileId != null && profileId.isNotEmpty) {
          router.go('/parent/family/$profileId/browsing');
        } else {
          router.go('/parent/alerts');
        }
        break;
      case 'APP_UPDATE':
        router.go('/parent/settings');
        break;
      case 'LOCATION_UPDATE':
        if (profileId != null && profileId.isNotEmpty) {
          router.go('/parent/family/$profileId/map');
        } else {
          router.go('/parent/map');
        }
        break;
      default:
        router.go('/parent/alerts');
        break;
    }
  }

  /// Register FCM token with backend so push notifications are delivered.
  static Future<void> registerToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      await ApiClient.instance.post(Endpoints.fcmToken, data: {'token': token});
    } catch (_) {}
  }
}
