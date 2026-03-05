import 'package:flutter/material.dart';
import '../../core/app_lock_service.dart';

/// Screen for parents to set up the app lock PIN when configuring
/// a child's device. Shown during initial child account setup.
class ParentPinSetupScreen extends StatefulWidget {
  final VoidCallback? onComplete;
  const ParentPinSetupScreen({super.key, this.onComplete});

  @override
  State<ParentPinSetupScreen> createState() => _ParentPinSetupScreenState();
}

class _ParentPinSetupScreenState extends State<ParentPinSetupScreen> {
  final _pinController = TextEditingController();
  final _confirmController = TextEditingController();
  String? _error;
  bool _saving = false;

  @override
  void dispose() {
    _pinController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final pin = _pinController.text.trim();
    final confirm = _confirmController.text.trim();

    if (pin.length < 4) {
      setState(() => _error = 'PIN must be at least 4 digits');
      return;
    }
    if (pin != confirm) {
      setState(() => _error = 'PINs do not match');
      return;
    }

    setState(() { _saving = true; _error = null; });

    await AppLockService.enableAppLock(pin);

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('App lock enabled. Child cannot uninstall the app without this PIN.'),
        backgroundColor: Colors.green,
      ),
    );

    widget.onComplete?.call();
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Set Parent PIN', style: TextStyle(fontWeight: FontWeight.w700)),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.shield, size: 48, color: Color(0xFF1565C0)),
            const SizedBox(height: 16),
            const Text(
              'App Protection',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            const Text(
              'Set a PIN code to prevent your child from uninstalling or disabling the Shield app. '
              'This PIN will be required to:\n'
              '• Uninstall or disable the app\n'
              '• Access app settings\n'
              '• Change protection settings\n'
              '• Sign out of the child account',
              style: TextStyle(color: Colors.grey, fontSize: 14, height: 1.6),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _pinController,
              keyboardType: TextInputType.number,
              obscureText: true,
              maxLength: 6,
              decoration: InputDecoration(
                labelText: 'Create PIN (4-6 digits)',
                prefixIcon: const Icon(Icons.lock_outline),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                counterText: '',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _confirmController,
              keyboardType: TextInputType.number,
              obscureText: true,
              maxLength: 6,
              decoration: InputDecoration(
                labelText: 'Confirm PIN',
                prefixIcon: const Icon(Icons.lock),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                errorText: _error,
                counterText: '',
              ),
              onSubmitted: (_) => _save(),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: const Color(0xFF1565C0),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Enable App Protection', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
