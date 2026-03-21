import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/auth_state.dart';
import '../../core/api_client.dart';
import '../../core/shield_logo.dart';
import '../../app/theme.dart';
import '../notifications/notification_history_screen.dart';

// ── Active SOS provider ─────────────────────────────────────────────────────

/// Returns list of active SOS events across all child profiles.
final activeSosProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  try {
    final client = ref.read(dioProvider);
    final profilesRes = await client.get('/profiles/children');
    final profiles = profilesRes.data['data'] as List? ?? [];

    // Filter out profiles with empty IDs before parallel fetch
    final validProfiles = profiles
        .where((p) => (p['id']?.toString() ?? '').isNotEmpty)
        .toList();

    // Fetch all profile SOS events in parallel
    final results = await Future.wait(
      validProfiles.map((p) async {
        final profileId = p['id']!.toString();
        final childName = p['name']?.toString() ?? 'Child';
        try {
          final res = await client.get('/location/$profileId/sos');
          final items = res.data['data'] as List? ?? [];
          return items.map((item) {
            final m = Map<String, dynamic>.from(item as Map);
            m['childName'] = childName;
            return m;
          }).toList();
        } catch (_) {
          return <Map<String, dynamic>>[];
        }
      }),
      eagerError: false,
    );

    return results.expand((list) => list).toList();
  } catch (_) {
    return [];
  }
});

// ── Data providers ─────────────────────────────────────────────────────────

final dashboardProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final client = ref.read(dioProvider);
  try {
    // Step 1: fetch profiles first (needed for subsequent calls)
    final profilesRes = await client.get('/profiles/children');
    final d = profilesRes.data['data'];
    final profiles = (d is Map ? (d['content'] ?? d['items'] ?? []) : d) as List? ?? [];

    // Step 2: fetch notifications + per-profile stats + per-profile devices — all in parallel
    final parallelResults = await Future.wait([
      // 2a: unread notifications count
      client.get('/notifications/my/unread').then((r) => r).catchError((_) => null),
      // 2b: per-profile stats (all in parallel, eagerError:false)
      Future.wait(
        profiles.map((profile) {
          final profileId = profile['id']?.toString();
          if (profileId == null) return Future.value(null);
          return client.get('/analytics/$profileId/stats', queryParameters: {'period': 'TODAY'})
              .then((r) => r).catchError((_) => null);
        }).toList(),
        eagerError: false,
      ),
      // 2c: per-profile devices (all in parallel, eagerError:false)
      Future.wait(
        profiles.map((profile) {
          final id = profile['id']?.toString();
          if (id == null) return Future.value(null);
          return client.get('/profiles/devices/profile/$id')
              .then((r) => r).catchError((_) => null);
        }).toList(),
        eagerError: false,
      ),
    ], eagerError: false);

    // Parse results
    int activeAlerts = 0;
    int blockedToday  = 0;
    int safeChildren  = 0;

    // 2a: unread alerts
    try {
      final alertsRes = parallelResults[0];
      if (alertsRes != null) {
        final alertData = (alertsRes as dynamic).data['data'];
        activeAlerts = alertData is List
            ? alertData.length
            : (alertData?['totalElements'] as int? ?? 0);
      }
    } catch (_) {}

    // 2b: stats per profile
    final statsResults = parallelResults[1] as List?;

    // 2c: devices per profile
    final devicesResults = parallelResults[2] as List?;

    // Build enriched profiles
    final List<Map<String, dynamic>> enrichedProfiles = [];
    for (int i = 0; i < profiles.length; i++) {
      Map<String, dynamic> p = Map<String, dynamic>.from(profiles[i] as Map);

      // Apply stats
      try {
        final statsRes = statsResults?[i];
        if (statsRes != null) {
          final stats = (statsRes as dynamic).data['data'] ?? (statsRes as dynamic).data;
          blockedToday += (stats['blockedQueries'] as int? ?? stats['blocked'] as int? ?? 0);
        }
      } catch (_) {}

      if (p['online'] == true) safeChildren++;

      // Apply device data
      try {
        final devRes = devicesResults?[i];
        if (devRes != null) {
          final devices = (devRes as dynamic).data['data'] as List? ?? [];
          if (devices.isNotEmpty) {
            final dev = devices.first as Map<String, dynamic>;
            p['battery']    = dev['batteryPct'];
            p['speed']      = dev['speedKmh'];
            p['lastSeenAt'] = dev['lastSeenAt'];
            // online if seen in last 5 min
            if (dev['lastSeenAt'] != null) {
              final seen = DateTime.tryParse(dev['lastSeenAt'].toString());
              if (seen != null && DateTime.now().difference(seen).inMinutes < 5) {
                p['online'] = true;
              }
            }
          }
        }
      } catch (_) {}

      enrichedProfiles.add(p);
    }

    return {
      'totalProfiles': enrichedProfiles.length,
      'activeAlerts':  activeAlerts,
      'blockedToday':  blockedToday,
      'safeChildren':  safeChildren,
      'profiles':      enrichedProfiles,
    };
  } catch (_) {
    return {'totalProfiles': 0, 'activeAlerts': 0, 'blockedToday': 0, 'safeChildren': 0, 'profiles': []};
  }
});

// ── Screen ─────────────────────────────────────────────────────────────────

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final dashAsync = ref.watch(dashboardProvider);

    final activeSosAsync = ref.watch(activeSosProvider);
    final activeSosEvents = activeSosAsync.valueOrNull ?? [];

    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      body: Column(
        children: [
          // Active SOS banner — shown at top of screen when there are active SOS events
          if (activeSosEvents.isNotEmpty)
            _DashboardSosBanner(
              events: activeSosEvents,
              onTap: () => context.go('/alerts/sos'),
            ),
          Expanded(
            child: dashAsync.when(
              loading: () => const _LoadingBody(),
              error:   (e, _) => _ErrorBody(error: e.toString(), onRetry: () => ref.invalidate(dashboardProvider)),
              data:    (data) => RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(dashboardProvider);
                  ref.invalidate(activeSosProvider);
                },
                displacement: 80,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    _HeroHeader(auth: auth, data: data),
                    _QuickStats(data: data),
                    _QuickActions(),
                    _ChildrenSection(profiles: (data['profiles'] as List?) ?? []),
                    _RecentActivitySection(),
                    const SliverToBoxAdapter(child: SizedBox(height: 24)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Hero Header ────────────────────────────────────────────────────────────

class _HeroHeader extends ConsumerWidget {
  final dynamic auth;
  final Map<String, dynamic> data;
  const _HeroHeader({required this.auth, required this.data});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerts   = (data['activeAlerts'] as int? ?? 0);
    final safe     = alerts == 0;
    final firstName = (auth.name as String? ?? 'Parent').split(' ').first;
    // Unread notification count for bell badge
    final unreadAsync = ref.watch(unreadNotifCountProvider);
    final unreadCount = unreadAsync.valueOrNull ?? alerts;

    return SliverToBoxAdapter(
      child: Container(
        decoration: BoxDecoration(
          gradient: safe ? ShieldTheme.heroGradient : ShieldTheme.alertGradient,
        ),
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Top row: logo + actions ──────────────────────────────
                Row(
                  children: [
                    const ShieldLogo(size: 36),
                    const SizedBox(width: 10),
                    const Text('Shield',
                      style: TextStyle(color: Colors.white, fontSize: 20,
                          fontWeight: FontWeight.w800, letterSpacing: 0.5)),
                    const Spacer(),
                    _HeaderAction(
                      icon: Icons.notifications_outlined,
                      badge: unreadCount,
                      onTap: () => context.go('/notifications'),
                    ),
                    const SizedBox(width: 4),
                    _HeaderAction(
                      icon: Icons.sos,
                      color: Colors.red.shade300,
                      onTap: () => context.go('/alerts/sos'),
                    ),
                  ],
                ),

                const SizedBox(height: 28),

                // ── Greeting ─────────────────────────────────────────────
                Text('Good ${_greeting()}, $firstName!',
                  style: const TextStyle(color: Colors.white70, fontSize: 14, letterSpacing: 0.2)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      safe ? Icons.shield : Icons.warning_amber_rounded,
                      color: Colors.white,
                      size: 22,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      safe ? 'All children are safe' : '$alerts active alert${alerts > 1 ? 's' : ''}',
                      style: const TextStyle(color: Colors.white, fontSize: 20,
                          fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(width: 7, height: 7,
                        decoration: const BoxDecoration(color: Color(0xFF69F0AE), shape: BoxShape.circle)),
                      const SizedBox(width: 6),
                      Text(
                        '${data['totalProfiles'] ?? 0} children • ${data['blockedToday'] ?? 0} blocked today',
                        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }
}

class _HeaderAction extends StatelessWidget {
  final IconData icon;
  final int badge;
  final Color? color;
  final VoidCallback onTap;
  const _HeaderAction({required this.icon, this.badge = 0, this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40, height: 40,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.15),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Stack(alignment: Alignment.center, children: [
          Icon(icon, color: color ?? Colors.white, size: 22),
          if (badge > 0)
            Positioned(
              top: 6, right: 6,
              child: Container(
                width: 14, height: 14,
                decoration: const BoxDecoration(color: Color(0xFFFF5252), shape: BoxShape.circle),
                child: Center(
                  child: Text(badge > 9 ? '9+' : '$badge',
                    style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w700)),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

// ── Quick Stats ────────────────────────────────────────────────────────────

class _QuickStats extends StatelessWidget {
  final Map<String, dynamic> data;
  const _QuickStats({required this.data});

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Transform.translate(
        offset: const Offset(0, -20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.08),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Row(
              children: [
                _StatItem(
                  value: '${data['totalProfiles'] ?? 0}',
                  label: 'Children',
                  icon: Icons.child_care_rounded,
                  color: ShieldTheme.primary,
                ),
                _StatDivider(),
                _StatItem(
                  value: '${data['activeAlerts'] ?? 0}',
                  label: 'Alerts',
                  icon: Icons.notifications_active_rounded,
                  color: (data['activeAlerts'] ?? 0) > 0 ? ShieldTheme.dangerLight : ShieldTheme.successLight,
                ),
                _StatDivider(),
                _StatItem(
                  value: '${data['blockedToday'] ?? 0}',
                  label: 'Blocked',
                  icon: Icons.shield_rounded,
                  color: ShieldTheme.warning,
                ),
                _StatDivider(),
                _StatItem(
                  value: '${data['safeChildren'] ?? 0}',
                  label: 'Online',
                  icon: Icons.wifi_rounded,
                  color: ShieldTheme.successLight,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String value, label;
  final IconData icon;
  final Color color;
  const _StatItem({required this.value, required this.label, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
          Text(label, style: const TextStyle(fontSize: 10, color: ShieldTheme.textSecondary, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

class _StatDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 44, color: ShieldTheme.divider);
  }
}

// ── Quick Actions ──────────────────────────────────────────────────────────

class _QuickActions extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Quick Actions',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700,
                  color: ShieldTheme.textPrimary)),
            const SizedBox(height: 12),
            Row(
              children: [
                _ActionChip(icon: Icons.map_rounded,          label: 'Live Map',    color: ShieldTheme.primary,       onTap: () => context.go('/map')),
                const SizedBox(width: 10),
                _ActionChip(icon: Icons.people_rounded,       label: 'Family',      color: const Color(0xFF1565C0),   onTap: () => context.go('/family')),
                const SizedBox(width: 10),
                _ActionChip(icon: Icons.notifications_rounded,label: 'Alerts',      color: ShieldTheme.dangerLight,   onTap: () => context.go('/alerts')),
                const SizedBox(width: 10),
                _ActionChip(icon: Icons.settings_rounded,     label: 'Settings',    color: ShieldTheme.textSecondary, onTap: () => context.go('/settings')),
              ],
            ),
            const SizedBox(height: 10),
            _SetupChildDeviceTile(),
          ],
        ),
      ),
    );
  }
}

class _SetupChildDeviceTile extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/child-setup'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF1565C0), Color(0xFF1976D2)],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(children: [
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.phonelink_setup_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Set Up Child Device',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
              Text('Link a phone or tablet to this profile',
                style: TextStyle(color: Colors.white70, fontSize: 11)),
            ]),
          ),
          const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white70, size: 14),
        ]),
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionChip({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: ShieldTheme.divider),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Children Section ───────────────────────────────────────────────────────

class _ChildrenSection extends StatelessWidget {
  final List profiles;
  const _ChildrenSection({required this.profiles});

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('Children',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: ShieldTheme.textPrimary)),
                const Spacer(),
                GestureDetector(
                  onTap: () => context.go('/family/new'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: ShieldTheme.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add, color: ShieldTheme.primary, size: 14),
                        SizedBox(width: 2),
                        Text('Add', style: TextStyle(color: ShieldTheme.primary, fontSize: 12, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (profiles.isEmpty)
              _EmptyChildren()
            else
              ...profiles.map((p) => _ChildCard(profile: p as Map<String, dynamic>)),
          ],
        ),
      ),
    );
  }
}

class _EmptyChildren extends StatefulWidget {
  @override
  State<_EmptyChildren> createState() => _EmptyChildrenState();
}

class _EmptyChildrenState extends State<_EmptyChildren> {
  bool _onboardingDone = true; // default: assume done to avoid flash
  bool _checked = false;

  @override
  void initState() {
    super.initState();
    _checkOnboarding();
  }

  Future<void> _checkOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    final done = prefs.getBool('onboarding_done') ?? false;
    if (mounted) setState(() { _onboardingDone = done; _checked = true; });
  }

  @override
  Widget build(BuildContext context) {
    if (!_checked) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        gradient: _onboardingDone
            ? null
            : const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF1565C0), Color(0xFF0A2463)],
              ),
        color: _onboardingDone ? Colors.white : null,
        borderRadius: BorderRadius.circular(20),
        border: _onboardingDone
            ? Border.all(color: ShieldTheme.divider)
            : null,
        boxShadow: _onboardingDone
            ? null
            : [BoxShadow(color: const Color(0xFF1565C0).withOpacity(0.25), blurRadius: 20, offset: const Offset(0, 6))],
      ),
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
      child: _onboardingDone
          ? _buildSimpleEmpty(context)
          : _buildOnboardingCta(context),
    );
  }

  Widget _buildSimpleEmpty(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 72, height: 72,
          decoration: BoxDecoration(
            color: ShieldTheme.primary.withOpacity(0.08),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.child_care_rounded, size: 36, color: ShieldTheme.primary),
        ),
        const SizedBox(height: 16),
        const Text('No children added yet',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: ShieldTheme.textPrimary)),
        const SizedBox(height: 6),
        const Text('Add your first child profile to start protecting them.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 13, color: ShieldTheme.textSecondary)),
        const SizedBox(height: 20),
        SizedBox(
          width: 180,
          child: FilledButton.icon(
            onPressed: () => context.go('/family/new'),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Add Child'),
            style: FilledButton.styleFrom(minimumSize: const Size(180, 44)),
          ),
        ),
      ],
    );
  }

  Widget _buildOnboardingCta(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 72, height: 72,
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.15),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withOpacity(0.3), width: 2),
          ),
          child: const Icon(Icons.family_restroom_rounded, size: 36, color: Colors.white),
        ),
        const SizedBox(height: 16),
        const Text('Set up family protection',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
        const SizedBox(height: 8),
        const Text(
          'Follow the guided setup to add your first child and start keeping them safe online.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 13, color: Colors.white70, height: 1.5),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: () => context.go('/onboarding'),
            icon: const Icon(Icons.play_arrow_rounded, size: 20),
            label: const Text('Start Setup'),
            style: FilledButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: ShieldTheme.primary,
              minimumSize: const Size(double.infinity, 48),
            ),
          ),
        ),
        const SizedBox(height: 10),
        TextButton(
          onPressed: () => context.go('/family/new'),
          child: const Text('Skip — Add child directly',
            style: TextStyle(color: Colors.white60, fontSize: 13)),
        ),
      ],
    );
  }
}

class _ChildCard extends StatelessWidget {
  final Map<String, dynamic> profile;
  const _ChildCard({required this.profile});

  @override
  Widget build(BuildContext context) {
    final isOnline = profile['online'] == true;
    final battery  = profile['battery'] as int?;
    final name     = profile['name'] as String? ?? 'Child';
    final initial  = name.isNotEmpty ? name[0].toUpperCase() : 'C';

    // Avatar color from name hash
    final colors = [
      const Color(0xFF1565C0), const Color(0xFF1565C0), const Color(0xFF00695C),
      const Color(0xFFBF360C), const Color(0xFF1B5E20), const Color(0xFF0D47A1),
    ];
    final avatarColor = colors[name.codeUnitAt(0) % colors.length];

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ShieldTheme.divider),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => context.go('/family/${profile['id']}'),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                // Avatar
                Stack(children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: avatarColor,
                    child: Text(initial, style: const TextStyle(
                        color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                  ),
                  Positioned(
                    bottom: 0, right: 0,
                    child: Container(
                      width: 14, height: 14,
                      decoration: BoxDecoration(
                        color: isOnline ? const Color(0xFF00C853) : const Color(0xFFBDBDBD),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                    ),
                  ),
                ]),
                const SizedBox(width: 14),
                // Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                      const SizedBox(height: 2),
                      Row(children: [
                        Icon(isOnline ? Icons.wifi : Icons.wifi_off,
                          size: 12, color: isOnline ? const Color(0xFF00C853) : Colors.grey),
                        const SizedBox(width: 4),
                        Text(isOnline ? 'Online' : 'Offline',
                          style: TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w500,
                            color: isOnline ? const Color(0xFF00C853) : Colors.grey,
                          )),
                        const SizedBox(width: 10),
                        Icon(Icons.shield_outlined, size: 12, color: Colors.grey.shade500),
                        const SizedBox(width: 3),
                        Text(profile['filterLevel'] as String? ?? 'MODERATE',
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                      ]),
                    ],
                  ),
                ),
                // Battery
                if (battery != null)
                  _BatteryBadge(pct: battery),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, color: ShieldTheme.textSecondary, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BatteryBadge extends StatelessWidget {
  final int pct;
  const _BatteryBadge({required this.pct});

  @override
  Widget build(BuildContext context) {
    final color = pct < 20 ? ShieldTheme.dangerLight
        : pct < 50 ? ShieldTheme.warning
        : ShieldTheme.successLight;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(pct < 20 ? Icons.battery_alert : Icons.battery_full, color: color, size: 12),
        const SizedBox(width: 2),
        Text('$pct%', style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

// ── Recent Activity Section ────────────────────────────────────────────────

class _RecentActivitySection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Quick Access',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: ShieldTheme.textPrimary)),
            const SizedBox(height: 12),
            _MenuRow(
              icon: Icons.dns_rounded,
              color: const Color(0xFF1565C0),
              label: 'Content Filtering',
              subtitle: 'Manage blocked categories',
              onTap: () => context.go('/family'),
            ),
            _MenuRow(
              icon: Icons.schedule_rounded,
              color: const Color(0xFF1565C0),
              label: 'Screen Time',
              subtitle: 'Set schedules and limits',
              onTap: () => context.go('/family'),
            ),
            _MenuRow(
              icon: Icons.location_on_rounded,
              color: const Color(0xFF00695C),
              label: 'Geofences',
              subtitle: 'Safe zones and boundaries',
              onTap: () => context.go('/family'),
            ),
            _MenuRow(
              icon: Icons.psychology_rounded,
              color: const Color(0xFFBF360C),
              label: 'AI Insights',
              subtitle: 'Behavior analysis and risks',
              onTap: () => context.go('/family'),
            ),
          ],
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label, subtitle;
  final VoidCallback onTap;
  const _MenuRow({required this.icon, required this.color, required this.label, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ShieldTheme.divider),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            child: Row(children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                Text(subtitle, style: const TextStyle(fontSize: 12, color: ShieldTheme.textSecondary)),
              ])),
              const Icon(Icons.chevron_right, color: ShieldTheme.textSecondary, size: 18),
            ]),
          ),
        ),
      ),
    );
  }
}

// ── Dashboard SOS Banner ───────────────────────────────────────────────────

class _DashboardSosBanner extends StatefulWidget {
  final List<Map<String, dynamic>> events;
  final VoidCallback onTap;
  const _DashboardSosBanner({required this.events, required this.onTap});

  @override
  State<_DashboardSosBanner> createState() => _DashboardSosBannerState();
}

class _DashboardSosBannerState extends State<_DashboardSosBanner> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800))..repeat(reverse: true);
    _opacity = Tween<double>(begin: 0.75, end: 1.0).animate(_ctrl);
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final childName = widget.events.first['childName'] as String? ?? 'A child';
    final count = widget.events.length;

    return GestureDetector(
      onTap: widget.onTap,
      child: FadeTransition(
        opacity: _opacity,
        child: Container(
          width: double.infinity,
          color: Colors.red.shade700,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: SafeArea(
            bottom: false,
            child: Row(children: [
              const Icon(Icons.sos, color: Colors.white, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  count == 1
                      ? '$childName needs help! Tap to respond'
                      : '$count active SOS alerts — children need help! Tap to respond',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ),
              const Icon(Icons.arrow_forward_ios, color: Colors.white70, size: 14),
            ]),
          ),
        ),
      ),
    );
  }
}

// ── Loading / Error states ─────────────────────────────────────────────────

class _LoadingBody extends StatelessWidget {
  const _LoadingBody();
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Container(
        height: 220,
        decoration: const BoxDecoration(gradient: ShieldTheme.heroGradient),
        child: const SafeArea(
          child: Center(child: CircularProgressIndicator(color: Colors.white)),
        ),
      ),
    ]);
  }
}

class _ErrorBody extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;
  const _ErrorBody({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.wifi_off, size: 64, color: ShieldTheme.textSecondary),
        const SizedBox(height: 16),
        const Text('Connection error', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Text(error, style: const TextStyle(color: ShieldTheme.textSecondary), textAlign: TextAlign.center),
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh),
          label: const Text('Retry'),
          style: FilledButton.styleFrom(minimumSize: const Size(160, 48)),
        ),
      ]),
    ));
  }
}
