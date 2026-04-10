import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/models/child_profile.dart';
import '../../../core/widgets/common_widgets.dart';

final familyChildrenProvider = FutureProvider.autoDispose<List<ChildProfile>>((ref) async {
  final resp = await ApiClient.instance.get(Endpoints.children);
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>)['data'] as List? ?? [];
  return raw.map((j) => ChildProfile.fromJson(j as Map<String, dynamic>)).toList();
});

class FamilyScreen extends ConsumerWidget {
  const FamilyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children = ref.watch(familyChildrenProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Family'),
        actions: [
          IconButton(
            icon:     const Icon(Icons.person_add),
            tooltip:  'Add Child',
            onPressed: () => context.push('/parent/family/new'),
          ),
        ],
      ),
      body: children.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load family',
          onRetry: () => ref.invalidate(familyChildrenProvider),
        ),
        data: (list) {
          if (list.isEmpty) {
            return EmptyView(
              icon:    Icons.child_friendly,
              message: 'No child profiles yet.\nAdd your first child to get started.',
              action: ElevatedButton.icon(
                onPressed: () => context.push('/parent/family/new'),
                icon:  const Icon(Icons.add),
                label: const Text('Add Child'),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(familyChildrenProvider),
            child: ListView.builder(
              padding:     const EdgeInsets.symmetric(vertical: 8),
              itemCount:   list.length,
              itemBuilder: (_, i) => _ChildListTile(child: list[i]),
            ),
          );
        },
      ),
    );
  }
}

class _ChildListTile extends StatelessWidget {
  const _ChildListTile({required this.child});
  final ChildProfile child;

  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      onTap: () => context.push('/parent/family/${child.id}'),
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(children: [
          CircleAvatar(
            radius:          28,
            backgroundColor: const Color(0xFF2563EB).withOpacity(0.12),
            child: Text(child.initials,
                style: const TextStyle(color: Color(0xFF2563EB),
                    fontWeight: FontWeight.bold, fontSize: 20)),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(child.name,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 17)),
            const SizedBox(height: 2),
            Wrap(spacing: 6, children: [
              if (child.age != null)
                _chip('Age ${child.age}', Colors.blue),
              if (child.filterLevel != null)
                _chip(child.filterLevel!, Colors.purple),
              if (child.isActive)
                _chip('Active', Colors.green),
            ]),
          ])),
          const Icon(Icons.chevron_right, color: Colors.black45),
        ]),
      ),
    ),
  );

  Widget _chip(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(
      color:        color.withOpacity(0.1),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Text(label,
        style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
  );
}
