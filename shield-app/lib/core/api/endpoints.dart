/// All API endpoint paths (relative to AppConstants.baseUrl).
/// Keeping these in one place prevents typos and makes refactoring easy.
class Endpoints {
  Endpoints._();

  // ── Auth ──────────────────────────────────────────────────────────────────
  static const String login          = '/auth/login';
  static const String register       = '/auth/register';
  static const String refresh        = '/auth/token/refresh';
  static const String logout         = '/auth/logout';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword  = '/auth/reset-password';
  static const String childToken     = '/auth/child/token';
  static const String me             = '/auth/me';
  static const String changePassword = '/auth/change-password';
  static const String users          = '/auth/users';
  static String userById(String id)  => '/auth/users/$id';

  // ── Profile — children ────────────────────────────────────────────────────
  static const String children       = '/profiles/children';
  static String childById(String id) => '/profiles/children/$id';

  // ── Profile — customers (ISP Admin view) ──────────────────────────────────
  static const String customers         = '/profiles/customers';
  static String customerById(String id) => '/profiles/customers/$id';
  static String customerChildren(String id) => '/profiles/customers/$id/children';

  // ── Profile — devices ─────────────────────────────────────────────────────
  static String devicesByProfile(String profileId) =>
      '/profiles/devices/profile/$profileId';
  static const String heartbeat      = '/profiles/devices/heartbeat';

  // ── Profile — apps ────────────────────────────────────────────────────────
  static String appsByProfile(String profileId) => '/profiles/apps/$profileId';
  static const String childBlockedApps = '/profiles/apps/blocked';
  static const String syncApps         = '/profiles/apps/sync';

  // ── Tenant (Global Admin view) ────────────────────────────────────────────
  static const String tenants           = '/tenants';
  static String tenantById(String id)   => '/tenants/$id';

  // ── DNS ───────────────────────────────────────────────────────────────────
  static String dnsRules(String profileId)       => '/dns/rules/$profileId';
  static String dnsSchedule(String profileId)    => '/dns/schedules/$profileId';
  static String dnsFilter(String profileId)      => '/dns/rules/$profileId';
  static String dnsSafeFilters(String id)        => '/dns/rules/$id';
  static String dnsHomeworkMode(String id)       => '/dns/rules/$id/homework/status';
  static String dnsBedtime(String id)            => '/dns/rules/$id/bedtime/status';
  static String dnsTimeLimits(String profileId)  => '/dns/time-limits/$profileId';
  static String dnsBudgets(String profileId)     => '/dns/budgets/$profileId';

  // ── Location ──────────────────────────────────────────────────────────────
  static String locationLatest(String pid)   => '/location/$pid/latest';
  static String locationHistory(String pid)  => '/location/$pid/history';
  static String locationUpdate()             => '/location/update';
  static String geofences(String pid)        => '/location/$pid/geofences';

  // ── Analytics — customer ──────────────────────────────────────────────────
  static String browsingHistory(String pid)  => '/analytics/$pid/history';
  static String appUsage(String pid)         => '/analytics/profiles/$pid/app-usage';
  static String aiInsights(String pid)       => '/ai/$pid/insights';
  static String profileStats(String pid)     => '/analytics/$pid/stats';
  static String profileCategories(String pid)=> '/analytics/$pid/categories';

  // ── Analytics — admin ────────────────────────────────────────────────────
  static const String platformOverview   = '/analytics/platform/overview';
  static const String platformDaily      = '/analytics/platform/daily';
  static const String ispOverview        = '/analytics/tenant/overview';
  static const String ispDaily           = '/analytics/tenant/daily';
  static String customerOverview(String id) => '/analytics/customer/$id/overview';
  static String profileAlerts(String pid)   => '/analytics/alerts/$pid';

  // ── Notifications ─────────────────────────────────────────────────────────
  static const String notifications  = '/notifications/my';
  static const String unreadCount    = '/notifications/my/unread/count';
  static const String markAllRead    = '/notifications/my/read-all';
  static String markRead(String id)  => '/notifications/$id/read';
  static const String fcmToken       = '/notifications/fcm/register';

  // ── Alerts (user notification feed — no profileId required) ─────────────
  static const String alerts          = '/notifications/my';

  // ── Rewards ───────────────────────────────────────────────────────────────
  static String tasks(String pid)        => '/rewards/tasks/$pid';
  static String taskById(String tid)     => '/rewards/tasks/$tid';
  static String taskComplete(String pid, String tid) => '/rewards/tasks/$tid/complete?profileId=$pid';
  static String taskApprove(String tid)  => '/rewards/tasks/$tid/approve';
  static String taskReject(String tid)   => '/rewards/tasks/$tid/reject';
  static String approvals(String pid)    => '/rewards/tasks/$pid';
  static String points(String pid)       => '/rewards/bank/$pid';
  static String achievements(String pid) => '/rewards/achievements/$pid';
  static String checkin(String pid)      => '/rewards/checkin/$pid';
  static String streaks(String pid)      => '/rewards/$pid/streaks';

  // ── Emergency / SOS ───────────────────────────────────────────────────────
  static String sos(String pid)               => '/location/$pid/sos';
  static String emergencyContacts(String pid) =>
      '/profiles/children/$pid/emergency-contacts';
}
