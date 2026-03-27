import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class SafeFiltersScreen extends ConsumerStatefulWidget {
  final String profileId;
  const SafeFiltersScreen({super.key, required this.profileId});
  @override
  ConsumerState<SafeFiltersScreen> createState() => _SafeFiltersScreenState();
}

class _SafeFiltersScreenState extends ConsumerState<SafeFiltersScreen> {
  bool _loading = true;
  bool _youtubeSafeMode = false;
  bool _safeSearch = false;
  bool _facebookBlocked = false;
  bool _instagramBlocked = false;
  bool _tiktokBlocked = false;
  final Map<String, bool> _saving = {};

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ref.read(dioProvider).get('/dns/rules/${widget.profileId}');
      final d = res.data['data'] ?? res.data;
      if (mounted && d is Map) {
        setState(() {
          _youtubeSafeMode = d['youtubeSafeMode'] == true;
          _safeSearch = d['safeSearch'] == true;
          _facebookBlocked = d['facebookBlocked'] == true;
          _instagramBlocked = d['instagramBlocked'] == true;
          _tiktokBlocked = d['tiktokBlocked'] == true;
          _loading = false;
        });
      } else {
        if (mounted) setState(() => _loading = false);
      }
    } catch (e) {
      debugPrint('SafeFilters load error: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleYoutube(bool v) async {
    setState(() { _saving['youtube'] = true; _youtubeSafeMode = v; });
    try {
      await ref.read(dioProvider).post('/dns/rules/${widget.profileId}/youtube-safe-mode', data: {'enabled': v});
    } catch (_) {
      if (mounted) setState(() => _youtubeSafeMode = !v);
      _showErr('Failed to update YouTube Safe Mode');
    }
    if (mounted) setState(() => _saving.remove('youtube'));
  }

  Future<void> _toggleSafeSearch(bool v) async {
    setState(() { _saving['search'] = true; _safeSearch = v; });
    try {
      await ref.read(dioProvider).post('/dns/rules/${widget.profileId}/safe-search', data: {'enabled': v});
    } catch (_) {
      if (mounted) setState(() => _safeSearch = !v);
      _showErr('Failed to update Safe Search');
    }
    if (mounted) setState(() => _saving.remove('search'));
  }

  Future<void> _toggleSocial(String platform, bool v) async {
    setState(() {
      _saving[platform] = true;
      if (platform == 'facebook') _facebookBlocked = v;
      if (platform == 'instagram') _instagramBlocked = v;
      if (platform == 'tiktok') _tiktokBlocked = v;
    });
    try {
      await ref.read(dioProvider).post(
        '/dns/rules/${widget.profileId}/social-block',
        data: {'platform': platform, 'enabled': v},
      );
    } catch (_) {
      if (mounted) setState(() {
        if (platform == 'facebook') _facebookBlocked = !v;
        if (platform == 'instagram') _instagramBlocked = !v;
        if (platform == 'tiktok') _tiktokBlocked = !v;
      });
      _showErr('Failed to update ${platform[0].toUpperCase()}${platform.substring(1)} block');
    }
    if (mounted) setState(() => _saving.remove(platform));
  }

  void _showErr(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg), backgroundColor: ShieldTheme.danger,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Safe Filters', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: ShieldTheme.primary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load, tooltip: 'Refresh'),
        ],
      ),
      body: _loading
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: Column(children: [
                ShieldCardSkeleton(lines: 4),
                SizedBox(height: 12),
                ShieldCardSkeleton(lines: 4),
                SizedBox(height: 12),
                ShieldCardSkeleton(lines: 4),
              ]),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Info banner
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: ShieldTheme.primary.withOpacity(0.07),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: ShieldTheme.primary.withOpacity(0.2)),
                    ),
                    child: const Row(children: [
                      Icon(Icons.info_outline_rounded, color: ShieldTheme.primary, size: 17),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'These filters work at the DNS level — they apply to every browser and app on your child\'s device and cannot be bypassed by switching browsers or using incognito mode.',
                          style: TextStyle(fontSize: 12, color: ShieldTheme.textSecondary, height: 1.4),
                        ),
                      ),
                    ]),
                  ),

                  const _Label('SAFE BROWSING'),
                  const SizedBox(height: 10),
                  _FilterCard(
                    icon: Icons.play_circle_fill_rounded,
                    iconColor: const Color(0xFFFF0000),
                    title: 'YouTube Safe Mode',
                    description: 'Forces YouTube Restricted Mode — hides mature, age-restricted and explicit content across all devices',
                    enabled: _youtubeSafeMode,
                    saving: _saving['youtube'] == true,
                    onChanged: _toggleYoutube,
                    isBlock: false,
                    benefits: const [
                      'Hides age-restricted & mature videos',
                      'Removes explicit content from search results',
                      'Enforced on all browsers and the YouTube app',
                    ],
                  ),
                  const SizedBox(height: 12),
                  _FilterCard(
                    icon: Icons.search_rounded,
                    iconColor: const Color(0xFF1565C0),
                    title: 'Safe Search',
                    description: 'Forces SafeSearch on Google, Bing & DuckDuckGo — filters explicit images, videos, and web content',
                    enabled: _safeSearch,
                    saving: _saving['search'] == true,
                    onChanged: _toggleSafeSearch,
                    isBlock: false,
                    benefits: const [
                      'Filters explicit images & videos from search results',
                      'Works across Google, Bing, and DuckDuckGo',
                      'Cannot be turned off by your child',
                    ],
                  ),

                  const SizedBox(height: 24),
                  const _Label('SOCIAL MEDIA BLOCKING'),
                  const SizedBox(height: 10),
                  _FilterCard(
                    icon: Icons.people_alt_rounded,
                    iconColor: const Color(0xFF1877F2),
                    title: 'Block Facebook',
                    description: 'Blocks Facebook and Messenger at DNS level — prevents exposure to harmful content, videos, and contact with strangers',
                    enabled: _facebookBlocked,
                    saving: _saving['facebook'] == true,
                    onChanged: (v) => _toggleSocial('facebook', v),
                    isBlock: true,
                    benefits: const [
                      'Blocks facebook.com and messenger.com',
                      'Prevents harmful videos and live streams',
                      'Works across all browsers and apps',
                    ],
                  ),
                  const SizedBox(height: 12),
                  _FilterCard(
                    icon: Icons.photo_camera_rounded,
                    iconColor: const Color(0xFFC13584),
                    title: 'Block Instagram',
                    description: 'Blocks Instagram and Threads — prevents harmful Reels, filters, body image content, and stranger interactions',
                    enabled: _instagramBlocked,
                    saving: _saving['instagram'] == true,
                    onChanged: (v) => _toggleSocial('instagram', v),
                    isBlock: true,
                    benefits: const [
                      'Blocks instagram.com and threads.net',
                      'Stops harmful Reels, Stories and filters',
                      'Enforced on all browsers and mobile apps',
                    ],
                  ),
                  const SizedBox(height: 12),
                  _FilterCard(
                    icon: Icons.music_video_rounded,
                    iconColor: const Color(0xFFEE1D52),
                    title: 'Block TikTok',
                    description: 'Blocks TikTok completely — prevents addictive short-form videos, dangerous challenges, and stranger interactions',
                    enabled: _tiktokBlocked,
                    saving: _saving['tiktok'] == true,
                    onChanged: (v) => _toggleSocial('tiktok', v),
                    isBlock: true,
                    benefits: const [
                      'Blocks tiktok.com and all CDN domains',
                      'Stops addictive video feed and viral challenges',
                      'Cannot be bypassed by VPN apps',
                    ],
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11,
      color: ShieldTheme.textSecondary, letterSpacing: 0.8),
  );
}

class _FilterCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String description;
  final bool enabled;
  final bool saving;
  final ValueChanged<bool> onChanged;
  final List<String> benefits;
  final bool isBlock;

  const _FilterCard({
    required this.icon, required this.iconColor, required this.title,
    required this.description, required this.enabled, required this.saving,
    required this.onChanged, required this.benefits, required this.isBlock,
  });

  @override
  Widget build(BuildContext context) {
    final activeColor = isBlock ? ShieldTheme.danger : ShieldTheme.success;
    return Container(
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: enabled ? activeColor.withOpacity(0.4) : ShieldTheme.divider,
          width: enabled ? 1.5 : 1,
        ),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(title, style: const TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 15, color: ShieldTheme.textPrimary))),
                if (enabled)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: activeColor.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(isBlock ? 'Blocked' : 'Active',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: activeColor)),
                  ),
              ]),
              const SizedBox(height: 4),
              Text(description, style: const TextStyle(
                fontSize: 12.5, color: ShieldTheme.textSecondary, height: 1.4)),
            ])),
          ]),
          const SizedBox(height: 12),
          ...benefits.map((b) => Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(children: [
              Icon(Icons.check_circle_rounded, size: 13,
                  color: enabled ? activeColor : ShieldTheme.textSecondary.withOpacity(0.5)),
              const SizedBox(width: 7),
              Expanded(child: Text(b, style: const TextStyle(
                  fontSize: 12, color: ShieldTheme.textSecondary))),
            ]),
          )),
          const SizedBox(height: 10),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            saving
                ? const SizedBox(width: 24, height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : Switch(
                    value: enabled,
                    onChanged: onChanged,
                    thumbColor: WidgetStateProperty.resolveWith((s) =>
                      s.contains(WidgetState.selected) ? activeColor : Colors.grey),
                    trackColor: WidgetStateProperty.resolveWith((s) =>
                      s.contains(WidgetState.selected)
                          ? activeColor.withOpacity(0.4)
                          : Colors.grey.withOpacity(0.25)),
                    trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
                  ),
          ]),
        ],
      ),
    );
  }
}
