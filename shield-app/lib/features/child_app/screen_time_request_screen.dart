import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../app/theme.dart';

/// FC-02: Screen Time Request bottom sheet.
///
/// Shows a minutes picker (15 / 30 / 45 / 60) and an optional reason field.
/// On submit, POSTs to /dns/screen-time/{profileId}/request and shows
/// a success state while the child waits for parent approval.
class ScreenTimeRequestSheet extends ConsumerStatefulWidget {
  const ScreenTimeRequestSheet({super.key});

  @override
  ConsumerState<ScreenTimeRequestSheet> createState() => _ScreenTimeRequestSheetState();
}

class _ScreenTimeRequestSheetState extends ConsumerState<ScreenTimeRequestSheet> {
  static const _minuteOptions = [15, 30, 45, 60];

  int _selectedMinutes = 30;
  final _reasonController = TextEditingController();
  bool _submitting = false;
  bool _submitted = false;
  String? _error;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _sendRequest() async {
    setState(() { _submitting = true; _error = null; });
    try {
      final client = ref.read(dioProvider);
      final profileId = ref.read(authProvider).childProfileId;
      if (profileId == null) throw Exception('No profile ID');

      await client.post(
        '/dns/screen-time/$profileId/request',
        data: {
          'minutes': _selectedMinutes,
          if (_reasonController.text.trim().isNotEmpty)
            'reason': _reasonController.text.trim(),
        },
      );
      if (mounted) setState(() { _submitted = true; });
    } catch (e) {
      if (mounted) {
        setState(() { _error = 'Failed to send request. Please try again.'; });
      }
    } finally {
      if (mounted) setState(() { _submitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 28,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Handle bar
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: theme.dividerColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          if (_submitted) ...[
            _SuccessState(minutes: _selectedMinutes),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Done'),
            ),
          ] else ...[
            Text(
              'Request More Screen Time',
              style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Text(
              'Choose how many extra minutes you need',
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 20),

            // Minutes selector
            Row(
              children: _minuteOptions.map((min) {
                final selected = min == _selectedMinutes;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedMinutes = min),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: selected ? ShieldTheme.primary : theme.colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: selected ? ShieldTheme.primary : Colors.transparent,
                            width: 2,
                          ),
                        ),
                        child: Column(
                          children: [
                            Text(
                              '$min',
                              style: theme.textTheme.titleMedium?.copyWith(
                                color: selected ? Colors.white : theme.colorScheme.onSurface,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              'min',
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: selected ? Colors.white70 : theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),

            const SizedBox(height: 20),

            // Reason field
            TextField(
              controller: _reasonController,
              decoration: InputDecoration(
                labelText: 'Reason (optional)',
                hintText: 'e.g. Homework done!',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
              maxLength: 120,
              textInputAction: TextInputAction.done,
            ),

            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: TextStyle(color: theme.colorScheme.error, fontSize: 13)),
            ],

            const SizedBox(height: 16),

            FilledButton(
              onPressed: _submitting ? null : _sendRequest,
              style: FilledButton.styleFrom(
                backgroundColor: ShieldTheme.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                    )
                  : Text(
                      'Send Request',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                    ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SuccessState extends StatelessWidget {
  final int minutes;
  const _SuccessState({required this.minutes});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 12),
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: const Color(0xFFE8F5E9),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_circle_rounded, color: Color(0xFF2E7D32), size: 44),
        ),
        const SizedBox(height: 16),
        const Text(
          'Request Sent!',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        Text(
          'Your parent has been notified about your request for $minutes extra minutes.\n\nWaiting for approval...',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 14, color: Colors.black54),
        ),
        const SizedBox(height: 8),
      ],
    );
  }
}

/// Opens the [ScreenTimeRequestSheet] as a modal bottom sheet.
Future<void> showScreenTimeRequestSheet(BuildContext context) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const ScreenTimeRequestSheet(),
  );
}
