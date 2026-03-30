class DeviceModel {
  const DeviceModel({
    required this.id,
    required this.deviceName,
    this.deviceType,
    this.platform,
    this.lastSeen,
    this.isOnline = false,
    this.batteryLevel,
    this.profileId,
  });

  final String id;
  final String deviceName;
  final String? deviceType;
  final String? platform;
  final DateTime? lastSeen;
  final bool isOnline;
  final int? batteryLevel;
  final String? profileId;

  String get platformIcon {
    final p = (platform ?? '').toLowerCase();
    if (p.contains('android')) return '🤖';
    if (p.contains('ios') || p.contains('iphone')) return '🍎';
    if (p.contains('windows')) return '🪟';
    return '📱';
  }

  factory DeviceModel.fromJson(Map<String, dynamic> j) => DeviceModel(
    id:           j['id']?.toString()         ?? '',
    deviceName:   j['deviceName']?.toString() ?? j['name']?.toString() ?? 'Device',
    deviceType:   j['deviceType']?.toString(),
    platform:     j['platform']?.toString(),
    lastSeen:     j['lastSeen'] != null
        ? DateTime.tryParse(j['lastSeen'].toString())
        : null,
    isOnline:     j['isOnline'] as bool?  ?? false,
    batteryLevel: j['batteryLevel'] as int?,
    profileId:    j['profileId']?.toString(),
  );
}
