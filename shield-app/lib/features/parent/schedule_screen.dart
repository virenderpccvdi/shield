import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class ScheduleScreen extends ConsumerStatefulWidget {
  final String profileId;
  const ScheduleScreen({super.key, required this.profileId});
  @override
  ConsumerState<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends ConsumerState<ScheduleScreen> {
  // 7 days × 24 hours: true = blocked (1 in backend), false = allowed (0)
  late List<List<bool>> _grid;
  bool _loading = true;
  bool _saving = false;
  String? _activePreset;
  bool _overrideActive = false;
  String? _overrideType;
  String? _overrideEndsAt;
  bool? _paintValue; // null = not painting; during drag = value being applied

  // Backend uses full lowercase day keys — order matches Mon=0..Sun=6
  static const _dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  static const _dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  @override
  void initState() {
    super.initState();
    _grid = List.generate(7, (_) => List.filled(24, false));
    _loadSchedule();
  }

  Future<void> _loadSchedule() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/dns/schedules/${widget.profileId}');
      final data = (res.data['data'] ?? res.data) as Map<String, dynamic>? ?? {};
      _parseGrid(data);
    } catch (e) {
      debugPrint('[Shield] Schedule load: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Could not load schedule'),
          backgroundColor: ShieldTheme.warning,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  void _parseGrid(Map<String, dynamic> data) {
    final rawGrid = data['grid'] as Map<String, dynamic>? ?? {};
    final newGrid = List.generate(7, (_) => List.filled(24, false));
    for (int d = 0; d < 7; d++) {
      final hours = rawGrid[_dayKeys[d]] as List?;
      if (hours == null) continue;
      for (int h = 0; h < 24 && h < hours.length; h++) {
        // backend: 0 = allowed, 1 = blocked
        newGrid[d][h] = (hours[h] as int? ?? 0) == 1;
      }
    }
    _grid = newGrid;
    _activePreset = data['activePreset'] as String?;
    _overrideActive = data['overrideActive'] as bool? ?? false;
    _overrideType = data['overrideType'] as String?;
    _overrideEndsAt = data['overrideEndsAt'] as String?;
  }

  Map<String, List<int>> _buildApiGrid() {
    final result = <String, List<int>>{};
    for (int d = 0; d < 7; d++) {
      result[_dayKeys[d]] = List.generate(24, (h) => _grid[d][h] ? 1 : 0);
    }
    return result;
  }

  /// Returns (dayIndex, hourIndex) for a local position within the grid Column,
  /// or null if outside grid bounds.
  (int, int)? _hitTestCell(Offset pos) {
    // Grid layout constants (must match the build() code)
    const double headerH = 19.0;  // hour labels row + SizedBox(height:4)
    const double rowH    = 34.0;  // cell height 30 + margin*2(2) + padding*2(2) per row
    const double labelW  = 44.0;  // day label SizedBox width
    const double cellW   = 28.0;  // cell width 26 + margin*2(2)
    final double dy = pos.dy - headerH;
    if (dy < 0) return null;
    final int d = dy ~/ rowH;
    if (d < 0 || d >= 7) return null;
    final double dx = pos.dx - labelW;
    if (dx < 0) return null;
    final int h = dx ~/ cellW;
    if (h < 0 || h >= 24) return null;
    return (d, h);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final client = ref.read(dioProvider);
      await client.put('/dns/schedules/${widget.profileId}', data: {'grid': _buildApiGrid()});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Schedule saved'),
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

  Future<void> _applyServerPreset(String preset) async {
    try {
      final client = ref.read(dioProvider);
      final res = await client.post('/dns/schedules/${widget.profileId}/preset?preset=$preset');
      final data = (res.data['data'] ?? res.data) as Map<String, dynamic>? ?? {};
      setState(() => _parseGrid(data));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('$preset preset applied'),
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

  Future<void> _applyOverride(String type, int durationMins) async {
    try {
      final client = ref.read(dioProvider);
      final res = await client.post('/dns/schedules/${widget.profileId}/override',
          data: {'overrideType': type, 'durationMinutes': durationMins});
      final data = (res.data['data'] ?? res.data) as Map<String, dynamic>? ?? {};
      setState(() => _parseGrid(data));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Override failed: $e'),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    }
  }

  Future<void> _cancelOverride() async {
    try {
      final client = ref.read(dioProvider);
      final res = await client.delete('/dns/schedules/${widget.profileId}/override');
      final data = (res.data['data'] ?? res.data) as Map<String, dynamic>? ?? {};
      setState(() => _parseGrid(data));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Cancel failed: $e'),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    }
  }

  void _showOverrideDialog() {
    String type = 'PAUSE';
    int durationMins = 60;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: const Text('Apply Override', style: TextStyle(fontWeight: FontWeight.w700)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: type,
                decoration: const InputDecoration(labelText: 'Override Type', border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: 'PAUSE', child: Text('Pause Internet')),
                  DropdownMenuItem(value: 'HOMEWORK', child: Text('Homework Mode')),
                  DropdownMenuItem(value: 'FOCUS', child: Text('Focus Mode')),
                  DropdownMenuItem(value: 'BEDTIME_NOW', child: Text('Bedtime Now')),
                ],
                onChanged: (v) => setS(() => type = v!),
              ),
              const SizedBox(height: 12),
              TextFormField(
                initialValue: '60',
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Duration (minutes)',
                  helperText: '0 = until manually cancelled',
                  border: OutlineInputBorder(),
                ),
                onChanged: (v) => durationMins = int.tryParse(v) ?? 60,
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(
              onPressed: () { Navigator.pop(ctx); _applyOverride(type, durationMins); },
              style: FilledButton.styleFrom(backgroundColor: ShieldTheme.danger),
              child: const Text('Apply'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('Internet Schedule', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: ShieldTheme.cardBg,
        elevation: 0,
        actions: [
          if (_saving)
            const Padding(padding: EdgeInsets.all(16), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))
          else
            TextButton.icon(
              onPressed: _save,
              icon: const Icon(Icons.save_outlined),
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
          : RefreshIndicator(
              onRefresh: _loadSchedule,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Override banner
                    if (_overrideActive)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.all(12),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: ShieldTheme.warning.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: ShieldTheme.warning.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.pause_circle, color: ShieldTheme.warning),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Override Active: ${_overrideType ?? ''}',
                                      style: const TextStyle(fontWeight: FontWeight.w700, color: ShieldTheme.warning)),
                                  if (_overrideEndsAt != null)
                                    Text('Ends: ${_formatTime(_overrideEndsAt!)}',
                                        style: const TextStyle(fontSize: 12, color: ShieldTheme.warning)),
                                ],
                              ),
                            ),
                            TextButton(
                              onPressed: _cancelOverride,
                              child: const Text('Cancel', style: TextStyle(color: ShieldTheme.danger)),
                            ),
                          ],
                        ),
                      ),

                    // Presets
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Quick Presets', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: ShieldTheme.textSecondary)),
                          const SizedBox(height: 8),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(children: [
                              _PresetBtn(label: 'School Hours', icon: Icons.school, color: ShieldTheme.primary, onTap: () => _applyServerPreset('SCHOOL')),
                              const SizedBox(width: 8),
                              _PresetBtn(label: 'Bedtime', icon: Icons.bedtime, color: ShieldTheme.warning, onTap: () => _applyServerPreset('BEDTIME')),
                              const SizedBox(width: 8),
                              _PresetBtn(label: 'Weekend', icon: Icons.weekend, color: ShieldTheme.success, onTap: () => _applyServerPreset('WEEKEND')),
                              const SizedBox(width: 8),
                              _PresetBtn(label: 'Strict', icon: Icons.security, color: ShieldTheme.danger, onTap: () => _applyServerPreset('STRICT')),
                              const SizedBox(width: 8),
                              _PresetBtn(label: 'Override', icon: Icons.pause_circle, color: ShieldTheme.danger, onTap: _showOverrideDialog),
                              const SizedBox(width: 8),
                              _PresetBtn(label: 'Clear All', icon: Icons.clear_all, color: ShieldTheme.textSecondary, onTap: () {
                                setState(() {
                                  for (var row in _grid) { for (int h = 0; h < 24; h++) row[h] = false; }
                                  _activePreset = null;
                                });
                              }),
                            ]),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Legend
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(children: [
                        _LegendDot(color: ShieldTheme.danger, label: 'Blocked'),
                        const SizedBox(width: 16),
                        _LegendDot(color: ShieldTheme.success.withOpacity(0.3), label: 'Allowed'),
                        if (_activePreset != null) ...[
                          const Spacer(),
                          Chip(
                            label: Text(_activePreset!, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                            backgroundColor: ShieldTheme.primary.withOpacity(0.08),
                            side: BorderSide(color: ShieldTheme.primary.withOpacity(0.3)),
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ]),
                    ),

                    const SizedBox(height: 8),

                    // Grid
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Listener(
                        behavior: HitTestBehavior.opaque,
                        onPointerDown: (e) {
                          final cell = _hitTestCell(e.localPosition);
                          if (cell == null) return;
                          final (d, h) = cell;
                          final newVal = !_grid[d][h];
                          setState(() { _paintValue = newVal; _grid[d][h] = newVal; });
                        },
                        onPointerMove: (e) {
                          if (_paintValue == null) return;
                          final cell = _hitTestCell(e.localPosition);
                          if (cell == null) return;
                          final (d, h) = cell;
                          if (_grid[d][h] != _paintValue) setState(() => _grid[d][h] = _paintValue!);
                        },
                        onPointerUp: (_) { if (_paintValue != null) setState(() => _paintValue = null); },
                        onPointerCancel: (_) { if (_paintValue != null) setState(() => _paintValue = null); },
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Hour headers
                            Row(children: [
                              const SizedBox(width: 44),
                              ...List.generate(24, (h) => SizedBox(
                                width: 28,
                                child: Text(h.toString(), textAlign: TextAlign.center,
                                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600,
                                      color: (h >= 22 || h < 6) ? ShieldTheme.divider : ShieldTheme.textSecondary)),
                              )),
                            ]),
                            const SizedBox(height: 4),
                            // Day rows
                            ...List.generate(7, (d) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 2),
                              child: Row(children: [
                                SizedBox(
                                  width: 44,
                                  child: Text(_dayLabels[d],
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: d >= 5 ? ShieldTheme.warning : ShieldTheme.textSecondary,
                                    ),
                                  ),
                                ),
                                ...List.generate(24, (h) => AnimatedContainer(
                                  duration: const Duration(milliseconds: 120),
                                  width: 26,
                                  height: 30,
                                  margin: const EdgeInsets.all(1),
                                  decoration: BoxDecoration(
                                    color: _grid[d][h]
                                        ? ShieldTheme.danger.withOpacity(0.7)
                                        : ShieldTheme.success.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(
                                      color: _grid[d][h]
                                          ? ShieldTheme.danger.withOpacity(0.5)
                                          : ShieldTheme.success.withOpacity(0.3),
                                      width: 1,
                                    ),
                                  ),
                                )),
                              ]),
                            )),
                            const SizedBox(height: 16),
                          ],
                        ),
                      ),
                    ),

                    // Save button
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                      child: SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: FilledButton.icon(
                          onPressed: _saving ? null : _save,
                          icon: _saving
                              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.save),
                          label: Text(_saving ? 'Saving...' : 'Save Schedule'),
                          style: FilledButton.styleFrom(
                            backgroundColor: ShieldTheme.primary,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  String _formatTime(String iso) {
    try {
      return TimeOfDay.fromDateTime(DateTime.parse(iso).toLocal()).format(context);
    } catch (_) {
      return iso;
    }
  }
}

class _PresetBtn extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _PresetBtn({required this.label, required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 16, color: color),
      label: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: color.withOpacity(0.4)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Container(width: 14, height: 14, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
      const SizedBox(width: 5),
      Text(label, style: const TextStyle(fontSize: 12, color: ShieldTheme.textSecondary)),
    ]);
  }
}
