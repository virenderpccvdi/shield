import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/providers/auth_provider.dart';

class ChildRewardsScreen extends ConsumerWidget {
  const ChildRewardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pid = ref.read(authProvider).childProfileId ?? '';
    final points = ref.watch(_pointsProvider(pid));

    return Scaffold(
      backgroundColor: const Color(0xFF1E40AF),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text('My Rewards'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: points.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Colors.white)),
        error:   (e, _) => Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.error_outline, color: Colors.white70, size: 48),
            const SizedBox(height: 12),
            const Text('Could not load rewards',
                style: TextStyle(color: Colors.white70)),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => ref.invalidate(_pointsProvider(pid)),
              child: const Text('Retry', style: TextStyle(color: Colors.white70)),
            ),
          ]),
        ),
        data: (p) => Column(children: [
          // Points display
          Padding(
            padding: const EdgeInsets.all(24),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [const Color(0xFFB45309), const Color(0xFF92400E)],
                  begin: Alignment.topLeft,
                  end:   Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(children: [
                const Icon(Icons.star, color: Colors.white, size: 48),
                const SizedBox(height: 8),
                Text('$p', style: const TextStyle(
                    color: Colors.white, fontSize: 48, fontWeight: FontWeight.bold)),
                const Text('Points Earned', style: TextStyle(color: Colors.white70)),
              ]),
            ),
          ),

          // Achievements
          _AchievementsSection(pid: pid),
        ]),
      ),
    );
  }
}

final _pointsProvider = FutureProvider.autoDispose.family<int, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.points(pid));
  return ((resp.data as Map<String, dynamic>?)?['points'] as num?)?.toInt() ?? 0;
});

class _AchievementsSection extends ConsumerWidget {
  const _AchievementsSection({required this.pid});
  final String pid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final achievements = ref.watch(_achievementsProvider(pid));
    return Expanded(
      child: achievements.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Colors.white)),
        error:   (_, __) => const Center(
          child: Text('Could not load achievements',
              style: TextStyle(color: Colors.white70, fontSize: 13))),
        data: (list) {
          if (list.isEmpty) {
            return const Center(
              child: Text('Complete tasks to earn achievements!',
                  style: TextStyle(color: Colors.white70)),
            );
          }
          return GridView.builder(
            padding:     const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3, childAspectRatio: 0.85,
                crossAxisSpacing: 12, mainAxisSpacing: 12),
            itemCount: list.length,
            itemBuilder: (_, i) {
              final a = list[i];
              return Container(
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(a['emoji']?.toString() ?? '🏆',
                      style: const TextStyle(fontSize: 32)),
                  const SizedBox(height: 4),
                  Text(a['name']?.toString() ?? '',
                      style: const TextStyle(color: Colors.white, fontSize: 10),
                      textAlign: TextAlign.center, maxLines: 2),
                ]),
              );
            },
          );
        },
      ),
    );
  }
}

final _achievementsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.achievements(pid));
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.whereType<Map<String, dynamic>>().toList();
});
