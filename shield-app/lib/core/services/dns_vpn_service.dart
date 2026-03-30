import 'package:flutter/services.dart';
import '../constants.dart';

/// Communicates with the native VPN service via MethodChannel.
/// Channel name must exactly match MainActivity.kt: "com.rstglobal.shield/vpn"
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
    } on PlatformException catch (e) {
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
}
