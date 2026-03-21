import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/auth_state.dart';
import '../../core/api_client.dart';
import '../../core/biometric_service.dart';
import '../../core/theme_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  Map<String, dynamic>? _sub;
  bool _loadingSub = true;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;

  @override
  void initState() {
    super.initState();
    _loadSubscription();
    _loadBiometricState();
  }

  Future<void> _loadBiometricState() async {
    final available = await BiometricService.isAvailable();
    final enabled = await BiometricService.isEnabled();
    if (mounted) setState(() { _biometricAvailable = available; _biometricEnabled = enabled; });
  }

  Future<void> _loadSubscription() async {
    try {
      final res = await ref.read(dioProvider).get('/billing/my/subscription');
      if (mounted) setState(() { _sub = res.data['data']; _loadingSub = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingSub = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings', style: TextStyle(fontWeight: FontWeight.w700))),
      body: ListView(
        children: [
          // Profile header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF1565C0), Color(0xFF1976D2)],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
            ),
            child: Row(children: [
              CircleAvatar(
                radius: 30,
                backgroundColor: Colors.white,
                child: Text((auth.name ?? 'U')[0].toUpperCase(),
                  style: const TextStyle(color: Color(0xFF1565C0), fontWeight: FontWeight.w800, fontSize: 24)),
              ),
              const SizedBox(width: 16),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(auth.name ?? 'User', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 18)),
                Text(auth.email ?? '', style: const TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(12)),
                  child: Text(_loadingSub ? '...' : (_sub?['planName'] ?? 'Free Plan'),
                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                ),
              ])),
            ]),
          ),

          const SizedBox(height: 8),
          _SectionHeader('Account'),
          _SettingsTile(icon: Icons.person_outline, title: 'Edit Profile', subtitle: 'Update name and email',
            onTap: () => _showEditProfile(context, auth)),
          _SettingsTile(icon: Icons.lock_outline, title: 'Change Password', subtitle: 'Update your password',
            onTap: () => _showChangePassword(context)),
          _SettingsTile(icon: Icons.security_outlined, title: 'Two-Factor Authentication', subtitle: 'Enable TOTP for extra security',
            onTap: () => _launchWeb(context, 'settings')),
          _SettingsTile(icon: Icons.group_add_rounded, title: 'Family Members', subtitle: 'Invite co-parents and manage family access',
            onTap: () => context.go('/family/members')),
          if (_biometricAvailable)
            SwitchListTile(
              secondary: const Icon(Icons.fingerprint, color: Color(0xFF1565C0)),
              title: const Text('Biometric Unlock', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              subtitle: const Text('Use fingerprint or face to unlock app', style: TextStyle(fontSize: 12)),
              value: _biometricEnabled,
              onChanged: (val) async {
                await BiometricService.setEnabled(val);
                if (mounted) {
                  setState(() => _biometricEnabled = val);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Biometric unlock ${val ? 'enabled' : 'disabled'}')),
                  );
                }
              },
            ),

          const Divider(height: 1),
          _SectionHeader('Notifications'),
          _SettingsTile(icon: Icons.notifications_outlined, title: 'Alert Preferences', subtitle: 'DNS blocks, geofence, SOS alerts',
            onTap: () => _showNotificationPrefs(context)),
          _SettingsTile(icon: Icons.do_not_disturb_outlined, title: 'Quiet Hours', subtitle: 'Silence notifications at night',
            onTap: () => _showQuietHours(context)),

          const Divider(height: 1),
          _SectionHeader('Subscription'),
          if (_loadingSub)
            const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))
          else ...[
            if (_sub != null)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1565C0).withAlpha(10),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF1565C0).withAlpha(40)),
                ),
                child: Row(children: [
                  const Icon(Icons.card_membership, color: Color(0xFF1565C0)),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_sub!['planName'] ?? 'Plan', style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text(
                      _sub!['status'] == 'ACTIVE' ? 'Active — renews ${_fmtDate(_sub!['currentPeriodEnd'])}' : (_sub!['status'] ?? ''),
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                    ),
                  ])),
                  TextButton(onPressed: () => _launchWeb(context, 'subscription'), child: const Text('Manage')),
                ]),
              ),
            _SettingsTile(icon: Icons.receipt_long_outlined, title: 'Invoices', subtitle: 'View and download billing history',
              onTap: () => _launchWeb(context, 'subscription')),
            _SettingsTile(icon: Icons.upgrade_outlined, title: 'Upgrade Plan', subtitle: 'Unlock more features',
              onTap: () => _launchWeb(context, 'subscription')),
          ],

          const Divider(height: 1),
          _SectionHeader('App'),
          _DarkModeTile(),
          _SettingsTile(icon: Icons.router_outlined, title: 'Router Setup', subtitle: 'Configure your home router DNS',
            onTap: () => _showRouterSetup(context)),
          _SettingsTile(icon: Icons.help_outline, title: 'Help & Support', subtitle: 'FAQ and contact',
            onTap: () => _launchWeb(context, '')),
          _SettingsTile(icon: Icons.info_outline, title: 'About Shield', subtitle: 'Version 1.0.0',
            onTap: () => showAboutDialog(context: context, applicationName: 'Shield', applicationVersion: '1.0.0',
              applicationIcon: const Icon(Icons.shield, color: Color(0xFF1565C0), size: 40),
              children: [const Text('Family Internet Protection powered by AI.')])),

          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Sign Out', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w600)),
            onTap: () async {
              final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
                title: const Text('Sign Out'),
                content: const Text('Are you sure you want to sign out?'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                  FilledButton(onPressed: () => Navigator.pop(ctx, true),
                    style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('Sign Out')),
                ],
              ));
              if (ok == true && context.mounted) {
                await ref.read(authProvider.notifier).logout();
                context.go('/login');
              }
            },
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  void _showEditProfile(BuildContext context, AuthState auth) {
    final nameCtrl = TextEditingController(text: auth.name);
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Edit Profile'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextFormField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Full Name')),
        const SizedBox(height: 8),
        Text(auth.email ?? '', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(onPressed: () async {
          Navigator.pop(ctx);
          try {
            await ref.read(dioProvider).put('/auth/me', data: {'name': nameCtrl.text});
            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile updated')));
          } catch (e) {
            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
          }
        }, child: const Text('Save')),
      ],
    ));
  }

  void _showChangePassword(BuildContext context) {
    final oldCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Change Password'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: oldCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Current Password')),
        const SizedBox(height: 12),
        TextField(controller: newCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'New Password')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(onPressed: () async {
          Navigator.pop(ctx);
          try {
            await ref.read(dioProvider).put('/auth/change-password',
              data: {'currentPassword': oldCtrl.text, 'newPassword': newCtrl.text});
            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password changed')));
          } catch (e) {
            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
          }
        }, child: const Text('Change')),
      ],
    ));
  }

  void _showNotificationPrefs(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    final dnsAlerts = prefs.getBool('notif_dns') ?? true;
    final geoAlerts = prefs.getBool('notif_geo') ?? true;
    final sosAlerts = prefs.getBool('notif_sos') ?? true;
    final weeklyDigest = prefs.getBool('notif_weekly') ?? false;

    if (!context.mounted) return;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(
        builder: (ctx, setState) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Alert Preferences', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            const SizedBox(height: 8),
            SwitchListTile(title: const Text('DNS Block Alerts'), subtitle: const Text('Notify when content is blocked'),
              value: dnsAlerts, onChanged: (v) { setState(() {}); prefs.setBool('notif_dns', v); }),
            SwitchListTile(title: const Text('Geofence Alerts'), subtitle: const Text('Notify on zone entry/exit'),
              value: geoAlerts, onChanged: (v) { setState(() {}); prefs.setBool('notif_geo', v); }),
            SwitchListTile(title: const Text('SOS Panic Alerts'), subtitle: const Text('High-priority SOS notifications'),
              value: sosAlerts, onChanged: (v) { setState(() {}); prefs.setBool('notif_sos', v); }),
            SwitchListTile(title: const Text('Weekly Report Email'), subtitle: const Text('Digest every Monday 8 AM'),
              value: weeklyDigest, onChanged: (v) { setState(() {}); prefs.setBool('notif_weekly', v); }),
            const SizedBox(height: 12),
            SizedBox(width: double.infinity, child: FilledButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Done'),
            )),
          ]),
        ),
      ),
    );
  }

  void _showQuietHours(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    final fromCtrl = TextEditingController(text: prefs.getString('quiet_from') ?? '22:00');
    final toCtrl = TextEditingController(text: prefs.getString('quiet_to') ?? '07:00');
    if (!context.mounted) return;
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Quiet Hours'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('Notifications will be silenced during these hours.', style: TextStyle(fontSize: 13)),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: TextField(controller: fromCtrl, decoration: const InputDecoration(labelText: 'From', hintText: '22:00'))),
          const SizedBox(width: 16),
          Expanded(child: TextField(controller: toCtrl, decoration: const InputDecoration(labelText: 'To', hintText: '07:00'))),
        ]),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(onPressed: () async {
          await prefs.setString('quiet_from', fromCtrl.text);
          await prefs.setString('quiet_to', toCtrl.text);
          if (ctx.mounted) Navigator.pop(ctx);
          if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Quiet hours saved')));
        }, child: const Text('Save')),
      ],
    ));
  }

  void _showRouterSetup(BuildContext context) {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Router Setup'),
      content: const SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Point your router\'s DNS to:', style: TextStyle(fontWeight: FontWeight.w600)),
        SizedBox(height: 12),
        Text('Primary:', style: TextStyle(fontSize: 12, color: Colors.grey)),
        SelectableText('shield.rstglobal.in', style: TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w700)),
        SizedBox(height: 12),
        Text('Or configure each child\'s device with their personal DoH URL (found in Family → child profile).',
          style: TextStyle(fontSize: 12)),
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))],
    ));
  }

  Future<void> _launchWeb(BuildContext context, String path) async {
    final uri = Uri.parse('https://shield.rstglobal.in/app${path.isNotEmpty ? '/$path' : ''}');
    if (await canLaunchUrl(uri)) {
      launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  String _fmtDate(dynamic val) {
    if (val == null) return '';
    try { return val.toString().split('T').first; } catch (_) { return ''; }
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
    child: Text(title.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Colors.grey, letterSpacing: 1)),
  );
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  const _SettingsTile({required this.icon, required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Icon(icon, color: const Color(0xFF1565C0)),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
    subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
    trailing: const Icon(Icons.chevron_right, color: Colors.grey, size: 18),
    onTap: onTap,
  );
}

class _DarkModeTile extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final isDark = mode == ThemeMode.dark ||
        (mode == ThemeMode.system &&
            MediaQuery.platformBrightnessOf(context) == Brightness.dark);
    return SwitchListTile(
      secondary: Icon(
        isDark ? Icons.dark_mode : Icons.light_mode,
        color: const Color(0xFF1565C0),
      ),
      title: const Text('Dark Mode',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      subtitle: Text(
        mode == ThemeMode.system ? 'Using system setting' : (isDark ? 'On' : 'Off'),
        style: const TextStyle(fontSize: 12),
      ),
      value: isDark,
      onChanged: (_) => ref.read(themeModeProvider.notifier).toggle(),
    );
  }
}

class _PrefTile extends StatefulWidget {
  final String title, subtitle;
  final bool initial;
  const _PrefTile(this.title, this.subtitle, this.initial);

  @override
  State<_PrefTile> createState() => _PrefTileState();
}

class _PrefTileState extends State<_PrefTile> {
  late bool _val;

  @override
  void initState() { super.initState(); _val = widget.initial; }

  @override
  Widget build(BuildContext context) => SwitchListTile(
    title: Text(widget.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
    subtitle: Text(widget.subtitle, style: const TextStyle(fontSize: 12)),
    value: _val, onChanged: (v) => setState(() => _val = v),
  );
}
