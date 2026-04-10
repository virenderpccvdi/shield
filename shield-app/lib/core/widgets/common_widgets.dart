import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../constants.dart';

// ── Shield logo ──────────────────────────────────────────────────────────────

class ShieldLogo extends StatelessWidget {
  const ShieldLogo({super.key, this.size = 48, this.color = Colors.white});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => Icon(Icons.shield, size: size, color: color);
}

// ── Loading overlay ───────────────────────────────────────────────────────────

class LoadingOverlay extends StatelessWidget {
  const LoadingOverlay({super.key, this.message});
  final String? message;

  @override
  Widget build(BuildContext context) => Container(
    color: Colors.black45,
    child: Center(
      child: Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const CircularProgressIndicator(),
            if (message != null) ...[
              const SizedBox(height: 16),
              Text(message!, style: const TextStyle(fontSize: 14)),
            ],
          ]),
        ),
      ),
    ),
  );
}

// ── Error state with retry ────────────────────────────────────────────────────

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.error_outline, size: 64, color: Colors.redAccent),
        const SizedBox(height: 16),
        Text(message, textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 15, color: Colors.black54)),
        if (onRetry != null) ...[
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ]),
    ),
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.message, this.icon, this.action});
  final String message;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon ?? Icons.inbox_outlined, size: 64, color: Colors.black45),
        const SizedBox(height: 16),
        Text(message, textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 15, color: Colors.black45)),
        if (action != null) ...[const SizedBox(height: 20), action!],
      ]),
    ),
  );
}

// ── Section header ────────────────────────────────────────────────────────────

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.trailing});
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
    child: Row(children: [
      Expanded(child: Text(title,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
              color: Colors.black54, letterSpacing: 0.5))),
      if (trailing != null) trailing!,
    ]),
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.color,
    this.onTap,
  });
  final String label;
  final String value;
  final IconData? icon;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (icon != null) Icon(icon, size: 28, color: c),
            if (icon != null) const SizedBox(height: 8),
            Text(value,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: c)),
            const SizedBox(height: 2),
            Text(label,
                style: const TextStyle(fontSize: 12, color: Colors.black54)),
          ]),
        ),
      ),
    );
  }
}

// ── Feature tile (used on child detail screen) ────────────────────────────────

class FeatureTile extends StatelessWidget {
  const FeatureTile({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
    this.badge,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Stack(alignment: Alignment.topRight, children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: c.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: c, size: 28),
              ),
              if (badge != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(
                    color: Colors.red,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(badge!,
                      style: const TextStyle(color: Colors.white, fontSize: 9,
                          fontWeight: FontWeight.bold)),
                ),
            ]),
            const SizedBox(height: 8),
            Text(label, textAlign: TextAlign.center,
                maxLines: 2, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }
}

// ── PIN input field ───────────────────────────────────────────────────────────

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
    controller: controller,
    keyboardType:   TextInputType.number,
    obscureText:    true,
    maxLength:      6,
    onChanged:      onChanged,
    decoration:     InputDecoration(labelText: label, counterText: ''),
    validator: (v) => (v == null || v.length < 4) ? 'Enter 4–6 digits' : null,
  );
}

// ── Async builder helper ──────────────────────────────────────────────────────

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
    data:    data,
  );
}
