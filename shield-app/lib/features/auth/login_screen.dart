import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth_state.dart';
import '../../core/constants.dart';
import '../../core/shield_logo.dart';
import '../../core/fcm_service.dart';
import '../../app/theme.dart';
import 'package:dio/dio.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false, _obscure = true;
  String? _error;

  // MFA state
  bool _mfaStep = false;
  String _mfaToken = '';
  final _otpController = TextEditingController();
  String _otpCode = '';
  bool _otpLoading = false;
  int _resendCooldown = 0;
  Timer? _cooldownTimer;

  void _startCooldown() {
    _resendCooldown = 60;
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_resendCooldown <= 1) {
        t.cancel();
        if (mounted) setState(() => _resendCooldown = 0);
      } else {
        if (mounted) setState(() => _resendCooldown--);
      }
    });
  }

  Future<void> _sendOtp() async {
    final dio = Dio(BaseOptions(
      baseUrl: AppConstants.baseUrl,
      connectTimeout: AppConstants.connectTimeout,
      receiveTimeout: AppConstants.receiveTimeout,
    ));
    await dio.post('/auth/mfa/email/send', data: {'mfaToken': _mfaToken});
    _startCooldown();
  }

  Future<void> _verifyOtp() async {
    if (_otpCode.length != 6) return;
    setState(() { _otpLoading = true; _error = null; });
    try {
      final dio = Dio(BaseOptions(
        baseUrl: AppConstants.baseUrl,
        connectTimeout: AppConstants.connectTimeout,
        receiveTimeout: AppConstants.receiveTimeout,
      ));
      final res = await dio.post('/auth/mfa/validate', data: {
        'mfaToken': _mfaToken,
        'code': _otpCode,
      });
      final d = res.data['data'];
      final userId = d['userId'] as String? ?? '';
      final accessToken = d['accessToken'] as String? ?? '';
      final tenantId = d['tenantId'] as String? ?? '';
      await ref.read(authProvider.notifier).setAuth(
        userId: userId, accessToken: accessToken,
        name: d['name'] ?? '', email: d['email'] ?? '', role: d['role'] ?? 'CUSTOMER',
        refreshToken: d['refreshToken'] as String?,
      );
      if (userId.isNotEmpty && accessToken.isNotEmpty) {
        FcmService().initialize(
          userId: userId,
          tenantId: tenantId,
          accessToken: accessToken,
        ).catchError((e) => debugPrint('FCM init error: $e'));
      }
      if (mounted) context.go('/dashboard');
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? 'Invalid OTP code';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: ShieldTheme.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _otpLoading = false);
    }
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      final dio = Dio(BaseOptions(baseUrl: AppConstants.baseUrl, connectTimeout: AppConstants.connectTimeout, receiveTimeout: AppConstants.receiveTimeout));
      final res = await dio.post('/auth/login', data: {'email': _email.text.trim(), 'password': _password.text});
      final d = res.data['data'];

      // Check for MFA requirement
      if (d['mfaRequired'] == true) {
        _mfaToken = d['mfaToken'] as String? ?? '';
        setState(() {
          _loading = false;
          _mfaStep = true;
          _otpCode = '';
        });
        _otpController.clear();
        try {
          await _sendOtp();
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: const Text('Failed to send OTP. Tap Resend to try again.'),
              backgroundColor: Colors.orange,
              behavior: SnackBarBehavior.floating,
            ));
          }
        }
        return;
      }

      final userId = d['userId'] as String? ?? '';
      final accessToken = d['accessToken'] as String? ?? '';
      final tenantId = d['tenantId'] as String? ?? '';
      await ref.read(authProvider.notifier).setAuth(
        userId: userId, accessToken: accessToken,
        name: d['name'] ?? '', email: d['email'] ?? '', role: d['role'] ?? 'CUSTOMER',
        refreshToken: d['refreshToken'] as String?,
      );
      // Register FCM token with backend (fire-and-forget, don't block navigation)
      if (userId.isNotEmpty && accessToken.isNotEmpty) {
        FcmService().initialize(
          userId: userId,
          tenantId: tenantId,
          accessToken: accessToken,
        ).catchError((e) => debugPrint('FCM init error: $e'));
      }
      if (mounted) context.go('/dashboard');
    } on DioException catch (e) {
      setState(() => _error = e.response?.data?['message'] ?? 'Login failed. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _buildOtpScreen(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: ShieldTheme.heroGradient),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 48),
                const Center(
                  child: Icon(Icons.mark_email_read_outlined, size: 80, color: Colors.white),
                ),
                const SizedBox(height: 20),
                const Text('Check your email',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: -0.5)),
                const SizedBox(height: 8),
                const Text('We sent a 6-digit code to your email',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70, fontSize: 14, letterSpacing: 0.3)),
                const SizedBox(height: 40),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text('Enter OTP', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 24),
                        TextField(
                          controller: _otpController,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: 8),
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          decoration: const InputDecoration(
                            hintText: '------',
                            hintStyle: TextStyle(fontSize: 28, letterSpacing: 8, color: Colors.black26),
                            counterText: '',
                          ),
                          onChanged: (v) => setState(() => _otpCode = v),
                        ),
                        const SizedBox(height: 24),
                        FilledButton(
                          onPressed: (_otpCode.length == 6 && !_otpLoading) ? _verifyOtp : null,
                          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                          child: _otpLoading
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('Verify', style: TextStyle(fontSize: 16)),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: _resendCooldown == 0
                            ? () async {
                                try { await _sendOtp(); } catch (_) {}
                              }
                            : null,
                          child: Text(
                            _resendCooldown > 0
                              ? 'Resend OTP in ${_resendCooldown}s'
                              : 'Resend OTP',
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            _cooldownTimer?.cancel();
                            setState(() {
                              _mfaStep = false;
                              _mfaToken = '';
                              _otpCode = '';
                              _resendCooldown = 0;
                            });
                            _otpController.clear();
                          },
                          child: const Text('← Back to Login'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_mfaStep) return _buildOtpScreen(context);

    final theme = Theme.of(context);
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: ShieldTheme.heroGradient,
        ),
        child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 48),
              const Center(child: ShieldLogoHero(size: 80)),
              const SizedBox(height: 20),
              const Text('Shield', textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w900,
                    letterSpacing: -0.5)),
              const SizedBox(height: 4),
              const Text('Family Internet Protection', textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, fontSize: 14, letterSpacing: 0.5)),
              const SizedBox(height: 40),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text('Sign In', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 20),
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
                        TextFormField(
                          controller: _email, keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
                          validator: (v) => v!.isEmpty ? 'Required' : null,
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _password, obscureText: _obscure,
                          decoration: InputDecoration(
                            labelText: 'Password', prefixIcon: const Icon(Icons.lock_outlined),
                            suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                              onPressed: () => setState(() => _obscure = !_obscure)),
                          ),
                          validator: (v) => v!.isEmpty ? 'Required' : null,
                        ),
                        const SizedBox(height: 24),
                        FilledButton(
                          onPressed: _loading ? null : _login,
                          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                          child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Sign In', style: TextStyle(fontSize: 16)),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () => context.go('/forgot-password'),
                          child: const Text('Forgot Password?'),
                        ),
                        TextButton(
                          onPressed: () => context.go('/register'),
                          child: const Text("Don't have an account? Register"),
                        ),
                        const SizedBox(height: 8),
                        const Divider(),
                        const SizedBox(height: 4),
                        OutlinedButton.icon(
                          onPressed: () => context.go('/child-setup'),
                          icon: const Icon(Icons.child_care, size: 18),
                          label: const Text('Set Up as Child Device'),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size.fromHeight(46),
                            foregroundColor: ShieldTheme.success,
                            side: const BorderSide(color: ShieldTheme.success),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
        ),
    );
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _otpController.dispose();
    _cooldownTimer?.cancel();
    super.dispose();
  }
}
