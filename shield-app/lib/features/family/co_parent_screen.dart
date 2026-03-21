import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';

// ── Provider ─────────────────────────────────────────────────────────────────

final familyMembersProvider = FutureProvider.autoDispose<_FamilyData>((ref) async {
  final client = ref.read(dioProvider);
  try {
    final res = await client.get('/profiles/family');
    final raw = res.data['data'];
    final list = raw is List ? raw : <dynamic>[];

    final members = <Map<String, dynamic>>[];
    final invites  = <Map<String, dynamic>>[];

    for (final item in list) {
      final m = item as Map<String, dynamic>;
      // Invites have an 'email' field; members have a 'userId' field
      if (m.containsKey('email')) {
        invites.add(m);
      } else {
        members.add(m);
      }
    }

    return _FamilyData(members: members, invites: invites);
  } catch (e) {
    rethrow;
  }
});

class _FamilyData {
  final List<Map<String, dynamic>> members;
  final List<Map<String, dynamic>> invites;
  const _FamilyData({required this.members, required this.invites});
}

// ── Screen ───────────────────────────────────────────────────────────────────

class CoParentScreen extends ConsumerStatefulWidget {
  const CoParentScreen({super.key});

  @override
  ConsumerState<CoParentScreen> createState() => _CoParentScreenState();
}

class _CoParentScreenState extends ConsumerState<CoParentScreen> {
  bool _inviting = false;

  Future<void> _showInviteDialog() async {
    final emailCtrl = TextEditingController();
    String role = 'CO_PARENT';
    final formKey = GlobalKey<FormState>();

    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: ShieldTheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.group_add_rounded, color: ShieldTheme.primary, size: 20),
            ),
            const SizedBox(width: 12),
            const Text('Invite Co-Parent', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          ]),
          content: Form(
            key: formKey,
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text(
                'They will receive an invite link to join your family and help manage your children\'s settings.',
                style: TextStyle(fontSize: 13, color: ShieldTheme.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Email address',
                  hintText: 'partner@example.com',
                  prefixIcon: const Icon(Icons.email_outlined, size: 18),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Email is required';
                  if (!RegExp(r'^[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}$').hasMatch(v.trim())) return 'Enter a valid email';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: role,
                decoration: InputDecoration(
                  labelText: 'Role',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                items: const [
                  DropdownMenuItem(value: 'CO_PARENT', child: Text('Co-Parent — Full access')),
                  DropdownMenuItem(value: 'OBSERVER',  child: Text('Observer — View only')),
                ],
                onChanged: (v) {
                  if (v != null) setDialogState(() => role = v);
                },
              ),
            ]),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton.icon(
              icon: const Icon(Icons.send_rounded, size: 16),
              label: const Text('Send Invite'),
              style: FilledButton.styleFrom(
                backgroundColor: ShieldTheme.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () {
                if (formKey.currentState!.validate()) {
                  Navigator.pop(ctx, {'email': emailCtrl.text.trim(), 'role': role});
                }
              },
            ),
          ],
        ),
      ),
    );

    if (result == null || !mounted) return;
    await _sendInvite(result['email']!, result['role']!);
  }

  Future<void> _sendInvite(String email, String role) async {
    setState(() => _inviting = true);
    try {
      await ref.read(dioProvider).post('/profiles/family/invite', data: {
        'email': email,
        'role': role,
      });
      ref.invalidate(familyMembersProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Invite sent to $email'),
          backgroundColor: ShieldTheme.success,
          behavior: SnackBarBehavior.floating,
        ));
      }
    } on DioException catch (e) {
      if (mounted) {
        final msg = e.response?.data?['message'] ?? 'Failed to send invite';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(msg),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
        ));
      }
    } finally {
      if (mounted) setState(() => _inviting = false);
    }
  }

  Future<void> _cancelInvite(Map<String, dynamic> invite) async {
    final email = invite['email'] as String? ?? 'this person';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Cancel Invite', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Text('Cancel the pending invite to $email?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: ShieldTheme.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel Invite'),
          ),
        ],
      ),
    );

    if (ok != true || !mounted) return;

    try {
      await ref.read(dioProvider).delete('/profiles/family/invites/${invite['id']}');
      ref.invalidate(familyMembersProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Invite to $email cancelled'),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } on DioException catch (e) {
      if (mounted) {
        final msg = e.response?.data?['message'] ?? 'Failed to cancel invite';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(msg),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
        ));
      }
    }
  }

  Future<void> _removeMember(Map<String, dynamic> member) async {
    final name = member['userId']?.toString().substring(0, 8) ?? 'this member';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Remove Member', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Text('Remove $name from your family? They will lose access to your children\'s settings.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: ShieldTheme.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );

    if (ok != true || !mounted) return;

    try {
      await ref.read(dioProvider).delete('/profiles/family/${member['id']}');
      ref.invalidate(familyMembersProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Family member removed'),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } on DioException catch (e) {
      if (mounted) {
        final msg = e.response?.data?['message'] ?? 'Failed to remove member';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(msg),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final familyAsync = ref.watch(familyMembersProvider);

    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('Family Members', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(familyMembersProvider),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _inviting ? null : _showInviteDialog,
        icon: _inviting
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.group_add_rounded),
        label: const Text('Invite Co-Parent'),
        backgroundColor: ShieldTheme.primary,
        foregroundColor: Colors.white,
        elevation: 2,
      ),
      body: familyAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorState(onRetry: () => ref.invalidate(familyMembersProvider)),
        data: (data) => RefreshIndicator(
          onRefresh: () => ref.refresh(familyMembersProvider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
            children: [
              // ── Info banner ──────────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: ShieldTheme.primaryGradient,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.family_restroom_rounded, color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(
                      '${data.members.length} ${data.members.length == 1 ? 'member' : 'members'}'
                      '${data.invites.isNotEmpty ? ' · ${data.invites.length} pending' : ''}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
                    ),
                    const Text(
                      'Invite a partner or guardian to co-manage your family',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ])),
                ]),
              ),

              // ── Active members ───────────────────────────────────────────
              if (data.members.isNotEmpty) ...[
                const SizedBox(height: 20),
                _SectionLabel('Active Members'),
                const SizedBox(height: 8),
                ...data.members.map((m) => _MemberCard(
                  member: m,
                  onRemove: m['role'] == 'GUARDIAN' ? null : () => _removeMember(m),
                )),
              ],

              // ── Pending invites ──────────────────────────────────────────
              if (data.invites.isNotEmpty) ...[
                const SizedBox(height: 20),
                _SectionLabel('Pending Invites'),
                const SizedBox(height: 8),
                ...data.invites.map((inv) => _InviteCard(
                  invite: inv,
                  onCancel: () => _cancelInvite(inv),
                )),
              ],

              // ── Empty state ──────────────────────────────────────────────
              if (data.members.isEmpty && data.invites.isEmpty)
                _EmptyState(onInvite: _showInviteDialog),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Member card ───────────────────────────────────────────────────────────────

class _MemberCard extends StatelessWidget {
  final Map<String, dynamic> member;
  final VoidCallback? onRemove;
  const _MemberCard({required this.member, this.onRemove});

  static const _roleColors = {
    'GUARDIAN':  Color(0xFF1565C0),
    'CO_PARENT': Color(0xFF1565C0),
    'OBSERVER':  Color(0xFF00695C),
  };

  @override
  Widget build(BuildContext context) {
    final role = (member['role'] as String? ?? 'CO_PARENT').toUpperCase();
    final userId = member['userId']?.toString() ?? '';
    final initial = userId.isNotEmpty ? userId[0].toUpperCase() : 'U';
    final color = _roleColors[role] ?? ShieldTheme.primary;
    final isGuardian = role == 'GUARDIAN';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ShieldTheme.divider),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: color.withValues(alpha: 0.12),
            child: Text(initial, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 16)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              isGuardian ? 'You (Guardian)' : 'Member',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
            ),
            const SizedBox(height: 2),
            Text(
              'ID: ${userId.length > 12 ? '${userId.substring(0, 12)}...' : userId}',
              style: const TextStyle(fontSize: 11, color: ShieldTheme.textSecondary),
            ),
          ])),
          _RoleBadge(role: role, color: color),
          if (onRemove != null) ...[
            const SizedBox(width: 8),
            IconButton(
              icon: const Icon(Icons.person_remove_rounded, color: ShieldTheme.danger, size: 20),
              tooltip: 'Remove member',
              onPressed: onRemove,
            ),
          ],
        ]),
      ),
    );
  }
}

// ── Invite card ───────────────────────────────────────────────────────────────

class _InviteCard extends StatelessWidget {
  final Map<String, dynamic> invite;
  final VoidCallback onCancel;
  const _InviteCard({required this.invite, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    final email = invite['email'] as String? ?? '';
    final role  = (invite['role'] as String? ?? 'CO_PARENT').toUpperCase();
    final initial = email.isNotEmpty ? email[0].toUpperCase() : '?';
    final expiresAt = invite['expiresAt'] as String?;

    String? expiryLabel;
    if (expiresAt != null) {
      try {
        final expiry = DateTime.parse(expiresAt).toLocal();
        final diff = expiry.difference(DateTime.now());
        if (diff.inDays > 0) {
          expiryLabel = 'Expires in ${diff.inDays}d';
        } else if (diff.inHours > 0) {
          expiryLabel = 'Expires in ${diff.inHours}h';
        } else {
          expiryLabel = 'Expiring soon';
        }
      } catch (_) {}
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFFF3E0)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: const Color(0xFFFFF3E0),
            child: Text(initial, style: const TextStyle(color: Color(0xFFF57C00), fontWeight: FontWeight.w800, fontSize: 16)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(email, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const SizedBox(height: 2),
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF8E1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('Pending', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFFF57C00))),
              ),
              if (expiryLabel != null) ...[
                const SizedBox(width: 6),
                Text(expiryLabel, style: const TextStyle(fontSize: 11, color: ShieldTheme.textSecondary)),
              ],
            ]),
          ])),
          _RoleBadge(role: role, color: const Color(0xFF1565C0)),
          const SizedBox(width: 6),
          TextButton.icon(
            icon: const Icon(Icons.cancel_outlined, size: 14),
            label: const Text('Cancel', style: TextStyle(fontSize: 12)),
            style: TextButton.styleFrom(
              foregroundColor: ShieldTheme.danger,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            onPressed: onCancel,
          ),
        ]),
      ),
    );
  }
}

// ── Role badge ────────────────────────────────────────────────────────────────

class _RoleBadge extends StatelessWidget {
  final String role;
  final Color color;
  const _RoleBadge({required this.role, required this.color});

  String _label(String r) {
    switch (r) {
      case 'GUARDIAN':  return 'Guardian';
      case 'CO_PARENT': return 'Co-Parent';
      case 'OBSERVER':  return 'Observer';
      default: return r;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        _label(role),
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

// ── Section label ─────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(left: 4),
    child: Text(text.toUpperCase(),
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: ShieldTheme.textSecondary, letterSpacing: 1)),
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final VoidCallback onInvite;
  const _EmptyState({required this.onInvite});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 60),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: BoxDecoration(
          color: ShieldTheme.primary.withValues(alpha: 0.08),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.group_add_rounded, size: 40, color: ShieldTheme.primary),
      ),
      const SizedBox(height: 18),
      const Text('No co-parents yet',
        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: ShieldTheme.textPrimary)),
      const SizedBox(height: 8),
      const Text(
        'Invite your partner or another trusted adult\nto help manage your children\'s settings.',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 13, color: ShieldTheme.textSecondary, height: 1.5),
      ),
      const SizedBox(height: 24),
      FilledButton.icon(
        onPressed: onInvite,
        icon: const Icon(Icons.group_add_rounded),
        label: const Text('Invite Co-Parent'),
        style: FilledButton.styleFrom(
          backgroundColor: ShieldTheme.primary,
          minimumSize: const Size(200, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    ]),
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    const Icon(Icons.wifi_off_rounded, size: 56, color: ShieldTheme.textSecondary),
    const SizedBox(height: 14),
    const Text('Could not load family data', style: TextStyle(fontWeight: FontWeight.w600)),
    const SizedBox(height: 16),
    TextButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Retry')),
  ]));
}
