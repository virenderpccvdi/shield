import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';

class DnsRulesScreen extends ConsumerStatefulWidget {
  final String profileId;
  const DnsRulesScreen({super.key, required this.profileId});
  @override
  ConsumerState<DnsRulesScreen> createState() => _DnsRulesScreenState();
}

class _DnsRulesScreenState extends ConsumerState<DnsRulesScreen> {
  Map<String, bool> _categories = {};
  bool _loading = true;
  bool _saving = false;
  String _search = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRules();
  }

  Future<void> _loadRules() async {
    setState(() { _loading = true; _error = null; });
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/dns/rules/${widget.profileId}');
      final data = res.data['data'] as Map<String, dynamic>? ?? {};
      final cats = data['categories'] as Map<String, dynamic>? ?? {};
      setState(() {
        _categories = cats.map((k, v) => MapEntry(k, v == true));
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load DNS rules';
        _loading = false;
        // Provide default categories
        _categories = {
          'ADULT': true, 'GAMBLING': true, 'MALWARE': true, 'PHISHING': true,
          'SOCIAL_MEDIA': false, 'GAMING': false, 'STREAMING': false,
          'DATING': true, 'DRUGS': true, 'WEAPONS': true, 'VIOLENCE': true,
          'CRYPTO': false, 'VPN_PROXY': true, 'ADVERTISING': false,
          'PIRACY': true, 'HATE_SPEECH': true, 'SELF_HARM': true,
        };
      });
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final client = ref.read(dioProvider);
      await client.put('/dns/rules/${widget.profileId}/categories', data: _categories);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('DNS rules saved'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _formatCategory(String key) {
    return key.replaceAll('_', ' ').split(' ').map((w) =>
      w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}'
    ).join(' ');
  }

  IconData _categoryIcon(String key) {
    switch (key) {
      case 'ADULT': return Icons.no_adult_content;
      case 'GAMBLING': return Icons.casino;
      case 'MALWARE': return Icons.bug_report;
      case 'PHISHING': return Icons.phishing;
      case 'SOCIAL_MEDIA': return Icons.people;
      case 'GAMING': return Icons.sports_esports;
      case 'STREAMING': return Icons.play_circle;
      case 'DATING': return Icons.favorite;
      case 'DRUGS': return Icons.medication;
      case 'WEAPONS': return Icons.gpp_bad;
      case 'VIOLENCE': return Icons.warning;
      case 'CRYPTO': return Icons.currency_bitcoin;
      case 'VPN_PROXY': return Icons.vpn_key;
      case 'ADVERTISING': return Icons.ad_units;
      case 'PIRACY': return Icons.file_download_off;
      case 'HATE_SPEECH': return Icons.speaker_notes_off;
      case 'SELF_HARM': return Icons.healing;
      default: return Icons.block;
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _categories.entries
        .where((e) => _search.isEmpty || e.key.toLowerCase().contains(_search.toLowerCase()))
        .toList()
      ..sort((a, b) => a.key.compareTo(b.key));

    final blockedCount = _categories.values.where((v) => v).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('DNS Content Rules', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          TextButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.save),
            label: const Text('Save'),
          ),
        ],
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    TextField(
                      decoration: InputDecoration(
                        hintText: 'Search categories...',
                        prefixIcon: const Icon(Icons.search),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      onChanged: (v) => setState(() => _search = v),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Icon(Icons.shield, color: blockedCount > 10 ? Colors.green : Colors.orange, size: 20),
                        const SizedBox(width: 8),
                        Text('$blockedCount of ${_categories.length} categories blocked',
                          style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
                        const Spacer(),
                        TextButton(
                          onPressed: () => setState(() => _categories.updateAll((k, v) => true)),
                          child: const Text('Block All'),
                        ),
                        TextButton(
                          onPressed: () => setState(() => _categories.updateAll((k, v) => false)),
                          child: const Text('Allow All'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(8)),
                    child: Row(children: [
                      const Icon(Icons.info_outline, color: Colors.orange, size: 18),
                      const SizedBox(width: 8),
                      Expanded(child: Text('Using default categories. Save to apply.', style: TextStyle(color: Colors.orange.shade800, fontSize: 12))),
                    ]),
                  ),
                ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: filtered.length,
                  itemBuilder: (_, i) {
                    final entry = filtered[i];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 4),
                      child: SwitchListTile(
                        secondary: Icon(_categoryIcon(entry.key),
                          color: entry.value ? Colors.red.shade400 : Colors.grey.shade400),
                        title: Text(_formatCategory(entry.key),
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        subtitle: Text(entry.value ? 'Blocked' : 'Allowed',
                          style: TextStyle(
                            color: entry.value ? Colors.red.shade400 : Colors.green.shade400,
                            fontSize: 12,
                          )),
                        value: entry.value,
                        onChanged: (v) => setState(() => _categories[entry.key] = v),
                        activeColor: Colors.red,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
    );
  }
}
