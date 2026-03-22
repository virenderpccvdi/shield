import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

// ── Providers ────────────────────────────────────────────────────────────────

final _childProfilesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  try {
    final res = await ref.read(dioProvider).get('/profiles/children');
    final d = res.data['data'];
    List<dynamic> raw;
    if (d is List) {
      raw = d;
    } else if (d is Map) {
      raw = (d['content'] ?? d['items'] ?? []) as List;
    } else {
      raw = [];
    }
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  } catch (_) {
    return [];
  }
});

// ── Screen ───────────────────────────────────────────────────────────────────

/// PS-01: Location Share Screen
///
/// Parent creates and manages shareable location links for each child profile.
/// Each link has a label, configurable TTL, view count, and can be revoked.
class LocationShareScreen extends ConsumerStatefulWidget {
  /// Pre-selected profileId — optional. If null, profile selector is shown.
  final String? profileId;
  const LocationShareScreen({super.key, this.profileId});

  @override
  ConsumerState<LocationShareScreen> createState() => _LocationShareScreenState();
}

class _LocationShareScreenState extends ConsumerState<LocationShareScreen> {
  String? _selectedProfileId;
  List<Map<String, dynamic>> _shares = [];
  bool _loadingShares = false;

  @override
  void initState() {
    super.initState();
    _selectedProfileId = widget.profileId;
    if (_selectedProfileId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadShares());
    }
  }

  Future<void> _loadShares() async {
    final pid = _selectedProfileId;
    if (pid == null || pid.isEmpty) return;
    setState(() => _loadingShares = true);
    try {
      final res = await ref.read(dioProvider).get('/location/shares/$pid');
      final raw = res.data['data'];
      List<dynamic> list;
      if (raw is List) {
        list = raw;
      } else if (raw is Map) {
        list = (raw['content'] ?? raw['items'] ?? raw['shares'] ?? []) as List;
      } else {
        list = [];
      }
      if (mounted) {
        setState(() {
          _shares = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          _loadingShares = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loadingShares = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not load shares: $e'),
            backgroundColor: ShieldTheme.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    }
  }

  Future<void> _revokeShare(String shareId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Revoke Share Link'),
        content: const Text('This link will stop working immediately. Continue?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: ShieldTheme.danger,
              minimumSize: const Size(80, 40),
            ),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      await ref.read(dioProvider).delete('/location/shares/$shareId');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Share link revoked'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      await _loadShares();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to revoke: $e'),
            backgroundColor: ShieldTheme.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    }
  }

  void _showCreateSheet(BuildContext context) {
    final pid = _selectedProfileId;
    if (pid == null || pid.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a child profile first')),
      );
      return;
    }
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _CreateShareSheet(
        profileId: pid,
        onCreated: () => _loadShares(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final profilesAsync = ref.watch(_childProfilesProvider);

    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('Share Location', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          if (_selectedProfileId != null)
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              tooltip: 'Refresh',
              onPressed: _loadShares,
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateSheet(context),
        icon: const Icon(Icons.add_link_rounded),
        label: const Text('New Share Link'),
        backgroundColor: ShieldTheme.primary,
        foregroundColor: Colors.white,
      ),
      body: profilesAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 2),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 3),
          ]),
        ),
        error: (_, __) => const Center(child: Text('Could not load profiles')),
        data: (profiles) {
          // Auto-select first profile if only one exists
          if (_selectedProfileId == null && profiles.length == 1) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) {
                setState(() => _selectedProfileId = profiles[0]['id']?.toString());
                _loadShares();
              }
            });
          }

          return RefreshIndicator(
            onRefresh: _loadShares,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
              children: [
                // ── Profile selector ──────────────────────────────────
                if (profiles.length > 1) ...[
                  _SectionLabel(label: 'Select Child'),
                  const SizedBox(height: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: ShieldTheme.cardBg,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: ShieldTheme.divider),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedProfileId,
                        isExpanded: true,
                        hint: const Text('Choose a child'),
                        items: profiles.map((p) {
                          final id = p['id']?.toString() ?? '';
                          final name = p['name']?.toString() ?? 'Child';
                          return DropdownMenuItem(value: id, child: Text(name));
                        }).toList(),
                        onChanged: (v) {
                          setState(() {
                            _selectedProfileId = v;
                            _shares = [];
                          });
                          if (v != null) _loadShares();
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // ── Info banner ───────────────────────────────────────
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: ShieldTheme.primary.withOpacity(0.07),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: ShieldTheme.primary.withOpacity(0.2)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline_rounded,
                          color: ShieldTheme.primary, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Share a temporary link so trusted contacts can see your child\'s '
                          'live location without needing an account. Links expire automatically.',
                          style: TextStyle(
                            fontSize: 13,
                            color: ShieldTheme.primary,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // ── Active shares ─────────────────────────────────────
                _SectionLabel(label: 'Active Share Links'),
                const SizedBox(height: 10),

                if (_selectedProfileId == null)
                  _EmptySharesPlaceholder(
                    message: profiles.isEmpty
                        ? 'No child profiles found. Add a child first.'
                        : 'Select a child above to view their share links.',
                    icon: Icons.person_search_rounded,
                  )
                else if (_loadingShares)
                  const Column(children: [
                    ShieldCardSkeleton(lines: 3),
                    SizedBox(height: 10),
                    ShieldCardSkeleton(lines: 3),
                  ])
                else if (_shares.isEmpty)
                  _EmptySharesPlaceholder(
                    message: 'No active share links. Tap + New Share Link to create one.',
                    icon: Icons.link_off_rounded,
                  )
                else
                  ...(_shares.map((share) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ShareCard(
                      share: share,
                      onRevoke: () => _revokeShare(share['id']?.toString() ?? ''),
                    ),
                  ))),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Create Share Bottom Sheet ─────────────────────────────────────────────────

class _CreateShareSheet extends ConsumerStatefulWidget {
  final String profileId;
  final VoidCallback onCreated;
  const _CreateShareSheet({required this.profileId, required this.onCreated});

  @override
  ConsumerState<_CreateShareSheet> createState() => _CreateShareSheetState();
}

class _CreateShareSheetState extends ConsumerState<_CreateShareSheet> {
  final _labelController = TextEditingController();
  int _durationHours = 24;
  bool _creating = false;

  static const _durations = [
    (label: '1 hour',  hours: 1),
    (label: '6 hours', hours: 6),
    (label: '24 hours', hours: 24),
    (label: '3 days',  hours: 72),
    (label: '7 days',  hours: 168),
  ];

  @override
  void dispose() {
    _labelController.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    setState(() => _creating = true);
    try {
      await ref.read(dioProvider).post(
        '/location/shares',
        data: {
          'profileId': widget.profileId,
          'label': _labelController.text.trim(),
          'durationHours': _durationHours,
        },
      );
      if (mounted) {
        Navigator.pop(context);
        widget.onCreated();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Share link created'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _creating = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to create link: $e'),
            backgroundColor: ShieldTheme.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 24 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: ShieldTheme.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Title
          Row(children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: ShieldTheme.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.add_link_rounded, color: ShieldTheme.primary, size: 20),
            ),
            const SizedBox(width: 12),
            const Text('Create Share Link',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18,
                    color: ShieldTheme.textPrimary)),
          ]),
          const SizedBox(height: 20),

          // Label field
          const Text('Label (optional)',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13,
                  color: ShieldTheme.textSecondary)),
          const SizedBox(height: 6),
          TextField(
            controller: _labelController,
            maxLength: 50,
            decoration: const InputDecoration(
              hintText: 'e.g. For Grandma',
              counterText: '',
            ),
          ),
          const SizedBox(height: 20),

          // Duration selector
          const Text('Link Duration',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13,
                  color: ShieldTheme.textSecondary)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: _durations.map((d) {
              final selected = _durationHours == d.hours;
              return ChoiceChip(
                label: Text(d.label),
                selected: selected,
                onSelected: (_) => setState(() => _durationHours = d.hours),
                selectedColor: ShieldTheme.primary,
                labelStyle: TextStyle(
                  color: selected ? Colors.white : ShieldTheme.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
                backgroundColor: ShieldTheme.surface,
                side: BorderSide(
                  color: selected ? ShieldTheme.primary : ShieldTheme.divider,
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),

          // Create button
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _creating ? null : _create,
              icon: _creating
                  ? const SizedBox(
                      width: 18, height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.link_rounded),
              label: Text(_creating ? 'Creating…' : 'Create Link'),
              style: FilledButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Share Card ────────────────────────────────────────────────────────────────

class _ShareCard extends StatelessWidget {
  final Map<String, dynamic> share;
  final VoidCallback onRevoke;
  const _ShareCard({required this.share, required this.onRevoke});

  String _formatExpiry(String? isoStr) {
    if (isoStr == null || isoStr.isEmpty) return 'Unknown expiry';
    try {
      final dt = DateTime.parse(isoStr).toLocal();
      final now = DateTime.now();
      final diff = dt.difference(now);
      if (diff.isNegative) return 'Expired';
      if (diff.inHours < 1) return 'Expires in ${diff.inMinutes}m';
      if (diff.inHours < 24) return 'Expires in ${diff.inHours}h ${diff.inMinutes % 60}m';
      return 'Expires ${DateFormat('MMM d, h:mm a').format(dt)}';
    } catch (_) {
      return isoStr;
    }
  }

  void _copyUrl(BuildContext context, String url) {
    Clipboard.setData(ClipboardData(text: url));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Row(children: [
          Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
          SizedBox(width: 8),
          Text('Link copied!'),
        ]),
        behavior: SnackBarBehavior.floating,
        backgroundColor: ShieldTheme.success,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final label = share['label']?.toString().isNotEmpty == true
        ? share['label'].toString()
        : 'Unnamed link';
    final url = share['shareUrl']?.toString() ?? share['url']?.toString() ?? '';
    final expiresAt = share['expiresAt']?.toString() ?? share['expiry']?.toString();
    final viewCount = share['viewCount'] ?? share['views'] ?? 0;
    final shareId = share['id']?.toString() ?? '';
    final expiryStr = _formatExpiry(expiresAt);
    final expired = expiryStr == 'Expired';

    return Container(
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: expired ? ShieldTheme.danger.withOpacity(0.3) : ShieldTheme.divider,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 12, 0),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: expired
                        ? ShieldTheme.danger.withOpacity(0.1)
                        : ShieldTheme.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    expired ? Icons.link_off_rounded : Icons.link_rounded,
                    color: expired ? ShieldTheme.danger : ShieldTheme.primary,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: ShieldTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(children: [
                        Icon(
                          Icons.access_time_rounded,
                          size: 12,
                          color: expired ? ShieldTheme.danger : ShieldTheme.textSecondary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          expiryStr,
                          style: TextStyle(
                            fontSize: 12,
                            color: expired ? ShieldTheme.danger : ShieldTheme.textSecondary,
                            fontWeight: expired ? FontWeight.w600 : FontWeight.normal,
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Icon(Icons.visibility_rounded,
                            size: 12, color: ShieldTheme.textSecondary),
                        const SizedBox(width: 4),
                        Text(
                          '$viewCount view${viewCount == 1 ? '' : 's'}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: ShieldTheme.textSecondary,
                          ),
                        ),
                      ]),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // URL preview
          if (url.isNotEmpty) ...[
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: ShieldTheme.surface,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  url,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: ShieldTheme.textSecondary,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
            ),
          ],

          // Actions
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 6, 10, 10),
            child: Row(
              children: [
                Expanded(
                  child: TextButton.icon(
                    onPressed: url.isEmpty ? null : () => _copyUrl(context, url),
                    icon: const Icon(Icons.copy_rounded, size: 16),
                    label: const Text('Copy URL',
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    style: TextButton.styleFrom(foregroundColor: ShieldTheme.primary),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextButton.icon(
                    onPressed: shareId.isEmpty ? null : onRevoke,
                    icon: const Icon(Icons.delete_outline_rounded, size: 16),
                    label: const Text('Revoke',
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    style: TextButton.styleFrom(foregroundColor: ShieldTheme.danger),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Support widgets ───────────────────────────────────────────────────────────

class _EmptySharesPlaceholder extends StatelessWidget {
  final String message;
  final IconData icon;
  const _EmptySharesPlaceholder({required this.message, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ShieldTheme.divider),
      ),
      child: Column(
        children: [
          Icon(icon, size: 48, color: ShieldTheme.textSecondary.withOpacity(0.4)),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: ShieldTheme.textSecondary,
              fontSize: 14,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 11,
        color: ShieldTheme.textSecondary,
        letterSpacing: 0.8,
      ),
    );
  }
}
