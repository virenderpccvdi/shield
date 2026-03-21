import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';

class ScheduleScreen extends ConsumerStatefulWidget {
  final String profileId;
  const ScheduleScreen({super.key, required this.profileId});
  @override
  ConsumerState<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends ConsumerState<ScheduleScreen> {
  // 7 days x 24 hours grid: true = blocked
  late List<List<bool>> _grid;
  bool _loading = true;
  bool _saving = false;
  int? _dragStartDay;
  bool? _dragValue;

  static const _days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  static const _daysFull = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  @override
  void initState() {
    super.initState();
    _grid = List.generate(7, (_) => List.filled(24, false));
    _loadSchedule();
  }

  Future<void> _loadSchedule() async {
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/dns/schedules/${widget.profileId}');
      final data = res.data['data'] as Map<String, dynamic>? ?? {};
      final blocks = data['blocks'] as List? ?? [];
      for (final block in blocks) {
        final b = block as Map<String, dynamic>;
        final dayIdx = _daysFull.indexOf(b['day'] ?? '');
        if (dayIdx < 0) continue;
        final from = b['fromHour'] as int? ?? 0;
        final to = b['toHour'] as int? ?? 0;
        for (int h = from; h < to && h < 24; h++) {
          _grid[dayIdx][h] = true;
        }
      }
    } catch (e) {
      debugPrint('[Shield] Schedule load failed: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not load schedule'), backgroundColor: Colors.orange),
        );
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final blocks = <Map<String, dynamic>>[];
      for (int d = 0; d < 7; d++) {
        int? start;
        for (int h = 0; h <= 24; h++) {
          final blocked = h < 24 && _grid[d][h];
          if (blocked && start == null) {
            start = h;
          } else if (!blocked && start != null) {
            blocks.add({'day': _daysFull[d], 'fromHour': start, 'toHour': h});
            start = null;
          }
        }
      }
      final client = ref.read(dioProvider);
      await client.put('/dns/schedules/${widget.profileId}', data: {'blocks': blocks});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Schedule saved'), backgroundColor: Colors.green),
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

  void _applyPreset(String preset) {
    setState(() {
      for (int d = 0; d < 7; d++) {
        for (int h = 0; h < 24; h++) {
          _grid[d][h] = false;
        }
      }
      switch (preset) {
        case 'school':
          // Mon-Fri: block 8am-3pm (school hours)
          for (int d = 0; d < 5; d++) {
            for (int h = 8; h < 15; h++) _grid[d][h] = true;
          }
          // Block 9pm-7am (bedtime) all days
          for (int d = 0; d < 7; d++) {
            for (int h = 21; h < 24; h++) _grid[d][h] = true;
            for (int h = 0; h < 7; h++) _grid[d][h] = true;
          }
          break;
        case 'weekend':
          // Weekends: block 10pm-8am only
          for (int d = 5; d < 7; d++) {
            for (int h = 22; h < 24; h++) _grid[d][h] = true;
            for (int h = 0; h < 8; h++) _grid[d][h] = true;
          }
          break;
        case 'bedtime':
          // All days: block 9pm-7am
          for (int d = 0; d < 7; d++) {
            for (int h = 21; h < 24; h++) _grid[d][h] = true;
            for (int h = 0; h < 7; h++) _grid[d][h] = true;
          }
          break;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Internet Schedule', style: TextStyle(fontWeight: FontWeight.w700)),
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
              // Presets
              Padding(
                padding: const EdgeInsets.all(12),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    _PresetChip(label: 'School Day', icon: Icons.school, onTap: () => _applyPreset('school')),
                    const SizedBox(width: 8),
                    _PresetChip(label: 'Weekend', icon: Icons.weekend, onTap: () => _applyPreset('weekend')),
                    const SizedBox(width: 8),
                    _PresetChip(label: 'Bedtime Only', icon: Icons.bedtime, onTap: () => _applyPreset('bedtime')),
                    const SizedBox(width: 8),
                    _PresetChip(label: 'Clear All', icon: Icons.clear_all, onTap: () {
                      setState(() {
                        for (var row in _grid) { for (int h = 0; h < 24; h++) row[h] = false; }
                      });
                    }),
                  ]),
                ),
              ),
              // Legend
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(children: [
                  Container(width: 14, height: 14, decoration: BoxDecoration(color: Colors.red.shade400, borderRadius: BorderRadius.circular(3))),
                  const SizedBox(width: 6),
                  const Text('Blocked', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(width: 16),
                  Container(width: 14, height: 14, decoration: BoxDecoration(color: Colors.green.shade100, borderRadius: BorderRadius.circular(3))),
                  const SizedBox(width: 6),
                  const Text('Allowed', style: TextStyle(fontSize: 12, color: Colors.grey)),
                ]),
              ),
              const SizedBox(height: 8),
              // Grid
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: SizedBox(
                    width: 50.0 + 24 * 28.0,
                    child: Column(
                      children: [
                        // Hour headers
                        Row(children: [
                          const SizedBox(width: 50),
                          ...List.generate(24, (h) => SizedBox(
                            width: 28,
                            child: Text('${h.toString().padLeft(2, '0')}', textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 9, color: Colors.grey)),
                          )),
                        ]),
                        const SizedBox(height: 4),
                        // Day rows
                        Expanded(
                          child: ListView.builder(
                            itemCount: 7,
                            itemBuilder: (_, d) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 2),
                              child: Row(children: [
                                SizedBox(width: 50, child: Text(_days[d],
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
                                ...List.generate(24, (h) => GestureDetector(
                                  onTapDown: (_) => setState(() => _grid[d][h] = !_grid[d][h]),
                                  onPanStart: (_) {
                                    _dragStartDay = d;
                                    _dragValue = !_grid[d][h];
                                    setState(() => _grid[d][h] = _dragValue!);
                                  },
                                  onPanUpdate: (details) {
                                    final box = context.findRenderObject() as RenderBox?;
                                    if (box == null) return;
                                    // Simple horizontal drag within the same row
                                    final localX = details.localPosition.dx;
                                    final hourIdx = ((localX - 50) / 28).floor().clamp(0, 23);
                                    if (_dragValue != null && _dragStartDay == d) {
                                      setState(() => _grid[d][hourIdx] = _dragValue!);
                                    }
                                  },
                                  child: Container(
                                    width: 26,
                                    height: 32,
                                    margin: const EdgeInsets.all(1),
                                    decoration: BoxDecoration(
                                      color: _grid[d][h] ? Colors.red.shade400 : Colors.green.shade50,
                                      borderRadius: BorderRadius.circular(3),
                                    ),
                                  ),
                                )),
                              ]),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
    );
  }
}

class _PresetChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  const _PresetChip({required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: Icon(icon, size: 18),
      label: Text(label, style: const TextStyle(fontSize: 13)),
      onPressed: onTap,
    );
  }
}
