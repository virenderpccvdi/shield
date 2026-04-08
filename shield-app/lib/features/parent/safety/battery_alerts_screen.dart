import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/widgets/common_widgets.dart';

class BatteryAlertsScreen extends ConsumerStatefulWidget {
  const BatteryAlertsScreen({super.key, required this.profileId});
  final String profileId;
  @override
  ConsumerState<BatteryAlertsScreen> createState() => _BatteryAlertsState();
}

class _BatteryAlertsState extends ConsumerState<BatteryAlertsScreen> {
  bool _enabled  = true;
  int  _threshold = 20;
  bool _loading  = true;
  bool _saving   = false;

  @override
  void initState() { super.initState(); _fetch(); }

  Future<void> _fetch() async {
    try {
      final resp = await ApiClient.instance.get(
          '/profiles/children/${widget.profileId}/battery-alerts');
      final d = resp.data as Map<String, dynamic>? ?? {};
      setState(() {
        _enabled    = d['enabled'] as bool? ?? true;
        _threshold  = ((d['threshold'] as num?) ?? 20).toInt();
        _loading    = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ApiClient.instance.put(
        '/profiles/children/${widget.profileId}/battery-alerts',
        data: {'enabled': _enabled, 'threshold': _threshold},
      );
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Saved'), backgroundColor: Colors.green));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save')));
    } finally { if (mounted) setState(() => _saving = false); }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Battery Alerts')),
    body: _loading
        ? const Center(child: CircularProgressIndicator())
        : Column(children: [
            Expanded(child: ListView(children: [
              SwitchListTile(
                secondary:  const Icon(Icons.battery_alert, color: Colors.orange),
                title:      const Text('Battery Low Alerts',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle:   const Text('Get notified when your child\'s battery is low'),
                value:      _enabled,
                onChanged:  (v) => setState(() => _enabled = v),
              ),
              if (_enabled) ...[
                const Divider(),
                const SectionHeader('Alert Threshold'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Alert when below $_threshold%',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold,
                            color: Colors.orange)),
                    Slider(
                      value:      _threshold.toDouble(),
                      min:        5, max: 50, divisions: 9,
                      label:      '$_threshold%',
                      activeColor: Colors.orange,
                      onChanged:  (v) => setState(() => _threshold = v.round()),
                    ),
                  ]),
                ),
              ],
            ])),
            Padding(
              padding: const EdgeInsets.all(16),
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(height: 20, width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Save'),
              ),
            ),
          ]),
  );
}
