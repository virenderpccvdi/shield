import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
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
  return raw.whereType<Map<String, dynamic>>().toList();
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
    final cs      = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Ds.surface,
      appBar: AppBar(
        title: Text('ISP Tenants',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon:    const Icon(Icons.add_business_rounded),
            tooltip: 'New Tenant',
            onPressed: () => _showCreateDialog(context),
          ),
        ],
      ),
      body: Column(children: [
        // Search bar — uses input decoration theme
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 8),
          child: TextField(
            controller: _search,
            onChanged:  (v) => setState(() => _query = v.toLowerCase()),
            decoration: InputDecoration(
              hintText:   'Search by name or domain…',
              prefixIcon: const Icon(Icons.search_rounded, size: 20),
              suffixIcon: _query.isNotEmpty
                  ? IconButton(
                      icon:      const Icon(Icons.clear_rounded, size: 18),
                      onPressed: () {
                        _search.clear();
                        setState(() => _query = '');
                      })
                  : null,
            ),
          ),
        ),

        Expanded(
          child: tenants.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error:   (e, _) => ErrorView(
              message: 'Failed to load tenants',
              onRetry: () => ref.invalidate(tenantsProvider),
            ),
            data: (list) {
              final filtered = _query.isEmpty
                  ? list
                  : list.where((t) =>
                      (t['name']?.toString().toLowerCase() ?? '')
                          .contains(_query) ||
                      (t['domain']?.toString().toLowerCase() ?? '')
                          .contains(_query)).toList();

              if (filtered.isEmpty) {
                return EmptyView(
                  icon:    Icons.business_outlined,
                  message: _query.isNotEmpty
                      ? 'No tenants match "$_query"'
                      : 'No ISP tenants yet.',
                  action: _query.isEmpty
                      ? GuardianButton(
                          label:     'Add First Tenant',
                          icon:      Icons.add_business_rounded,
                          onPressed: () => _showCreateDialog(context),
                        )
                      : null,
                );
              }

              return RefreshIndicator(
                color:     cs.primary,
                onRefresh: () async => ref.invalidate(tenantsProvider),
                child: ListView.builder(
                  padding:     const EdgeInsets.fromLTRB(24, 4, 24, 24),
                  itemCount:   filtered.length,
                  itemBuilder: (_, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _TenantTile(
                      tenant:   filtered[i],
                      onTap:    () => context.push(
                          '/admin/tenants/${filtered[i]['id']}'),
                      onDelete: () => _confirmDelete(
                          context, ref, filtered[i]),
                    ),
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
                  'name':       nameCtrl.text.trim(),
                  'domain':     domainCtrl.text.trim(),
                  'adminEmail': emailCtrl.text.trim(),
                  'plan':       'STANDARD',
                });
                if (context.mounted) {
                  Navigator.pop(context);
                  ref.invalidate(tenantsProvider);
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Tenant created')));
                }
              } catch (_) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Failed to create tenant')));
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
            style: ElevatedButton.styleFrom(backgroundColor: Ds.danger),
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
    final cs        = Theme.of(context).colorScheme;
    final name      = tenant['name']?.toString()   ?? 'Unknown';
    final domain    = tenant['domain']?.toString() ?? '';
    final customers = (tenant['customerCount'] as num?)?.toInt() ?? 0;
    final active    = tenant['isActive'] as bool?  ?? true;
    final plan      = tenant['plan']?.toString()   ?? 'Standard';

    return DecoratedBox(
      decoration: BoxDecoration(
        color:        cs.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(Ds.radiusDefault),
        boxShadow:    Ds.guardianShadow(opacity: 0.05),
      ),
      child: Material(
        color:        Colors.transparent,
        borderRadius: BorderRadius.circular(Ds.radiusDefault),
        child: InkWell(
          onTap:        onTap,
          borderRadius: BorderRadius.circular(Ds.radiusDefault),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              // Icon container (tonal)
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(
                  color:        Ds.primary.withOpacity(0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.business_rounded,
                    color: Ds.primary, size: 22),
              ),
              const SizedBox(width: 14),

              // Info
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: GoogleFonts.manrope(
                          fontWeight: FontWeight.w700, fontSize: 15,
                          color: cs.onSurface)),
                  if (domain.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(domain,
                        style: GoogleFonts.inter(
                            color: cs.onSurfaceVariant, fontSize: 12)),
                  ],
                  const SizedBox(height: 6),
                  Row(children: [
                    Icon(Icons.people_outline_rounded,
                        size: 12, color: cs.onSurfaceVariant),
                    const SizedBox(width: 3),
                    Text('$customers customer${customers != 1 ? 's' : ''}',
                        style: GoogleFonts.inter(
                            fontSize: 11, color: cs.onSurfaceVariant)),
                  ]),
                ],
              )),

              // Status chips + menu
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  StatusChip(
                    active ? 'Active' : 'Inactive',
                    color: active ? Ds.success : cs.onSurfaceVariant,
                  ),
                  const SizedBox(height: 4),
                  StatusChip(plan, color: Ds.primary),
                  const SizedBox(height: 4),
                  PopupMenuButton<String>(
                    iconSize:    18,
                    iconColor:   cs.onSurfaceVariant,
                    itemBuilder: (_) => [
                      const PopupMenuItem(value: 'view',
                          child: Text('View details')),
                      PopupMenuItem(
                          value: 'delete',
                          child: Text('Delete',
                              style: TextStyle(color: Ds.danger))),
                    ],
                    onSelected: (v) {
                      if (v == 'view')   onTap();
                      if (v == 'delete') onDelete();
                    },
                  ),
                ],
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
