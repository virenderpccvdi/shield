import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class FamilyRulesScreen extends ConsumerStatefulWidget {
  const FamilyRulesScreen({super.key});
  @override
  ConsumerState<FamilyRulesScreen> createState() => _FamilyRulesScreenState();
}

class _FamilyRulesScreenState extends ConsumerState<FamilyRulesScreen> {
  List<Map<String, dynamic>> _rules = [];
  bool _loading = true;

  static const _iconOptions = [
    Icons.smartphone_rounded,
    Icons.dinner_dining_rounded,
    Icons.bedtime_rounded,
    Icons.school_rounded,
    Icons.fitness_center_rounded,
    Icons.outdoor_grill_rounded,
    Icons.sports_esports_rounded,
    Icons.headphones_rounded,
    Icons.book_rounded,
    Icons.emoji_events_rounded,
  ];
  static const _colorOptions = [
    Color(0xFF1565C0), Color(0xFF2E7D32), Color(0xFFE65100),
    Color(0xFF6A1B9A), Color(0xFFAD1457), Color(0xFF00695C),
    Color(0xFFBF360C), Color(0xFF37474F),
  ];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ref.read(dioProvider).get('/profiles/family-rules');
      final d = res.data['data'] ?? res.data;
      final list = d is List ? d : (d is Map ? (d['content'] ?? d['rules'] ?? []) : []);
      if (mounted) setState(() {
        _rules = List<Map<String, dynamic>>.from(list.map((e) => Map<String, dynamic>.from(e as Map)));
        _loading = false;
      });
    } catch (_) {
      // Use local defaults if API not yet implemented
      if (mounted) setState(() {
        _rules = [
          {'id': '1', 'title': 'No phones at dinner', 'description': 'All devices put away during family meal time', 'iconIndex': 1, 'colorIndex': 0, 'active': true},
          {'id': '2', 'title': 'Bedtime at 9 PM', 'description': 'Devices off and lights out by 9 PM on school nights', 'iconIndex': 2, 'colorIndex': 1, 'active': true},
          {'id': '3', 'title': 'Homework first', 'description': 'Homework must be completed before screen time', 'iconIndex': 3, 'colorIndex': 2, 'active': true},
        ];
        _loading = false;
      });
    }
  }

  Future<void> _toggleRule(Map<String, dynamic> rule, bool active) async {
    final id = rule['id']?.toString() ?? '';
    setState(() => rule['active'] = active);
    try {
      await ref.read(dioProvider).put('/profiles/family-rules/$id', data: {...rule, 'active': active});
    } catch (_) {
      if (mounted) setState(() => rule['active'] = !active);
    }
  }

  Future<void> _deleteRule(String id) async {
    setState(() => _rules.removeWhere((r) => r['id']?.toString() == id));
    try {
      await ref.read(dioProvider).delete('/profiles/family-rules/$id');
    } catch (_) {
      _load();
    }
  }

  void _showAddEditDialog({Map<String, dynamic>? existing}) {
    final titleCtl = TextEditingController(text: existing?['title'] as String? ?? '');
    final descCtl = TextEditingController(text: existing?['description'] as String? ?? '');
    int selectedIcon = (existing?['iconIndex'] as int?) ?? 0;
    int selectedColor = (existing?['colorIndex'] as int?) ?? 0;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text(existing != null ? 'Edit Rule' : 'New Family Rule',
            style: const TextStyle(fontWeight: FontWeight.w700)),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              TextField(
                controller: titleCtl,
                decoration: InputDecoration(
                  labelText: 'Rule title',
                  hintText: 'e.g. No phones at dinner',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descCtl,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: 'Description (optional)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Icon', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8, runSpacing: 8,
                children: List.generate(_iconOptions.length, (i) => GestureDetector(
                  onTap: () => setD(() => selectedIcon = i),
                  child: Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(
                      color: i == selectedIcon
                          ? _colorOptions[selectedColor].withOpacity(0.15)
                          : ShieldTheme.cardBg,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: i == selectedIcon ? _colorOptions[selectedColor] : ShieldTheme.divider,
                      ),
                    ),
                    child: Icon(_iconOptions[i],
                      color: i == selectedIcon ? _colorOptions[selectedColor] : ShieldTheme.textSecondary,
                      size: 20),
                  ),
                )),
              ),
              const SizedBox(height: 16),
              const Text('Color', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: List.generate(_colorOptions.length, (i) => GestureDetector(
                  onTap: () => setD(() => selectedColor = i),
                  child: Container(
                    width: 28, height: 28,
                    decoration: BoxDecoration(
                      color: _colorOptions[i],
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: i == selectedColor ? Colors.black54 : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    child: i == selectedColor
                        ? const Icon(Icons.check, color: Colors.white, size: 16)
                        : null,
                  ),
                )),
              ),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                final title = titleCtl.text.trim();
                if (title.isEmpty) return;
                Navigator.pop(ctx);
                final rule = {
                  'id': existing?['id'] ?? DateTime.now().millisecondsSinceEpoch.toString(),
                  'title': title,
                  'description': descCtl.text.trim(),
                  'iconIndex': selectedIcon,
                  'colorIndex': selectedColor,
                  'active': existing?['active'] ?? true,
                };
                setState(() {
                  if (existing != null) {
                    final idx = _rules.indexWhere((r) => r['id'] == existing['id']);
                    if (idx >= 0) _rules[idx] = rule;
                  } else {
                    _rules.add(rule);
                  }
                });
                try {
                  if (existing != null) {
                    await ref.read(dioProvider).put('/profiles/family-rules/${existing['id']}', data: rule);
                  } else {
                    await ref.read(dioProvider).post('/profiles/family-rules', data: rule);
                  }
                } catch (_) { _load(); }
              },
              child: Text(existing != null ? 'Save' : 'Add Rule'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Rules', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: ShieldTheme.primary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddEditDialog(),
        backgroundColor: ShieldTheme.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Rule', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: _loading
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: Column(children: [
                ShieldCardSkeleton(lines: 2), SizedBox(height: 10),
                ShieldCardSkeleton(lines: 2), SizedBox(height: 10),
                ShieldCardSkeleton(lines: 2),
              ]),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: _rules.isEmpty
                  ? Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.gavel_rounded, size: 64, color: ShieldTheme.divider),
                        const SizedBox(height: 16),
                        const Text('No family rules yet',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: ShieldTheme.textPrimary)),
                        const SizedBox(height: 8),
                        const Text('Tap + Add Rule to create household guidelines',
                          style: TextStyle(color: ShieldTheme.textSecondary), textAlign: TextAlign.center),
                        const SizedBox(height: 24),
                        FilledButton.icon(
                          onPressed: () => _showAddEditDialog(),
                          icon: const Icon(Icons.add_rounded),
                          label: const Text('Add First Rule'),
                          style: FilledButton.styleFrom(backgroundColor: ShieldTheme.primary),
                        ),
                      ]),
                    )
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: ShieldTheme.primary.withOpacity(0.07),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(children: [
                            const Icon(Icons.gavel_rounded, color: ShieldTheme.primary, size: 16),
                            const SizedBox(width: 8),
                            Expanded(child: Text(
                              '${_rules.length} rule${_rules.length == 1 ? "" : "s"} — ${_rules.where((r) => r['active'] == true).length} active',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: ShieldTheme.primary),
                            )),
                          ]),
                        ),
                        ..._rules.map((rule) {
                          final iconIdx = (rule['iconIndex'] as int? ?? 0).clamp(0, _iconOptions.length - 1);
                          final colorIdx = (rule['colorIndex'] as int? ?? 0).clamp(0, _colorOptions.length - 1);
                          final color = _colorOptions[colorIdx];
                          final active = rule['active'] == true;
                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            decoration: BoxDecoration(
                              color: ShieldTheme.cardBg,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: active ? color.withOpacity(0.3) : ShieldTheme.divider),
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
                              leading: Container(
                                width: 46, height: 46,
                                decoration: BoxDecoration(
                                  color: color.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(_iconOptions[iconIdx], color: color, size: 24),
                              ),
                              title: Text(rule['title'] as String? ?? '',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 14,
                                  color: active ? ShieldTheme.textPrimary : ShieldTheme.textSecondary,
                                )),
                              subtitle: (rule['description'] as String?)?.isNotEmpty == true
                                  ? Text(rule['description'] as String,
                                      style: const TextStyle(fontSize: 12.5, color: ShieldTheme.textSecondary))
                                  : null,
                              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                                Switch(
                                  value: active,
                                  onChanged: (v) => _toggleRule(rule, v),
                                  thumbColor: WidgetStateProperty.resolveWith((s) =>
                                    s.contains(WidgetState.selected) ? color : Colors.grey),
                                  trackColor: WidgetStateProperty.resolveWith((s) =>
                                    s.contains(WidgetState.selected) ? color.withOpacity(0.4) : Colors.grey.withOpacity(0.25)),
                                  trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
                                ),
                                PopupMenuButton<String>(
                                  icon: const Icon(Icons.more_vert_rounded, size: 20, color: ShieldTheme.textSecondary),
                                  onSelected: (v) {
                                    if (v == 'edit') _showAddEditDialog(existing: rule);
                                    if (v == 'delete') {
                                      showDialog(
                                        context: context,
                                        builder: (_) => AlertDialog(
                                          title: const Text('Delete Rule'),
                                          content: Text('Delete "${rule['title']}"?'),
                                          actions: [
                                            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                                            FilledButton(
                                              onPressed: () { Navigator.pop(context); _deleteRule(rule['id'].toString()); },
                                              style: FilledButton.styleFrom(backgroundColor: ShieldTheme.danger),
                                              child: const Text('Delete'),
                                            ),
                                          ],
                                        ),
                                      );
                                    }
                                  },
                                  itemBuilder: (_) => const [
                                    PopupMenuItem(value: 'edit', child: Row(children: [
                                      Icon(Icons.edit_rounded, size: 18), SizedBox(width: 10), Text('Edit'),
                                    ])),
                                    PopupMenuItem(value: 'delete', child: Row(children: [
                                      Icon(Icons.delete_outline_rounded, size: 18, color: Colors.red), SizedBox(width: 10),
                                      Text('Delete', style: TextStyle(color: Colors.red)),
                                    ])),
                                  ],
                                ),
                              ]),
                            ),
                          );
                        }),
                      ],
                    ),
            ),
    );
  }
}
