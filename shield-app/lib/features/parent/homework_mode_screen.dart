import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class HomeworkModeScreen extends ConsumerStatefulWidget {
  final String profileId;
  const HomeworkModeScreen({super.key, required this.profileId});
  @override
  ConsumerState<HomeworkModeScreen> createState() => _HomeworkModeScreenState();
}

class _HomeworkModeScreenState extends ConsumerState<HomeworkModeScreen> {
  bool _loading = true;
  bool _saving = false;
  bool _active = false;
  String? _activeUntil;
  int _selectedMinutes = 60;
  String _selectedSubject = 'General';

  static const _durations = [
    (label: '30 min',  value: 30),
    (label: '1 hour',  value: 60),
    (label: '1.5 hrs', value: 90),
    (label: '2 hours', value: 120),
    (label: '3 hours', value: 180),
  ];

  static const _subjects = [
    'General', 'Math', 'Science', 'Language', 'History', 'Programming',
  ];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ref.read(dioProvider).get('/dns/schedules/${widget.profileId}/status');
      final d = res.data['data'] as Map<String, dynamic>? ?? {};
      final mode = d['overrideMode']?.toString() ?? d['currentMode']?.toString() ?? '';
      final isHomework = mode == 'HOMEWORK';
      final until = d['overrideUntil']?.toString() ?? d['allowedUntil']?.toString();
      if (mounted) setState(() {
        _active = isHomework;
        _activeUntil = isHomework ? until : null;
        _loading = false;
      });
    } catch (e) {
      debugPrint('HomeworkMode load error: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _activate() async {
    setState(() => _saving = true);
    try {
      await ref.read(dioProvider).post(
        '/dns/rules/${widget.profileId}/homework/start',
        data: {
          'overrideType': 'HOMEWORK',
          'durationMinutes': _selectedMinutes,
          'subject': _selectedSubject,
        },
      );
      if (mounted) {
        final end = DateTime.now().add(Duration(minutes: _selectedMinutes));
        setState(() {
          _active = true;
          _activeUntil = '${end.hour.toString().padLeft(2,'0')}:${end.minute.toString().padLeft(2,'0')}';
          _saving = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Homework Mode activated for $_selectedMinutes minutes'),
          backgroundColor: ShieldTheme.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to activate: $e'),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    }
  }

  Future<void> _deactivate() async {
    setState(() => _saving = true);
    try {
      await ref.read(dioProvider).post('/dns/rules/${widget.profileId}/homework/stop');
      if (mounted) {
        setState(() { _active = false; _activeUntil = null; _saving = false; });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Homework Mode deactivated'),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed: $e'), backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Homework Mode', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: ShieldTheme.primary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: Column(children: [
                ShieldCardSkeleton(lines: 3),
                SizedBox(height: 12),
                ShieldCardSkeleton(lines: 4),
              ]),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Status card
                  _buildStatusCard(),
                  const SizedBox(height: 24),

                  if (!_active) ...[
                    // Duration picker
                    const Text('DURATION', style: TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 11,
                      color: ShieldTheme.textSecondary, letterSpacing: 0.8)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8, runSpacing: 8,
                      children: _durations.map((d) {
                        final sel = d.value == _selectedMinutes;
                        return GestureDetector(
                          onTap: () => setState(() => _selectedMinutes = d.value),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            decoration: BoxDecoration(
                              color: sel ? ShieldTheme.primary : ShieldTheme.cardBg,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: sel ? ShieldTheme.primary : ShieldTheme.divider,
                              ),
                            ),
                            child: Text(d.label, style: TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14,
                              color: sel ? Colors.white : ShieldTheme.textPrimary,
                            )),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 24),

                    // Subject picker
                    const Text('SUBJECT', style: TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 11,
                      color: ShieldTheme.textSecondary, letterSpacing: 0.8)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8, runSpacing: 8,
                      children: _subjects.map((s) {
                        final sel = s == _selectedSubject;
                        return GestureDetector(
                          onTap: () => setState(() => _selectedSubject = s),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                            decoration: BoxDecoration(
                              color: sel ? ShieldTheme.primaryLight.withOpacity(0.15) : ShieldTheme.cardBg,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: sel ? ShieldTheme.primaryLight : ShieldTheme.divider,
                              ),
                            ),
                            child: Text(s, style: TextStyle(
                              fontWeight: sel ? FontWeight.w700 : FontWeight.w500,
                              fontSize: 13,
                              color: sel ? ShieldTheme.primaryLight : ShieldTheme.textSecondary,
                            )),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 30),

                    // Activate button
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _saving ? null : _activate,
                        icon: _saving
                            ? const SizedBox(width: 18, height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.school_rounded),
                        label: Text(_saving ? 'Activating…' : 'Start Homework Mode'),
                        style: FilledButton.styleFrom(
                          backgroundColor: ShieldTheme.primary,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                    ),
                  ],

                  if (_active) ...[
                    const SizedBox(height: 8),
                    _buildAllowedContent(),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _saving ? null : _deactivate,
                        icon: _saving
                            ? const SizedBox(width: 18, height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.stop_rounded),
                        label: Text(_saving ? 'Stopping…' : 'End Homework Mode'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: ShieldTheme.danger,
                          side: const BorderSide(color: ShieldTheme.danger),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),
                  _buildInfoCard(),
                ],
              ),
            ),
    );
  }

  Widget _buildStatusCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: _active
            ? const LinearGradient(
                colors: [Color(0xFF1B5E20), Color(0xFF2E7D32)],
                begin: Alignment.topLeft, end: Alignment.bottomRight)
            : ShieldTheme.heroGradient,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(children: [
        Container(
          width: 56, height: 56,
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.2),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(
            _active ? Icons.school_rounded : Icons.school_outlined,
            color: Colors.white, size: 30,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _active ? 'Homework Mode Active' : 'Homework Mode Off',
              style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
            ),
            const SizedBox(height: 4),
            Text(
              _active
                  ? (_activeUntil != null ? 'Active until $_activeUntil' : 'Active now')
                  : 'Tap below to start a focused study session',
              style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13),
            ),
          ],
        )),
      ]),
    );
  }

  Widget _buildAllowedContent() {
    final allowed = [
      (icon: Icons.school_rounded, label: 'Educational sites'),
      (icon: Icons.search_rounded, label: 'Google, Bing (safe search)'),
      (icon: Icons.library_books_rounded, label: 'Wikipedia, Khan Academy'),
      (icon: Icons.calculate_rounded, label: 'Wolfram Alpha, Desmos'),
    ];
    final blocked = [
      (icon: Icons.people_alt_rounded, label: 'Social media'),
      (icon: Icons.sports_esports_rounded, label: 'Gaming sites'),
      (icon: Icons.play_circle_rounded, label: 'YouTube (entertainment)'),
      (icon: Icons.chat_rounded, label: 'Chat & messaging apps'),
    ];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ShieldTheme.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('During Homework Mode', style: TextStyle(
            fontWeight: FontWeight.w700, fontSize: 14, color: ShieldTheme.textPrimary)),
          const SizedBox(height: 14),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('✅ Allowed', style: TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 12, color: ShieldTheme.success)),
                const SizedBox(height: 8),
                ...allowed.map((a) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(children: [
                    Icon(a.icon, size: 14, color: ShieldTheme.success),
                    const SizedBox(width: 6),
                    Expanded(child: Text(a.label, style: const TextStyle(
                      fontSize: 11.5, color: ShieldTheme.textSecondary))),
                  ]),
                )),
              ],
            )),
            const SizedBox(width: 16),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('🚫 Blocked', style: TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 12, color: ShieldTheme.danger)),
                const SizedBox(height: 8),
                ...blocked.map((b) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(children: [
                    Icon(b.icon, size: 14, color: ShieldTheme.danger),
                    const SizedBox(width: 6),
                    Expanded(child: Text(b.label, style: const TextStyle(
                      fontSize: 11.5, color: ShieldTheme.textSecondary))),
                  ]),
                )),
              ],
            )),
          ]),
        ],
      ),
    );
  }

  Widget _buildInfoCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ShieldTheme.primary.withOpacity(0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: ShieldTheme.primary.withOpacity(0.18)),
      ),
      child: const Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.lightbulb_outline_rounded, color: ShieldTheme.primary, size: 17),
        SizedBox(width: 10),
        Expanded(child: Text(
          'Homework Mode overrides the normal schedule and blocks all distracting sites. It automatically deactivates when the timer expires, or you can stop it manually.',
          style: TextStyle(fontSize: 12, color: ShieldTheme.textSecondary, height: 1.4),
        )),
      ]),
    );
  }
}
