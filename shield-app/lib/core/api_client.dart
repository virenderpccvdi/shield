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

  // AuthInterceptor handles: token injection, 401 → auto token refresh, logout on refresh failure.
  // Pass the AuthNotifier so it can update app state (not just clear storage) on refresh failure.
  dio.interceptors.add(AuthInterceptor(dio, ref.read(authProvider.notifier)));

  // Global error handler: connection timeouts and network errors only.
  // Do NOT call logout() here — AuthInterceptor already handles 401 exhaustion via the notifier.
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
      handler.next(err);
    },
  ));

  return dio;
});
