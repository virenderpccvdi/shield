import 'package:hive_flutter/hive_flutter.dart';

/// Lightweight key-value cache backed by Hive.
/// All cached values are JSON-encodable (Map/List/String/int/bool).
/// TTL is enforced at read time: expired entries return null.
class CacheService {
  static const _boxName = 'shield_cache';
  static const _metaBox = 'shield_meta';

  static late Box<dynamic> _box;
  static late Box<dynamic> _meta;

  static Future<void> init() async {
    await Hive.initFlutter();
    _box  = await Hive.openBox<dynamic>(_boxName);
    _meta = await Hive.openBox<dynamic>(_metaBox);
  }

  /// Store [value] under [key] with a TTL in seconds (default 5 min).
  static Future<void> put(String key, dynamic value, {int ttlSeconds = 300}) async {
    await _box.put(key, value);
    await _meta.put(key, DateTime.now().millisecondsSinceEpoch + ttlSeconds * 1000);
  }

  /// Return cached value for [key], or null if expired / not found.
  static dynamic get(String key) {
    final expiry = _meta.get(key) as int?;
    if (expiry == null || DateTime.now().millisecondsSinceEpoch > expiry) return null;
    return _box.get(key);
  }

  /// Return cached value even if expired (stale-while-revalidate pattern).
  static dynamic getStale(String key) => _box.get(key);

  /// Synchronously evict [key] from the cache (fire-and-forget delete).
  /// Use this in callbacks where async/await is not available.
  static void evict(String key) {
    _box.delete(key);
    _meta.delete(key);
  }

  static Future<void> delete(String key) async {
    await _box.delete(key);
    await _meta.delete(key);
  }

  static Future<void> clearAll() async {
    await _box.clear();
    await _meta.clear();
  }
}
