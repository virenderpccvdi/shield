import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
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
    final cs        = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Ds.surface,
      appBar: AppBar(
        title: Text(auth.isGlobalAdmin ? 'All Customers' : 'Customers',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon:    const Icon(Icons.person_add_rounded),
            tooltip: 'Invite Customer',
            onPressed: () => _showInviteDialog(context),
          ),
        ],
      ),
      body: Column(children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 8),
          child: TextField(
            controller: _search,
            onChanged:  (v) => setState(() => _query = v.toLowerCase()),
            decoration: InputDecoration(
              hintText:   'Search by name or email…',
              prefixIcon: const Icon(Icons.search_rounded, size: 20),
              suffixIcon: _query.isNotEmpty
                  ? IconButton(
                      icon:      const Icon(Icons.clear_rounded, size: 18),
                      onPressed: () {
                        _search.clear();
                        setState(() => _query = '');
                      },
                    )
                  : null,
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
                  icon:    Icons.people_outline_rounded,
                  message: _query.isNotEmpty
                      ? 'No customers match "$_query"'
                      : 'No customers yet.',
                  action: _query.isEmpty
                      ? GuardianButton(
                          label:     'Invite First Customer',
                          icon:      Icons.person_add_rounded,
                          onPressed: () => _showInviteDialog(context),
                        )
                      : null,
                );
              }

              return RefreshIndicator(
                color:     cs.primary,
                onRefresh: () async => ref.invalidate(customersProvider),
                child: ListView.builder(
                  padding:     const EdgeInsets.fromLTRB(24, 4, 24, 24),
                  itemCount:   filtered.length,
                  itemBuilder: (_, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _CustomerTile(
                      customer: filtered[i],
                      onTap:    () => context.push(
                          '/admin/customers/${filtered[i]['id']}'),
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
                  prefixIcon: Icon(Icons.person_outline_rounded))),
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
                    const SnackBar(content: Text('Invitation sent')));
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
            style: ElevatedButton.styleFrom(backgroundColor: Ds.danger),
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
    final cs       = Theme.of(context).colorScheme;
    final name     = customer['name']?.toString()    ?? 'Unknown';
    final email    = customer['email']?.toString()   ?? '';
    final children = customer['childCount'] as num?  ?? 0;
    final active   = customer['isActive'] as bool?   ?? true;
    final initial  = name.isNotEmpty ? name[0].toUpperCase() : '?';

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
              // Avatar: tonal circle
              Container(
                width:  44, height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Ds.primary.withOpacity(0.10),
                ),
                child: Center(
                  child: Text(initial,
                      style: GoogleFonts.manrope(
                          color: Ds.primary,
                          fontWeight: FontWeight.w700, fontSize: 18)),
                ),
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
                  const SizedBox(height: 2),
                  Text(email,
                      style: GoogleFonts.inter(
                          color: cs.onSurfaceVariant, fontSize: 12)),
                  if (children > 0) ...[
                    const SizedBox(height: 5),
                    Row(children: [
                      Icon(Icons.child_care_rounded,
                          size: 12, color: cs.onSurfaceVariant),
                      const SizedBox(width: 3),
                      Text('$children child${children > 1 ? 'ren' : ''}',
                          style: GoogleFonts.inter(
                              fontSize: 11, color: cs.onSurfaceVariant)),
                    ]),
                  ],
                ],
              )),

              // Status chip + menu (far right — asymmetric)
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  StatusChip(
                    active ? 'Active' : 'Inactive',
                    color: active ? Ds.success : cs.onSurfaceVariant,
                  ),
                  const SizedBox(height: 4),
                  PopupMenuButton<String>(
                    iconSize:  18,
                    iconColor: cs.onSurfaceVariant,
                    itemBuilder: (_) => [
                      const PopupMenuItem(value: 'view',
                          child: Text('View details')),
                      PopupMenuItem(value: 'delete',
                          child: Text('Remove',
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
