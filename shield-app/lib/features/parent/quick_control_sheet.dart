import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../app/theme.dart';

class QuickControlSheet extends ConsumerWidget {
  final String profileId;
  const QuickControlSheet({super.key, required this.profileId});

  static Future<void> show(BuildContext context, WidgetRef ref, String profileId) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => QuickControlSheet(profileId: profileId),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40, height: 4,
            decoration: BoxDecoration(color: ShieldTheme.divider, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 16),
          const Text('Quick Controls',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: ShieldTheme.textPrimary)),
          const SizedBox(height: 4),
          const Text('Apply instant settings for this child',
              style: TextStyle(color: ShieldTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 24),
          Row(children: [
            Expanded(child: _QuickAction(
              icon: Icons.pause_circle_filled,
              label: 'Pause\nInternet',
              color: ShieldTheme.warning,
              onTap: () => _applyAction(context, ref, 'pause'),
            )),
            const SizedBox(width: 12),
            Expanded(child: _QuickAction(
              icon: Icons.school,
              label: 'Homework\nMode',
              color: ShieldTheme.primary,
              onTap: () => _applyAction(context, ref, 'homework'),
            )),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _QuickAction(
              icon: Icons.bedtime,
              label: 'Bedtime\nMode',
              color: ShieldTheme.primaryDark,
              onTap: () => _applyAction(context, ref, 'bedtime'),
            )),
            const SizedBox(width: 12),
            Expanded(child: _QuickAction(
              icon: Icons.play_circle,
              label: 'Resume\nNormal',
              color: ShieldTheme.success,
              onTap: () => _applyAction(context, ref, 'resume'),
            )),
          ]),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Future<void> _applyAction(BuildContext context, WidgetRef ref, String action) async {
    Navigator.pop(context);
    final messenger = ScaffoldMessenger.of(context);

    try {
      final client = ref.read(dioProvider);
      switch (action) {
        case 'pause':
          await client.post('/dns/schedules/$profileId/override', data: {'mode': 'BLOCK_ALL'});
          messenger.showSnackBar(SnackBar(
            content: const Text('Internet paused'),
            backgroundColor: ShieldTheme.warning,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
          break;
        case 'homework':
          await client.post('/dns/schedules/$profileId/override', data: {'mode': 'HOMEWORK'});
          messenger.showSnackBar(SnackBar(
            content: const Text('Homework mode activated'),
            backgroundColor: ShieldTheme.primary,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
          break;
        case 'bedtime':
          await client.post('/dns/schedules/$profileId/override', data: {'mode': 'BEDTIME'});
          messenger.showSnackBar(SnackBar(
            content: const Text('Bedtime mode activated'),
            backgroundColor: ShieldTheme.primaryDark,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
          break;
        case 'resume':
          await client.delete('/dns/schedules/$profileId/override');
          messenger.showSnackBar(SnackBar(
            content: const Text('Normal mode resumed'),
            backgroundColor: ShieldTheme.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
          break;
      }
    } catch (e) {
      messenger.showSnackBar(SnackBar(
        content: Text('Failed: $e'),
        backgroundColor: ShieldTheme.danger,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ));
    }
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _QuickAction({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 24),
        decoration: BoxDecoration(
          color: color.withAlpha(20),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withAlpha(60)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 40),
            const SizedBox(height: 8),
            Text(label, textAlign: TextAlign.center,
              style: TextStyle(fontWeight: FontWeight.w700, color: color, fontSize: 13)),
          ],
        ),
      ),
    );
  }
}
