import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth_state.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Settings', style: TextStyle(fontWeight: FontWeight.w700))),
      body: ListView(
        children: [
          UserAccountsDrawerHeader(
            decoration: const BoxDecoration(color: Color(0xFF1565C0)),
            accountName: Text(auth.name ?? 'User', style: const TextStyle(fontWeight: FontWeight.w700)),
            accountEmail: Text(auth.email ?? ''),
            currentAccountPicture: CircleAvatar(
              backgroundColor: Colors.white,
              child: Text((auth.name ?? 'U')[0].toUpperCase(), style: const TextStyle(color: Color(0xFF1565C0), fontWeight: FontWeight.w800, fontSize: 24)),
            ),
          ),
          ListTile(leading: const Icon(Icons.person_outline), title: const Text('Account'), subtitle: const Text('Profile, email, password'), onTap: () {}),
          ListTile(leading: const Icon(Icons.notifications_outlined), title: const Text('Notifications'), subtitle: const Text('Alerts and reports'), onTap: () {}),
          ListTile(leading: const Icon(Icons.security_outlined), title: const Text('Security'), subtitle: const Text('Two-factor authentication'), onTap: () {}),
          ListTile(leading: const Icon(Icons.info_outline), title: const Text('About Shield'), subtitle: const Text('Version 1.0.0'), onTap: () {}),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Sign Out', style: TextStyle(color: Colors.red)),
            onTap: () async {
              final confirm = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
                title: const Text('Sign Out'),
                content: const Text('Are you sure you want to sign out?'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                  FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('Sign Out')),
                ],
              ));
              if (confirm == true) {
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) context.go('/login');
              }
            },
          ),
        ],
      ),
    );
  }
}
