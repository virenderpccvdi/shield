import 'package:local_auth/local_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class BiometricService {
  static final _auth = LocalAuthentication();
  static const _storage = FlutterSecureStorage();
  static const _biometricEnabledKey = 'biometric_enabled';

  static Future<bool> isAvailable() async {
    try {
      return await _auth.canCheckBiometrics && await _auth.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }

  static Future<bool> isEnabled() async {
    final val = await _storage.read(key: _biometricEnabledKey);
    return val == 'true';
  }

  static Future<void> setEnabled(bool enabled) async {
    await _storage.write(key: _biometricEnabledKey, value: enabled.toString());
  }

  static Future<bool> authenticate() async {
    try {
      return await _auth.authenticate(
        localizedReason: 'Authenticate to open Shield',
        options: const AuthenticationOptions(biometricOnly: false, stickyAuth: true),
      );
    } catch (_) {
      return false;
    }
  }
}
