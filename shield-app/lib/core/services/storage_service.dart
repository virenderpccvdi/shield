import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants.dart';

/// Wraps FlutterSecureStorage with typed read/write helpers.
/// All Shield keys are defined in AppConstants to prevent typos.
class StorageService {
  const StorageService._();
  static const StorageService instance = StorageService._();

  static final _storage = FlutterSecureStorage(
    aOptions: const AndroidOptions(encryptedSharedPreferences: true),
  );

  // ── Generic ──────────────────────────────────────────────────────────────
  Future<String?> read(String key)                => _storage.read(key: key);
  Future<void>    write(String key, String value) => _storage.write(key: key, value: value);
  Future<void>    delete(String key)              => _storage.delete(key: key);

  // ── Parent session ────────────────────────────────────────────────────────
  Future<void> saveParentSession({
    required String accessToken,
    required String refreshToken,
    required String userId,
    required String tenantId,
    required String role,
  }) async {
    await Future.wait([
      write(AppConstants.keyAccessToken,  accessToken),
      write(AppConstants.keyRefreshToken, refreshToken),
      write(AppConstants.keyUserId,       userId),
      write(AppConstants.keyTenantId,     tenantId),
      write(AppConstants.keyRole,         role),
    ]);
  }

  Future<void> clearParentSession() async {
    await Future.wait([
      delete(AppConstants.keyAccessToken),
      delete(AppConstants.keyRefreshToken),
      delete(AppConstants.keyUserId),
      delete(AppConstants.keyTenantId),
      delete(AppConstants.keyRole),
    ]);
  }

  Future<Map<String, String?>> loadParentSession() async {
    final results = await Future.wait([
      read(AppConstants.keyAccessToken),
      read(AppConstants.keyRefreshToken),
      read(AppConstants.keyUserId),
      read(AppConstants.keyTenantId),
      read(AppConstants.keyRole),
    ]);
    return {
      'accessToken':  results[0],
      'refreshToken': results[1],
      'userId':       results[2],
      'tenantId':     results[3],
      'role':         results[4],
    };
  }

  // ── Child session ─────────────────────────────────────────────────────────
  /// MUST be called BEFORE any system dialogs (VPN consent, permission prompts).
  /// If Android kills the activity during a dialog, these credentials survive.
  Future<void> saveChildSession({
    required String childToken,
    required String childProfileId,
    required String childName,
    String? dohUrl,
  }) async {
    await Future.wait([
      write(AppConstants.keyChildToken,     childToken),
      write(AppConstants.keyChildProfileId, childProfileId),
      write(AppConstants.keyChildName,      childName),
      write(AppConstants.keyIsChildDevice,  'true'),
      if (dohUrl != null) write(AppConstants.keyDohUrl, dohUrl),
    ]);
  }

  Future<void> clearChildSession() async {
    await Future.wait([
      delete(AppConstants.keyChildToken),
      delete(AppConstants.keyChildProfileId),
      delete(AppConstants.keyChildName),
      delete(AppConstants.keyIsChildDevice),
      delete(AppConstants.keyDohUrl),
    ]);
  }

  Future<Map<String, String?>> loadChildSession() async {
    final results = await Future.wait([
      read(AppConstants.keyChildToken),
      read(AppConstants.keyChildProfileId),
      read(AppConstants.keyChildName),
      read(AppConstants.keyIsChildDevice),
      read(AppConstants.keyDohUrl),
    ]);
    return {
      'childToken':     results[0],
      'childProfileId': results[1],
      'childName':      results[2],
      'isChildDevice':  results[3],
      'dohUrl':         results[4],
    };
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  Future<bool>  isOnboarded()          async => await read(AppConstants.keyIsOnboarded) == 'true';
  Future<void>  setOnboarded()               => write(AppConstants.keyIsOnboarded, 'true');
  Future<String?> getParentPin()       async => read(AppConstants.keyParentPin);
  Future<void>  setParentPin(String p)       => write(AppConstants.keyParentPin, p);
  Future<void>  clearParentPin()             => delete(AppConstants.keyParentPin);
}
