import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../core/constants.dart';
import '../../app/theme.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController(), _email = TextEditingController(), _password = TextEditingController();
  bool _loading = false, _obscure = true;
  String? _error;

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      final dio = Dio(BaseOptions(baseUrl: AppConstants.baseUrl, connectTimeout: AppConstants.connectTimeout));
      await dio.post('/auth/register', data: {'name': _name.text.trim(), 'email': _email.text.trim(), 'password': _password.text});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Account created! Please sign in.'),
          backgroundColor: ShieldTheme.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
        context.go('/login');
      }
    } on DioException catch (e) {
      setState(() => _error = e.response?.data?['message'] ?? 'Registration failed.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ShieldTheme.primary,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const SizedBox(height: 40),
              const Icon(Icons.shield, color: Colors.white, size: 64),
              const SizedBox(height: 12),
              const Text('Create Account', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
              const SizedBox(height: 32),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_error != null) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: ShieldTheme.danger.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: ShieldTheme.danger.withOpacity(0.3)),
                            ),
                            child: Row(children: [
                              const Icon(Icons.error_outline, color: ShieldTheme.danger, size: 16),
                              const SizedBox(width: 8),
                              Expanded(child: Text(_error!, style: const TextStyle(color: ShieldTheme.danger, fontSize: 13))),
                            ]),
                          ),
                          const SizedBox(height: 16),
                        ],
                        TextFormField(controller: _name, decoration: const InputDecoration(labelText: 'Full Name', prefixIcon: Icon(Icons.person_outlined)), validator: (v) => v!.isEmpty ? 'Required' : null),
                        const SizedBox(height: 16),
                        TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)), validator: (v) => v!.isEmpty ? 'Required' : null),
                        const SizedBox(height: 16),
                        TextFormField(controller: _password, obscureText: _obscure, decoration: InputDecoration(labelText: 'Password (min 8 chars)', prefixIcon: const Icon(Icons.lock_outlined), suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined), onPressed: () => setState(() => _obscure = !_obscure))), validator: (v) => v!.length < 8 ? 'Min 8 characters' : null),
                        const SizedBox(height: 24),
                        FilledButton(onPressed: _loading ? null : _register, style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)), child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Create Account', style: TextStyle(fontSize: 16))),
                        const SizedBox(height: 12),
                        TextButton(onPressed: () => context.go('/login'), child: const Text('Already have an account? Sign in')),
                      ],
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

  @override
  void dispose() { _name.dispose(); _email.dispose(); _password.dispose(); super.dispose(); }
}
