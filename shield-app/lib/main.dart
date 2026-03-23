import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'app/app.dart';
import 'core/fcm_service.dart';
import 'core/cache_service.dart';
import 'core/websocket_service.dart';
import 'core/background_location_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await CacheService.init();
  await initLocalNotifications();
  await initBackgroundService();

  // Initialize Firebase (requires google-services.json in android/app/)
  try {
    await Firebase.initializeApp();
    // Register background message handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    debugPrint('Firebase initialized');
  } catch (e) {
    // Firebase not configured yet — app still works without push notifications
    debugPrint('Firebase init skipped (not configured): $e');
  }

  runApp(const ProviderScope(child: ShieldApp()));
}
