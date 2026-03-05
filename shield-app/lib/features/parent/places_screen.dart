import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';

class PlacesScreen extends ConsumerStatefulWidget {
  final String profileId;
  const PlacesScreen({super.key, required this.profileId});
  @override
  ConsumerState<PlacesScreen> createState() => _PlacesScreenState();
}

class _PlacesScreenState extends ConsumerState<PlacesScreen> {
  List<Map<String, dynamic>> _places = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/location/${widget.profileId}/places');
      _places = ((res.data['data'] as List?) ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) { _places = []; }
    if (mounted) setState(() => _loading = false);
  }

  IconData _placeIcon(String? type) {
    switch (type?.toUpperCase()) {
      case 'HOME': return Icons.home;
      case 'SCHOOL': return Icons.school;
      case 'WORK': return Icons.work;
      case 'GYM': return Icons.fitness_center;
      case 'PARK': return Icons.park;
      default: return Icons.place;
    }
  }

  Future<void> _addOrEditPlace({Map<String, dynamic>? existing}) async {
    final nameCtrl = TextEditingController(text: existing?['name'] as String? ?? '');
    final addressCtrl = TextEditingController(text: existing?['address'] as String? ?? '');
    final latCtrl = TextEditingController(text: existing?['latitude']?.toString() ?? '');
    final lngCtrl = TextEditingController(text: existing?['longitude']?.toString() ?? '');
    String type = existing?['type'] as String? ?? 'HOME';

    final result = await showDialog<Map<String, dynamic>?>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text(existing != null ? 'Edit Place' : 'Add Place'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name', prefixIcon: Icon(Icons.label))),
              const SizedBox(height: 12),
              TextField(controller: addressCtrl, decoration: const InputDecoration(labelText: 'Address', prefixIcon: Icon(Icons.location_on))),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: TextField(controller: latCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Latitude'))),
                const SizedBox(width: 8),
                Expanded(child: TextField(controller: lngCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Longitude'))),
              ]),
              const SizedBox(height: 16),
              Wrap(spacing: 8, children: [
                for (final t in ['HOME', 'SCHOOL', 'WORK', 'GYM', 'PARK', 'OTHER'])
                  ChoiceChip(
                    label: Text(t),
                    selected: type == t,
                    onSelected: (_) => setDialogState(() => type = t),
                  ),
              ]),
            ]),
          ),
          actions: [
            if (existing != null)
              TextButton(
                onPressed: () => Navigator.pop(ctx, {'_delete': true}),
                style: TextButton.styleFrom(foregroundColor: Colors.red),
                child: const Text('Delete'),
              ),
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, {
              'name': nameCtrl.text,
              'address': addressCtrl.text,
              'latitude': double.tryParse(latCtrl.text),
              'longitude': double.tryParse(lngCtrl.text),
              'type': type,
            }), child: Text(existing != null ? 'Update' : 'Add')),
          ],
        ),
      ),
    );

    if (result == null) return;

    try {
      final client = ref.read(dioProvider);
      if (result.containsKey('_delete') && existing != null) {
        await client.delete('/location/${widget.profileId}/places/${existing['id']}');
      } else if (existing != null) {
        await client.put('/location/${widget.profileId}/places/${existing['id']}', data: result);
      } else {
        result['profileId'] = widget.profileId;
        await client.post('/location/${widget.profileId}/places', data: result);
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Saved Places', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _addOrEditPlace(),
        icon: const Icon(Icons.add_location_alt),
        label: const Text('Add Place'),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: () async => _load(),
            child: _places.isEmpty
              ? const Center(child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.add_location_alt, size: 64, color: Colors.grey),
                    SizedBox(height: 16),
                    Text('No saved places', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.grey)),
                    Text('Save frequently visited locations', style: TextStyle(color: Colors.grey, fontSize: 13)),
                  ],
                ))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _places.length,
                  itemBuilder: (_, i) {
                    final p = _places[i];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: const Color(0xFF1565C0).withAlpha(30),
                          child: Icon(_placeIcon(p['type'] as String?), color: const Color(0xFF1565C0)),
                        ),
                        title: Text(p['name'] as String? ?? 'Place', style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(p['address'] as String? ?? '${p['latitude']}, ${p['longitude']}',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                        trailing: Chip(
                          label: Text(p['type'] as String? ?? 'OTHER', style: const TextStyle(fontSize: 10)),
                          padding: EdgeInsets.zero,
                          side: BorderSide.none,
                          backgroundColor: Colors.grey.shade100,
                        ),
                        onTap: () => _addOrEditPlace(existing: p),
                      ),
                    );
                  },
                ),
          ),
    );
  }
}
