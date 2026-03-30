import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

// ── Providers ─────────────────────────────────────────────────────────────────

final _tenantDetailProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, id) async {
  final resp = await ApiClient.instance.get(Endpoints.tenantById(id));
  return resp.data is Map<String, dynamic>
      ? resp.data as Map<String, dynamic>
      : <String, dynamic>{};
});

// ── Screen ────────────────────────────────────────────────────────────────────

class TenantDetailScreen extends ConsumerWidget {
  const TenantDetailScreen({super.key, required this.tenantId});
  final String tenantId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(_tenantDetailProvider(tenantId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tenant Detail'),
        actions: [
          detail.when(
            data: (d) => PopupMenuButton<String>(
              itemBuilder: (_) => [
                const PopupMenuItem(
                    value: 'edit',
                    child: Row(children: [
                      Icon(Icons.edit_outlined, size: 18),
                      SizedBox(width: 8),
                      Text('Edit'),
                    ])),
                const PopupMenuItem(
                    value: 'suspend',
                    child: Row(children: [
                      Icon(Icons.block, size: 18, color: Colors.orange),
                      SizedBox(width: 8),
                      Text('Suspend',
                          style: TextStyle(color: Colors.orange)),
                    ])),
                const PopupMenuItem(
                    value: 'delete',
                    child: Row(children: [
                      Icon(Icons.delete_outline, size: 18, color: Colors.red),
                      SizedBox(width: 8),
                      Text('Delete', style: TextStyle(color: Colors.red)),
                    ])),
              ],
              onSelected: (v) => _handleAction(context, ref, v, d),
            ),
            loading: () => const SizedBox.shrink(),
            error:   (_, __) => const SizedBox.shrink(),
          ),
        ],
      ),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          message: 'Failed to load tenant',
          onRetry: () => ref.invalidate(_tenantDetailProvider(tenantId)),
        ),
        data: (d) => _Body(
          tenant:   d,
          tenantId: tenantId,
          onRefresh: () => ref.invalidate(_tenantDetailProvider(tenantId)),
        ),
      ),
    );
  }

  void _handleAction(BuildContext context, WidgetRef ref,
      String action, Map<String, dynamic> data) async {
    if (action == 'edit') {
      _showEditDialog(context, ref, data);
    } else if (action == 'suspend') {
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Suspend Tenant'),
          content: Text(
              'Suspend "${data['name']}"? '
              'All their customers will lose access.'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.orange),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Suspend'),
            ),
          ],
        ),
      );
      if (ok == true) {
        try {
          await ApiClient.instance.put(Endpoints.tenantById(tenantId),
              data: {'isActive': false});
          ref.invalidate(_tenantDetailProvider(tenantId));
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Tenant suspended')));
          }
        } catch (_) {}
      }
    } else if (action == 'delete') {
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Delete Tenant'),
          content: const Text(
              'This permanently deletes the tenant and all customer data.'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete'),
            ),
          ],
        ),
      );
      if (ok == true) {
        try {
          await ApiClient.instance.delete(Endpoints.tenantById(tenantId));
          if (context.mounted) context.pop();
        } catch (_) {}
      }
    }
  }

  void _showEditDialog(BuildContext context, WidgetRef ref,
      Map<String, dynamic> data) async {
    final nameCtrl   = TextEditingController(
        text: data['name']?.toString() ?? '');
    final domainCtrl = TextEditingController(
        text: data['domain']?.toString() ?? '');

    final plans = ['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE'];
    String selectedPlan = data['plan']?.toString() ?? 'STANDARD';

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSt) => AlertDialog(
          title: const Text('Edit Tenant'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(
                    labelText: 'Company name',
                    prefixIcon: Icon(Icons.business_outlined))),
            const SizedBox(height: 12),
            TextField(
                controller: domainCtrl,
                decoration: const InputDecoration(
                    labelText: 'Domain',
                    prefixIcon: Icon(Icons.language_outlined))),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: selectedPlan,
              decoration: const InputDecoration(labelText: 'Plan'),
              items: plans
                  .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                  .toList(),
              onChanged: (v) => setSt(() => selectedPlan = v!),
            ),
          ]),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                try {
                  await ApiClient.instance.put(
                      Endpoints.tenantById(tenantId),
                      data: {
                        'name':   nameCtrl.text.trim(),
                        'domain': domainCtrl.text.trim(),
                        'plan':   selectedPlan,
                      });
                  if (ctx.mounted) {
                    Navigator.pop(ctx);
                    ref.invalidate(_tenantDetailProvider(tenantId));
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Tenant updated'),
                        backgroundColor: Colors.green));
                  }
                } catch (_) {
                  if (ctx.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Update failed')));
                  }
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    nameCtrl.dispose();
    domainCtrl.dispose();
  }
}

// ── Body ──────────────────────────────────────────────────────────────────────

class _Body extends StatelessWidget {
  const _Body({
    required this.tenant,
    required this.tenantId,
    required this.onRefresh,
  });
  final Map<String, dynamic> tenant;
  final String               tenantId;
  final VoidCallback         onRefresh;

  @override
  Widget build(BuildContext context) {
    final name      = tenant['name']?.toString()   ?? 'Unknown';
    final domain    = tenant['domain']?.toString() ?? '';
    final active    = tenant['isActive'] as bool?  ?? true;
    final plan      = tenant['plan']?.toString()   ?? 'Standard';
    final customers = tenant['customerCount'] as int? ?? 0;
    final maxCust   = tenant['maxCustomers']  as int? ?? 0;
    final created   = _parseDate(tenant['createdAt']?.toString());

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView(children: [
        // ── Header card ────────────────────────────────────────────────────
        Container(
          margin:  const EdgeInsets.all(16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0D1B4B), Color(0xFF1565C0)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(children: [
            Container(
              width: 60, height: 60,
              decoration: BoxDecoration(
                  color: Colors.white24, borderRadius: BorderRadius.circular(14)),
              child: const Icon(Icons.business, color: Colors.white, size: 30),
            ),
            const SizedBox(width: 16),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: const TextStyle(
                  color: Colors.white, fontSize: 18,
                  fontWeight: FontWeight.w700)),
              if (domain.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(domain,
                    style: TextStyle(
                        color: Colors.white.withOpacity(0.7),
                        fontSize: 13)),
              ],
              const SizedBox(height: 8),
              Row(children: [
                _pill(active ? 'Active' : 'Inactive',
                    active ? Colors.green : Colors.red),
                const SizedBox(width: 8),
                _pill(plan, ShieldTheme.accent),
              ]),
            ])),
          ]),
        ),

        // ── Stats row ──────────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: [
            _StatCard(label: 'Customers', value: '$customers',
                icon: Icons.people_outline, color: ShieldTheme.primary),
            const SizedBox(width: 12),
            _StatCard(label: 'Max Allowed', value: maxCust > 0 ? '$maxCust' : '∞',
                icon: Icons.group_add_outlined, color: ShieldTheme.secondary),
          ]),
        ),
        const SizedBox(height: 16),

        // ── Info ───────────────────────────────────────────────────────────
        const SectionHeader('Account Info'),
        _InfoTile(icon: Icons.calendar_today_outlined,
            label: 'Created', value: created),
        _InfoTile(icon: Icons.payment_outlined,
            label: 'Plan', value: plan),
        _InfoTile(icon: Icons.verified_user_outlined,
            label: 'Status', value: active ? 'Active' : 'Suspended'),
        if (domain.isNotEmpty)
          _InfoTile(icon: Icons.language_outlined,
              label: 'Domain', value: domain),

        const SizedBox(height: 32),
      ]),
    );
  }

  Widget _pill(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: color.withOpacity(0.2),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(label,
        style: TextStyle(
            fontSize: 10,
            color: color,
            fontWeight: FontWeight.w600)),
  );

  String _parseDate(String? s) {
    if (s == null) return 'Unknown';
    final dt = DateTime.tryParse(s);
    return dt == null ? s : DateFormat('d MMM y').format(dt);
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
  final String   label, value;
  final IconData icon;
  final Color    color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? ShieldTheme.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: isDark ? Border.all(color: Colors.white12) : null,
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 6,
                      offset: const Offset(0, 2))
                ],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 8),
          Text(value,
              style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w700, color: color)),
          Text(label,
              style: TextStyle(
                  fontSize: 10,
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withOpacity(0.5))),
        ]),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String   label, value;

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Container(
      width: 36, height: 36,
      decoration: BoxDecoration(
        color:        ShieldTheme.primary.withOpacity(0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(icon, size: 18, color: ShieldTheme.primary),
    ),
    title: Text(label,
        style: const TextStyle(fontSize: 12, color: Colors.black45)),
    subtitle: Text(value,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
  );
}
