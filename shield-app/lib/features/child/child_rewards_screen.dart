import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../app/theme.dart';
import '../../core/shield_widgets.dart';

class ChildRewardsScreen extends ConsumerStatefulWidget {
  const ChildRewardsScreen({super.key});
  @override
  ConsumerState<ChildRewardsScreen> createState() => _ChildRewardsScreenState();
}

class _ChildRewardsScreenState extends ConsumerState<ChildRewardsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  Map<String, dynamic>? _bank;
  List<Map<String, dynamic>> _transactions = [];
  bool _loadingBank = true;
  bool _loadingTx = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadAll();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    await Future.wait([_loadBank(), _loadTransactions()]);
  }

  Future<void> _loadBank() async {
    setState(() => _loadingBank = true);
    try {
      final client = ref.read(dioProvider);
      final auth = ref.read(authProvider);
      final profileId = auth.childProfileId ?? '';
      final res = await client.get('/rewards/bank/$profileId');
      final data = res.data['data'] as Map? ?? res.data as Map? ?? {};
      _bank = Map<String, dynamic>.from(data);
    } catch (_) {
      _bank = null;
    }
    if (mounted) setState(() => _loadingBank = false);
  }

  Future<void> _loadTransactions() async {
    setState(() => _loadingTx = true);
    try {
      final client = ref.read(dioProvider);
      final auth = ref.read(authProvider);
      final profileId = auth.childProfileId ?? '';
      final res = await client.get('/rewards/transactions/$profileId');
      _transactions = ((res.data['data'] as List?) ?? (res.data as List? ?? []))
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    } catch (_) {
      _transactions = [];
    }
    if (mounted) setState(() => _loadingTx = false);
  }

  Future<void> _requestRedeem(int minutes) async {
    final auth = ref.read(authProvider);
    final profileId = auth.childProfileId ?? '';
    final bank = _bank;
    if (bank == null) return;
    final currentPoints = bank['pointsBalance'] as int? ?? 0;
    final currentMins = bank['minutesBalance'] as int? ?? 0;

    // Cost: 10 points per 5 minutes of screen time
    final pointCost = (minutes ~/ 5) * 10;
    if (currentPoints < pointCost) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Need $pointCost points — you have $currentPoints'),
          backgroundColor: ShieldTheme.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
      }
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(children: [
          Icon(Icons.redeem_rounded, color: ShieldTheme.primary),
          const SizedBox(width: 8),
          const Text('Redeem Reward', style: TextStyle(fontWeight: FontWeight.w800)),
        ]),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Redeem $minutes minutes of extra screen time?',
                style: const TextStyle(fontSize: 15)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: ShieldTheme.primary.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                Icon(Icons.stars_rounded, color: ShieldTheme.primary, size: 20),
                const SizedBox(width: 8),
                Text('Cost: $pointCost points',
                    style: TextStyle(
                        fontWeight: FontWeight.w700, color: ShieldTheme.primary)),
                const Spacer(),
                Text('Balance: $currentPoints pts',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ]),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: ShieldTheme.primary),
            child: const Text('Redeem'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    // Optimistic update
    setState(() {
      _bank = {
        ..._bank!,
        'pointsBalance': currentPoints - pointCost,
        'minutesBalance': currentMins + minutes,
      };
    });

    try {
      final client = ref.read(dioProvider);
      await client.post('/rewards/bank/$profileId/redeem', data: {
        'points': pointCost,
        'minutes': minutes,
        'description': 'Redeemed $minutes min screen time',
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Row(children: [
            const Icon(Icons.celebration_rounded, color: Colors.white),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Redeemed! $minutes minutes of screen time added',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ]),
          backgroundColor: ShieldTheme.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 3),
        ));
        _loadAll();
      }
    } catch (e) {
      // Revert on failure
      if (mounted) {
        setState(() {
          _bank = {
            ..._bank!,
            'pointsBalance': currentPoints,
            'minutesBalance': currentMins,
          };
        });
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Redemption failed. Please try again.'),
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
      backgroundColor: ShieldTheme.primary.withOpacity(0.06),
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) => [
          SliverAppBar(
            expandedHeight: 200,
            floating: false,
            pinned: true,
            backgroundColor: ShieldTheme.primary,
            foregroundColor: Colors.white,
            title: const Text('My Rewards', style: TextStyle(fontWeight: FontWeight.w700)),
            flexibleSpace: FlexibleSpaceBar(
              background: _loadingBank
                  ? const Center(child: CircularProgressIndicator(color: Colors.white))
                  : _BankHeader(bank: _bank),
            ),
            bottom: TabBar(
              controller: _tabController,
              indicatorColor: Colors.white,
              indicatorWeight: 3,
              labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
              unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white60,
              tabs: const [
                Tab(text: 'Redeem'),
                Tab(text: 'History'),
              ],
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabController,
          children: [
            _RedeemTab(bank: _bank, onRedeem: _requestRedeem),
            _HistoryTab(transactions: _transactions, loading: _loadingTx),
          ],
        ),
      ),
    );
  }
}

// ── Bank Header ───────────────────────────────────────────────────────────────

class _BankHeader extends StatelessWidget {
  final Map<String, dynamic>? bank;
  const _BankHeader({this.bank});

  @override
  Widget build(BuildContext context) {
    final points = bank?['pointsBalance'] as int? ?? 0;
    final minutes = bank?['minutesBalance'] as int? ?? 0;
    final streak = bank?['streakDays'] as int? ?? 0;
    final totalEarned = bank?['totalEarnedPoints'] as int? ?? 0;

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [ShieldTheme.primary, ShieldTheme.primaryDark, Color(0xFF1A237E)],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 56, 20, 60),
          child: bank == null
              ? const Center(
                  child: Text('Could not load balance',
                      style: TextStyle(color: Colors.white60, fontSize: 14)),
                )
              : FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _HeaderStat(
                        icon: Icons.stars_rounded,
                        value: '$points',
                        label: 'Points',
                        iconColor: Colors.amber.shade300,
                      ),
                      _VertDivider(),
                      _HeaderStat(
                        icon: Icons.timer_rounded,
                        value: '${minutes}m',
                        label: 'Screen Time',
                        iconColor: Colors.lightBlue.shade200,
                      ),
                      _VertDivider(),
                      _HeaderStat(
                        icon: Icons.local_fire_department_rounded,
                        value: '$streak',
                        label: 'Day Streak',
                        iconColor: Colors.orange.shade300,
                      ),
                      _VertDivider(),
                      _HeaderStat(
                        icon: Icons.emoji_events_rounded,
                        value: '$totalEarned',
                        label: 'Total Earned',
                        iconColor: Colors.green.shade300,
                      ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }
}

class _HeaderStat extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color iconColor;
  const _HeaderStat(
      {required this.icon,
      required this.value,
      required this.label,
      required this.iconColor});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: iconColor, size: 22),
        ),
        const SizedBox(height: 6),
        Text(value,
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
        Text(label,
            style: TextStyle(
                color: Colors.white.withOpacity(0.7),
                fontSize: 10,
                fontWeight: FontWeight.w500)),
      ],
    );
  }
}

class _VertDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 50,
      color: Colors.white.withOpacity(0.2),
    );
  }
}

// ── Redeem Tab ────────────────────────────────────────────────────────────────

class _RedeemTab extends StatelessWidget {
  final Map<String, dynamic>? bank;
  final Future<void> Function(int minutes) onRedeem;

  const _RedeemTab({this.bank, required this.onRedeem});

  @override
  Widget build(BuildContext context) {
    final points = bank?['pointsBalance'] as int? ?? 0;

    // Reward catalog: screen time rewards (10 pts per 5 min)
    final rewards = [
      _RewardItem(
        name: '5 min Screen Time',
        description: 'Add 5 minutes of extra screen time today',
        icon: Icons.phone_android_rounded,
        pointCost: 10,
        minutes: 5,
        color: ShieldTheme.primary,
      ),
      _RewardItem(
        name: '15 min Screen Time',
        description: 'Add 15 minutes of extra screen time today',
        icon: Icons.timer_rounded,
        pointCost: 30,
        minutes: 15,
        color: ShieldTheme.primaryLight,
      ),
      _RewardItem(
        name: '30 min Screen Time',
        description: 'A half-hour of extra time — great for finishing a game!',
        icon: Icons.videogame_asset_rounded,
        pointCost: 60,
        minutes: 30,
        color: ShieldTheme.primaryLight,
      ),
      _RewardItem(
        name: '1 Hour Screen Time',
        description: 'A full hour of bonus screen time',
        icon: Icons.sports_esports_rounded,
        pointCost: 120,
        minutes: 60,
        color: ShieldTheme.primaryDark,
      ),
      _RewardItem(
        name: '2 Hours Screen Time',
        description: 'Two hours — save up for the big one!',
        icon: Icons.emoji_events_rounded,
        pointCost: 240,
        minutes: 120,
        color: ShieldTheme.warning,
      ),
    ];

    return RefreshIndicator(
      onRefresh: () async {},
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Points info banner
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: ShieldTheme.warning.withOpacity(0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: ShieldTheme.warning.withOpacity(0.3)),
            ),
            child: Row(children: [
              Icon(Icons.info_outline_rounded, color: ShieldTheme.warning, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Earn points by completing tasks. Each 10 points = 5 minutes of screen time.',
                  style: TextStyle(
                      fontSize: 13,
                      color: ShieldTheme.warning,
                      fontWeight: FontWeight.w500),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 16),

          const Text('Available Rewards',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 10),

          ...rewards.map((r) => _RewardCard(
                reward: r,
                currentPoints: points,
                onRedeem: () => onRedeem(r.minutes),
              )),
        ],
      ),
    );
  }
}

class _RewardItem {
  final String name;
  final String description;
  final IconData icon;
  final int pointCost;
  final int minutes;
  final Color color;
  const _RewardItem({
    required this.name,
    required this.description,
    required this.icon,
    required this.pointCost,
    required this.minutes,
    required this.color,
  });
}

class _RewardCard extends StatelessWidget {
  final _RewardItem reward;
  final int currentPoints;
  final VoidCallback onRedeem;

  const _RewardCard(
      {required this.reward,
      required this.currentPoints,
      required this.onRedeem});

  @override
  Widget build(BuildContext context) {
    final canAfford = currentPoints >= reward.pointCost;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          )
        ],
        border: canAfford
            ? Border.all(color: reward.color.withOpacity(0.3), width: 1.5)
            : null,
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: canAfford
                    ? reward.color.withOpacity(0.12)
                    : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(reward.icon,
                  color: canAfford ? reward.color : Colors.grey.shade400,
                  size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(reward.name,
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: canAfford
                              ? ShieldTheme.textPrimary
                              : Colors.grey.shade500)),
                  const SizedBox(height: 3),
                  Text(reward.description,
                      style: TextStyle(
                          fontSize: 12, color: Colors.grey.shade500)),
                  const SizedBox(height: 8),
                  Row(children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: canAfford
                            ? ShieldTheme.warning.withOpacity(0.12)
                            : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.stars_rounded,
                                size: 13,
                                color: canAfford
                                    ? ShieldTheme.warning
                                    : Colors.grey.shade400),
                            const SizedBox(width: 3),
                            Text('${reward.pointCost} pts',
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: canAfford
                                        ? ShieldTheme.warning
                                        : Colors.grey.shade500)),
                          ]),
                    ),
                    if (!canAfford) ...[
                      const SizedBox(width: 8),
                      Text(
                          'Need ${reward.pointCost - currentPoints} more pts',
                          style: TextStyle(
                              fontSize: 11, color: ShieldTheme.dangerLight)),
                    ],
                  ]),
                ],
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(
              width: 80,
              child: FilledButton(
                onPressed: canAfford ? onRedeem : null,
                style: FilledButton.styleFrom(
                  backgroundColor: canAfford ? reward.color : Colors.grey.shade200,
                  foregroundColor: canAfford ? Colors.white : Colors.grey.shade400,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  minimumSize: const Size(70, 38),
                ),
                child: const Text('Redeem',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── History Tab ───────────────────────────────────────────────────────────────

class _HistoryTab extends StatelessWidget {
  final List<Map<String, dynamic>> transactions;
  final bool loading;
  const _HistoryTab({required this.transactions, required this.loading});

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          ShieldCardSkeleton(lines: 2),
          SizedBox(height: 10),
          ShieldCardSkeleton(lines: 2),
          SizedBox(height: 10),
          ShieldCardSkeleton(lines: 2),
        ],
      );
    }

    if (transactions.isEmpty) {
      return ShieldEmptyState(
        icon: Icons.history_rounded,
        title: 'No history yet',
        subtitle: 'Complete tasks to start earning points!',
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: transactions.length,
      itemBuilder: (context, index) {
        final tx = transactions[index];
        return _TransactionTile(tx: tx);
      },
    );
  }
}

class _TransactionTile extends StatelessWidget {
  final Map<String, dynamic> tx;
  const _TransactionTile({required this.tx});

  @override
  Widget build(BuildContext context) {
    final type = tx['type'] as String? ?? '';
    final points = tx['points'] as int? ?? 0;
    final minutes = tx['minutes'] as int? ?? 0;
    final description = tx['description'] as String? ?? _descriptionFromType(type);
    final createdAt = tx['createdAt'] as String?;

    final isCredit = type == 'TASK_REWARD' || type == 'BONUS' || type == 'CREDIT';
    final isRedeem = type == 'REDEEM' || type == 'REDEMPTION';

    final iconData = isRedeem
        ? Icons.redeem_rounded
        : isCredit
            ? Icons.add_circle_rounded
            : Icons.remove_circle_rounded;

    final iconColor = isRedeem
        ? ShieldTheme.primaryLight
        : isCredit
            ? ShieldTheme.success
            : ShieldTheme.dangerLight;

    final bgColor = isRedeem
        ? ShieldTheme.primary.withOpacity(0.08)
        : isCredit
            ? ShieldTheme.success.withOpacity(0.08)
            : ShieldTheme.danger.withOpacity(0.08);

    final pointsText = points != 0
        ? '${isCredit ? '+' : ''}$points pts'
        : minutes != 0
            ? '${isRedeem ? '-' : '+'}${minutes}m'
            : '';

    final pointsColor = isCredit ? ShieldTheme.success : ShieldTheme.danger;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2))
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: bgColor, shape: BoxShape.circle),
            child: Icon(iconData, color: iconColor, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(description,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: Color(0xFF1A1A2E))),
                if (createdAt != null) ...[
                  const SizedBox(height: 2),
                  Text(_formatDate(createdAt),
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (pointsText.isNotEmpty)
            Text(pointsText,
                style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: pointsColor)),
        ],
      ),
    );
  }

  String _descriptionFromType(String type) {
    switch (type) {
      case 'TASK_REWARD':
        return 'Task completed';
      case 'BONUS':
        return 'Bonus points';
      case 'REDEEM':
      case 'REDEMPTION':
        return 'Redeemed screen time';
      case 'CREDIT':
        return 'Points credited';
      case 'DEBIT':
        return 'Points used';
      default:
        return type.isNotEmpty ? type.replaceAll('_', ' ') : 'Transaction';
    }
  }

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso).toLocal();
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      final h = d.hour.toString().padLeft(2, '0');
      final m = d.minute.toString().padLeft(2, '0');
      return '${d.day} ${months[d.month - 1]} ${d.year}, $h:$m';
    } catch (_) {
      return '';
    }
  }
}
