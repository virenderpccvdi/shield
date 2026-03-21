import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';
import '../auth_state.dart';

class AuthInterceptor extends Interceptor {
  final Dio dio;
  final AuthNotifier _authNotifier;

  AuthInterceptor(this.dio, this._authNotifier);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await SecureStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // Try refresh token
      final refresh = await SecureStorage.getRefreshToken();
      if (refresh != null) {
        try {
          final response = await dio.post('/auth/refresh', data: {'refreshToken': refresh});
          final newToken = response.data['data']['accessToken'] as String;
          await SecureStorage.saveTokens(access: newToken, refresh: refresh);
          // Retry original request with the new token
          final opts = err.requestOptions;
          opts.headers['Authorization'] = 'Bearer $newToken';
          final cloneReq = await dio.request(
            opts.path,
            options: Options(method: opts.method, headers: opts.headers),
            data: opts.data,
            queryParameters: opts.queryParameters,
          );
          return handler.resolve(cloneReq);
        } catch (_) {
          // Refresh failed — clear storage AND update AuthNotifier state so the
          // router redirects to /login. Without this, storage is cleared but the
          // in-memory AuthState still shows isAuthenticated=true.
          await _authNotifier.logout();
        }
      } else {
        // No refresh token at all — session is definitively expired
        await _authNotifier.logout();
      }
    }
    handler.next(err);
  }
}
