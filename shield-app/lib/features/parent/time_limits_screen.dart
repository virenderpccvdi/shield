import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class TimeLimitsScreen extends ConsumerStatefulWidget {
  final String profileId;
  const TimeLimitsScreen({super.key, required this.profileId});
  @override
  ConsumerState<TimeLimitsScreen> createState() => _TimeLimitsScreenState();
}

class _TimeLimitsScreenState extends ConsumerState<TimeLimitsScreen> {
  Map<String, int> _budgets = {}; // category -> minutes
  Map<String, int> _used = {}; // category -> minutes used today
  int _totalBudget = 120;
  int _totalUsed = 0;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);

      // Load budgets and today's usage in parallel
      final results = await Future.wait([
        client.get('/dns/budgets/${widget.profileId}').catchError((_) => null),
        client.get('/dns/budgets/${widget.profileId}/today').catchError((_) => null),
      ], eagerError: false);

      // Parse budgets
      try {
        final budgetRes = results[0];
        if (budgetRes != null) {
          final data = (budgetRes as dynamic).data['data'] as Map<String, dynamic>? ?? {};
          _totalBudget = data['totalMinutes'] as int? ?? 120;
          final cats = data['categories'] as Map<String, dynamic>? ?? {};
          _budgets = cats.map((k, v) => MapEntry(k, (v as num).toInt()));
        } else {
          _budgets = {'SOCIAL_MEDIA': 30, 'GAMING': 60, 'STREAMING': 45, 'GENERAL': 120};
          _totalBudget = 120;
        }
      } catch (_) {
        _budgets = {'SOCIAL_MEDIA': 30, 'GAMING': 60, 'STREAMING': 45, 'GENERAL': 120};
        _totalBudget = 120;
      }

      // Parse today's usage
      try {
        final usageRes = results[1];
        if (usageRes != null) {
          final usage = (usageRes as dynamic).data['data'] as Map<String, dynamic>? ?? {};
          _totalUsed = usage['totalUsedMinutes'] as int? ?? 0;
          final usedCats = usage['categories'] as Map<String, dynamic>? ?? {};
          _used = usedCats.map((k, v) => MapEntry(k, (v as num).toInt()));
        } else {
          _totalUsed = 0;
          _used = {};
        }
      } catch (_) {
        _totalUsed = 0;
        _used = {};
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final client = ref.read(dioProvider);
      await client.put('/dns/budgets/${widget.profileId}', data: {
        'totalMinutes': _totalBudget,
        'categories': _budgets,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Time limits saved'),
          backgroundColor: ShieldTheme.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to save: $e'),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _extendTime() async {
    final minutes = await showDialog<int>(
      context: context,
      builder: (ctx) {
        int selected = 15;
        return StatefulBuilder(builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Extend Time'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Add extra minutes for today:'),
            const SizedBox(height: 16),
            Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
              for (final m in [15, 30, 60])
                ChoiceChip(
                  label: Text('${m}m'),
                  selected: selected == m,
                  onSelected: (_) => setDialogState(() => selected = m),
                ),
            ]),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, selected), child: const Text('Extend')),
          ],
        ));
      },
    );

    if (minutes != null) {
      try {
        final client = ref.read(dioProvider);
        await client.post('/dns/budgets/${widget.profileId}/extend', data: {'minutes': minutes});
        setState(() => _totalBudget += minutes);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Added $minutes extra minutes'),
            backgroundColor: ShieldTheme.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Failed: $e'),
            backgroundColor: ShieldTheme.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
        }
      }
    }
  }

  String _formatMinutes(int m) {
    if (m >= 60) return '${m ~/ 60}h ${m % 60}m';
    return '${m}m';
  }

  @override
  Widget build(BuildContext context) {
    final usagePercent = _totalBudget > 0 ? (_totalUsed / _totalBudget).clamp(0.0, 1.0) : 0.0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Time Limits', style: TextStyle(fontWeight: FontWeight.w700)),
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
        ? const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 4),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 3),
          ]))
        : ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Today's usage overview
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(children: [
                    Row(children: [
                      const Icon(Icons.timer, color: ShieldTheme.primary),
                      const SizedBox(width: 8),
                      const Text("Today's Usage", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      const Spacer(),
                      Text('${_formatMinutes(_totalUsed)} / ${_formatMinutes(_totalBudget)}',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    ]),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: usagePercent,
                        minHeight: 12,
                        backgroundColor: ShieldTheme.divider,
                        color: usagePercent > 0.9
                            ? ShieldTheme.danger
                            : usagePercent > 0.7
                                ? ShieldTheme.warning
                                : ShieldTheme.primary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      usagePercent >= 1.0
                        ? 'Time budget exhausted!'
                        : '${_formatMinutes((_totalBudget - _totalUsed).clamp(0, _totalBudget))} remaining',
                      style: TextStyle(
                        color: usagePercent >= 1.0 ? ShieldTheme.danger : ShieldTheme.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: 8),
              // Extend time button
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _extendTime,
                  icon: const Icon(Icons.add_alarm),
                  label: const Text('Extend Time for Today'),
                ),
              ),
              const SizedBox(height: 20),
              // Total daily budget
              const Text('Daily Budget', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(children: [
                    Row(children: [
                      const Text('Total daily limit'),
                      const Spacer(),
                      Text(_formatMinutes(_totalBudget), style: const TextStyle(fontWeight: FontWeight.w700)),
                    ]),
                    Slider(
                      value: _totalBudget.toDouble(),
                      min: 0,
                      max: 480,
                      divisions: 32,
                      label: _formatMinutes(_totalBudget),
                      onChanged: (v) => setState(() => _totalBudget = v.round()),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: 20),
              // Category budgets
              const Text('Category Limits', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 8),
              ..._budgets.entries.map((entry) {
                final used = _used[entry.key] ?? 0;
                final budget = entry.value;
                final pct = budget > 0 ? (used / budget).clamp(0.0, 1.0) : 0.0;
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Text(_formatCat(entry.key), style: const TextStyle(fontWeight: FontWeight.w600)),
                          const Spacer(),
                          Text('${_formatMinutes(used)} / ${_formatMinutes(budget)}',
                            style: const TextStyle(fontSize: 12, color: ShieldTheme.textSecondary)),
                        ]),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: pct,
                            minHeight: 6,
                            backgroundColor: ShieldTheme.divider,
                            color: pct > 0.9 ? ShieldTheme.danger : ShieldTheme.primary,
                          ),
                        ),
                        Slider(
                          value: budget.toDouble().clamp(0, 480),
                          min: 0,
                          max: 480,
                          divisions: 32,
                          label: _formatMinutes(budget),
                          onChanged: (v) => setState(() => _budgets[entry.key] = v.round()),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ],
          ),
    );
  }

  String _formatCat(String key) {
    return key.replaceAll('_', ' ').split(' ').map((w) =>
      w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}'
    ).join(' ');
  }
}
