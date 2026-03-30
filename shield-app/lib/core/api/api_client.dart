import 'package:dio/dio.dart';
import '../constants.dart';
import 'auth_interceptor.dart';

/// Singleton Dio client used throughout the app.
/// All requests go to AppConstants.baseUrl.
/// The AuthInterceptor attaches the Bearer token and handles refresh on 401.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

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
