import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Guardian's Lens — component library
//
// Rules implemented here:
//  · No 1px solid borders for structure (ghost border @ 20% outlineVariant only)
//  · Tonal layering: surfaceContainerLowest card on surfaceContainerLow bg
//  · Guardian Shadow: blur 32, spread -4, on_surface @ 6% — never black
//  · Manrope for display/headline text, Inter for body/label
//  · 24px safe-zone padding around screen edges
// ─────────────────────────────────────────────────────────────────────────────

// ── Shield logo ──────────────────────────────────────────────────────────────

class ShieldLogo extends StatelessWidget {
  const ShieldLogo({super.key, this.size = 48, this.color = Colors.white});
  final double size;
  final Color  color;

  @override
  Widget build(BuildContext context) => Icon(Icons.shield_rounded, size: size, color: color);
}

// ── GuardianCard — tonal lift card, no border, ambient shadow ────────────────
//
// The "furniture" equivalent of a card: sits on the canvas through tonal
// contrast alone. Use for all primary content containers.

class GuardianCard extends StatelessWidget {
  const GuardianCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.onTap,
    this.color,
    this.borderRadius,
    this.margin,
  });
  final Widget       child;
  final EdgeInsets   padding;
  final VoidCallback? onTap;
  final Color?       color;
  final BorderRadius? borderRadius;
  final EdgeInsets?  margin;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cs     = Theme.of(context).colorScheme;
    final bg     = color ?? cs.surfaceContainerLowest;
    final radius = borderRadius ?? BorderRadius.circular(14);

    return Padding(
      padding: margin ?? const EdgeInsets.symmetric(horizontal: 24, vertical: 6),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color:        bg,
          borderRadius: radius,
          boxShadow:    isDark ? null : Ds.guardianShadow(),
        ),
        child: Material(
          color:        Colors.transparent,
          borderRadius: radius,
          child: InkWell(
            onTap:        onTap,
            borderRadius: radius,
            splashColor:  cs.primary.withOpacity(0.06),
            child: Padding(padding: padding, child: child),
          ),
        ),
      ),
    );
  }
}

// ── GuardianHero — gradient container with "polished sapphire" overlay ────────
//
// Used for page heroes. Applies a 15% surfaceTint over the primary gradient
// to create the signature "sapphire" depth effect.

class GuardianHero extends StatelessWidget {
  const GuardianHero({
    super.key,
    required this.child,
    this.height,
    this.bottomRadius = 0,
  });
  final Widget  child;
  final double? height;
  final double  bottomRadius;

  @override
  Widget build(BuildContext context) => Container(
    height: height,
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFF003D72), Ds.primary],
        begin: Alignment.topLeft,
        end:   Alignment.bottomRight,
        stops: [0.0, 1.0],
      ),
      borderRadius: BorderRadius.vertical(
          bottom: Radius.circular(bottomRadius)),
    ),
    child: Stack(children: [
      // Polished sapphire texture: 15% surfaceTint radial overlay
      Positioned.fill(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(0.7, -0.6),
              radius: 1.2,
              colors: [
                Ds.surfaceTint.withOpacity(0.15),
                Colors.transparent,
              ],
            ),
            borderRadius: BorderRadius.vertical(
                bottom: Radius.circular(bottomRadius)),
          ),
        ),
      ),
      child,
    ]),
  );
}

// ── GlassPanel — glassmorphism container ──────────────────────────────────────
//
// For nav bars, app bars, and floating surfaces. Surface at 85% opacity
// + 20px backdrop blur. Creates the "content bleeding through" editorial feel.

class GlassPanel extends StatelessWidget {
  const GlassPanel({
    super.key,
    required this.child,
    this.opacity = 0.85,
    this.blurSigma = 20,
    this.color,
    this.borderRadius,
    this.padding,
  });
  final Widget   child;
  final double   opacity;
  final double   blurSigma;
  final Color?   color;
  final BorderRadius? borderRadius;
  final EdgeInsets?   padding;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = color ?? (isDark
        ? Ds.surfaceContainerLowDark.withOpacity(opacity)
        : Colors.white.withOpacity(opacity));

    Widget inner = Container(
      color:   bg,
      padding: padding,
      child:   child,
    );

    if (borderRadius != null) {
      inner = ClipRRect(
        borderRadius: borderRadius!,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
          child:  inner,
        ),
      );
    } else {
      inner = BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
        child:  inner,
      );
    }

    return inner;
  }
}

// ── SectionHeader — asymmetric, editorial left-aligned ───────────────────────
//
// Large label on the left, optional action chip far right.
// Uses label-sm uppercase Inter for "data-driven aesthetic."

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.trailing});
  final String  title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(
            title.toUpperCase(),
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.9,
              color: cs.onSurfaceVariant,
            ),
          ),
          if (trailing != null) ...[
            const Spacer(),
            trailing!,
          ],
        ],
      ),
    );
  }
}

// ── StatDisplay — editorial KPI: large Manrope number + Inter label ───────────
//
// The "98%" + "BLOCKED" pattern from the spec — pairs display-md number with
// label-md uppercase text for a sophisticated data-driven look.

class StatDisplay extends StatelessWidget {
  const StatDisplay({
    super.key,
    required this.value,
    required this.label,
    this.color,
    this.valueStyle,
    this.icon,
    this.trend,
  });
  final String   value;
  final String   label;
  final Color?   color;
  final TextStyle? valueStyle;
  final IconData?  icon;
  final String?    trend;  // e.g. "+12%" shown in tertiary color

  @override
  Widget build(BuildContext context) {
    final cs  = Theme.of(context).colorScheme;
    final col = color ?? cs.primary;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (icon != null) ...[
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color:        col.withOpacity(0.10),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: col, size: 18),
        ),
        const SizedBox(height: 12),
      ],
      Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            value,
            style: valueStyle ?? GoogleFonts.manrope(
              fontSize: 32,
              fontWeight: FontWeight.w800,
              letterSpacing: -1.0,
              color: col,
            ),
          ),
          if (trend != null) ...[
            const SizedBox(width: 6),
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                trend!,
                style: GoogleFonts.inter(
                  fontSize: 11, fontWeight: FontWeight.w700,
                  color: trend!.startsWith('+') ? Ds.success : Ds.danger),
              ),
            ),
          ],
        ],
      ),
      const SizedBox(height: 2),
      Text(
        label.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: 10, fontWeight: FontWeight.w700,
          letterSpacing: 0.8, color: cs.onSurfaceVariant),
      ),
    ]);
  }
}

// ── StatCard — KPI card: tonal, no border ────────────────────────────────────

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.color,
    this.onTap,
    this.trend,
  });
  final String    label;
  final String    value;
  final IconData? icon;
  final Color?    color;
  final VoidCallback? onTap;
  final String?   trend;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GuardianCard(
      padding: const EdgeInsets.all(16),
      margin:  EdgeInsets.zero,
      onTap:   onTap,
      child: StatDisplay(
        value: value,
        label: label,
        color: color,
        icon:  icon,
        trend: trend,
        valueStyle: GoogleFonts.manrope(
          fontSize: 28, fontWeight: FontWeight.w800,
          letterSpacing: -0.8,
          color: color ?? cs.primary,
        ),
      ),
    );
  }
}

// ── FeatureTile — bespoke feature grid item ───────────────────────────────────

class FeatureTile extends StatelessWidget {
  const FeatureTile({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
    this.badge,
  });
  final IconData     icon;
  final String       label;
  final VoidCallback onTap;
  final Color?       color;
  final String?      badge;

  @override
  Widget build(BuildContext context) {
    final cs  = Theme.of(context).colorScheme;
    final col = color ?? cs.primary;
    return GuardianCard(
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
      margin:  EdgeInsets.zero,
      onTap:   onTap,
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Stack(alignment: Alignment.topRight, children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color:        col.withOpacity(0.10),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: col, size: 26),
          ),
          if (badge != null)
            Transform.translate(
              offset: const Offset(6, -6),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(
                  color:        Ds.danger,
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(badge!,
                    style: const TextStyle(
                        color: Colors.white, fontSize: 9,
                        fontWeight: FontWeight.w700)),
              ),
            ),
        ]),
        const SizedBox(height: 10),
        Text(label, textAlign: TextAlign.center,
            maxLines: 2, overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(
                fontSize: 11, fontWeight: FontWeight.w600,
                color: Theme.of(context).colorScheme.onSurface)),
      ]),
    );
  }
}

// ── LoadingOverlay ────────────────────────────────────────────────────────────

class LoadingOverlay extends StatelessWidget {
  const LoadingOverlay({super.key, this.message});
  final String? message;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      color: cs.scrim,
      child: Center(
        child: GuardianCard(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            CircularProgressIndicator(color: cs.primary),
            if (message != null) ...[
              const SizedBox(height: 16),
              Text(message!,
                  style: GoogleFonts.inter(fontSize: 14,
                      color: cs.onSurface)),
            ],
          ]),
        ),
      ),
    );
  }
}

// ── ErrorView ─────────────────────────────────────────────────────────────────

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color:        Ds.dangerContainer,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(Icons.error_outline_rounded,
                size: 40, color: Ds.danger),
          ),
          const SizedBox(height: 16),
          Text(message, textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                  fontSize: 14,
                  color: cs.onSurfaceVariant)),
          if (onRetry != null) ...[
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon:  const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Try again'),
            ),
          ],
        ]),
      ),
    );
  }
}

// ── EmptyView ─────────────────────────────────────────────────────────────────

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.message, this.icon, this.action});
  final String    message;
  final IconData? icon;
  final Widget?   action;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color:        cs.surfaceContainerLow,
              shape:        BoxShape.circle,
            ),
            child: Icon(icon ?? Icons.inbox_rounded,
                size: 40, color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          Text(message, textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                  fontSize: 14, color: cs.onSurfaceVariant)),
          if (action != null) ...[const SizedBox(height: 20), action!],
        ]),
      ),
    );
  }
}

// ── GuardianButton — primary gradient button ──────────────────────────────────
//
// The spec's "Primary: Rounded xl (1.5rem), primary → primary_container gradient"

class GuardianButton extends StatelessWidget {
  const GuardianButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.expand  = true,
  });
  final String       label;
  final VoidCallback? onPressed;
  final IconData?    icon;
  final bool         loading;
  final bool         expand;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    return SizedBox(
      width: expand ? double.infinity : null,
      height: 52,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: enabled
              ? const LinearGradient(
                  colors: [Color(0xFF004A8F), Ds.primary],
                  begin: Alignment.topLeft,
                  end:   Alignment.bottomRight,
                )
              : null,
          color: enabled ? null : Ds.outlineVariant.withOpacity(0.5),
          borderRadius: BorderRadius.circular(Ds.radiusDefault + 12),
          boxShadow: enabled
              ? [BoxShadow(
                  color:       Ds.primary.withOpacity(0.30),
                  blurRadius:  16,
                  offset:      const Offset(0, 4),
                )]
              : null,
        ),
        child: ElevatedButton(
          onPressed: enabled ? onPressed : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.transparent,
            shadowColor:     Colors.transparent,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(Ds.radiusDefault + 12)),
          ),
          child: loading
              ? const SizedBox(
                  width: 20, height: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : Row(mainAxisSize: MainAxisSize.min, children: [
                  if (icon != null) ...[
                    Icon(icon, size: 18),
                    const SizedBox(width: 8),
                  ],
                  Text(label),
                ]),
        ),
      ),
    );
  }
}

// ── PinField ─────────────────────────────────────────────────────────────────

class PinField extends StatelessWidget {
  const PinField({
    super.key,
    required this.controller,
    required this.label,
    this.onChanged,
  });
  final TextEditingController controller;
  final String label;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) => TextFormField(
    controller:     controller,
    keyboardType:   TextInputType.number,
    obscureText:    true,
    maxLength:      6,
    onChanged:      onChanged,
    decoration:     InputDecoration(labelText: label, counterText: ''),
    validator: (v) => (v == null || v.length < 4) ? 'Enter 4–6 digits' : null,
  );
}

// ── AsyncWidget ───────────────────────────────────────────────────────────────

class AsyncWidget<T> extends StatelessWidget {
  const AsyncWidget({
    super.key,
    required this.value,
    required this.data,
    this.loading,
    this.error,
  });
  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final Widget? loading;
  final Widget Function(Object err, StackTrace? st)? error;

  @override
  Widget build(BuildContext context) => value.when(
    loading: () => loading ?? const Center(child: CircularProgressIndicator()),
    error:   (e, st) => error != null
        ? error!(e, st)
        : ErrorView(message: e.toString()),
    data: data,
  );
}

// ── GuardianProgressBar ───────────────────────────────────────────────────────
//
// Gradient progress indicator — no border, pill-shaped

class GuardianProgressBar extends StatelessWidget {
  const GuardianProgressBar({
    super.key,
    required this.value,  // 0.0 – 1.0
    this.height = 6,
    this.color,
    this.label,
  });
  final double  value;
  final double  height;
  final Color?  color;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final cs  = Theme.of(context).colorScheme;
    final col = color ?? cs.primary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null) ...[
          Text(label!, style: GoogleFonts.inter(
              fontSize: 11, color: cs.onSurfaceVariant)),
          const SizedBox(height: 4),
        ],
        LayoutBuilder(builder: (ctx, constraints) {
          final w = constraints.maxWidth;
          return Stack(children: [
            Container(
              height: height,
              width:  w,
              decoration: BoxDecoration(
                color: col.withOpacity(0.12),
                borderRadius: BorderRadius.circular(99),
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 600),
              curve:    Curves.easeOutCubic,
              height:   height,
              width:    (w * value.clamp(0.0, 1.0)),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [col, Color.lerp(col, cs.primaryContainer, 0.4)!],
                ),
                borderRadius: BorderRadius.circular(99),
              ),
            ),
          ]);
        }),
      ],
    );
  }
}

// ── StatusChip — tonal pill badge ────────────────────────────────────────────

class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key, this.color});
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final cs  = Theme.of(context).colorScheme;
    final col = color ?? cs.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color:        col.withOpacity(0.12),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: 11, fontWeight: FontWeight.w700,
          color: col, letterSpacing: 0.2),
      ),
    );
  }
}
