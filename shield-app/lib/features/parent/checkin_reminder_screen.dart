import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

// ── Providers ────────────────────────────────────────────────────────────────

final _checkinProfilesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  try {
    final res = await ref.read(dioProvider).get('/profiles/children');
    final d = res.data['data'];
    List<dynamic> raw;
    if (d is List) {
      raw = d;
    } else if (d is Map) {
      raw = (d['content'] ?? d['items'] ?? []) as List;
    } else {
      raw = [];
    }
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  } catch (_) {
    return [];
  }
});

// ── Screen ───────────────────────────────────────────────────────────────────

/// PS-02: Check-in Reminder Screen
///
/// Parent configures periodic check-in reminders for each child profile.
/// Shield will push a notification if the child does not check in within
/// the configured interval during active (non-quiet) hours.
class CheckinReminderScreen extends ConsumerStatefulWidget {
  /// Pre-selected profileId — optional. If null, profile selector is shown.
  final String? profileId;
  const CheckinReminderScreen({super.key, this.profileId});

  @override
  ConsumerState<CheckinReminderScreen> createState() => _CheckinReminderScreenState();
}

class _CheckinReminderScreenState extends ConsumerState<CheckinReminderScreen> {
  String? _selectedProfileId;
  bool _loadingSettings = false;
  bool _saving = false;

  // Settings state
  bool _enabled = false;
  int _intervalMin = 30;
  TimeOfDay _quietStart = const TimeOfDay(hour: 22, minute: 0);
  TimeOfDay _quietEnd = const TimeOfDay(hour: 7, minute: 0);
  bool _settingsLoaded = false;

  static const _intervalOptions = [
    (label: '15 min',   minutes: 15),
    (label: '30 min',   minutes: 30),
    (label: '1 hour',   minutes: 60),
    (label: '2 hours',  minutes: 120),
  ];

  @override
  void initState() {
    super.initState();
    _selectedProfileId = widget.profileId;
    if (_selectedProfileId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadSettings());
    }
  }

  Future<void> _loadSettings() async {
    final pid = _selectedProfileId;
    if (pid == null || pid.isEmpty) return;
    setState(() { _loadingSettings = true; _settingsLoaded = false; });
    try {
      final res = await ref.read(dioProvider).get('/location/checkin-settings/$pid');
      final d = res.data['data'] as Map<String, dynamic>? ?? {};
      if (mounted) {
        setState(() {
          _enabled = (d['enabled'] as bool?) ?? false;
          _intervalMin = (d['intervalMinutes'] ?? d['interval_minutes'] ?? 30) as int;
          final qs = d['quietStart']?.toString() ?? d['quiet_start']?.toString();
          final qe = d['quietEnd']?.toString() ?? d['quiet_end']?.toString();
          if (qs != null) _quietStart = _parseTime(qs) ?? _quietStart;
          if (qe != null) _quietEnd = _parseTime(qe) ?? _quietEnd;
          _loadingSettings = false;
          _settingsLoaded = true;
        });
      }
    } catch (_) {
      // 404 = no settings yet — use defaults
      if (mounted) {
        setState(() {
          _loadingSettings = false;
          _settingsLoaded = true;
        });
      }
    }
  }

  Future<void> _saveSettings() async {
    final pid = _selectedProfileId;
    if (pid == null || pid.isEmpty) return;
    setState(() => _saving = true);
    try {
      await ref.read(dioProvider).post(
        '/location/checkin-settings/$pid',
        data: {
          'enabled': _enabled,
          'intervalMinutes': _intervalMin,
          'quietStart': _formatTimeForApi(_quietStart),
          'quietEnd': _formatTimeForApi(_quietEnd),
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(children: [
              Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
              SizedBox(width: 8),
              Text('Settings saved'),
            ]),
            behavior: SnackBarBehavior.floating,
            backgroundColor: ShieldTheme.success,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save: $e'),
            backgroundColor: ShieldTheme.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickTime(bool isStart) async {
    final initial = isStart ? _quietStart : _quietEnd;
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      helpText: isStart ? 'Quiet hours start' : 'Quiet hours end',
    );
    if (picked != null && mounted) {
      setState(() {
        if (isStart) {
          _quietStart = picked;
        } else {
          _quietEnd = picked;
        }
      });
    }
  }

  TimeOfDay? _parseTime(String s) {
    try {
      final parts = s.split(':');
      if (parts.length < 2) return null;
      return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
    } catch (_) {
      return null;
    }
  }

  String _formatTimeForApi(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  String _formatTimeDisplay(TimeOfDay t) {
    final period = t.hour >= 12 ? 'PM' : 'AM';
    final hour = t.hour > 12 ? t.hour - 12 : (t.hour == 0 ? 12 : t.hour);
    final minute = t.minute.toString().padLeft(2, '0');
    return '$hour:$minute $period';
  }

  @override
  Widget build(BuildContext context) {
    final profilesAsync = ref.watch(_checkinProfilesProvider);

    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('Check-in Reminders', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: profilesAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: Column(children: [
            ShieldCardSkeleton(lines: 2),
            SizedBox(height: 12),
            ShieldCardSkeleton(lines: 4),
          ]),
        ),
        error: (_, __) => const Center(child: Text('Could not load profiles')),
        data: (profiles) {
          // Auto-select first profile if only one exists
          if (_selectedProfileId == null && profiles.length == 1) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) {
                setState(() => _selectedProfileId = profiles[0]['id']?.toString());
                _loadSettings();
              }
            });
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              // ── Profile selector ──────────────────────────────────
              if (profiles.length > 1) ...[
                _SectionLabel(label: 'Select Child'),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: ShieldTheme.cardBg,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: ShieldTheme.divider),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedProfileId,
                      isExpanded: true,
                      hint: const Text('Choose a child'),
                      items: profiles.map((p) {
                        final id = p['id']?.toString() ?? '';
                        final name = p['name']?.toString() ?? 'Child';
                        return DropdownMenuItem(value: id, child: Text(name));
                      }).toList(),
                      onChanged: (v) {
                        setState(() {
                          _selectedProfileId = v;
                          _settingsLoaded = false;
                        });
                        if (v != null) _loadSettings();
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // ── No profile selected ───────────────────────────────
              if (_selectedProfileId == null) ...[
                _InfoCard(
                  icon: Icons.person_search_rounded,
                  text: profiles.isEmpty
                      ? 'No child profiles found. Add a child first.'
                      : 'Select a child above to configure their check-in reminders.',
                  color: ShieldTheme.textSecondary,
                ),
                const SizedBox(height: 16),
              ],

              // ── Loading state ─────────────────────────────────────
              if (_selectedProfileId != null && _loadingSettings)
                const Column(children: [
                  ShieldCardSkeleton(lines: 2),
                  SizedBox(height: 12),
                  ShieldCardSkeleton(lines: 4),
                ]),

              // ── Settings card ─────────────────────────────────────
              if (_selectedProfileId != null && !_loadingSettings && _settingsLoaded) ...[
                _SectionLabel(label: 'Reminder Settings'),
                const SizedBox(height: 10),
                Container(
                  decoration: BoxDecoration(
                    color: ShieldTheme.cardBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: ShieldTheme.divider),
                  ),
                  child: Column(
                    children: [
                      // Enable toggle
                      SwitchListTile(
                        value: _enabled,
                        onChanged: (v) => setState(() => _enabled = v),
                        title: const Text('Enable Reminders',
                            style: TextStyle(fontWeight: FontWeight.w700,
                                fontSize: 15, color: ShieldTheme.textPrimary)),
                        subtitle: const Text(
                            'Get notified when your child hasn\'t checked in',
                            style: TextStyle(fontSize: 12, color: ShieldTheme.textSecondary)),
                        activeColor: ShieldTheme.primary,
                        contentPadding: const EdgeInsets.fromLTRB(16, 8, 12, 4),
                      ),

                      if (_enabled) ...[
                        const Divider(height: 1, indent: 16, endIndent: 16),

                        // Reminder interval
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                const Icon(Icons.timer_rounded,
                                    size: 16, color: ShieldTheme.primary),
                                const SizedBox(width: 8),
                                const Text('Check-in Interval',
                                    style: TextStyle(fontWeight: FontWeight.w700,
                                        fontSize: 14, color: ShieldTheme.textPrimary)),
                              ]),
                              const SizedBox(height: 4),
                              const Text(
                                'How often to expect a check-in',
                                style: TextStyle(fontSize: 12, color: ShieldTheme.textSecondary),
                              ),
                              const SizedBox(height: 12),
                              Container(
                                decoration: BoxDecoration(
                                  color: ShieldTheme.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: ShieldTheme.divider),
                                ),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                                child: DropdownButtonHideUnderline(
                                  child: DropdownButton<int>(
                                    value: _intervalOptions
                                            .any((o) => o.minutes == _intervalMin)
                                        ? _intervalMin
                                        : _intervalOptions.first.minutes,
                                    isExpanded: true,
                                    items: _intervalOptions.map((o) {
                                      return DropdownMenuItem(
                                        value: o.minutes,
                                        child: Text(o.label,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w600,
                                                fontSize: 14)),
                                      );
                                    }).toList(),
                                    onChanged: (v) {
                                      if (v != null) setState(() => _intervalMin = v);
                                    },
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                        const Divider(height: 1, indent: 16, endIndent: 16),

                        // Quiet hours
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                const Icon(Icons.bedtime_rounded,
                                    size: 16, color: ShieldTheme.primary),
                                const SizedBox(width: 8),
                                const Text('Quiet Hours',
                                    style: TextStyle(fontWeight: FontWeight.w700,
                                        fontSize: 14, color: ShieldTheme.textPrimary)),
                              ]),
                              const SizedBox(height: 4),
                              const Text(
                                'No reminders will be sent during this window',
                                style: TextStyle(fontSize: 12, color: ShieldTheme.textSecondary),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: _TimePickerTile(
                                      label: 'Start',
                                      time: _quietStart,
                                      display: _formatTimeDisplay(_quietStart),
                                      onTap: () => _pickTime(true),
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 10),
                                    child: Icon(Icons.arrow_forward_rounded,
                                        color: ShieldTheme.textSecondary.withOpacity(0.5),
                                        size: 18),
                                  ),
                                  Expanded(
                                    child: _TimePickerTile(
                                      label: 'End',
                                      time: _quietEnd,
                                      display: _formatTimeDisplay(_quietEnd),
                                      onTap: () => _pickTime(false),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // ── Save button ───────────────────────────────────────
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _saveSettings,
                    icon: _saving
                        ? const SizedBox(
                            width: 18, height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.save_rounded),
                    label: Text(_saving ? 'Saving…' : 'Save Settings'),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(double.infinity, 52),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // ── Info card ─────────────────────────────────────────
              _InfoCard(
                icon: Icons.notifications_active_rounded,
                title: 'How Check-in Reminders Work',
                text: 'Shield monitors your child\'s activity. If they don\'t respond or '
                    'interact with their device within the configured interval, you\'ll receive '
                    'a push notification. Quiet hours ensure you aren\'t disturbed during '
                    'sleeping or school hours.',
                color: ShieldTheme.primary,
              ),
            ],
          );
        },
      ),
    );
  }
}

// ── Support widgets ───────────────────────────────────────────────────────────

class _TimePickerTile extends StatelessWidget {
  final String label;
  final TimeOfDay time;
  final String display;
  final VoidCallback onTap;
  const _TimePickerTile({
    required this.label,
    required this.time,
    required this.display,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: ShieldTheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: ShieldTheme.primary.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: ShieldTheme.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.access_time_rounded,
                    size: 14, color: ShieldTheme.primary),
                const SizedBox(width: 5),
                Text(
                  display,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: ShieldTheme.textPrimary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String? title;
  final String text;
  final Color color;
  const _InfoCard({
    required this.icon,
    required this.text,
    required this.color,
    this.title,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) ...[
                  Text(
                    title!,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: color,
                    ),
                  ),
                  const SizedBox(height: 4),
                ],
                Text(
                  text,
                  style: TextStyle(
                    fontSize: 13,
                    color: color,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 11,
        color: ShieldTheme.textSecondary,
        letterSpacing: 0.8,
      ),
    );
  }
}
