import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class BatteryAlertsScreen extends ConsumerStatefulWidget {
  final String profileId;
  const BatteryAlertsScreen({super.key, required this.profileId});
  @override
  ConsumerState<BatteryAlertsScreen> createState() => _BatteryAlertsScreenState();
}

class _BatteryAlertsScreenState extends ConsumerState<BatteryAlertsScreen> {
  bool _loading = true;
  bool _saving = false;
  int _threshold = 20;
  int _currentLevel = -1; // -1 = unknown
  bool _alertEnabled = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);

      // Load battery settings
      try {
        final settingsRes = await client.get('/location/${widget.profileId}/battery-settings');
        final data = settingsRes.data['data'] ?? settingsRes.data;
        if (data is Map) {
          _threshold = (data['threshold'] as num?)?.toInt() ?? 20;
          _alertEnabled = data['enabled'] != false;
        }
      } catch (_) {}

      // Load current battery level from latest location data
      try {
        final locationRes = await client.get('/location/${widget.profileId}/latest');
        final data = locationRes.data['data'] ?? locationRes.data;
        if (data is Map) {
          _currentLevel = (data['batteryLevel'] as num?)?.toInt() ?? -1;
        }
      } catch (_) {}
    } catch (e) {
      debugPrint('Battery settings error: $e');
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final client = ref.read(dioProvider);
      await client.put('/location/${widget.profileId}/battery-settings', data: {
        'threshold': _threshold,
        'enabled': _alertEnabled,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Battery alert settings saved'),
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

  Color _batteryColor(int level) {
    if (level <= 15) return ShieldTheme.danger;
    if (level <= 30) return ShieldTheme.warning;
    return ShieldTheme.success;
  }

  IconData _batteryIcon(int level) {
    if (level <= 15) return Icons.battery_alert;
    if (level <= 30) return Icons.battery_2_bar;
    if (level <= 60) return Icons.battery_4_bar;
    return Icons.battery_full;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('Battery Alerts', style: TextStyle(fontWeight: FontWeight.w700)),
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
                ShieldCardSkeleton(lines: 3),
                SizedBox(height: 12),
                ShieldCardSkeleton(lines: 2),
              ]))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Current battery level
                if (_currentLevel >= 0)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(children: [
                        Icon(_batteryIcon(_currentLevel), size: 48, color: _batteryColor(_currentLevel)),
                        const SizedBox(height: 10),
                        Text('$_currentLevel%',
                            style: TextStyle(
                                fontSize: 32, fontWeight: FontWeight.w800, color: _batteryColor(_currentLevel))),
                        const SizedBox(height: 4),
                        const Text('Current Battery Level',
                            style: TextStyle(fontSize: 13, color: ShieldTheme.textSecondary)),
                      ]),
                    ),
                  )
                else
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(children: [
                        Icon(Icons.battery_unknown, size: 48, color: ShieldTheme.textSecondary.withOpacity(0.5)),
                        const SizedBox(height: 10),
                        const Text('Battery level unavailable',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: ShieldTheme.textSecondary)),
                        const SizedBox(height: 4),
                        const Text('Data will appear once the child device reports in.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: ShieldTheme.textSecondary)),
                      ]),
                    ),
                  ),
                const SizedBox(height: 20),

                // Alert toggle
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: ShieldTheme.warning.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.notifications_active, color: ShieldTheme.warning, size: 24),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Low Battery Alerts', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                            SizedBox(height: 2),
                            Text('Get notified when battery drops below threshold',
                                style: TextStyle(fontSize: 12, color: ShieldTheme.textSecondary)),
                          ],
                        ),
                      ),
                      Switch(
                        value: _alertEnabled,
                        onChanged: (v) => setState(() => _alertEnabled = v),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 20),

                // Threshold slider
                const Text('Alert Threshold', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 8),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(children: [
                      Row(children: [
                        const Text('Alert when battery drops below'),
                        const Spacer(),
                        Text('$_threshold%',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: ShieldTheme.primary)),
                      ]),
                      const SizedBox(height: 8),
                      Slider(
                        value: _threshold.toDouble(),
                        min: 5,
                        max: 50,
                        divisions: 9,
                        label: '$_threshold%',
                        onChanged: _alertEnabled ? (v) => setState(() => _threshold = v.round()) : null,
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('5%', style: TextStyle(fontSize: 11, color: ShieldTheme.textSecondary)),
                          Text('50%', style: TextStyle(fontSize: 11, color: ShieldTheme.textSecondary)),
                        ],
                      ),
                    ]),
                  ),
                ),
              ],
            ),
    );
  }
}
