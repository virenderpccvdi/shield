import 'package:flutter/material.dart';

class ShieldTheme {
  // ── Brand palette ────────────────────────────────────────────────────────
  static const Color primary        = Color(0xFF1565C0); // deep blue
  static const Color primaryLight   = Color(0xFF1976D2);
  static const Color primaryDark    = Color(0xFF0D47A1);
  static const Color accent         = Color(0xFF00B0FF); // sky accent
  static const Color success        = Color(0xFF2E7D32);
  static const Color successLight   = Color(0xFF43A047);
  static const Color warning        = Color(0xFFF57C00);
  static const Color danger         = Color(0xFFC62828);
  static const Color dangerLight    = Color(0xFFE53935);
  static const Color surface        = Color(0xFFF0F4F8);
  static const Color cardBg         = Colors.white;
  static const Color textPrimary    = Color(0xFF0D1B2A);
  static const Color textSecondary  = Color(0xFF546E7A);
  static const Color divider        = Color(0xFFE1E8EF);

  // ── Gradient presets ─────────────────────────────────────────────────────
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF1976D2), Color(0xFF0D47A1)],
  );

  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF1565C0), Color(0xFF0A2463), Color(0xFF012A4A)],
    stops: [0.0, 0.55, 1.0],
  );

  static const LinearGradient safeGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF1B5E20), Color(0xFF2E7D32)],
  );

  static const LinearGradient alertGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFB71C1C), Color(0xFFC62828)],
  );

  // ── Main theme ────────────────────────────────────────────────────────────
  static ThemeData get theme => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primary,
      primary: primary,
      secondary: accent,
      error: dangerLight,
      surface: cardBg,
      surfaceContainerHighest: surface,
    ),
    fontFamily: 'Roboto',
    scaffoldBackgroundColor: surface,

    // ── AppBar ──────────────────────────────────────────────────────────
    appBarTheme: const AppBarTheme(
      backgroundColor: cardBg,
      foregroundColor: textPrimary,
      elevation: 0,
      scrolledUnderElevation: 2,
      shadowColor: Color(0x18000000),
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: textPrimary,
        fontSize: 18,
        fontWeight: FontWeight.w700,
        fontFamily: 'Roboto',
      ),
      iconTheme: IconThemeData(color: textPrimary),
    ),

    // ── Cards ───────────────────────────────────────────────────────────
    cardTheme: CardTheme(
      elevation: 0,
      color: cardBg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: divider),
      ),
      margin: EdgeInsets.zero,
    ),

    // ── Buttons ─────────────────────────────────────────────────────────
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        minimumSize: const Size(double.infinity, 52),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: 0.3),
        elevation: 0,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: primary,
        side: const BorderSide(color: primary, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        minimumSize: const Size(double.infinity, 52),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        minimumSize: const Size(double.infinity, 52),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        elevation: 0,
      ),
    ),

    // ── Input fields ────────────────────────────────────────────────────
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF5F7FA),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: divider),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: divider),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: primary, width: 1.8),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: dangerLight),
      ),
      labelStyle: const TextStyle(color: textSecondary),
      hintStyle: TextStyle(color: textSecondary.withOpacity(0.6)),
    ),

    // ── Bottom NavBar (legacy, for backwards compat) ─────────────────────
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      selectedItemColor: primary,
      unselectedItemColor: textSecondary,
      backgroundColor: cardBg,
      type: BottomNavigationBarType.fixed,
      elevation: 8,
    ),

    // ── NavigationBar (Material 3) ─────────────────────────────────────
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: cardBg,
      indicatorColor: primary.withOpacity(0.12),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const TextStyle(color: primary, fontWeight: FontWeight.w600, fontSize: 11);
        }
        return const TextStyle(color: textSecondary, fontWeight: FontWeight.w400, fontSize: 11);
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return const IconThemeData(color: primary, size: 24);
        }
        return const IconThemeData(color: textSecondary, size: 24);
      }),
      elevation: 8,
      shadowColor: const Color(0x1A000000),
    ),

    // ── Chip ────────────────────────────────────────────────────────────
    chipTheme: ChipThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      backgroundColor: surface,
      selectedColor: primary.withOpacity(0.12),
      labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
    ),

    // ── Divider ─────────────────────────────────────────────────────────
    dividerTheme: const DividerThemeData(color: divider, thickness: 1, space: 1),

    // ── Switch ──────────────────────────────────────────────────────────
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) =>
        s.contains(WidgetState.selected) ? primary : Colors.white),
      trackColor: WidgetStateProperty.resolveWith((s) =>
        s.contains(WidgetState.selected) ? primary.withOpacity(0.5) : const Color(0xFFCFD8DC)),
    ),

    // ── ListTile ────────────────────────────────────────────────────────
    listTileTheme: const ListTileThemeData(
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    ),

    // ── Text ────────────────────────────────────────────────────────────
    textTheme: const TextTheme(
      displayLarge:  TextStyle(color: textPrimary, fontWeight: FontWeight.w800),
      displayMedium: TextStyle(color: textPrimary, fontWeight: FontWeight.w700),
      headlineLarge: TextStyle(color: textPrimary, fontWeight: FontWeight.w700),
      headlineMedium:TextStyle(color: textPrimary, fontWeight: FontWeight.w700),
      headlineSmall: TextStyle(color: textPrimary, fontWeight: FontWeight.w700),
      titleLarge:    TextStyle(color: textPrimary, fontWeight: FontWeight.w600),
      titleMedium:   TextStyle(color: textPrimary, fontWeight: FontWeight.w600),
      titleSmall:    TextStyle(color: textPrimary, fontWeight: FontWeight.w600),
      bodyLarge:     TextStyle(color: textPrimary),
      bodyMedium:    TextStyle(color: textSecondary),
      bodySmall:     TextStyle(color: textSecondary),
      labelLarge:    TextStyle(color: textPrimary, fontWeight: FontWeight.w500),
      labelSmall:    TextStyle(color: textSecondary),
    ),
  );
}
