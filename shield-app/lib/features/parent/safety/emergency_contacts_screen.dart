import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

final _contactsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.emergencyContacts(pid));
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.cast<Map<String, dynamic>>();
});

class EmergencyContactsScreen extends ConsumerWidget {
  const EmergencyContactsScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contacts = ref.watch(_contactsProvider(profileId));
    return Scaffold(
      appBar: AppBar(title: const Text('Emergency Contacts')),
      body: contacts.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load contacts',
          onRetry: () => ref.invalidate(_contactsProvider(profileId)),
        ),
        data: (list) => list.isEmpty
            ? EmptyView(
                icon:    Icons.contacts_outlined,
                message: 'No emergency contacts yet.\nAdd contacts your child can reach in an emergency.',
                action: ElevatedButton.icon(
                  onPressed: () => _showAdd(context, profileId, ref),
                  icon:  const Icon(Icons.add),
                  label: const Text('Add Contact'),
                ),
              )
            : ListView.builder(
                itemCount:   list.length,
                itemBuilder: (_, i) => Card(
                  child: ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: Color(0xFFFFEBEE),
                      child: Icon(Icons.person, color: Color(0xFFC62828)),
                    ),
                    title:    Text(list[i]['name']?.toString() ?? ''),
                    subtitle: Text(list[i]['phone']?.toString() ?? ''),
                    trailing: const Icon(Icons.phone, color: Color(0xFF1565C0)),
                  ),
                ),
              ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAdd(context, profileId, ref),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showAdd(BuildContext context, String pid, WidgetRef ref) {
    final name  = TextEditingController();
    final phone = TextEditingController();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Add Emergency Contact'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: name,
              decoration: const InputDecoration(labelText: 'Name', prefixIcon: Icon(Icons.person))),
          const SizedBox(height: 8),
          TextField(controller: phone, keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone', prefixIcon: Icon(Icons.phone))),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (name.text.isEmpty || phone.text.isEmpty) return;
              await ApiClient.instance.post(Endpoints.emergencyContacts(pid),
                  data: {'name': name.text, 'phone': phone.text});
              if (context.mounted) {
                Navigator.pop(context);
                ref.invalidate(_contactsProvider(pid));
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }
}
