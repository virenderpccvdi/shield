import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
// OnboardingScreen — Guardian's Lens edition
// 3 slides with GuardianHero gradient, Manrope typography, polished sapphire
// overlay, and soft tonal indicator dots.
// ─────────────────────────────────────────────────────────────────────────────

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _page = 0;

  static const _slides = [
    _Slide(
      icon:        Icons.shield_rounded,
      iconColor:   Ds.onPrimaryContainer,
      title:       'Smart Family\nProtection',
      body:        'Shield blocks harmful content, enforces safe browsing, '
                   'and keeps your children protected — automatically.',
      accentColor: Ds.primary,
    ),
    _Slide(
      icon:        Icons.schedule_rounded,
      iconColor:   Color(0xFF80CBC4),
      title:       'Screen Time\nControl',
      body:        'Set daily limits, bedtime lockdowns, and homework mode. '
                   'Healthy digital habits built right in.',
      accentColor: Color(0xFF00695C),
    ),
    _Slide(
      icon:        Icons.location_on_rounded,
      iconColor:   Color(0xFFB39DDB),
      title:       'Always Know\nWhere They Are',
      body:        'Real-time location, geofence alerts, and location history '
                   'so you\'re always connected to your family.',
      accentColor: Color(0xFF283593),
    ),
  ];

  void _next() {
    if (_page < _slides.length - 1) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOutCubic,
      );
    } else {
      context.go('/login');
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);
    return Scaffold(
      body: Stack(children: [
        // Slide pages
        PageView.builder(
          controller:    _controller,
          onPageChanged: (i) => setState(() => _page = i),
          itemCount:     _slides.length,
          itemBuilder:   (_, i) => _SlidePage(slide: _slides[i]),
        ),

        // Bottom controls overlay (glass panel)
        Positioned(
          left: 0, right: 0, bottom: 0,
          child: _BottomControls(
            page:   _page,
            total:  _slides.length,
            onNext: _next,
            onSkip: () => context.go('/login'),
          ),
        ),
      ]),
    );
  }
}

// ── Slide page ────────────────────────────────────────────────────────────────

class _SlidePage extends StatelessWidget {
  const _SlidePage({required this.slide});
  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Container(
      // Full-screen Guardian gradient (per-slide accent)
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF002D56),
            slide.accentColor,
          ],
          begin: Alignment.topLeft,
          end:   Alignment.bottomRight,
          stops: const [0.0, 1.0],
        ),
      ),
      child: Stack(children: [
        // Polished sapphire radial overlay
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0.7, -0.5),
                radius: 1.1,
                colors: [
                  Ds.surfaceTint.withOpacity(0.18),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),

        SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(32, 60, 32, 180),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Icon in glass circle
                _GlassIcon(icon: slide.icon, color: slide.iconColor),
                SizedBox(height: size.height * 0.06),

                // Headline — Manrope w800
                Text(slide.title,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.manrope(
                      color:       Colors.white,
                      fontSize:    36,
                      fontWeight:  FontWeight.w800,
                      letterSpacing: -1.0,
                      height:      1.15,
                    )),
                const SizedBox(height: 20),

                // Body — Inter
                Text(slide.body,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      color:    Colors.white.withOpacity(0.70),
                      fontSize: 15,
                      height:   1.65,
                    )),
              ],
            ),
          ),
        ),
      ]),
    );
  }
}

// ── Glass icon container ──────────────────────────────────────────────────────

class _GlassIcon extends StatelessWidget {
  const _GlassIcon({required this.icon, required this.color});
  final IconData icon;
  final Color    color;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(36),
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
      child: Container(
        width:  120, height: 120,
        decoration: BoxDecoration(
          color:        Colors.white.withOpacity(0.12),
          borderRadius: BorderRadius.circular(36),
          border: Border.all(
              color: Colors.white.withOpacity(0.20), width: 1),
        ),
        child: Center(
          child: Icon(icon, size: 56, color: color),
        ),
      ),
    ),
  );
}

// ── Bottom controls ───────────────────────────────────────────────────────────

class _BottomControls extends StatelessWidget {
  const _BottomControls({
    required this.page,
    required this.total,
    required this.onNext,
    required this.onSkip,
  });
  final int page, total;
  final VoidCallback onNext, onSkip;

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final isLast    = page == total - 1;

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          padding: EdgeInsets.fromLTRB(32, 24, 32, 24 + bottomPad),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end:   Alignment.bottomCenter,
              colors: [
                Colors.transparent,
                Colors.black.withOpacity(0.35),
              ],
            ),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            // Pill indicator dots (tonal, not plain circles)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(total, (i) {
                final selected = i == page;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 280),
                  curve:    Curves.easeOutCubic,
                  margin:   const EdgeInsets.symmetric(horizontal: 4),
                  width:    selected ? 28 : 8,
                  height:   8,
                  decoration: BoxDecoration(
                    color: selected
                        ? Colors.white
                        : Colors.white.withOpacity(0.35),
                    borderRadius: BorderRadius.circular(4),
                  ),
                );
              }),
            ),
            const SizedBox(height: 28),

            // Primary CTA button
            SizedBox(
              width:  double.infinity,
              height: 54,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color:        Colors.white,
                  borderRadius: BorderRadius.circular(Ds.radiusDefault + 12),
                  boxShadow: [
                    BoxShadow(
                      color:      Colors.black.withOpacity(0.20),
                      blurRadius: 16,
                      offset:     const Offset(0, 4),
                    ),
                  ],
                ),
                child: ElevatedButton(
                  onPressed: onNext,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor:     Colors.transparent,
                    foregroundColor: Ds.primary,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(
                            Ds.radiusDefault + 12)),
                  ),
                  child: Text(
                    isLast ? 'Get Started' : 'Next',
                    style: GoogleFonts.inter(
                        fontSize: 16, fontWeight: FontWeight.w700,
                        color: Ds.primary),
                  ),
                ),
              ),
            ),

            // Skip link — only visible before last slide
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: !isLast
                  ? Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: TextButton(
                        onPressed: onSkip,
                        child: Text('Skip',
                            style: GoogleFonts.inter(
                              color:    Colors.white.withOpacity(0.55),
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            )),
                      ),
                    )
                  : const SizedBox(height: 48, key: ValueKey('spacer')),
            ),
          ]),
        ),
      ),
    );
  }
}

// ── Data ──────────────────────────────────────────────────────────────────────

class _Slide {
  const _Slide({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.body,
    required this.accentColor,
  });
  final IconData icon;
  final Color    iconColor;
  final String   title;
  final String   body;
  final Color    accentColor;
}
