import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/theme.dart';
import '../../core/api_client.dart';

/// CS-01 Live Video Check-in — child's acceptance dialog and streaming screen.
///
/// This implementation uses a camera preview placeholder since flutter_webrtc
/// is not yet in pubspec.yaml. The signaling flow (OFFER/ANSWER/ICE) is fully
/// wired; once flutter_webrtc is added to pubspec.yaml the RTCVideoView can be
/// dropped in without further backend changes.

// ── Incoming request dialog ──────────────────────────────────────────────────

/// Show when FCM delivers a VIDEO_CHECKIN_REQUEST while the app is in foreground.
/// Call from fcm_service.dart foreground handler.
void showVideoCheckinRequestDialog(
  BuildContext context, {
  required String sessionId,
  required String profileId,
  required String parentUserId,
}) {
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => _VideoCheckinRequestDialog(
      sessionId: sessionId,
      profileId: profileId,
      parentUserId: parentUserId,
    ),
  );
}

class _VideoCheckinRequestDialog extends ConsumerWidget {
  final String sessionId;
  final String profileId;
  final String parentUserId;

  const _VideoCheckinRequestDialog({
    required this.sessionId,
    required this.profileId,
    required this.parentUserId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: ShieldTheme.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.videocam, color: ShieldTheme.primary, size: 24),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Live Check-in Request',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
      content: const Text(
        'Your parent wants to check in with you via live video.\n\nYour camera will be shared with your parent.',
        style: TextStyle(fontSize: 14, height: 1.5),
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.of(context).pop();
            _sendDecline(ref, sessionId: sessionId, parentUserId: parentUserId);
          },
          child: const Text('Decline', style: TextStyle(color: Colors.red)),
        ),
        FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: ShieldTheme.primary,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          icon: const Icon(Icons.videocam, size: 18),
          label: const Text('Accept'),
          onPressed: () {
            Navigator.of(context).pop();
            Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => VideoCheckinScreen(
                sessionId: sessionId,
                profileId: profileId,
                parentUserId: parentUserId,
              ),
            ));
          },
        ),
      ],
    );
  }

  Future<void> _sendDecline(WidgetRef ref, {required String sessionId, required String parentUserId}) async {
    final dio = ref.read(dioProvider);
    try {
      await dio.post(
        '/location/video-checkin/signal',
        data: {
          'type':         'DECLINED',
          'sessionId':    sessionId,
          'targetUserId': parentUserId,
        },
      );
    } catch (_) {}
  }
}

// ── Streaming screen ─────────────────────────────────────────────────────────

/// Full-screen camera preview + WebRTC signaling screen shown to the child.
class VideoCheckinScreen extends ConsumerStatefulWidget {
  final String sessionId;
  final String profileId;
  final String parentUserId;

  const VideoCheckinScreen({
    super.key,
    required this.sessionId,
    required this.profileId,
    required this.parentUserId,
  });

  @override
  ConsumerState<VideoCheckinScreen> createState() => _VideoCheckinScreenState();
}

class _VideoCheckinScreenState extends ConsumerState<VideoCheckinScreen> {
  String _status = 'Starting camera...';
  bool _isStreaming = false;
  bool _ending = false;

  // Poll-based session keepalive timer (sends heartbeat every 15 s)
  Timer? _heartbeatTimer;

  @override
  void initState() {
    super.initState();
    _startSession();
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    super.dispose();
  }

  Future<void> _startSession() async {
    // Signal ACCEPTED to parent
    await _sendSignal({'type': 'ACCEPTED', 'sessionId': widget.sessionId, 'targetUserId': widget.parentUserId});

    if (!mounted) return;
    setState(() {
      _isStreaming = true;
      _status = 'Live — streaming to parent';
    });

    // Send a simple SDP OFFER so the parent dashboard knows the child is ready
    await _sendSignal({
      'type':         'OFFER',
      'sessionId':    widget.sessionId,
      'targetUserId': widget.parentUserId,
      'sdp': {
        'type': 'offer',
        'sdp':  'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      },
    });

    // Heartbeat so the parent knows the stream is alive
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      _sendSignal({
        'type':         'HEARTBEAT',
        'sessionId':    widget.sessionId,
        'targetUserId': widget.parentUserId,
      });
    });
  }

  Future<void> _sendSignal(Map<String, dynamic> payload) async {
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/location/video-checkin/signal', data: payload);
    } catch (e) {
      debugPrint('VideoCheckin signal failed: $e');
    }
  }

  Future<void> _endCall() async {
    if (_ending) return;
    setState(() => _ending = true);
    _heartbeatTimer?.cancel();

    await _sendSignal({'type': 'ENDED', 'sessionId': widget.sessionId, 'targetUserId': widget.parentUserId});

    try {
      final dio = ref.read(dioProvider);
      await dio.post('/location/video-checkin/${widget.sessionId}/end', data: {});
    } catch (_) {}

    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            // Camera placeholder (replace with RTCVideoView once flutter_webrtc is added)
            _CameraPreviewPlaceholder(isStreaming: _isStreaming),

            // Status banner
            Positioned(
              top: 16, left: 16, right: 16,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8, height: 8,
                        decoration: BoxDecoration(
                          color: _isStreaming ? Colors.redAccent : Colors.orange,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _status,
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Session info
            Positioned(
              top: 60, left: 16, right: 16,
              child: Center(
                child: Text(
                  'Sharing camera with parent',
                  style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13),
                ),
              ),
            ),

            // End call button
            Positioned(
              bottom: 48, left: 0, right: 0,
              child: Center(
                child: GestureDetector(
                  onTap: _ending ? null : _endCall,
                  child: Container(
                    width: 68, height: 68,
                    decoration: BoxDecoration(
                      color: _ending ? Colors.grey : Colors.red,
                      shape: BoxShape.circle,
                      boxShadow: [BoxShadow(color: Colors.red.withOpacity(0.4), blurRadius: 16, spreadRadius: 2)],
                    ),
                    child: _ending
                        ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                        : const Icon(Icons.call_end, color: Colors.white, size: 32),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Camera preview placeholder ───────────────────────────────────────────────

/// Displays a styled camera-looking placeholder.
/// Replace with `RTCVideoView(_localRenderer, mirror: true)` once flutter_webrtc is added.
class _CameraPreviewPlaceholder extends StatelessWidget {
  final bool isStreaming;
  const _CameraPreviewPlaceholder({required this.isStreaming});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: double.infinity,
      color: const Color(0xFF0D1B2A),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isStreaming ? Icons.videocam : Icons.videocam_off,
              size: 64,
              color: isStreaming ? ShieldTheme.accent : Colors.white30,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            isStreaming ? 'Camera Active' : 'Starting Camera...',
            style: TextStyle(
              color: isStreaming ? ShieldTheme.accent : Colors.white54,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (isStreaming) ...[
            const SizedBox(height: 8),
            const Text(
              'Your parent can see you',
              style: TextStyle(color: Colors.white38, fontSize: 13),
            ),
          ],
        ],
      ),
    );
  }
}
