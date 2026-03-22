import 'dart:async';
import 'package:flutter/material.dart';
import '../../app/theme.dart';
import '../../core/biometric_service.dart';

/// PO-01: App PIN Lock screen.
/// Shown whenever the app is locked (PIN required to unlock).
/// Supports 4-digit PIN entry with optional biometric unlock.
class AppLockScreen extends StatefulWidget {
  /// Called when the user successfully unlocks the app.
  final VoidCallback onUnlocked;

  /// Whether biometric unlock is enabled for this user.
  final bool biometricEnabled;

  /// Called to verify the entered PIN against the backend.
  final Future<bool> Function(String pin) onVerifyPin;

  const AppLockScreen({
    super.key,
    required this.onUnlocked,
    required this.onVerifyPin,
    this.biometricEnabled = false,
  });

  @override
  State<AppLockScreen> createState() => _AppLockScreenState();
}

class _AppLockScreenState extends State<AppLockScreen> {
  String _enteredPin = '';
  int _failedAttempts = 0;
  bool _isVerifying = false;
  bool _lockedOut = false;
  int _lockoutSecondsRemaining = 0;
  Timer? _lockoutTimer;
  String? _errorMessage;

  static const int _maxAttempts = 3;
  static const int _lockoutSeconds = 30;

  @override
  void dispose() {
    _lockoutTimer?.cancel();
    super.dispose();
  }

  void _onDigitPressed(String digit) {
    if (_lockedOut || _isVerifying) return;
    if (_enteredPin.length >= 4) return;
    setState(() {
      _enteredPin += digit;
      _errorMessage = null;
    });
    if (_enteredPin.length == 4) {
      _verifyPin();
    }
  }

  void _onBackspace() {
    if (_lockedOut || _isVerifying) return;
    if (_enteredPin.isEmpty) return;
    setState(() {
      _enteredPin = _enteredPin.substring(0, _enteredPin.length - 1);
      _errorMessage = null;
    });
  }

  Future<void> _verifyPin() async {
    setState(() => _isVerifying = true);
    try {
      final valid = await widget.onVerifyPin(_enteredPin);
      if (!mounted) return;
      if (valid) {
        widget.onUnlocked();
      } else {
        _failedAttempts++;
        if (_failedAttempts >= _maxAttempts) {
          _startLockout();
        } else {
          setState(() {
            _enteredPin = '';
            _errorMessage =
                'Incorrect PIN. ${_maxAttempts - _failedAttempts} attempt(s) remaining.';
            _isVerifying = false;
          });
        }
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _enteredPin = '';
        _errorMessage = 'Verification failed. Please try again.';
        _isVerifying = false;
      });
    }
  }

  void _startLockout() {
    setState(() {
      _lockedOut = true;
      _lockoutSecondsRemaining = _lockoutSeconds;
      _enteredPin = '';
      _isVerifying = false;
      _errorMessage = null;
    });
    _lockoutTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() => _lockoutSecondsRemaining--);
      if (_lockoutSecondsRemaining <= 0) {
        timer.cancel();
        setState(() {
          _lockedOut = false;
          _failedAttempts = 0;
          _errorMessage = null;
        });
      }
    });
  }

  Future<void> _tryBiometric() async {
    final ok = await BiometricService.authenticate();
    if (ok && mounted) {
      widget.onUnlocked();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ShieldTheme.primary,
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 60),
            // Logo / icon
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.shield, size: 40, color: Colors.white),
            ),
            const SizedBox(height: 16),
            const Text(
              'Shield',
              style: TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Enter your PIN to unlock',
              style: TextStyle(
                color: Colors.white70,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 40),

            // PIN dots
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(4, (i) {
                final filled = i < _enteredPin.length;
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 10),
                  width: 18,
                  height: 18,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: filled ? Colors.white : Colors.transparent,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                );
              }),
            ),
            const SizedBox(height: 16),

            // Error / lockout message
            SizedBox(
              height: 28,
              child: _lockedOut
                  ? Text(
                      'Too many attempts. Wait $_lockoutSecondsRemaining s...',
                      style: const TextStyle(color: Colors.amber, fontSize: 13),
                    )
                  : _errorMessage != null
                      ? Text(
                          _errorMessage!,
                          style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                        )
                      : const SizedBox.shrink(),
            ),

            const SizedBox(height: 16),

            // Number pad
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 48),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildRow(['1', '2', '3']),
                    const SizedBox(height: 16),
                    _buildRow(['4', '5', '6']),
                    const SizedBox(height: 16),
                    _buildRow(['7', '8', '9']),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        // Biometric button or empty spacer
                        widget.biometricEnabled
                            ? _PadButton(
                                label: '',
                                icon: Icons.fingerprint,
                                onTap: _tryBiometric,
                                disabled: _lockedOut || _isVerifying,
                              )
                            : const SizedBox(width: 72),
                        _PadButton(
                          label: '0',
                          onTap: () => _onDigitPressed('0'),
                          disabled: _lockedOut || _isVerifying,
                        ),
                        _PadButton(
                          label: '',
                          icon: Icons.backspace_outlined,
                          onTap: _onBackspace,
                          disabled: _lockedOut || _isVerifying,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Verifying spinner
            if (_isVerifying)
              const Padding(
                padding: EdgeInsets.only(bottom: 24),
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildRow(List<String> digits) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: digits
          .map((d) => _PadButton(
                label: d,
                onTap: () => _onDigitPressed(d),
                disabled: _lockedOut || _isVerifying,
              ))
          .toList(),
    );
  }
}

class _PadButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback onTap;
  final bool disabled;

  const _PadButton({
    required this.label,
    required this.onTap,
    this.icon,
    this.disabled = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: disabled ? null : onTap,
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withOpacity(disabled ? 0.05 : 0.15),
          border: Border.all(color: Colors.white24),
        ),
        child: Center(
          child: icon != null
              ? Icon(icon, color: disabled ? Colors.white30 : Colors.white, size: 28)
              : Text(
                  label,
                  style: TextStyle(
                    color: disabled ? Colors.white30 : Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w400,
                  ),
                ),
        ),
      ),
    );
  }
}
