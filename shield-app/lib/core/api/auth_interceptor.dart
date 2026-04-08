import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../constants.dart';
import '../services/storage_service.dart';

typedef OnClearSession = Future<void> Function();

/// Attaches the Bearer token to every request.
/// On 401: attempts one token refresh (parent mode only).
/// If refresh fails — or if in child mode — clears the session.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required this.onClearParentSession,
    required this.onClearChildSession,
    required this.getIsChildMode,
  });

  final OnClearSession onClearParentSession;
  final OnClearSession onClearChildSession;
  final bool Function() getIsChildMode;

  // ── Auto-unwrap { "data": X, "success": true } for every response ──────────
  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final body = response.data;
    if (body is Map<String, dynamic> &&
        body['success'] == true &&
        body.containsKey('data')) {
      response.data = body['data'];
    }
    handler.next(response);
  }

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final storage = StorageService.instance;
    final isChild = getIsChildMode();

    final token = isChild
        ? await storage.read(AppConstants.keyChildToken)
        : await storage.read(AppConstants.keyAccessToken);

    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    final isChild = getIsChildMode();

    if (isChild) {
      // Child token expired — clear child session, show expired screen
      debugPrint('[Auth] Child token 401 → clearing child session');
      await onClearChildSession();
      handler.next(err);
      return;
    }

    // Parent mode — attempt refresh
    final refreshToken = await StorageService.instance.read(AppConstants.keyRefreshToken);
    if (refreshToken == null) {
      await onClearParentSession();
      handler.next(err);
      return;
    }

    try {
      final refreshDio = Dio(BaseOptions(baseUrl: AppConstants.baseUrl));
      final resp = await refreshDio.post(
        '/auth/token/refresh',
        data: {'refreshToken': refreshToken},
      );
      // API wraps response: { "data": {...}, "success": true }
      final body = resp.data as Map<String, dynamic>;
      final inner = (body['data'] as Map<String, dynamic>?) ?? body;
      final newAccess  = inner['accessToken']  as String?;
      final newRefresh = inner['refreshToken'] as String?;

      if (newAccess == null) {
        await onClearParentSession();
        handler.next(err);
        return;
      }

      await StorageService.instance.write(AppConstants.keyAccessToken, newAccess);
      if (newRefresh != null) {
        await StorageService.instance.write(AppConstants.keyRefreshToken, newRefresh);
      }

      // Retry original request with new token
      final retryOptions = err.requestOptions
        ..headers['Authorization'] = 'Bearer $newAccess';

      final retryDio = Dio(BaseOptions(baseUrl: AppConstants.baseUrl));
      final retryResp = await retryDio.fetch(retryOptions);

      // Manually unwrap { "data": X, "success": true } since interceptor
      // is not attached to this temporary Dio instance
      if (retryResp.data is Map<String, dynamic>) {
        final body = retryResp.data as Map<String, dynamic>;
        if (body['success'] == true && body.containsKey('data')) {
          retryResp.data = body['data'];
        }
      }
      handler.resolve(retryResp);
    } catch (_) {
      debugPrint('[Auth] Refresh failed → clearing parent session');
      await onClearParentSession();
      handler.next(err);
    }
  }
}
