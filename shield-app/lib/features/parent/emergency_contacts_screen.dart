import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class EmergencyContactsScreen extends ConsumerStatefulWidget {
  final String profileId;
  const EmergencyContactsScreen({super.key, required this.profileId});
  @override
  ConsumerState<EmergencyContactsScreen> createState() => _EmergencyContactsScreenState();
}

class _EmergencyContactsScreenState extends ConsumerState<EmergencyContactsScreen> {
  List<Map<String, dynamic>> _contacts = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/profiles/${widget.profileId}/emergency-contacts');
      final data = res.data['data'] ?? res.data;
      setState(() {
        _contacts = (data is List ? data : data['content'] ?? [])
            .map<Map<String, dynamic>>((e) => e is Map ? Map<String, dynamic>.from(e) : {}).toList();
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
      debugPrint('Emergency contacts error: $e');
    }
  }

  Future<void> _addContact() async {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Emergency Contact'),
        content: Form(
          key: formKey,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextFormField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Name', prefixIcon: Icon(Icons.person)),
              validator: (v) => v == null || v.trim().isEmpty ? 'Name is required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: phoneCtrl,
              decoration: const InputDecoration(labelText: 'Phone number', prefixIcon: Icon(Icons.phone)),
              keyboardType: TextInputType.phone,
              validator: (v) => v == null || v.trim().isEmpty ? 'Phone is required' : null,
            ),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (formKey.currentState!.validate()) Navigator.pop(ctx, true);
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );

    if (result == true) {
      try {
        final client = ref.read(dioProvider);
        await client.post('/profiles/${widget.profileId}/emergency-contacts', data: {
          'name': nameCtrl.text.trim(),
          'phone': phoneCtrl.text.trim(),
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: const Text('Contact added'),
            backgroundColor: ShieldTheme.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
        }
        _load();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Failed to add: $e'),
            backgroundColor: ShieldTheme.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
        }
      }
    }
    nameCtrl.dispose();
    phoneCtrl.dispose();
  }

  Future<void> _deleteContact(String id, String name) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Contact'),
        content: Text('Remove $name from emergency contacts?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: ShieldTheme.danger),
            child: const Text('Remove'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final client = ref.read(dioProvider);
        await client.delete('/profiles/${widget.profileId}/emergency-contacts/$id');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: const Text('Contact removed'),
            backgroundColor: ShieldTheme.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
        }
        _load();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Failed to remove: $e'),
            backgroundColor: ShieldTheme.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('Emergency Contacts', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _addContact,
        backgroundColor: ShieldTheme.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _loading
          ? const Padding(padding: EdgeInsets.all(16), child: ShieldCardSkeleton(lines: 4))
          : _contacts.isEmpty
              ? ShieldEmptyState(
                  icon: Icons.contact_phone,
                  title: 'No emergency contacts',
                  subtitle: 'Add trusted contacts who can be reached even when the device is locked.',
                  actionLabel: 'Add Contact',
                  onAction: _addContact,
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _contacts.length,
                    itemBuilder: (_, i) {
                      final c = _contacts[i];
                      final name = c['name']?.toString() ?? 'Unknown';
                      final phone = c['phone']?.toString() ?? '';
                      final id = c['id']?.toString() ?? '';
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: ShieldTheme.primary.withOpacity(0.1),
                            child: Text(
                              name.isNotEmpty ? name[0].toUpperCase() : '?',
                              style: const TextStyle(fontWeight: FontWeight.w700, color: ShieldTheme.primary),
                            ),
                          ),
                          title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(phone, style: const TextStyle(fontSize: 13, color: ShieldTheme.textSecondary)),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline, color: ShieldTheme.danger, size: 20),
                            onPressed: () => _deleteContact(id, name),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
