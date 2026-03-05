import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_state.dart';
import 'constants.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(baseUrl: AppConstants.baseUrl, connectTimeout: AppConstants.connectTimeout, receiveTimeout: AppConstants.receiveTimeout, headers: {'Accept': 'application/json', 'Content-Type': 'application/json'}));
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (opts, handler) {
      final token = ref.read(authProvider).accessToken;
      if (token != null) opts.headers['Authorization'] = 'Bearer $token';
      handler.next(opts);
    },
    onError: (err, handler) {
      if (err.response?.statusCode == 401) ref.read(authProvider.notifier).logout();
      handler.next(err);
    },
  ));
  return dio;
});
