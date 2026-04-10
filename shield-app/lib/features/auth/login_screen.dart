import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/widgets/common_widgets.dart';

// ─────────────────────────────────────────────────────────────────────────────
// LoginScreen — Guardian's Lens auth page
//
// Design:
//  · Compact guardian hero (hero has sapphire texture + shield icon with glow)
//  · Form sits on surfaceContainerLowest (pure white) on the surface canvas
//  · Input fields: surfaceContainerLow fill, ghost border, primary focus ring
//  · GuardianButton for submit (gradient, xl radius)
//  · No Divider between social links — replaced with 24px spacing
//  · Slide-in entrance animation from y+16px
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
  late final Animation<double>   _fadeAnim;
  late final Animation<Offset>   _slideAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl  = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600));
    _fadeAnim  = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
        begin: const Offset(0, 0.08), end: Offset.zero).animate(
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
    final cs         = Theme.of(context).colorScheme;
    final bottomPad  = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: cs.surface,
      body: Column(children: [

        // ── Guardian hero: compact with sapphire texture ──────────────────
        GuardianHero(
          height:       240,
          bottomRadius: 32,
          child: SafeArea(
            bottom: false,
            child: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                // Shield icon with ambient glow ring
                Container(
                  width:  80, height: 80,
                  decoration: BoxDecoration(
                    shape:     BoxShape.circle,
                    color:     Colors.white.withOpacity(0.12),
                    boxShadow: [
                      BoxShadow(
                        color:       Colors.white.withOpacity(0.15),
                        blurRadius:  32,
                        spreadRadius: 4,
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.shield_rounded, size: 40, color: Colors.white),
                ),
                const SizedBox(height: 16),
                Text('Shield',
                    style: GoogleFonts.manrope(
                      color:      Colors.white,
                      fontSize:   30,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.8,
                    )),
                const SizedBox(height: 4),
                Text('Family Internet Protection',
                    style: GoogleFonts.inter(
                      color:    Colors.white.withOpacity(0.65),
                      fontSize: 13,
                    )),
              ]),
            ),
          ),
        ),

        // ── Form on surface canvas ────────────────────────────────────────
        Expanded(
          child: SingleChildScrollView(
            physics: const ClampingScrollPhysics(),
            padding: EdgeInsets.fromLTRB(24, 28, 24, 24 + bottomPad),
            child: FadeTransition(
              opacity: _fadeAnim,
              child: SlideTransition(
                position: _slideAnim,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Asymmetric header: title left, label right
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Text('Sign In',
                              style: GoogleFonts.manrope(
                                fontSize:   28,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.6,
                                color: cs.onSurface,
                              )),
                        ),
                        // Label-sm uppercase — the spec's editorial pairing
                        Text('PARENT / ADMIN',
                            style: GoogleFonts.inter(
                              fontSize:   10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.8,
                              color: cs.onSurfaceVariant,
                            )),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Welcome back. Your family is waiting.',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color:    cs.onSurfaceVariant,
                        )),

                    const SizedBox(height: 28),

                    Form(
                      key: _form,
                      child: Column(children: [
                        // Email field: surfaceContainerLow fill, ghost border
                        TextFormField(
                          controller:      _emailCtrl,
                          keyboardType:    TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText:  'Email address',
                            prefixIcon: Icon(Icons.mail_outline_rounded),
                          ),
                          validator: (v) => (v == null || !v.contains('@'))
                              ? 'Enter a valid email' : null,
                        ),
                        const SizedBox(height: 14),

                        // Password field
                        TextFormField(
                          controller:      _passCtrl,
                          obscureText:     _obscure,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _submit(),
                          decoration: InputDecoration(
                            labelText:  'Password',
                            prefixIcon: const Icon(Icons.lock_outline_rounded),
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

                    // Error state (tonal, no border)
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      _ErrorTile(message: _error!),
                    ],

                    // Forgot password: far right (intentional asymmetry)
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => context.push('/forgot-password'),
                        child: Text('Forgot password?',
                            style: GoogleFonts.inter(
                              fontSize: 13, fontWeight: FontWeight.w600)),
                      ),
                    ),

                    const SizedBox(height: 8),

                    // Guardian Button: gradient, xl radius
                    GuardianButton(
                      label:     'Sign In',
                      loading:   _loading,
                      onPressed: _submit,
                    ),

                    const SizedBox(height: 24),

                    // Register link — centered, no divider
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text("Don't have an account? ",
                          style: GoogleFonts.inter(
                            fontSize: 13, color: cs.onSurfaceVariant)),
                      TextButton(
                        onPressed: () => context.go('/register'),
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: Text('Create account',
                            style: GoogleFonts.inter(
                              fontSize:   13,
                              fontWeight: FontWeight.w700,
                              color: cs.primary,
                            )),
                      ),
                    ]),

                    const SizedBox(height: 24),

                    // Child device setup — secondary outlined button
                    OutlinedButton.icon(
                      onPressed: () => context.push('/setup'),
                      icon:  const Icon(Icons.tablet_android_rounded, size: 18),
                      label: const Text('Set up child device'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

// ── Error tile: tonal background, no border ───────────────────────────────────

class _ErrorTile extends StatelessWidget {
  const _ErrorTile({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        // Tonal danger background — no border
        color:        cs.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        Icon(Icons.error_outline_rounded,
            color: cs.error, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Text(message,
              style: GoogleFonts.inter(
                color: cs.error, fontSize: 13,
                fontWeight: FontWeight.w500)),
        ),
      ]),
    );
  }
}
