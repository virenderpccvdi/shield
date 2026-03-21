import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'auth_state.dart';
import 'constants.dart';

/// Top-level handler for background messages (must be a top-level function).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('FCM background message: ${message.messageId}');
}

/// Firebase Cloud Messaging service.
/// Handles token registration, permission requests, and message handling.
class FcmService {
  static final FcmService _instance = FcmService._();
  factory FcmService() => _instance;
  FcmService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  bool _initialized = false;

  /// Initialize FCM. Call after Firebase.initializeApp() and after login.
  Future<void> initialize({
    required String userId,
    required String tenantId,
    required String accessToken,
  }) async {
    if (_initialized) return;

    // Request permissions (iOS and Android 13+)
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      debugPrint('FCM: User denied notification permission');
      return;
    }

    debugPrint('FCM: Permission status: ${settings.authorizationStatus}');

    // Subscribe child devices to the APK-update broadcast topic
    await _messaging.subscribeToTopic('shield-child-devices');
    debugPrint('FCM: Subscribed to topic shield-child-devices');

    // Set up local notifications for showing foreground messages
    await _setupLocalNotifications();

    // Get FCM token and register with backend
    final token = await _messaging.getToken();
    if (token != null) {
      await _registerTokenWithBackend(
        fcmToken: token,
        userId: userId,
        tenantId: tenantId,
        accessToken: accessToken,
      );
    }

    // Listen for token refresh
    _messaging.onTokenRefresh.listen((newToken) {
      _registerTokenWithBackend(
        fcmToken: newToken,
        userId: userId,
        tenantId: tenantId,
        accessToken: accessToken,
      );
    });

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle messages that opened the app from background
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);

    // Check for initial message (app was terminated)
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleMessageOpenedApp(initialMessage);
    }

    _initialized = true;
    debugPrint('FCM: Initialized successfully, token=$token');
  }

  /// Unregister token on logout.
  Future<void> unregister({
    required String userId,
    required String accessToken,
  }) async {
    try {
      final token = await _messaging.getToken();
      if (token == null) return;

      final dio = Dio(BaseOptions(
        baseUrl: AppConstants.baseUrl,
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Content-Type': 'application/json',
        },
      ));

      await dio.delete('/notifications/fcm/unregister', queryParameters: {
        'userId': userId,
        'fcmToken': token,
      });

      debugPrint('FCM: Token unregistered');
    } catch (e) {
      debugPrint('FCM: Unregister failed: $e');
    }

    // Unsubscribe from the child-devices broadcast topic
    try {
      await _messaging.unsubscribeFromTopic('shield-child-devices');
      debugPrint('FCM: Unsubscribed from topic shield-child-devices');
    } catch (e) {
      debugPrint('FCM: Topic unsubscribe failed: $e');
    }

    _initialized = false;
  }

  // ── Private helpers ─────────────────────────────────────────────────

  Future<void> _setupLocalNotifications() async {
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (details) {
        debugPrint('FCM: Local notification tapped: ${details.payload}');
        // Handle navigation based on payload
      },
    );

    // Create notification channel for Android
    const androidChannel = AndroidNotificationChannel(
      'shield_default',
      'Shield Notifications',
      description: 'Default Shield notification channel',
      importance: Importance.high,
    );

    const urgentChannel = AndroidNotificationChannel(
      'shield_urgent',
      'Shield Urgent Alerts',
      description: 'SOS, geofence breach, and critical alerts',
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
    );

    final androidPlugin =
        _localNotifications.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin != null) {
      await androidPlugin.createNotificationChannel(androidChannel);
      await androidPlugin.createNotificationChannel(urgentChannel);
    }
  }

  // Navigator key for showing dialogs from FCM handler
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('FCM foreground: ${message.notification?.title}');

    // App update notification — show dialog instead of a local notification
    if (message.data['type'] == 'APP_UPDATE') {
      _showAppUpdateDialog(message.data);
      return;
    }

    final notification = message.notification;
    if (notification == null) return;

    final isHighPriority = message.data['priority'] == 'HIGH';
    final channelId =
        isHighPriority ? 'shield_urgent' : 'shield_default';

    _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          isHighPriority ? 'Shield Urgent Alerts' : 'Shield Notifications',
          importance: isHighPriority ? Importance.max : Importance.high,
          priority: isHighPriority ? Priority.max : Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
      ),
      payload: jsonEncode(message.data),
    );
  }

  void _handleMessageOpenedApp(RemoteMessage message) {
    debugPrint('FCM message opened app: ${message.data}');
    if (message.data['type'] == 'APP_UPDATE') {
      _showAppUpdateDialog(message.data);
    }
  }

  void _showAppUpdateDialog(Map<String, dynamic> data) {
    final ctx = navigatorKey.currentContext;
    if (ctx == null) return;
    final downloadUrl = data['downloadUrl'] as String? ?? 'https://shield.rstglobal.in/shield-app.apk';
    final version = data['version'] as String? ?? '';
    showDialog(
      context: ctx,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        title: const Text('App Update Available', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Text(version.isNotEmpty
            ? 'Shield v$version is available with new features and improvements.'
            : 'A new version of Shield is available with improvements.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Later'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final uri = Uri.parse(downloadUrl);
              if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
            },
            child: const Text('Download'),
          ),
        ],
      ),
    );
  }

  Future<void> _registerTokenWithBackend({
    required String fcmToken,
    required String userId,
    required String tenantId,
    required String accessToken,
  }) async {
    try {
      final dio = Dio(BaseOptions(
        baseUrl: AppConstants.baseUrl,
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Content-Type': 'application/json',
        },
      ));

      await dio.post('/notifications/fcm/register', data: {
        'userId': userId,
        'tenantId': tenantId,
        'fcmToken': fcmToken,
        'platform': defaultTargetPlatform == TargetPlatform.iOS
            ? 'IOS'
            : 'ANDROID',
        'deviceName': 'Shield App',
      });

      debugPrint('FCM: Token registered with backend');
    } catch (e) {
      debugPrint('FCM: Token registration failed: $e');
    }
  }
}

/// Riverpod provider for FCM initialization status.
final fcmInitializedProvider = StateProvider<bool>((ref) => false);
