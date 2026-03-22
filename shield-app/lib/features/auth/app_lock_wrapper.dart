import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/app_lock_service.dart';
import '../../core/auth_state.dart';
import 'app_lock_screen.dart';

/// PO-01: App Lock Wrapper.
/// Wraps parent-facing UI and shows AppLockScreen when the app should be locked.
/// Monitors app lifecycle to lock after 60s of backgrounding.
class AppLockWrapper extends ConsumerStatefulWidget {
  final Widget child;
  const AppLockWrapper({super.key, required this.child});

  @override
  ConsumerState<AppLockWrapper> createState() => _AppLockWrapperState();
}

class _AppLockWrapperState extends ConsumerState<AppLockWrapper>
    with WidgetsBindingObserver {
  bool _locked = false;
  bool _pinEnabled = false;
  bool _biometricEnabled = false;
  bool _settingsLoaded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadSettingsAndCheck();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _loadSettingsAndCheck() async {
    try {
      final res = await ref.read(dioProvider).get('/auth/pin/settings');
      final data = res.data['data'] as Map<String, dynamic>? ?? {};
      final pinEnabled = data['pinEnabled'] == true;
      final biometricEnabled = data['biometricEnabled'] == true;
      await AppLockService.setParentLockEnabled(pinEnabled);
      if (mounted) {
        setState(() {
          _pinEnabled = pinEnabled;
          _biometricEnabled = biometricEnabled;
          _settingsLoaded = true;
        });
        // Check if we should lock right now
        if (pinEnabled) {
          final should = await AppLockService.shouldLock();
          if (should && mounted) setState(() => _locked = true);
        }
      }
    } catch (_) {
      // If settings can't load, don't lock — fail open
      if (mounted) setState(() { _settingsLoaded = true; });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      AppLockService.recordBackgrounded();
    } else if (state == AppLifecycleState.resumed) {
      _checkShouldLock();
    }
  }

  Future<void> _checkShouldLock() async {
    if (!_pinEnabled) return;
    final should = await AppLockService.shouldLock();
    if (should && mounted) setState(() => _locked = true);
  }

  Future<bool> _verifyPin(String pin) async {
    try {
      final authState = ref.read(authProvider);
      if (authState.userId == null) return false;
      final res = await ref.read(dioProvider).post('/auth/pin/verify', data: {'pin': pin});
      final data = res.data['data'] as Map<String, dynamic>? ?? {};
      return data['valid'] == true;
    } catch (_) {
      return false;
    }
  }

  void _onUnlocked() {
    AppLockService.clearBackgroundedTime();
    if (mounted) setState(() => _locked = false);
  }

  @override
  Widget build(BuildContext context) {
    // While settings are loading, show child (don't block on slow network)
    if (!_settingsLoaded) return widget.child;

    if (_locked && _pinEnabled) {
      return AppLockScreen(
        onUnlocked: _onUnlocked,
        onVerifyPin: _verifyPin,
        biometricEnabled: _biometricEnabled,
      );
    }

    return widget.child;
  }
}
