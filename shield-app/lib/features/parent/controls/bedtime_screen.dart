import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

class BedtimeScreen extends ConsumerStatefulWidget {
  const BedtimeScreen({super.key, required this.profileId});
  final String profileId;
  @override
  ConsumerState<BedtimeScreen> createState() => _BedtimeScreenState();
}

class _BedtimeScreenState extends ConsumerState<BedtimeScreen> {
  bool   _enabled     = false;
  String _bedtime     = '21:00';
  String _wakeTime    = '07:00';
  bool   _loading     = true;
  bool   _saving      = false;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    try {
      final resp = await ApiClient.instance.get(Endpoints.dnsBedtime(widget.profileId));
      final raw = resp.data as Map<String, dynamic>? ?? {};
      final d = (raw['data'] as Map<String, dynamic>?) ?? raw;
      setState(() {
        _enabled  = d['enabled'] as bool? ?? false;
        _bedtime  = d['bedtimeStart']?.toString() ?? '21:00';
        _wakeTime = d['bedtimeEnd']?.toString()   ?? '07:00';
        _loading  = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      // Backend: POST /dns/rules/{id}/bedtime/configure
      // (Endpoints.dnsBedtime returns /dns/rules/{id}/bedtime/status — trim to base + /configure)
      final baseUrl = Endpoints.dnsBedtime(widget.profileId)
          .replaceAll('/status', '');
      await ApiClient.instance.post('$baseUrl/configure', data: {
        'enabled':      _enabled,
        'bedtimeStart': _bedtime,
        'bedtimeEnd':   _wakeTime,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bedtime saved'), backgroundColor: Colors.green));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickTime(bool isBedtime) async {
    final parts = (isBedtime ? _bedtime : _wakeTime).split(':');
    final picked = await showTimePicker(
      context:     context,
      initialTime: TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1])),
    );
    if (picked == null) return;
    final str = '${picked.hour.toString().padLeft(2,'0')}:${picked.minute.toString().padLeft(2,'0')}';
    setState(() { if (isBedtime) _bedtime = str; else _wakeTime = str; });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Bedtime Mode')),
    body: _loading
        ? const Center(child: CircularProgressIndicator())
        : Column(children: [
            Expanded(child: ListView(children: [
              SwitchListTile(
                title:    const Text('Enable Bedtime Mode',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('Blocks internet during sleep hours'),
                value:    _enabled,
                onChanged: (v) => setState(() => _enabled = v),
              ),

              if (_enabled) ...[
                const Divider(),
                ListTile(
                  leading:  const Icon(Icons.bedtime, color: Color(0xFF4A148C)),
                  title:    const Text('Bedtime'),
                  trailing: TextButton(
                    onPressed: () => _pickTime(true),
                    child:     Text(_bedtime,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ),
                ),
                ListTile(
                  leading:  const Icon(Icons.wb_sunny_outlined, color: Color(0xFFC2410C)),
                  title:    const Text('Wake Time'),
                  trailing: TextButton(
                    onPressed: () => _pickTime(false),
                    child:     Text(_wakeTime,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Card(
                    color: const Color(0xFF4A148C).withOpacity(0.07),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(children: [
                        const Icon(Icons.info_outline, color: Color(0xFF4A148C), size: 18),
                        const SizedBox(width: 8),
                        Expanded(child: Text(
                          'Internet will be blocked from $_bedtime until $_wakeTime every night.',
                          style: const TextStyle(fontSize: 13),
                        )),
                      ]),
                    ),
                  ),
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
                    : const Text('Save Bedtime'),
              ),
            ),
          ]),
  );
}
