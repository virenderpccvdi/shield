import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/theme.dart';
import '../../core/api_client.dart';
import '../../core/biometric_service.dart';

/// PO-01: PIN Setup Screen.
/// Allows the parent to create a new PIN or change/remove an existing one.
/// Also provides a toggle for biometric unlock.
class PinSetupScreen extends ConsumerStatefulWidget {
  const PinSetupScreen({super.key});

  @override
  ConsumerState<PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends ConsumerState<PinSetupScreen> {
  // Steps: 0 = enter new PIN, 1 = confirm PIN
  int _step = 0;
  String _newPin = '';
  String _confirmPin = '';

  bool _loading = false;
  bool _biometricEnabled = false;
  bool _biometricAvailable = false;
  bool _pinEnabled = false;
  String? _error;
  String? _successMessage;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    try {
      final res = await ref.read(dioProvider).get('/auth/pin/settings');
      final data = res.data['data'] as Map<String, dynamic>? ?? {};
      final available = await BiometricService.isAvailable();
      if (mounted) {
        setState(() {
          _pinEnabled = data['pinEnabled'] == true;
          _biometricEnabled = data['biometricEnabled'] == true;
          _biometricAvailable = available;
        });
      }
    } catch (_) {
      // Settings not critical — proceed anyway
    }
  }

  void _onDigitPressed(String digit) {
    if (_loading) return;
    if (_step == 0 && _newPin.length < 4) {
      setState(() { _newPin += digit; _error = null; });
      if (_newPin.length == 4) setState(() => _step = 1);
    } else if (_step == 1 && _confirmPin.length < 4) {
      setState(() { _confirmPin += digit; _error = null; });
      if (_confirmPin.length == 4) _submitPin();
    }
  }

  void _onBackspace() {
    if (_loading) return;
    if (_step == 1 && _confirmPin.isNotEmpty) {
      setState(() => _confirmPin = _confirmPin.substring(0, _confirmPin.length - 1));
    } else if (_step == 1 && _confirmPin.isEmpty) {
      setState(() { _step = 0; _newPin = _newPin.substring(0, _newPin.length - 1); });
    } else if (_step == 0 && _newPin.isNotEmpty) {
      setState(() => _newPin = _newPin.substring(0, _newPin.length - 1));
    }
  }

  Future<void> _submitPin() async {
    if (_newPin != _confirmPin) {
      setState(() {
        _error = 'PINs do not match. Please try again.';
        _step = 0;
        _newPin = '';
        _confirmPin = '';
      });
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(dioProvider).post('/auth/pin/set', data: {'pin': _newPin});
      if (mounted) {
        setState(() {
          _loading = false;
          _pinEnabled = true;
          _successMessage = 'PIN saved successfully!';
          _step = 0;
          _newPin = '';
          _confirmPin = '';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Failed to save PIN. Please try again.';
          _step = 0;
          _newPin = '';
          _confirmPin = '';
        });
      }
    }
  }

  Future<void> _removePin() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Remove PIN'),
        content: const Text('Are you sure you want to remove your app PIN lock?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _loading = true);
    try {
      await ref.read(dioProvider).delete('/auth/pin/remove');
      if (mounted) {
        setState(() {
          _loading = false;
          _pinEnabled = false;
          _successMessage = 'PIN removed.';
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleBiometric(bool value) async {
    setState(() => _loading = true);
    try {
      await ref.read(dioProvider).put('/auth/pin/biometric', data: {'enabled': value});
      if (value) {
        await BiometricService.setEnabled(true);
      } else {
        await BiometricService.setEnabled(false);
      }
      if (mounted) setState(() { _biometricEnabled = value; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String get _currentPinDisplay => _step == 0 ? _newPin : _confirmPin;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('App PIN Lock', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            decoration: const BoxDecoration(
              gradient: ShieldTheme.heroGradient,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _step == 0 ? 'Enter new PIN' : 'Confirm PIN',
                  style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  _step == 0
                      ? 'Choose a 4-digit PIN to lock the Shield app'
                      : 'Re-enter the same PIN to confirm',
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
            ),
          ),

          if (_successMessage != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.green.shade600, size: 18),
                    const SizedBox(width: 8),
                    Text(_successMessage!, style: TextStyle(color: Colors.green.shade800, fontSize: 13)),
                  ],
                ),
              ),
            ),

          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: Colors.red.shade600, size: 18),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!, style: TextStyle(color: Colors.red.shade800, fontSize: 13))),
                  ],
                ),
              ),
            ),

          const SizedBox(height: 24),

          // PIN dots
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(4, (i) {
              final filled = i < _currentPinDisplay.length;
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 12),
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: filled ? ShieldTheme.primary : Colors.transparent,
                  border: Border.all(color: ShieldTheme.primary, width: 2),
                ),
              );
            }),
          ),

          const SizedBox(height: 32),

          // Number pad
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 48),
            child: Column(
              children: [
                _buildRow(['1', '2', '3']),
                const SizedBox(height: 14),
                _buildRow(['4', '5', '6']),
                const SizedBox(height: 14),
                _buildRow(['7', '8', '9']),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    const SizedBox(width: 72),
                    _PadKey(label: '0', onTap: () => _onDigitPressed('0'), disabled: _loading),
                    _PadKey(icon: Icons.backspace_outlined, onTap: _onBackspace, disabled: _loading),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Settings section
          const Divider(indent: 24, endIndent: 24),
          if (_biometricAvailable)
            SwitchListTile(
              title: const Text('Biometric unlock'),
              subtitle: const Text('Use fingerprint or face to unlock'),
              secondary: const Icon(Icons.fingerprint, color: ShieldTheme.primary),
              value: _biometricEnabled,
              onChanged: _loading ? null : _toggleBiometric,
            ),

          if (_pinEnabled)
            ListTile(
              leading: const Icon(Icons.no_encryption, color: Colors.red),
              title: const Text('Remove PIN', style: TextStyle(color: Colors.red)),
              subtitle: const Text('Disable PIN lock for this app'),
              onTap: _loading ? null : _removePin,
            ),

          if (_loading)
            const Padding(
              padding: EdgeInsets.all(16),
              child: LinearProgressIndicator(),
            ),
        ],
      ),
    );
  }

  Widget _buildRow(List<String> digits) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: digits
          .map((d) => _PadKey(label: d, onTap: () => _onDigitPressed(d), disabled: _loading))
          .toList(),
    );
  }
}

class _PadKey extends StatelessWidget {
  final String? label;
  final IconData? icon;
  final VoidCallback onTap;
  final bool disabled;

  const _PadKey({this.label, this.icon, required this.onTap, this.disabled = false});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: disabled ? null : onTap,
      borderRadius: BorderRadius.circular(36),
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: disabled ? Colors.grey.shade100 : ShieldTheme.primary.withOpacity(0.06),
          border: Border.all(color: ShieldTheme.primary.withOpacity(0.15)),
        ),
        child: Center(
          child: icon != null
              ? Icon(icon, color: disabled ? Colors.grey : ShieldTheme.primary, size: 26)
              : Text(
                  label!,
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w400,
                    color: disabled ? Colors.grey : ShieldTheme.primary,
                  ),
                ),
        ),
      ),
    );
  }
}
