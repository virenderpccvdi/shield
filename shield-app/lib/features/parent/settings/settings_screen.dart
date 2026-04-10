import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/theme_provider.dart';
import '../../../core/services/storage_service.dart';
import '../../../core/widgets/common_widgets.dart';

// ─────────────────────────────────────────────────────────────────────────────
// SettingsScreen — account, security, appearance, notifications, about.
// ─────────────────────────────────────────────────────────────────────────────

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth       = ref.watch(authProvider);
    final themeMode  = ref.watch(themeModeProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(children: [

        // ── Account card ──────────────────────────────────────────────────────
        _AccountCard(role: auth.role, onLogout: () => _logout(context, ref)),

        // ── Family & Devices ──────────────────────────────────────────────────
        const SectionHeader('Family & Devices'),
        _tile(
          icon:     Icons.people_outline,
          iconColor: ShieldTheme.primary,
          title:    'Manage Family',
          subtitle: 'Add, edit, or remove child profiles',
          onTap:    () => context.go('/parent/family'),
        ),
        _tile(
          icon:     Icons.tablet_android,
          iconColor: ShieldTheme.secondary,
          title:    'Set Up Child Device',
          subtitle: 'Install Shield protection on a child\'s phone',
          onTap:    () => context.push('/setup'),
        ),

        const Divider(),

        // ── Security ─────────────────────────────────────────────────────────
        const SectionHeader('Security'),
        _tile(
          icon:     Icons.lock_outline,
          iconColor: ShieldTheme.primary,
          title:    'Parent PIN',
          subtitle: 'Required to exit child mode on a child device',
          onTap:    () => _setupPin(context),
        ),
        _tile(
          icon:     Icons.fingerprint,
          iconColor: Colors.teal,
          title:    'Biometric Lock',
          subtitle: 'Use fingerprint / Face ID to open the app',
          trailing: Switch(
            value:    false,
            onChanged: (_) => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Biometric lock coming soon'))),
          ),
        ),

        const Divider(),

        // ── Appearance ────────────────────────────────────────────────────────
        const SectionHeader('Appearance'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Theme', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
            const SizedBox(height: 10),
            Row(children: [
              _ThemePill(
                label:    'System',
                icon:     Icons.brightness_auto,
                selected: themeMode == ThemeMode.system,
                onTap:    () => ref.read(themeModeProvider.notifier).setMode(ThemeMode.system),
              ),
              const SizedBox(width: 8),
              _ThemePill(
                label:    'Light',
                icon:     Icons.wb_sunny_outlined,
                selected: themeMode == ThemeMode.light,
                onTap:    () => ref.read(themeModeProvider.notifier).setMode(ThemeMode.light),
              ),
              const SizedBox(width: 8),
              _ThemePill(
                label:    'Dark',
                icon:     Icons.nightlight_outlined,
                selected: themeMode == ThemeMode.dark,
                onTap:    () => ref.read(themeModeProvider.notifier).setMode(ThemeMode.dark),
              ),
            ]),
          ]),
        ),

        const Divider(),

        // ── Notifications ─────────────────────────────────────────────────────
        const SectionHeader('Notifications'),
        _tile(
          icon:     Icons.notifications_active_outlined,
          iconColor: ShieldTheme.warning,
          title:    'Alert Notifications',
          subtitle: 'Receive push notifications for safety alerts',
          trailing: Switch(value: true, onChanged: (_) {}),
        ),
        _tile(
          icon:     Icons.location_on_outlined,
          iconColor: Colors.teal,
          title:    'Geofence Alerts',
          subtitle: 'Notify when a child enters or leaves a zone',
          trailing: Switch(value: true, onChanged: (_) {}),
        ),
        _tile(
          icon:     Icons.battery_alert_outlined,
          iconColor: const Color(0xFFC2410C),
          title:    'Battery Alerts',
          subtitle: 'Notify when a child\'s device battery is low',
          trailing: Switch(value: true, onChanged: (_) {}),
        ),

        const Divider(),

        // ── Active Sessions ───────────────────────────────────────────────────
        const _SessionsSection(),

        const Divider(),

        // ── Privacy & Data ────────────────────────────────────────────────────
        const SectionHeader('Privacy & Data'),
        _tile(
          icon:     Icons.history,
          iconColor: Colors.blueGrey,
          title:    'Activity Data Retention',
          subtitle: '30 days (default)',
          onTap:    () {},
        ),
        _tile(
          icon:     Icons.delete_outline,
          iconColor: ShieldTheme.danger,
          title:    'Clear Browsing History',
          subtitle: 'Delete all recorded activity data',
          onTap:    () => _confirmClearData(context),
        ),

        const Divider(),

        // ── About ─────────────────────────────────────────────────────────────
        const SectionHeader('About'),
        _tile(
          icon:     Icons.shield,
          iconColor: ShieldTheme.primary,
          title:    'Shield',
          subtitle: 'v${AppConstants.version} — Family Internet Protection',
        ),
        _tile(
          icon:     Icons.description_outlined,
          iconColor: Colors.blueGrey,
          title:    'Privacy Policy',
          trailing: const Icon(Icons.open_in_new, size: 16),
          onTap:    () => _openUrl('https://shield.rstglobal.in/privacy'),
        ),
        _tile(
          icon:     Icons.article_outlined,
          iconColor: Colors.blueGrey,
          title:    'Terms of Service',
          trailing: const Icon(Icons.open_in_new, size: 16),
          onTap:    () => _openUrl('https://shield.rstglobal.in/terms'),
        ),
        _tile(
          icon:     Icons.help_outline,
          iconColor: ShieldTheme.secondary,
          title:    'Help & Support',
          trailing: const Icon(Icons.open_in_new, size: 16),
          onTap:    () => _openUrl('https://shield.rstglobal.in/#contact'),
        ),

        const SizedBox(height: 40),
      ]),
    );
  }

  Widget _tile({
    required IconData icon,
    required Color    iconColor,
    required String   title,
    String?           subtitle,
    Widget?           trailing,
    VoidCallback?     onTap,
  }) => ListTile(
    leading: Container(
      width: 38, height: 38,
      decoration: BoxDecoration(
        color:        iconColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, color: iconColor, size: 20),
    ),
    title:    Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
    subtitle: subtitle != null
        ? Text(subtitle, style: const TextStyle(fontSize: 12)) : null,
    trailing: trailing ?? (onTap != null
        ? const Icon(Icons.chevron_right, size: 18) : null),
    onTap:    onTap,
  );

  void _logout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
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
    if (confirmed == true) {
      await ref.read(authProvider.notifier).logout();
      if (context.mounted) context.go('/login');
    }
  }

  void _setupPin(BuildContext context) async {
    final ctrl1 = TextEditingController();
    final ctrl2 = TextEditingController();
    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Set Parent PIN'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('This PIN protects your child\'s device from being unlocked.',
              style: TextStyle(fontSize: 13, color: Colors.black54)),
          const SizedBox(height: 16),
          TextField(
            controller:   ctrl1,
            keyboardType: TextInputType.number,
            obscureText:  true,
            maxLength:    6,
            decoration:   const InputDecoration(
                labelText: 'New PIN (4–6 digits)',
                prefixIcon: Icon(Icons.lock_outline)),
          ),
          TextField(
            controller:   ctrl2,
            keyboardType: TextInputType.number,
            obscureText:  true,
            maxLength:    6,
            decoration:   const InputDecoration(
                labelText: 'Confirm PIN',
                prefixIcon: Icon(Icons.lock_outline)),
          ),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final digitsOnly = RegExp(r'^\d+$');
              if (ctrl1.text.length >= 4 &&
                  digitsOnly.hasMatch(ctrl1.text) &&
                  ctrl1.text == ctrl2.text) {
                await StorageService.instance.setParentPin(ctrl1.text);
                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Parent PIN saved'),
                        backgroundColor: Colors.green));
                }
              } else if (context.mounted) {
                final msg = ctrl1.text != ctrl2.text
                    ? 'PINs do not match'
                    : !digitsOnly.hasMatch(ctrl1.text)
                        ? 'PIN must contain digits only'
                        : 'PIN must be at least 4 digits';
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(msg)));
              }
            },
            child: const Text('Save PIN'),
          ),
        ],
      ),
    );
    ctrl1.dispose();
    ctrl2.dispose();
  }

  void _confirmClearData(BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Clear Activity Data'),
        content: const Text(
            'This will permanently delete all browsing history and activity logs. '
            'This action cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Clear Data'),
          ),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      try {
        // Fetch children and delete their browsing history
        final childResp = await ApiClient.instance.get('/profiles/children');
        final raw = childResp.data is List
            ? childResp.data as List
            : (childResp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
        for (final c in raw) {
          final pid = (c as Map<String, dynamic>)['id']?.toString();
          if (pid != null) {
            try {
              await ApiClient.instance.delete('/analytics/$pid/history');
            } catch (_) {}
          }
        }
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Activity data cleared successfully'),
              backgroundColor: Colors.green,
            ));
        }
      } catch (_) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to clear data — try again')));
        }
      }
    }
  }

  void _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

// ── Account card ──────────────────────────────────────────────────────────────

class _AccountCard extends StatelessWidget {
  const _AccountCard({required this.role, required this.onLogout});
  final String?      role;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E40AF), Color(0xFF2563EB)],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(children: [
        CircleAvatar(
          radius:          26,
          backgroundColor: Colors.white24,
          child: Text(
            (role ?? 'P').substring(0, 1).toUpperCase(),
            style: const TextStyle(
                color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Signed In',
              style: TextStyle(
                  color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color:        Colors.white24,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              role ?? 'Parent',
              style: const TextStyle(
                  color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w500),
            ),
          ),
        ])),
        TextButton(
          onPressed: onLogout,
          style: TextButton.styleFrom(foregroundColor: Colors.white70),
          child: const Text('Sign Out',
              style: TextStyle(fontSize: 13)),
        ),
      ]),
    );
  }
}

// ── Theme pill ────────────────────────────────────────────────────────────────

class _ThemePill extends StatelessWidget {
  const _ThemePill({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });
  final String     label;
  final IconData   icon;
  final bool       selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Expanded(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color:        selected
              ? ShieldTheme.primary.withOpacity(0.12)
              : Colors.grey.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: selected
              ? Border.all(color: ShieldTheme.primary, width: 1.5)
              : Border.all(color: Colors.transparent),
        ),
        child: Column(children: [
          Icon(icon,
              size:  18,
              color: selected ? ShieldTheme.primary : Colors.grey),
          const SizedBox(height: 4),
          Text(label,
              style: TextStyle(
                fontSize:   11,
                fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                color:      selected ? ShieldTheme.primary : Colors.grey,
              )),
        ]),
      ),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Active Sessions section
// ─────────────────────────────────────────────────────────────────────────────

/// Simple data class representing one active auth session.
class _Session {
  const _Session({
    required this.id,
    required this.deviceName,
    required this.deviceType,
    required this.ipAddress,
    required this.lastActive,
  });

  final String id;
  final String deviceName;
  final String deviceType;   // "mobile" | "tablet" | "desktop" | "web"
  final String ipAddress;
  final DateTime lastActive;

  factory _Session.fromJson(Map<String, dynamic> j) => _Session(
    id:          j['id']?.toString() ?? '',
    deviceName:  j['deviceName']?.toString() ?? j['device_name']?.toString() ?? 'Unknown device',
    deviceType:  j['deviceType']?.toString() ?? j['device_type']?.toString() ?? 'mobile',
    ipAddress:   j['ipAddress']?.toString() ?? j['ip_address']?.toString() ?? '',
    lastActive:  j['lastActiveAt'] != null
        ? DateTime.tryParse(j['lastActiveAt'].toString()) ?? DateTime.now()
        : j['last_active_at'] != null
            ? DateTime.tryParse(j['last_active_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
  );
}

/// Stateful widget that loads and displays active sessions.
class _SessionsSection extends StatefulWidget {
  const _SessionsSection();

  @override
  State<_SessionsSection> createState() => _SessionsSectionState();
}

class _SessionsSectionState extends State<_SessionsSection> {
  List<_Session> _sessions = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    setState(() { _loading = true; _error = null; });
    try {
      final resp = await ApiClient.instance.get('/auth/sessions');
      final raw = resp.data;
      List<dynamic> list;
      if (raw is List) {
        list = raw;
      } else if (raw is Map<String, dynamic>) {
        list = (raw['data'] as List?) ?? (raw['sessions'] as List?) ?? [];
      } else {
        list = [];
      }
      if (mounted) {
        setState(() {
          _sessions = list
              .whereType<Map<String, dynamic>>()
              .map(_Session.fromJson)
              .toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() { _loading = false; _error = 'Could not load sessions'; });
    }
  }

  Future<void> _revokeSession(String sessionId) async {
    try {
      await ApiClient.instance.delete('/auth/sessions/$sessionId');
      if (mounted) {
        setState(() => _sessions.removeWhere((s) => s.id == sessionId));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Session revoked')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to revoke session — try again')));
      }
    }
  }

  Future<void> _signOutAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Sign Out All Devices'),
        content: const Text(
            'This will immediately sign out all devices including this one. '
            'You will need to log in again.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Ds.danger),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sign Out All'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ApiClient.instance.delete('/auth/sessions');
      if (mounted) {
        setState(() => _sessions.clear());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('All sessions signed out'),
            backgroundColor: Colors.green,
          ));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to sign out all devices — try again')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader('Active Sessions'),

        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Center(child: SizedBox(
              width: 20, height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )),
          )
        else if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
            child: Text(_error!,
                style: GoogleFonts.inter(fontSize: 13, color: Ds.onSurfaceVariant)),
          )
        else if (_sessions.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
            child: Text('No active sessions found.',
                style: GoogleFonts.inter(fontSize: 13, color: Ds.onSurfaceVariant)),
          )
        else
          ..._sessions.map((s) => _SessionTile(
            session: s,
            onRevoke: () => _revokeSession(s.id),
          )),

        ListTile(
          leading: Container(
            width: 38, height: 38,
            decoration: BoxDecoration(
              color:        Ds.danger.withOpacity(0.10),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.logout_rounded, color: Ds.danger, size: 20),
          ),
          title: Text(
            'Sign out all devices',
            style: GoogleFonts.inter(
              fontSize: 14, color: Ds.danger, fontWeight: FontWeight.w600),
          ),
          onTap: _signOutAll,
        ),
      ],
    );
  }
}

/// A single row representing one session with a revoke button.
class _SessionTile extends StatelessWidget {
  const _SessionTile({required this.session, required this.onRevoke});

  final _Session    session;
  final VoidCallback onRevoke;

  IconData _iconForType(String type) {
    switch (type.toLowerCase()) {
      case 'tablet':  return Icons.tablet_android;
      case 'desktop': return Icons.computer;
      case 'web':     return Icons.language;
      default:        return Icons.smartphone;
    }
  }

  String _formatAge(DateTime lastActive) {
    final diff = DateTime.now().difference(lastActive);
    if (diff.inMinutes < 1)  return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24)   return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 38, height: 38,
        decoration: BoxDecoration(
          color:        Ds.primary.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(_iconForType(session.deviceType),
            color: Ds.primary, size: 20),
      ),
      title: Text(
        session.deviceName,
        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500),
      ),
      subtitle: Text(
        '${session.ipAddress}  ·  ${_formatAge(session.lastActive)}',
        style: GoogleFonts.inter(fontSize: 12, color: Ds.onSurfaceVariant),
      ),
      trailing: TextButton(
        onPressed: onRevoke,
        style: TextButton.styleFrom(
          foregroundColor: Ds.danger,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: Text('Revoke',
            style: GoogleFonts.inter(
                fontSize: 13, fontWeight: FontWeight.w600, color: Ds.danger)),
      ),
    );
  }
}
