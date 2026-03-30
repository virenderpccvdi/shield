import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

final _dnsRulesProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
  (ref, profileId) async {
    final resp = await ApiClient.instance.get(Endpoints.dnsRules(profileId));
    final raw = resp.data as Map<String, dynamic>;
    return (raw['data'] as Map<String, dynamic>?) ?? raw;
  },
);

class DnsRulesScreen extends ConsumerWidget {
  const DnsRulesScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_dnsRulesProvider(profileId));

    return Scaffold(
      appBar: AppBar(title: const Text('DNS Rules')),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load DNS rules',
          onRetry: () => ref.invalidate(_dnsRulesProvider(profileId)),
        ),
        data: (d) => _DnsRulesBody(profileId: profileId, data: d),
      ),
    );
  }
}

class _DnsRulesBody extends ConsumerStatefulWidget {
  const _DnsRulesBody({required this.profileId, required this.data});
  final String profileId;
  final Map<String, dynamic> data;
  @override
  ConsumerState<_DnsRulesBody> createState() => _DnsRulesBodyState();
}

class _DnsRulesBodyState extends ConsumerState<_DnsRulesBody> {
  late String _filterLevel;
  late List<String> _allowlist;
  late List<String> _blocklist;
  bool _saving = false;
  final _domainCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _filterLevel = widget.data['filterLevel']?.toString() ?? 'MODERATE';
    _allowlist   = List<String>.from(widget.data['customAllowlist'] as List? ?? []);
    _blocklist   = List<String>.from(widget.data['customBlocklist'] as List? ?? []);
  }

  @override
  void dispose() { _domainCtrl.dispose(); super.dispose(); }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      // Two separate calls: filter level + custom lists
      await ApiClient.instance.put(
        '${Endpoints.dnsRules(widget.profileId)}/filter-level',
        data: {'filterLevel': _filterLevel},
      );
      await ApiClient.instance.put(
        '${Endpoints.dnsRules(widget.profileId)}/custom-lists',
        data: {'customAllowlist': _allowlist, 'customBlocklist': _blocklist},
      );
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Saved'), backgroundColor: Colors.green));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _addDomain(bool toBlocklist) {
    final domain = _domainCtrl.text.trim().toLowerCase();
    if (domain.isEmpty || !domain.contains('.')) return;
    setState(() {
      if (toBlocklist) { if (!_blocklist.contains(domain)) _blocklist.add(domain); }
      else             { if (!_allowlist.contains(domain)) _allowlist.add(domain); }
      _domainCtrl.clear();
    });
  }

  @override
  Widget build(BuildContext context) => ListView(children: [
    const SectionHeader('Filter Level'),
    Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: DropdownButtonFormField<String>(
        value:      _filterLevel,
        decoration: const InputDecoration(filled: true),
        items: ['STRICT','MODERATE','LIGHT','CUSTOM'].map(
          (l) => DropdownMenuItem(value: l, child: Text(l))).toList(),
        onChanged: (v) => setState(() => _filterLevel = v!),
      ),
    ),

    const SectionHeader('Add Domain Rule'),
    Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(children: [
        Expanded(child: TextField(
          controller:  _domainCtrl,
          decoration:  const InputDecoration(
              hintText: 'example.com', prefixIcon: Icon(Icons.language)),
        )),
        const SizedBox(width: 8),
        ElevatedButton(
            onPressed: () => _addDomain(false), child: const Text('Allow')),
        const SizedBox(width: 4),
        ElevatedButton(
          onPressed:  () => _addDomain(true),
          style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
          child: const Text('Block'),
        ),
      ]),
    ),

    if (_blocklist.isNotEmpty) ...[
      const SectionHeader('Blocked Domains'),
      ..._blocklist.map((d) => ListTile(
        leading:  const Icon(Icons.block, color: Colors.red),
        title:    Text(d),
        trailing: IconButton(
          icon:      const Icon(Icons.delete_outline, color: Colors.red),
          onPressed: () => setState(() => _blocklist.remove(d)),
        ),
      )),
    ],

    if (_allowlist.isNotEmpty) ...[
      const SectionHeader('Allowed Domains'),
      ..._allowlist.map((d) => ListTile(
        leading:  const Icon(Icons.check_circle_outline, color: Colors.green),
        title:    Text(d),
        trailing: IconButton(
          icon:      const Icon(Icons.delete_outline),
          onPressed: () => setState(() => _allowlist.remove(d)),
        ),
      )),
    ],

    Padding(
      padding: const EdgeInsets.all(16),
      child: ElevatedButton(
        onPressed: _saving ? null : _save,
        child:     _saving
            ? const SizedBox(height: 20, width: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Text('Save Changes'),
      ),
    ),
  ]);
}
