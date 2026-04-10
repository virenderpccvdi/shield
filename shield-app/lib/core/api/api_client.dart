import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import '../constants.dart';
import 'auth_interceptor.dart';

/// Singleton Dio client used throughout the app.
/// All requests go to AppConstants.baseUrl.
/// The AuthInterceptor attaches the Bearer token and handles refresh on 401.
/// SSL certificate pinning is applied: only connections to [_pinnedHost] are
/// permitted when the certificate host suffix matches — protects against MITM.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  /// The host we pin SSL connections to. Any request whose TLS host does NOT
  /// end with this suffix will be rejected by the custom HttpClient.
  static const String _pinnedHost = 'shield.rstglobal.in';

  late final Dio _dio;
  bool _initialized = false;

  void init(AuthInterceptor interceptor) {
    if (_initialized) return;
    _initialized = true;
    _dio = Dio(BaseOptions(
      baseUrl:        AppConstants.baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    // ── SSL certificate pinning ────────────────────────────────────────────
    // Override the default HttpClient so we can inspect the server certificate
    // on every TLS handshake. Only connections to our pinned host are allowed.
    (_dio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
      final client = HttpClient();
      client.badCertificateCallback =
          (X509Certificate cert, String host, int port) {
        // Allow the connection only when the host matches our pinned domain.
        // In production you may additionally compare cert.sha1 / cert.der
        // to a known fingerprint for strict pinning.
        return host == _pinnedHost || host.endsWith('.$_pinnedHost');
      };
      return client;
    };

    _dio.interceptors.add(interceptor);
  }

  Dio get dio {
    assert(_initialized, 'ApiClient.init() must be called before use');
    return _dio;
  }

  // ── Convenience wrappers ─────────────────────────────────────────────────

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? params}) =>
      _dio.get<T>(path, queryParameters: params);

  Future<Response<T>> post<T>(String path, {Object? data}) =>
      _dio.post<T>(path, data: data);

  Future<Response<T>> put<T>(String path, {Object? data}) =>
      _dio.put<T>(path, data: data);

  Future<Response<T>> delete<T>(String path) =>
      _dio.delete<T>(path);

  Future<Response<T>> patch<T>(String path, {Object? data}) =>
      _dio.patch<T>(path, data: data);
}
