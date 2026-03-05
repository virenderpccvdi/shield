import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Service to manage app lock and deletion protection for child accounts.
/// Uses a parent-set PIN code to prevent unauthorized app removal.
class AppLockService {
  static const String _pinKey = 'shield_parent_pin';
  static const String _lockEnabledKey = 'shield_app_lock_enabled';
  static const String _isChildKey = 'shield_is_child_account';

  /// Check if the current account is a child account with app lock
  static Future<bool> isChildLocked() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_isChildKey) == true &&
        prefs.getBool(_lockEnabledKey) == true;
  }

  /// Set up app lock for a child account with a parent PIN
  static Future<void> enableAppLock(String pin) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_pinKey, pin);
    await prefs.setBool(_lockEnabledKey, true);
    await prefs.setBool(_isChildKey, true);
  }

  /// Mark this device as a child account
  static Future<void> setChildAccount(bool isChild) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_isChildKey, isChild);
    if (isChild) {
      await prefs.setBool(_lockEnabledKey, true);
    }
  }

  /// Verify the parent PIN
  static Future<bool> verifyPin(String pin) async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_pinKey);
    return stored != null && stored == pin;
  }

  /// Change the parent PIN (requires old PIN verification)
  static Future<bool> changePin(String oldPin, String newPin) async {
    if (await verifyPin(oldPin)) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_pinKey, newPin);
      return true;
    }
    return false;
  }

  /// Check if a PIN has been set
  static Future<bool> hasPinSet() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_pinKey) != null;
  }

  /// Disable app lock (requires PIN verification)
  static Future<bool> disableAppLock(String pin) async {
    if (await verifyPin(pin)) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_lockEnabledKey, false);
      return true;
    }
    return false;
  }

  /// Prevent the app from being removed by intercepting back button
  /// and showing PIN dialog when user tries to leave/uninstall
  static Future<bool> handleBackPress() async {
    if (await isChildLocked()) {
      // Block back press on child app — child cannot leave
      return false; // Don't allow back
    }
    return true; // Allow back
  }
}
