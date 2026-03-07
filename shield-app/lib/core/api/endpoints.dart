class Endpoints {
  static const String baseUrl = String.fromEnvironment('API_URL', defaultValue: 'https://shield.rstglobal.in/api/v1');

  // Auth
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String me = '/auth/me';
  static const String childToken = '/auth/child/token';

  // Profile
  static const String children = '/profiles/children';
  static String childById(String id) => '/profiles/children/$id';
  static String childStatus(String id) => '/profiles/children/$id/status';
  static String devicesForProfile(String profileId) => '/profiles/devices/profile/$profileId';
  static const String addDevice = '/profiles/devices';
  static String deviceQr(String childId) => '/profiles/devices/qr/$childId';

  // DNS
  static String dnsRules(String profileId) => '/dns/rules/$profileId';
  static String dnsSchedule(String profileId) => '/dns/schedules/$profileId';
  static String dnsBudget(String profileId) => '/dns/budgets/$profileId';
  static String dnsBudgetToday(String profileId) => '/dns/budgets/$profileId/today';
  static String extendBudget(String profileId) => '/dns/budgets/$profileId/extend';
  static String pauseDns(String profileId) => '/dns/rules/$profileId/pause';
  static String resumeDns(String profileId) => '/dns/rules/$profileId/resume';

  // Location
  static String latestLocation(String profileId) => '/location/$profileId/latest';
  static String locationHistory(String profileId) => '/location/$profileId/history';
  static String geofences(String profileId) => '/location/$profileId/geofences';
  static String places(String profileId) => '/location/$profileId/places';
  static const String childCheckin = '/location/child/checkin';
  static const String childPanic = '/location/child/panic';

  // Analytics
  static String analytics(String profileId) => '/analytics/$profileId/stats';
  static String topDomains(String profileId) => '/analytics/$profileId/top-domains';

  // Rewards
  static String tasks(String profileId) => '/rewards/tasks/$profileId';
  static String bank(String profileId) => '/rewards/bank/$profileId';

  // Notifications
  static const String myNotifications = '/notifications/my/unread';
  static const String fcmRegister = '/notifications/fcm/register';
}
