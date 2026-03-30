import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
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
    // Navigate based on notification type
    final type = msg.data['type'] as String?;
    final ctx  = navigatorKey.currentContext;
    if (ctx == null) return;
    if (type == 'SOS' || type == 'PANIC') {
      Navigator.of(ctx, rootNavigator: true).pushNamed('/alerts');
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
