import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Button,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Stack, MenuItem, Select, InputLabel, FormControl, IconButton, Tooltip,
  Divider, Alert,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import DevicesIcon from '@mui/icons-material/Devices';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import TabletIcon from '@mui/icons-material/Tablet';
import LaptopIcon from '@mui/icons-material/Laptop';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import SpeedIcon from '@mui/icons-material/Speed';
import QrCodeIcon from '@mui/icons-material/QrCode';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DnsIcon from '@mui/icons-material/Dns';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AndroidIcon from '@mui/icons-material/Android';
import WindowIcon from '@mui/icons-material/Window';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface ChildProfile {
  id: string;
  name: string;
  dnsClientId?: string;
  dohUrl?: string;
}

interface Device {
  id: string;
  profileId: string;
  name: string;
  deviceType: string;
  macAddress?: string;
  online: boolean;
  lastSeenAt?: string;
  dnsMethod?: string;
  createdAt?: string;
  batteryPct?: number;
  speedKmh?: number;
  appVersion?: string;
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  PHONE: <PhoneAndroidIcon />,
  TABLET: <TabletIcon />,
  LAPTOP: <LaptopIcon />,
  DESKTOP: <DesktopWindowsIcon />,
};

const DEVICE_COLORS: Record<string, { color: string; bg: string }> = {
  PHONE: { color: 'primary.main', bg: '#E3F2FD' },
  TABLET: { color: '#7B1FA2', bg: '#F3E5F5' },
  LAPTOP: { color: '#00897B', bg: '#E0F2F1' },
  DESKTOP: { color: 'warning.main', bg: '#FFF3E0' },
};

function formatDate(iso?: string) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

/**
 * Calculate online status from lastSeenAt (within 5 minutes).
 * Falls back to the backend `online` boolean only when lastSeenAt is absent.
 */
function isOnline(device: Device): boolean {
  if (device.lastSeenAt) {
    const diffMin = (Date.now() - new Date(device.lastSeenAt).getTime()) / 1000 / 60;
    return diffMin < 5;
  }
  return device.online;
}

function SetupDnsDialog({ child, open, onClose }: { child: ChildProfile; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  // Derive the Private DNS hostname from dohUrl if available, otherwise fall back to dnsClientId
  const privateDns = child.dohUrl
    ? child.dohUrl.replace(/^https?:\/\//, '').replace('/dns-query', '')
    : child.dnsClientId ? `${child.dnsClientId}.dns.shield.rstglobal.in` : '';

  const { data: qrUrl, isLoading: qrLoading } = useQuery({
    queryKey: ['qr-image', child.id],
    queryFn: async () => {
      const resp = await api.get(`/profiles/devices/qr/${child.id}/image`, { responseType: 'blob' });
      return URL.createObjectURL(resp.data);
    },
    enabled: open && !!child.id,
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCodeIcon sx={{ color: '#00897B' }} />
          <Box>
            <Typography fontWeight={700}>Connect {child.name}'s Device</Typography>
            <Typography variant="caption" color="text.secondary">Set up Private DNS filtering on Android</Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>

          {/* Step 1 — Download App */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'secondary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>1</Box>
              <Typography fontWeight={600} fontSize={14}>Download the Shield App</Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Typography variant="body2" color="text.secondary" mb={1.5}>
                Install the Shield app on {child.name}'s Android device to enable full content filtering and activity monitoring.
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<DownloadIcon />}
                href="/shield-app.apk"
                download="Shield.apk"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Download Shield App (APK)
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                Android only · Enable "Install unknown apps" in device settings before installing
              </Typography>
            </Box>
          </Box>

          <Divider />

          {/* Step 2 — QR Code */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'secondary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>2</Box>
              <Typography fontWeight={600} fontSize={14}>Scan QR Code to Configure DNS</Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Typography variant="body2" color="text.secondary" mb={1.5}>
                Open the Shield app on {child.name}'s device and tap <strong>Scan QR Code</strong> to automatically configure Private DNS filtering.
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                {qrLoading ? (
                  <Box sx={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 2 }}>
                    <CircularProgress size={32} color="secondary" />
                  </Box>
                ) : qrUrl ? (
                  <Box sx={{ p: 1.5, bgcolor: '#fff', border: '2px solid #E0E0E0', borderRadius: 2, display: 'inline-block' }}>
                    <img src={qrUrl} alt="DNS Setup QR Code" style={{ width: 160, height: 160, display: 'block' }} />
                  </Box>
                ) : (
                  <Alert severity="warning" sx={{ width: '100%' }}>QR code unavailable — use the manual method below.</Alert>
                )}
              </Box>
            </Box>
          </Box>

          <Divider />

          {/* Step 3 — Manual DNS */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#78909C', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>3</Box>
              <Typography fontWeight={600} fontSize={14}>Or Set Up Manually (Android 9+)</Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Typography variant="body2" color="text.secondary" mb={1.5}>
                Go to <strong>Settings → Network → Private DNS</strong> and enter the hostname below:
              </Typography>

              {privateDns ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'primary.light', border: '1px solid', borderColor: 'primary.light', borderRadius: 1.5, px: 2, py: 1.25 }}>
                  <DnsIcon sx={{ color: 'primary.main', fontSize: 18, flexShrink: 0 }} />
                  <Typography sx={{ fontFamily: 'monospace', fontSize: 13, color: 'primary.main', flex: 1, wordBreak: 'break-all' }}>
                    {privateDns}
                  </Typography>
                  <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                    <IconButton size="small" onClick={() => handleCopy(privateDns)} sx={{ color: copied ? 'secondary.main' : 'primary.main' }}>
                      {copied ? <CheckCircleIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Box>
              ) : (
                <Alert severity="info">DNS hostname not provisioned yet. Try refreshing the page.</Alert>
              )}

              <Box component="ol" sx={{ mt: 1.5, pl: 2.5, '& li': { fontSize: 13, color: 'text.secondary', mb: 0.5 } }}>
                <li>Open <strong>Settings</strong> on {child.name}'s Android device</li>
                <li>Go to <strong>Network &amp; internet → Advanced → Private DNS</strong></li>
                <li>Select <strong>Private DNS provider hostname</strong></li>
                <li>Paste the hostname above and tap <strong>Save</strong></li>
              </Box>
            </Box>
          </Box>

        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">Done</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Windows Agent Pairing Dialog ────────────────────────────────────────────
function WindowsPairingDialog({ child, open, onClose }: { child: ChildProfile; open: boolean; onClose: () => void }) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'intro' | 'code'>('intro');
  const [scriptDownloading, setScriptDownloading] = useState(false);

  const handleDownloadScript = async () => {
    setScriptDownloading(true);
    try {
      const res = await api.get('/profiles/devices/setup-script', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ShieldSetup.ps1';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore — rare
    } finally {
      setScriptDownloading(false);
    }
  };

  const handleGenerateCode = async () => {
    setCodeLoading(true);
    setCodeError('');
    try {
      const r = await api.post('/profiles/devices/pairing-code', { profileId: child.id, platform: 'windows' });
      setPairingCode(r.data?.data?.code ?? r.data?.code);
      setStep('code');
    } catch {
      setCodeError('Failed to generate pairing code. Try again.');
    } finally {
      setCodeLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setPairingCode(null);
    setStep('intro');
    setCodeError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WindowIcon sx={{ color: '#0078D4' }} />
          <Box>
            <Typography fontWeight={700}>Connect Windows PC for {child.name}</Typography>
            <Typography variant="caption" color="text.secondary">Install Shield Agent to protect this Windows device</Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Step 1 — Download installer */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#0078D4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>1</Box>
              <Typography fontWeight={600} fontSize={14}>Download Shield Setup for Windows</Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              {/* Recommended: PowerShell all-in-one */}
              <Box sx={{ p: 1.5, border: '1.5px solid #0078D4', borderRadius: 2, bgcolor: '#F0F8FF', mb: 1.5 }}>
                <Typography variant="body2" fontWeight={600} color="#0078D4" mb={0.5}>
                  Recommended — PowerShell Setup Script
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={1.5} fontSize={13}>
                  One script that asks for your Shield login, pairing code, then installs everything automatically. Run as Administrator on {child.name}'s PC.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={scriptDownloading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <DownloadIcon />}
                  onClick={handleDownloadScript}
                  disabled={scriptDownloading}
                  sx={{ textTransform: 'none', fontWeight: 600, bgcolor: '#0078D4', '&:hover': { bgcolor: '#005a9e' } }}
                >
                  {scriptDownloading ? 'Downloading…' : 'Download ShieldSetup.ps1'}
                </Button>
                <Box sx={{ mt: 1, p: 1, bgcolor: '#1E1E1E', borderRadius: 1 }}>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: 12, color: '#4EC9B0' }}>
                    {'# Open PowerShell as Administrator, then run:'}
                  </Typography>
                  <Typography sx={{ fontFamily: 'monospace', fontSize: 13, color: '#DCDCAA', userSelect: 'all' }}>
                    {'powershell -ExecutionPolicy Bypass -File .\\ShieldSetup.ps1'}
                  </Typography>
                </Box>
                <Alert severity="info" sx={{ mt: 1, fontSize: 12, py: 0 }}>
                  <strong>If you see "not digitally signed" error</strong> — this is normal for unsigned scripts. Use the command above with <code>-ExecutionPolicy Bypass</code> to run it.
                </Alert>
              </Box>
              {/* Alternative: EXE direct */}
              <Typography variant="caption" color="text.secondary" mb={0.5} sx={{ display: 'block' }}>
                Advanced: download agent EXE separately
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                href="/static/ShieldAgent.exe"
                download="ShieldAgent.exe"
                sx={{ textTransform: 'none', fontSize: 12 }}
              >
                ShieldAgent.exe (8.0 MB)
              </Button>
            </Box>
          </Box>

          <Divider />

          {/* Step 2 — Generate pairing code */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#0078D4', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>2</Box>
              <Typography fontWeight={600} fontSize={14}>Generate a Pairing Code</Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Typography variant="body2" color="text.secondary" mb={1.5}>
                Generate a 6-digit code (valid 15 min) and enter it in the installer on {child.name}'s PC.
              </Typography>
              {!pairingCode ? (
                <Button
                  variant="outlined"
                  onClick={handleGenerateCode}
                  disabled={codeLoading}
                  startIcon={codeLoading ? <CircularProgress size={16} /> : <WindowIcon />}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  {codeLoading ? 'Generating…' : 'Generate Pairing Code'}
                </Button>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Box sx={{ px: 3, py: 1.5, bgcolor: '#E3F2FD', borderRadius: 2, border: '2px solid #0078D4' }}>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 800, letterSpacing: 6, color: '#0078D4' }}>
                        {pairingCode}
                      </Typography>
                    </Box>
                    <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
                      <IconButton onClick={() => handleCopy(pairingCode)} sx={{ color: copied ? 'success.main' : '#0078D4' }}>
                        {copied ? <CheckCircleIcon /> : <ContentCopyIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Generate new code">
                      <IconButton onClick={handleGenerateCode} disabled={codeLoading} sx={{ color: 'text.secondary' }}>
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Alert severity="info" sx={{ fontSize: 13 }}>
                    Enter this code when the installer asks for a pairing code. It expires in 15 minutes.
                  </Alert>
                </Box>
              )}
              {codeError && <Alert severity="error" sx={{ mt: 1 }}>{codeError}</Alert>}
            </Box>
          </Box>

          <Divider />

          {/* Step 3 — How it works */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#78909C', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>3</Box>
              <Typography fontWeight={600} fontSize={14}>What the Agent Does</Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Box component="ul" sx={{ m: 0, pl: 2, '& li': { fontSize: 13, color: 'text.secondary', mb: 0.5 } }}>
                <li>Installs as a <strong>Windows service</strong> (starts automatically on boot)</li>
                <li>Intercepts all DNS queries and filters through Shield's <strong>{child.name || 'child'}'s profile rules</strong></li>
                <li>Detects and <strong>blocks DNS bypass attempts</strong> (VPN, DNS-over-HTTPS bypass)</li>
                <li>Reports <strong>real-time activity</strong> to your Shield dashboard</li>
                <li>Enforces <strong>screen time budgets</strong> and <strong>bedtime locks</strong></li>
              </Box>
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined">Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DevicesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [setupChild, setSetupChild] = useState<ChildProfile | null>(null);
  const [winPairChild, setWinPairChild] = useState<ChildProfile | null>(null);
  const [newDevice, setNewDevice] = useState({ name: '', deviceType: 'PHONE', profileId: '' });

  const { data: children } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => []),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);
  const activeChild = (children || []).find(c => c.id === profileId) ?? null;

  const [scriptDownloading, setScriptDownloading] = useState(false);
  const handleDownloadScript = async () => {
    setScriptDownloading(true);
    try {
      const res = await api.get('/profiles/devices/setup-script', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ShieldSetup.ps1';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* ignore */ } finally {
      setScriptDownloading(false);
    }
  };

  const { data: devices, isLoading } = useQuery({
    queryKey: ['devices', profileId],
    queryFn: () => api.get(`/profiles/devices/profile/${profileId}`).then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as Device[];
    }),
    enabled: !!profileId,
  });

  const addMutation = useMutation({
    mutationFn: (data: { name: string; deviceType: string; profileId: string }) =>
      api.post('/profiles/devices', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices', profileId] });
      setAddOpen(false);
      setNewDevice({ name: '', deviceType: 'PHONE', profileId: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/profiles/devices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices', profileId] }),
  });

  const handleAdd = () => {
    addMutation.mutate({ ...newDevice, profileId: profileId! });
  };

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<DevicesIcon />} title="Devices" subtitle="Manage connected devices" iconColor="#00897B" />
        <EmptyState title="No child profiles" description="Add a child profile first to manage devices" />
      </AnimatedPage>
    );
  }

  const onlineCount = (devices || []).filter(d => isOnline(d)).length;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<DevicesIcon />}
        title="Devices"
        subtitle={`${(devices || []).length} devices registered${onlineCount ? ` (${onlineCount} online)` : ''}`}
        iconColor="#00897B"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {(children || []).map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? 'secondary.main' : 'success.light',
                  color: (profileId === c.id) ? 'white' : 'secondary.main',
                  '&:hover': { filter: 'brightness(0.92)' },
                }}
              />
            ))}
            {activeChild && (
              <Button
                variant="outlined"
                startIcon={<QrCodeIcon />}
                onClick={() => setSetupChild(activeChild)}
                sx={{ borderColor: 'secondary.main', color: 'secondary.main', '&:hover': { bgcolor: 'success.light' }, textTransform: 'none', fontWeight: 600 }}
              >
                Android / iOS
              </Button>
            )}
            {activeChild && (
              <Button
                variant="outlined"
                startIcon={<WindowIcon />}
                onClick={() => setWinPairChild(activeChild)}
                sx={{ borderColor: '#0078D4', color: '#0078D4', '&:hover': { bgcolor: '#E3F2FD' }, textTransform: 'none', fontWeight: 600 }}
              >
                Windows PC
              </Button>
            )}
            {profileId && (
              <Button
                variant="outlined"
                startIcon={<AndroidIcon />}
                onClick={() => navigate(`/profiles/${profileId}/apps`)}
                sx={{ borderColor: 'success.main', color: 'success.main', '&:hover': { bgcolor: 'success.light' }, textTransform: 'none', fontWeight: 600 }}
              >
                View Apps
              </Button>
            )}
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
            >
              Add Device
            </Button>
          </Stack>
        }
      />

      {/* ── Connect a New Device Banner ─────────────────────────────────────── */}
      {children && children.length > 0 && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {/* Android card */}
          <Card
            onClick={() => activeChild && setSetupChild(activeChild)}
            sx={{
              flex: '1 1 220px', cursor: 'pointer',
              bgcolor: '#FFFFFF', border: 'none',
              boxShadow: '0 8px 32px -4px rgba(15,31,61,0.06)', borderRadius: '12px',
              transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 32px -4px rgba(46,125,50,0.14)' },
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}>
              <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AndroidIcon sx={{ color: '#2E7D32', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography fontWeight={700} fontSize={13}>Connect Android / iOS</Typography>
                <Typography variant="caption" color="text.secondary">QR code setup, Private DNS</Typography>
              </Box>
              <QrCodeIcon sx={{ color: 'secondary.main', ml: 'auto', flexShrink: 0 }} />
            </CardContent>
          </Card>

          {/* Windows PC card (per child — open pairing dialog) */}
          {children.map(c => (
            <Card
              key={c.id}
              onClick={() => setWinPairChild(c)}
              sx={{
                flex: '1 1 220px', cursor: 'pointer', border: '2px solid transparent',
                transition: 'all 0.2s', '&:hover': { borderColor: '#0078D4', transform: 'translateY(-2px)' },
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <WindowIcon sx={{ color: '#0078D4', fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography fontWeight={700} fontSize={13}>Windows PC — {c.name}</Typography>
                  <Typography variant="caption" color="text.secondary">Pair &amp; get pairing code</Typography>
                </Box>
                <DownloadIcon sx={{ color: '#0078D4', ml: 'auto', flexShrink: 0 }} />
              </CardContent>
            </Card>
          ))}

          {/* PowerShell setup script card — no child required, authenticated download */}
          <Card
            onClick={handleDownloadScript}
            sx={{
              flex: '1 1 220px', cursor: 'pointer', border: '2px solid transparent',
              transition: 'all 0.2s', '&:hover': { borderColor: '#0078D4', transform: 'translateY(-2px)' },
              opacity: scriptDownloading ? 0.7 : 1,
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}>
              <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: '#EDE7F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {scriptDownloading ? <CircularProgress size={20} /> : <DownloadIcon sx={{ color: '#5E35B1', fontSize: 22 }} />}
              </Box>
              <Box>
                <Typography fontWeight={700} fontSize={13}>Download Setup Script</Typography>
                <Typography variant="caption" color="text.secondary">ShieldSetup.ps1 — Windows installer</Typography>
              </Box>
              <WindowIcon sx={{ color: '#5E35B1', ml: 'auto', flexShrink: 0 }} />
            </CardContent>
          </Card>
        </Box>
      )}

      {isLoading ? (
        <LoadingPage />
      ) : !devices || devices.length === 0 ? (
        <EmptyState
          icon={<DevicesIcon sx={{ fontSize: 36, color: '#00897B' }} />}
          title="No devices registered"
          description="Use the cards above to connect Android or Windows devices"
          action={undefined}
        />
      ) : (
        <Grid container spacing={2.5}>
          {devices.map((device, i) => {
            const typeConf = DEVICE_COLORS[device.deviceType] || DEVICE_COLORS.PHONE;
            const icon = DEVICE_ICONS[device.deviceType] || <DevicesIcon />;

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={device.id}>
                <AnimatedPage delay={0.1 + i * 0.05}>
                  <Card sx={{
                    bgcolor: '#FFFFFF', border: 'none',
                    boxShadow: '0 8px 32px -4px rgba(15,31,61,0.06)',
                    borderRadius: '12px',
                    overflow: 'hidden', position: 'relative',
                    transition: 'transform 0.22s ease, box-shadow 0.22s ease',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 32px -4px rgba(15,31,61,0.10)' },
                    '&::before': {
                      content: '""', position: 'absolute',
                      top: 0, left: 0, bottom: 0, width: 3,
                      background: isOnline(device) ? '#2E7D32' : '#C4D0DC',
                      borderRadius: '12px 0 0 12px',
                    },
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{
                            width: 48, height: 48, borderRadius: '12px',
                            bgcolor: typeConf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: typeConf.color, '& .MuiSvgIcon-root': { fontSize: 24 },
                          }}>
                            {icon}
                          </Box>
                          <Box>
                            <Typography variant="body1" fontWeight={600}>{device.name}</Typography>
                            <Chip
                              size="small"
                              label={device.deviceType}
                              sx={{
                                height: 20, fontSize: 10, fontWeight: 600,
                                bgcolor: typeConf.bg, color: typeConf.color,
                              }}
                            />
                          </Box>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => deleteMutation.mutate(device.id)}
                          sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.light' } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>

                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Status</Typography>
                          <Chip
                            size="small"
                            icon={isOnline(device) ? <WifiIcon sx={{ fontSize: 14 }} /> : <WifiOffIcon sx={{ fontSize: 14 }} />}
                            label={isOnline(device) ? 'Online' : (device.lastSeenAt ? formatDate(device.lastSeenAt) : 'Offline')}
                            color={isOnline(device) ? 'success' : 'default'}
                            sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                          />
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Last Seen</Typography>
                          <Typography variant="caption" fontWeight={500}>{formatDate(device.lastSeenAt)}</Typography>
                        </Box>

                        {device.batteryPct != null && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">Battery</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <BatteryFullIcon sx={{ fontSize: 14, color: device.batteryPct < 20 ? 'error.main' : device.batteryPct < 50 ? 'warning.main' : 'success.main' }} />
                              <Typography variant="caption" fontWeight={500}>{device.batteryPct}%</Typography>
                            </Box>
                          </Box>
                        )}

                        {device.speedKmh != null && device.speedKmh > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">Speed</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <SpeedIcon sx={{ fontSize: 14, color: '#546E7A' }} />
                              <Typography variant="caption" fontWeight={500}>{Number(device.speedKmh).toFixed(1)} km/h</Typography>
                            </Box>
                          </Box>
                        )}

                        {device.dnsMethod && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">DNS Method</Typography>
                            <Chip
                              size="small"
                              label={device.dnsMethod}
                              sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: 'primary.light', color: 'primary.main' }}
                            />
                          </Box>
                        )}

                        {device.appVersion && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">App Version</Typography>
                            <Typography variant="caption" fontWeight={500}>v{device.appVersion}</Typography>
                          </Box>
                        )}

                        {device.macAddress && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">MAC</Typography>
                            <Typography variant="caption" fontWeight={500} sx={{ fontFamily: 'monospace' }}>
                              {device.macAddress}
                            </Typography>
                          </Box>
                        )}
                      </Stack>

                      <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #F0F0F0', display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          startIcon={<QrCodeIcon />}
                          onClick={() => activeChild && setSetupChild(activeChild)}
                          sx={{ color: 'secondary.main', fontWeight: 600, fontSize: 12, textTransform: 'none', '&:hover': { bgcolor: 'success.light' } }}
                        >
                          Android
                        </Button>
                        {(device.deviceType === 'LAPTOP' || device.deviceType === 'DESKTOP' || device.deviceType === 'WINDOWS_PC') && (
                          <Button
                            size="small"
                            startIcon={<WindowIcon />}
                            onClick={() => activeChild && setWinPairChild(activeChild)}
                            sx={{ color: '#0078D4', fontWeight: 600, fontSize: 12, textTransform: 'none', '&:hover': { bgcolor: '#E3F2FD' } }}
                          >
                            Windows
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </AnimatedPage>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Add Device Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Register Device</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Device Name"
              value={newDevice.name}
              onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
              placeholder="e.g. Alex's Phone"
              fullWidth size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Device Type</InputLabel>
              <Select
                value={newDevice.deviceType}
                label="Device Type"
                onChange={e => setNewDevice({ ...newDevice, deviceType: e.target.value })}
              >
                <MenuItem value="PHONE">Phone</MenuItem>
                <MenuItem value="TABLET">Tablet</MenuItem>
                <MenuItem value="LAPTOP">Laptop</MenuItem>
                <MenuItem value="DESKTOP">Desktop</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!newDevice.name || addMutation.isPending}
            color="secondary"
          >
            {addMutation.isPending ? 'Registering...' : 'Register'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Setup DNS Dialog (Android) */}
      {setupChild && (
        <SetupDnsDialog
          child={setupChild}
          open={!!setupChild}
          onClose={() => setSetupChild(null)}
        />
      )}

      {/* Windows Agent Pairing Dialog */}
      {winPairChild && (
        <WindowsPairingDialog
          child={winPairChild}
          open={!!winPairChild}
          onClose={() => setWinPairChild(null)}
        />
      )}
    </AnimatedPage>
  );
}
