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

  Future<void> _load() async {
    // Check child mode first
    final childProfileId = await _storage.read(key: 'child_profile_id');
    if (childProfileId != null) {
      final token = await _storage.read(key: 'access_token');
      state = AuthState(
        accessToken: token,
        name: await _storage.read(key: 'user_name'),
        childProfileId: childProfileId,
        childName: await _storage.read(key: 'child_name'),
        isAuthenticated: token != null,
        isChildMode: true,
      );
      return;
    }
    final token = await _storage.read(key: 'access_token');
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

  Future<void> setAuth({required String userId, required String accessToken, required String name, required String email, required String role}) async {
    await _storage.write(key: 'access_token', value: accessToken);
    await _storage.write(key: 'user_id', value: userId);
    await _storage.write(key: 'user_name', value: name);
    await _storage.write(key: 'user_email', value: email);
    await _storage.write(key: 'user_role', value: role);
    state = AuthState(userId: userId, accessToken: accessToken, name: name, email: email, role: role, isAuthenticated: true);
  }

  Future<void> setChildMode({required String accessToken, required String profileId, required String childName}) async {
    await _storage.write(key: 'access_token', value: accessToken);
    await _storage.write(key: 'child_profile_id', value: profileId);
    await _storage.write(key: 'child_name', value: childName);
    state = AuthState(
      accessToken: accessToken,
      name: childName,
      childProfileId: profileId,
      childName: childName,
      isAuthenticated: true,
      isChildMode: true,
    );
  }

  Future<void> logout() async { await _storage.deleteAll(); state = const AuthState(); }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) => AuthNotifier(const FlutterSecureStorage()));
