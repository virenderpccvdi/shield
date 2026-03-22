import 'dart:async';
import 'dart:convert';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';
import 'auth_state.dart';
import 'cache_service.dart';
import 'constants.dart';

/// Local notifications plugin instance
final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();

/// Riverpod provider for WebSocket service
final websocketServiceProvider = Provider<WebSocketService>((ref) {
  final service = WebSocketService(ref);
  ref.onDispose(() => service.disconnect());
  return service;
});

/// Initializes the local notifications plugin. Call once at app startup.
Future<void> initLocalNotifications() async {
  const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
  const iosSettings = DarwinInitializationSettings(
    requestAlertPermission: true,
    requestBadgePermission: true,
    requestSoundPermission: true,
  );
  const settings = InitializationSettings(android: androidSettings, iOS: iosSettings);
  await _notificationsPlugin.initialize(settings);
}

class WebSocketService {
  final Ref _ref;
  StompClient? _client;
  Timer? _reconnectTimer;
  bool _intentionalDisconnect = false;
  int _notificationId = 0;

  static const Duration _reconnectDelay = Duration(seconds: 5);
  static const Duration _maxReconnectDelay = Duration(seconds: 60);
  int _reconnectAttempts = 0;

  WebSocketService(this._ref);

  /// Connect to STOMP WebSocket with auth token
  void connect() {
    final auth = _ref.read(authProvider);
    if (!auth.isAuthenticated || auth.accessToken == null || auth.userId == null) {
      return;
    }

    _intentionalDisconnect = false;
    _reconnectAttempts = 0;

    _createClient(auth.accessToken!, auth.userId!);
  }

  void _createClient(String token, String userId) {
    _client?.deactivate();

    _client = StompClient(
      config: StompConfig.sockJS(
        url: AppConstants.wsUrl,
        stompConnectHeaders: {
          'Authorization': 'Bearer $token',
        },
        onConnect: (frame) {
          _reconnectAttempts = 0;
          _subscribeToNotifications(userId);
        },
        onDisconnect: (frame) {
          if (!_intentionalDisconnect) {
            _scheduleReconnect(token, userId);
          }
        },
        onWebSocketError: (error) {
          if (!_intentionalDisconnect) {
            _scheduleReconnect(token, userId);
          }
        },
        onStompError: (frame) {
          if (!_intentionalDisconnect) {
            _scheduleReconnect(token, userId);
          }
        },
      ),
    );

    _client!.activate();
  }

  void _subscribeToNotifications(String userId) {
    _client?.subscribe(
      destination: '/topic/notifications/$userId',
      callback: (frame) {
        if (frame.body != null) {
          _handleNotification(frame.body!);
        }
      },
    );

    // Subscribe to sync events for real-time data invalidation
    _client?.subscribe(
      destination: '/topic/sync/$userId',
      callback: (frame) {
        if (frame.body == null) return;
        try {
          final event = json.decode(frame.body!) as Map<String, dynamic>;
          final type = event['type'] as String? ?? '';
          if (type == 'DNS_RULES_CHANGED') {
            // Clear DNS rules cache so next screen open loads fresh data
            final profileId = event['profileId'] as String? ?? '';
            if (profileId.isNotEmpty) {
              CacheService.evict('dns_rules_$profileId');
            }
          }
        } catch (_) {}
      },
    );
  }

  void _handleNotification(String body) {
    try {
      final data = json.decode(body) as Map<String, dynamic>;
      final title = data['title'] as String? ?? 'Shield';
      final message = data['message'] as String? ?? data['body'] as String? ?? '';
      final type = data['type'] as String? ?? 'general';

      _showLocalNotification(title, message, type);
    } catch (_) {
      // If body is plain text, show it directly
      _showLocalNotification('Shield', body, 'general');
    }
  }

  Future<void> _showLocalNotification(String title, String body, String type) async {
    final androidDetails = AndroidNotificationDetails(
      'shield_notifications',
      'Shield Notifications',
      channelDescription: 'Notifications from Shield',
      importance: type == 'panic' || type == 'sos' ? Importance.max : Importance.high,
      priority: type == 'panic' || type == 'sos' ? Priority.max : Priority.high,
      icon: '@mipmap/ic_launcher',
      enableVibration: true,
      playSound: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(android: androidDetails, iOS: iosDetails);

    await _notificationsPlugin.show(
      _notificationId++,
      title,
      body,
      details,
    );
  }

  void _scheduleReconnect(String token, String userId) {
    _reconnectTimer?.cancel();

    // Exponential backoff capped at max delay
    final delay = Duration(
      seconds: (_reconnectDelay.inSeconds * (1 << _reconnectAttempts))
          .clamp(0, _maxReconnectDelay.inSeconds),
    );
    _reconnectAttempts++;

    _reconnectTimer = Timer(delay, () {
      // Re-read auth in case token was refreshed
      final auth = _ref.read(authProvider);
      if (auth.isAuthenticated && auth.accessToken != null && auth.userId != null) {
        _createClient(auth.accessToken!, auth.userId!);
      }
    });
  }

  /// Disconnect from WebSocket (call on logout or dispose)
  void disconnect() {
    _intentionalDisconnect = true;
    _reconnectTimer?.cancel();
    _client?.deactivate();
    _client = null;
  }

  /// Whether the STOMP client is currently connected
  bool get isConnected => _client?.connected ?? false;
}
