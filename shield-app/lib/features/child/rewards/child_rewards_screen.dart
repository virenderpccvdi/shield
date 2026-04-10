import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/common_widgets.dart';

final _pointsProvider =
    FutureProvider.autoDispose.family<int, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.points(pid));
  return ((resp.data as Map<String, dynamic>?)?['points'] as num?)?.toInt() ?? 0;
});

final _achievementsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>(
        (ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.achievements(pid));
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.whereType<Map<String, dynamic>>().toList();
});

class ChildRewardsScreen extends ConsumerWidget {
  const ChildRewardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pid    = ref.read(authProvider).childProfileId ?? '';
    final points = ref.watch(_pointsProvider(pid));

    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor: const Color(0xFF003D72),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text('My Rewards',
            style: GoogleFonts.manrope(
                color: Colors.white, fontWeight: FontWeight.w700, fontSize: 18)),
        leading: IconButton(
          icon:      const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: points.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: Colors.white)),
        error: (e, _) => Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color:        Colors.white.withOpacity(0.10),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.error_outline_rounded,
                  color: Colors.white70, size: 40),
            ),
            const SizedBox(height: 16),
            Text('Could not load rewards',
                style: GoogleFonts.inter(color: Colors.white70, fontSize: 14)),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => ref.invalidate(_pointsProvider(pid)),
              child: Text('Try Again',
                  style: GoogleFonts.inter(
                      color: Colors.white, fontWeight: FontWeight.w600)),
            ),
          ]),
        ),
        data: (pts) => CustomScrollView(
          slivers: [
            // ── Points hero ─────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 100, 24, 0),
                child: _PointsHero(points: pts),
              ),
            ),

            // ── Achievements section ─────────────────────────────────────────
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(24, 28, 24, 12),
                child: Row(children: [
                  Icon(Icons.emoji_events_rounded,
                      color: Color(0xFFFFB300), size: 18),
                  SizedBox(width: 8),
                  Text('Achievements',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700)),
                ]),
              ),
            ),

            _AchievementsSliver(pid: pid),

            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
    );
  }
}

// ── Points hero ───────────────────────────────────────────────────────────────

class _PointsHero extends StatelessWidget {
  const _PointsHero({required this.points});
  final int points;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(Ds.radiusChild),
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
      child: Container(
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          // Warm amber gradient instead of hardcoded brown
          gradient: const LinearGradient(
            colors: [Color(0xFFFF8F00), Color(0xFFE65100)],
            begin: Alignment.topLeft,
            end:   Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(Ds.radiusChild),
          boxShadow: [
            BoxShadow(
              color:      const Color(0xFFFF8F00).withOpacity(0.35),
              blurRadius: 28,
              spreadRadius: -4,
            ),
          ],
        ),
        child: Row(children: [
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.star_rounded,
                    color: Colors.white, size: 20),
                const SizedBox(width: 6),
                Text('My Points',
                    style: GoogleFonts.inter(
                        color: Colors.white.withOpacity(0.80),
                        fontSize: 13, fontWeight: FontWeight.w600)),
              ]),
              const SizedBox(height: 8),
              Text('$points',
                  style: GoogleFonts.manrope(
                      color: Colors.white, fontSize: 52,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -2)),
              const SizedBox(height: 2),
              Text('points earned',
                  style: GoogleFonts.inter(
                      color: Colors.white.withOpacity(0.65), fontSize: 12)),
            ],
          )),
          // Decorative star cluster
          Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.star_rounded,
                color: Colors.white, size: 48),
            const Icon(Icons.star_rounded,
                color: Colors.white54, size: 28),
            const Icon(Icons.star_rounded,
                color: Colors.white24, size: 16),
          ]),
        ]),
      ),
    ),
  );
}

// ── Achievements sliver ───────────────────────────────────────────────────────

class _AchievementsSliver extends ConsumerWidget {
  const _AchievementsSliver({required this.pid});
  final String pid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final achievements = ref.watch(_achievementsProvider(pid));
    return achievements.when(
      loading: () => const SliverToBoxAdapter(
          child: Center(
              child: Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(color: Colors.white)))),
      error: (_, __) => const SliverToBoxAdapter(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: Text('Could not load achievements',
                style: TextStyle(color: Colors.white70, fontSize: 13)),
          ),
        ),
      ),
      data: (list) {
        if (list.isEmpty) {
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 0),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(Ds.radiusChild),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                  child: Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color:        Colors.white.withOpacity(0.07),
                      borderRadius: BorderRadius.circular(Ds.radiusChild),
                    ),
                    child: Column(children: [
                      const Icon(Icons.emoji_events_outlined,
                          color: Colors.white38, size: 40),
                      const SizedBox(height: 12),
                      Text('Complete tasks to earn achievements!',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                              color: Colors.white.withOpacity(0.55),
                              fontSize: 13)),
                    ]),
                  ),
                ),
              ),
            ),
          );
        }

        return SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount:  3,
              childAspectRatio: 0.85,
              crossAxisSpacing: 10,
              mainAxisSpacing:  10,
            ),
            delegate: SliverChildBuilderDelegate(
              (_, i) => _AchievementBadge(achievement: list[i]),
              childCount: list.length,
            ),
          ),
        );
      },
    );
  }
}

// ── Achievement badge ─────────────────────────────────────────────────────────

class _AchievementBadge extends StatelessWidget {
  const _AchievementBadge({required this.achievement});
  final Map<String, dynamic> achievement;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(Ds.radiusChild),
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
      child: Container(
        decoration: BoxDecoration(
          color:        Colors.white.withOpacity(0.10),
          borderRadius: BorderRadius.circular(Ds.radiusChild),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              achievement['emoji']?.toString() ?? '\u{1F3C6}',
              style: const TextStyle(fontSize: 34),
            ),
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                achievement['name']?.toString() ?? '',
                textAlign: TextAlign.center,
                maxLines:  2,
                overflow:  TextOverflow.ellipsis,
                style: GoogleFonts.inter(
                    color: Colors.white, fontSize: 10,
                    fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
