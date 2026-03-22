/**
 * CS-01 Live Video Check-in — parent-side button and viewer.
 *
 * Usage: <LiveCheckinButton profileId={profileId} profileName={name} />
 *
 * Flow:
 *  1. Parent clicks "Live Check-in" → POST /api/v1/location/video-checkin/request
 *  2. Dialog shows "Waiting for child to accept..."
 *  3. WebSocket delivers SESSION_CREATED → OFFER → viewer pane opens
 *  4. Parent browser creates RTCPeerConnection, sends ANSWER via /signal
 *  5. ICE candidates are exchanged; video stream plays in <video> element
 *  6. Either party ends the call → cleanup
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Box, CircularProgress, IconButton, Chip,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import CallEndIcon from '@mui/icons-material/CallEnd';
import CloseIcon from '@mui/icons-material/Close';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { Client } from '@stomp/stompjs';
import api from '../api/axios';
import { useAuthStore } from '../store/auth.store';

interface Props {
  profileId: string;
  profileName: string;
}

type SessionState = 'idle' | 'requesting' | 'waiting' | 'connecting' | 'live' | 'ended';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function LiveCheckinButton({ profileId, profileName }: Props) {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [childUserId, setChildUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const stompRef = useRef<Client | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const token = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);

  // Keep sessionIdRef in sync so STOMP callbacks always see the current value
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Elapsed timer while live
  useEffect(() => {
    if (sessionState === 'live') {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionState]);

  const formatElapsed = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── WebSocket signaling ───────────────────────────────────────────────────

  const sendSignal = useCallback(async (payload: Record<string, unknown>) => {
    try {
      await api.post('/location/video-checkin/signal', payload);
    } catch (e) {
      console.warn('LiveCheckin: signal send failed', e);
    }
  }, []);

  const setupPeerConnection = useCallback((offerSdp: string, sid: string, childId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // When we get remote tracks, show them in the video element
    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        setSessionState('live');
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'ICE_CANDIDATE',
          sessionId: sid,
          targetUserId: childId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setSessionState('ended');
      }
    };

    // Set remote description (child's offer) and create answer
    pc.setRemoteDescription({ type: 'offer', sdp: offerSdp })
      .then(() => pc.createAnswer())
      .then((answer) => {
        pc.setLocalDescription(answer);
        sendSignal({
          type: 'ANSWER',
          sessionId: sid,
          targetUserId: childId,
          sdp: { type: answer.type, sdp: answer.sdp },
        });
        // We consider it "connecting" at this point — moves to "live" when ontrack fires
        setSessionState('connecting');
      })
      .catch((e) => {
        console.error('LiveCheckin: WebRTC offer/answer failed', e);
        setError('WebRTC connection failed. The child may need to re-accept.');
        setSessionState('ended');
      });
  }, [sendSignal]);

  const connectWebSocket = useCallback((sid: string) => {
    if (!token || !userId) return;

    const client = new Client({
      brokerURL: `wss://${window.location.host}/ws/shield-ws`,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 0,
      onConnect: () => {
        // Subscribe to user-specific sync topic (same channel used for SOS / alerts)
        client.subscribe(`/topic/sync/${userId}`, (msg) => {
          try {
            const payload = JSON.parse(msg.body) as Record<string, unknown>;
            const currentSid = sessionIdRef.current;
            if (payload['sessionId'] !== currentSid) return;

            const type = payload['type'] as string;

            if (type === 'SESSION_CREATED') {
              setSessionState('waiting');
            } else if (type === 'ACCEPTED') {
              setSessionState('connecting');
            } else if (type === 'DECLINED') {
              setError('Child declined the check-in request.');
              setSessionState('ended');
            } else if (type === 'OFFER') {
              const sdpObj = payload['sdp'] as Record<string, string> | undefined;
              const childId = payload['fromUserId'] as string | undefined ?? (payload['profileId'] as string | undefined) ?? '';
              if (sdpObj?.sdp && currentSid) {
                setChildUserId(childId);
                setupPeerConnection(sdpObj.sdp, currentSid, childId);
              }
            } else if (type === 'ICE_CANDIDATE') {
              const cand = payload['candidate'] as RTCIceCandidateInit | undefined;
              if (cand && pcRef.current) {
                pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(console.warn);
              }
            } else if (type === 'ENDED' || type === 'SESSION_ENDED') {
              setSessionState('ended');
            } else if (type === 'HEARTBEAT') {
              // Child is still alive — keep state as 'live' (or 'connecting' if video not yet rendering)
              setSessionState(prev => prev === 'waiting' ? 'connecting' : prev);
            }
          } catch (e) {
            console.warn('LiveCheckin: WS message parse failed', e);
          }
        });
      },
    });

    client.activate();
    stompRef.current = client;
  }, [token, userId, setupPeerConnection]);

  const cleanup = useCallback(() => {
    stompRef.current?.deactivate();
    stompRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleRequest = async () => {
    setError(null);
    setSessionState('requesting');
    setDialogOpen(true);
    try {
      const res = await api.post<{ data: { sessionId: string; profileId: string; parentUserId: string } }>(
        '/location/video-checkin/request',
        { profileId }
      );
      const sid = res.data?.data?.sessionId ?? (res.data as any)?.sessionId;
      if (!sid) throw new Error('No sessionId returned from server');
      setSessionId(sid);
      sessionIdRef.current = sid;
      setSessionState('waiting');
      connectWebSocket(sid);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to start check-in';
      setError(msg);
      setSessionState('ended');
    }
  };

  const handleEnd = async () => {
    if (sessionId) {
      try { await api.post(`/location/video-checkin/${sessionId}/end`, {}); } catch (_) {}
    }
    cleanup();
    setSessionState('ended');
  };

  const handleClose = () => {
    cleanup();
    setSessionId(null);
    setChildUserId(null);
    setError(null);
    setSessionState('idle');
    setDialogOpen(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isActive = sessionState !== 'idle';

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<VideocamIcon />}
        onClick={handleRequest}
        disabled={isActive}
        sx={{
          borderRadius: 2,
          borderColor: '#1565C040',
          color: '#1565C0',
          fontWeight: 600,
          fontSize: 13,
          textTransform: 'none',
          '&:hover': { borderColor: '#1565C0', bgcolor: '#E3F2FD40' },
        }}
      >
        Live Check-in
      </Button>

      <Dialog
        open={dialogOpen}
        onClose={sessionState === 'idle' || sessionState === 'ended' ? handleClose : undefined}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
      >
        {/* Header */}
        <Box sx={{ height: 4, background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)' }} />
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <VideocamIcon sx={{ color: '#1565C0' }} />
            <Box>
              <Typography fontWeight={700} fontSize={16}>Live Check-in</Typography>
              <Typography variant="caption" color="text.secondary">{profileName}</Typography>
            </Box>
          </Box>
          {(sessionState === 'idle' || sessionState === 'ended') && (
            <IconButton size="small" onClick={handleClose}><CloseIcon fontSize="small" /></IconButton>
          )}
        </DialogTitle>

        <DialogContent>
          {/* Status: requesting */}
          {sessionState === 'requesting' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
              <CircularProgress size={40} sx={{ color: '#1565C0' }} />
              <Typography color="text.secondary">Sending request to {profileName}...</Typography>
            </Box>
          )}

          {/* Status: waiting for child to accept */}
          {sessionState === 'waiting' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
              <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: '#E3F2FD',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <VideocamIcon sx={{ color: '#1565C0', fontSize: 32 }} />
              </Box>
              <Typography fontWeight={600}>Waiting for {profileName} to accept...</Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                A notification has been sent to {profileName}'s device.
                The video will appear here once they accept.
              </Typography>
              <CircularProgress size={24} sx={{ color: '#1565C0', mt: 1 }} />
            </Box>
          )}

          {/* Status: connecting */}
          {sessionState === 'connecting' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
              <CircularProgress size={40} sx={{ color: '#00B0FF' }} />
              <Typography fontWeight={600}>Connecting video stream...</Typography>
              <Typography variant="body2" color="text.secondary">{profileName} accepted — establishing connection</Typography>
            </Box>
          )}

          {/* Status: live video */}
          {(sessionState === 'live' || sessionState === 'connecting') && (
            <Box sx={{ mt: sessionState === 'connecting' ? 0 : 1 }}>
              {sessionState === 'live' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Chip
                    icon={<FiberManualRecordIcon sx={{ fontSize: 10, color: 'red !important' }} />}
                    label={`LIVE  ${formatElapsed(elapsedSeconds)}`}
                    size="small"
                    sx={{ bgcolor: '#FFEBEE', color: '#C62828', fontWeight: 700, fontSize: 12 }}
                  />
                  <Typography variant="caption" color="text.secondary">{profileName}'s camera</Typography>
                </Box>
              )}
              {/* Video element — only visible when live */}
              <Box
                sx={{
                  width: '100%', aspectRatio: '4/3', bgcolor: '#0D1B2A',
                  borderRadius: 2, overflow: 'hidden', position: 'relative',
                  display: sessionState === 'live' ? 'block' : 'none',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Box>
            </Box>
          )}

          {/* Status: ended / error */}
          {sessionState === 'ended' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 1.5 }}>
              {error ? (
                <>
                  <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#FFEBEE',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <VideocamIcon sx={{ color: '#C62828', fontSize: 28 }} />
                  </Box>
                  <Typography fontWeight={600} color="error">{error}</Typography>
                </>
              ) : (
                <>
                  <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#E8F5E9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CallEndIcon sx={{ color: '#2E7D32', fontSize: 28 }} />
                  </Box>
                  <Typography fontWeight={600}>Check-in ended</Typography>
                  {elapsedSeconds > 0 && (
                    <Typography variant="caption" color="text.secondary">Duration: {formatElapsed(elapsedSeconds)}</Typography>
                  )}
                </>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          {(sessionState === 'live' || sessionState === 'connecting' || sessionState === 'waiting') && (
            <Button
              variant="contained"
              color="error"
              startIcon={<CallEndIcon />}
              onClick={handleEnd}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              End Check-in
            </Button>
          )}
          {(sessionState === 'idle' || sessionState === 'ended') && (
            <Button onClick={handleClose} sx={{ borderRadius: 2, textTransform: 'none' }}>
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
