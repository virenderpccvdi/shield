import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';

final profilesProvider = FutureProvider<List<dynamic>>((ref) async {
  final client = ref.read(dioProvider);
  try {
    final res = await client.get('/profile/my');
    return res.data['data'] as List? ?? [];
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
          IconButton(icon: const Icon(Icons.add_circle_outline), onPressed: () => _showAddProfileDialog(context, ref)),
        ],
      ),
      body: profilesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (profiles) => profiles.isEmpty
          ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.family_restroom, size: 64, color: Colors.grey.shade400),
              const SizedBox(height: 16),
              const Text('No children added', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              const Text('Tap + to add your first child profile', style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 20),
              FilledButton.icon(onPressed: () => _showAddProfileDialog(context, ref), icon: const Icon(Icons.add), label: const Text('Add Child')),
            ]))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: profiles.length,
              itemBuilder: (ctx, i) {
                final p = profiles[i] as Map<String, dynamic>;
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: const Color(0xFF1565C0),
                      child: Text((p['name'] as String? ?? 'C')[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                    ),
                    title: Text(p['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text('${p['age'] ?? ''} yrs • ${p['filterLevel'] ?? 'MODERATE'} filter'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.go('/family/${p['id']}'),
                  ),
                );
              },
            ),
      ),
    );
  }

  void _showAddProfileDialog(BuildContext context, WidgetRef ref) {
    final nameCtrl = TextEditingController();
    final ageCtrl = TextEditingController();
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Add Child Profile'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: "Child's Name")),
        const SizedBox(height: 12),
        TextField(controller: ageCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Age')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(onPressed: () async {
          Navigator.pop(ctx);
          try {
            final client = ref.read(dioProvider);
            await client.post('/profile/my', data: {'name': nameCtrl.text, 'age': int.tryParse(ageCtrl.text) ?? 10, 'filterLevel': 'MODERATE'});
            ref.invalidate(profilesProvider);
          } catch (e) {
            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
          }
        }, child: const Text('Add')),
      ],
    ));
  }
}
