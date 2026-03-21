import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthState {
  final String? userId, accessToken, name, email, role;
  final String? childProfileId, childName;
  final bool isAuthenticated, isChildMode;
  const AuthState({
    this.userId, this.accessToken, this.name, this.email, this.role,
    this.childProfileId, this.childName,
    this.isAuthenticated = false, this.isChildMode = false,
  });
}

class AuthNotifier extends StateNotifier<AuthState> {
  final FlutterSecureStorage _storage;
  AuthNotifier(this._storage) : super(const AuthState()) { _load(); }

  // Storage keys — parent and child use separate token keys so child setup
  // cannot overwrite a logged-in parent session.
  static const _parentTokenKey   = 'access_token';
  static const _childTokenKey    = 'child_access_token';
  static const _childProfileKey  = 'child_profile_id';
  static const _childNameKey     = 'child_name';

  Future<void> _load() async {
    // Check child mode first (separate key — does NOT conflict with parent token)
    final childProfileId = await _storage.read(key: _childProfileKey);
    if (childProfileId != null) {
      final token = await _storage.read(key: _childTokenKey);
      state = AuthState(
        accessToken: token,
        name: await _storage.read(key: _childNameKey),
        childProfileId: childProfileId,
        childName: await _storage.read(key: _childNameKey),
        isAuthenticated: token != null,
        isChildMode: true,
      );
      return;
    }
    final token = await _storage.read(key: _parentTokenKey);
    if (token != null) {
      state = AuthState(
        userId: await _storage.read(key: 'user_id'),
        accessToken: token,
        name: await _storage.read(key: 'user_name'),
        email: await _storage.read(key: 'user_email'),
        role: await _storage.read(key: 'user_role'),
        isAuthenticated: true,
      );
    }
  }

  // Must match SecureStorage._refreshTokenKey
  static const _refreshTokenKey = 'refresh_token';

  Future<void> setAuth({
    required String userId,
    required String accessToken,
    required String name,
    required String email,
    required String role,
    String? refreshToken,
  }) async {
    await _storage.write(key: _parentTokenKey, value: accessToken);
    await _storage.write(key: 'user_id', value: userId);
    await _storage.write(key: 'user_name', value: name);
    await _storage.write(key: 'user_email', value: email);
    await _storage.write(key: 'user_role', value: role);
    if (refreshToken != null) {
      await _storage.write(key: _refreshTokenKey, value: refreshToken);
    }
    state = AuthState(userId: userId, accessToken: accessToken, name: name, email: email, role: role, isAuthenticated: true);
  }

  Future<void> setChildMode({required String accessToken, required String profileId, required String childName}) async {
    // Write to child-specific keys — does NOT touch parent's 'access_token' key
    await _storage.write(key: _childTokenKey, value: accessToken);
    await _storage.write(key: _childProfileKey, value: profileId);
    await _storage.write(key: _childNameKey, value: childName);
    state = AuthState(
      accessToken: accessToken,
      name: childName,
      childProfileId: profileId,
      childName: childName,
      isAuthenticated: true,
      isChildMode: true,
    );
  }

  /// Clear only child mode — used when exiting child mode without full logout
  Future<void> clearChildMode() async {
    await _storage.delete(key: _childTokenKey);
    await _storage.delete(key: _childProfileKey);
    await _storage.delete(key: _childNameKey);
    // Reload parent session if one exists
    await _load();
  }

  Future<void> logout() async { await _storage.deleteAll(); state = const AuthState(); }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) => AuthNotifier(const FlutterSecureStorage()));
