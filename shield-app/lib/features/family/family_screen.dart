import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';

final profilesProvider = FutureProvider<List<dynamic>>((ref) async {
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
      appBar: AppBar(
        title: const Text('Family', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(profilesProvider),
          ),
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Add Child',
            onPressed: () => context.go('/family/new'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.go('/family/new'),
        icon: const Icon(Icons.add),
        label: const Text('Add Child'),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
      ),
      body: profilesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (profiles) => profiles.isEmpty
          ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.family_restroom, size: 64, color: Colors.grey.shade400),
              const SizedBox(height: 16),
              const Text('No child profiles yet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  'Add your first child profile to start protecting them with content filtering and screen time controls.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () => context.go('/family/new'),
                icon: const Icon(Icons.add),
                label: const Text('Add Child Profile'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1565C0),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
              ),
            ]))
          : RefreshIndicator(
              onRefresh: () => ref.refresh(profilesProvider.future),
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: profiles.length,
                itemBuilder: (ctx, i) {
                  final p = profiles[i] as Map<String, dynamic>;
                  final name = p['name'] as String? ?? 'Child ${i + 1}';
                  final filterLevel = p['filterLevel'] as String? ?? 'MODERATE';
                  final filterColor = filterLevel == 'STRICT'
                      ? Colors.red.shade700
                      : filterLevel == 'RELAXED'
                          ? Colors.green.shade700
                          : Colors.orange.shade700;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: const Color(0xFF1565C0),
                        child: Text(name[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                      ),
                      title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Row(children: [
                        if (p['age'] != null) ...[
                          Text('${p['age']} yrs', style: const TextStyle(fontSize: 12)),
                          const Text(' · ', style: TextStyle(fontSize: 12)),
                        ],
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: filterColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(filterLevel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: filterColor)),
                        ),
                      ]),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.go('/family/${p['id']}'),
                    ),
                  );
                },
              ),
            ),
      ),
    );
  }
}
