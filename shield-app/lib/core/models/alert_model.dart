class AlertModel {
  const AlertModel({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.createdAt,
    this.childName,
    this.profileId,
    this.isRead = false,
    this.metadata,
  });

  final String id;
  final String type;       // SOS, GEOFENCE, BATTERY, SCHEDULE, etc.
  final String title;
  final String message;
  final DateTime createdAt;
  final String? childName;
  final String? profileId;
  final bool isRead;
  final Map<String, dynamic>? metadata;

  bool get isSOS       => type == 'SOS';
  bool get isCritical  => type == 'SOS' || type == 'PANIC';

  factory AlertModel.fromJson(Map<String, dynamic> j) => AlertModel(
    id:        j['id']?.toString()                  ?? '',
    type:      j['type']?.toString()                ?? 'INFO',
    title:     j['title']?.toString()               ?? 'Notification',
    // notification service uses "body"; analytics alerts use "message"
    message:   (j['message'] ?? j['body'])?.toString() ?? '',
    createdAt: j['createdAt'] != null
        ? DateTime.tryParse(j['createdAt'].toString()) ?? DateTime.now()
        : DateTime.now(),
    childName: j['childName']?.toString(),
    profileId: j['profileId']?.toString(),
    // notification service uses "readAt" (non-null = read); alerts use isRead bool
    isRead:    j['isRead'] as bool?
        ?? (j['readAt'] != null),
    metadata:  j['metadata'] as Map<String, dynamic>?,
  );
}
