import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/auth_state.dart';
import '../../core/constants.dart';
import '../../core/dns_vpn_service.dart';
import '../../core/background_location_service.dart';
import '../../app/theme.dart';

class ChildDeviceSetupScreen extends ConsumerStatefulWidget {
  const ChildDeviceSetupScreen({super.key});
  @override
  ConsumerState<ChildDeviceSetupScreen> createState() => _ChildDeviceSetupScreenState();
}

class _ChildDeviceSetupScreenState extends ConsumerState<ChildDeviceSetupScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Manual login flow state
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;
  List<Map<String, dynamic>> _profiles = [];
  String? _accessToken;
  String? _parentUserId;   // needed to call /auth/child/token
  String? _selectedProfileId;
  String? _selectedProfileName;
  bool _saving = false;

  // QR scan flow state
  bool _qrScanned = false;
  String? _qrProfileId;
  String? _qrProfileName;
  String? _qrDnsClientId;
  final _qrPasswordCtrl = TextEditingController();
  final _qrEmailCtrl = TextEditingController();
  bool _qrObscure = true;
  bool _qrLoading = false;
  String? _qrError;
  bool _scannerPaused = false;
  late final MobileScannerController _scannerController = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
    // Start scanner when first tab (QR) is the default
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_tabController.index == 0 && !_qrScanned) {
        _scannerController.start();
      }
    });
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    if (_tabController.index == 0 && !_qrScanned) {
      _scannerController.start();
    } else {
      _scannerController.stop();
    }
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    _scannerController.dispose();
    _email.dispose();
    _password.dispose();
    _qrPasswordCtrl.dispose();
    _qrEmailCtrl.dispose();
    super.dispose();
  }

  // ─── Manual flow ───────────────────────────────────────────────────────────

  Future<void> _fetchProfiles() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; _profiles = []; });
    try {
      final dio = Dio(BaseOptions(
        baseUrl: AppConstants.baseUrl,
        connectTimeout: AppConstants.connectTimeout,
        receiveTimeout: AppConstants.receiveTimeout,
      ));
      final res = await dio.post('/auth/login', data: {
        'email': _email.text.trim(),
        'password': _password.text,
      });
      final d = res.data['data'];
      _accessToken = d['accessToken'] as String?;
      _parentUserId = d['userId']?.toString();
      if (_accessToken == null) throw Exception('No token returned');

      final profRes = await dio.get(
        '/profiles/children',
        options: Options(headers: {'Authorization': 'Bearer $_accessToken'}),
      );
      final pd = profRes.data['data'];
      final list = (pd is Map ? (pd['content'] ?? pd) : pd) as List? ?? [];
      final profiles = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();

      if (profiles.isEmpty) {
        setState(() {
          _error = 'No child profiles found. Create one from the parent dashboard first.';
          _loading = false;
        });
        return;
      }
      setState(() { _profiles = profiles; _loading = false; });
    } on DioException catch (e) {
      setState(() {
        _error = e.response?.data?['message'] ?? 'Invalid email or password.';
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = 'Something went wrong. Please try again.'; _loading = false; });
    }
  }

  Future<void> _activateChildMode({
    required String token,
    required String profileId,
    required String profileName,
    String? parentUserId,
  }) async {
    setState(() { _saving = true; _qrLoading = true; });
    try {
      final dio = Dio(BaseOptions(
        baseUrl: AppConstants.baseUrl,
        connectTimeout: AppConstants.connectTimeout,
        receiveTimeout: AppConstants.receiveTimeout,
      ));

      // Register this device under the child profile (best-effort)
      await dio.post(
        '/profiles/devices',
        data: {
          'name': 'Child Device',
          'deviceType': 'PHONE',
          'profileId': profileId,
          'dnsMethod': 'PRIVATE_DNS',
        },
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      ).catchError((_) => Response(requestOptions: RequestOptions()));

      // Issue a long-lived child token (365-day expiry) instead of using the
      // parent's short-lived access token.
      String childToken = token;
      final uid = parentUserId ?? _parentUserId;
      if (uid != null) {
        try {
          final childTokenRes = await dio.post(
            '/auth/child/token',
            data: {
              'parentUserId': uid,
              'childProfileId': profileId,
              'pin': '0000', // placeholder — endpoint validates parent JWT, not PIN
            },
            options: Options(headers: {'Authorization': 'Bearer $token'}),
          );
          final issued = childTokenRes.data['data']?['accessToken'] as String?;
          if (issued != null) childToken = issued;
        } catch (_) {}
      }

      // ── Request VPN permission DURING setup ─────────────────────────────────
      // Step 1: Request permission unconditionally. The system VPN consent dialog
      // appears here while the parent is present — never on the child home screen.
      // If permission was already granted (re-setup), this returns instantly.
      await DnsVpnService.preparePermission();

      // Step 2: Fetch the DoH URL and start the VPN service immediately.
      // If this fails, the child screen will retry on its next launch
      // (permission is already cached so it will start silently).
      bool vpnStarted = false;
      try {
        String? dohUrl;
        // Try fetching from DNS rules endpoint
        try {
          final rulesRes = await dio.get(
            '/dns/rules/$profileId',
            options: Options(headers: {'Authorization': 'Bearer $childToken'}),
          );
          final d = rulesRes.data['data'] as Map? ?? rulesRes.data as Map? ?? {};
          dohUrl = d['dohUrl']?.toString();
          // Fallback: construct from dnsClientId in DNS rules response
          if ((dohUrl == null || dohUrl.isEmpty) && d['dnsClientId'] != null) {
            dohUrl = 'https://shield.rstglobal.in/dns/${d['dnsClientId']}/dns-query';
          }
        } catch (_) {}

        // Fallback: construct from QR-scanned dnsClientId or fetch profile
        if (dohUrl == null || dohUrl.isEmpty) {
          // Use dnsClientId from QR scan if available (manual flow won't have it)
          final qrDns = _qrDnsClientId;
          if (qrDns != null && qrDns.isNotEmpty) {
            dohUrl = 'https://shield.rstglobal.in/dns/$qrDns/dns-query';
          } else {
            // Last resort: fetch profile to get dnsClientId
            try {
              final profRes = await dio.get(
                '/profiles/$profileId',
                options: Options(headers: {'Authorization': 'Bearer $childToken'}),
              );
              final pd = profRes.data['data'] as Map? ?? profRes.data as Map? ?? {};
              final dnsClientId = pd['dnsClientId']?.toString();
              if (dnsClientId != null && dnsClientId.isNotEmpty) {
                dohUrl = 'https://shield.rstglobal.in/dns/$dnsClientId/dns-query';
              }
            } catch (_) {}
          }
        }

        if (dohUrl != null && dohUrl.isNotEmpty) {
          vpnStarted = await DnsVpnService.start(dohUrl);
          debugPrint('[Shield] Setup VPN start result: $vpnStarted, dohUrl: $dohUrl');
        } else {
          debugPrint('[Shield] Setup: No dohUrl available — VPN will retry on child screen');
        }
      } catch (e) {
        debugPrint('[Shield] Setup VPN start failed: $e');
      }

      // Show warning if VPN didn't start (but still proceed to child screen)
      if (!vpnStarted && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('DNS Protection could not start — it will retry automatically.'),
          backgroundColor: Colors.orange.shade700,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 4),
        ));
      }
      // ────────────────────────────────────────────────────────────────────────

      await ref.read(authProvider.notifier).setChildMode(
        accessToken: childToken,
        profileId: profileId,
        childName: profileName,
      );

      // Save credentials so the background isolate can access them
      await saveChildCredentialsForBackground(token: childToken, profileId: profileId);

      if (mounted) context.go('/child');
    } catch (e) {
      setState(() {
        _error = 'Failed to activate child mode. Please try again.';
        _qrError = 'Failed to activate child mode. Please try again.';
        _saving = false;
        _qrLoading = false;
      });
    }
  }

  // ─── QR flow ───────────────────────────────────────────────────────────────

  void _onQrDetected(BarcodeCapture capture) {
    if (_qrScanned || _scannerPaused) return;
    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null) return;

    final raw = barcode.rawValue!;
    try {
      final Map<String, dynamic> data = jsonDecode(raw);
      final profileId = data['profileId']?.toString();
      final profileName = data['profileName']?.toString();
      final dnsClientId = data['dnsClientId']?.toString();

      if (profileId == null || profileName == null) {
        setState(() { _qrError = 'Invalid QR code. Please scan a Shield setup QR.'; });
        return;
      }

      setState(() {
        _qrScanned = true;
        _scannerPaused = true;
        _qrProfileId = profileId;
        _qrProfileName = profileName;
        _qrDnsClientId = dnsClientId;
        _qrError = null;
      });
      _scannerController.stop();
    } catch (_) {
      setState(() { _qrError = 'Could not read QR code. Make sure you scan the Shield setup QR from the parent portal.'; });
    }
  }

  Future<void> _activateFromQr() async {
    if (_qrEmailCtrl.text.trim().isEmpty || _qrPasswordCtrl.text.isEmpty) {
      setState(() { _qrError = 'Please enter parent email and password.'; });
      return;
    }
    setState(() { _qrLoading = true; _qrError = null; });
    try {
      final dio = Dio(BaseOptions(
        baseUrl: AppConstants.baseUrl,
        connectTimeout: AppConstants.connectTimeout,
        receiveTimeout: AppConstants.receiveTimeout,
      ));
      final res = await dio.post('/auth/login', data: {
        'email': _qrEmailCtrl.text.trim(),
        'password': _qrPasswordCtrl.text,
      });
      final token = res.data['data']['accessToken'] as String?;
      final parentUserId = res.data['data']['userId']?.toString();
      if (token == null) throw Exception('No token');

      await _activateChildMode(
        token: token,
        parentUserId: parentUserId,
        profileId: _qrProfileId!,
        profileName: _qrProfileName!,
      );
    } on DioException catch (e) {
      setState(() {
        _qrError = e.response?.data?['message'] ?? 'Invalid email or password.';
        _qrLoading = false;
      });
    } catch (e) {
      setState(() { _qrError = 'Something went wrong. Please try again.'; _qrLoading = false; });
    }
  }

  // ─── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ShieldTheme.success,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
        title: const Text('Child Device Setup',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          tabs: const [
            Tab(icon: Icon(Icons.qr_code_scanner), text: 'Scan QR Code'),
            Tab(icon: Icon(Icons.login), text: 'Manual Setup'),
          ],
        ),
      ),
      body: SafeArea(
        child: TabBarView(
          controller: _tabController,
          children: [
            _buildQrTab(),
            SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: _profiles.isEmpty ? _buildLoginStep() : _buildProfileStep(),
            ),
          ],
        ),
      ),
    );
  }

  // ─── QR Tab ────────────────────────────────────────────────────────────────

  Widget _buildQrTab() {
    if (_qrScanned && _qrProfileId != null) {
      return _buildQrConfirmStep();
    }
    return Column(
      children: [
        Expanded(
          flex: 3,
          child: Stack(
            children: [
              MobileScanner(
                controller: _scannerController,
                onDetect: _onQrDetected,
              ),
              // Overlay frame
              Center(
                child: Container(
                  width: 240,
                  height: 240,
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.white, width: 2),
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
              if (_qrError != null)
                Positioned(
                  bottom: 16,
                  left: 16,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: ShieldTheme.danger.withOpacity(0.9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_qrError!,
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        textAlign: TextAlign.center),
                  ),
                ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.all(20),
          color: ShieldTheme.success,
          child: Column(
            children: [
              const Text(
                'Point your camera at the QR code shown in the\nparent portal under Devices → Connect Device',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => _tabController.animateTo(1),
                icon: const Icon(Icons.login, color: Colors.white70, size: 18),
                label: const Text('Set up manually instead',
                    style: TextStyle(color: Colors.white70)),
                style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.white38)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildQrConfirmStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          const Icon(Icons.check_circle, color: Colors.white, size: 56),
          const SizedBox(height: 12),
          Text(
            'QR Code Scanned!',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            'Setting up device for ${_qrProfileName ?? 'child'}',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, fontSize: 14),
          ),
          const SizedBox(height: 32),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Profile info
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: ShieldTheme.success.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: ShieldTheme.success, width: 1.5),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 22,
                          backgroundColor: ShieldTheme.success,
                          child: Text(
                            (_qrProfileName ?? 'C').isNotEmpty ? (_qrProfileName ?? 'C')[0].toUpperCase() : 'C',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 18),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_qrProfileName ?? 'Child',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                              if (_qrDnsClientId != null)
                                Text('DNS: $_qrDnsClientId',
                                    style: TextStyle(color: Colors.grey.shade600, fontSize: 12,
                                        fontFamily: 'monospace')),
                            ],
                          ),
                        ),
                        const Icon(Icons.check_circle, color: ShieldTheme.success),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text("Parent's Credentials", style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  const Text('Enter parent account details to confirm setup.',
                      style: TextStyle(color: Colors.grey, fontSize: 12)),
                  const SizedBox(height: 16),
                  if (_qrError != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: ShieldTheme.danger.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: ShieldTheme.danger.withOpacity(0.3)),
                      ),
                      child: Row(children: [
                        const Icon(Icons.error_outline, color: ShieldTheme.danger, size: 16),
                        const SizedBox(width: 8),
                        Expanded(child: Text(_qrError!, style: const TextStyle(color: ShieldTheme.danger, fontSize: 13))),
                      ]),
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextFormField(
                    controller: _qrEmailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                        labelText: 'Parent Email', prefixIcon: Icon(Icons.email_outlined)),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _qrPasswordCtrl,
                    obscureText: _qrObscure,
                    decoration: InputDecoration(
                      labelText: 'Parent Password',
                      prefixIcon: const Icon(Icons.lock_outlined),
                      suffixIcon: IconButton(
                        icon: Icon(_qrObscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                        onPressed: () => setState(() => _qrObscure = !_qrObscure),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _qrLoading ? null : _activateFromQr,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(50),
                      backgroundColor: ShieldTheme.success,
                    ),
                    child: _qrLoading
                        ? const SizedBox(height: 20, width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Activate Child Mode', style: TextStyle(fontSize: 16)),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _qrScanned = false;
                        _scannerPaused = false;
                        _qrProfileId = null;
                        _qrProfileName = null;
                        _qrDnsClientId = null;
                        _qrError = null;
                      });
                      _scannerController.start();
                    },
                    child: const Text('← Scan again'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Manual Tab ────────────────────────────────────────────────────────────

  Widget _buildLoginStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        const Icon(Icons.child_care, color: Colors.white, size: 56),
        const SizedBox(height: 12),
        const Text('Set Up Child Mode', textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text(
          'Sign in with the parent account to link this device to a child profile.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white70, fontSize: 14),
        ),
        const SizedBox(height: 32),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text("Parent's Account",
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  if (_error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: ShieldTheme.danger.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: ShieldTheme.danger.withOpacity(0.3)),
                      ),
                      child: Row(children: [
                        const Icon(Icons.error_outline, color: ShieldTheme.danger, size: 16),
                        const SizedBox(width: 8),
                        Expanded(child: Text(_error!, style: const TextStyle(color: ShieldTheme.danger, fontSize: 13))),
                      ]),
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                        labelText: 'Parent Email', prefixIcon: Icon(Icons.email_outlined)),
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _password,
                    obscureText: _obscure,
                    decoration: InputDecoration(
                      labelText: 'Parent Password',
                      prefixIcon: const Icon(Icons.lock_outlined),
                      suffixIcon: IconButton(
                        icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _loading ? null : _fetchProfiles,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(50),
                      backgroundColor: ShieldTheme.success,
                    ),
                    child: _loading
                        ? const SizedBox(height: 20, width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Continue', style: TextStyle(fontSize: 16)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProfileStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        const Icon(Icons.family_restroom, color: Colors.white, size: 56),
        const SizedBox(height: 12),
        const Text('Choose Child Profile', textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('Select which child is using this device.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white70, fontSize: 14)),
        const SizedBox(height: 32),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: ShieldTheme.danger.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: ShieldTheme.danger.withOpacity(0.3)),
                    ),
                    child: Row(children: [
                      const Icon(Icons.error_outline, color: ShieldTheme.danger, size: 16),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_error!, style: const TextStyle(color: ShieldTheme.danger, fontSize: 13))),
                    ]),
                  ),
                  const SizedBox(height: 12),
                ],
                ..._profiles.map((p) {
                  final id = p['id'] as String? ?? '';
                  final name = p['name'] as String? ?? 'Child';
                  final age = p['ageGroup'] as String? ?? p['age']?.toString() ?? '';
                  final filter = p['filterLevel'] as String? ?? '';
                  final selected = _selectedProfileId == id;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
                      onTap: () => setState(() {
                        _selectedProfileId = id;
                        _selectedProfileName = name;
                      }),
                      borderRadius: BorderRadius.circular(12),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: selected ? ShieldTheme.success : Colors.grey.shade300,
                            width: selected ? 2 : 1,
                          ),
                          color: selected ? ShieldTheme.success.withOpacity(0.08) : Colors.grey.shade50,
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 22,
                              backgroundColor: selected ? ShieldTheme.success : Colors.grey.shade300,
                              child: Text(
                                name.isNotEmpty ? name[0].toUpperCase() : 'C',
                                style: TextStyle(
                                  color: selected ? Colors.white : Colors.grey.shade700,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 18,
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                                  if (age.isNotEmpty || filter.isNotEmpty)
                                    Text(
                                      [if (age.isNotEmpty) age, if (filter.isNotEmpty) '$filter filter'].join(' · '),
                                      style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                                    ),
                                ],
                              ),
                            ),
                            if (selected) const Icon(Icons.check_circle, color: ShieldTheme.success),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: (_selectedProfileId == null || _saving) ? null : () => _activateChildMode(
                    token: _accessToken!,
                    profileId: _selectedProfileId!,
                    profileName: _selectedProfileName ?? 'Child',
                  ),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                    backgroundColor: ShieldTheme.success,
                  ),
                  child: _saving
                      ? const SizedBox(height: 20, width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Activate Child Mode', style: TextStyle(fontSize: 16)),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => setState(() {
                    _profiles = [];
                    _selectedProfileId = null;
                    _error = null;
                  }),
                  child: const Text('← Use different account'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
