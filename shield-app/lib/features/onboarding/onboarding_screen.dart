import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

// ─────────────────────────────────────────────────────────────────────────────
// OnboardingScreen — 3-slide introduction shown once on first install.
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
      gradient:   [Color(0xFF1E40AF), Color(0xFF2563EB)],
      icon:       Icons.shield,
      iconColor:  Color(0xFF4FC3F7),
      title:      'Smart Family Protection',
      body:       'Shield blocks harmful content, enforces safe browsing, '
                  'and keeps your children protected — automatically.',
    ),
    _Slide(
      gradient:   [Color(0xFF004D40), Color(0xFF00796B)],
      icon:       Icons.schedule,
      iconColor:  Color(0xFF80CBC4),
      title:      'Screen Time Control',
      body:       'Set daily limits, bedtime lockdowns, and homework mode. '
                  'Healthy digital habits built right in.',
    ),
    _Slide(
      gradient:   [Color(0xFF1E40AF), Color(0xFF283593)],
      icon:       Icons.location_on,
      iconColor:  Color(0xFF9FA8DA),
      title:      'Always Know Where They Are',
      body:       'Real-time location, geofence alerts, and location history '
                  'so you\'re always connected to your family.',
    ),
  ];

  void _next() {
    if (_page < _slides.length - 1) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
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
  Widget build(BuildContext context) => Scaffold(
    body: Stack(children: [
      // Pages
      PageView.builder(
        controller: _controller,
        onPageChanged: (i) => setState(() => _page = i),
        itemCount: _slides.length,
        itemBuilder: (_, i) => _SlidePage(slide: _slides[i]),
      ),

      // Bottom controls overlay
      Positioned(
        left: 0, right: 0, bottom: 0,
        child: _BottomControls(
          page:      _page,
          total:     _slides.length,
          onNext:    _next,
          onSkip:    () => context.go('/login'),
        ),
      ),
    ]),
  );
}

// ── Slide page ────────────────────────────────────────────────────────────────

class _SlidePage extends StatelessWidget {
  const _SlidePage({required this.slide});
  final _Slide slide;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      gradient: LinearGradient(
        colors: slide.gradient,
        begin: Alignment.topCenter, end: Alignment.bottomCenter,
      ),
    ),
    child: SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(32, 80, 32, 160),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Icon container
            Container(
              width: 120, height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.12),
              ),
              child: Icon(slide.icon, size: 60, color: slide.iconColor),
            ),
            const SizedBox(height: 48),

            Text(slide.title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28, fontWeight: FontWeight.bold,
                  letterSpacing: -0.5, height: 1.2,
                )),
            const SizedBox(height: 20),

            Text(slide.body,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.75),
                  fontSize: 15, height: 1.6,
                )),
          ],
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
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(32, 0, 32, 48),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      // Dots
      Row(mainAxisAlignment: MainAxisAlignment.center, children: List.generate(
        total,
        (i) => AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width:  i == page ? 24 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: i == page ? Colors.white : Colors.white30,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      )),
      const SizedBox(height: 32),

      // Next / Get Started button
      SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          onPressed: onNext,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.white,
            foregroundColor: const Color(0xFF2563EB),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14)),
            elevation: 0,
          ),
          child: Text(
            page == total - 1 ? 'Get Started' : 'Next',
            style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700),
          ),
        ),
      ),
      const SizedBox(height: 12),

      // Skip
      if (page < total - 1)
        TextButton(
          onPressed: onSkip,
          child: Text('Skip',
              style: TextStyle(
                  color: Colors.white.withOpacity(0.6), fontSize: 14)),
        ),
    ]),
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

class _Slide {
  const _Slide({
    required this.gradient,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.body,
  });
  final List<Color> gradient;
  final IconData    icon;
  final Color       iconColor;
  final String      title;
  final String      body;
}
