import 'package:flutter/material.dart';
import '../../core/app_lock_service.dart';

/// Dialog that requires parent PIN to perform protected actions
/// (uninstall, access settings, disable protection, etc.)
class PinVerifyDialog extends StatefulWidget {
  final String title;
  final String description;
  final VoidCallback onSuccess;

  const PinVerifyDialog({
    super.key,
    required this.title,
    required this.description,
    required this.onSuccess,
  });

  /// Show the PIN verification dialog. Returns true if PIN was verified.
  static Future<bool> show(
    BuildContext context, {
    String title = 'Parent Verification',
    String description = 'Enter the parent PIN to continue',
    required VoidCallback onSuccess,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => PinVerifyDialog(
        title: title,
        description: description,
        onSuccess: onSuccess,
      ),
    );
    return result ?? false;
  }

  @override
  State<PinVerifyDialog> createState() => _PinVerifyDialogState();
}

class _PinVerifyDialogState extends State<PinVerifyDialog> {
  final _pinController = TextEditingController();
  String? _error;
  bool _verifying = false;

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final pin = _pinController.text.trim();
    if (pin.length < 4) {
      setState(() => _error = 'PIN must be at least 4 digits');
      return;
    }

    setState(() { _verifying = true; _error = null; });

    final valid = await AppLockService.verifyPin(pin);
    if (!mounted) return;

    if (valid) {
      widget.onSuccess();
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _verifying = false;
        _error = 'Incorrect PIN. Please try again.';
        _pinController.clear();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          const Icon(Icons.lock, color: Color(0xFF1565C0)),
          const SizedBox(width: 8),
          Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.description, style: const TextStyle(color: Colors.grey, fontSize: 14)),
          const SizedBox(height: 16),
          TextField(
            controller: _pinController,
            keyboardType: TextInputType.number,
            obscureText: true,
            maxLength: 6,
            autofocus: true,
            decoration: InputDecoration(
              labelText: 'Parent PIN',
              hintText: 'Enter 4-6 digit PIN',
              errorText: _error,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              prefixIcon: const Icon(Icons.dialpad),
              counterText: '',
            ),
            onSubmitted: (_) => _verify(),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _verifying ? null : _verify,
          child: _verifying
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Verify'),
        ),
      ],
    );
  }
}
