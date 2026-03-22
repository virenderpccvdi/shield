import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

final profilesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.read(dioProvider);
  try {
    final res = await client.get('/profiles/children');
    final d = res.data['data'];
    if (d is List) return d;
    if (d is Map) return (d['content'] ?? d['items'] ?? []) as List;
    return [];
  } catch (_) { return []; }
});

class FamilyScreen extends ConsumerWidget {
  const FamilyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profilesAsync = ref.watch(profilesProvider);
    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('Family'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(profilesProvider),
          ),
        ],
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton.extended(
            heroTag: 'fab_link_device',
            onPressed: () => context.push('/child-setup'),
            icon: const Icon(Icons.phonelink_setup_rounded),
            label: const Text('Link Child Device'),
            backgroundColor: ShieldTheme.primary,
            foregroundColor: Colors.white,
            elevation: 2,
          ),
          const SizedBox(height: 10),
          FloatingActionButton.extended(
            heroTag: 'fab_add_child',
            onPressed: () async {
              await context.push('/family/new');
              ref.invalidate(profilesProvider);
            },
            icon: const Icon(Icons.add),
            label: const Text('Add Child'),
            backgroundColor: ShieldTheme.primary,
            foregroundColor: Colors.white,
            elevation: 2,
          ),
        ],
      ),
      body: profilesAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 4),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 3),
          ])),
        error: (e, _) => _ErrorState(onRetry: () => ref.invalidate(profilesProvider)),
        data: (profiles) => profiles.isEmpty
          ? _EmptyState()
          : RefreshIndicator(
              onRefresh: () => ref.refresh(profilesProvider.future),
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(child: _HeaderCard(count: profiles.length)),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _ChildCard(
                          profile: profiles[i] as Map<String, dynamic>,
                          index: i,
                        ),
                        childCount: profiles.length,
                      ),
                    ),
                  ),
                ],
              ),
            ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  final int count;
  const _HeaderCard({required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
        gradient: ShieldTheme.primaryGradient,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.2),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.family_restroom_rounded, color: Colors.white, size: 24),
        ),
        const SizedBox(width: 14),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            '$count ${count == 1 ? 'child' : 'children'} protected',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16),
          ),
          const Text('Tap a profile to manage controls',
            style: TextStyle(color: Colors.white70, fontSize: 12)),
        ]),
      ]),
    );
  }
}

class _ChildCard extends StatelessWidget {
  final Map<String, dynamic> profile;
  final int index;
  const _ChildCard({required this.profile, required this.index});

  static const _avatarColors = [
    ShieldTheme.primary, ShieldTheme.primaryLight, ShieldTheme.success,
    ShieldTheme.danger, ShieldTheme.successLight, ShieldTheme.primaryDark,
    ShieldTheme.primaryDark, ShieldTheme.accent,
  ];

  @override
  Widget build(BuildContext context) {
    final name        = profile['name'] as String? ?? 'Child ${index + 1}';
    final filterLevel = profile['filterLevel'] as String? ?? 'MODERATE';
    final ageGroup    = profile['ageGroup'] as String?;
    final initial     = name.isNotEmpty ? name[0].toUpperCase() : 'C';
    final color       = _avatarColors[name.codeUnitAt(0) % _avatarColors.length];

    Color levelColor;
    IconData levelIcon;
    switch (filterLevel) {
      case 'STRICT':
        levelColor = ShieldTheme.dangerLight;
        levelIcon  = Icons.security;
        break;
      case 'RELAXED':
      case 'LIGHT':
        levelColor = ShieldTheme.successLight;
        levelIcon  = Icons.shield_outlined;
        break;
      default:
        levelColor = ShieldTheme.warning;
        levelIcon  = Icons.shield;
    }

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
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              // Avatar
              CircleAvatar(
                radius: 28,
                backgroundColor: color,
                child: Text(initial,
                  style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 14),
              // Info
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Row(children: [
                    if (ageGroup != null) ...[
                      Text(ageGroup.toLowerCase().replaceFirst(ageGroup[0], ageGroup[0].toUpperCase()),
                        style: const TextStyle(fontSize: 12, color: ShieldTheme.textSecondary)),
                      Container(width: 3, height: 3, margin: const EdgeInsets.symmetric(horizontal: 6),
                        decoration: const BoxDecoration(color: ShieldTheme.textSecondary, shape: BoxShape.circle)),
                    ],
                    Icon(levelIcon, size: 12, color: levelColor),
                    const SizedBox(width: 3),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: levelColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(filterLevel,
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: levelColor)),
                    ),
                  ]),
                ]),
              ),
              // Quick actions
              Row(mainAxisSize: MainAxisSize.min, children: [
                _QuickBtn(
                  icon: Icons.map_rounded,
                  color: ShieldTheme.primary,
                  onTap: () => context.go('/map'),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right, color: ShieldTheme.textSecondary),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}

class _QuickBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _QuickBtn({required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32, height: 32,
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 16, color: color),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 90, height: 90,
            decoration: BoxDecoration(
              color: ShieldTheme.primary.withOpacity(0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.family_restroom_rounded, size: 44, color: ShieldTheme.primary),
          ),
          const SizedBox(height: 20),
          const Text('No children yet',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: ShieldTheme.textPrimary)),
          const SizedBox(height: 10),
          const Text(
            'Add your first child profile to start protecting them with content filtering, screen time, and location monitoring.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: ShieldTheme.textSecondary, height: 1.5),
          ),
          const SizedBox(height: 28),
          SizedBox(
            width: 200,
            child: FilledButton.icon(
              onPressed: () => context.go('/family/new'),
              icon: const Icon(Icons.person_add_rounded),
              label: const Text('Add Child Profile'),
              style: FilledButton.styleFrom(minimumSize: const Size(200, 50)),
            ),
          ),
        ]),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.wifi_off_rounded, size: 56, color: ShieldTheme.textSecondary),
      const SizedBox(height: 14),
      const Text('Could not load profiles', style: TextStyle(fontWeight: FontWeight.w600)),
      const SizedBox(height: 20),
      TextButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Retry')),
    ]));
  }
}
