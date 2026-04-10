import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/theme.dart';
import '../notifications/notifications_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ParentShell — Guardian's Lens glassmorphism navigation.
//
// The nav bar uses BackdropFilter + surface @ 92% opacity to let content
// "bleed through" — the "airy, integrated" feel from the design spec.
// Selected state shows a small pill indicator, not a full-width highlight.
// ─────────────────────────────────────────────────────────────────────────────

class ParentShell extends ConsumerWidget {
  const ParentShell({super.key, required this.child});
  final Widget child;

  static const _tabs = [
    _Tab('/parent/dashboard', Icons.home_outlined,       Icons.home_rounded,          'Home'),
    _Tab('/parent/family',    Icons.group_outlined,       Icons.group_rounded,          'Family'),
    _Tab('/parent/map',       Icons.map_outlined,          Icons.map_rounded,            'Map'),
    _Tab('/parent/alerts',    Icons.notifications_outlined,Icons.notifications_rounded,  'Alerts'),
    _Tab('/parent/settings',  Icons.settings_outlined,     Icons.settings_rounded,       'More'),
  ];

  int _indexFor(String location) {
    for (var i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location    = GoRouterState.of(context).matchedLocation;
    final current     = _indexFor(location);
    final unreadAsync = ref.watch(unreadCountProvider);
    final unread      = unreadAsync.valueOrNull ?? 0;

    return Scaffold(
      extendBody: true,  // content slides under the glass nav bar
      body: child,
      bottomNavigationBar: _GlassNavBar(
        current:   current,
        unread:    unread,
        tabs:      _tabs,
        onSelect:  (i) { if (i != current) context.go(_tabs[i].path); },
      ),
    );
  }
}

// ── Glass navigation bar ─────────────────────────────────────────────────────

class _GlassNavBar extends StatelessWidget {
  const _GlassNavBar({
    required this.current,
    required this.unread,
    required this.tabs,
    required this.onSelect,
  });
  final int current;
  final int unread;
  final List<_Tab> tabs;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final isDark     = Theme.of(context).brightness == Brightness.dark;
    final cs         = Theme.of(context).colorScheme;
    final bottomPad  = MediaQuery.of(context).padding.bottom;

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: BoxDecoration(
            color: isDark
                ? Ds.surfaceContainerLowDark.withOpacity(0.90)
                : Colors.white.withOpacity(0.92),
            // Ghost border at top — accessibility separator, not structural
            border: Border(
              top: BorderSide(
                color: cs.outlineVariant.withOpacity(0.4),
                width: 0.5,
              ),
            ),
          ),
          padding: EdgeInsets.fromLTRB(8, 8, 8, 8 + bottomPad),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              for (var i = 0; i < tabs.length; i++)
                _NavItem(
                  tab:       tabs[i],
                  selected:  i == current,
                  showBadge: tabs[i].label == 'Alerts' && unread > 0,
                  badgeCount: unread,
                  onTap:     () => onSelect(i),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.tab,
    required this.selected,
    required this.onTap,
    this.showBadge  = false,
    this.badgeCount = 0,
  });
  final _Tab tab;
  final bool selected;
  final VoidCallback onTap;
  final bool showBadge;
  final int  badgeCount;

  @override
  Widget build(BuildContext context) {
    final cs  = Theme.of(context).colorScheme;
    final col = selected ? cs.primary : cs.onSurfaceVariant;

    return GestureDetector(
      onTap:      onTap,
      behavior:   HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve:    Curves.easeOutCubic,
        padding:  const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: selected
            ? BoxDecoration(
                color:        cs.primary.withOpacity(0.10),
                borderRadius: BorderRadius.circular(99),
              )
            : null,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: Icon(
                  selected ? tab.filled : tab.outline,
                  key:   ValueKey(selected),
                  color: col,
                  size:  22,
                ),
              ),
              if (showBadge)
                Positioned(
                  right: -6, top: -4,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: cs.tertiary,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      badgeCount > 9 ? '9+' : '$badgeCount',
                      style: const TextStyle(
                          color: Colors.white, fontSize: 8,
                          fontWeight: FontWeight.w800),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 3),
          AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 200),
            style: GoogleFonts.inter(
              fontSize: 10,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              color: col,
            ),
            child: Text(tab.label),
          ),
        ]),
      ),
    );
  }
}

class _Tab {
  const _Tab(this.path, this.outline, this.filled, this.label);
  final String   path;
  final IconData outline;
  final IconData filled;
  final String   label;
}
