import 'package:shared_preferences/shared_preferences.dart';

/// Manages unread alert count. Updates in-app navigation badge.
/// App-icon badging is handled natively on supported launchers via
/// [FlutterLocalNotifications] push notifications — no extra plugin needed.
class BadgeService {
  static const _countKey = 'unread_alert_count';

  static Future<int> getCount() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_countKey) ?? 0;
  }

  static Future<void> setCount(int count) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_countKey, count < 0 ? 0 : count);
  }

  static Future<void> clear() => setCount(0);

  static Future<void> increment() async {
    final current = await getCount();
    await setCount(current + 1);
  }
}
