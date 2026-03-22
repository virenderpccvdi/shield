import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Service to manage app lock and deletion protection for child accounts.
/// Uses a parent-set PIN code to prevent unauthorized app removal.
/// PIN is stored as SHA-256 hash in FlutterSecureStorage (Keystore/Keychain backed).
///
/// PO-01: Also manages parent app lock (background-triggered lock after 60s).
class AppLockService {
  static const FlutterSecureStorage _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  static const String _pinHashKey = 'shield_parent_pin_hash';
  static const String _lockEnabledKey = 'shield_app_lock_enabled';
  static const String _isChildKey = 'shield_is_child_account';

  // ── PO-01: Parent app lock keys ───────────────────────────────────────────
  static const String _parentLockEnabledKey = 'shield_parent_lock_enabled';
  static const String _lastBackgroundedKey = 'shield_last_backgrounded_at';

  /// Duration of inactivity before the parent app locks (60 seconds).
  static const int _lockAfterSeconds = 60;

  static String _hashPin(String pin) {
    final bytes = utf8.encode(pin);
    return sha256.convert(bytes).toString();
  }

  // ── Child app lock ────────────────────────────────────────────────────────

  /// Check if the current account is a child account with app lock
  static Future<bool> isChildLocked() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_isChildKey) == true &&
        prefs.getBool(_lockEnabledKey) == true;
  }

  /// Set up app lock for a child account with a parent PIN (stored as SHA-256 hash)
  static Future<void> enableAppLock(String pin) async {
    await _secure.write(key: _pinHashKey, value: _hashPin(pin));
    final prefs = await SharedPreferences.getInstance();
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

  /// Verify the parent PIN against stored hash (child lock flow)
  static Future<bool> verifyPin(String pin) async {
    final stored = await _secure.read(key: _pinHashKey);
    return stored != null && stored == _hashPin(pin);
  }

  /// Change the parent PIN (requires old PIN verification)
  static Future<bool> changePin(String oldPin, String newPin) async {
    if (await verifyPin(oldPin)) {
      await _secure.write(key: _pinHashKey, value: _hashPin(newPin));
      return true;
    }
    return false;
  }

  /// Check if a PIN has been set
  static Future<bool> hasPinSet() async {
    final stored = await _secure.read(key: _pinHashKey);
    return stored != null;
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
  static Future<bool> handleBackPress() async {
    if (await isChildLocked()) {
      return false; // Block back on child app
    }
    return true;
  }

  // ── PO-01: Parent app lock ─────────────────────────────────────────────────

  /// Set whether the parent app PIN lock is enabled.
  static Future<void> setParentLockEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_parentLockEnabledKey, enabled);
  }

  /// Record the time the app was backgrounded.
  static Future<void> recordBackgrounded() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_lastBackgroundedKey, DateTime.now().millisecondsSinceEpoch);
  }

  /// Returns true if the parent app should show the lock screen.
  /// Condition: PIN lock is enabled AND app was backgrounded for > 60 seconds.
  static Future<bool> shouldLock() async {
    final prefs = await SharedPreferences.getInstance();
    final lockEnabled = prefs.getBool(_parentLockEnabledKey) == true;
    if (!lockEnabled) return false;

    final lastBgMs = prefs.getInt(_lastBackgroundedKey);
    if (lastBgMs == null) return false;

    final elapsed = DateTime.now().millisecondsSinceEpoch - lastBgMs;
    return elapsed >= (_lockAfterSeconds * 1000);
  }

  /// Clear the last backgrounded timestamp (called after successful unlock).
  static Future<void> clearBackgroundedTime() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_lastBackgroundedKey);
  }
}
