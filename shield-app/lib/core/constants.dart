class AppConstants {
  static const String baseUrl = 'https://shield.rstglobal.in/api/v1';
  static const String wsUrl = 'wss://shield.rstglobal.in/ws/shield-ws';
  static const String appName = 'Shield';
  static const Duration connectTimeout = Duration(seconds: 10);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
