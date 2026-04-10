import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ShieldTheme — "The Digital Sanctuary" / Guardian's Lens design system
//
// Philosophy:
//   · No 1px lines for structure — hierarchy via tonal surface shifts
//   · Manrope (Display/Headline) + Inter (Body/Label) dual-font
//   · Guardian Shadow: ambient, never black (on_surface @ 6%)
//   · "Polished sapphire" on hero containers (15% surfaceTint overlay)
//   · Parent mode: full primary palette — Child mode: secondary, larger radius
//   · 24-px safe-zone screen edges
// ─────────────────────────────────────────────────────────────────────────────

class Ds {
  Ds._();

  // ── Primary hierarchy ───────────────────────────────────────────────────────
  static const Color primary          = Color(0xFF005DAC);  // Guardian Blue
  static const Color primaryContainer = Color(0xFF1976D2);  // Supportive blue
  static const Color onPrimary        = Color(0xFFFFFFFF);
  static const Color onPrimaryContainer = Color(0xFFE3F2FD);

  // ── Child-mode primary (secondary role) ────────────────────────────────────
  static const Color childPrimary          = Color(0xFF0288D1);  // Sky blue
  static const Color childPrimaryContainer = Color(0xFF039BE5);

  // ── Semantic ────────────────────────────────────────────────────────────────
  static const Color tertiary          = Color(0xFFBF360C);  // Alert/danger accent
  static const Color tertiaryContainer = Color(0xFFFFECE5);
  static const Color success           = Color(0xFF2E7D32);
  static const Color successContainer  = Color(0xFFE8F5E9);
  static const Color warning           = Color(0xFFE65100);
  static const Color warningContainer  = Color(0xFFFFF3E0);
  static const Color danger            = Color(0xFFC62828);
  static const Color dangerContainer   = Color(0xFFFFEBEE);
  static const Color info              = Color(0xFF0277BD);
  static const Color infoContainer     = Color(0xFFE1F5FE);

  // ── Surface tiers (light) — hierarchy without lines ─────────────────────────
  static const Color surface               = Color(0xFFF7F9FB); // canvas
  static const Color surfaceContainerLowest = Color(0xFFFFFFFF); // pure white card
  static const Color surfaceContainerLow   = Color(0xFFF0F4F8); // elevated card
  static const Color surfaceContainer      = Color(0xFFE8EEF4); // section bg
  static const Color surfaceContainerHigh  = Color(0xFFDCE6EF); // grouped inputs
  static const Color surfaceContainerHighest = Color(0xFFD0DCEA);
  static const Color surfaceTint           = Color(0xFF005DAC); // 15% overlay on hero

  // ── Surface tiers (dark) ────────────────────────────────────────────────────
  static const Color surfaceDark               = Color(0xFF0D1B2A);
  static const Color surfaceContainerLowestDark = Color(0xFF0A1520);
  static const Color surfaceContainerLowDark   = Color(0xFF122030);
  static const Color surfaceContainerDark      = Color(0xFF192B3E);
  static const Color surfaceContainerHighDark  = Color(0xFF1E3349);
  static const Color surfaceContainerHighestDark = Color(0xFF243B54);

  // ── On-surface text ─────────────────────────────────────────────────────────
  static const Color onSurface        = Color(0xFF0F1F3D);
  static const Color onSurfaceVariant = Color(0xFF4A6481);  // secondary text
  static const Color outlineVariant   = Color(0xFFC4D0DC);  // ghost borders only @ 20%
  static const Color outlineVariantDark = Color(0xFF2A3F56);

  // ── Chart palette ─────────────────────────────────────────────────────────
  static const List<Color> chartPalette = [
    Color(0xFF005DAC), Color(0xFF2E7D32), Color(0xFF0288D1),
    Color(0xFFE65100), Color(0xFF6A1B9A), Color(0xFFC62828),
    Color(0xFF00838F), Color(0xFF283593),
  ];

  // ── Guardian Shadow (ambient, never black) ──────────────────────────────────
  static List<BoxShadow> guardianShadow({double opacity = 0.06}) => [
    BoxShadow(
      color:       onSurface.withOpacity(opacity),
      blurRadius:  32,
      spreadRadius: -4,
    ),
  ];

  static List<BoxShadow> guardianShadowSmall({double opacity = 0.05}) => [
    BoxShadow(
      color:       onSurface.withOpacity(opacity),
      blurRadius:  12,
      spreadRadius: -2,
    ),
  ];

  // ── Child mode adjustments ──────────────────────────────────────────────────
  static const double radiusDefault = 12.0;  // Parent mode
  static const double radiusChild   = 20.0;  // Child mode — "protective bubble"

  // ── Light theme ─────────────────────────────────────────────────────────────
  static ThemeData get light => _build(Brightness.light, isChild: false);
  static ThemeData get lightChild => _build(Brightness.light, isChild: true);

  // ── Dark theme ──────────────────────────────────────────────────────────────
  static ThemeData get dark => _build(Brightness.dark, isChild: false);

  static ThemeData _build(Brightness brightness, {required bool isChild}) {
    final isDark = brightness == Brightness.dark;
    final p = isChild ? childPrimary : primary;
    final pCont = isChild ? childPrimaryContainer : primaryContainer;
    final r = isChild ? radiusChild : radiusDefault;

    final surf = isDark ? surfaceDark : surface;
    final surfLow = isDark ? surfaceContainerLowDark : surfaceContainerLow;
    final surfLowest = isDark ? surfaceContainerLowestDark : surfaceContainerLowest;
    final onSurf = isDark ? const Color(0xFFE8EFF6) : onSurface;
    final onSurfVar = isDark ? const Color(0xFF8AA5BE) : onSurfaceVariant;
    final outlineVar = isDark ? outlineVariantDark : outlineVariant;

    // Dual-font text theme: Manrope for display/headlines, Inter for body
    final manrope = GoogleFonts.manropeTextTheme(GoogleFonts.interTextTheme()).copyWith(
      displayLarge:  GoogleFonts.manrope(
        fontSize: 57, fontWeight: FontWeight.w800, letterSpacing: -1.5,
        color: isDark ? const Color(0xFFE8EFF6) : onSurface,
      ),
      displayMedium: GoogleFonts.manrope(
        fontSize: 45, fontWeight: FontWeight.w800, letterSpacing: -1.0,
        color: isDark ? const Color(0xFFE8EFF6) : onSurface,
      ),
      displaySmall:  GoogleFonts.manrope(
        fontSize: 36, fontWeight: FontWeight.w700, letterSpacing: -0.8,
        color: isDark ? const Color(0xFFE8EFF6) : onSurface,
      ),
      headlineLarge:  GoogleFonts.manrope(
        fontSize: 32, fontWeight: FontWeight.w700, letterSpacing: -0.5,
      ),
      headlineMedium: GoogleFonts.manrope(
        fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: -0.4,
      ),
      headlineSmall:  GoogleFonts.manrope(
        fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.3,
      ),
      titleLarge:  GoogleFonts.manrope(
        fontSize: 22, fontWeight: FontWeight.w700, letterSpacing: -0.2,
      ),
      titleMedium: GoogleFonts.manrope(
        fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: -0.1,
      ),
      titleSmall: GoogleFonts.manrope(
        fontSize: 14, fontWeight: FontWeight.w600,
      ),
    );

    final textTheme = manrope.copyWith(
      bodyLarge:   GoogleFonts.inter(fontSize: 16, letterSpacing: 0),
      bodyMedium:  GoogleFonts.inter(fontSize: 14),
      bodySmall:   GoogleFonts.inter(fontSize: 12),
      labelLarge:  GoogleFonts.inter(
        fontSize: 14, fontWeight: FontWeight.w600, letterSpacing: 0.1),
      labelMedium: GoogleFonts.inter(
        fontSize: 12, fontWeight: FontWeight.w500, letterSpacing: 0.2),
      labelSmall:  GoogleFonts.inter(
        fontSize: 11, fontWeight: FontWeight.w500,
        letterSpacing: 0.5, color: onSurfVar),
    );

    final colorScheme = ColorScheme(
      brightness:        brightness,
      primary:           p,
      onPrimary:         onPrimary,
      primaryContainer:  pCont,
      onPrimaryContainer: isDark ? const Color(0xFFBBDEFB) : onPrimaryContainer,
      secondary:         isChild ? const Color(0xFF26C6DA) : const Color(0xFF0277BD),
      onSecondary:       Colors.white,
      secondaryContainer: isChild ? const Color(0xFFE0F7FA) : infoContainer,
      onSecondaryContainer: isChild ? const Color(0xFF006064) : const Color(0xFF01579B),
      tertiary:          tertiary,
      onTertiary:        Colors.white,
      tertiaryContainer: isDark ? const Color(0xFF4A1A0A) : tertiaryContainer,
      onTertiaryContainer: isDark ? const Color(0xFFFFCCB8) : const Color(0xFF7F2B0E),
      error:             danger,
      onError:           Colors.white,
      errorContainer:    isDark ? const Color(0xFF400E10) : dangerContainer,
      onErrorContainer:  isDark ? const Color(0xFFFFB3B3) : danger,
      surface:           surf,
      onSurface:         onSurf,
      surfaceContainerLowest: surfLowest,
      surfaceContainerLow:    surfLow,
      surfaceContainer:       isDark ? surfaceContainerDark : surfaceContainer,
      surfaceContainerHigh:   isDark ? surfaceContainerHighDark : surfaceContainerHigh,
      surfaceContainerHighest:isDark ? surfaceContainerHighestDark : surfaceContainerHighest,
      onSurfaceVariant:  onSurfVar,
      outline:           outlineVar,
      outlineVariant:    outlineVar.withOpacity(0.2),
      shadow:            Colors.transparent,  // Guardian shadow is ambient, not black
      scrim:             onSurface.withOpacity(0.32),
      inverseSurface:    isDark ? const Color(0xFFE8EFF6) : const Color(0xFF1A2E42),
      onInverseSurface:  isDark ? onSurface : const Color(0xFFE8EFF6),
      inversePrimary:    isDark ? const Color(0xFF90CAF9) : const Color(0xFF003D72),
    );

    return ThemeData(
      useMaterial3:            true,
      colorScheme:             colorScheme,
      brightness:              brightness,
      scaffoldBackgroundColor: surf,
      textTheme:               textTheme,
      primaryTextTheme:        textTheme,

      // ── AppBar: transparent + status-bar integration ──────────────────────
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: isDark ? const Color(0xFFE8EFF6) : onSurface,
        elevation:       0,
        scrolledUnderElevation: 0,
        centerTitle:     false,
        titleTextStyle:  GoogleFonts.manrope(
          fontSize: 18, fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
          color: isDark ? const Color(0xFFE8EFF6) : onSurface,
        ),
        iconTheme:       IconThemeData(color: isDark ? const Color(0xFFE8EFF6) : onSurface),
        systemOverlayStyle: isDark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark.copyWith(
                statusBarColor: Colors.transparent,
              ),
      ),

      // ── Cards: tonal elevation, NO border, Guardian shadow ──────────────
      cardTheme: CardThemeData(
        color:       surfLowest,
        elevation:   0,
        shadowColor: Colors.transparent,
        shape:       RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(r + 2),
        ),
        margin:      const EdgeInsets.symmetric(horizontal: 24, vertical: 6),
      ),

      // ── Elevated button: gradient, xl radius ─────────────────────────────
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return outlineVar.withOpacity(0.5);
            }
            return null; // handled by decoration in wrapper
          }),
          foregroundColor: WidgetStateProperty.all(Colors.white),
          minimumSize:     WidgetStateProperty.all(const Size.fromHeight(52)),
          elevation:       WidgetStateProperty.all(0),
          padding:         WidgetStateProperty.all(
              const EdgeInsets.symmetric(horizontal: 24, vertical: 14)),
          shape:           WidgetStateProperty.all(
            RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(r + 12)),
          ),
          textStyle: WidgetStateProperty.all(GoogleFonts.inter(
            fontSize: 15, fontWeight: FontWeight.w600, letterSpacing: 0.1)),
          overlayColor: WidgetStateProperty.all(Colors.white.withOpacity(0.15)),
        ),
      ),

      // ── Outlined button: ghost border, no fill ────────────────────────────
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: p,
          minimumSize:     const Size.fromHeight(52),
          shape:           RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(r + 12)),
          side: BorderSide(color: p.withOpacity(0.45), width: 1.5),
          textStyle: GoogleFonts.inter(
              fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: p,
          textStyle: GoogleFonts.inter(
              fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),

      // ── Input fields: surface_container_low fill, ghost border ────────────
      inputDecorationTheme: InputDecorationTheme(
        filled:      true,
        fillColor:   isDark ? surfaceContainerLowDark : surfaceContainerLow,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        // No border at rest — surface fill is the definition
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(r),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(r),
          borderSide: BorderSide(
            color: outlineVar.withOpacity(0.2),  // ghost border — accessibility
            width: 1,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(r),
          borderSide: BorderSide(color: p, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(r),
          borderSide: BorderSide(color: danger.withOpacity(0.5)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(r),
          borderSide: BorderSide(color: danger, width: 2),
        ),
        labelStyle:  GoogleFonts.inter(
          fontSize: 14, color: onSurfVar),
        hintStyle:   GoogleFonts.inter(
          fontSize: 14, color: onSurfVar.withOpacity(0.6)),
        prefixIconColor: onSurfVar,
        suffixIconColor: onSurfVar,
      ),

      // ── Navigation bar: glass effect via backgroundColor + low elevation ──
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor:  isDark
            ? surfaceContainerLowDark.withOpacity(0.9)
            : surfaceContainerLowest.withOpacity(0.92),
        indicatorColor:   p.withOpacity(0.10),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return IconThemeData(color: p, size: 24);
          }
          return IconThemeData(color: onSurfVar, size: 22);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return GoogleFonts.inter(
                color: p, fontSize: 11, fontWeight: FontWeight.w600);
          }
          return GoogleFonts.inter(
              color: onSurfVar, fontSize: 11, fontWeight: FontWeight.w500);
        }),
        elevation:     0,
        shadowColor:   Colors.transparent,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      ),

      // ── List tiles: no background, Inter body ────────────────────────────
      listTileTheme: ListTileThemeData(
        tileColor:      Colors.transparent,
        iconColor:      onSurfVar,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 14, fontWeight: FontWeight.w500,
          color: onSurf),
        subtitleTextStyle: GoogleFonts.inter(
          fontSize: 12, color: onSurfVar),
        contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(r)),
      ),

      // ── Divider: replaced by spacing — only visible in edge cases ─────────
      dividerTheme: DividerThemeData(
        color:     outlineVar.withOpacity(0.15),
        space:     0,
        indent:    24,
        endIndent: 24,
        thickness: 0.5,
      ),

      // ── Chips: pill shape, tonal background ──────────────────────────────
      chipTheme: ChipThemeData(
        backgroundColor: isDark ? p.withOpacity(0.18) : surfaceContainerLow,
        labelStyle:      GoogleFonts.inter(
          fontSize: 12, fontWeight: FontWeight.w600,
          color: isDark ? const Color(0xFF90CAF9) : p),
        side:    BorderSide.none,
        shape:   RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(99)),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      ),

      // ── FAB: gradient + Guardian shadow ───────────────────────────────────
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: p,
        foregroundColor: Colors.white,
        elevation:       0,
        shape:           RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(r + 4))),
      ),

      // ── Switch ───────────────────────────────────────────────────────────
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected) ? Colors.white : outlineVar),
        trackColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected)
                ? p : outlineVar.withOpacity(0.4)),
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
      ),

      // ── Bottom sheet ─────────────────────────────────────────────────────
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: isDark ? surfaceContainerLowDark : surfaceContainerLowest,
        shape:           const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
        elevation:       0,
        shadowColor:     Colors.transparent,
        dragHandleColor: outlineVar,
        showDragHandle:  true,
      ),

      // ── Dialog ───────────────────────────────────────────────────────────
      dialogTheme: DialogThemeData(
        backgroundColor: isDark ? surfaceContainerLowDark : surfaceContainerLowest,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        elevation:   0,
        shadowColor: onSurface.withOpacity(0.12),
        titleTextStyle:   GoogleFonts.manrope(
          fontSize: 18, fontWeight: FontWeight.w700,
          color: isDark ? const Color(0xFFE8EFF6) : onSurface),
        contentTextStyle: GoogleFonts.inter(
          fontSize: 14, color: onSurfVar),
      ),

      // ── Snack bar ─────────────────────────────────────────────────────────
      snackBarTheme: SnackBarThemeData(
        behavior:         SnackBarBehavior.floating,
        shape:            RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12)),
        backgroundColor:  isDark ? surfaceContainerHighestDark : const Color(0xFF1A2E42),
        contentTextStyle: GoogleFonts.inter(
          color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
        elevation:  0,
      ),

      // ── Progress indicator ────────────────────────────────────────────────
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: p,
        circularTrackColor: surfaceContainerLow,
        linearTrackColor: surfaceContainerLow,
      ),
    );
  }
}

// ── Convenience alias ─────────────────────────────────────────────────────────
// Keep ShieldTheme as an alias for existing code that imports it
typedef ShieldTheme = Ds;
