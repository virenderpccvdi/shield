import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'auth_state.dart';
import 'constants.dart';
import '../features/child_app/video_checkin_screen.dart';

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
        if (details.payload != null) {
          try {
            final data = jsonDecode(details.payload!) as Map<String, dynamic>;
            _navigateForData(data);
          } catch (_) {}
        }
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

    // CS-01 Live Video Check-in request — show accept/decline dialog
    if (message.data['type'] == 'VIDEO_CHECKIN_REQUEST') {
      _showVideoCheckinRequestDialog(message.data);
      return;
    }

    // FC-02: Screen time request decision — show coloured snackbar
    if (message.data['type'] == 'SCREEN_TIME_APPROVED') {
      _showScreenTimeSnackbar(message.data, approved: true);
      return;
    }
    if (message.data['type'] == 'SCREEN_TIME_DENIED') {
      _showScreenTimeSnackbar(message.data, approved: false);
      return;
    }

    final notification = message.notification;
    if (notification == null) return;

    final type = message.data['type'] as String? ?? '';

    // Geofence breach and SOS alerts always use the urgent channel
    final isUrgent = type == 'GEOFENCE_BREACH' ||
        type == 'SOS_ALERT' ||
        type == 'GEOFENCE_BREACH_HIGH' ||
        type == 'LOCATION_SPOOFING' ||
        message.data['priority'] == 'HIGH';
    final channelId = isUrgent ? 'shield_urgent' : 'shield_default';

    _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          isUrgent ? 'Shield Urgent Alerts' : 'Shield Notifications',
          importance: isUrgent ? Importance.max : Importance.high,
          priority: isUrgent ? Priority.max : Priority.high,
          icon: '@mipmap/ic_launcher',
          // Geofence breach gets a distinct vibration pattern
          vibrationPattern: type == 'GEOFENCE_BREACH'
              ? Int64List.fromList([0, 500, 200, 500])
              : null,
        ),
      ),
      payload: jsonEncode(message.data),
    );
  }

  void _handleMessageOpenedApp(RemoteMessage message) {
    debugPrint('FCM message opened app: ${message.data}');
    if (message.data['type'] == 'APP_UPDATE') {
      _showAppUpdateDialog(message.data);
      return;
    }
    // CS-01: tapping a VIDEO_CHECKIN_REQUEST notification opens the dialog
    if (message.data['type'] == 'VIDEO_CHECKIN_REQUEST') {
      _showVideoCheckinRequestDialog(message.data);
      return;
    }
    // FC-02: tapping a screen-time decision notification shows a snackbar
    if (message.data['type'] == 'SCREEN_TIME_APPROVED') {
      _showScreenTimeSnackbar(message.data, approved: true);
      return;
    }
    if (message.data['type'] == 'SCREEN_TIME_DENIED') {
      _showScreenTimeSnackbar(message.data, approved: false);
      return;
    }
    _navigateForData(message.data);
  }

  /// Navigate to the appropriate screen based on notification data.
  void _navigateForData(Map<String, dynamic> data) {
    final ctx = navigatorKey.currentContext;
    if (ctx == null) return;

    final type       = data['type'] as String? ?? '';
    final profileId  = data['profileId'] as String?;
    final alertId    = data['alertId'] as String?;

    switch (type) {
      case 'SOS_ALERT':
      case 'PANIC_ALERT':
        // Navigate to SOS alerts tab
        _go(ctx, '/alerts/sos');
        break;

      case 'GEOFENCE_BREACH':
      case 'GEOFENCE_BREACH_HIGH':
      case 'LOCATION_SPOOFING':
        // Navigate to live map if we have a profileId, otherwise alerts
        if (profileId != null && profileId.isNotEmpty) {
          _go(ctx, '/map?profileId=$profileId');
        } else {
          _go(ctx, '/alerts');
        }
        break;

      case 'TIME_LIMIT_REACHED':
      case 'SCREEN_TIME_WARNING':
        if (profileId != null && profileId.isNotEmpty) {
          _go(ctx, '/family/$profileId/time-limits');
        } else {
          _go(ctx, '/dashboard');
        }
        break;

      case 'GOAL_COMPLETED':
      case 'REWARD_EARNED':
        if (profileId != null && profileId.isNotEmpty) {
          _go(ctx, '/family/$profileId/rewards');
        } else {
          _go(ctx, '/dashboard');
        }
        break;

      case 'WEEKLY_REPORT':
      case 'REPORT_READY':
        if (profileId != null && profileId.isNotEmpty) {
          _go(ctx, '/family/$profileId/reports');
        } else {
          _go(ctx, '/dashboard');
        }
        break;

      case 'DNS_ALERT':
      case 'BLOCKED_DOMAIN':
        if (profileId != null && profileId.isNotEmpty) {
          _go(ctx, '/family/$profileId/dns-rules');
        } else {
          _go(ctx, '/alerts');
        }
        break;

      default:
        if (alertId != null) {
          _go(ctx, '/alerts');
        }
        break;
    }
  }

  // ignore: avoid_unused_parameters
  void _go(BuildContext _, String route) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = navigatorKey.currentContext;
      if (ctx == null) return;
      try {
        GoRouter.of(ctx).go(route);
      } catch (e) {
        debugPrint('FCM: Navigation to $route failed: $e');
      }
    });
  }

  /// CS-01: Show the video check-in accept/decline dialog to the child.
  void _showVideoCheckinRequestDialog(Map<String, dynamic> data) {
    final ctx = navigatorKey.currentContext;
    if (ctx == null) return;

    final sessionId    = data['sessionId']    as String? ?? '';
    final profileId    = data['profileId']    as String? ?? '';
    final parentUserId = data['parentUserId'] as String? ?? '';

    if (sessionId.isEmpty) {
      debugPrint('FCM: VIDEO_CHECKIN_REQUEST missing sessionId — ignored');
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx2 = navigatorKey.currentContext;
      if (ctx2 == null) return;
      showVideoCheckinRequestDialog(
        ctx2,
        sessionId:    sessionId,
        profileId:    profileId,
        parentUserId: parentUserId,
      );
    });
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

  /// FC-02: Show a snackbar to the child when the parent approves or denies their request.
  void _showScreenTimeSnackbar(Map<String, dynamic> data, {required bool approved}) {
    final ctx = navigatorKey.currentContext;
    if (ctx == null) return;

    final minutesStr = data['minutes'] as String? ?? '';
    final message = approved
        ? 'Your parent approved${minutesStr.isNotEmpty ? " $minutesStr extra minutes!" : " your screen time request!"}'
        : 'Your screen time request was not approved.';

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx2 = navigatorKey.currentContext;
      if (ctx2 == null) return;
      ScaffoldMessenger.of(ctx2).showSnackBar(SnackBar(
        content: Text(message, style: const TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: approved ? const Color(0xFF2E7D32) : const Color(0xFFC62828),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 5),
      ));
    });
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
