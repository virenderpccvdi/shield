// ─────────────────────────────────────────────────────────────────────────────
// AuthStatus — four clear states
// ─────────────────────────────────────────────────────────────────────────────
enum AuthStatus {
  /// Initial load — reading from secure storage
  loading,

  /// No credentials found → show Login
  unauthenticated,

  /// Any authenticated user on their own device (CUSTOMER, ISP_ADMIN, GLOBAL_ADMIN)
  parent,

  /// Child token loaded — device is locked in child mode
  child,
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthState — immutable snapshot
// ─────────────────────────────────────────────────────────────────────────────
class AuthState {
  const AuthState({
    required this.status,
    this.accessToken,
    this.refreshToken,
    this.userId,
    this.tenantId,
    this.role,
    this.childProfileId,
    this.childName,
    this.dohUrl,
    this.childSessionExpired = false,
    this.isOnboarded = true,
  });

  final AuthStatus status;

  // Authenticated user fields
  final String? accessToken;
  final String? refreshToken;
  final String? userId;
  final String? tenantId;
  final String? role;        // CUSTOMER | ISP_ADMIN | GLOBAL_ADMIN

  // Child-device fields
  final String? childProfileId;
  final String? childName;
  final String? dohUrl;

  final bool childSessionExpired;
  final bool isOnboarded;

  // ── Role helpers ───────────────────────────────────────────────────────────
  bool get isLoading        => status == AuthStatus.loading;
  bool get isAuthenticated  => status == AuthStatus.parent || status == AuthStatus.child;
  bool get isParent         => status == AuthStatus.parent;
  bool get isChild          => status == AuthStatus.child;

  /// True for ISP_ADMIN or GLOBAL_ADMIN — routed to the admin shell
  bool get isAdmin          => role == 'ISP_ADMIN' || role == 'GLOBAL_ADMIN';

  /// True only for GLOBAL_ADMIN (platform-wide access)
  bool get isGlobalAdmin    => role == 'GLOBAL_ADMIN';

  /// True only for ISP_ADMIN
  bool get isIspAdmin       => role == 'ISP_ADMIN';

  /// True only for CUSTOMER — gets the parent/family shell
  bool get isCustomer       => role == 'CUSTOMER';

  String get displayRole => switch (role) {
    'GLOBAL_ADMIN' => 'Global Admin',
    'ISP_ADMIN'    => 'ISP Admin',
    'CUSTOMER'     => 'Parent',
    _              => role ?? 'User',
  };

  AuthState copyWith({
    AuthStatus? status,
    String? accessToken,
    String? refreshToken,
    String? userId,
    String? tenantId,
    String? role,
    String? childProfileId,
    String? childName,
    String? dohUrl,
    bool? childSessionExpired,
    bool? isOnboarded,
  }) => AuthState(
    status:              status               ?? this.status,
    accessToken:         accessToken          ?? this.accessToken,
    refreshToken:        refreshToken         ?? this.refreshToken,
    userId:              userId               ?? this.userId,
    tenantId:            tenantId             ?? this.tenantId,
    role:                role                 ?? this.role,
    childProfileId:      childProfileId       ?? this.childProfileId,
    childName:           childName            ?? this.childName,
    dohUrl:              dohUrl               ?? this.dohUrl,
    childSessionExpired: childSessionExpired  ?? this.childSessionExpired,
    isOnboarded:         isOnboarded          ?? this.isOnboarded,
  );

  static const loading       = AuthState(status: AuthStatus.loading);
  static const unauthenticated = AuthState(status: AuthStatus.unauthenticated);
}
