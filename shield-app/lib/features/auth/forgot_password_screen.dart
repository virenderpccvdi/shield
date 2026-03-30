import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email   = TextEditingController();
  bool _loading  = false;
  bool _sent     = false;
  String? _error;

  @override
  void dispose() { _email.dispose(); super.dispose(); }

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = 'Enter a valid email');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await ApiClient.instance.post(Endpoints.forgotPassword, data: {'email': email});
      if (mounted) setState(() { _sent = true; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _sent = true; _loading = false; });
      // Show success regardless to prevent email enumeration
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Reset Password')),
    body: Padding(
      padding: const EdgeInsets.all(24),
      child: _sent ? _successView() : _formView(),
    ),
  );

  Widget _formView() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    const SizedBox(height: 24),
    const Icon(Icons.lock_reset, size: 64, color: Color(0xFF1565C0)),
    const SizedBox(height: 16),
    const Text('Forgot your password?',
        style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        textAlign: TextAlign.center),
    const SizedBox(height: 8),
    const Text('Enter your email and we\'ll send you a reset link.',
        textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
    const SizedBox(height: 32),
    TextFormField(
      controller: _email,
      keyboardType: TextInputType.emailAddress,
      decoration: const InputDecoration(
          labelText: 'Email address', prefixIcon: Icon(Icons.email_outlined)),
    ),
    if (_error != null) ...[
      const SizedBox(height: 8),
      Text(_error!, style: const TextStyle(color: Colors.red)),
    ],
    const SizedBox(height: 20),
    ElevatedButton(
      onPressed: _loading ? null : _submit,
      child: _loading
          ? const SizedBox(height: 20, width: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
          : const Text('Send Reset Link'),
    ),
    TextButton(onPressed: () => context.pop(), child: const Text('Back to Sign In')),
  ]);

  Widget _successView() => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Icon(Icons.check_circle, size: 80, color: Colors.green),
      const SizedBox(height: 20),
      const Text('Email Sent!', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          textAlign: TextAlign.center),
      const SizedBox(height: 8),
      Text('If ${_email.text.trim()} has an account, a reset link has been sent.',
          textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54)),
      const SizedBox(height: 32),
      ElevatedButton(
        onPressed: () => context.go('/login'),
        child: const Text('Back to Sign In'),
      ),
    ],
  );
}
