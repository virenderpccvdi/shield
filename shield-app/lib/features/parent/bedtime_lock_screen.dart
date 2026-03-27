import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class BedtimeLockScreen extends ConsumerStatefulWidget {
  final String profileId;
  const BedtimeLockScreen({super.key, required this.profileId});
  @override
  ConsumerState<BedtimeLockScreen> createState() => _BedtimeLockScreenState();
}

class _BedtimeLockScreenState extends ConsumerState<BedtimeLockScreen> {
  bool _loading = true;
  bool _saving = false;
  bool _enabled = false;
  TimeOfDay _startTime = const TimeOfDay(hour: 21, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 7, minute: 0);

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/dns/rules/${widget.profileId}/bedtime/status');
      final data = res.data['data'] ?? res.data;
      if (data is Map) {
        _enabled = data['enabled'] == true;
        if (data['startTime'] != null) _startTime = _parseTime(data['startTime'].toString());
        if (data['endTime'] != null) _endTime = _parseTime(data['endTime'].toString());
      }
    } catch (e) {
      debugPrint('Bedtime load error: $e');
    }
    if (mounted) setState(() => _loading = false);
  }

  TimeOfDay _parseTime(String t) {
    try {
      final parts = t.split(':');
      return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
    } catch (_) {
      return const TimeOfDay(hour: 21, minute: 0);
    }
  }

  String _formatTime(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  String _formatTimeDisplay(TimeOfDay t) => t.format(context);

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? _startTime : _endTime,
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final client = ref.read(dioProvider);
      await client.post('/dns/rules/${widget.profileId}/bedtime/configure', data: {
        'enabled': _enabled,
        'startTime': _formatTime(_startTime),
        'endTime': _formatTime(_endTime),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Bedtime settings saved'),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('Bedtime Lock', style: TextStyle(fontWeight: FontWeight.w700)),
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
                // Enable/disable card
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: ShieldTheme.primaryDark.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(Icons.bedtime,
                            color: _enabled ? ShieldTheme.primaryDark : ShieldTheme.textSecondary, size: 28),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Bedtime Mode', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                            const SizedBox(height: 2),
                            Text(
                              _enabled ? 'Internet will be blocked during bedtime' : 'Tap to enable bedtime restrictions',
                              style: const TextStyle(fontSize: 12, color: ShieldTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      Switch(
                        value: _enabled,
                        onChanged: (v) => setState(() => _enabled = v),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 20),

                // Time picker cards
                const Text('Schedule', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 8),
                Card(
                  child: Column(children: [
                    ListTile(
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: ShieldTheme.warning.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.nightlight_round, color: ShieldTheme.warning, size: 20),
                      ),
                      title: const Text('Bedtime starts', style: TextStyle(fontWeight: FontWeight.w600)),
                      trailing: TextButton(
                        onPressed: () => _pickTime(true),
                        child: Text(_formatTimeDisplay(_startTime),
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      ),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: ShieldTheme.success.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.wb_sunny, color: ShieldTheme.success, size: 20),
                      ),
                      title: const Text('Wake-up time', style: TextStyle(fontWeight: FontWeight.w600)),
                      trailing: TextButton(
                        onPressed: () => _pickTime(false),
                        child: Text(_formatTimeDisplay(_endTime),
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      ),
                    ),
                  ]),
                ),
                const SizedBox(height: 20),

                // Info card
                Card(
                  color: ShieldTheme.primary.withOpacity(0.05),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline, color: ShieldTheme.primary.withOpacity(0.6), size: 20),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'During bedtime, all internet access will be blocked on your child\'s device. '
                            'Emergency services and pre-approved contacts will still be reachable.',
                            style: TextStyle(fontSize: 12, color: ShieldTheme.textSecondary, height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
