/// Shared UI components used across Shield screens.
library;

import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:shimmer/shimmer.dart';
import '../app/theme.dart';

// ── Shimmer skeleton ──────────────────────────────────────────────────────

/// Animated shimmer placeholder for loading states.
class ShieldSkeleton extends StatelessWidget {
  final double width;
  final double height;
  final double radius;
  const ShieldSkeleton({
    super.key,
    this.width = double.infinity,
    this.height = 16,
    this.radius = 8,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? const Color(0xFF2A2A3E) : const Color(0xFFE8EEF4),
      highlightColor: isDark ? const Color(0xFF3A3A5E) : const Color(0xFFF5F8FC),
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF2A2A3E) : const Color(0xFFE8EEF4),
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }
}

/// Column of shimmer skeletons simulating a card.
class ShieldCardSkeleton extends StatelessWidget {
  final int lines;
  const ShieldCardSkeleton({super.key, this.lines = 3});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const ShieldSkeleton(width: 120, height: 14),
            const SizedBox(height: 12),
            for (int i = 0; i < lines; i++) ...[
              ShieldSkeleton(height: 14, width: i == lines - 1 ? 180 : double.infinity),
              if (i < lines - 1) const SizedBox(height: 8),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Stat card ─────────────────────────────────────────────────────────────

/// Compact metric card with icon, value, label, and optional colour.
class ShieldStatCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color? color;
  final VoidCallback? onTap;

  const ShieldStatCard({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
    this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = color ?? ShieldTheme.primary;
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: c.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 20, color: c),
              ),
              const SizedBox(height: 10),
              Text(value,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800, color: c, height: 1)),
              const SizedBox(height: 2),
              Text(label,
                style: theme.textTheme.bodySmall?.copyWith(fontSize: 11)),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Status badge ──────────────────────────────────────────────────────────

/// Small coloured pill badge — online/offline/blocked/safe etc.
class ShieldBadge extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;

  const ShieldBadge({
    super.key,
    required this.label,
    required this.color,
    this.icon,
  });

  factory ShieldBadge.online() => const ShieldBadge(
    label: 'Online', color: ShieldTheme.success);
  factory ShieldBadge.offline() => const ShieldBadge(
    label: 'Offline', color: ShieldTheme.textSecondary);
  factory ShieldBadge.blocked() => const ShieldBadge(
    label: 'Blocked', color: ShieldTheme.danger, icon: Icons.block);
  factory ShieldBadge.safe() => const ShieldBadge(
    label: 'Safe', color: ShieldTheme.success, icon: Icons.verified_user);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: color),
            const SizedBox(width: 3),
          ] else ...[
            Container(
              width: 6, height: 6,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 5),
          ],
          Text(label,
            style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }
}

// ── Section header ────────────────────────────────────────────────────────

class ShieldSectionHeader extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onAction;

  const ShieldSectionHeader({
    super.key,
    required this.title,
    this.action,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 12, 8),
      child: Row(
        children: [
          Text(title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700)),
          const Spacer(),
          if (action != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: const Size(0, 32),
              ),
              child: Text(action!,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────

class ShieldEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  const ShieldEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: ShieldTheme.primary.withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 48, color: ShieldTheme.primary.withOpacity(0.5)),
            ),
            const SizedBox(height: 20),
            Text(title,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(subtitle!,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 20),
              FilledButton(
                onPressed: onAction,
                style: FilledButton.styleFrom(minimumSize: const Size(160, 44)),
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Gradient app bar ──────────────────────────────────────────────────────

/// A SliverAppBar with the brand gradient, used on hero screens.
class ShieldGradientHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final Widget? leading;

  const ShieldGradientHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actions,
    this.leading,
  });

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      pinned: true,
      expandedHeight: subtitle != null ? 120 : 88,
      backgroundColor: ShieldTheme.primary,
      foregroundColor: Colors.white,
      leading: leading,
      actions: actions,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(gradient: ShieldTheme.heroGradient),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 56, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(title,
                    style: const TextStyle(
                      color: Colors.white, fontSize: 22,
                      fontWeight: FontWeight.w800)),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(subtitle!,
                      style: const TextStyle(color: Colors.white70, fontSize: 13)),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Quick action button ───────────────────────────────────────────────────

class ShieldQuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;
  final bool active;

  const ShieldQuickAction({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
    this.active = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? ShieldTheme.primary;
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: active ? c.withOpacity(0.12) : theme.cardTheme.color,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: active ? c.withOpacity(0.3) : ShieldTheme.divider,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 24, color: active ? c : ShieldTheme.textSecondary),
            const SizedBox(height: 6),
            Text(label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                color: active ? c : ShieldTheme.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Error helper ──────────────────────────────────────────────────────────

/// Shows a user-friendly error SnackBar. Extracts message from DioException if available.
void showShieldError(BuildContext context, dynamic error, {String fallback = 'Something went wrong'}) {
  String message = fallback;
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map) {
      message = data['message']?.toString() ?? data['error']?.toString() ?? fallback;
    } else if (error.type == DioExceptionType.connectionTimeout ||
               error.type == DioExceptionType.receiveTimeout) {
      message = 'Connection timed out. Check your internet.';
    } else if (error.type == DioExceptionType.connectionError) {
      message = 'No internet connection.';
    }
  }
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: const Color(0xFFE53935),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      duration: const Duration(seconds: 3),
    ));
  }
}
