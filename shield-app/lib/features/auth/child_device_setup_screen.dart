import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../core/auth_state.dart';
import '../../core/constants.dart';

class ChildDeviceSetupScreen extends ConsumerStatefulWidget {
  const ChildDeviceSetupScreen({super.key});
  @override
  ConsumerState<ChildDeviceSetupScreen> createState() => _ChildDeviceSetupScreenState();
}

class _ChildDeviceSetupScreenState extends ConsumerState<ChildDeviceSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  // After login
  List<Map<String, dynamic>> _profiles = [];
  String? _accessToken;
  String? _selectedProfileId;
  String? _selectedProfileName;
  bool _saving = false;

  Future<void> _fetchProfiles() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; _profiles = []; });
    try {
      final dio = Dio(BaseOptions(
        baseUrl: AppConstants.baseUrl,
        connectTimeout: AppConstants.connectTimeout,
        receiveTimeout: AppConstants.receiveTimeout,
      ));
      // Login with parent credentials
      final res = await dio.post('/auth/login', data: {
        'email': _email.text.trim(),
        'password': _password.text,
      });
      final d = res.data['data'];
      _accessToken = d['accessToken'] as String?;
      if (_accessToken == null) throw Exception('No token returned');

      // Fetch child profiles
      final profRes = await dio.get(
        '/profiles/children',
        options: Options(headers: {'Authorization': 'Bearer $_accessToken'}),
      );
      final pd = profRes.data['data'];
      final list = (pd is Map ? (pd['content'] ?? pd) : pd) as List? ?? [];
      final profiles = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();

      if (profiles.isEmpty) {
        setState(() { _error = 'No child profiles found on this account. Create one from the parent dashboard first.'; _loading = false; });
        return;
      }

      setState(() { _profiles = profiles; _loading = false; });
    } on DioException catch (e) {
      setState(() {
        _error = e.response?.data?['message'] ?? 'Invalid email or password.';
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = 'Something went wrong. Please try again.'; _loading = false; });
    }
  }

  Future<void> _activateChildMode() async {
    if (_selectedProfileId == null || _accessToken == null) return;
    setState(() { _saving = true; });
    try {
      // Register this device against the selected child profile
      final dio = Dio(BaseOptions(
        baseUrl: AppConstants.baseUrl,
        connectTimeout: AppConstants.connectTimeout,
        receiveTimeout: AppConstants.receiveTimeout,
      ));
      await dio.post(
        '/profiles/devices',
        data: {
          'name': 'Child Device',
          'deviceType': 'PHONE',
          'profileId': _selectedProfileId,
          'dnsMethod': 'PRIVATE_DNS',
        },
        options: Options(headers: {'Authorization': 'Bearer $_accessToken'}),
      ).catchError((_) => Response(requestOptions: RequestOptions())); // ignore duplicate

      // Store child mode config
      await ref.read(authProvider.notifier).setChildMode(
        accessToken: _accessToken!,
        profileId: _selectedProfileId!,
        childName: _selectedProfileName ?? 'Child',
      );

      if (mounted) context.go('/child');
    } catch (e) {
      setState(() { _error = 'Failed to activate child mode. Please try again.'; _saving = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1B5E20),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
        title: const Text('Child Device Setup', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: _profiles.isEmpty ? _buildLoginStep() : _buildProfileStep(),
        ),
      ),
    );
  }

  Widget _buildLoginStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        const Icon(Icons.child_care, color: Colors.white, size: 56),
        const SizedBox(height: 12),
        const Text('Set Up Child Mode', textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text(
          'Sign in with the parent account to link this device to a child profile.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white70, fontSize: 14),
        ),
        const SizedBox(height: 32),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text("Parent's Account", style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  if (_error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                      child: Text(_error!, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Parent Email', prefixIcon: Icon(Icons.email_outlined)),
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _password,
                    obscureText: _obscure,
                    decoration: InputDecoration(
                      labelText: 'Parent Password',
                      prefixIcon: const Icon(Icons.lock_outlined),
                      suffixIcon: IconButton(
                        icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _loading ? null : _fetchProfiles,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(50),
                      backgroundColor: const Color(0xFF1B5E20),
                    ),
                    child: _loading
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Continue', style: TextStyle(fontSize: 16)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProfileStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        const Icon(Icons.family_restroom, color: Colors.white, size: 56),
        const SizedBox(height: 12),
        const Text('Choose Child Profile', textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text(
          'Select which child is using this device.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white70, fontSize: 14),
        ),
        const SizedBox(height: 32),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                    child: Text(_error!, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
                  ),
                  const SizedBox(height: 12),
                ],
                ..._profiles.map((p) {
                  final id = p['id'] as String? ?? '';
                  final name = p['name'] as String? ?? 'Child';
                  final age = p['ageGroup'] as String? ?? p['age']?.toString() ?? '';
                  final filter = p['filterLevel'] as String? ?? '';
                  final selected = _selectedProfileId == id;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
                      onTap: () => setState(() {
                        _selectedProfileId = id;
                        _selectedProfileName = name;
                      }),
                      borderRadius: BorderRadius.circular(12),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: selected ? const Color(0xFF1B5E20) : Colors.grey.shade300,
                            width: selected ? 2 : 1,
                          ),
                          color: selected ? const Color(0xFFE8F5E9) : Colors.grey.shade50,
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 22,
                              backgroundColor: selected ? const Color(0xFF1B5E20) : Colors.grey.shade300,
                              child: Text(
                                name.isNotEmpty ? name[0].toUpperCase() : 'C',
                                style: TextStyle(
                                  color: selected ? Colors.white : Colors.grey.shade700,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 18,
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                                  if (age.isNotEmpty || filter.isNotEmpty)
                                    Text(
                                      [if (age.isNotEmpty) age, if (filter.isNotEmpty) '$filter filter'].join(' · '),
                                      style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                                    ),
                                ],
                              ),
                            ),
                            if (selected) const Icon(Icons.check_circle, color: Color(0xFF1B5E20)),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: (_selectedProfileId == null || _saving) ? null : _activateChildMode,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                    backgroundColor: const Color(0xFF1B5E20),
                  ),
                  child: _saving
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Activate Child Mode', style: TextStyle(fontSize: 16)),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => setState(() { _profiles = []; _selectedProfileId = null; _error = null; }),
                  child: const Text('← Use different account'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }
}
