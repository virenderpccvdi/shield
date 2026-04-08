import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

final _timeLimitsProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
  (ref, pid) async {
    final resp = await ApiClient.instance.get(Endpoints.dnsTimeLimits(pid));
    final raw = resp.data as Map<String, dynamic>? ?? {};
    return (raw['data'] as Map<String, dynamic>?) ?? raw;
  },
);

class TimeLimitsScreen extends ConsumerStatefulWidget {
  const TimeLimitsScreen({super.key, required this.profileId});
  final String profileId;
  @override
  ConsumerState<TimeLimitsScreen> createState() => _TimeLimitsState();
}

class _TimeLimitsState extends ConsumerState<TimeLimitsScreen> {
  int  _dailyMinutes = 240; // 4 hours default
  int  _usedToday    = 0;
  bool _loading      = false;
  bool _saving       = false;
  bool _noLimit      = false;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    try {
      final resp = await ApiClient.instance.get(Endpoints.dnsTimeLimits(widget.profileId));
      final raw  = resp.data as Map<String, dynamic>? ?? {};
      final data = (raw['data'] as Map<String, dynamic>?) ?? raw;
      setState(() {
        final limit = data['dailyBudgetMinutes'];
        _noLimit      = (limit == null || limit == 0);
        _dailyMinutes = _noLimit ? 240 : ((limit as num).toInt());
        _usedToday    = ((data['usedMinutesToday'] as num?) ?? 0).toInt();
        _loading      = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ApiClient.instance.put(
        Endpoints.dnsTimeLimits(widget.profileId),
        data: {'dailyBudgetMinutes': _noLimit ? 0 : _dailyMinutes},
      );
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Time limits saved'), backgroundColor: Colors.green));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _fmt(int mins) {
    final h = mins ~/ 60;
    final m = mins % 60;
    if (h == 0) return '${m}m';
    if (m == 0) return '${h}h';
    return '${h}h ${m}m';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Screen Time Limits')),
    body: _loading
        ? const Center(child: CircularProgressIndicator())
        : Column(children: [
            Expanded(child: ListView(children: [

              // Usage summary
              if (_usedToday > 0)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: Card(
                    color: const Color(0xFF1565C0).withOpacity(0.07),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(children: [
                        const Icon(Icons.timer, color: Color(0xFF1565C0), size: 20),
                        const SizedBox(width: 8),
                        Text('Used today: ${_fmt(_usedToday)}',
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                        if (!_noLimit) ...[
                          const Spacer(),
                          Text('of ${_fmt(_dailyMinutes)}',
                              style: const TextStyle(color: Colors.black45, fontSize: 13)),
                        ],
                      ]),
                    ),
                  ),
                ),

              SwitchListTile(
                secondary:  const Icon(Icons.timer_off_outlined),
                title:      const Text('No daily limit',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle:   const Text('Child can use internet without restriction'),
                value:      _noLimit,
                onChanged:  (v) => setState(() => _noLimit = v),
              ),

              if (!_noLimit) ...[
                const SectionHeader('Daily Limit'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_fmt(_dailyMinutes),
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold,
                            color: Color(0xFF1565C0))),
                    Slider(
                      value:     _dailyMinutes.toDouble(),
                      min:       30, max: 720, divisions: 23,
                      label:     _fmt(_dailyMinutes),
                      onChanged: (v) => setState(() => _dailyMinutes = v.round()),
                    ),
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      const Text('30m', style: TextStyle(color: Colors.black38)),
                      const Text('12h',  style: TextStyle(color: Colors.black38)),
                    ]),
                  ]),
                ),
              ],

              const SizedBox(height: 8),
            ])),
            Padding(
              padding: const EdgeInsets.all(16),
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(height: 20, width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Save Limits'),
              ),
            ),
          ]),
  );
}
