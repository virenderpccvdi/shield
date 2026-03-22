import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';

/// Fetches emergency contacts from shield-profile for a given profileId.
final _emergencyContactsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>(
  (ref, profileId) async {
    if (profileId.isEmpty) return [];
    final dio = ref.read(dioProvider);
    final res = await dio.get('/profiles/$profileId/emergency-contacts');
    final raw = res.data['data'];
    final list = raw is List ? raw : [];
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  },
);

/// CS-03: Speed Dial Screen
///
/// Shows the child a full-screen list of emergency contacts (up to 5).
/// Each contact has a large CALL button and an SMS button for quick access.
class SpeedDialScreen extends ConsumerWidget {
  final String profileId;
  const SpeedDialScreen({super.key, required this.profileId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contactsAsync = ref.watch(_emergencyContactsProvider(profileId));
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: colorScheme.background,
      appBar: AppBar(
        title: const Text(
          'Emergency Contacts',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        backgroundColor: const Color(0xFFC62828),
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: contactsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 56, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              const Text(
                'Could not load contacts.',
                style: TextStyle(fontSize: 15, color: Colors.grey),
              ),
            ],
          ),
        ),
        data: (contacts) {
          if (contacts.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.contact_emergency,
                          size: 56, color: Colors.red.shade300),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'No Emergency Contacts',
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: Colors.black87),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'No emergency contacts added.\nAsk your parent to add contacts.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 15,
                          color: Colors.grey.shade600,
                          height: 1.5),
                    ),
                  ],
                ),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            itemCount: contacts.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final contact = contacts[index];
              return _ContactCard(contact: contact);
            },
          );
        },
      ),
    );
  }
}

class _ContactCard extends StatelessWidget {
  final Map<String, dynamic> contact;
  const _ContactCard({required this.contact});

  Future<void> _call(BuildContext context, String phone) async {
    final cleaned = phone.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri.parse('tel:$cleaned');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not launch phone dialer')),
        );
      }
    }
  }

  Future<void> _sms(BuildContext context, String phone) async {
    final cleaned = phone.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri.parse('sms:$cleaned');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not launch messaging app')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = contact['name']?.toString() ?? 'Contact';
    final phone = contact['phone']?.toString() ?? '';
    final relationship = contact['relationship']?.toString();
    final hasPhone = phone.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.07),
              blurRadius: 16,
              offset: const Offset(0, 4))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: const Color(0xFFC62828).withOpacity(0.12),
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFC62828)),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name,
                        style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: Colors.black87)),
                    if (relationship != null && relationship.isNotEmpty)
                      Text(relationship,
                          style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey.shade600,
                              fontWeight: FontWeight.w500)),
                    if (hasPhone)
                      Text(phone,
                          style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey.shade500)),
                  ],
                ),
              ),
            ],
          ),
          if (hasPhone) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: ElevatedButton.icon(
                    onPressed: () => _call(context, phone),
                    icon: const Icon(Icons.phone, size: 20),
                    label: const Text('CALL',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 1.5)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2E7D32),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    onPressed: () => _sms(context, phone),
                    icon: const Icon(Icons.message, size: 18),
                    label: const Text('SMS',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w700, letterSpacing: 1)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ShieldTheme.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
              ],
            ),
          ] else
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text('No phone number on file',
                  style: TextStyle(color: Colors.grey.shade400, fontSize: 13)),
            ),
        ],
      ),
    );
  }
}
