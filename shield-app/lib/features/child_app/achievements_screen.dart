import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

// ── Providers ────────────────────────────────────────────────────────────────

final _allBadgesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  try {
    final res = await ref.read(dioProvider).get('/rewards/badges');
    final raw = res.data['data'];
    final list = raw is List ? raw : (raw is Map ? (raw['content'] ?? raw['items'] ?? []) : []);
    return (list as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  } catch (_) {
    return [];
  }
});

final _earnedBadgesProvider = FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, profileId) async {
  if (profileId.isEmpty) return [];
  try {
    final res = await ref.read(dioProvider).get('/rewards/badges/profile/$profileId');
    final raw = res.data['data'];
    final list = raw is List ? raw : (raw is Map ? (raw['content'] ?? raw['items'] ?? []) : []);
    return (list as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  } catch (_) {
    return [];
  }
});

// ── Screen ───────────────────────────────────────────────────────────────────

/// Child-facing achievements/badges screen.
///
/// Shows all available badges in a grid with earned ones highlighted and
/// locked ones grayed out. Stats bar at top, category filter chips in a
/// horizontal scroll row.
class AchievementsScreen extends ConsumerStatefulWidget {
  const AchievementsScreen({super.key});

  @override
  ConsumerState<AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends ConsumerState<AchievementsScreen>
    with SingleTickerProviderStateMixin {
  String _selectedCategory = 'ALL';
  late AnimationController _celebrateController;

  static const _categories = ['ALL', 'TASKS', 'SAFETY', 'LEARNING', 'STREAK'];

  static const _categoryIcons = <String, IconData>{
    'ALL': Icons.emoji_events_rounded,
    'TASKS': Icons.check_circle_rounded,
    'SAFETY': Icons.shield_rounded,
    'LEARNING': Icons.school_rounded,
    'STREAK': Icons.local_fire_department_rounded,
  };

  static const _categoryColors = <String, Color>{
    'ALL': ShieldTheme.primary,
    'TASKS': ShieldTheme.success,
    'SAFETY': Color(0xFF1565C0),
    'LEARNING': Color(0xFF6A1B9A),
    'STREAK': ShieldTheme.warning,
  };

  @override
  void initState() {
    super.initState();
    _celebrateController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _celebrateController.dispose();
    super.dispose();
  }

  String _badgeId(Map<String, dynamic> badge) =>
      badge['id']?.toString() ?? badge['badgeId']?.toString() ?? '';

  bool _isEarned(Map<String, dynamic> badge, List<Map<String, dynamic>> earned) {
    final id = _badgeId(badge);
    return earned.any((e) =>
        e['badgeId']?.toString() == id ||
        e['badge']?['id']?.toString() == id ||
        e['id']?.toString() == id);
  }

  String? _earnedDate(Map<String, dynamic> badge, List<Map<String, dynamic>> earned) {
    final id = _badgeId(badge);
    final found = earned.where((e) =>
        e['badgeId']?.toString() == id ||
        e['badge']?['id']?.toString() == id ||
        e['id']?.toString() == id);
    if (found.isEmpty) return null;
    return found.first['earnedAt']?.toString() ??
        found.first['earned_at']?.toString();
  }

  List<Map<String, dynamic>> _filtered(List<Map<String, dynamic>> all) {
    if (_selectedCategory == 'ALL') return all;
    return all
        .where((b) =>
            (b['category']?.toString() ?? '').toUpperCase() == _selectedCategory)
        .toList();
  }

  String _formatDate(String raw) {
    try {
      return DateTime.parse(raw).toLocal().toString().substring(0, 10);
    } catch (_) {
      return raw;
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileId = ref.watch(authProvider).childProfileId ?? '';
    final allAsync = ref.watch(_allBadgesProvider);
    final earnedAsync = ref.watch(_earnedBadgesProvider(profileId));

    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        backgroundColor: Colors.amber.shade700,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'My Achievements',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: allAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 2),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 4),
          ]),
        ),
        error: (_, __) => _ErrorState(onRetry: () => ref.invalidate(_allBadgesProvider)),
        data: (allBadges) => earnedAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => _ErrorState(onRetry: () => ref.invalidate(_earnedBadgesProvider(profileId))),
          data: (earnedBadges) {
            final earnedCount = allBadges
                .where((b) => _isEarned(b, earnedBadges))
                .length;
            final total = allBadges.length;
            final pct = total > 0 ? (earnedCount * 100 ~/ total) : 0;
            final filtered = _filtered(allBadges);

            return Column(
              children: [
                // ── Stats banner ─────────────────────────────────────────
                _StatsBanner(
                  earned: earnedCount,
                  toGo: total - earnedCount,
                  pct: pct,
                  controller: _celebrateController,
                ),

                // ── Category filter chips ─────────────────────────────────
                SizedBox(
                  height: 50,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    children: _categories.map((cat) {
                      final selected = _selectedCategory == cat;
                      final color = _categoryColors[cat] ?? ShieldTheme.primary;
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: FilterChip(
                          avatar: Icon(
                            _categoryIcons[cat] ?? Icons.label_rounded,
                            size: 14,
                            color: selected ? Colors.white : color,
                          ),
                          label: Text(
                            cat,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: selected ? Colors.white : color,
                            ),
                          ),
                          selected: selected,
                          onSelected: (_) => setState(() => _selectedCategory = cat),
                          selectedColor: color,
                          backgroundColor: color.withOpacity(0.08),
                          checkmarkColor: Colors.white,
                          showCheckmark: false,
                          side: BorderSide(
                            color: selected ? color : color.withOpacity(0.3),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                        ),
                      );
                    }).toList(),
                  ),
                ),

                // ── Badge grid ────────────────────────────────────────────
                Expanded(
                  child: filtered.isEmpty
                      ? _EmptyCategory(category: _selectedCategory)
                      : GridView.builder(
                          padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            childAspectRatio: 0.82,
                            crossAxisSpacing: 8,
                            mainAxisSpacing: 8,
                          ),
                          itemCount: filtered.length,
                          itemBuilder: (ctx, i) {
                            final badge = filtered[i];
                            final isEarned = _isEarned(badge, earnedBadges);
                            final date = _earnedDate(badge, earnedBadges);
                            final emoji = badge['iconEmoji']?.toString() ?? '🏆';
                            final name = badge['name']?.toString() ?? '';
                            return _BadgeTile(
                              emoji: emoji,
                              name: name,
                              isEarned: isEarned,
                              earnedDate: date != null ? _formatDate(date) : null,
                              description: badge['description']?.toString(),
                              controller: _celebrateController,
                              onTap: () => _showBadgeDetail(ctx, badge, isEarned, date),
                            );
                          },
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  void _showBadgeDetail(
    BuildContext context,
    Map<String, dynamic> badge,
    bool isEarned,
    String? date,
  ) {
    final emoji = badge['iconEmoji']?.toString() ?? '🏆';
    final name = badge['name']?.toString() ?? '';
    final description = badge['description']?.toString() ?? '';
    final requirement = badge['requirement']?.toString() ?? badge['criteria']?.toString() ?? '';

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: BoxDecoration(
          color: ShieldTheme.cardBg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isEarned
                    ? Colors.amber.shade50
                    : Colors.grey.shade100,
                border: Border.all(
                  color: isEarned ? Colors.amber.shade400 : Colors.grey.shade300,
                  width: 2,
                ),
                boxShadow: isEarned
                    ? [
                        BoxShadow(
                          color: Colors.amber.withOpacity(0.4),
                          blurRadius: 16,
                          spreadRadius: 2,
                        )
                      ]
                    : null,
              ),
              child: Center(
                child: Text(
                  isEarned ? emoji : '🔒',
                  style: TextStyle(fontSize: isEarned ? 40 : 34),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              name,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: ShieldTheme.textPrimary,
              ),
            ),
            if (isEarned && date != null) ...[
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.check_circle_rounded, size: 14, color: ShieldTheme.success),
                  const SizedBox(width: 4),
                  Text(
                    'Earned on ${_formatDate(date)}',
                    style: const TextStyle(fontSize: 12, color: ShieldTheme.success, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ],
            if (!isEarned) ...[
              const SizedBox(height: 4),
              const Text(
                'Not yet earned',
                style: TextStyle(fontSize: 12, color: ShieldTheme.textSecondary),
              ),
            ],
            if (description.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                description,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: ShieldTheme.textSecondary,
                  height: 1.5,
                ),
              ),
            ],
            if (requirement.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: ShieldTheme.primary.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: ShieldTheme.primary.withOpacity(0.15)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded, size: 16, color: ShieldTheme.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        requirement,
                        style: const TextStyle(
                          fontSize: 12,
                          color: ShieldTheme.primary,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _StatsBanner extends StatelessWidget {
  final int earned;
  final int toGo;
  final int pct;
  final AnimationController controller;

  const _StatsBanner({
    required this.earned,
    required this.toGo,
    required this.pct,
    required this.controller,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.amber.shade700,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Row(
        children: [
          Expanded(child: _StatCell(value: '$earned', label: 'Earned', color: Colors.white)),
          _Divider(),
          Expanded(child: _StatCell(value: '$toGo', label: 'To Go', color: Colors.white70)),
          _Divider(),
          Expanded(child: _StatCell(value: '$pct%', label: 'Complete', color: Colors.greenAccent.shade200)),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) =>
      Container(width: 1, height: 36, color: Colors.white24);
}

class _StatCell extends StatelessWidget {
  final String value;
  final String label;
  final Color color;
  const _StatCell({required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: color),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: Colors.white60, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}

class _BadgeTile extends StatelessWidget {
  final String emoji;
  final String name;
  final bool isEarned;
  final String? earnedDate;
  final String? description;
  final AnimationController controller;
  final VoidCallback onTap;

  const _BadgeTile({
    required this.emoji,
    required this.name,
    required this.isEarned,
    required this.controller,
    required this.onTap,
    this.earnedDate,
    this.description,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: isEarned ? Colors.amber.shade50 : Colors.grey.shade100,
          border: Border.all(
            color: isEarned ? Colors.amber.shade400 : Colors.grey.shade300,
            width: isEarned ? 1.5 : 1,
          ),
          boxShadow: isEarned
              ? [
                  BoxShadow(
                    color: Colors.amber.withOpacity(0.25),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  )
                ]
              : null,
        ),
        padding: const EdgeInsets.all(8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Badge icon
            isEarned
                ? AnimatedBuilder(
                    animation: controller,
                    builder: (_, child) => Transform.scale(
                      scale: 1.0 + controller.value * 0.05,
                      child: child,
                    ),
                    child: Text(emoji, style: const TextStyle(fontSize: 30)),
                  )
                : Stack(
                    alignment: Alignment.center,
                    children: [
                      Text(emoji,
                          style: const TextStyle(fontSize: 28, color: Colors.transparent)),
                      ColorFiltered(
                        colorFilter: const ColorFilter.matrix([
                          0.2126, 0.7152, 0.0722, 0, 0,
                          0.2126, 0.7152, 0.0722, 0, 0,
                          0.2126, 0.7152, 0.0722, 0, 0,
                          0,      0,      0,      0.5, 0,
                        ]),
                        child: Text(emoji, style: const TextStyle(fontSize: 28)),
                      ),
                      if (!isEarned)
                        const Icon(Icons.lock_rounded, size: 14, color: Colors.grey),
                    ],
                  ),
            const SizedBox(height: 5),
            Text(
              name,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                color: isEarned ? ShieldTheme.textPrimary : Colors.grey.shade500,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            if (isEarned && earnedDate != null) ...[
              const SizedBox(height: 2),
              Text(
                earnedDate!,
                style: const TextStyle(fontSize: 7.5, color: ShieldTheme.textSecondary),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EmptyCategory extends StatelessWidget {
  final String category;
  const _EmptyCategory({required this.category});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.emoji_events_outlined, size: 64, color: Colors.grey.shade400),
          const SizedBox(height: 12),
          Text(
            'No badges in $category',
            style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cloud_off_rounded, size: 56, color: Colors.grey.shade400),
          const SizedBox(height: 12),
          const Text('Could not load badges', style: TextStyle(color: ShieldTheme.textSecondary)),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
