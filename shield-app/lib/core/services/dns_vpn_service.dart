import 'dart:convert';
import 'package:flutter/services.dart';
import '../api/api_client.dart';
import '../constants.dart';
import 'storage_service.dart';

/// Communicates with the native VPN service via MethodChannel.
/// Channel name must exactly match MainActivity.kt: "com.rstglobal.shield/vpn"
///
/// Also owns the DNS rules offline cache: [fetchDnsRules] tries the backend
/// first, persists the result, then falls back to the local cache when the
/// network is unavailable.
class DnsVpnService {
  DnsVpnService._();

  static const _channel = MethodChannel(AppConstants.vpnChannel);

  /// Request VPN permission from the OS.
  /// Returns true if permission is already granted or the user grants it.
  /// Call this AFTER saving child credentials to storage.
  static Future<bool> requestPermission() async {
    try {
      final result = await _channel.invokeMethod<bool>('prepareVpnPermission');
      return result ?? false;
    } on PlatformException catch (_) {
      // User denied or error
      return false;
    }
  }

  /// Start the DoH VPN tunnel with the given DNS-over-HTTPS URL.
  static Future<bool> start({required String dohUrl}) async {
    try {
      final result = await _channel.invokeMethod<bool>('startVpn', {'dohUrl': dohUrl});
      return result ?? false;
    } on PlatformException {
      return false;
    }
  }

  /// Stop the VPN tunnel.
  static Future<void> stop() async {
    try {
      await _channel.invokeMethod('stopVpn');
    } on PlatformException {
      // ignore
    }
  }

  /// Returns true if the VPN tunnel is currently active.
  static Future<bool> isRunning() async {
    try {
      final result = await _channel.invokeMethod<bool>('isVpnRunning');
      return result ?? false;
    } on PlatformException {
      return false;
    }
  }

  // ── DNS rules offline cache ───────────────────────────────────────────────

  /// Fetch DNS rules for [profileId] from the backend.
  ///
  /// On success the rules are persisted to encrypted local storage so the app
  /// can operate when the network is unavailable.  On any network error the
  /// cached copy (up to 24 h old) is returned instead.  Returns null only
  /// when both the network call fails and no valid cache exists.
  static Future<Map<String, dynamic>?> fetchDnsRules(String profileId) async {
    try {
      final resp = await ApiClient.instance.get(
        '/dns/profiles/$profileId/rules',
      );
      final data = resp.data is Map<String, dynamic>
          ? resp.data as Map<String, dynamic>
          : <String, dynamic>{'rules': resp.data};

      // Persist to cache on success.
      await StorageService.instance.saveDnsRulesCache(jsonEncode(data));
      return data;
    } catch (_) {
      // Network or server error — try local cache.
      final cached = await StorageService.instance.loadDnsRulesCache();
      if (cached != null) {
        return jsonDecode(cached) as Map<String, dynamic>;
      }
      return null;
    }
  }

  /// Save DNS rules to the local cache without making a network call.
  /// Useful when rules are already fetched as part of a larger profile load.
  static Future<void> cacheDnsRules(Map<String, dynamic> rules) async {
    await StorageService.instance.saveDnsRulesCache(jsonEncode(rules));
  }
}
