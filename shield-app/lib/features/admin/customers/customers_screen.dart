import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/widgets/common_widgets.dart';

// ── Provider ──────────────────────────────────────────────────────────────────

final customersProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.instance.get(
      Endpoints.customers, params: {'size': '100'});
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['content'] as List?
          ?? (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
  return raw.whereType<Map<String, dynamic>>().toList();
});

// ── Screen ────────────────────────────────────────────────────────────────────

class CustomersScreen extends ConsumerStatefulWidget {
  const CustomersScreen({super.key});
  @override
  ConsumerState<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends ConsumerState<CustomersScreen> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() { _search.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final auth      = ref.watch(authProvider);
    final customers = ref.watch(customersProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(auth.isGlobalAdmin ? 'All Customers' : 'Customers'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_outlined),
            tooltip: 'Invite Customer',
            onPressed: () => _showInviteDialog(context),
          ),
        ],
      ),
      body: Column(children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: TextField(
            controller: _search,
            onChanged:  (v) => setState(() => _query = v.toLowerCase()),
            decoration: InputDecoration(
              hintText:    'Search by name or email…',
              prefixIcon:  const Icon(Icons.search, size: 20),
              suffixIcon:  _query.isNotEmpty
                  ? IconButton(
                      icon:      const Icon(Icons.clear, size: 18),
                      onPressed: () {
                        _search.clear();
                        setState(() => _query = '');
                      },
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16, vertical: 12),
            ),
          ),
        ),

        Expanded(
          child: customers.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error:   (e, _) => ErrorView(
              message: 'Failed to load customers',
              onRetry: () => ref.invalidate(customersProvider),
            ),
            data: (list) {
              final filtered = _query.isEmpty
                  ? list
                  : list.where((c) =>
                      (c['name']?.toString().toLowerCase() ?? '')
                          .contains(_query) ||
                      (c['email']?.toString().toLowerCase() ?? '')
                          .contains(_query)).toList();

              if (filtered.isEmpty) {
                return EmptyView(
                  icon:    Icons.people_outline,
                  message: _query.isNotEmpty
                      ? 'No customers match "$_query"'
                      : 'No customers yet.',
                );
              }

              return RefreshIndicator(
                onRefresh: () async => ref.invalidate(customersProvider),
                child: ListView.builder(
                  padding:     const EdgeInsets.only(bottom: 24),
                  itemCount:   filtered.length,
                  itemBuilder: (_, i) => _CustomerTile(
                    customer: filtered[i],
                    onTap: () => context.push(
                        '/admin/customers/${filtered[i]['id']}'),
                    onDelete: () => _confirmDelete(
                        context, ref, filtered[i]),
                  ),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }

  void _showInviteDialog(BuildContext context) {
    final nameCtrl  = TextEditingController();
    final emailCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Invite Customer'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: nameCtrl,
              decoration: const InputDecoration(
                  labelText: 'Full name',
                  prefixIcon: Icon(Icons.person_outline))),
          const SizedBox(height: 12),
          TextField(controller: emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                  labelText: 'Email address',
                  prefixIcon: Icon(Icons.email_outlined))),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.isEmpty || !emailCtrl.text.contains('@')) return;
              try {
                await ApiClient.instance.post(Endpoints.customers, data: {
                  'name':  nameCtrl.text.trim(),
                  'email': emailCtrl.text.trim(),
                });
                if (context.mounted) {
                  Navigator.pop(context);
                  ref.invalidate(customersProvider);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Invitation sent'),
                        backgroundColor: Colors.green));
                }
              } catch (_) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Failed to invite customer')));
                }
              }
            },
            child: const Text('Invite'),
          ),
        ],
      ),
    );
    nameCtrl.dispose(); emailCtrl.dispose();
  }

  void _confirmDelete(BuildContext context, WidgetRef ref,
      Map<String, dynamic> customer) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Remove Customer'),
        content: Text(
            'Remove "${customer['name'] ?? 'this customer'}"? '
            'This will delete all their data.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok == true) {
      try {
        await ApiClient.instance.delete(
            Endpoints.customerById(customer['id'].toString()));
        ref.invalidate(customersProvider);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Customer removed')));
        }
      } catch (_) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to remove customer')));
        }
      }
    }
  }
}

// ── Customer tile ─────────────────────────────────────────────────────────────

class _CustomerTile extends StatelessWidget {
  const _CustomerTile({
    required this.customer,
    required this.onTap,
    required this.onDelete,
  });
  final Map<String, dynamic> customer;
  final VoidCallback onTap, onDelete;

  @override
  Widget build(BuildContext context) {
    final name      = customer['name']?.toString() ?? 'Unknown';
    final email     = customer['email']?.toString() ?? '';
    final children  = customer['childCount'] as num? ?? 0;
    final active    = customer['isActive'] as bool? ?? true;

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: ShieldTheme.primary.withOpacity(0.12),
              child: Text(
                name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: const TextStyle(
                    color: ShieldTheme.primary,
                    fontWeight: FontWeight.bold, fontSize: 18),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: const TextStyle(
                  fontWeight: FontWeight.w600, fontSize: 15)),
              const SizedBox(height: 2),
              Text(email, style: const TextStyle(
                  color: Colors.black45, fontSize: 12)),
              if (children > 0) ...[
                const SizedBox(height: 4),
                Row(children: [
                  const Icon(Icons.child_care, size: 12, color: Colors.black54),
                  const SizedBox(width: 3),
                  Text('$children child${children > 1 ? 'ren' : ''}',
                      style: const TextStyle(fontSize: 11, color: Colors.black45)),
                ]),
              ],
            ])),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color:        active ? Colors.green.shade50 : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(active ? 'Active' : 'Inactive',
                    style: TextStyle(
                        fontSize: 10, fontWeight: FontWeight.w600,
                        color: active ? Colors.green.shade700 : Colors.grey)),
              ),
              const SizedBox(height: 4),
              PopupMenuButton<String>(
                iconSize: 18,
                itemBuilder: (_) => [
                  const PopupMenuItem(value: 'view',
                      child: Text('View details')),
                  const PopupMenuItem(value: 'delete',
                      child: Text('Remove', style: TextStyle(color: Colors.red))),
                ],
                onSelected: (v) {
                  if (v == 'view')   onTap();
                  if (v == 'delete') onDelete();
                },
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}
