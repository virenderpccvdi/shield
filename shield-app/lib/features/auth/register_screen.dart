import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/widgets/common_widgets.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _form     = GlobalKey<FormState>();
  final _name     = TextEditingController();
  final _email    = TextEditingController();
  final _password = TextEditingController();
  bool _loading   = false;
  bool _obscure   = true;
  String? _error;

  @override
  void dispose() {
    _name.dispose(); _email.dispose(); _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    final err = await ref.read(authProvider.notifier).register(
      name:     _name.text.trim(),
      email:    _email.text.trim(),
      password: _password.text,
    );
    if (!mounted) return;
    setState(() { _loading = false; _error = err; });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF2563EB),
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(children: [
            const ShieldLogo(size: 56),
            const SizedBox(height: 8),
            const Text('Shield', style: TextStyle(
                color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
            const SizedBox(height: 32),

            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Form(
                  key: _form,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    const Text('Create Account', style: TextStyle(
                        fontSize: 22, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 24),

                    TextFormField(
                      controller:   _name,
                      decoration:   const InputDecoration(
                          labelText: 'Full Name', prefixIcon: Icon(Icons.person_outline)),
                      validator:    (v) => (v == null || v.trim().isEmpty)
                          ? 'Enter your name' : null,
                    ),
                    const SizedBox(height: 16),

                    TextFormField(
                      controller:   _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration:   const InputDecoration(
                          labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
                      validator:    (v) => (v == null || !v.contains('@'))
                          ? 'Enter a valid email' : null,
                    ),
                    const SizedBox(height: 16),

                    TextFormField(
                      controller:  _password,
                      obscureText: _obscure,
                      decoration:  InputDecoration(
                        labelText:  'Password',
                        prefixIcon: const Icon(Icons.lock_outlined),
                        suffixIcon: IconButton(
                          icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) => (v == null || v.length < 8)
                          ? 'Minimum 8 characters' : null,
                    ),

                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(8)),
                        child: Text(_error!, style: const TextStyle(color: Colors.red)),
                      ),
                    ],
                    const SizedBox(height: 20),

                    ElevatedButton(
                      onPressed: _loading ? null : _submit,
                      child: _loading
                          ? const SizedBox(height: 20, width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Create Account'),
                    ),
                    const SizedBox(height: 16),

                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      const Text('Already have an account? '),
                      TextButton(
                        onPressed: () => context.go('/login'),
                        child: const Text('Sign In'),
                      ),
                    ]),
                  ]),
                ),
              ),
            ),
          ]),
        ),
      ),
    ),
  );
}
