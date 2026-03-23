import 'package:flutter/services.dart';

/// Flutter wrapper for the Android app-blocking service.
///
/// Uses UsageStatsManager (PACKAGE_USAGE_STATS) to detect foreground app.
/// No AccessibilityService or SYSTEM_ALERT_WINDOW needed.
///
/// Flow:
///   1. Check if Usage Access permission is granted.
///   2. If not, open Settings > Apps > Special Access > Usage Access.
///   3. Call [setBlockedApps] with package names from the server.
///   4. Call [setEnabled(true)] to start the blocking service.
class AppBlockingService {
  static const _channel = MethodChannel('com.rstglobal.shield/app_block');

  /// Push the list of blocked package names to the native layer.
  static Future<bool> setBlockedApps(List<String> packages) async {
    try {
      return await _channel.invokeMethod<bool>(
              'setBlockedApps', {'packages': packages}) ??
          false;
    } catch (_) {
      return false;
    }
  }

  /// Enable or disable app blocking enforcement.
  static Future<bool> setEnabled(bool enabled) async {
    try {
      return await _channel.invokeMethod<bool>(
              'setEnabled', {'enabled': enabled}) ??
          false;
    } catch (_) {
      return false;
    }
  }

  /// Set child's display name.
  static Future<void> setChildName(String name) async {
    try {
      await _channel.invokeMethod<void>('setChildName', {'name': name});
    } catch (_) {}
  }

  /// Returns true if PACKAGE_USAGE_STATS permission is granted.
  static Future<bool> isUsageStatsGranted() async {
    try {
      return await _channel.invokeMethod<bool>('isUsageStatsGranted') ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Open Android Usage Access settings so user can grant permission.
  static Future<void> openUsageStatsSettings() async {
    try {
      await _channel.invokeMethod<void>('openUsageStatsSettings');
    } catch (_) {}
  }

  /// Returns today's foreground usage in minutes per package name.
  /// Returns empty map if permission not granted or on non-Android platforms.
  static Future<Map<String, int>> getUsageStats() async {
    try {
      final raw = await _channel.invokeMapMethod<String, int>('getUsageStats');
      return raw ?? {};
    } catch (_) {
      return {};
    }
  }

  /// Returns true if blocking is currently active.
  static Future<bool> isBlockingActive() async {
    try {
      return await _channel.invokeMethod<bool>('isBlockingActive') ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Full setup: configure service with blocked apps and enable blocking.
  static Future<AppBlockingStatus> setup({
    required List<String> blockedPackages,
    required String childName,
  }) async {
    final usageOk = await isUsageStatsGranted();
    if (!usageOk) {
      return AppBlockingStatus.needsUsageStatsPermission;
    }

    await setChildName(childName);
    await setBlockedApps(blockedPackages);
    await setEnabled(true);
    return AppBlockingStatus.active;
  }
}

enum AppBlockingStatus {
  active,
  needsUsageStatsPermission,
  unavailable,
}
