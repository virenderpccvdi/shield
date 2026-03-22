import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';
import '../auth_state.dart';

class AuthInterceptor extends Interceptor {
  final Dio dio;
  final AuthNotifier _authNotifier;

  AuthInterceptor(this.dio, this._authNotifier);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Read token from AuthNotifier state — always correct for both parent and child mode.
    // Do NOT use SecureStorage.getAccessToken() which always reads the parent key
    // ('access_token') and will return null in child mode (stored under 'child_access_token').
    final token = _authNotifier.state.accessToken;
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    try {
      if (err.response?.statusCode == 401) {
        // In child mode there is no refresh token — clear child mode only (restores
        // parent session if one exists, or redirects to login on a child-only device).
        if (_authNotifier.state.isChildMode) {
          await _authNotifier.clearChildMode();
          handler.next(err);
          return;
        }
        // Parent mode: try to refresh
        final refresh = await SecureStorage.getRefreshToken();
        if (refresh != null) {
          try {
            final response = await dio.post('/auth/refresh', data: {'refreshToken': refresh});
            final newToken = response.data['data']['accessToken'] as String;
            await SecureStorage.saveTokens(access: newToken, refresh: refresh);
            _authNotifier.updateToken(newToken);
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
            await _authNotifier.logout();
          }
        } else {
          await _authNotifier.logout();
        }
      }
      handler.next(err);
    } catch (_) {
      handler.next(err);
    }
  }
}
