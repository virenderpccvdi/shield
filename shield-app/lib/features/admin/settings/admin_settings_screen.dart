import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/theme_provider.dart';

// ── Provider ──────────────────────────────────────────────────────────────────

final _adminProfileProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  try {
    final resp = await ApiClient.instance.get(Endpoints.me);
    return resp.data is Map<String, dynamic>
        ? resp.data as Map<String, dynamic>
        : <String, dynamic>{};
  } catch (_) {
    return <String, dynamic>{};
  }
});

// ── Screen ────────────────────────────────────────────────────────────────────

class AdminSettingsScreen extends ConsumerWidget {
  const AdminSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth    = ref.watch(authProvider);
    final profile = ref.watch(_adminProfileProvider);
    final theme   = ref.watch(themeModeProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(children: [
        // ── Profile card ──────────────────────────────────────────────────────
        Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1E40AF), Color(0xFF2563EB)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
          ),
          child: profile.when(
            loading: () => const Center(
                child: CircularProgressIndicator(color: Colors.white)),
            error: (_, __) => _profileRow(
              'Admin', auth.displayRole, context),
            data: (d) => _profileRow(
              d['name']?.toString() ?? 'Admin',
              auth.displayRole, context,
              email: d['email']?.toString(),
            ),
          ),
        ),

        // ── Appearance ───────────────────────────────────────────────────────
        _SectionHeader('Appearance'),
        _SettingsTile(
          icon: Icons.dark_mode_outlined,
          label: 'Theme',
          trailing: _ThemePill(current: theme, ref: ref),
        ),

        // ── Account ──────────────────────────────────────────────────────────
        _SectionHeader('Account'),
        _SettingsTile(
          icon: Icons.lock_outline,
          label: 'Change Password',
          onTap: () => _showChangePwDialog(context, ref),
        ),

        // ── Support ──────────────────────────────────────────────────────────
        _SectionHeader('Support'),
        _SettingsTile(
          icon: Icons.help_outline,
          label: 'Help & Documentation',
          onTap: () {},
        ),
        _SettingsTile(
          icon: Icons.bug_report_outlined,
          label: 'Report a Bug',
          onTap: () {},
        ),

        // ── About ─────────────────────────────────────────────────────────────
        _SectionHeader('About'),
        _SettingsTile(
          icon: Icons.info_outline,
          label: 'App Version',
          trailing: const Text('1.0.0',
              style: TextStyle(color: Colors.grey, fontSize: 13)),
        ),
        _SettingsTile(
          icon: Icons.shield_outlined,
          label: 'Shield Platform',
          trailing: const Text('RST Global',
              style: TextStyle(color: Colors.grey, fontSize: 13)),
        ),

        const SizedBox(height: 24),

        // ── Sign out ──────────────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: OutlinedButton.icon(
            icon: const Icon(Icons.logout, color: Colors.red),
            label: const Text('Sign Out',
                style: TextStyle(color: Colors.red, fontWeight: FontWeight.w600)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Colors.red, width: 1.5),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => _confirmSignOut(context, ref),
          ),
        ),
        const SizedBox(height: 32),
      ]),
    );
  }

  Widget _profileRow(String name, String role, BuildContext context,
      {String? email}) {
    return Row(children: [
      CircleAvatar(
        radius: 28,
        backgroundColor: Colors.white24,
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'A',
          style: const TextStyle(
              color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
        ),
      ),
      const SizedBox(width: 14),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700)),
          if (email != null) ...[
            const SizedBox(height: 2),
            Text(email,
                style: TextStyle(
                    color: Colors.white.withOpacity(0.7), fontSize: 12)),
          ],
          const SizedBox(height: 6),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(role,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w600)),
          ),
        ]),
      ),
    ]);
  }

  void _showChangePwDialog(BuildContext context, WidgetRef ref) {
    final currentCtrl = TextEditingController();
    final newCtrl     = TextEditingController();
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
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (newCtrl.text.length < 8) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                    content: Text('Password must be at least 8 characters')));
                return;
              }
              try {
                await ApiClient.instance.post(Endpoints.changePassword, data: {
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
                      content: Text('Failed to change password')));
                }
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    currentCtrl.dispose();
    newCtrl.dispose();
  }

  void _confirmSignOut(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(authProvider.notifier).logout();
    }
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
    child: Text(label.toUpperCase(),
        style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: Theme.of(context).colorScheme.onSurface.withOpacity(0.45))),
  );
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.label,
    this.trailing,
    this.onTap,
  });
  final IconData icon;
  final String   label;
  final Widget?  trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Container(
      width: 36, height: 36,
      decoration: BoxDecoration(
        color:        ShieldTheme.primary.withOpacity(0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(icon, size: 18, color: ShieldTheme.primary),
    ),
    title: Text(label, style: const TextStyle(fontSize: 14)),
    trailing: trailing ??
        (onTap != null
            ? const Icon(Icons.chevron_right, size: 18, color: Colors.grey)
            : null),
    onTap: onTap,
  );
}

class _ThemePill extends StatelessWidget {
  const _ThemePill({required this.current, required this.ref});
  final ThemeMode current;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      _pill(context, ThemeMode.system,  'System', Icons.brightness_auto),
      const SizedBox(width: 6),
      _pill(context, ThemeMode.light,   'Light',  Icons.light_mode_outlined),
      const SizedBox(width: 6),
      _pill(context, ThemeMode.dark,    'Dark',   Icons.dark_mode_outlined),
    ]);
  }

  Widget _pill(BuildContext ctx, ThemeMode mode, String label, IconData icon) {
    final selected = current == mode;
    return GestureDetector(
      onTap: () => ref.read(themeModeProvider.notifier).setMode(mode),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color:        selected ? ShieldTheme.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
              color: selected ? ShieldTheme.primary : Colors.grey.shade300),
        ),
        child: Icon(icon,
            size: 16,
            color: selected ? Colors.white : Colors.grey.shade600),
      ),
    );
  }
}
