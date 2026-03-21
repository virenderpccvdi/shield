import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Branded Shield logo widget — drawn entirely with Canvas (no asset required).
class ShieldLogo extends StatelessWidget {
  const ShieldLogo({super.key, this.size = 72});
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(width: size, height: size,
        child: CustomPaint(painter: _ShieldPainter()));
  }
}

class _ShieldPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // ── Gradient fill ──────────────────────────────────────────────────────
    final gradientPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF9C27B0), Color(0xFF3F51B5), Color(0xFF1565C0)],
        stops: [0.0, 0.5, 1.0],
      ).createShader(Rect.fromLTWH(0, 0, w, h))
      ..style = PaintingStyle.fill;

    // ── Shield path ────────────────────────────────────────────────────────
    // Classic shield: flat top with a pointed bottom.
    final path = Path();
    final rx = w * 0.12; // corner radius
    // Top-left corner
    path.moveTo(0, h * 0.10);
    path.quadraticBezierTo(0, 0, rx, 0);
    // Top edge
    path.lineTo(w - rx, 0);
    // Top-right corner
    path.quadraticBezierTo(w, 0, w, h * 0.10);
    // Right side
    path.lineTo(w, h * 0.55);
    // Curve down to the point
    path.cubicTo(w, h * 0.80, w * 0.65, h * 0.92, w * 0.50, h);
    path.cubicTo(w * 0.35, h * 0.92, 0, h * 0.80, 0, h * 0.55);
    path.close();

    canvas.drawPath(path, gradientPaint);

    // ── Inner highlight (glossy top sheen) ────────────────────────────────
    final sheenPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Colors.white.withOpacity(0.25), Colors.white.withOpacity(0.0)],
      ).createShader(Rect.fromLTWH(w * 0.1, 0, w * 0.8, h * 0.45))
      ..style = PaintingStyle.fill;

    final sheenPath = Path();
    sheenPath.moveTo(rx, 0);
    sheenPath.lineTo(w - rx, 0);
    sheenPath.quadraticBezierTo(w, 0, w, h * 0.10);
    sheenPath.lineTo(w * 0.85, h * 0.42);
    sheenPath.quadraticBezierTo(w * 0.5, h * 0.50, w * 0.15, h * 0.42);
    sheenPath.lineTo(0, h * 0.10);
    sheenPath.quadraticBezierTo(0, 0, rx, 0);
    canvas.drawPath(sheenPath, sheenPaint);

    // ── "S" letter ────────────────────────────────────────────────────────
    final textPainter = TextPainter(
      text: TextSpan(
        text: 'S',
        style: TextStyle(
          color: Colors.white,
          fontSize: w * 0.46,
          fontWeight: FontWeight.w900,
          letterSpacing: -1,
          shadows: [
            Shadow(color: Colors.black.withOpacity(0.20), blurRadius: 4,
                offset: const Offset(0, 2)),
          ],
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    textPainter.paint(
      canvas,
      Offset((w - textPainter.width) / 2, h * 0.22),
    );

    // ── Check-mark tick at the bottom ─────────────────────────────────────
    final tickPaint = Paint()
      ..color = Colors.white.withOpacity(0.55)
      ..strokeWidth = w * 0.045
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final cx = w * 0.50;
    final ty = h * 0.74;
    final tickPath = Path()
      ..moveTo(cx - w * 0.15, ty)
      ..lineTo(cx - w * 0.04, ty + h * 0.07)
      ..lineTo(cx + w * 0.15, ty - h * 0.07);
    canvas.drawPath(tickPath, tickPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Larger version with shadow card, used on login/splash screens.
class ShieldLogoHero extends StatelessWidget {
  const ShieldLogoHero({super.key, this.size = 80});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size * 1.35,
      height: size * 1.35,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const RadialGradient(
          colors: [Color(0x33FFFFFF), Color(0x00FFFFFF)],
        ),
        boxShadow: [
          BoxShadow(color: const Color(0xFF9C27B0).withOpacity(0.45),
              blurRadius: 28, spreadRadius: 4),
        ],
      ),
      child: Center(child: ShieldLogo(size: size)),
    );
  }
}
