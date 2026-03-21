import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../app/theme.dart';
import '../../core/shield_logo.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  static const int _totalPages = 4;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _markDone() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_done', true);
  }

  Future<void> _skip() async {
    await _markDone();
    if (mounted) context.go('/dashboard');
  }

  Future<void> _getStarted() async {
    await _markDone();
    if (mounted) context.go('/family/new');
  }

  void _nextPage() {
    _pageController.nextPage(
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Pages
          PageView(
            controller: _pageController,
            onPageChanged: (i) => setState(() => _currentPage = i),
            children: const [
              _WelcomePage(),
              _AddChildPage(),
              _ProtectionPage(),
              _ConnectDevicePage(),
            ],
          ),

          // Skip button (top right)
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(top: 8, right: 16),
                child: TextButton(
                  onPressed: _skip,
                  style: TextButton.styleFrom(
                    foregroundColor: _currentPage == 0
                        ? Colors.white70
                        : ShieldTheme.textSecondary,
                  ),
                  child: const Text('Skip',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                ),
              ),
            ),
          ),

          // Bottom nav (dots + button)
          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Dot indicators
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(_totalPages, (i) {
                        final isActive = i == _currentPage;
                        return AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: isActive ? 24 : 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: isActive
                                ? ShieldTheme.primary
                                : ShieldTheme.divider,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 20),
                    // Action button
                    if (_currentPage < _totalPages - 1)
                      FilledButton(
                        onPressed: _nextPage,
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(double.infinity, 52),
                        ),
                        child: const Text('Next'),
                      )
                    else
                      Column(
                        children: [
                          FilledButton(
                            onPressed: _getStarted,
                            style: FilledButton.styleFrom(
                              minimumSize: const Size(double.infinity, 52),
                            ),
                            child: const Text('Get Started'),
                          ),
                          const SizedBox(height: 10),
                          TextButton(
                            onPressed: _skip,
                            child: const Text('Skip for now',
                                style: TextStyle(
                                    color: ShieldTheme.textSecondary,
                                    fontWeight: FontWeight.w500)),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Page 1: Welcome ─────────────────────────────────────────────────────────

class _WelcomePage extends StatelessWidget {
  const _WelcomePage();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: ShieldTheme.heroGradient),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(32, 60, 32, 120),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const ShieldLogoHero(size: 80),
              const SizedBox(height: 36),
              const Text(
                'Welcome to Shield',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 30,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              const Text(
                'The smart family internet protection system',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white.withOpacity(0.15)),
                ),
                child: const Text(
                  'Monitor, protect, and manage your child\'s online activity with AI-powered insights',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    height: 1.6,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Page 2: Add Your First Child ────────────────────────────────────────────

class _AddChildPage extends StatelessWidget {
  const _AddChildPage();

  @override
  Widget build(BuildContext context) {
    return _ContentPage(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _IconCircle(
            icon: Icons.child_care_rounded,
            color: ShieldTheme.primary,
            size: 72,
          ),
          const SizedBox(height: 32),
          const Text(
            'Add a Child Profile',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: ShieldTheme.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          const Text(
            'Create profiles for each child to set personalized content filters, schedules, and screen time limits',
            style: TextStyle(
              fontSize: 15,
              color: ShieldTheme.textSecondary,
              height: 1.6,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 28),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: ShieldTheme.primary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: ShieldTheme.primary.withOpacity(0.2)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.flag_rounded, color: ShieldTheme.primary, size: 16),
                SizedBox(width: 8),
                Text(
                  'Step 1 of 3',
                  style: TextStyle(
                    color: ShieldTheme.primary,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Page 3: Set Up Protection ────────────────────────────────────────────────

class _ProtectionPage extends StatelessWidget {
  const _ProtectionPage();

  @override
  Widget build(BuildContext context) {
    return _ContentPage(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _IconCircle(
            icon: Icons.shield_rounded,
            color: const Color(0xFF2E7D32),
            size: 72,
          ),
          const SizedBox(height: 32),
          const Text(
            'Smart Content Filtering',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: ShieldTheme.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          const Text(
            'Block harmful content, set internet schedules, and monitor usage with AI behavioral insights',
            style: TextStyle(
              fontSize: 15,
              color: ShieldTheme.textSecondary,
              height: 1.6,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 28),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 10,
            runSpacing: 10,
            children: const [
              _FeatureChip(label: 'DNS Filtering', icon: Icons.dns_rounded, color: Color(0xFF1565C0)),
              _FeatureChip(label: 'Screen Time', icon: Icons.access_time_rounded, color: Color(0xFF7B1FA2)),
              _FeatureChip(label: 'AI Insights', icon: Icons.psychology_rounded, color: Color(0xFFBF360C)),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Page 4: Connect Child's Device ──────────────────────────────────────────

class _ConnectDevicePage extends StatelessWidget {
  const _ConnectDevicePage();

  @override
  Widget build(BuildContext context) {
    return _ContentPage(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _IconCircle(
            icon: Icons.smartphone_rounded,
            color: const Color(0xFF00695C),
            size: 72,
          ),
          const SizedBox(height: 32),
          const Text(
            'Connect Child\'s Device',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: ShieldTheme.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          const Text(
            'Download the Shield app on your child\'s device and scan the QR code to link it',
            style: TextStyle(
              fontSize: 15,
              color: ShieldTheme.textSecondary,
              height: 1.6,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 28),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF00695C).withOpacity(0.06),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF00695C).withOpacity(0.2)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.qr_code_scanner_rounded, color: Color(0xFF00695C), size: 28),
                SizedBox(width: 14),
                Flexible(
                  child: Text(
                    'A QR code will be generated after you add your first child',
                    style: TextStyle(
                      color: Color(0xFF00695C),
                      fontSize: 13,
                      height: 1.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shared widgets ──────────────────────────────────────────────────────────

class _ContentPage extends StatelessWidget {
  final Widget child;
  const _ContentPage({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: ShieldTheme.surface,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(32, 60, 32, 140),
          child: child,
        ),
      ),
    );
  }
}

class _IconCircle extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;
  const _IconCircle({required this.icon, required this.color, required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size * 1.6,
      height: size * 1.6,
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        shape: BoxShape.circle,
        border: Border.all(color: color.withOpacity(0.2), width: 2),
      ),
      child: Icon(icon, size: size, color: color),
    );
  }
}

class _FeatureChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  const _FeatureChip({required this.label, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 7),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
