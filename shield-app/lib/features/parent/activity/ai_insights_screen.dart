import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../app/theme.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/endpoints.dart';
import '../../../core/widgets/common_widgets.dart';

final _insightsProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, pid) async {
  final resp = await ApiClient.instance.get(Endpoints.aiInsights(pid));
  final raw = resp.data as Map<String, dynamic>? ?? {};
  return (raw['data'] as Map<String, dynamic>?) ?? raw;
});

class AiInsightsScreen extends ConsumerWidget {
  const AiInsightsScreen({super.key, required this.profileId});
  final String profileId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final insights = ref.watch(_insightsProvider(profileId));

    return Scaffold(
      backgroundColor: Ds.surface,
      appBar: AppBar(
        title: Text('AI Insights',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
      ),
      body: insights.when(
        loading: () => const _InsightsSkeleton(),
        error:   (e, _) => ErrorView(
          message: 'AI insights not available',
          onRetry: () => ref.invalidate(_insightsProvider(profileId)),
        ),
        data: (d) => _InsightsBody(data: d),
      ),
    );
  }
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

class _InsightsSkeleton extends StatefulWidget {
  const _InsightsSkeleton();
  @override
  State<_InsightsSkeleton> createState() => _InsightsSkeletonState();
}

class _InsightsSkeletonState extends State<_InsightsSkeleton>
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

  Widget _bone({double height = 16, double? width, double radius = 8}) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Container(
        height: height,
        width:  width,
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
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      children: [
        // Hero card skeleton
        Container(
          height: 120,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: Ds.surfaceContainer,
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _bone(height: 12, width: 80),
              const SizedBox(height: 12),
              _bone(height: 14),
              const SizedBox(height: 8),
              _bone(height: 14, width: 200),
            ],
          ),
        ),
        const SizedBox(height: 20),
        // Risk card skeleton
        _bone(height: 14, width: 120),
        const SizedBox(height: 8),
        Container(
          height: 72,
          decoration: BoxDecoration(
            color: Ds.surfaceContainer,
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            _bone(height: 40, width: 40, radius: 10),
            const SizedBox(width: 14),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _bone(height: 14, width: 60),
                const SizedBox(height: 8),
                _bone(height: 12),
              ],
            )),
          ]),
        ),
        const SizedBox(height: 20),
        // Recommendations skeleton
        _bone(height: 14, width: 140),
        const SizedBox(height: 8),
        ...List.generate(3, (_) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: _bone(height: 60, radius: 12),
        )),
      ],
    );
  }
}

class _InsightsBody extends StatelessWidget {
  const _InsightsBody({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final riskLevel = data['riskLevel']?.toString() ?? 'LOW';
    final summary   = data['summary']?.toString()
        ?? 'No insights available for this period.';
    final recommendations = data['recommendations'] as List? ?? [];
    final anomalies       = data['anomalies'] as List? ?? [];

    return ListView(children: [

      // ── AI Summary hero card ─────────────────────────────────────────────────
      Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF003D72), Ds.primary],
              begin: Alignment.topLeft,
              end:   Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color:      Ds.primary.withOpacity(0.25),
                blurRadius: 24,
                spreadRadius: -4,
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color:        Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.psychology_rounded,
                      color: Colors.white, size: 16),
                ),
                const SizedBox(width: 8),
                Text('AI Summary',
                    style: GoogleFonts.inter(
                        color: Colors.white.withOpacity(0.75),
                        fontSize: 12, fontWeight: FontWeight.w600,
                        letterSpacing: 0.3)),
              ]),
              const SizedBox(height: 12),
              Text(summary,
                  style: GoogleFonts.inter(
                      color: Colors.white, fontSize: 14, height: 1.6)),
            ]),
          ),
        ),
      ),

      // ── Risk assessment ──────────────────────────────────────────────────────
      const SectionHeader('Risk Assessment'),
      GuardianCard(
        padding: const EdgeInsets.all(20),
        child: _RiskRow(level: riskLevel),
      ),

      // ── Recommendations ──────────────────────────────────────────────────────
      if (recommendations.isNotEmpty) ...[
        SectionHeader('Recommendations',
            trailing: StatusChip('${recommendations.length}',
                color: Ds.primary)),
        ...recommendations.asMap().entries.map((entry) {
          final i   = entry.key;
          final rec = entry.value.toString();
          return GuardianCard(
            padding: const EdgeInsets.all(16),
            margin:  const EdgeInsets.fromLTRB(24, 0, 24, 8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color:        Ds.warning.withOpacity(0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.lightbulb_outline_rounded,
                    color: Ds.warning, size: 16),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(rec,
                  style: GoogleFonts.inter(
                      fontSize: 13, height: 1.5, color: cs.onSurface))),
            ]),
          );
        }),
      ],

      // ── Anomalies ────────────────────────────────────────────────────────────
      if (anomalies.isNotEmpty) ...[
        SectionHeader('Unusual Activity',
            trailing: StatusChip('${anomalies.length}', color: Ds.danger)),
        ...anomalies.map((a) {
          final item = a as Map<String, dynamic>;
          final desc = item['description']?.toString() ?? '';
          final detectedAt = item['detectedAt'] != null
              ? DateFormat('d MMM, HH:mm').format(
                  DateTime.parse(item['detectedAt'].toString()).toLocal())
              : null;
          return GuardianCard(
            padding: const EdgeInsets.all(16),
            margin:  const EdgeInsets.fromLTRB(24, 0, 24, 8),
            color:   Ds.dangerContainer,
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color:        Ds.danger.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.warning_amber_rounded,
                    color: Ds.danger, size: 16),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(desc,
                      style: GoogleFonts.inter(
                          fontSize: 13, height: 1.5,
                          color: cs.onSurface, fontWeight: FontWeight.w500)),
                  if (detectedAt != null) ...[
                    const SizedBox(height: 4),
                    Text(detectedAt,
                        style: GoogleFonts.inter(
                            fontSize: 11, color: cs.onSurfaceVariant)),
                  ],
                ],
              )),
            ]),
          );
        }),
      ],

      const SizedBox(height: 32),
    ]);
  }
}

// ── Risk row ──────────────────────────────────────────────────────────────────

class _RiskRow extends StatelessWidget {
  const _RiskRow({required this.level});
  final String level;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final (Color color, IconData icon, String desc) = switch (level.toUpperCase()) {
      'HIGH'   => (Ds.danger,  Icons.dangerous_rounded,
                   'High risk activity detected. Review alerts immediately.'),
      'MEDIUM' => (Ds.warning, Icons.warning_rounded,
                   'Some concerning patterns detected. Review when possible.'),
      _        => (Ds.success, Icons.check_circle_rounded,
                   'Everything looks normal. No concerning patterns detected.'),
    };

    return Row(children: [
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color:        color.withOpacity(0.10),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: color, size: 24),
      ),
      const SizedBox(width: 14),
      Expanded(child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(level.toUpperCase(),
              style: GoogleFonts.manrope(
                  fontWeight: FontWeight.w700, fontSize: 15, color: color)),
          const SizedBox(height: 4),
          Text(desc,
              style: GoogleFonts.inter(
                  fontSize: 12, color: cs.onSurfaceVariant, height: 1.4)),
        ],
      )),
      StatusChip(level, color: color),
    ]);
  }
}
