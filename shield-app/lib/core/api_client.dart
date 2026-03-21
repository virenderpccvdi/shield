import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_state.dart';
import 'constants.dart';
import 'api/auth_interceptor.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: AppConstants.baseUrl,
    connectTimeout: AppConstants.connectTimeout,
    receiveTimeout: AppConstants.receiveTimeout,
    headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
  ));

  // AuthInterceptor handles: token injection, 401 → auto token refresh, logout on refresh failure
  dio.interceptors.add(AuthInterceptor(dio));

  // Global error handler: connection timeouts, network errors, and fallback 401 logout
  dio.interceptors.add(InterceptorsWrapper(
    onError: (err, handler) {
      if (err.type == DioExceptionType.connectionTimeout ||
          err.type == DioExceptionType.sendTimeout ||
          err.type == DioExceptionType.receiveTimeout) {
        handler.reject(
          DioException(
            requestOptions: err.requestOptions,
            error: 'Connection timed out. Please check your internet connection.',
            type: err.type,
          ),
        );
        return;
      }
      if (err.type == DioExceptionType.connectionError) {
        handler.reject(
          DioException(
            requestOptions: err.requestOptions,
            error: 'No internet connection. Please check your connection.',
            type: err.type,
          ),
        );
        return;
      }
      // Fallback 401 logout if AuthInterceptor did not handle it (e.g. refresh also 401'd)
      if (err.response?.statusCode == 401) {
        ref.read(authProvider.notifier).logout();
      }
      handler.next(err);
    },
  ));

  return dio;
});
