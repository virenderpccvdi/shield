class ChildProfile {
  const ChildProfile({
    required this.id,
    required this.name,
    this.age,
    this.avatarUrl,
    this.filterLevel,
    this.dnsClientId,
    this.dohUrl,
    this.isActive = true,
  });

  final String id;
  final String name;
  final int? age;
  final String? avatarUrl;
  final String? filterLevel;
  final String? dnsClientId;
  final String? dohUrl;
  final bool isActive;

  String get initials {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  factory ChildProfile.fromJson(Map<String, dynamic> j) => ChildProfile(
    id:          j['id']?.toString()          ?? '',
    name:        j['name']?.toString()        ?? 'Child',
    age:         j['age'] as int?,
    avatarUrl:   j['avatarUrl']?.toString(),
    filterLevel: j['filterLevel']?.toString(),
    dnsClientId: j['dnsClientId']?.toString(),
    dohUrl:      j['dohUrl']?.toString(),
    isActive:    j['isActive'] as bool?       ?? true,
  );

  Map<String, dynamic> toJson() => {
    'id':          id,
    'name':        name,
    'age':         age,
    'avatarUrl':   avatarUrl,
    'filterLevel': filterLevel,
    'dnsClientId': dnsClientId,
    'dohUrl':      dohUrl,
    'isActive':    isActive,
  };
}
