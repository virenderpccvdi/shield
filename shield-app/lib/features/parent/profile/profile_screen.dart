import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/common_widgets.dart';

// ── Provider ──────────────────────────────────────────────────────────────────

final _meProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final resp = await ApiClient.instance.get(Endpoints.me);
  return resp.data is Map<String, dynamic>
      ? resp.data as Map<String, dynamic>
      : <String, dynamic>{};
});

// ── Screen ────────────────────────────────────────────────────────────────────

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meAsync = ref.watch(_meProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        actions: [
          meAsync.whenData((d) => IconButton(
            icon: const Icon(Icons.edit_outlined),
            onPressed: () => _showEditDialog(context, ref, d),
          )).value ?? const SizedBox.shrink(),
        ],
      ),
      body: meAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => ErrorView(
          message: 'Failed to load profile',
          onRetry: () => ref.invalidate(_meProvider),
        ),
        data: (d) => _ProfileBody(
          data:      d,
          onRefresh: () => ref.invalidate(_meProvider),
          onEdit:    () => _showEditDialog(context, ref, d),
          onChangePw: () => _showChangePwDialog(context),
        ),
      ),
    );
  }

  void _showEditDialog(BuildContext context, WidgetRef ref,
      Map<String, dynamic> data) async {
    final nameCtrl = TextEditingController(text: data['name']?.toString() ?? '');
    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Edit Profile'),
        content: TextField(
          controller: nameCtrl,
          decoration: const InputDecoration(
              labelText: 'Full name',
              prefixIcon: Icon(Icons.person_outline)),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              try {
                await ApiClient.instance.put(Endpoints.me, data: {
                  'name': nameCtrl.text.trim(),
                });
                if (context.mounted) {
                  Navigator.pop(context);
                  ref.invalidate(_meProvider);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text('Profile updated'),
                      backgroundColor: Colors.green));
                }
              } catch (_) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text('Failed to update profile')));
                }
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    nameCtrl.dispose();
  }

  void _showChangePwDialog(BuildContext context) {
    final currentCtrl = TextEditingController();
    final newCtrl     = TextEditingController();
    final confirmCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Change Password'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
            controller:  currentCtrl,
            obscureText: true,
            decoration: const InputDecoration(
                labelText: 'Current password',
                prefixIcon: Icon(Icons.lock_outline)),
          ),
          const SizedBox(height: 12),
          TextField(
            controller:  newCtrl,
            obscureText: true,
            decoration: const InputDecoration(
                labelText: 'New password',
                prefixIcon: Icon(Icons.lock_reset_outlined)),
          ),
          const SizedBox(height: 12),
          TextField(
            controller:  confirmCtrl,
            obscureText: true,
            decoration: const InputDecoration(
                labelText: 'Confirm new password',
                prefixIcon: Icon(Icons.lock_reset_outlined)),
          ),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (newCtrl.text != confirmCtrl.text) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                    content: Text('Passwords do not match')));
                return;
              }
              if (newCtrl.text.length < 8) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                    content:
                        Text('Password must be at least 8 characters')));
                return;
              }
              try {
                await ApiClient.instance
                    .post(Endpoints.changePassword, data: {
                  'currentPassword': currentCtrl.text,
                  'newPassword':     newCtrl.text,
                });
                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text('Password changed'),
                      backgroundColor: Colors.green));
                }
              } catch (_) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text('Failed — check current password')));
                }
              }
            },
            child: const Text('Change'),
          ),
        ],
      ),
    );
    currentCtrl.dispose();
    newCtrl.dispose();
    confirmCtrl.dispose();
  }
}

// ── Body ──────────────────────────────────────────────────────────────────────

class _ProfileBody extends StatelessWidget {
  const _ProfileBody({
    required this.data,
    required this.onRefresh,
    required this.onEdit,
    required this.onChangePw,
  });
  final Map<String, dynamic> data;
  final VoidCallback onRefresh, onEdit, onChangePw;

  @override
  Widget build(BuildContext context) {
    final name  = data['name']?.toString()  ?? 'Parent';
    final email = data['email']?.toString() ?? '';
    final role  = data['role']?.toString()  ?? 'CUSTOMER';
    final phone = data['phone']?.toString();

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView(children: [
        // ── Avatar header ─────────────────────────────────────────────────
        Container(
          color: ShieldTheme.primary,
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          child: Column(children: [
            Stack(
              alignment: Alignment.bottomRight,
              children: [
                CircleAvatar(
                  radius: 44,
                  backgroundColor: Colors.white24,
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : 'P',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 36,
                        fontWeight: FontWeight.bold),
                  ),
                ),
                GestureDetector(
                  onTap: onEdit,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: const BoxDecoration(
                        color: Colors.white, shape: BoxShape.circle),
                    child: const Icon(Icons.edit,
                        size: 14, color: ShieldTheme.primary),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(name,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(email,
                style: TextStyle(
                    color: Colors.white.withOpacity(0.75), fontSize: 13)),
            const SizedBox(height: 10),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(20)),
              child: Text(
                role == 'CUSTOMER' ? 'Parent Account' : role,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w600),
              ),
            ),
          ]),
        ),

        // ── Info tiles ────────────────────────────────────────────────────
        const SectionHeader('Personal Information'),
        _Tile(icon: Icons.person_outline, label: 'Full Name',  value: name),
        _Tile(icon: Icons.email_outlined,  label: 'Email',      value: email),
        if (phone != null && phone.isNotEmpty)
          _Tile(icon: Icons.phone_outlined, label: 'Phone', value: phone),

        // ── Security ──────────────────────────────────────────────────────
        const SectionHeader('Security'),
        ListTile(
          leading: Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
                color: ShieldTheme.primary.withOpacity(0.08),
                borderRadius: BorderRadius.circular(8)),
            child: const Icon(Icons.lock_outline,
                size: 18, color: ShieldTheme.primary),
          ),
          title: const Text('Change Password',
              style: TextStyle(fontSize: 14)),
          trailing: const Icon(Icons.chevron_right,
              size: 18, color: Colors.grey),
          onTap: onChangePw,
        ),

        const SizedBox(height: 32),
      ]),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String   label, value;

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Container(
      width: 36, height: 36,
      decoration: BoxDecoration(
          color: ShieldTheme.primary.withOpacity(0.08),
          borderRadius: BorderRadius.circular(8)),
      child: Icon(icon, size: 18, color: ShieldTheme.primary),
    ),
    title: Text(label,
        style: const TextStyle(fontSize: 12, color: Colors.black45)),
    subtitle: Text(value,
        style: const TextStyle(
            fontSize: 14, fontWeight: FontWeight.w500)),
  );
}
