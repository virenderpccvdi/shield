import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/auth_state.dart';
import '../../core/providers/auth_provider.dart';

// ─────────────────────────────────────────────────────────────────────────────
// SplashScreen — animated logo while auth state loads from storage.
//
// Automatically navigates when AuthStatus leaves [loading]:
//   parent     → /parent/dashboard
//   child      → /child/home
//   unauthenticated + onboarded → /login
//   unauthenticated + not onboarded → /onboarding
// ─────────────────────────────────────────────────────────────────────────────

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});
  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fade;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 900));

    _fade  = CurvedAnimation(parent: _ctrl, curve: Curves.easeIn);
    _scale = Tween<double>(begin: 0.7, end: 1.0).animate(
        CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut));

    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Watch auth — navigate as soon as it resolves
    ref.listen<AuthState>(authProvider, (_, next) {
      if (next.status == AuthStatus.loading) return;

      if (next.status == AuthStatus.parent) {
        context.go('/parent/dashboard');
      } else if (next.status == AuthStatus.child) {
        if (next.childSessionExpired) {
          context.go('/setup?expired=true');
        } else {
          context.go('/child/home');
        }
      } else {
        // Unauthenticated
        context.go(next.isOnboarded ? '/login' : '/onboarding');
      }
    });

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF1E40AF), Color(0xFF1E40AF), Color(0xFF2563EB)],
            begin: Alignment.topLeft,
            end:   Alignment.bottomRight,
          ),
        ),
        child: Center(
          child: FadeTransition(
            opacity: _fade,
            child: ScaleTransition(
              scale: _scale,
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                // Shield icon with glow
                Container(
                  width: 100, height: 100,
                  decoration: BoxDecoration(
                    shape:  BoxShape.circle,
                    color:  Colors.white.withOpacity(0.15),
                    boxShadow: [
                      BoxShadow(
                        color:  Colors.white.withOpacity(0.25),
                        blurRadius: 40, spreadRadius: 10,
                      ),
                    ],
                  ),
                  child: const Icon(Icons.shield,
                      size: 56, color: Colors.white),
                ),
                const SizedBox(height: 24),
                const Text('Shield',
                    style: TextStyle(
                      color:      Colors.white,
                      fontSize:   40,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -1,
                    )),
                const SizedBox(height: 8),
                Text(
                  'Family Internet Protection',
                  style: TextStyle(
                    color:    Colors.white.withOpacity(0.7),
                    fontSize: 14,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 64),
                SizedBox(
                  width: 28, height: 28,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Colors.white.withOpacity(0.5),
                  ),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
