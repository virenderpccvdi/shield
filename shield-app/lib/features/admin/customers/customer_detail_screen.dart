import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

// ── Providers ─────────────────────────────────────────────────────────────────

final _customerDetailProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, id) async {
  final resp = await ApiClient.instance.get(Endpoints.customerById(id));
  return resp.data is Map<String, dynamic>
      ? resp.data as Map<String, dynamic>
      : <String, dynamic>{};
});

final _customerChildrenProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, id) async {
  try {
    final resp = await ApiClient.instance.get(Endpoints.customerChildren(id));
    final raw = resp.data is List
        ? resp.data as List
        : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
    return raw.whereType<Map<String, dynamic>>().toList();
  } catch (_) {
    return [];
  }
});

// ── Screen ────────────────────────────────────────────────────────────────────

class CustomerDetailScreen extends ConsumerWidget {
  const CustomerDetailScreen({super.key, required this.customerId});
  final String customerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail   = ref.watch(_customerDetailProvider(customerId));
    final children = ref.watch(_customerChildrenProvider(customerId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Customer Detail'),
        actions: [
          detail.when(
            data: (d) => PopupMenuButton<String>(
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit',
                    child: Row(children: [
                      Icon(Icons.edit_outlined, size: 18),
                      SizedBox(width: 8), Text('Edit'),
                    ])),
                const PopupMenuItem(value: 'suspend',
                    child: Row(children: [
                      Icon(Icons.block, size: 18, color: Colors.orange),
                      SizedBox(width: 8),
                      Text('Suspend', style: TextStyle(color: Colors.orange)),
                    ])),
                const PopupMenuItem(value: 'delete',
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
        error:   (e, _) => ErrorView(
          message: 'Failed to load customer',
          onRetry: () => ref.invalidate(_customerDetailProvider(customerId)),
        ),
        data: (d) => _Body(
          customer:    d,
          customerId:  customerId,
          childrenAsync: children,
          onRefresh: () {
            ref.invalidate(_customerDetailProvider(customerId));
            ref.invalidate(_customerChildrenProvider(customerId));
          },
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
          title: const Text('Suspend Account'),
          content: Text(
              'Suspend "${data['name']}"? '
              'Their children\'s protection will remain active.'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Suspend'),
            ),
          ],
        ),
      );
      if (ok == true) {
        try {
          await ApiClient.instance.put(
              Endpoints.customerById(customerId),
              data: {'isActive': false});
          ref.invalidate(_customerDetailProvider(customerId));
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Account suspended')));
          }
        } catch (_) {}
      }
    } else if (action == 'delete') {
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Delete Customer'),
          content: const Text('This permanently deletes the account and all data.'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete'),
            ),
          ],
        ),
      );
      if (ok == true) {
        try {
          await ApiClient.instance.delete(
              Endpoints.customerById(customerId));
          if (context.mounted) context.pop();
        } catch (_) {}
      }
    }
  }

  void _showEditDialog(BuildContext context, WidgetRef ref,
      Map<String, dynamic> data) async {
    final nameCtrl = TextEditingController(text: data['name']?.toString() ?? '');
    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Edit Customer'),
        content: TextField(
          controller: nameCtrl,
          decoration: const InputDecoration(
              labelText: 'Full name',
              prefixIcon: Icon(Icons.person_outline)),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              try {
                await ApiClient.instance.put(
                    Endpoints.customerById(customerId),
                    data: {'name': nameCtrl.text.trim()});
                if (context.mounted) {
                  Navigator.pop(context);
                  ref.invalidate(_customerDetailProvider(customerId));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Customer updated'),
                        backgroundColor: Colors.green));
                }
              } catch (_) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Update failed')));
                }
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    nameCtrl.dispose();
  }
}

// ── Body ──────────────────────────────────────────────────────────────────────

class _Body extends StatelessWidget {
  const _Body({
    required this.customer,
    required this.customerId,
    required this.childrenAsync,
    required this.onRefresh,
  });
  final Map<String, dynamic>                    customer;
  final String                                   customerId;
  final AsyncValue<List<Map<String, dynamic>>>   childrenAsync;
  final VoidCallback                             onRefresh;

  @override
  Widget build(BuildContext context) {
    final name    = customer['name']?.toString()  ?? 'Unknown';
    final email   = customer['email']?.toString() ?? '';
    final active  = customer['isActive'] as bool? ?? true;
    final created = _parseDate(customer['createdAt']?.toString());
    final plan    = customer['plan']?.toString() ?? 'Free';

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView(children: [
        // ── Profile header card ─────────────────────────────────────────────
        Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1E40AF), Color(0xFF2563EB)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: Colors.white24,
              child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: const TextStyle(
                      color: Colors.white, fontSize: 26,
                      fontWeight: FontWeight.bold)),
            ),
            const SizedBox(width: 16),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: const TextStyle(
                  color: Colors.white, fontSize: 18,
                  fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(email, style: TextStyle(
                  color: Colors.white.withOpacity(0.7), fontSize: 13)),
              const SizedBox(height: 6),
              Row(children: [
                _pill(active ? 'Active' : 'Inactive',
                    active ? Colors.green : Colors.red),
                const SizedBox(width: 8),
                _pill(plan, ShieldTheme.accent),
              ]),
            ])),
          ]),
        ),

        // ── Info tiles ──────────────────────────────────────────────────────
        const SectionHeader('Account Info'),
        _InfoTile(icon: Icons.calendar_today_outlined,
            label: 'Joined', value: created),
        _InfoTile(icon: Icons.payment_outlined,
            label: 'Plan', value: plan),
        _InfoTile(icon: Icons.verified_user_outlined,
            label: 'Status', value: active ? 'Active' : 'Suspended'),

        // ── Children ────────────────────────────────────────────────────────
        const SectionHeader('Child Profiles'),
        childrenAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error:   (_, __) => const ListTile(
              title: Text('Failed to load children')),
          data: (list) {
            if (list.isEmpty) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: Text('No child profiles.',
                    style: TextStyle(color: Colors.black45)),
              );
            }
            return Column(children: list.map((c) => ListTile(
              leading: CircleAvatar(
                backgroundColor: ShieldTheme.primary.withOpacity(0.1),
                child: Text(
                  (c['name']?.toString() ?? '?').isNotEmpty
                      ? (c['name']?.toString() ?? '?')[0] : '?',
                  style: const TextStyle(
                      color: ShieldTheme.primary,
                      fontWeight: FontWeight.bold),
                ),
              ),
              title:    Text(c['name']?.toString() ?? 'Child'),
              subtitle: c['filterLevel'] != null
                  ? Text('Filter: ${c['filterLevel']}',
                      style: const TextStyle(fontSize: 12))
                  : null,
              trailing: const Icon(Icons.chevron_right, size: 18),
            )).toList());
          },
        ),

        const SizedBox(height: 32),
      ]),
    );
  }

  Widget _pill(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color:        color.withOpacity(0.2),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(label,
        style: TextStyle(fontSize: 10, color: color,
            fontWeight: FontWeight.w600)),
  );

  String _parseDate(String? s) {
    if (s == null) return 'Unknown';
    final dt = DateTime.tryParse(s);
    return dt == null ? s : DateFormat('d MMM y').format(dt);
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
    title:    Text(label,
        style: const TextStyle(fontSize: 12, color: Colors.black45)),
    subtitle: Text(value,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
  );
}
