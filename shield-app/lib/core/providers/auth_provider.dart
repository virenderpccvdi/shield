import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/auth_interceptor.dart';
import '../api/endpoints.dart';
import '../constants.dart';
import '../models/auth_state.dart';
import '../services/storage_service.dart';
import '../services/dns_vpn_service.dart';

// ── Provider ─────────────────────────────────────────────────────────────────

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(),
);

// ── Notifier ─────────────────────────────────────────────────────────────────

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(AuthState.loading) {
    _initApiClient();
    _load();
  }

  // Tracks whether we're in child mode so the interceptor can read it synchronously
  bool _isChildMode = false;

  void _initApiClient() {
    final interceptor = AuthInterceptor(
      getIsChildMode:       () => _isChildMode,
      onClearParentSession: _handleParentAuthFailure,
      onClearChildSession:  _handleChildAuthFailure,
    );
    ApiClient.instance.init(interceptor);
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  Future<void> _load() async {
    final storage = StorageService.instance;
    final onboarded = await storage.isOnboarded();

    // 1. Check for child device session first
    final child = await storage.loadChildSession();
    final isChildDevice = child['isChildDevice'] == 'true';
    final childToken = child['childToken'];

    if (isChildDevice && childToken != null && childToken.isNotEmpty) {
      _isChildMode = true;
      state = AuthState(
        status:         AuthStatus.child,
        childProfileId: child['childProfileId'],
        childName:      child['childName'],
        dohUrl:         child['dohUrl'],
        isOnboarded:    true,
      );
      // Restart VPN if credentials exist but VPN isn't running
      _ensureVpnRunning(child['dohUrl']);
      return;
    }

    // 2. Check for parent session
    final parent = await storage.loadParentSession();
    final accessToken = parent['accessToken'];
    if (accessToken != null && accessToken.isNotEmpty) {
      _isChildMode = false;
      state = AuthState(
        status:      AuthStatus.parent,
        accessToken: accessToken,
        refreshToken: parent['refreshToken'],
        userId:      parent['userId'],
        tenantId:    parent['tenantId'],
        role:        parent['role'],
        isOnboarded: onboarded,
      );
      return;
    }

    // 3. Nothing stored
    _isChildMode = false;
    state = AuthState(
      status:      AuthStatus.unauthenticated,
      isOnboarded: onboarded,
    );
  }

  Future<void> _ensureVpnRunning(String? dohUrl) async {
    if (dohUrl == null || dohUrl.isEmpty) return;
    try {
      final running = await DnsVpnService.isRunning();
      if (!running) await DnsVpnService.start(dohUrl: dohUrl);
    } catch (e) {
      debugPrint('[Shield] VPN restart failed: $e');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /// The backend wraps all responses: { "data": {...}, "success": true }.
  /// This unwraps the inner "data" object, falling back to the raw body.
  Map<String, dynamic> _unwrap(dynamic body) {
    if (body is Map<String, dynamic>) {
      if (body.containsKey('data') && body['data'] is Map<String, dynamic>) {
        return body['data'] as Map<String, dynamic>;
      }
      return body;
    }
    return {};
  }

  // ── Login / Logout ─────────────────────────────────────────────────────────

  Future<String?> login({required String email, required String password}) async {
    try {
      final resp = await ApiClient.instance.post(
        Endpoints.login,
        data: {'email': email, 'password': password},
      );
      final data = _unwrap(resp.data);
      final accessToken  = data['accessToken']  as String? ?? '';
      final refreshToken = data['refreshToken'] as String? ?? '';
      final userId       = data['userId']?.toString()   ?? '';
      final tenantId     = data['tenantId']?.toString() ?? '';
      final role         = data['role']?.toString()     ?? '';

      await StorageService.instance.saveParentSession(
        accessToken:  accessToken,
        refreshToken: refreshToken,
        userId:       userId,
        tenantId:     tenantId,
        role:         role,
      );
      await StorageService.instance.setOnboarded();

      _isChildMode = false;
      state = AuthState(
        status:      AuthStatus.parent,
        accessToken: accessToken,
        refreshToken: refreshToken,
        userId:      userId,
        tenantId:    tenantId,
        role:        role,
        isOnboarded: true,
      );
      return null; // success
    } catch (e) {
      return _extractError(e);
    }
  }

  Future<String?> register({
    required String name,
    required String email,
    required String password,
  }) async {
    try {
      final resp = await ApiClient.instance.post(
        Endpoints.register,
        data: {'name': name, 'email': email, 'password': password, 'role': 'CUSTOMER'},
      );
      final data = _unwrap(resp.data);
      final accessToken  = data['accessToken']  as String? ?? '';
      final refreshToken = data['refreshToken'] as String? ?? '';
      final userId       = data['userId']?.toString()   ?? '';
      final tenantId     = data['tenantId']?.toString() ?? '';
      final role         = data['role']?.toString()     ?? '';

      await StorageService.instance.saveParentSession(
        accessToken: accessToken, refreshToken: refreshToken,
        userId: userId, tenantId: tenantId, role: role,
      );
      await StorageService.instance.setOnboarded();

      _isChildMode = false;
      state = AuthState(
        status: AuthStatus.parent,
        accessToken: accessToken, refreshToken: refreshToken,
        userId: userId, tenantId: tenantId, role: role,
        isOnboarded: true,
      );
      return null;
    } catch (e) {
      return _extractError(e);
    }
  }

  Future<void> logout() async {
    try {
      await ApiClient.instance.post(Endpoints.logout);
    } catch (_) {}
    await StorageService.instance.clearParentSession();
    _isChildMode = false;
    state = AuthState.unauthenticated;
  }

  // ── Child device setup ─────────────────────────────────────────────────────

  /// Issue a child token and save ALL credentials BEFORE returning.
  /// The caller must show any system dialogs (VPN) AFTER this completes.
  Future<String?> activateChildDevice({
    required String parentUserId,
    required String childProfileId,
    required String childName,
    String? dohUrl,
    String? pin,
    /// When the parent authenticated via a separate bare-Dio login (child device
    /// setup flow), pass their access token here so we bypass the ApiClient
    /// interceptor, which has no stored token on a fresh child device.
    String? parentAccessToken,
  }) async {
    try {
      final body = {
        'parentUserId':   parentUserId,
        'childProfileId': childProfileId,
        if (pin != null && pin.isNotEmpty) 'pin': pin,
      };

      final Response resp;
      if (parentAccessToken != null && parentAccessToken.isNotEmpty) {
        // Child device setup: use bare Dio with explicit parent bearer token
        resp = await Dio(BaseOptions(baseUrl: AppConstants.baseUrl)).post(
          Endpoints.childToken,
          data: body,
          options: Options(headers: {'Authorization': 'Bearer $parentAccessToken'}),
        );
      } else {
        // Parent's own device: authenticated ApiClient carries stored token
        resp = await ApiClient.instance.post(Endpoints.childToken, data: body);
      }

      final childToken = _unwrap(resp.data)['accessToken'] as String? ?? '';

      // ⚡ Save IMMEDIATELY — before any VPN/permission dialogs
      await StorageService.instance.saveChildSession(
        childToken:     childToken,
        childProfileId: childProfileId,
        childName:      childName,
        dohUrl:         dohUrl,
      );

      _isChildMode = true;
      state = AuthState(
        status:         AuthStatus.child,
        childProfileId: childProfileId,
        childName:      childName,
        dohUrl:         dohUrl,
        isOnboarded:    true,
      );
      return null; // success
    } catch (e) {
      return _extractError(e);
    }
  }

  Future<void> deactivateChildDevice() async {
    await DnsVpnService.stop();
    await StorageService.instance.clearChildSession();
    _isChildMode = false;

    // Restore parent session if one exists
    final parent = await StorageService.instance.loadParentSession();
    if (parent['accessToken'] != null) {
      state = AuthState(
        status:      AuthStatus.parent,
        accessToken: parent['accessToken'],
        refreshToken: parent['refreshToken'],
        userId:      parent['userId'],
        tenantId:    parent['tenantId'],
        role:        parent['role'],
        isOnboarded: true,
      );
    } else {
      state = AuthState.unauthenticated;
    }
  }

  // ── Session failure callbacks (called by AuthInterceptor) ─────────────────

  Future<void> _handleParentAuthFailure() async {
    await StorageService.instance.clearParentSession();
    _isChildMode = false;
    state = AuthState.unauthenticated;
  }

  Future<void> _handleChildAuthFailure() async {
    // Child token expired — mark expired so UI shows re-setup prompt
    await StorageService.instance.clearChildSession();
    _isChildMode = false;
    state = state.copyWith(
      status:              AuthStatus.unauthenticated,
      childSessionExpired: true,
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  String _extractError(Object e) {
    if (e is DioException) {
      final status = e.response?.statusCode;
      if (status == 401) return 'Invalid email or password.';
      if (status == 403) return 'Account is disabled or not authorised.';
      if (status == 409) return 'Email already registered.';
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.connectionError) {
        return 'No internet connection. Check your network and try again.';
      }
      // Try to extract backend message
      final body = e.response?.data;
      if (body is Map) {
        final msg = body['message']?.toString();
        if (msg != null && msg.isNotEmpty) return msg;
      }
    }
    return 'Something went wrong. Please try again.';
  }
}
