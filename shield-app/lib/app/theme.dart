import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ShieldTheme — complete design system
//
// Palette (8-px grid, WCAG AA compliant):
//   Primary     #2563EB  Blue
//   PrimaryDark #1E40AF  Dark Blue
//   Secondary   #374151  Slate
//   Accent      #0EA5E9  Sky
//   Warning     #D97706  Amber
//   Danger      #DC2626  Red
//   Background  #F8FAFC  Slate White
//   Card        #FFFFFF  White
// ─────────────────────────────────────────────────────────────────────────────

class ShieldTheme {
  ShieldTheme._();

  // ── Core palette ─────────────────────────────────────────────────────────────
  static const Color primary      = Color(0xFF2563EB);
  static const Color primaryDark  = Color(0xFF1E40AF);
  static const Color primaryLight = Color(0xFF3B82F6);
  static const Color primaryChip  = Color(0xFFDBEAFE);
  static const Color secondary    = Color(0xFF374151);
  static const Color accent       = Color(0xFF0EA5E9);
  static const Color accentDark   = Color(0xFF0284C7);
  static const Color warning      = Color(0xFFD97706);
  static const Color danger       = Color(0xFFDC2626);
  static const Color success      = Color(0xFF16A34A);

  // ── Surfaces ─────────────────────────────────────────────────────────────────
  static const Color background   = Color(0xFFF8FAFC);
  static const Color card         = Color(0xFFFFFFFF);
  static const Color surfaceLight = Color(0xFFF8FAFC);
  static const Color surfaceDark  = Color(0xFF0F172A);
  static const Color cardLight    = Color(0xFFFFFFFF);
  static const Color cardDark     = Color(0xFF1E293B);

  // ── Text ─────────────────────────────────────────────────────────────────────
  static const Color text         = Color(0xFF0F172A);
  static const Color muted        = Color(0xFF64748B);
  static const Color subtle       = Color(0xFF94A3B8);
  static const Color border       = Color(0xFFE2E8F0);

  // ── Chart palette ─────────────────────────────────────────────────────────────
  static const List<Color> chartPalette = [
    Color(0xFF2563EB),  // Primary blue
    Color(0xFF16A34A),  // Green
    Color(0xFF3B82F6),  // Blue light
    Color(0xFFD97706),  // Amber
    Color(0xFF7C3AED),  // Purple
    Color(0xFFDC2626),  // Red
    Color(0xFF0284C7),  // Green
    Color(0xFF6366F1),  // Indigo
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
      onSurface:  isDark ? const Color(0xFFF9FAFB) : text,
    );

    return ThemeData(
      useMaterial3:            true,
      colorScheme:             colorScheme,
      brightness:              brightness,
      scaffoldBackgroundColor: isDark ? surfaceDark : surfaceLight,

      // ── Typography ──────────────────────────────────────────────────────────
      textTheme: TextTheme(
        displayLarge: TextStyle(
          fontWeight: FontWeight.w800,
          letterSpacing: -1.0,
          color: isDark ? Colors.white : text,
        ),
        headlineMedium: const TextStyle(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
        ),
        titleLarge: const TextStyle(
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
        titleMedium: const TextStyle(
          fontWeight: FontWeight.w600,
        ),
        bodyLarge:  const TextStyle(fontSize: 15.0),
        bodyMedium: const TextStyle(fontSize: 13.5),
        labelLarge: const TextStyle(
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),

      // ── AppBar ──────────────────────────────────────────────────────────────
      appBarTheme: AppBarTheme(
        backgroundColor: isDark ? const Color(0xFF1E293B) : primaryDark,
        foregroundColor: Colors.white,
        elevation:       0,
        centerTitle:     false,
        titleTextStyle:  const TextStyle(
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
        color:       isDark ? cardDark : card,
        elevation:   isDark ? 0 : 1,
        shadowColor: Colors.black.withOpacity(0.05),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
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
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(
              fontSize: 15, fontWeight: FontWeight.w600, letterSpacing: 0.2),
        ),
      ),

      // ── Outlined button ─────────────────────────────────────────────────────
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          minimumSize:     const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          side: const BorderSide(color: primary, width: 1.5),
        ),
      ),

      // ── Text button ─────────────────────────────────────────────────────────
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: primary),
      ),

      // ── Input fields ────────────────────────────────────────────────────────
      inputDecorationTheme: InputDecorationTheme(
        filled:    true,
        fillColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: isDark ? Colors.white12 : Colors.black12),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
              color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primary, width: 2),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        labelStyle: TextStyle(color: isDark ? Colors.white70 : Colors.black87),
      ),

      // ── Navigation bar (Material 3) ─────────────────────────────────────────
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        indicatorColor:  primary.withOpacity(0.12),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: primary, size: 24);
          }
          return IconThemeData(
              color: isDark ? Colors.white60 : const Color(0xFF64748B),
              size: 22);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(
                color: primary, fontSize: 11, fontWeight: FontWeight.w600);
          }
          return TextStyle(
              color: isDark ? Colors.white60 : const Color(0xFF64748B),
              fontSize: 11);
        }),
        elevation:     8,
        shadowColor:   Colors.black45,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      ),

      // ── List tiles ──────────────────────────────────────────────────────────
      listTileTheme: ListTileThemeData(
        tileColor:      Colors.transparent,
        iconColor:      isDark ? Colors.white60 : const Color(0xFF64748B),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      ),

      // ── Divider ─────────────────────────────────────────────────────────────
      dividerTheme: DividerThemeData(
        color:     isDark ? Colors.white10 : const Color(0xFFE2E8F0),
        space:     1,
        indent:    20,
        endIndent: 20,
      ),

      // ── Chip ────────────────────────────────────────────────────────────────
      chipTheme: ChipThemeData(
        backgroundColor: isDark ? const Color(0xFF1E40AF) : const Color(0xFFDBEAFE),
        labelStyle: TextStyle(
            fontSize: 12,
            color: isDark ? Colors.white70 : primaryDark),
        side:    BorderSide.none,
        shape:   RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      ),

      // ── Floating action button ───────────────────────────────────────────────
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation:       3,
        shape: RoundedRectangleBorder(
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
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        elevation: 8,
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
        backgroundColor:  isDark ? const Color(0xFF1E293B) : const Color(0xFF0F172A),
        contentTextStyle: const TextStyle(color: Colors.white, fontSize: 13),
      ),
    );
  }
}
