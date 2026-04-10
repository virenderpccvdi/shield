import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

final _safeFiltersProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
  (ref, pid) async {
    final resp = await ApiClient.instance.get(Endpoints.dnsSafeFilters(pid));
    final raw = resp.data as Map<String, dynamic>? ?? {};
    final data = (raw['data'] as Map<String, dynamic>?) ?? raw;
    // Categories are in enabledCategories map, flatten to top level for easy access
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
      appBar: AppBar(title: const Text('Safe Filters')),
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

const _categories = [
  ('adult',        'Adult Content',      Icons.no_adult_content,   Colors.red),
  ('violence',     'Violence',           Icons.warning_amber,       Color(0xFFC2410C)),
  ('gambling',     'Gambling',           Icons.casino_outlined,     Colors.purple),
  ('social',       'Social Media',       Icons.groups_outlined,     Colors.blue),
  ('gaming',       'Gaming',             Icons.sports_esports,      Colors.teal),
  ('streaming',    'Streaming/Video',    Icons.movie_outlined,      Colors.pink),
  ('drugs',        'Drugs & Alcohol',    Icons.local_bar_outlined,  Colors.brown),
  ('malware',      'Malware & Phishing', Icons.bug_report_outlined, Colors.red),
  ('ads',          'Ads & Trackers',     Icons.ads_click_outlined,  Colors.grey),
  ('music',        'Music (strict)',     Icons.music_note,          Colors.indigo),
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

  @override
  void initState() {
    super.initState();
    _blocked = { for (final c in _categories) c.$1: widget.initial[c.$1] as bool? ?? false };
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ApiClient.instance.put(
        '${Endpoints.dnsSafeFilters(widget.profileId)}/categories',
        data: {'categories': _blocked},
      );
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Filters saved'), backgroundColor: Colors.green));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(children: [
    Expanded(
      child: ListView(children: [
        const Padding(
          padding: EdgeInsets.all(16),
          child: Text('Toggle categories to block access on this child\'s devices.',
              style: TextStyle(color: Colors.black54)),
        ),
        ..._categories.map((cat) => SwitchListTile(
          secondary:    Icon(cat.$3, color: _blocked[cat.$1] == true ? cat.$4 : Colors.black45),
          title:        Text(cat.$2),
          subtitle:     Text(_blocked[cat.$1] == true ? 'Blocked' : 'Allowed',
              style: TextStyle(
                color: _blocked[cat.$1] == true ? Colors.red : Colors.green,
                fontSize: 12,
              )),
          value:        _blocked[cat.$1] ?? false,
          onChanged:    (v) => setState(() => _blocked[cat.$1] = v),
        )),
      ]),
    ),
    Padding(
      padding: const EdgeInsets.all(16),
      child: ElevatedButton(
        onPressed: _saving ? null : _save,
        child: _saving
            ? const SizedBox(height: 20, width: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Text('Save Filters'),
      ),
    ),
  ]);
}
