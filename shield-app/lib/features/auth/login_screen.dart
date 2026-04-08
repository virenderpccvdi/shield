import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/providers/auth_provider.dart';

// ─────────────────────────────────────────────────────────────────────────────
// LoginScreen — clean split-panel login with brand gradient header.
// ─────────────────────────────────────────────────────────────────────────────

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {

  final _form      = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl  = TextEditingController();
  bool  _loading   = false;
  bool  _obscure   = true;
  String? _error;

  late final AnimationController _animCtrl;
  late final Animation<Offset>   _slideAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl  = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 500));
    _slideAnim = Tween<Offset>(
        begin: const Offset(0, 0.15), end: Offset.zero).animate(
        CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _animCtrl.forward();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    final err = await ref.read(authProvider.notifier).login(
      email:    _emailCtrl.text.trim(),
      password: _passCtrl.text,
    );
    if (!mounted) return;
    setState(() { _loading = false; _error = err; });
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Scaffold(
    body: Column(children: [
      // ── Brand header ──────────────────────────────────────────────────────
      _BrandHeader(),

      // ── Form card ─────────────────────────────────────────────────────────
      Expanded(
        child: SingleChildScrollView(
          physics: const ClampingScrollPhysics(),
          padding: EdgeInsets.fromLTRB(24, 32, 24, 24 + bottomInset),
          child: SlideTransition(
            position: _slideAnim,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Sign In',
                    style: TextStyle(
                        fontSize: 24, fontWeight: FontWeight.w700,
                        letterSpacing: -0.5)),
                const SizedBox(height: 4),
                Text('Welcome back. Protect your family today.',
                    style: TextStyle(
                        fontSize: 13,
                        color: Theme.of(context)
                            .colorScheme.onSurface.withOpacity(0.55))),
                const SizedBox(height: 28),

                Form(
                  key: _form,
                  child: Column(children: [
                    // Email
                    TextFormField(
                      controller:   _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText:  'Email address',
                        prefixIcon: Icon(Icons.email_outlined),
                      ),
                      validator: (v) => (v == null || !v.contains('@'))
                          ? 'Enter a valid email' : null,
                    ),
                    const SizedBox(height: 16),

                    // Password
                    TextFormField(
                      controller:      _passCtrl,
                      obscureText:     _obscure,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText:  'Password',
                        prefixIcon: const Icon(Icons.lock_outlined),
                        suffixIcon: IconButton(
                          icon: Icon(_obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined),
                          onPressed: () =>
                              setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) => (v == null || v.length < 6)
                          ? 'Minimum 6 characters' : null,
                    ),
                  ]),
                ),

                // Error banner
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  _ErrorBanner(message: _error!),
                ],

                // Forgot password
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => context.push('/forgot-password'),
                    child: const Text('Forgot password?',
                        style: TextStyle(fontSize: 13)),
                  ),
                ),

                const SizedBox(height: 8),

                // Sign In button
                ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(width: 20, height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Text('Sign In'),
                ),

                const SizedBox(height: 16),

                // Register link
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Text("Don't have an account?",
                      style: TextStyle(fontSize: 13)),
                  TextButton(
                    onPressed: () => context.go('/register'),
                    child: const Text('Create account',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  ),
                ]),

                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Row(children: [
                    Expanded(child: Divider()),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: Text('or', style: TextStyle(
                          fontSize: 12, color: Colors.grey)),
                    ),
                    Expanded(child: Divider()),
                  ]),
                ),

                // Child device setup
                OutlinedButton.icon(
                  onPressed: () => context.push('/setup'),
                  icon:  const Icon(Icons.tablet_android, size: 18),
                  label: const Text('Set up child device'),
                ),
              ],
            ),
          ),
        ),
      ),
    ]),
  );
  }
}

// ── Brand header ──────────────────────────────────────────────────────────────

class _BrandHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    height: 220,
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        colors: [Color(0xFF1E40AF), Color(0xFF1E40AF), Color(0xFF2563EB)],
        begin: Alignment.topLeft, end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
    ),
    child: SafeArea(
      child: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Shield icon with glow ring
          Container(
            width: 72, height: 72,
            decoration: BoxDecoration(
              shape:  BoxShape.circle,
              color:  Colors.white.withOpacity(0.15),
              boxShadow: [
                BoxShadow(
                  color:      Colors.white.withOpacity(0.2),
                  blurRadius: 24, spreadRadius: 4,
                ),
              ],
            ),
            child: const Icon(Icons.shield, size: 38, color: Colors.white),
          ),
          const SizedBox(height: 14),
          const Text('Shield',
              style: TextStyle(
                  color: Colors.white, fontSize: 28,
                  fontWeight: FontWeight.w800, letterSpacing: -0.5)),
          const SizedBox(height: 4),
          Text('Family Internet Protection',
              style: TextStyle(
                  color: Colors.white.withOpacity(0.7), fontSize: 13)),
        ]),
      ),
    ),
  );
}

// ── Error banner ──────────────────────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color:        Colors.red.shade50,
      borderRadius: BorderRadius.circular(10),
      border:       Border.all(color: Colors.red.shade200),
    ),
    child: Row(children: [
      const Icon(Icons.error_outline, color: Colors.red, size: 18),
      const SizedBox(width: 8),
      Expanded(
        child: Text(message,
            style: const TextStyle(color: Colors.red, fontSize: 13)),
      ),
    ]),
  );
}
