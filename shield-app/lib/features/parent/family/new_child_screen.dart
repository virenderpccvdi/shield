import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import 'family_screen.dart';

class NewChildScreen extends ConsumerStatefulWidget {
  const NewChildScreen({super.key});
  @override
  ConsumerState<NewChildScreen> createState() => _NewChildScreenState();
}

class _NewChildScreenState extends ConsumerState<NewChildScreen> {
  final _form        = GlobalKey<FormState>();
  final _name        = TextEditingController();
  String _filterLevel = 'MODERATE';
  int?   _age;
  bool   _loading    = false;
  String? _error;

  static const _levels = ['STRICT', 'MODERATE', 'LIGHT', 'CUSTOM'];

  @override
  void dispose() { _name.dispose(); super.dispose(); }

  Future<void> _create() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      await ApiClient.instance.post(Endpoints.children, data: {
        'name':        _name.text.trim(),
        'age':         _age,
        'filterLevel': _filterLevel,
      });
      if (!mounted) return;
      ref.invalidate(familyChildrenProvider);
      context.pop();
    } catch (_) {
      setState(() { _loading = false; _error = 'Failed to create profile. Try again.'; });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('New Child Profile')),
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Form(
        key: _form,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // Avatar placeholder
          Center(
            child: CircleAvatar(
              radius:          48,
              backgroundColor: const Color(0xFF2563EB).withOpacity(0.1),
              child: const Icon(Icons.child_friendly, size: 48, color: Color(0xFF2563EB)),
            ),
          ),
          const SizedBox(height: 24),

          TextFormField(
            controller: _name,
            decoration: const InputDecoration(
                labelText: "Child's Name", prefixIcon: Icon(Icons.person_outline)),
            textCapitalization: TextCapitalization.words,
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter a name' : null,
          ),
          const SizedBox(height: 16),

          TextFormField(
            keyboardType: TextInputType.number,
            decoration:   const InputDecoration(
                labelText: 'Age (optional)', prefixIcon: Icon(Icons.cake_outlined)),
            onChanged: (v) => _age = int.tryParse(v),
          ),
          const SizedBox(height: 16),

          DropdownButtonFormField<String>(
            value:       _filterLevel,
            decoration:  const InputDecoration(
                labelText: 'Filter Level', prefixIcon: Icon(Icons.filter_list)),
            items: _levels.map((l) => DropdownMenuItem(value: l, child: Text(l))).toList(),
            onChanged: (v) => setState(() => _filterLevel = v!),
          ),
          const SizedBox(height: 8),

          // Filter level description
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(_levelDescription(_filterLevel),
                style: const TextStyle(fontSize: 12, color: Colors.black45)),
          ),

          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 24),

          ElevatedButton(
            onPressed: _loading ? null : _create,
            child: _loading
                ? const SizedBox(height: 20, width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Create Profile'),
          ),
        ]),
      ),
    ),
  );

  String _levelDescription(String level) {
    switch (level) {
      case 'STRICT':   return 'Blocks social media, gaming, streaming and adult content.';
      case 'MODERATE': return 'Blocks adult content, gambling and violent sites.';
      case 'LIGHT':    return 'Blocks only adult content and malware domains.';
      case 'CUSTOM':   return 'Customise block categories manually in DNS Rules.';
      default: return '';
    }
  }
}
