import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/constants.dart';
import '../../core/models/auth_state.dart';
import '../../core/models/child_profile.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/services/dns_vpn_service.dart';
import '../../core/services/background_service.dart';
import '../../core/services/storage_service.dart';
import '../../core/widgets/common_widgets.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ChildSetupScreen — run on the CHILD's device by a parent.
//
// Flow:
//   Step 1 → Parent signs in with their own credentials
//   Step 2 → Parent selects which child profile to assign
//   Step 3 → Child token is issued and saved to storage IMMEDIATELY
//   Step 4 → VPN permission dialog is shown (after credentials are safe)
//   Step 5 → VPN starts → navigate to /child/home
// ─────────────────────────────────────────────────────────────────────────────

class ChildSetupScreen extends ConsumerStatefulWidget {
  const ChildSetupScreen({super.key, this.sessionExpired = false});
  final bool sessionExpired;
  @override
  ConsumerState<ChildSetupScreen> createState() => _ChildSetupScreenState();
}

class _ChildSetupScreenState extends ConsumerState<ChildSetupScreen> {
  int _step = 0; // 0=login, 1=select child, 2=activating, 3=done

  // Step 1 fields (only shown when NOT already logged in)
  final _email    = TextEditingController();
  final _password = TextEditingController();
  bool _obscure   = true;

  // Step 2 data
  String? _parentUserId;
  String? _parentAccessToken;
  List<ChildProfile> _children = [];
  ChildProfile? _selected;

  // State
  bool _loading = false;
  String? _error;

  // Whether we skipped login because parent was already authenticated
  bool _skippedLogin = false;

  @override
  void initState() {
    super.initState();
    // If parent is already logged in, skip the email/password step
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = ref.read(authProvider);
      if (auth.status == AuthStatus.parent && auth.userId != null) {
        _skippedLogin    = true;
        _parentUserId    = auth.userId;
        setState(() { _loading = true; _error = null; });
        _loadChildrenAsParent();
      }
    });
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  // ── Load children using the existing parent session ────────────────────────

  Future<void> _loadChildrenAsParent() async {
    try {
      // Use the already-authenticated ApiClient (auth interceptor attaches token)
      final resp = await ApiClient.instance.get(Endpoints.children);
      final List<dynamic> raw = resp.data is List
          ? resp.data as List
          : (resp.data as Map<String, dynamic>?)?['data'] as List? ?? [];
      _children = raw.map((j) => ChildProfile.fromJson(j as Map<String, dynamic>)).toList();
      if (!mounted) return;
      if (_children.isEmpty) {
        setState(() {
          _loading = false;
          _error   = 'No child profiles found. Create one first in the Shield app.';
        });
        return;
      }
      setState(() { _step = 1; _loading = false; _error = null; });
    } catch (_) {
      if (!mounted) return;
      setState(() { _loading = false; _error = 'Failed to load child profiles.'; });
    }
  }

  // ── Step 1: Authenticate as parent (only when not already logged in) ───────

  Future<void> _loginAsParent() async {
    final email    = _email.text.trim();
    final password = _password.text;
    if (!email.contains('@') || password.length < 6) {
      setState(() => _error = 'Enter valid email and password (min 6 chars)');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      // Use a bare Dio (no auth interceptor) so we don't interfere with parent session
      final resp = await Dio(BaseOptions(baseUrl: AppConstants.baseUrl)).post(
        Endpoints.login,
        data: {'email': email, 'password': password},
      );
      // API wraps response: { "data": {...}, "success": true }
      final envelope = resp.data as Map<String, dynamic>;
      final data = (envelope['data'] as Map<String, dynamic>?) ?? envelope;
      _parentUserId      = data['userId']?.toString() ?? '';
      _parentAccessToken = data['accessToken']?.toString() ?? '';
      final role         = data['role']?.toString() ?? '';

      if (role != 'CUSTOMER' && role != 'ISP_ADMIN' && role != 'GLOBAL_ADMIN') {
        setState(() { _loading = false; _error = 'This account cannot set up child devices.'; });
        return;
      }

      await _loadChildrenWithToken();
    } catch (e) {
      setState(() { _loading = false; _error = 'Login failed. Check your email and password.'; });
    }
  }

  Future<void> _loadChildrenWithToken() async {
    try {
      final resp = await Dio(BaseOptions(baseUrl: AppConstants.baseUrl)).get(
        Endpoints.children,
        options: Options(headers: {'Authorization': 'Bearer $_parentAccessToken'}),
      );
      final List<dynamic> raw = resp.data is List
          ? resp.data as List
          : (resp.data as Map<String, dynamic>)['data'] as List? ?? [];
      _children = raw.map((j) => ChildProfile.fromJson(j as Map<String, dynamic>)).toList();
      if (!mounted) return;
      if (_children.isEmpty) {
        setState(() {
          _loading = false;
          _error   = 'No child profiles found. Create one in the Shield app first.';
        });
        return;
      }
      setState(() { _step = 1; _loading = false; _error = null; });
    } catch (_) {
      setState(() { _loading = false; _error = 'Failed to load child profiles.'; });
    }
  }

  // ── Step 2: Activate child device ─────────────────────────────────────────

  Future<void> _activateDevice() async {
    if (_selected == null) {
      setState(() => _error = 'Please select a child profile');
      return;
    }
    setState(() { _step = 2; _loading = true; _error = null; });

    // 1. Issue child token — save to storage BEFORE any system dialog
    final err = await ref.read(authProvider.notifier).activateChildDevice(
      parentUserId:      _parentUserId!,
      childProfileId:    _selected!.id,
      childName:         _selected!.name,
      dohUrl:            _selected!.dohUrl,
      // When parent authenticated via bare-Dio in Step 0 (child device setup
      // on a fresh device), pass the token explicitly so the interceptor
      // doesn't fail trying to read a non-existent stored token.
      parentAccessToken: _skippedLogin ? null : _parentAccessToken,
    );

    if (err != null) {
      if (!mounted) return;
      setState(() { _step = 1; _loading = false; _error = err; });
      return;
    }

    // 2. Request VPN permission (credentials already persisted above)
    //    If Android kills the activity here, the child session is already saved.
    if (!mounted) return;
    final permGranted = await DnsVpnService.requestPermission(); // returns bool
    if (!mounted) return;

    // 3. Start VPN tunnel
    if (permGranted && _selected!.dohUrl != null) {
      await DnsVpnService.start(dohUrl: _selected!.dohUrl!);
    }

    // 4. Start background service (heartbeat + location)
    final authState = ref.read(authProvider);
    final token     = await _getChildToken();
    if (token != null) {
      await BackgroundServiceHelper.start(
        token: token, profileId: _selected!.id,
      );
    }

    if (!mounted) return;
    setState(() { _step = 3; _loading = false; });
  }

  Future<String?> _getChildToken() async {
    return StorageService.instance.read(AppConstants.keyChildToken);
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Set Up Child Device'),
      // Show back-to-login only if we did not skip the login step
      leading: (_step == 1 && !_skippedLogin)
          ? IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => setState(() { _step = 0; _error = null; }),
            )
          : null,
    ),
    body: SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // Expired banner
          if (widget.sessionExpired) _expiredBanner(),

          // Progress indicator
          _buildStepper(),
          const SizedBox(height: 32),

          // Step content
          // If parent is already logged in, show spinner while loading children
          if (_step == 0 && _skippedLogin)
            const Center(child: Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: CircularProgressIndicator(),
            ))
          else if (_step == 0)
            _stepLogin(),
          if (_step == 1) _stepSelectChild(),
          if (_step == 2) _stepActivating(),
          if (_step == 3) _stepDone(),

          if (_error != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          ],
        ]),
      ),
    ),
  );

  Widget _expiredBanner() => Container(
    margin: const EdgeInsets.only(bottom: 16),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: Colors.orange.shade50,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: Colors.orange),
    ),
    child: const Row(children: [
      Icon(Icons.warning_amber, color: Colors.orange),
      SizedBox(width: 8),
      Expanded(child: Text(
        'Child session expired. Please re-authenticate to restore protection.',
        style: TextStyle(color: Colors.orange, fontSize: 13),
      )),
    ]),
  );

  Widget _buildStepper() {
    // When parent is already logged in, skip the "Parent Login" step visually
    if (_skippedLogin) {
      return Row(children: [
        _stepDot(1, 'Select\nChild'),
        Expanded(child: Container(height: 2,
            color: _step >= 3 ? const Color(0xFF1565C0) : Colors.grey.shade300)),
        _stepDot(3, 'Done'),
      ]);
    }
    return Row(children: [
      _stepDot(0, 'Parent\nLogin'),
      Expanded(child: Container(height: 2,
          color: _step >= 1 ? const Color(0xFF1565C0) : Colors.grey.shade300)),
      _stepDot(1, 'Select\nChild'),
      Expanded(child: Container(height: 2,
          color: _step >= 3 ? const Color(0xFF1565C0) : Colors.grey.shade300)),
      _stepDot(3, 'Done'),
    ]);
  }

  Widget _stepDot(int idx, String label) {
    final done    = _step > idx;
    final active  = _step == idx;
    final color   = done || active ? const Color(0xFF1565C0) : Colors.grey.shade300;
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 32, height: 32,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        child: Icon(done ? Icons.check : Icons.circle,
            size: 16, color: Colors.white),
      ),
      const SizedBox(height: 4),
      Text(label, style: TextStyle(fontSize: 10, color: active ? const Color(0xFF1565C0) : Colors.black45),
          textAlign: TextAlign.center),
    ]);
  }

  // ── Step 0: Parent login ───────────────────────────────────────────────────

  Widget _stepLogin() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    const Icon(Icons.shield, size: 56, color: Color(0xFF1565C0)),
    const SizedBox(height: 16),
    const Text('Parent Authentication',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
    const Text('Sign in with your Shield parent account to set up this device.',
        textAlign: TextAlign.center, style: TextStyle(color: Colors.black54, fontSize: 13)),
    const SizedBox(height: 24),
    TextFormField(
      controller:   _email,
      keyboardType: TextInputType.emailAddress,
      decoration:   const InputDecoration(
          labelText: 'Parent Email', prefixIcon: Icon(Icons.email_outlined)),
    ),
    const SizedBox(height: 12),
    TextFormField(
      controller:  _password,
      obscureText: _obscure,
      decoration:  InputDecoration(
        labelText:  'Parent Password',
        prefixIcon: const Icon(Icons.lock_outlined),
        suffixIcon: IconButton(
          icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
          onPressed: () => setState(() => _obscure = !_obscure),
        ),
      ),
    ),
    const SizedBox(height: 20),
    ElevatedButton(
      onPressed: _loading ? null : _loginAsParent,
      child: _loading
          ? const SizedBox(height: 20, width: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
          : const Text('Continue'),
    ),
  ]);

  // ── Step 1: Select child profile ───────────────────────────────────────────

  Widget _stepSelectChild() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    const Text('Who is this device for?',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
    const SizedBox(height: 8),
    const Text('Select the child whose protection rules apply to this device.',
        style: TextStyle(color: Colors.black54, fontSize: 13)),
    const SizedBox(height: 20),

    ..._children.map((child) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => setState(() => _selected = child),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _selected?.id == child.id
                ? const Color(0xFF1565C0).withOpacity(0.08)
                : Colors.white,
            border: Border.all(
              color: _selected?.id == child.id
                  ? const Color(0xFF1565C0)
                  : Colors.grey.shade300,
              width: _selected?.id == child.id ? 2 : 1,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(children: [
            CircleAvatar(
              backgroundColor: const Color(0xFF1565C0).withOpacity(0.15),
              child: Text(child.initials,
                  style: const TextStyle(color: Color(0xFF1565C0),
                      fontWeight: FontWeight.bold)),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(child.name, style: const TextStyle(
                  fontWeight: FontWeight.w600, fontSize: 16)),
              if (child.age != null)
                Text('Age ${child.age}',
                    style: const TextStyle(color: Colors.black45, fontSize: 13)),
              if (child.filterLevel != null)
                Text('Filter: ${child.filterLevel}',
                    style: const TextStyle(color: Colors.black45, fontSize: 12)),
            ])),
            if (_selected?.id == child.id)
              const Icon(Icons.check_circle, color: Color(0xFF1565C0)),
          ]),
        ),
      ),
    )),

    const SizedBox(height: 24),
    ElevatedButton.icon(
      onPressed: _selected == null ? null : _activateDevice,
      icon:  const Icon(Icons.lock),
      label: Text('Protect ${_selected?.name ?? "this device"}'),
    ),
  ]);

  // ── Step 2: Activating ─────────────────────────────────────────────────────

  Widget _stepActivating() => const Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      SizedBox(height: 48),
      CircularProgressIndicator(strokeWidth: 3),
      SizedBox(height: 24),
      Text('Setting up protection…', style: TextStyle(fontSize: 16)),
      SizedBox(height: 8),
      Text('Saving credentials and configuring DNS filter.',
          style: TextStyle(color: Colors.black45, fontSize: 13),
          textAlign: TextAlign.center),
    ],
  );

  // ── Step 3: Done ───────────────────────────────────────────────────────────

  Widget _stepDone() => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const SizedBox(height: 32),
      const Icon(Icons.verified_user, size: 80, color: Colors.green),
      const SizedBox(height: 16),
      Text('${_selected?.name ?? "Device"} is protected!',
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          textAlign: TextAlign.center),
      const SizedBox(height: 8),
      const Text(
        'DNS filtering is active. This device is now monitored and protected.',
        textAlign: TextAlign.center,
        style: TextStyle(color: Colors.black54),
      ),
      const SizedBox(height: 32),
      ElevatedButton(
        onPressed: () => context.go('/child/home'),
        child: const Text('Open Child Dashboard'),
      ),
    ],
  );
}
