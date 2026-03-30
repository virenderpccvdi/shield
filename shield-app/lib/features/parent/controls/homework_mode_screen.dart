import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

class HomeworkModeScreen extends ConsumerStatefulWidget {
  const HomeworkModeScreen({super.key, required this.profileId});
  final String profileId;
  @override
  ConsumerState<HomeworkModeScreen> createState() => _HomeworkModeState();
}

class _HomeworkModeState extends ConsumerState<HomeworkModeScreen> {
  bool   _enabled  = false;
  int    _duration = 60; // minutes
  bool   _loading  = true;
  bool   _saving   = false;

  @override
  void initState() { super.initState(); _fetch(); }

  Future<void> _fetch() async {
    try {
      final resp = await ApiClient.instance.get(Endpoints.dnsHomeworkMode(widget.profileId));
      final raw = resp.data as Map<String, dynamic>? ?? {};
      final d = (raw['data'] as Map<String, dynamic>?) ?? raw;
      setState(() {
        _enabled  = d['active'] as bool? ?? d['enabled'] as bool? ?? false;
        _duration = (d['minutesRemaining'] as int?) ?? (d['durationMinutes'] as int?) ?? 60;
        _loading  = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      // Backend: POST /dns/rules/{id}/homework/start or /stop
      final baseUrl = Endpoints.dnsHomeworkMode(widget.profileId)
          .replaceAll('/status', '');
      if (_enabled) {
        await ApiClient.instance.post('$baseUrl/start', data: {'durationMinutes': _duration});
      } else {
        await ApiClient.instance.post('$baseUrl/stop');
      }
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Saved'), backgroundColor: Colors.green));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save')));
    } finally { if (mounted) setState(() => _saving = false); }
  }

  String _fmt(int mins) {
    final h = mins ~/ 60; final m = mins % 60;
    if (h == 0) return '${m}m';
    if (m == 0) return '${h}h';
    return '${h}h ${m}m';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Homework Mode')),
    body: _loading ? const Center(child: CircularProgressIndicator())
        : Column(children: [
            Expanded(child: ListView(children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Homework mode blocks distracting sites (social media, gaming, streaming) '
                  'so your child can focus on studying.',
                  style: TextStyle(color: Colors.black54),
                ),
              ),
              SwitchListTile(
                secondary: const Icon(Icons.school, color: Color(0xFF1B5E20)),
                title:     const Text('Enable Homework Mode',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                value:     _enabled,
                onChanged: (v) => setState(() => _enabled = v),
              ),
              if (_enabled) ...[
                const Divider(),
                const SectionHeader('Session Duration'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_fmt(_duration),
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold,
                            color: Color(0xFF1B5E20))),
                    Slider(
                      value:      _duration.toDouble(),
                      min:        15, max: 240, divisions: 15,
                      label:      _fmt(_duration),
                      activeColor: const Color(0xFF1B5E20),
                      onChanged:  (v) => setState(() => _duration = v.round()),
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
