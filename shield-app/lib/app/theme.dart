import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ShieldTheme — complete design system
//
// Palette (8-px grid, WCAG AA compliant):
//   Primary     #1565C0  Shield blue
//   Secondary   #0288D1  Sky blue
//   Accent      #00ACC1  Cyan (charts, highlights)
//   Success     #2E7D32
//   Warning     #F57F17
//   Error       #C62828
//   Surface L   #F4F6FA  Page background (light)
//   Surface D   #0F172A  Page background (dark)
//   Card L      #FFFFFF
//   Card D      #1E293B
// ─────────────────────────────────────────────────────────────────────────────

class ShieldTheme {
  ShieldTheme._();

  // ── Brand tokens ─────────────────────────────────────────────────────────────
  static const Color primary    = Color(0xFF1565C0);
  static const Color secondary  = Color(0xFF0288D1);
  static const Color accent     = Color(0xFF00ACC1);
  static const Color success    = Color(0xFF2E7D32);
  static const Color warning    = Color(0xFFF57F17);
  static const Color danger     = Color(0xFFC62828);

  static const Color surfaceLight = Color(0xFFF4F6FA);
  static const Color surfaceDark  = Color(0xFF0F172A);
  static const Color cardLight    = Color(0xFFFFFFFF);
  static const Color cardDark     = Color(0xFF1E293B);

  // Chart colours (consistent across themes)
  static const List<Color> chartPalette = [
    Color(0xFF1565C0),
    Color(0xFF00ACC1),
    Color(0xFF2E7D32),
    Color(0xFFF57F17),
    Color(0xFF9C27B0),
    Color(0xFFC62828),
  ];

  // ── Light theme ───────────────────────────────────────────────────────────────
  static ThemeData get light => _build(Brightness.light);

  // ── Dark theme ────────────────────────────────────────────────────────────────
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final colorScheme = ColorScheme.fromSeed(
      seedColor:  primary,
      brightness: brightness,
      surface:    isDark ? surfaceDark  : surfaceLight,
      onSurface:  isDark ? Colors.white : const Color(0xFF1A1A2E),
    );

    return ThemeData(
      useMaterial3:           true,
      colorScheme:            colorScheme,
      brightness:             brightness,
      scaffoldBackgroundColor: isDark ? surfaceDark : surfaceLight,

      // ── AppBar ──────────────────────────────────────────────────────────────
      appBarTheme: AppBarTheme(
        backgroundColor:   isDark ? const Color(0xFF1E293B) : primary,
        foregroundColor:   Colors.white,
        elevation:         0,
        centerTitle:       false,
        titleTextStyle:    const TextStyle(
          fontSize: 18, fontWeight: FontWeight.w600,
          color: Colors.white, letterSpacing: -0.2,
        ),
        systemOverlayStyle: isDark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.light.copyWith(
                statusBarColor: Colors.transparent,
              ),
      ),

      // ── Cards ───────────────────────────────────────────────────────────────
      cardTheme: CardThemeData(
        color:     isDark ? cardDark : cardLight,
        elevation: isDark ? 0 : 1,
        shadowColor: Colors.black12,
        shape:     RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: isDark
              ? const BorderSide(color: Color(0xFF334155), width: 1)
              : BorderSide.none,
        ),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      ),

      // ── Elevated button ─────────────────────────────────────────────────────
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          minimumSize:     const Size.fromHeight(52),
          elevation:       0,
          shape:  RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(
              fontSize: 15, fontWeight: FontWeight.w600, letterSpacing: 0.2),
        ),
      ),

      // ── Outlined button ─────────────────────────────────────────────────────
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          minimumSize:     const Size.fromHeight(52),
          shape:  RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          side:   const BorderSide(color: primary, width: 1.5),
        ),
      ),

      // ── Text button ─────────────────────────────────────────────────────────
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: primary),
      ),

      // ── Input fields ────────────────────────────────────────────────────────
      inputDecorationTheme: InputDecorationTheme(
        filled:     true,
        fillColor:  isDark ? const Color(0xFF263044) : Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: isDark ? Colors.white12 : Colors.black12),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
              color: isDark ? const Color(0xFF334155) : const Color(0xFFDDE1EA)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primary, width: 2),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        labelStyle: TextStyle(color: isDark ? Colors.white54 : Colors.black54),
      ),

      // ── Navigation bar (Material 3) ─────────────────────────────────────────
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor:      isDark ? const Color(0xFF1E293B) : Colors.white,
        indicatorColor:       primary.withOpacity(0.15),
        iconTheme:            WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: primary, size: 24);
          }
          return IconThemeData(
              color: isDark ? Colors.white38 : Colors.black38, size: 22);
        }),
        labelTextStyle:       WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(color: primary, fontSize: 11,
                fontWeight: FontWeight.w600);
          }
          return TextStyle(
              color: isDark ? Colors.white38 : Colors.black38,
              fontSize: 11);
        }),
        elevation:            8,
        shadowColor:          Colors.black26,
        labelBehavior:        NavigationDestinationLabelBehavior.alwaysShow,
      ),

      // ── List tiles ──────────────────────────────────────────────────────────
      listTileTheme: ListTileThemeData(
        tileColor:    Colors.transparent,
        iconColor:    isDark ? Colors.white60 : Colors.black54,
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      ),

      // ── Divider ─────────────────────────────────────────────────────────────
      dividerTheme: DividerThemeData(
        color:  isDark ? Colors.white10 : Colors.black12,
        space:  1,
        indent: 20, endIndent: 20,
      ),

      // ── Chip ────────────────────────────────────────────────────────────────
      chipTheme: ChipThemeData(
        backgroundColor: isDark ? const Color(0xFF263044) : const Color(0xFFF0F4FF),
        labelStyle: TextStyle(
            fontSize: 12,
            color: isDark ? Colors.white70 : Colors.black87),
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      ),

      // ── Floating action button ───────────────────────────────────────────────
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation:       3,
        shape:  RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(16))),
      ),

      // ── Switch / checkbox ────────────────────────────────────────────────────
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected) ? primary : Colors.grey),
        trackColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected)
                ? primary.withOpacity(0.4)
                : Colors.grey.withOpacity(0.3)),
      ),

      // ── Bottom sheet ─────────────────────────────────────────────────────────
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor:   isDark ? const Color(0xFF1E293B) : Colors.white,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        elevation:         8,
      ),

      // ── Dialog ──────────────────────────────────────────────────────────────
      dialogTheme: DialogThemeData(
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        elevation: 8,
      ),

      // ── Snack bar ────────────────────────────────────────────────────────────
      snackBarTheme: SnackBarThemeData(
        behavior:         SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        backgroundColor:  isDark ? const Color(0xFF334155) : const Color(0xFF1A1A2E),
        contentTextStyle: const TextStyle(color: Colors.white, fontSize: 13),
      ),
    );
  }
}
