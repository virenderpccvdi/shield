import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';

class NewChildProfileScreen extends ConsumerStatefulWidget {
  const NewChildProfileScreen({super.key});

  @override
  ConsumerState<NewChildProfileScreen> createState() => _NewChildProfileScreenState();
}

class _NewChildProfileScreenState extends ConsumerState<NewChildProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _ageController = TextEditingController();
  String _filterLevel = 'MODERATE';
  bool _saving = false;
  String? _error;

  static final _filterOptions = [
    {'value': 'STRICT',   'label': 'Strict',   'desc': 'Maximum protection (ages 2–8)',   'color': ShieldTheme.danger},
    {'value': 'MODERATE', 'label': 'Moderate', 'desc': 'Balanced protection (ages 8–13)', 'color': ShieldTheme.warning},
    {'value': 'RELAXED',  'label': 'Relaxed',  'desc': 'Light filtering (ages 13+)',      'color': ShieldTheme.success},
  ];

  String _ageGroup(int age) {
    if (age <= 5)  return 'TODDLER';
    if (age <= 10) return 'CHILD';
    if (age <= 13) return 'PRETEEN';
    return 'TEEN';
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _saving = true; _error = null; });
    try {
      final ageNum = int.tryParse(_ageController.text) ?? 10;
      final client = ref.read(dioProvider);
      final res = await client.post('/profiles/children', data: {
        'name': _nameController.text.trim(),
        'filterLevel': _filterLevel,
        'ageGroup': _ageGroup(ageNum),
      });
      final profileId = res.data?['data']?['id'] ?? res.data?['id'];
      if (mounted) {
        if (profileId != null) {
          context.go('/family/$profileId');
        } else {
          context.go('/family');
        }
      }
    } on DioException catch (e) {
      final serverMsg = e.response?.data is Map
          ? (e.response!.data['message'] ?? e.response!.data['error'])
          : null;
      setState(() {
        _error = serverMsg?.toString() ?? 'Failed to create profile. Please try again.';
        _saving = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to create profile. Please try again.';
        _saving = false;
      });
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _ageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Child Profile', style: TextStyle(fontWeight: FontWeight.w700)),
        leading: BackButton(onPressed: () => context.go('/family')),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: ShieldTheme.danger.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: ShieldTheme.danger.withOpacity(0.3)),
                ),
                child: Text(_error!, style: const TextStyle(color: ShieldTheme.danger, fontSize: 13)),
              ),

            Text('Child\'s Name *', style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _nameController,
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'e.g. Jake, Emma',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                prefixIcon: const Icon(Icons.child_care),
              ),
              validator: (v) => (v?.trim().isEmpty ?? true) ? 'Name is required' : null,
            ),

            const SizedBox(height: 20),
            Text('Age', style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _ageController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                hintText: 'Enter age (2–18)',
                helperText: 'Used to set appropriate defaults',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                prefixIcon: const Icon(Icons.cake),
              ),
            ),

            const SizedBox(height: 20),
            Text('Content Filter Level *', style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            Row(
              children: _filterOptions.map((f) {
                final selected = _filterLevel == f['value'];
                final color = f['color'] as Color;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _filterLevel = f['value'] as String),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: selected ? color : ShieldTheme.divider,
                          width: selected ? 2 : 1,
                        ),
                        color: selected ? color.withOpacity(0.08) : Colors.transparent,
                      ),
                      child: Column(children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: color.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(f['label'] as String, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12)),
                        ),
                        const SizedBox(height: 6),
                        Text(f['desc'] as String, style: const TextStyle(fontSize: 10, color: ShieldTheme.textSecondary), textAlign: TextAlign.center),
                      ]),
                    ),
                  ),
                );
              }).toList(),
            ),

            const SizedBox(height: 32),
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ShieldTheme.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Create Child Profile', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
