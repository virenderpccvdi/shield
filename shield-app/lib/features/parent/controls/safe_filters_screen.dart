import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';
import 'dart:async';

// Categories that require a confirmation dialog before unblocking
const _sensitiveCategories = {'adult', 'violence', 'drugs', 'malware', 'gambling'};

final _safeFiltersProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
  (ref, pid) async {
    final resp = await ApiClient.instance.get(Endpoints.dnsSafeFilters(pid));
    final raw = resp.data as Map<String, dynamic>? ?? {};
    final data = (raw['data'] as Map<String, dynamic>?) ?? raw;
    final cats = data['enabledCategories'] as Map<String, dynamic>? ?? {};
    return cats;
  },
);

class SafeFiltersScreen extends ConsumerWidget {
  const SafeFiltersScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_safeFiltersProvider(profileId));
    return Scaffold(
      backgroundColor: Ds.surface,
      appBar: AppBar(
        title: Text('Safe Filters',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
      ),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load filters',
          onRetry: () => ref.invalidate(_safeFiltersProvider(profileId)),
        ),
        data: (d) => _SafeFiltersBody(profileId: profileId, initial: d),
      ),
    );
  }
}

// Category data: (key, label, icon, accent color)
const _categories = [
  ('adult',        'Adult Content',      Icons.no_adult_content_rounded,   Ds.danger),
  ('violence',     'Violence',           Icons.warning_amber_rounded,       Ds.warning),
  ('gambling',     'Gambling',           Icons.casino_outlined,             Color(0xFF6A1B9A)),
  ('social',       'Social Media',       Icons.groups_outlined,             Ds.primary),
  ('gaming',       'Gaming',             Icons.sports_esports_outlined,     Color(0xFF00838F)),
  ('streaming',    'Streaming & Video',  Icons.movie_outlined,              Color(0xFFAD1457)),
  ('drugs',        'Drugs & Alcohol',    Icons.local_bar_outlined,          Color(0xFF4E342E)),
  ('malware',      'Malware & Phishing', Icons.bug_report_outlined,         Ds.danger),
  ('ads',          'Ads & Trackers',     Icons.ads_click_outlined,          Ds.onSurfaceVariant),
  ('music',        'Music (strict)',     Icons.music_note_outlined,         Color(0xFF283593)),
];

class _SafeFiltersBody extends ConsumerStatefulWidget {
  const _SafeFiltersBody({required this.profileId, required this.initial});
  final String profileId;
  final Map<String, dynamic> initial;
  @override
  ConsumerState<_SafeFiltersBody> createState() => _SafeFiltersBodyState();
}

class _SafeFiltersBodyState extends ConsumerState<_SafeFiltersBody> {
  late Map<String, bool> _blocked;
  bool _saving = false;
  final _toggling = <String, bool>{};
  final _categorySearchCtrl = TextEditingController();
  String _categorySearch = '';

  @override
  void initState() {
    super.initState();
    _blocked = { for (final c in _categories) c.$1: widget.initial[c.$1] as bool? ?? false };
  }

  @override
  void dispose() {
    _categorySearchCtrl.dispose();
    super.dispose();
  }

  Future<void> _toggle(String catKey, String catLabel, bool newValue) async {
    if (_toggling.containsKey(catKey)) return;
    // newValue=false means unblocking (allowing) — require confirmation for sensitive categories
    if (!newValue && _sensitiveCategories.contains(catKey)) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('Allow "$catLabel"?',
              style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
          content: Text(
            'Turning off this filter will allow "$catLabel" content on this child\'s device. Are you sure?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(backgroundColor: Ds.danger),
              child: const Text('Allow Anyway'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }
    setState(() => _toggling[catKey] = true);
    try {
      setState(() => _blocked[catKey] = newValue);
    } finally {
      if (mounted) setState(() => _toggling.remove(catKey));
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ApiClient.instance.put(
        '${Endpoints.dnsSafeFilters(widget.profileId)}/categories',
        data: {'categories': _blocked},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Filters saved',
                style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w500)),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save',
                style: GoogleFonts.inter(color: Colors.white)),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final blockedCount = _blocked.values.where((v) => v).length;

    // FL15: filter categories by search query
    final filteredCategories = _categorySearch.isEmpty
        ? _categories
        : _categories
            .where((c) =>
                c.$2.toLowerCase().contains(_categorySearch.toLowerCase()))
            .toList();

    return Column(children: [
      // Summary header card
      GuardianCard(
        padding: const EdgeInsets.all(20),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color:        Ds.primary.withOpacity(0.10),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.security_rounded, color: Ds.primary, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Content Filters',
                style: GoogleFonts.manrope(
                    fontWeight: FontWeight.w700, fontSize: 15, color: cs.onSurface)),
            const SizedBox(height: 4),
            Text(
              blockedCount == 0
                  ? 'All categories allowed'
                  : '$blockedCount ${blockedCount == 1 ? 'category' : 'categories'} blocked',
              style: GoogleFonts.inter(fontSize: 13, color: cs.onSurfaceVariant),
            ),
          ])),
          StatusChip(
            '$blockedCount blocked',
            color: blockedCount > 0 ? Ds.danger : Ds.success,
          ),
        ]),
      ),

      // Info subtitle
      Padding(
        padding: const EdgeInsets.fromLTRB(24, 4, 24, 4),
        child: Text(
          'Toggle categories to block access on this child\'s devices.',
          style: GoogleFonts.inter(fontSize: 12, color: cs.onSurfaceVariant),
        ),
      ),

      // FL15: Category search bar
      Padding(
        padding: const EdgeInsets.fromLTRB(24, 4, 24, 8),
        child: TextField(
          controller: _categorySearchCtrl,
          decoration: InputDecoration(
            hintText: 'Search categories...',
            hintStyle: GoogleFonts.inter(color: cs.onSurfaceVariant, fontSize: 14),
            prefixIcon: Icon(Icons.search_rounded, color: cs.onSurfaceVariant),
            filled: true,
            fillColor: Ds.surfaceContainerLow,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(Ds.radiusDefault),
              borderSide: BorderSide.none,
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          ),
          onChanged: (v) => setState(() => _categorySearch = v),
        ),
      ),

      // Category list
      Expanded(
        child: RefreshIndicator(
          color: Ds.primary,
          backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
          onRefresh: () async {
            ref.invalidate(_safeFiltersProvider(widget.profileId));
            await ref.read(_safeFiltersProvider(widget.profileId).future);
          },
          child: filteredCategories.isEmpty
              ? Center(
                  child: Text('No categories match "$_categorySearch"',
                      style: GoogleFonts.inter(
                          color: cs.onSurfaceVariant, fontSize: 13)),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                  itemCount: filteredCategories.length,
                  itemBuilder: (_, i) {
                    final cat = filteredCategories[i];
                    final isBlocked = _blocked[cat.$1] ?? false;
                    final isToggling = _toggling.containsKey(cat.$1);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color:        cs.surfaceContainerLowest,
                          borderRadius: BorderRadius.circular(Ds.radiusDefault),
                          boxShadow:    Ds.guardianShadow(opacity: 0.04),
                        ),
                        child: Material(
                          color:        Colors.transparent,
                          borderRadius: BorderRadius.circular(Ds.radiusDefault),
                          child: InkWell(
                            onTap: isToggling
                                ? null
                                : () => _toggle(cat.$1, cat.$2, !isBlocked),
                            borderRadius: BorderRadius.circular(Ds.radiusDefault),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 14),
                              child: Row(children: [
                                // Icon tinted container
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: (isBlocked ? cat.$4 : cs.onSurfaceVariant)
                                        .withOpacity(0.10),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Icon(
                                    cat.$3,
                                    color: isBlocked ? cat.$4 : cs.onSurfaceVariant,
                                    size: 18,
                                  ),
                                ),
                                const SizedBox(width: 14),

                                // Label + status
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(cat.$2,
                                          style: GoogleFonts.inter(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 14,
                                              color: cs.onSurface)),
                                      const SizedBox(height: 2),
                                      Text(
                                        isBlocked ? 'Blocked' : 'Allowed',
                                        style: GoogleFonts.inter(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w500,
                                          color: isBlocked ? Ds.danger : Ds.success,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                // FL1: loading indicator while toggling
                                if (isToggling)
                                  const Padding(
                                    padding: EdgeInsets.only(right: 12),
                                    child: SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2, color: Ds.primary),
                                    ),
                                  ),

                                // Switch (far right — asymmetric)
                                Switch(
                                  value: isBlocked,
                                  onChanged: isToggling
                                      ? null
                                      : (v) => _toggle(cat.$1, cat.$2, v),
                                ),
                              ]),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),

      // Save button
      Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
        child: GuardianButton(
          label:     'Save Filters',
          icon:      Icons.check_rounded,
          onPressed: _saving ? null : _save,
          loading:   _saving,
        ),
      ),
    ]);
  }
}
