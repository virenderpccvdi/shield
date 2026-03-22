import 'package:flutter/material.dart';
import '../../core/biometric_service.dart';
import '../../app/theme.dart';

class BiometricGate extends StatefulWidget {
  final Widget child;
  const BiometricGate({super.key, required this.child});

  @override
  State<BiometricGate> createState() => _BiometricGateState();
}

class _BiometricGateState extends State<BiometricGate> with WidgetsBindingObserver {
  bool _authenticated = false;
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _checkAndAuthenticate();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _checkAndAuthenticate() async {
    final enabled = await BiometricService.isEnabled();
    if (!enabled) {
      if (mounted) setState(() { _authenticated = true; _checking = false; });
      return;
    }
    final ok = await BiometricService.authenticate();
    if (mounted) setState(() { _authenticated = ok; _checking = false; });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!_authenticated) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.fingerprint, size: 80, color: ShieldTheme.primary),
              const SizedBox(height: 16),
              const Text(
                'Biometric Authentication Required',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  'Shield requires your fingerprint or face to unlock.',
                  style: TextStyle(color: Colors.grey, fontSize: 13),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                icon: const Icon(Icons.fingerprint),
                label: const Text('Authenticate'),
                onPressed: () async {
                  final ok = await BiometricService.authenticate();
                  if (mounted) setState(() => _authenticated = ok);
                },
              ),
            ],
          ),
        ),
      );
    }
    return widget.child;
  }
}
