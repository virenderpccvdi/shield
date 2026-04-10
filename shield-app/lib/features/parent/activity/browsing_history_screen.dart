import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';
import '../../../app/theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

class BrowsingHistoryScreen extends ConsumerStatefulWidget {
  const BrowsingHistoryScreen({super.key, required this.profileId});
  final String profileId;
  @override
  ConsumerState<BrowsingHistoryScreen> createState() => _BrowsingHistoryState();
}

class _BrowsingHistoryState extends ConsumerState<BrowsingHistoryScreen> {
  String _period = 'TODAY';
  static const _periods = ['TODAY', 'WEEK', 'MONTH', 'ALL'];

  // FL3: Pagination state
  final ScrollController _scrollController = ScrollController();
  final List<Map<String, dynamic>> _items = [];
  int  _page      = 0;
  bool _loading   = false;
  bool _hasMore   = true;
  bool _isError   = false;
  static const _pageSize = 50;

  // FL4: Search state
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadPage(reset: true);
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<void> _loadPage({bool reset = false}) async {
    if (_loading) return;
    if (!reset && !_hasMore) return;

    setState(() {
      _loading = true;
      _isError = false;
      if (reset) {
        _items.clear();
        _page = 0;
        _hasMore = true;
      }
    });

    try {
      final resp = await ApiClient.instance.get(
        Endpoints.browsingHistory(widget.profileId),
        params: {
          'period': _period,
          'limit': '$_pageSize',
          'page': '$_page',
        },
      );
      final raw = resp.data is List
          ? resp.data as List
          : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
      final newItems = raw.whereType<Map<String, dynamic>>().toList();

      setState(() {
        _items.addAll(newItems);
        _page++;
        _hasMore = newItems.length >= _pageSize;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _isError = _items.isEmpty; // only show full-screen error if no data at all
      });
    }
  }

  Future<void> _loadMore() async {
    if (!_hasMore || _loading) return;
    await _loadPage();
  }

  void _changePeriod(String period) {
    if (_period == period) return;
    setState(() => _period = period);
    _loadPage(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    // FL4: Filter displayed items by search query
    final filtered = _searchQuery.isEmpty
        ? _items
        : _items.where((item) {
            final domain =
                (item['domain']?.toString() ?? item['url']?.toString() ?? '')
                    .toLowerCase();
            return domain.contains(_searchQuery.toLowerCase());
          }).toList();

    return Scaffold(
      backgroundColor: Ds.surface,
      appBar: AppBar(
        title: Text('Browsing History',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
        backgroundColor: Ds.surface,
      ),
      body: Column(children: [
        // Period tabs
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: Row(
            children: _periods
                .map((p) => Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: ChoiceChip(
                          label: Text(p,
                              style: GoogleFonts.inter(fontSize: 12)),
                          selected: _period == p,
                          onSelected: (_) => _changePeriod(p),
                        ),
                      ),
                    ))
                .toList(),
          ),
        ),

        // FL4: Domain search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search domains...',
              hintStyle:
                  GoogleFonts.inter(color: cs.onSurfaceVariant, fontSize: 14),
              prefixIcon:
                  Icon(Icons.search_rounded, color: cs.onSurfaceVariant),
              filled: true,
              fillColor: Ds.surfaceContainerLow,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(Ds.radiusDefault),
                borderSide: BorderSide.none,
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
        ),

        // Content
        Expanded(
          child: _isError
              ? ErrorView(
                  message: 'Failed to load browsing history',
                  onRetry: () => _loadPage(reset: true),
                )
              : _items.isEmpty && _loading
                  ? const _BrowsingHistorySkeleton()
                  : filtered.isEmpty
                      ? EmptyView(
                          icon: _searchQuery.isNotEmpty
                              ? Icons.search_off_rounded
                              : Icons.history,
                          message: _searchQuery.isNotEmpty
                              ? 'No results for "$_searchQuery"'
                              : 'No browsing history for this period',
                        )
                      : RefreshIndicator(
                          color: Ds.primary,
                          onRefresh: () => _loadPage(reset: true),
                          child: ListView.builder(
                            controller: _scrollController,
                            // +1 for load-more indicator at bottom
                            itemCount: filtered.length + 1,
                            itemBuilder: (_, i) {
                              // FL3: bottom sentinel — loader or "end" chip
                              if (i == filtered.length) {
                                if (_loading) {
                                  return const Padding(
                                    padding: EdgeInsets.symmetric(vertical: 16),
                                    child: Center(
                                      child: SizedBox(
                                        width: 24,
                                        height: 24,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2.5,
                                            color: Ds.primary),
                                      ),
                                    ),
                                  );
                                }
                                if (!_hasMore && _items.isNotEmpty) {
                                  return Padding(
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 16),
                                    child: Center(
                                      child: Text(
                                        'All records loaded',
                                        style: GoogleFonts.inter(
                                            fontSize: 12,
                                            color: cs.onSurfaceVariant),
                                      ),
                                    ),
                                  );
                                }
                                return const SizedBox.shrink();
                              }

                              final item = filtered[i];
                              final blocked =
                                  item['isBlocked'] as bool? ?? false;
                              final dt = DateTime.tryParse(
                                  item['visitedAt']?.toString() ?? '');
                              final domain = item['domain']?.toString() ??
                                  item['url']?.toString() ??
                                  '';

                              return Padding(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 3),
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: cs.surfaceContainerLowest,
                                    borderRadius: BorderRadius.circular(
                                        Ds.radiusDefault),
                                  ),
                                  child: ListTile(
                                    contentPadding:
                                        const EdgeInsets.symmetric(
                                            horizontal: 14, vertical: 4),
                                    leading: CircleAvatar(
                                      radius: 18,
                                      backgroundColor: blocked
                                          ? Ds.dangerContainer
                                          : Ds.surfaceContainerLow,
                                      child: Icon(
                                        blocked
                                            ? Icons.block_rounded
                                            : Icons.language_rounded,
                                        size: 16,
                                        color: blocked
                                            ? Ds.danger
                                            : cs.onSurfaceVariant,
                                      ),
                                    ),
                                    title: Text(
                                      domain,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.inter(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                        color: cs.onSurface,
                                      ),
                                    ),
                                    trailing: SizedBox(
                                      width: 62,
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        crossAxisAlignment:
                                            CrossAxisAlignment.end,
                                        children: [
                                          if (blocked)
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 5,
                                                      vertical: 2),
                                              decoration: BoxDecoration(
                                                color: Ds.dangerContainer,
                                                borderRadius:
                                                    BorderRadius.circular(4),
                                              ),
                                              child: Text('Blocked',
                                                  style: GoogleFonts.inter(
                                                      color: Ds.danger,
                                                      fontSize: 10,
                                                      fontWeight:
                                                          FontWeight.w600)),
                                            ),
                                          if (dt != null)
                                            Text(
                                              DateFormat('HH:mm')
                                                  .format(dt.toLocal()),
                                              style: GoogleFonts.inter(
                                                  fontSize: 11,
                                                  color:
                                                      cs.onSurfaceVariant),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
        ),
      ]),
    );
  }
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

class _BrowsingHistorySkeleton extends StatefulWidget {
  const _BrowsingHistorySkeleton();
  @override
  State<_BrowsingHistorySkeleton> createState() =>
      _BrowsingHistorySkeletonState();
}

class _BrowsingHistorySkeletonState extends State<_BrowsingHistorySkeleton>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Widget _bone({double height = 14, double? width, double radius = 6}) =>
      AnimatedBuilder(
        animation: _anim,
        builder: (_, __) => Container(
          height: height,
          width: width,
          decoration: BoxDecoration(
            color: Color.lerp(
              Ds.surfaceContainer,
              Ds.surfaceContainerLowest,
              _anim.value,
            ),
            borderRadius: BorderRadius.circular(radius),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) => ListView.builder(
        itemCount: 12,
        itemBuilder: (_, __) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: Row(children: [
            _bone(height: 36, width: 36, radius: 18),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _bone(height: 13),
                const SizedBox(height: 6),
                _bone(height: 11, width: 100),
              ],
            )),
            const SizedBox(width: 12),
            _bone(height: 11, width: 40),
          ]),
        ),
      );
}
