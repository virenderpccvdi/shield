import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class ApprovalRequestsScreen extends ConsumerStatefulWidget {
  final String profileId;
  const ApprovalRequestsScreen({super.key, required this.profileId});
  @override
  ConsumerState<ApprovalRequestsScreen> createState() => _ApprovalRequestsScreenState();
}

class _ApprovalRequestsScreenState extends ConsumerState<ApprovalRequestsScreen> {
  List<Map<String, dynamic>> _requests = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(dioProvider);
      final res = await client.get('/dns/approvals/${widget.profileId}');
      final data = res.data['data'] ?? res.data;
      setState(() {
        _requests = (data is List ? data : data['content'] ?? [])
            .map<Map<String, dynamic>>((e) => e is Map ? Map<String, dynamic>.from(e) : {}).toList();
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
      debugPrint('Approval requests error: $e');
    }
  }

  Future<void> _handleAction(String requestId, bool approve) async {
    final action = approve ? 'approve' : 'reject';
    try {
      final client = ref.read(dioProvider);
      await client.post('/dns/approvals/$requestId/$action');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(approve ? 'Request approved' : 'Request rejected'),
          backgroundColor: approve ? ShieldTheme.success : ShieldTheme.warning,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed: $e'),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('Approval Requests', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: _loading
          ? const Padding(padding: EdgeInsets.all(16), child: ShieldCardSkeleton(lines: 4))
          : _requests.isEmpty
              ? const ShieldEmptyState(
                  icon: Icons.verified_user,
                  title: 'No pending requests',
                  subtitle: 'When your child requests access to a blocked site, it will appear here.',
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _requests.length,
                    itemBuilder: (_, i) {
                      final req = _requests[i];
                      final domain = req['domain']?.toString() ?? '—';
                      final reason = req['reason']?.toString() ?? '';
                      final status = req['status']?.toString() ?? 'PENDING';
                      final requestId = req['id']?.toString() ?? '';
                      final createdAt = req['createdAt']?.toString() ?? req['requestedAt']?.toString() ?? '';
                      final isPending = status == 'PENDING';

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: ShieldTheme.warning.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.language, color: ShieldTheme.warning, size: 20),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(domain, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                                      if (createdAt.isNotEmpty)
                                        Text(_timeAgo(createdAt),
                                            style: const TextStyle(fontSize: 11, color: ShieldTheme.textSecondary)),
                                    ],
                                  ),
                                ),
                                if (!isPending)
                                  ShieldBadge(
                                    label: status,
                                    color: status == 'APPROVED' ? ShieldTheme.success : ShieldTheme.danger,
                                  ),
                              ]),
                              if (reason.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text('Reason: $reason',
                                    style: const TextStyle(fontSize: 12, color: ShieldTheme.textSecondary)),
                              ],
                              if (isPending) ...[
                                const SizedBox(height: 12),
                                Row(children: [
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      onPressed: () => _handleAction(requestId, false),
                                      icon: const Icon(Icons.close, size: 16),
                                      label: const Text('Reject'),
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: ShieldTheme.danger,
                                        side: const BorderSide(color: ShieldTheme.danger),
                                        minimumSize: const Size(0, 40),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: FilledButton.icon(
                                      onPressed: () => _handleAction(requestId, true),
                                      icon: const Icon(Icons.check, size: 16),
                                      label: const Text('Approve'),
                                      style: FilledButton.styleFrom(
                                        backgroundColor: ShieldTheme.success,
                                        minimumSize: const Size(0, 40),
                                      ),
                                    ),
                                  ),
                                ]),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }

  String _timeAgo(String iso) {
    if (iso.isEmpty) return '';
    try {
      final diff = DateTime.now().difference(DateTime.parse(iso));
      if (diff.inMinutes < 1) return 'just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      return '${diff.inDays}d ago';
    } catch (_) { return ''; }
  }
}
