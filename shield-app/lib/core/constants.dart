class AppConstants {
  AppConstants._();

  static const String baseUrl = 'https://shield.rstglobal.in/api/v1';
  static const String appName = 'Shield';
  static const String version = '2.0.0';

  // ── Secure storage keys ────────────────────────────────────────────────────
  // Parent session (stored once after login — survives app restarts)
  static const String keyAccessToken    = 'shield_access_token';
  static const String keyRefreshToken   = 'shield_refresh_token';
  static const String keyUserId         = 'shield_user_id';
  static const String keyTenantId       = 'shield_tenant_id';
  static const String keyRole           = 'shield_role';

  // Child session (stored on child device during setup — before any VPN dialog)
  static const String keyChildToken     = 'shield_child_token';
  static const String keyChildProfileId = 'shield_child_profile_id';
  static const String keyChildName      = 'shield_child_name';
  static const String keyIsChildDevice  = 'shield_is_child_device';
  static const String keyDohUrl         = 'shield_doh_url';

  // App settings
  static const String keyIsOnboarded    = 'shield_onboarded';
  static const String keyParentPin      = 'shield_parent_pin';   // PIN to exit child mode
  static const String keyThemeMode      = 'shield_theme_mode';   // light | dark | system

  // Background service (SharedPreferences — accessible from background isolate)
  static const String bgKeyToken        = 'shield_bg_token';
  static const String bgKeyProfileId    = 'shield_bg_profile_id';

  // ── Native channel names (must match MainActivity.kt) ─────────────────────
  static const String vpnChannel      = 'com.rstglobal.shield/vpn';
  static const String appBlockChannel = 'com.rstglobal.shield/app_block';
}
