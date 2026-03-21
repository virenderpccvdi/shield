import 'dart:io';
import 'package:flutter/services.dart';

/// Flutter wrapper for the Shield DNS VPN service (Android only).
///
/// The VPN intercepts all DNS queries from the device and forwards them
/// to the Shield DoH server. This ensures parental content filtering applies
/// automatically without any manual device configuration.
class DnsVpnService {
  static const _channel = MethodChannel('com.rstglobal.shield/vpn');

  /// Request the Android VPN permission dialog without starting the VPN service.
  /// Call this during device setup so the consent dialog appears while the parent
  /// is present. After this succeeds, [start] will launch the VPN silently.
  /// Returns true if permission was granted (or already granted), false if denied.
  static Future<bool> preparePermission() async {
    if (!Platform.isAndroid) return true;
    try {
      final result = await _channel.invokeMethod<bool>('prepareVpnPermission');
      return result ?? false;
    } on PlatformException catch (e) {
      // ignore: avoid_print
      print('[DnsVpnService] preparePermission failed: ${e.message}');
      return false;
    }
  }

  /// Start DNS VPN filtering with the given DoH URL.
  /// Returns true if VPN was started (or already running), false if user denied permission.
  static Future<bool> start(String dohUrl) async {
    if (!Platform.isAndroid) return false;
    try {
      final result = await _channel.invokeMethod<bool>('startVpn', {'dohUrl': dohUrl});
      return result ?? false;
    } on PlatformException catch (e) {
      // ignore: avoid_print
      print('[DnsVpnService] start failed: ${e.message}');
      return false;
    }
  }

  /// Stop DNS VPN filtering.
  static Future<void> stop() async {
    if (!Platform.isAndroid) return;
    try {
      await _channel.invokeMethod('stopVpn');
    } on PlatformException catch (e) {
      // ignore: avoid_print
      print('[DnsVpnService] stop failed: ${e.message}');
    }
  }

  /// Check whether the VPN service is currently active.
  static Future<bool> isRunning() async {
    if (!Platform.isAndroid) return false;
    try {
      final result = await _channel.invokeMethod<bool>('isVpnRunning');
      return result ?? false;
    } on PlatformException catch (_) {
      return false;
    }
  }
}
