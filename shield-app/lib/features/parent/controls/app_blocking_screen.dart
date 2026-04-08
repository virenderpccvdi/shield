import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

final _appsProvider = FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>(
  (ref, pid) async {
    final resp = await ApiClient.instance.get(Endpoints.appsByProfile(pid));
    final raw = resp.data as List? ?? [];
    return raw.whereType<Map<String, dynamic>>().toList();
  },
);

class AppBlockingScreen extends ConsumerWidget {
  const AppBlockingScreen({super.key, required this.profileId, this.childName});
  final String profileId;
  final String? childName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final apps = ref.watch(_appsProvider(profileId));
    return Scaffold(
      appBar: AppBar(title: Text('App Blocking — ${childName ?? ''}')),
      body: apps.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => ErrorView(
          message: 'Failed to load apps',
          onRetry: () => ref.invalidate(_appsProvider(profileId)),
        ),
        data: (list) => _AppList(profileId: profileId, apps: list),
      ),
    );
  }
}

class _AppList extends ConsumerStatefulWidget {
  const _AppList({required this.profileId, required this.apps});
  final String profileId;
  final List<Map<String, dynamic>> apps;
  @override
  ConsumerState<_AppList> createState() => _AppListState();
}

class _AppListState extends ConsumerState<_AppList> {
  late List<Map<String, dynamic>> _apps;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _apps = List.from(widget.apps);
  }

  Future<void> _toggle(int idx, bool block) async {
    final pkg  = _apps[idx]['packageName'] as String? ?? '';
    setState(() => _apps[idx] = {..._apps[idx], 'isBlocked': block});
    try {
      await ApiClient.instance.post(
        '/profiles/apps/${widget.profileId}/toggle',
        data: {'packageName': pkg, 'blocked': block},
      );
    } catch (_) {
      // Revert on error
      setState(() => _apps[idx] = {..._apps[idx], 'isBlocked': !block});
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _search.isEmpty
        ? _apps
        : _apps.where((a) =>
            (a['appName'] as String? ?? '').toLowerCase().contains(_search.toLowerCase())).toList();

    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: TextField(
          decoration: const InputDecoration(
            hintText:    'Search apps…',
            prefixIcon:  Icon(Icons.search),
          ),
          onChanged: (v) => setState(() => _search = v),
        ),
      ),
      if (_apps.isEmpty)
        const Expanded(child: EmptyView(
          icon:    Icons.apps,
          message: 'No apps found on this device yet.\nApps appear after the child device syncs.',
        ))
      else Expanded(
        child: ListView.builder(
          itemCount:   filtered.length,
          itemBuilder: (_, i) {
            final app     = filtered[i];
            final blocked = app['isBlocked'] as bool? ?? false;
            return SwitchListTile(
              secondary: CircleAvatar(
                backgroundColor: Colors.grey.shade100,
                child: Text((app['appName'] as String? ?? '?')[0].toUpperCase()),
              ),
              title:    Text(app['appName'] as String? ?? app['packageName'] as String? ?? ''),
              subtitle: Text(app['packageName'] as String? ?? '',
                  style: const TextStyle(fontSize: 11)),
              value:    blocked,
              activeColor: Colors.red,
              onChanged: (v) => _toggle(_apps.indexOf(app), v),
            );
          },
        ),
      ),
    ]);
  }
}
