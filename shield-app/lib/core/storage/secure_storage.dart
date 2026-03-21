import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Thin wrapper around FlutterSecureStorage.
///
/// KEY ALIGNMENT: The access token key 'access_token' MUST match the key
/// used by AuthNotifier._parentTokenKey in auth_state.dart.  Both refer to
/// the parent (logged-in user) access token.  The child access token uses a
/// separate key 'child_access_token' so child-device setup cannot overwrite
/// a logged-in parent session.
class SecureStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  // Must match AuthNotifier._parentTokenKey
  static const _accessTokenKey  = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _userKey         = 'shield_user';

  static Future<void> saveTokens({required String access, required String refresh}) async {
    await _storage.write(key: _accessTokenKey, value: access);
    await _storage.write(key: _refreshTokenKey, value: refresh);
  }

  static Future<String?> getAccessToken()  => _storage.read(key: _accessTokenKey);
  static Future<String?> getRefreshToken() => _storage.read(key: _refreshTokenKey);

  static Future<void> saveUser(String userJson) => _storage.write(key: _userKey, value: userJson);
  static Future<String?> getUser() => _storage.read(key: _userKey);

  static Future<void> clearAll() => _storage.deleteAll();
}
