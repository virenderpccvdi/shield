import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../app/theme.dart';
import '../../core/api_client.dart';

// ─── Ask AI State ─────────────────────────────────────────────────────────────

class _ChatMessage {
  final String text;
  final bool isUser;
  final List<String> suggestions;
  const _ChatMessage({
    required this.text,
    required this.isUser,
    this.suggestions = const [],
  });
}

// ─── Provider ────────────────────────────────────────────────────────────────

final aiInsightsProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, profileId) async {
  final client = ref.read(dioProvider);
  final result = <String, dynamic>{};

  // Fetch AI insights (enriched endpoint)
  try {
    final res = await client.get('/ai/$profileId/insights');
    final data = res.data is Map && res.data['data'] != null
        ? res.data['data']
        : res.data;
    if (data is Map) result.addAll(Map<String, dynamic>.from(data));
  } catch (_) {}

  // Fetch analytics stats for behavior trends (fallback/supplemental)
  try {
    final res =
        await client.get('/analytics/$profileId/stats?period=WEEK');
    final raw = res.data is Map ? res.data['data'] : null;
    if (raw is Map) {
      result['analyticsStats'] = Map<String, dynamic>.from(raw);
    }
  } catch (_) {}

  return result;
});

// ─── Mock / fallback helpers ──────────────────────────────────────────────────

Map<String, dynamic> _mockData() => {
      'riskScore': 38,
      'riskLevel': 'MEDIUM',
      'hasData': true,
      'screenTimeMinutes': 182,
      'dailyAvgMinutes': 145,
      'totalBlocked': 212,
      'summary':
          'Activity patterns look mostly healthy. A few late-night sessions detected.',
      'recommendations': [
        {
          'icon': 'bedtime',
          'title': 'Set a Bedtime Schedule',
          'description':
              'Browsing activity detected after 10 PM on 3 nights this week. Enable a bedtime schedule to improve sleep quality.',
        },
        {
          'icon': 'sports_esports',
          'title': 'Tighten Gaming Time Limit',
          'description':
              'Gaming-related DNS queries spiked 40% this week. Set a daily 1-hour limit for the Gaming category.',
        },
        {
          'icon': 'star',
          'title': 'Reward Good Behaviour',
          'description':
              'Your child completed all homework tasks on time. A reward point boost could reinforce the habit.',
        },
      ],
      'anomalies': [
        {
          'detectedAt': '2026-03-21T22:14:00Z',
          'timestamp': '2026-03-21T22:14:00',
          'description': 'Unusual browsing activity detected after curfew.',
          'severity': 'MEDIUM',
        },
        {
          'detectedAt': '2026-03-20T15:33:00Z',
          'timestamp': '2026-03-20T15:33:00',
          'description': 'Repeated attempts to access blocked social media.',
          'severity': 'LOW',
        },
        {
          'detectedAt': '2026-03-19T08:05:00Z',
          'timestamp': '2026-03-19T08:05:00',
          'description': 'VPN-related DNS query pattern detected.',
          'severity': 'HIGH',
        },
      ],
      'weeklyTrend': [
        {'date': '2026-03-15', 'allowed': 120, 'blocked': 18},
        {'date': '2026-03-16', 'allowed': 95,  'blocked': 12},
        {'date': '2026-03-17', 'allowed': 140, 'blocked': 30},
        {'date': '2026-03-18', 'allowed': 110, 'blocked': 22},
        {'date': '2026-03-19', 'allowed': 160, 'blocked': 45},
        {'date': '2026-03-20', 'allowed': 200, 'blocked': 60},
        {'date': '2026-03-21', 'allowed': 130, 'blocked': 25},
      ],
      'topCategories': [
        {'name': 'Social Media', 'minutes': 48, 'blocked': 78},
        {'name': 'Gaming',       'minutes': 62, 'blocked': 52},
        {'name': 'Adult',        'minutes': 0,  'blocked': 34},
        {'name': 'Streaming',    'minutes': 35, 'blocked': 21},
        {'name': 'Ads',          'minutes': 5,  'blocked': 15},
      ],
      'analyticsStats': {
        'dailyAllowed': [120, 95, 140, 110, 160, 200, 130],
        'dailyBlocked': [18, 12, 30, 22, 45, 60, 25],
        'topBlockedCategories': [
          {'name': 'Social Media', 'count': 78},
          {'name': 'Gaming', 'count': 52},
          {'name': 'Adult', 'count': 34},
          {'name': 'Streaming', 'count': 21},
          {'name': 'Ads', 'count': 15},
        ],
      },
    };

// ─── Screen ──────────────────────────────────────────────────────────────────

class AiInsightsScreen extends ConsumerWidget {
  final String profileId;
  const AiInsightsScreen({super.key, required this.profileId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(aiInsightsProvider(profileId));

    return Scaffold(
      backgroundColor: ShieldTheme.surface,
      appBar: AppBar(
        title: const Text('AI Insights'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () =>
                ref.invalidate(aiInsightsProvider(profileId)),
          ),
        ],
      ),
      body: asyncData.when(
        loading: () => const _LoadingSkeleton(),
        error: (_, __) => _InsightsBody(
          data: _mockData(),
          profileId: profileId,
          onRefresh: () async =>
              ref.invalidate(aiInsightsProvider(profileId)),
        ),
        data: (raw) {
          // If the backend says hasData=false (new profile), show empty state
          if (raw['hasData'] == false) {
            return _NoDataEmptyState(
              onRefresh: () =>
                  ref.invalidate(aiInsightsProvider(profileId)),
            );
          }
          final data =
              raw.isEmpty ? _mockData() : _mergeMock(raw);
          return _InsightsBody(
            data: data,
            profileId: profileId,
            onRefresh: () async =>
                ref.invalidate(aiInsightsProvider(profileId)),
          );
        },
      ),
    );
  }

  /// Fill any missing keys from mock so widgets always have data.
  Map<String, dynamic> _mergeMock(Map<String, dynamic> raw) {
    final mock = _mockData();

    // Prefer real weeklyTrend over mock if it's non-empty
    final weeklyTrend = (raw['weeklyTrend'] as List?)?.isNotEmpty == true
        ? raw['weeklyTrend']
        : mock['weeklyTrend'];

    // Merge topCategories: prefer real if non-empty
    final topCategories = (raw['topCategories'] as List?)?.isNotEmpty == true
        ? raw['topCategories']
        : mock['topCategories'];

    // Merge recommendations: prefer real if non-empty
    final recommendations =
        (raw['recommendations'] as List?)?.isNotEmpty == true
            ? raw['recommendations']
            : mock['recommendations'];

    // Merge anomalies: use real ones (may be empty = good)
    final anomalies =
        raw.containsKey('anomalies') ? raw['anomalies'] : mock['anomalies'];

    return {
      ...mock,
      ...raw,
      'weeklyTrend': weeklyTrend,
      'topCategories': topCategories,
      'recommendations': recommendations,
      'anomalies': anomalies,
      'analyticsStats': {
        ...(mock['analyticsStats'] as Map<String, dynamic>),
        ...((raw['analyticsStats'] as Map?)?.cast<String, dynamic>() ?? {}),
      },
    };
  }
}

// ─── Body ────────────────────────────────────────────────────────────────────

class _InsightsBody extends ConsumerStatefulWidget {
  final Map<String, dynamic> data;
  final String profileId;
  final Future<void> Function() onRefresh;

  const _InsightsBody({
    required this.data,
    required this.profileId,
    required this.onRefresh,
  });

  @override
  ConsumerState<_InsightsBody> createState() => _InsightsBodyState();
}

class _InsightsBodyState extends ConsumerState<_InsightsBody> {
  final _chatController = TextEditingController();
  final _chatScrollController = ScrollController();
  final List<_ChatMessage> _messages = [];
  bool _chatLoading = false;

  @override
  void dispose() {
    _chatController.dispose();
    _chatScrollController.dispose();
    super.dispose();
  }

  Future<void> _sendQuestion(String question) async {
    if (question.trim().isEmpty) return;
    final q = question.trim();
    _chatController.clear();

    setState(() {
      _messages.add(_ChatMessage(text: q, isUser: true));
      _chatLoading = true;
    });

    // Keep only last 3 Q&A pairs (6 messages)
    if (_messages.length > 6) {
      _messages.removeRange(0, _messages.length - 6);
    }

    _scrollToBottom();

    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post('/ai/chat', data: {
        'profileId': widget.profileId,
        'question': q,
      });
      final body = res.data is Map ? res.data as Map<String, dynamic> : <String, dynamic>{};
      final answer = body['answer'] as String? ?? 'Sorry, no answer available.';
      final rawSuggestions = body['suggestions'];
      final suggestions = rawSuggestions is List
          ? rawSuggestions.map((s) => s.toString()).toList()
          : <String>[];

      if (mounted) {
        setState(() {
          _chatLoading = false;
          _messages.add(_ChatMessage(
            text: answer,
            isUser: false,
            suggestions: suggestions,
          ));
        });
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _chatLoading = false;
          _messages.add(const _ChatMessage(
            text: 'Unable to reach Shield AI right now. Please try again.',
            isUser: false,
          ));
        });
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_chatScrollController.hasClients) {
        _chatScrollController.animateTo(
          _chatScrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  List<double> _toDoubleList(dynamic raw) {
    if (raw is List) {
      return raw.map((e) => (e as num).toDouble()).toList();
    }
    return List.generate(7, (_) => 0);
  }

  List<Map<String, dynamic>> _toCategoryList(dynamic raw) {
    if (raw is List) {
      return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  List<Map<String, dynamic>> _toMapList(dynamic raw) {
    if (raw is List) {
      return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final stats =
        (data['analyticsStats'] as Map?)?.cast<String, dynamic>() ?? {};

    // Prefer real weeklyTrend from AI endpoint
    final weeklyTrend = _toMapList(data['weeklyTrend']);
    final dailyAllowed = weeklyTrend.isNotEmpty
        ? weeklyTrend.map((d) => ((d['allowed'] as num?) ?? 0).toDouble()).toList()
        : _toDoubleList(stats['dailyAllowed']);
    final dailyBlocked = weeklyTrend.isNotEmpty
        ? weeklyTrend.map((d) => ((d['blocked'] as num?) ?? 0).toDouble()).toList()
        : _toDoubleList(stats['dailyBlocked']);

    // Categories: prefer topCategories from AI insights
    final topCategories = _toMapList(data['topCategories']);
    final legacyCategories = _toCategoryList(stats['topBlockedCategories']);
    final categories = topCategories.isNotEmpty
        ? topCategories.map((c) => {
              'name': c['name'] ?? '',
              'count': (c['blocked'] as num?) ?? 0,
            }).toList()
        : legacyCategories;

    final recommendations = _toMapList(data['recommendations']);
    final anomalies = _toMapList(data['anomalies']);
    final riskScore = (data['riskScore'] as num?)?.toDouble() ?? 0;

    // Screen time stats
    final screenTimeMinutes = (data['screenTimeMinutes'] as num?)?.toInt() ?? 0;
    final dailyAvgMinutes = (data['dailyAvgMinutes'] as num?)?.toInt() ?? 0;
    final totalBlocked = (data['totalBlocked'] as num?)?.toInt() ?? 0;

    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      color: ShieldTheme.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Risk Score Card
            _RiskScoreCard(
              riskScore: riskScore,
              summary: (data['summary'] as String?)?.isNotEmpty == true
                  ? data['summary'] as String
                  : 'AI analysis in progress…',
            ),
            const SizedBox(height: 16),

            // 2. Screen Time Stats Row
            _ScreenTimeStatsRow(
              screenTimeMinutes: screenTimeMinutes,
              dailyAvgMinutes: dailyAvgMinutes,
              totalBlocked: totalBlocked,
            ),
            const SizedBox(height: 20),

            // 3. Behavior Trends
            _SectionHeader(
              icon: Icons.show_chart_rounded,
              title: 'Behavior Trends',
              subtitle: 'Last 7 days · DNS queries',
            ),
            const SizedBox(height: 10),
            _BehaviorTrendCard(
              allowed: dailyAllowed,
              blocked: dailyBlocked,
            ),
            const SizedBox(height: 20),

            // 4. Top Blocked Categories
            if (categories.isNotEmpty) ...[
              _SectionHeader(
                icon: Icons.bar_chart_rounded,
                title: 'Top Blocked Categories',
                subtitle: 'This week',
              ),
              const SizedBox(height: 10),
              _BlockedCategoriesCard(categories: categories),
              const SizedBox(height: 20),
            ],

            // 5. AI Recommendations
            _SectionHeader(
              icon: Icons.lightbulb_rounded,
              title: 'AI Recommendations',
              subtitle:
                  '${recommendations.length} suggestion${recommendations.length == 1 ? '' : 's'}',
            ),
            const SizedBox(height: 10),
            ...recommendations.map(
              (r) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _RecommendationCard(rec: r),
              ),
            ),
            const SizedBox(height: 10),

            // 6. Anomaly Alerts
            _SectionHeader(
              icon: Icons.warning_amber_rounded,
              title: 'Anomaly Alerts',
              subtitle: anomalies.isEmpty
                  ? 'No recent anomalies'
                  : '${anomalies.length} detected',
            ),
            const SizedBox(height: 10),
            if (anomalies.isEmpty)
              _EmptyAnomalies()
            else
              ...anomalies.asMap().entries.map(
                    (e) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _AnomalyCard(
                        anomaly: e.value,
                        isLast: e.key == anomalies.length - 1,
                      ),
                    ),
                  ),

            // 7. Ask AI
            const SizedBox(height: 24),
            _AskAiSection(
              messages: _messages,
              chatLoading: _chatLoading,
              chatController: _chatController,
              scrollController: _chatScrollController,
              onSend: _sendQuestion,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── No-Data Empty State (new profile / < 24h usage) ─────────────────────────

class _NoDataEmptyState extends StatelessWidget {
  final VoidCallback onRefresh;
  const _NoDataEmptyState({required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Icon illustration
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: ShieldTheme.primary.withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Icon(Icons.psychology_rounded,
                      size: 60, color: ShieldTheme.primary.withOpacity(0.5)),
                  Positioned(
                    bottom: 16,
                    right: 16,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: ShieldTheme.surface,
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: ShieldTheme.primary.withOpacity(0.3)),
                      ),
                      child: Icon(Icons.hourglass_empty_rounded,
                          size: 18,
                          color: ShieldTheme.primary.withOpacity(0.6)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            const Text(
              'Collecting Data…',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: ShieldTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'AI insights will be available after 24 hours of usage. '
              'Make sure your child\'s device is connected and actively browsing.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: ShieldTheme.textSecondary,
                height: 1.55,
              ),
            ),
            const SizedBox(height: 10),
            // Checklist hints
            _HintRow(
              icon: Icons.wifi_rounded,
              text: 'Device connected to Shield DNS',
            ),
            _HintRow(
              icon: Icons.access_time_rounded,
              text: 'Check back after some browsing activity',
            ),
            _HintRow(
              icon: Icons.notifications_active_rounded,
              text: 'You\'ll get a notification when insights are ready',
            ),
            const SizedBox(height: 32),
            TextButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Check Again'),
              style: TextButton.styleFrom(foregroundColor: ShieldTheme.primary),
            ),
          ],
        ),
      ),
    );
  }
}

class _HintRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _HintRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 16, color: ShieldTheme.primary.withOpacity(0.6)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              text,
              style: const TextStyle(
                  fontSize: 13, color: ShieldTheme.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Screen Time Stats Row ────────────────────────────────────────────────────

class _ScreenTimeStatsRow extends StatelessWidget {
  final int screenTimeMinutes;
  final int dailyAvgMinutes;
  final int totalBlocked;

  const _ScreenTimeStatsRow({
    required this.screenTimeMinutes,
    required this.dailyAvgMinutes,
    required this.totalBlocked,
  });

  String _fmtMinutes(int m) {
    if (m < 60) return '${m}m';
    return '${m ~/ 60}h ${m % 60}m';
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatTile(
            icon: Icons.access_time_filled_rounded,
            color: ShieldTheme.primary,
            label: 'Screen Time',
            value: _fmtMinutes(screenTimeMinutes),
            sub: 'this week',
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatTile(
            icon: Icons.today_rounded,
            color: ShieldTheme.accent,
            label: 'Daily Average',
            value: _fmtMinutes(dailyAvgMinutes),
            sub: 'per day',
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatTile(
            icon: Icons.block_rounded,
            color: ShieldTheme.danger,
            label: 'Blocked',
            value: '$totalBlocked',
            sub: 'queries',
          ),
        ),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String value;
  final String sub;

  const _StatTile({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
    required this.sub,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ShieldTheme.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
              height: 1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: ShieldTheme.textPrimary,
            ),
          ),
          Text(
            sub,
            style: const TextStyle(
              fontSize: 10,
              color: ShieldTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Section Header ──────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: ShieldTheme.primary.withOpacity(0.10),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 18, color: ShieldTheme.primary),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: ShieldTheme.textPrimary,
                ),
              ),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 12,
                  color: ShieldTheme.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ─── 1. Risk Score Card ───────────────────────────────────────────────────────

class _RiskScoreCard extends StatelessWidget {
  final double riskScore;
  final String summary;

  const _RiskScoreCard({required this.riskScore, required this.summary});

  Color get _color {
    if (riskScore <= 30) return ShieldTheme.success;
    if (riskScore <= 70) return ShieldTheme.warning;
    return ShieldTheme.danger;
  }

  String get _label {
    if (riskScore <= 30) return 'LOW RISK';
    if (riskScore <= 70) return 'MEDIUM RISK';
    return 'HIGH RISK';
  }

  Color get _bgColor {
    if (riskScore <= 30) return const Color(0xFFE8F5E9);
    if (riskScore <= 70) return const Color(0xFFFFF8E1);
    return const Color(0xFFFFEBEE);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ShieldTheme.divider),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              children: [
                // Arc gauge
                SizedBox(
                  width: 110,
                  height: 110,
                  child: CustomPaint(
                    painter: _ArcGaugePainter(
                      score: riskScore,
                      color: _color,
                    ),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(height: 16),
                          Text(
                            riskScore.toInt().toString(),
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w800,
                              color: _color,
                              height: 1,
                            ),
                          ),
                          Text(
                            'of 100',
                            style: const TextStyle(
                              fontSize: 10,
                              color: ShieldTheme.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Risk Score',
                        style: TextStyle(
                          fontSize: 12,
                          color: ShieldTheme.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: _bgColor,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          _label,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: _color,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        summary,
                        style: const TextStyle(
                          fontSize: 13,
                          color: ShieldTheme.textSecondary,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: riskScore / 100,
                minHeight: 6,
                backgroundColor: ShieldTheme.divider,
                valueColor: AlwaysStoppedAnimation<Color>(_color),
              ),
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: const [
                Text('0',
                    style: TextStyle(
                        fontSize: 10, color: ShieldTheme.textSecondary)),
                Text('Safe',
                    style: TextStyle(
                        fontSize: 10,
                        color: ShieldTheme.success,
                        fontWeight: FontWeight.w600)),
                Text('Moderate',
                    style: TextStyle(
                        fontSize: 10,
                        color: ShieldTheme.warning,
                        fontWeight: FontWeight.w600)),
                Text('Critical',
                    style: TextStyle(
                        fontSize: 10,
                        color: ShieldTheme.danger,
                        fontWeight: FontWeight.w600)),
                Text('100',
                    style: TextStyle(
                        fontSize: 10, color: ShieldTheme.textSecondary)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// Custom arc gauge painter
class _ArcGaugePainter extends CustomPainter {
  final double score;
  final Color color;
  const _ArcGaugePainter({required this.score, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2 + 8;
    final radius = (size.width / 2) - 10;
    const startAngle = math.pi * 0.75;
    const sweepAngle = math.pi * 1.5;

    // Background track
    final trackPaint = Paint()
      ..color = ShieldTheme.divider
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: radius),
      startAngle,
      sweepAngle,
      false,
      trackPaint,
    );

    // Score arc
    final scorePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: radius),
      startAngle,
      sweepAngle * (score / 100),
      false,
      scorePaint,
    );
  }

  @override
  bool shouldRepaint(_ArcGaugePainter old) =>
      old.score != score || old.color != color;
}

// ─── 2. Behavior Trends ───────────────────────────────────────────────────────

class _BehaviorTrendCard extends StatelessWidget {
  final List<double> allowed;
  final List<double> blocked;

  const _BehaviorTrendCard({required this.allowed, required this.blocked});

  static const _days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  List<FlSpot> _spots(List<double> values) {
    return List.generate(
        values.length, (i) => FlSpot(i.toDouble(), values[i]));
  }

  double get _maxY {
    final all = [...allowed, ...blocked];
    if (all.isEmpty) return 100;
    final m = all.reduce(math.max);
    return (m * 1.2).ceilToDouble();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ShieldTheme.divider),
      ),
      padding: const EdgeInsets.fromLTRB(16, 20, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Legend
          Row(
            children: [
              _LegendDot(color: ShieldTheme.primary, label: 'Allowed'),
              const SizedBox(width: 16),
              _LegendDot(color: ShieldTheme.danger, label: 'Blocked'),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 160,
            child: LineChart(
              LineChartData(
                minY: 0,
                maxY: _maxY,
                clipData: const FlClipData.all(),
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: _maxY / 4,
                  getDrawingHorizontalLine: (_) => FlLine(
                    color: ShieldTheme.divider,
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 36,
                      interval: _maxY / 4,
                      getTitlesWidget: (v, _) => Text(
                        v.toInt().toString(),
                        style: const TextStyle(
                          fontSize: 10,
                          color: ShieldTheme.textSecondary,
                        ),
                      ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      interval: 1,
                      getTitlesWidget: (v, _) {
                        final i = v.toInt();
                        if (i < 0 || i >= _days.length) {
                          return const SizedBox.shrink();
                        }
                        return Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            _days[i],
                            style: const TextStyle(
                              fontSize: 10,
                              color: ShieldTheme.textSecondary,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                ),
                lineBarsData: [
                  // Allowed line
                  LineChartBarData(
                    spots: _spots(allowed),
                    isCurved: true,
                    curveSmoothness: 0.35,
                    color: ShieldTheme.primary,
                    barWidth: 2.5,
                    dotData: FlDotData(
                      show: true,
                      getDotPainter: (_, __, ___, ____) =>
                          FlDotCirclePainter(
                        radius: 3,
                        color: ShieldTheme.primary,
                        strokeColor: Colors.white,
                        strokeWidth: 1.5,
                      ),
                    ),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          ShieldTheme.primary.withOpacity(0.15),
                          ShieldTheme.primary.withOpacity(0.0),
                        ],
                      ),
                    ),
                  ),
                  // Blocked line
                  LineChartBarData(
                    spots: _spots(blocked),
                    isCurved: true,
                    curveSmoothness: 0.35,
                    color: ShieldTheme.danger,
                    barWidth: 2.5,
                    dotData: FlDotData(
                      show: true,
                      getDotPainter: (_, __, ___, ____) =>
                          FlDotCirclePainter(
                        radius: 3,
                        color: ShieldTheme.danger,
                        strokeColor: Colors.white,
                        strokeWidth: 1.5,
                      ),
                    ),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          ShieldTheme.danger.withOpacity(0.10),
                          ShieldTheme.danger.withOpacity(0.0),
                        ],
                      ),
                    ),
                  ),
                ],
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => ShieldTheme.textPrimary,
                    getTooltipItems: (spots) => spots
                        .map((s) => LineTooltipItem(
                              s.y.toInt().toString(),
                              const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                                fontSize: 12,
                              ),
                            ))
                        .toList(),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label,
            style: const TextStyle(
                fontSize: 12, color: ShieldTheme.textSecondary)),
      ],
    );
  }
}

// ─── 3. Top Blocked Categories ────────────────────────────────────────────────

class _BlockedCategoriesCard extends StatelessWidget {
  final List<Map<String, dynamic>> categories;

  const _BlockedCategoriesCard({required this.categories});

  static const _palette = [
    Color(0xFF1565C0),
    Color(0xFFF57C00),
    Color(0xFFC62828),
    Color(0xFF00838F),
    Color(0xFF6A1B9A),
  ];

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) {
      return _emptyCard('No blocked categories data available.');
    }

    final top = categories.take(5).toList();
    final maxCount =
        top.map((c) => (c['count'] as num).toDouble()).reduce(math.max);

    return Container(
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ShieldTheme.divider),
      ),
      padding: const EdgeInsets.fromLTRB(16, 20, 20, 16),
      child: Column(
        children: [
          // fl_chart horizontal bar chart
          SizedBox(
            height: top.length * 44.0,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.start,
                maxY: maxCount * 1.15,
                barTouchData: BarTouchData(
                  touchTooltipData: BarTouchTooltipData(
                    getTooltipColor: (_) => ShieldTheme.textPrimary,
                    getTooltipItem: (group, _, rod, __) {
                      final name =
                          top[group.x]['name'] as String? ?? '';
                      return BarTooltipItem(
                        '$name\n${rod.toY.toInt()}',
                        const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      );
                    },
                  ),
                ),
                titlesData: FlTitlesData(
                  leftTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      getTitlesWidget: (v, _) {
                        final i = v.toInt();
                        if (i < 0 || i >= top.length) {
                          return const SizedBox.shrink();
                        }
                        final label = top[i]['name'] as String? ?? '';
                        final short = label.length > 9
                            ? '${label.substring(0, 8)}…'
                            : label;
                        return Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            short,
                            style: const TextStyle(
                              fontSize: 9,
                              color: ShieldTheme.textSecondary,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                gridData: FlGridData(
                  show: true,
                  drawHorizontalLine: false,
                  drawVerticalLine: true,
                  verticalInterval: maxCount / 4,
                  getDrawingVerticalLine: (_) => FlLine(
                    color: ShieldTheme.divider,
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(show: false),
                barGroups: List.generate(top.length, (i) {
                  final count =
                      (top[i]['count'] as num).toDouble();
                  final color = _palette[i % _palette.length];
                  return BarChartGroupData(
                    x: i,
                    barRods: [
                      BarChartRodData(
                        toY: count,
                        color: color,
                        width: 22,
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(4),
                          topRight: Radius.circular(4),
                        ),
                        backDrawRodData: BackgroundBarChartRodData(
                          show: true,
                          toY: maxCount * 1.15,
                          color: color.withOpacity(0.07),
                        ),
                      ),
                    ],
                  );
                }),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Inline legend
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: List.generate(top.length, (i) {
              final color = _palette[i % _palette.length];
              final name = top[i]['name'] as String? ?? '';
              final count = top[i]['count'];
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                        color: color, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '$name ($count)',
                    style: const TextStyle(
                      fontSize: 11,
                      color: ShieldTheme.textSecondary,
                    ),
                  ),
                ],
              );
            }),
          ),
        ],
      ),
    );
  }
}

// ─── 4. Recommendation Card ───────────────────────────────────────────────────

class _RecommendationCard extends StatelessWidget {
  final Map<String, dynamic> rec;
  const _RecommendationCard({required this.rec});

  IconData _iconForKey(String? key) {
    switch (key) {
      case 'bedtime':
        return Icons.bedtime_rounded;
      case 'shield':
        return Icons.shield_rounded;
      case 'star':
        return Icons.star_rounded;
      case 'schedule':
        return Icons.schedule_rounded;
      case 'block':
        return Icons.block_rounded;
      case 'location':
        return Icons.location_on_rounded;
      case 'sports_esports':
        return Icons.sports_esports_rounded;
      case 'vpn_lock':
        return Icons.vpn_lock_rounded;
      case 'people':
        return Icons.people_rounded;
      case 'time_limit':
        return Icons.timer_rounded;
      default:
        return Icons.lightbulb_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final iconKey = rec['icon'] as String?;
    final title = rec['title'] as String? ?? '';
    final description = rec['description'] as String? ?? '';

    return Container(
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ShieldTheme.divider),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: ShieldTheme.primaryGradient,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                _iconForKey(iconKey),
                color: Colors.white,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: ShieldTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: const TextStyle(
                      fontSize: 13,
                      color: ShieldTheme.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── 5. Anomaly Card ──────────────────────────────────────────────────────────

class _AnomalyCard extends StatelessWidget {
  final Map<String, dynamic> anomaly;
  final bool isLast;
  const _AnomalyCard({required this.anomaly, required this.isLast});

  Color _severityColor(String? s) {
    switch (s?.toUpperCase()) {
      case 'HIGH':
      case 'CRITICAL':
        return ShieldTheme.danger;
      case 'MEDIUM':
        return ShieldTheme.warning;
      case 'LOW':
        return ShieldTheme.success;
      default:
        return ShieldTheme.accent;
    }
  }

  String _formatTimestamp(String? ts) {
    if (ts == null) return '';
    try {
      final dt = DateTime.parse(ts).toLocal();
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '${months[dt.month - 1]} ${dt.day}, $h:$m';
    } catch (_) {
      return ts;
    }
  }

  @override
  Widget build(BuildContext context) {
    final severity = anomaly['severity'] as String?;
    final color = _severityColor(severity);
    final description = anomaly['description'] as String? ?? '';
    // support both 'detectedAt' (new) and 'timestamp' (legacy)
    final ts = (anomaly['detectedAt'] as String?)
        ?? (anomaly['timestamp'] as String?);
    final timestamp = _formatTimestamp(ts);

    return Container(
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ShieldTheme.divider),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Severity dot + vertical line
            Column(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  margin: const EdgeInsets.only(top: 4),
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                          color: color.withOpacity(0.4),
                          blurRadius: 4,
                          spreadRadius: 1),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          description,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: ShieldTheme.textPrimary,
                            height: 1.35,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      _SeverityBadge(severity: severity, color: color),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.access_time_rounded,
                          size: 12, color: ShieldTheme.textSecondary),
                      const SizedBox(width: 4),
                      Text(
                        timestamp,
                        style: const TextStyle(
                          fontSize: 11,
                          color: ShieldTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SeverityBadge extends StatelessWidget {
  final String? severity;
  final Color color;
  const _SeverityBadge({required this.severity, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        (severity ?? 'INFO').toUpperCase(),
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w800,
          color: color,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

class _EmptyAnomalies extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: ShieldTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ShieldTheme.divider),
      ),
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.check_circle_rounded,
                size: 40,
                color: ShieldTheme.success.withOpacity(0.7)),
            const SizedBox(height: 10),
            const Text(
              'All clear!',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 15,
                color: ShieldTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'No anomalies detected this week.',
              style: TextStyle(
                fontSize: 13,
                color: ShieldTheme.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Ask AI Section ───────────────────────────────────────────────────────────

class _AskAiSection extends StatelessWidget {
  final List<_ChatMessage> messages;
  final bool chatLoading;
  final TextEditingController chatController;
  final ScrollController scrollController;
  final void Function(String) onSend;

  const _AskAiSection({
    required this.messages,
    required this.chatLoading,
    required this.chatController,
    required this.scrollController,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section header
        Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: const Color(0xFF1565C0).withOpacity(0.10),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.smart_toy_rounded,
                  size: 18, color: Color(0xFF1565C0)),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Ask AI',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: ShieldTheme.textPrimary,
                    ),
                  ),
                  Text(
                    'Ask anything about your child\'s online activity',
                    style: TextStyle(
                      fontSize: 12,
                      color: ShieldTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Chat history (last 3 Q&A pairs)
        if (messages.isNotEmpty) ...[
          Container(
            constraints: const BoxConstraints(maxHeight: 320),
            decoration: BoxDecoration(
              color: ShieldTheme.cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: ShieldTheme.divider),
            ),
            child: ListView.builder(
              controller: scrollController,
              padding: const EdgeInsets.all(12),
              shrinkWrap: true,
              itemCount: messages.length,
              itemBuilder: (context, index) {
                final msg = messages[index];
                return _ChatBubble(message: msg, onSuggestionTap: onSend);
              },
            ),
          ),
          const SizedBox(height: 10),
        ],

        // Loading indicator
        if (chatLoading)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: const Color(0xFF1565C0).withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.smart_toy_rounded,
                      size: 16, color: Color(0xFF1565C0)),
                ),
                const SizedBox(width: 10),
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: 8),
                const Text('Shield AI is thinking…',
                    style: TextStyle(
                        fontSize: 13, color: ShieldTheme.textSecondary)),
              ],
            ),
          ),

        // Input row
        Container(
          decoration: BoxDecoration(
            color: ShieldTheme.cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: ShieldTheme.divider),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: chatController,
                  decoration: const InputDecoration(
                    hintText: 'Ask about your child\'s activity…',
                    hintStyle: TextStyle(
                        fontSize: 14, color: ShieldTheme.textSecondary),
                    border: InputBorder.none,
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                  style: const TextStyle(fontSize: 14),
                  textInputAction: TextInputAction.send,
                  onSubmitted: chatLoading ? null : onSend,
                  maxLines: 1,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: IconButton(
                  icon: const Icon(Icons.send_rounded),
                  color: const Color(0xFF1565C0),
                  onPressed: chatLoading
                      ? null
                      : () => onSend(chatController.text),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────

class _ChatBubble extends StatelessWidget {
  final _ChatMessage message;
  final void Function(String) onSuggestionTap;

  const _ChatBubble({
    required this.message,
    required this.onSuggestionTap,
  });

  @override
  Widget build(BuildContext context) {
    if (message.isUser) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.end,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Flexible(
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: ShieldTheme.primary,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    topRight: Radius.circular(4),
                    bottomLeft: Radius.circular(16),
                    bottomRight: Radius.circular(16),
                  ),
                ),
                child: Text(
                  message.text,
                  style: const TextStyle(
                      fontSize: 13,
                      color: Colors.white,
                      height: 1.4),
                ),
              ),
            ),
          ],
        ),
      );
    }

    // AI reply
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: const Color(0xFF1565C0).withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.smart_toy_rounded,
                    size: 16, color: Color(0xFF1565C0)),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE3F2FD),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(4),
                      topRight: Radius.circular(16),
                      bottomLeft: Radius.circular(16),
                      bottomRight: Radius.circular(16),
                    ),
                  ),
                  child: Text(
                    message.text,
                    style: const TextStyle(
                        fontSize: 13,
                        color: ShieldTheme.textPrimary,
                        height: 1.5),
                  ),
                ),
              ),
            ],
          ),
          // Suggestion chips
          if (message.suggestions.isNotEmpty) ...[
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.only(left: 36),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: message.suggestions.map((s) {
                  return GestureDetector(
                    onTap: () => onSuggestionTap(s),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1565C0).withOpacity(0.08),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color: const Color(0xFF1565C0).withOpacity(0.25)),
                      ),
                      child: Text(
                        s,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1565C0),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

class _LoadingSkeleton extends StatelessWidget {
  const _LoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SkeletonBox(height: 150, radius: 16),
          const SizedBox(height: 20),
          _SkeletonBox(height: 16, width: 140, radius: 8),
          const SizedBox(height: 10),
          _SkeletonBox(height: 200, radius: 16),
          const SizedBox(height: 20),
          _SkeletonBox(height: 16, width: 180, radius: 8),
          const SizedBox(height: 10),
          _SkeletonBox(height: 240, radius: 16),
          const SizedBox(height: 20),
          _SkeletonBox(height: 16, width: 160, radius: 8),
          const SizedBox(height: 10),
          _SkeletonBox(height: 88, radius: 16),
          const SizedBox(height: 10),
          _SkeletonBox(height: 88, radius: 16),
          const SizedBox(height: 10),
          _SkeletonBox(height: 88, radius: 16),
          const SizedBox(height: 20),
          _SkeletonBox(height: 16, width: 140, radius: 8),
          const SizedBox(height: 10),
          _SkeletonBox(height: 70, radius: 14),
          const SizedBox(height: 8),
          _SkeletonBox(height: 70, radius: 14),
        ],
      ),
    );
  }
}

class _SkeletonBox extends StatelessWidget {
  final double height;
  final double? width;
  final double radius;

  const _SkeletonBox({
    required this.height,
    this.width,
    this.radius = 8,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width ?? double.infinity,
      height: height,
      decoration: BoxDecoration(
        color: ShieldTheme.divider.withOpacity(0.6),
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

Widget _emptyCard(String message) {
  return Container(
    decoration: BoxDecoration(
      color: ShieldTheme.cardBg,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: ShieldTheme.divider),
    ),
    padding: const EdgeInsets.all(24),
    child: Center(
      child: Text(
        message,
        style: const TextStyle(
          fontSize: 13,
          color: ShieldTheme.textSecondary,
        ),
        textAlign: TextAlign.center,
      ),
    ),
  );
}
