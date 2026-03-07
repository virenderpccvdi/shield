import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _accessTokenKey = 'shield_access_token';
  static const _refreshTokenKey = 'shield_refresh_token';
  static const _userKey = 'shield_user';

  static Future<void> saveTokens({required String access, required String refresh}) async {
    await _storage.write(key: _accessTokenKey, value: access);
    await _storage.write(key: _refreshTokenKey, value: refresh);
  }

  static Future<String?> getAccessToken() => _storage.read(key: _accessTokenKey);
  static Future<String?> getRefreshToken() => _storage.read(key: _refreshTokenKey);

  static Future<void> saveUser(String userJson) => _storage.write(key: _userKey, value: userJson);
  static Future<String?> getUser() => _storage.read(key: _userKey);

  static Future<void> clearAll() => _storage.deleteAll();
}
