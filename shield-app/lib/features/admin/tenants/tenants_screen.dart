import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

// ── Provider ──────────────────────────────────────────────────────────────────

final tenantsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.instance
      .get(Endpoints.tenants, params: {'size': '100'});
  final raw = resp.data is List
      ? resp.data as List
      : (resp.data as Map<String, dynamic>?)?['content'] as List? ??
          (resp.data as Map<String, dynamic>?)?['data'] as List? ??
          [];
  return raw.cast<Map<String, dynamic>>();
});

// ── Screen ────────────────────────────────────────────────────────────────────

class TenantsScreen extends ConsumerStatefulWidget {
  const TenantsScreen({super.key});
  @override
  ConsumerState<TenantsScreen> createState() => _TenantsScreenState();
}

class _TenantsScreenState extends ConsumerState<TenantsScreen> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tenants = ref.watch(tenantsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('ISP Tenants'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_business_outlined),
            tooltip: 'New Tenant',
            onPressed: () => _showCreateDialog(context),
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
              hintText:   'Search by name or domain…',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _query.isNotEmpty
                  ? IconButton(
                      icon:      const Icon(Icons.clear, size: 18),
                      onPressed: () {
                        _search.clear();
                        setState(() => _query = '');
                      })
                  : null,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
          ),
        ),

        Expanded(
          child: tenants.when(
            loading: () =>
                const Center(child: CircularProgressIndicator()),
            error: (e, _) => ErrorView(
              message: 'Failed to load tenants',
              onRetry: () => ref.invalidate(tenantsProvider),
            ),
            data: (list) {
              final filtered = _query.isEmpty
                  ? list
                  : list
                      .where((t) =>
                          (t['name']?.toString().toLowerCase() ?? '')
                              .contains(_query) ||
                          (t['domain']?.toString().toLowerCase() ?? '')
                              .contains(_query))
                      .toList();

              if (filtered.isEmpty) {
                return EmptyView(
                  icon:    Icons.business_outlined,
                  message: _query.isNotEmpty
                      ? 'No tenants match "$_query"'
                      : 'No ISP tenants yet.',
                );
              }

              return RefreshIndicator(
                onRefresh: () async => ref.invalidate(tenantsProvider),
                child: ListView.builder(
                  padding:     const EdgeInsets.only(bottom: 24),
                  itemCount:   filtered.length,
                  itemBuilder: (_, i) => _TenantTile(
                    tenant: filtered[i],
                    onTap: () => context
                        .push('/admin/tenants/${filtered[i]['id']}'),
                    onDelete: () =>
                        _confirmDelete(context, ref, filtered[i]),
                  ),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }

  void _showCreateDialog(BuildContext context) {
    final nameCtrl   = TextEditingController();
    final domainCtrl = TextEditingController();
    final emailCtrl  = TextEditingController();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Create ISP Tenant'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                  labelText: 'ISP / Company name',
                  prefixIcon: Icon(Icons.business_outlined))),
          const SizedBox(height: 12),
          TextField(
              controller: domainCtrl,
              decoration: const InputDecoration(
                  labelText: 'Domain (e.g. myisp.com)',
                  prefixIcon: Icon(Icons.language_outlined))),
          const SizedBox(height: 12),
          TextField(
              controller:  emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                  labelText: 'Admin email',
                  prefixIcon: Icon(Icons.email_outlined))),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.isEmpty) return;
              try {
                await ApiClient.instance.post(Endpoints.tenants, data: {
                  'name':        nameCtrl.text.trim(),
                  'domain':      domainCtrl.text.trim(),
                  'adminEmail':  emailCtrl.text.trim(),
                  'plan':        'STANDARD',
                });
                if (context.mounted) {
                  Navigator.pop(context);
                  ref.invalidate(tenantsProvider);
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text('Tenant created'),
                          backgroundColor: Colors.green));
                }
              } catch (_) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text('Failed to create tenant')));
                }
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
    nameCtrl.dispose();
    domainCtrl.dispose();
    emailCtrl.dispose();
  }

  void _confirmDelete(BuildContext context, WidgetRef ref,
      Map<String, dynamic> tenant) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Tenant'),
        content: Text(
            'Delete "${tenant['name'] ?? 'this tenant'}"? '
            'All customer data will be permanently removed.'),
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
        await ApiClient.instance
            .delete(Endpoints.tenantById(tenant['id'].toString()));
        ref.invalidate(tenantsProvider);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Tenant deleted')));
        }
      } catch (_) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Failed to delete tenant')));
        }
      }
    }
  }
}

// ── Tenant tile ───────────────────────────────────────────────────────────────

class _TenantTile extends StatelessWidget {
  const _TenantTile({
    required this.tenant,
    required this.onTap,
    required this.onDelete,
  });
  final Map<String, dynamic> tenant;
  final VoidCallback onTap, onDelete;

  @override
  Widget build(BuildContext context) {
    final name      = tenant['name']?.toString()        ?? 'Unknown';
    final domain    = tenant['domain']?.toString()      ?? '';
    final customers = tenant['customerCount'] as int?   ?? 0;
    final active    = tenant['isActive']  as bool?      ?? true;
    final plan      = tenant['plan']?.toString()        ?? 'Standard';

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color:        ShieldTheme.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.business_outlined,
                  color: ShieldTheme.primary, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: const TextStyle(
                  fontWeight: FontWeight.w600, fontSize: 15)),
              if (domain.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(domain, style: const TextStyle(
                    color: Colors.black45, fontSize: 12)),
              ],
              const SizedBox(height: 4),
              Row(children: [
                const Icon(Icons.people_outline, size: 12, color: Colors.black38),
                const SizedBox(width: 3),
                Text('$customers customer${customers != 1 ? 's' : ''}',
                    style: const TextStyle(fontSize: 11, color: Colors.black45)),
              ]),
            ])),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: active
                      ? Colors.green.shade50
                      : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(active ? 'Active' : 'Inactive',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: active
                            ? Colors.green.shade700
                            : Colors.grey)),
              ),
              const SizedBox(height: 4),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: ShieldTheme.accent.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(plan,
                    style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: ShieldTheme.accent)),
              ),
              const SizedBox(height: 4),
              PopupMenuButton<String>(
                iconSize: 18,
                itemBuilder: (_) => [
                  const PopupMenuItem(
                      value: 'view', child: Text('View details')),
                  const PopupMenuItem(
                      value: 'delete',
                      child: Text('Delete',
                          style: TextStyle(color: Colors.red))),
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
