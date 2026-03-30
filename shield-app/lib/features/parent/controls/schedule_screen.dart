import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

final _scheduleProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>(
  (ref, pid) async {
    final resp = await ApiClient.instance.get(Endpoints.dnsSchedule(pid));
    final raw = resp.data as Map<String, dynamic>? ?? {};
    return (raw['data'] as Map<String, dynamic>?) ?? raw;
  },
);

class ScheduleScreen extends ConsumerWidget {
  const ScheduleScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_scheduleProvider(profileId));
    return Scaffold(
      appBar: AppBar(title: const Text('Internet Schedule')),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load schedule',
          onRetry: () => ref.invalidate(_scheduleProvider(profileId)),
        ),
        data: (d) => _ScheduleBody(profileId: profileId, data: d),
      ),
    );
  }
}

const _days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const _dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

class _ScheduleBody extends ConsumerStatefulWidget {
  const _ScheduleBody({required this.profileId, required this.data});
  final String profileId;
  final Map<String, dynamic> data;
  @override
  ConsumerState<_ScheduleBody> createState() => _ScheduleBodyState();
}

class _ScheduleBodyState extends ConsumerState<_ScheduleBody> {
  late Map<String, Map<String, String?>> _schedule;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _schedule = {};
    for (final day in _days) {
      final dayData = widget.data[day] as Map<String, dynamic>? ?? {};
      _schedule[day] = {
        'enabled':   (dayData['enabled'] as bool? ?? true).toString(),
        'startTime': dayData['startTime']?.toString() ?? '06:00',
        'endTime':   dayData['endTime']?.toString()   ?? '22:00',
      };
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ApiClient.instance.put(Endpoints.dnsSchedule(widget.profileId), data: {
        for (final day in _days) day: {
          'enabled':   _schedule[day]!['enabled'] == 'true',
          'startTime': _schedule[day]!['startTime'],
          'endTime':   _schedule[day]!['endTime'],
        }
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Schedule saved'), backgroundColor: Colors.green));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickTime(String day, bool isStart) async {
    final parts = (_schedule[day]![isStart ? 'startTime' : 'endTime'] ?? '08:00').split(':');
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1])),
    );
    if (picked == null) return;
    setState(() {
      _schedule[day]![isStart ? 'startTime' : 'endTime'] =
          '${picked.hour.toString().padLeft(2,'0')}:${picked.minute.toString().padLeft(2,'0')}';
    });
  }

  @override
  Widget build(BuildContext context) => Column(children: [
    Expanded(
      child: ListView(children: [
        const SectionHeader('Internet Hours by Day'),
        for (var i = 0; i < _days.length; i++) _dayRow(_days[i], _dayLabels[i]),
        const SizedBox(height: 8),
      ]),
    ),
    Padding(
      padding: const EdgeInsets.all(16),
      child: ElevatedButton(
        onPressed: _saving ? null : _save,
        child: _saving
            ? const SizedBox(height: 20, width: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Text('Save Schedule'),
      ),
    ),
  ]);

  Widget _dayRow(String day, String label) {
    final enabled = _schedule[day]!['enabled'] == 'true';
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(children: [
          SizedBox(width: 36, child: Text(label,
              style: const TextStyle(fontWeight: FontWeight.w600))),
          Switch(
            value:    enabled,
            onChanged: (v) => setState(() => _schedule[day]!['enabled'] = v.toString()),
          ),
          if (enabled) ...[
            const Spacer(),
            TextButton(
              onPressed: () => _pickTime(day, true),
              child: Text(_schedule[day]!['startTime'] ?? '06:00'),
            ),
            const Text('–'),
            TextButton(
              onPressed: () => _pickTime(day, false),
              child: Text(_schedule[day]!['endTime'] ?? '22:00'),
            ),
          ] else ...[
            const Expanded(child: Text('Blocked all day',
                style: TextStyle(color: Colors.black38, fontSize: 13))),
          ],
        ]),
      ),
    );
  }
}
