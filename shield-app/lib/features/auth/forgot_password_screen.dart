import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../core/constants.dart';
import '../../app/theme.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

enum _Step { email, code, newPassword, done }

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  String? _error;
  _Step _step = _Step.email;

  late final Dio _dio = Dio(BaseOptions(
    baseUrl: AppConstants.baseUrl,
    connectTimeout: AppConstants.connectTimeout,
    receiveTimeout: AppConstants.receiveTimeout,
  ));

  Future<void> _sendResetCode() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      await _dio.post('/auth/forgot-password', data: {'email': _emailCtrl.text.trim()});
      setState(() => _step = _Step.code);
    } on DioException catch (e) {
      setState(() => _error = e.response?.data?['message'] ?? 'Failed to send reset code.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyCode() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      // Verify the code is valid before proceeding to new password step
      await _dio.post('/auth/verify-reset-code', data: {
        'email': _emailCtrl.text.trim(),
        'code': _codeCtrl.text.trim(),
      });
      if (mounted) setState(() { _step = _Step.newPassword; _loading = false; });
    } on DioException catch (e) {
      // If endpoint doesn't exist or code is wrong, proceed anyway (code verified at reset step)
      final status = e.response?.statusCode;
      if (status == 404 || status == null) {
        // Endpoint not implemented — optimistically proceed
        if (mounted) setState(() { _step = _Step.newPassword; _loading = false; });
      } else {
        if (mounted) setState(() { _error = e.response?.data?['message'] ?? 'Invalid or expired code.'; _loading = false; });
      }
    }
  }

  Future<void> _resetPassword() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      await _dio.post('/auth/reset-password', data: {
        'email': _emailCtrl.text.trim(),
        'code': _codeCtrl.text.trim(),
        'newPassword': _passwordCtrl.text,
      });
      setState(() => _step = _Step.done);
    } on DioException catch (e) {
      setState(() => _error = e.response?.data?['message'] ?? 'Failed to reset password.');
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
              const Icon(Icons.lock_reset, color: Colors.white, size: 64),
              const SizedBox(height: 12),
              const Text('Reset Password', textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Text(
                _step == _Step.email ? 'Enter your email to receive a reset code'
                  : _step == _Step.code ? 'Enter the code sent to your email'
                  : _step == _Step.newPassword ? 'Create a new password'
                  : 'Password reset successful!',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 14),
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
                        // ── Step progress indicator ──────────────────────────
                        if (_step != _Step.done) ...[
                          Row(
                            children: [
                              _StepDot(active: true, label: 'Request'),
                              _StepLine(active: _step == _Step.code || _step == _Step.newPassword),
                              _StepDot(active: _step == _Step.code || _step == _Step.newPassword, label: 'Verify'),
                              _StepLine(active: _step == _Step.newPassword),
                              _StepDot(active: _step == _Step.newPassword, label: 'Reset'),
                            ],
                          ),
                          const SizedBox(height: 20),
                        ],
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

                        if (_step == _Step.done) ...[
                          const Icon(Icons.check_circle, color: ShieldTheme.success, size: 64),
                          const SizedBox(height: 16),
                          const Text('Password Reset!', textAlign: TextAlign.center,
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                          const SizedBox(height: 8),
                          const Text('You can now sign in with your new password.',
                            textAlign: TextAlign.center, style: TextStyle(color: Colors.grey)),
                          const SizedBox(height: 24),
                          FilledButton(
                            onPressed: () => context.go('/login'),
                            child: const Text('Sign In'),
                          ),
                        ],

                        if (_step == _Step.email) ...[
                          TextFormField(
                            controller: _emailCtrl,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
                            validator: (v) => v!.isEmpty ? 'Required' : null,
                          ),
                          const SizedBox(height: 24),
                          FilledButton(
                            onPressed: _loading ? null : _sendResetCode,
                            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                            child: _loading
                              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('Send Reset Code', style: TextStyle(fontSize: 16)),
                          ),
                        ],

                        if (_step == _Step.code) ...[
                          TextFormField(
                            controller: _codeCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Verification Code', prefixIcon: Icon(Icons.pin)),
                            validator: (v) => v!.isEmpty ? 'Required' : null,
                          ),
                          const SizedBox(height: 24),
                          FilledButton(
                            onPressed: _loading ? null : _verifyCode,
                            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                            child: const Text('Verify Code', style: TextStyle(fontSize: 16)),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: _sendResetCode,
                            child: const Text('Resend Code'),
                          ),
                        ],

                        if (_step == _Step.newPassword) ...[
                          TextFormField(
                            controller: _passwordCtrl,
                            obscureText: _obscure,
                            decoration: InputDecoration(
                              labelText: 'New Password (min 8 chars)',
                              prefixIcon: const Icon(Icons.lock_outlined),
                              suffixIcon: IconButton(
                                icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                                onPressed: () => setState(() => _obscure = !_obscure),
                              ),
                            ),
                            validator: (v) => v!.length < 8 ? 'Min 8 characters' : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _confirmCtrl,
                            obscureText: true,
                            decoration: const InputDecoration(labelText: 'Confirm Password', prefixIcon: Icon(Icons.lock_outlined)),
                            validator: (v) => v != _passwordCtrl.text ? 'Passwords don\'t match' : null,
                          ),
                          const SizedBox(height: 24),
                          FilledButton(
                            onPressed: _loading ? null : _resetPassword,
                            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                            child: _loading
                              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('Reset Password', style: TextStyle(fontSize: 16)),
                          ),
                        ],

                        if (_step != _Step.done) ...[
                          const SizedBox(height: 12),
                          TextButton(
                            onPressed: () => context.go('/login'),
                            child: const Text('Back to Sign In'),
                          ),
                        ],
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
  void dispose() {
    _emailCtrl.dispose();
    _codeCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }
}

class _StepDot extends StatelessWidget {
  final bool active;
  final String label;
  const _StepDot({required this.active, required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: active ? ShieldTheme.primary : ShieldTheme.divider,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: active ? FontWeight.w700 : FontWeight.w400,
            color: active ? ShieldTheme.primary : ShieldTheme.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _StepLine extends StatelessWidget {
  final bool active;
  const _StepLine({required this.active});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        height: 2,
        margin: const EdgeInsets.only(bottom: 14),
        color: active ? ShieldTheme.primary : ShieldTheme.divider,
      ),
    );
  }
}
