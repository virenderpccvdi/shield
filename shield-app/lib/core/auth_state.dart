import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthState {
  final String? userId, accessToken, name, email, role;
  final bool isAuthenticated;
  const AuthState({this.userId, this.accessToken, this.name, this.email, this.role, this.isAuthenticated = false});
  AuthState copyWith({String? userId, String? accessToken, String? name, String? email, String? role, bool? isAuthenticated}) =>
    AuthState(userId: userId ?? this.userId, accessToken: accessToken ?? this.accessToken, name: name ?? this.name, email: email ?? this.email, role: role ?? this.role, isAuthenticated: isAuthenticated ?? this.isAuthenticated);
}

class AuthNotifier extends StateNotifier<AuthState> {
  final FlutterSecureStorage _storage;
  AuthNotifier(this._storage) : super(const AuthState()) { _load(); }

  Future<void> _load() async {
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

  Future<void> logout() async { await _storage.deleteAll(); state = const AuthState(); }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) => AuthNotifier(const FlutterSecureStorage()));
