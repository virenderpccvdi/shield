import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class DnsRulesScreen extends ConsumerStatefulWidget {
  final String profileId;
  const DnsRulesScreen({super.key, required this.profileId});
  @override
  ConsumerState<DnsRulesScreen> createState() => _DnsRulesScreenState();
}

class _DnsRulesScreenState extends ConsumerState<DnsRulesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  // ── Categories state ────────────────────────────────────────────────────
  Map<String, bool> _categories = {};
  bool _catsLoading = true;
  bool _catsSaving  = false;
  String _search    = '';
  String? _catsError;

  // ── Custom lists state ──────────────────────────────────────────────────
  List<String> _blocklist = [];
  List<String> _allowlist = [];
  bool _listsLoading = true;
  bool _listsSaving  = false;

  // ── Filter level ────────────────────────────────────────────────────────
  String _filterLevel = 'MODERATE';
  bool _levelSaving   = false;

  // ── DNS pause/resume ─────────────────────────────────────────────────────
  bool _paused        = false;
  bool _pauseSaving   = false;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _loadAll();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  // ── Loaders ─────────────────────────────────────────────────────────────

  /// Loads categories, custom lists, filter level, and DNS pause status in parallel.
  Future<void> _loadAll() async {
    setState(() { _catsLoading = true; _listsLoading = true; _catsError = null; });
    try {
      final client = ref.read(dioProvider);
      // Fetch rules and DNS status in parallel
      final results = await Future.wait([
        client.get('/dns/rules/${widget.profileId}'),
        client.get('/dns/${widget.profileId}/status').catchError((_) => null),
      ], eagerError: false);

      final res = results[0] as dynamic;
      final data = res.data['data'] as Map<String, dynamic>? ?? {};

      // Categories
      final cats = data['enabledCategories'] as Map<String, dynamic>? ?? {};

      // Filter level
      final level = data['filterLevel'] as String? ?? 'MODERATE';

      // DNS pause status
      bool paused = false;
      try {
        final statusRes = results[1];
        if (statusRes != null) {
          final sd = (statusRes as dynamic).data;
          final sdMap = sd is Map ? sd : (sd['data'] as Map? ?? {});
          paused = sdMap['paused'] == true;
        }
      } catch (_) {}

      if (mounted) {
        setState(() {
          _categories = cats.map((k, v) => MapEntry(k, v == true));
          _catsLoading = false;
          _blocklist = List<String>.from(data['customBlocklist'] ?? []);
          _allowlist = List<String>.from(data['customAllowlist'] ?? []);
          _listsLoading = false;
          _filterLevel = level;
          _paused = paused;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _catsError = 'Using defaults';
          _categories = {
            'ADULT': true,  'GAMBLING': true,  'MALWARE': true,  'PHISHING': true,
            'SOCIAL_MEDIA': false, 'GAMING': false, 'STREAMING': false,
            'DATING': true, 'DRUGS': true, 'WEAPONS': true, 'VIOLENCE': true,
            'CRYPTO': false, 'VPN_PROXY': true, 'ADVERTISING': false,
            'PIRACY': true, 'HATE_SPEECH': true, 'SELF_HARM': true,
          };
          _catsLoading = false;
          _listsLoading = false;
        });
      }
    }
  }

  Future<void> _togglePause() async {
    setState(() => _pauseSaving = true);
    try {
      final client = ref.read(dioProvider);
      if (_paused) {
        await client.post('/dns/${widget.profileId}/resume');
        if (mounted) {
          setState(() => _paused = false);
          _showSnack('DNS protection resumed', success: true);
        }
      } else {
        await client.post('/dns/${widget.profileId}/pause');
        if (mounted) {
          setState(() => _paused = true);
          _showSnack('DNS protection paused', success: false);
        }
      }
    } catch (e) {
      if (mounted) _showSnack('Failed: $e', success: false);
    } finally {
      if (mounted) setState(() => _pauseSaving = false);
    }
  }

  /// Keep individual reload methods so tabs can refresh independently after saves.
  Future<void> _loadCategories() async => _loadAll();
  Future<void> _loadCustomLists() async => _loadAll();
  Future<void> _loadFilterLevel() async => _loadAll();

  // ── Savers ───────────────────────────────────────────────────────────────

  Future<void> _saveCategories() async {
    setState(() => _catsSaving = true);
    try {
      await ref.read(dioProvider).put('/dns/rules/${widget.profileId}/categories', data: _categories);
      if (mounted) _showSnack('Content rules saved', success: true);
    } catch (e) {
      if (mounted) _showSnack('Failed to save: $e', success: false);
    } finally {
      if (mounted) setState(() => _catsSaving = false);
    }
  }

  Future<void> _saveLists() async {
    setState(() => _listsSaving = true);
    try {
      await ref.read(dioProvider).put('/dns/rules/${widget.profileId}/custom-lists', data: {
        'customBlocklist': _blocklist,
        'customAllowlist': _allowlist,
      });
      if (mounted) _showSnack('Custom lists saved', success: true);
    } catch (e) {
      if (mounted) _showSnack('Failed: $e', success: false);
    } finally {
      if (mounted) setState(() => _listsSaving = false);
    }
  }

  Future<void> _saveFilterLevel(String level) async {
    setState(() { _filterLevel = level; _levelSaving = true; });
    try {
      await ref.read(dioProvider).put('/dns/rules/${widget.profileId}/filter-level',
          data: {'filterLevel': level});
      if (mounted) _showSnack('Protection level updated', success: true);
    } catch (e) {
      if (mounted) _showSnack('Failed: $e', success: false);
    } finally {
      if (mounted) setState(() => _levelSaving = false);
    }
  }

  void _showSnack(String msg, {required bool success}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: success ? ShieldTheme.success : ShieldTheme.dangerLight,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  // ── Domain entry dialog ──────────────────────────────────────────────────

  Future<String?> _promptDomain(String title) async {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: ctrl,
          decoration: InputDecoration(
            hintText: 'e.g. example.com',
            prefixIcon: const Icon(Icons.language),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
          autofocus: true,
          keyboardType: TextInputType.url,
          onSubmitted: (v) => Navigator.pop(ctx, v.trim()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  String _fmt(String key) => key.replaceAll('_', ' ').split(' ').map((w) =>
      w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}').join(' ');

  IconData _catIcon(String k) {
    const map = {
      'ADULT': Icons.no_adult_content, 'GAMBLING': Icons.casino,
      'MALWARE': Icons.bug_report, 'PHISHING': Icons.phishing,
      'SOCIAL_MEDIA': Icons.people, 'GAMING': Icons.sports_esports,
      'STREAMING': Icons.play_circle, 'DATING': Icons.favorite,
      'DRUGS': Icons.medication, 'WEAPONS': Icons.gpp_bad,
      'VIOLENCE': Icons.warning, 'CRYPTO': Icons.currency_bitcoin,
      'VPN_PROXY': Icons.vpn_key, 'ADVERTISING': Icons.ad_units,
      'PIRACY': Icons.file_download_off, 'HATE_SPEECH': Icons.speaker_notes_off,
      'SELF_HARM': Icons.healing,
    };
    return map[k] ?? Icons.block;
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('Parental Controls'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Categories'),
            Tab(text: 'Block List'),
            Tab(text: 'Allow List'),
          ],
          indicatorColor: ShieldTheme.primary,
          labelColor: ShieldTheme.primary,
          unselectedLabelColor: ShieldTheme.textSecondary,
        ),
      ),
      body: Column(
        children: [
          // DNS protection status card
          _DnsStatusCard(
            paused: _paused,
            saving: _pauseSaving,
            onToggle: _togglePause,
          ),
          Expanded(child: TabBarView(
            controller: _tabs,
            children: [
          _CategoriesTab(
            categories: _categories,
            loading: _catsLoading,
            saving: _catsSaving,
            search: _search,
            error: _catsError,
            filterLevel: _filterLevel,
            levelSaving: _levelSaving,
            onSearchChanged: (v) => setState(() => _search = v),
            onCategoryChanged: (k, v) => setState(() => _categories[k] = v),
            onBlockAll: () => setState(() => _categories.updateAll((_, __) => true)),
            onAllowAll: () => setState(() => _categories.updateAll((_, __) => false)),
            onSave: _saveCategories,
            onLevelChanged: _saveFilterLevel,
            catIcon: _catIcon,
            fmt: _fmt,
          ),
          _DomainListTab(
            title: 'Blocked Domains',
            subtitle: 'These domains are always blocked',
            icon: Icons.block,
            iconColor: ShieldTheme.dangerLight,
            domains: _blocklist,
            loading: _listsLoading,
            saving: _listsSaving,
            onAdd: () async {
              final d = await _promptDomain('Block Domain');
              if (d != null && d.isNotEmpty && !_blocklist.contains(d)) {
                setState(() => _blocklist.add(d));
              }
            },
            onRemove: (d) => setState(() => _blocklist.remove(d)),
            onSave: _saveLists,
          ),
          _DomainListTab(
            title: 'Allowed Domains',
            subtitle: 'These domains are never blocked',
            icon: Icons.check_circle,
            iconColor: ShieldTheme.success,
            domains: _allowlist,
            loading: _listsLoading,
            saving: _listsSaving,
            onAdd: () async {
              final d = await _promptDomain('Allow Domain');
              if (d != null && d.isNotEmpty && !_allowlist.contains(d)) {
                setState(() => _allowlist.add(d));
              }
            },
            onRemove: (d) => setState(() => _allowlist.remove(d)),
            onSave: _saveLists,
          ),
        ],
          )),
        ],
      ),
    );
  }
}

// ── DNS Status Card ─────────────────────────────────────────────────────────

class _DnsStatusCard extends StatelessWidget {
  final bool paused, saving;
  final VoidCallback onToggle;
  const _DnsStatusCard({required this.paused, required this.saving, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: paused
              ? ShieldTheme.warning.withOpacity(0.4)
              : ShieldTheme.success.withOpacity(0.4),
          width: 1,
        ),
      ),
      color: paused
          ? ShieldTheme.warning.withOpacity(0.08)
          : ShieldTheme.success.withOpacity(0.08),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Icon(
              paused ? Icons.warning_amber_rounded : Icons.security,
              color: paused ? ShieldTheme.warning : ShieldTheme.success,
              size: 22,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                paused ? 'Protection Paused' : 'Protection Active',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: paused ? ShieldTheme.warning : ShieldTheme.success,
                ),
              ),
            ),
            saving
              ? const SizedBox(
                  width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : ElevatedButton(
                  onPressed: onToggle,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: paused ? ShieldTheme.success : ShieldTheme.warning,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    minimumSize: const Size(0, 32),
                    textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  child: Text(paused ? 'Resume' : 'Pause'),
                ),
          ],
        ),
      ),
    );
  }
}

// ── Categories Tab ─────────────────────────────────────────────────────────

class _CategoriesTab extends StatelessWidget {
  final Map<String, bool> categories;
  final bool loading, saving, levelSaving;
  final String search, filterLevel;
  final String? error;
  final ValueChanged<String> onSearchChanged;
  final void Function(String, bool) onCategoryChanged;
  final VoidCallback onBlockAll, onAllowAll, onSave;
  final Future<void> Function(String) onLevelChanged;
  final IconData Function(String) catIcon;
  final String Function(String) fmt;

  const _CategoriesTab({
    required this.categories, required this.loading, required this.saving,
    required this.levelSaving, required this.search, required this.filterLevel,
    required this.error, required this.onSearchChanged, required this.onCategoryChanged,
    required this.onBlockAll, required this.onAllowAll, required this.onSave,
    required this.onLevelChanged, required this.catIcon, required this.fmt,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) return const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 4),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 3),
          ]));

    final filtered = categories.entries
        .where((e) => search.isEmpty || e.key.toLowerCase().contains(search.toLowerCase()))
        .toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    final blockedCount = categories.values.where((v) => v).length;

    return Column(children: [
      // ── Filter level selector ───────────────────────────────────────────
      Container(
        color: ShieldTheme.cardBg,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Protection Level',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: ShieldTheme.textSecondary)),
          const SizedBox(height: 8),
          Row(children: [
            for (final level in ['STRICT', 'MODERATE', 'LIGHT', 'OFF'])
              Expanded(child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: _LevelChip(
                  label: level,
                  selected: filterLevel == level,
                  saving: levelSaving,
                  onTap: () => onLevelChanged(level),
                ),
              )),
          ]),
        ]),
      ),
      const Divider(height: 1),
      // ── Search + stats ──────────────────────────────────────────────────
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Column(children: [
          TextField(
            decoration: InputDecoration(
              hintText: 'Search categories...',
              prefixIcon: const Icon(Icons.search, size: 20),
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onChanged: onSearchChanged,
          ),
          const SizedBox(height: 10),
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: blockedCount > 10
                    ? ShieldTheme.success.withOpacity(0.1)
                    : ShieldTheme.warning.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.shield, size: 14,
                  color: blockedCount > 10 ? ShieldTheme.success : ShieldTheme.warning),
                const SizedBox(width: 4),
                Text('$blockedCount / ${categories.length} blocked',
                  style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w600,
                    color: blockedCount > 10 ? ShieldTheme.success : ShieldTheme.warning)),
              ]),
            ),
            const Spacer(),
            TextButton(onPressed: onBlockAll, child: const Text('Block All', style: TextStyle(fontSize: 12))),
            TextButton(onPressed: onAllowAll, child: const Text('Allow All', style: TextStyle(fontSize: 12))),
            FilledButton(
              onPressed: saving ? null : onSave,
              style: FilledButton.styleFrom(
                minimumSize: const Size(64, 32),
                padding: const EdgeInsets.symmetric(horizontal: 12),
              ),
              child: saving
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Save', style: TextStyle(fontSize: 12)),
            ),
          ]),
          if (error != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: ShieldTheme.warning.withOpacity(0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(children: [
                const Icon(Icons.info_outline, color: ShieldTheme.warning, size: 16),
                const SizedBox(width: 6),
                Expanded(child: Text('$error — save to apply to your account.',
                  style: const TextStyle(fontSize: 11, color: ShieldTheme.warning))),
              ]),
            ),
          ],
        ]),
      ),
      // ── List ────────────────────────────────────────────────────────────
      Expanded(
        child: ListView.builder(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          itemCount: filtered.length,
          itemBuilder: (_, i) {
            final entry = filtered[i];
            final blocked = entry.value;
            return Container(
              margin: const EdgeInsets.only(bottom: 6),
              decoration: BoxDecoration(
                color: ShieldTheme.cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: blocked ? ShieldTheme.dangerLight.withOpacity(0.3) : ShieldTheme.divider,
                ),
              ),
              child: SwitchListTile(
                dense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                secondary: Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: blocked
                        ? ShieldTheme.dangerLight.withOpacity(0.1)
                        : ShieldTheme.divider,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(catIcon(entry.key),
                    color: blocked ? ShieldTheme.dangerLight : ShieldTheme.textSecondary,
                    size: 18),
                ),
                title: Text(fmt(entry.key),
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                subtitle: Text(
                  blocked ? 'Blocked' : 'Allowed',
                  style: TextStyle(
                    fontSize: 11,
                    color: blocked ? ShieldTheme.dangerLight : ShieldTheme.success,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                value: entry.value,
                activeColor: ShieldTheme.dangerLight,
                onChanged: (v) => onCategoryChanged(entry.key, v),
              ),
            );
          },
        ),
      ),
    ]);
  }
}

class _LevelChip extends StatelessWidget {
  final String label;
  final bool selected, saving;
  final VoidCallback onTap;
  const _LevelChip({required this.label, required this.selected,
      required this.saving, required this.onTap});

  Color get _color {
    switch (label) {
      case 'STRICT':   return ShieldTheme.dangerLight;
      case 'MODERATE': return ShieldTheme.warning;
      case 'LIGHT':    return ShieldTheme.successLight;
      default:         return ShieldTheme.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: saving ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 7),
        decoration: BoxDecoration(
          color: selected ? _color.withOpacity(0.1) : ShieldTheme.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? _color : ShieldTheme.divider,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Column(children: [
          if (saving && selected)
            SizedBox(width: 14, height: 14,
              child: CircularProgressIndicator(strokeWidth: 2, color: _color))
          else
            Icon(_levelIcon, color: selected ? _color : ShieldTheme.textSecondary, size: 16),
          const SizedBox(height: 2),
          Text(label.substring(0, 1) + label.substring(1).toLowerCase(),
            style: TextStyle(
              fontSize: 10, fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
              color: selected ? _color : ShieldTheme.textSecondary,
            )),
        ]),
      ),
    );
  }

  IconData get _levelIcon {
    switch (label) {
      case 'STRICT':   return Icons.security;
      case 'MODERATE': return Icons.shield;
      case 'LIGHT':    return Icons.shield_outlined;
      default:         return Icons.no_encryption_outlined;
    }
  }
}

// ── Domain List Tab ────────────────────────────────────────────────────────

class _DomainListTab extends StatelessWidget {
  final String title, subtitle;
  final IconData icon;
  final Color iconColor;
  final List<String> domains;
  final bool loading, saving;
  final VoidCallback onAdd, onSave;
  final void Function(String) onRemove;

  const _DomainListTab({
    required this.title, required this.subtitle, required this.icon,
    required this.iconColor, required this.domains, required this.loading,
    required this.saving, required this.onAdd, required this.onRemove, required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) return const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 4),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 3),
          ]));

    return Column(children: [
      // Header
      Container(
        color: ShieldTheme.cardBg,
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Row(children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            Text(subtitle, style: const TextStyle(fontSize: 12, color: ShieldTheme.textSecondary)),
          ])),
          FilledButton(
            onPressed: saving ? null : onSave,
            style: FilledButton.styleFrom(
              minimumSize: const Size(60, 36),
              padding: const EdgeInsets.symmetric(horizontal: 12),
            ),
            child: saving
              ? const SizedBox(width: 14, height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Save'),
          ),
        ]),
      ),
      const Divider(height: 1),
      // List
      Expanded(
        child: domains.isEmpty
          ? _EmptyList(iconColor: iconColor, icon: icon, onAdd: onAdd)
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
              itemCount: domains.length,
              itemBuilder: (_, i) => _DomainTile(
                domain: domains[i],
                color: iconColor,
                onRemove: () => onRemove(domains[i]),
              ),
            ),
      ),
      // Add button
      SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add),
            label: Text('Add Domain to ${title.split(' ').first}'),
            style: FilledButton.styleFrom(
              backgroundColor: iconColor,
              minimumSize: const Size(double.infinity, 48),
            ),
          ),
        ),
      ),
    ]);
  }
}

class _DomainTile extends StatelessWidget {
  final String domain;
  final Color color;
  final VoidCallback onRemove;
  const _DomainTile({required this.domain, required this.color, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: ShieldTheme.divider),
      ),
      child: ListTile(
        dense: true,
        leading: Container(
          width: 32, height: 32,
          decoration: BoxDecoration(
            color: color.withOpacity(0.08),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(Icons.language, color: color, size: 16),
        ),
        title: Text(domain, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        trailing: IconButton(
          icon: const Icon(Icons.remove_circle_outline, color: ShieldTheme.danger, size: 20),
          onPressed: onRemove,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
        ),
      ),
    );
  }
}

class _EmptyList extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final VoidCallback onAdd;
  const _EmptyList({required this.icon, required this.iconColor, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 56, color: iconColor.withOpacity(0.3)),
        const SizedBox(height: 12),
        const Text('No domains added',
          style: TextStyle(fontWeight: FontWeight.w600, color: ShieldTheme.textSecondary)),
        const SizedBox(height: 6),
        const Text('Tap the button below to add your first domain.',
          style: TextStyle(fontSize: 12, color: ShieldTheme.textSecondary)),
      ]),
    );
  }
}
