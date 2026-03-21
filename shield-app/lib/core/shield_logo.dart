import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Branded Shield logo — Canvas-drawn. Deep-blue shield with location pin
/// and a family (parent + child) silhouette inside.
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

    // ── Outer shadow ───────────────────────────────────────────────────────
    final shadowPaint = Paint()
      ..color = const Color(0x401565C0)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
    _drawShield(canvas, w, h, shadowPaint, offset: const Offset(0, 3));

    // ── Gradient fill ──────────────────────────────────────────────────────
    final gradPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF1976D2), Color(0xFF0D47A1), Color(0xFF01579B)],
        stops: [0.0, 0.55, 1.0],
      ).createShader(Rect.fromLTWH(0, 0, w, h))
      ..style = PaintingStyle.fill;
    _drawShield(canvas, w, h, gradPaint);

    // ── Subtle inner border ────────────────────────────────────────────────
    final borderPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Colors.white.withOpacity(0.4), Colors.white.withOpacity(0.05)],
      ).createShader(Rect.fromLTWH(0, 0, w, h))
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.025;
    _drawShield(canvas, w, h, borderPaint);

    // ── Glossy top sheen ──────────────────────────────────────────────────
    final sheenPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Colors.white.withOpacity(0.22), Colors.white.withOpacity(0.0)],
      ).createShader(Rect.fromLTWH(w * 0.1, 0, w * 0.8, h * 0.45))
      ..style = PaintingStyle.fill;
    final sheenPath = Path()
      ..moveTo(w * 0.12, 0)
      ..lineTo(w - w * 0.12, 0)
      ..quadraticBezierTo(w, 0, w, h * 0.10)
      ..lineTo(w * 0.82, h * 0.40)
      ..quadraticBezierTo(w * 0.5, h * 0.48, w * 0.18, h * 0.40)
      ..lineTo(0, h * 0.10)
      ..quadraticBezierTo(0, 0, w * 0.12, 0)
      ..close();
    canvas.drawPath(sheenPath, sheenPaint);

    // ── Location pin (centered, upper half) ───────────────────────────────
    _drawLocationPin(canvas, w, h);

    // ── Parent + child silhouette (lower, below pin) ───────────────────────
    _drawFamily(canvas, w, h);
  }

  void _drawShield(Canvas canvas, double w, double h, Paint paint,
      {Offset offset = Offset.zero}) {
    final path = Path();
    final rx = w * 0.12;
    path.moveTo(offset.dx, offset.dy + h * 0.10);
    path.quadraticBezierTo(offset.dx, offset.dy, offset.dx + rx, offset.dy);
    path.lineTo(offset.dx + w - rx, offset.dy);
    path.quadraticBezierTo(offset.dx + w, offset.dy, offset.dx + w, offset.dy + h * 0.10);
    path.lineTo(offset.dx + w, offset.dy + h * 0.56);
    path.cubicTo(
      offset.dx + w, offset.dy + h * 0.80,
      offset.dx + w * 0.65, offset.dy + h * 0.93,
      offset.dx + w * 0.50, offset.dy + h,
    );
    path.cubicTo(
      offset.dx + w * 0.35, offset.dy + h * 0.93,
      offset.dx, offset.dy + h * 0.80,
      offset.dx, offset.dy + h * 0.56,
    );
    path.close();
    canvas.drawPath(path, paint);
  }

  void _drawLocationPin(Canvas canvas, double w, double h) {
    final cx = w * 0.50;
    final cy = h * 0.33;
    final pr = w * 0.115; // pin head radius

    // Pin head
    final pinPaint = Paint()
      ..color = Colors.white.withOpacity(0.92)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(cx, cy), pr, pinPaint);

    // Pin tip (teardrop) - pointing down
    final tipPaint = Paint()
      ..color = Colors.white.withOpacity(0.92)
      ..style = PaintingStyle.fill;
    final tipPath = Path()
      ..moveTo(cx - pr * 0.55, cy + pr * 0.7)
      ..quadraticBezierTo(cx, cy + pr * 2.2, cx, cy + pr * 2.2)
      ..quadraticBezierTo(cx + pr * 0.55, cy + pr * 0.7, cx + pr * 0.55, cy + pr * 0.7)
      ..close();
    canvas.drawPath(tipPath, tipPaint);

    // Inner dot
    final dotPaint = Paint()
      ..color = const Color(0xFF1565C0)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(cx, cy), pr * 0.38, dotPaint);
  }

  void _drawFamily(Canvas canvas, double w, double h) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.82)
      ..style = PaintingStyle.fill;

    // Parent figure (left-center)
    final px = w * 0.395;
    final py = h * 0.645;
    // Parent head
    canvas.drawCircle(Offset(px, py), w * 0.062, paint);
    // Parent body (rounded rect)
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(px, py + w * 0.11), width: w * 0.11, height: w * 0.14),
        Radius.circular(w * 0.03),
      ),
      paint,
    );

    // Child figure (right-center, slightly smaller)
    final chx = w * 0.605;
    final chy = h * 0.660;
    // Child head
    canvas.drawCircle(Offset(chx, chy), w * 0.048, paint);
    // Child body
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(chx, chy + w * 0.088), width: w * 0.088, height: w * 0.11),
        Radius.circular(w * 0.025),
      ),
      paint,
    );

    // Connecting line (holding hands)
    final linePaint = Paint()
      ..color = Colors.white.withOpacity(0.55)
      ..strokeWidth = w * 0.025
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    canvas.drawLine(
      Offset(px + w * 0.055, py + w * 0.095),
      Offset(chx - w * 0.044, chy + w * 0.075),
      linePaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Hero version with glow ring — for login/splash screens.
class ShieldLogoHero extends StatelessWidget {
  const ShieldLogoHero({super.key, this.size = 80});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size * 1.4,
      height: size * 1.4,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [
            const Color(0xFF1976D2).withOpacity(0.18),
            Colors.transparent,
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1565C0).withOpacity(0.35),
            blurRadius: 32,
            spreadRadius: 6,
          ),
        ],
      ),
      child: Center(child: ShieldLogo(size: size)),
    );
  }
}

/// Animated pulsing version — for splash/loading.
class ShieldLogoPulse extends StatefulWidget {
  const ShieldLogoPulse({super.key, this.size = 80});
  final double size;

  @override
  State<ShieldLogoPulse> createState() => _ShieldLogoPulseState();
}

class _ShieldLogoPulseState extends State<ShieldLogoPulse>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(seconds: 2))
      ..repeat(reverse: true);
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, child) => Container(
        width: widget.size * (1.3 + _anim.value * 0.15),
        height: widget.size * (1.3 + _anim.value * 0.15),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1565C0).withOpacity(0.25 + _anim.value * 0.2),
              blurRadius: 24 + _anim.value * 16,
              spreadRadius: 4 + _anim.value * 4,
            ),
          ],
        ),
        child: Center(child: ShieldLogo(size: widget.size)),
      ),
    );
  }
}
