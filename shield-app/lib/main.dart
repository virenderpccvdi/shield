import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'app/app.dart';
import 'core/services/background_service.dart';
import 'core/services/fcm_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Configure background service (does not start it — only child devices start it)
  await BackgroundServiceHelper.configure();

  // Firebase push notifications (optional — app works without google-services.json)
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
    await FcmService.init();
  } catch (e) {
    debugPrint('[Shield] Firebase init skipped: $e');
  }

  runApp(const ProviderScope(child: ShieldApp()));
}
