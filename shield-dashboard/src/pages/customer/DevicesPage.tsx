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
import QrCodeIcon from '@mui/icons-material/QrCode';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DnsIcon from '@mui/icons-material/Dns';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AndroidIcon from '@mui/icons-material/Android';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

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
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  PHONE: <PhoneAndroidIcon />,
  TABLET: <TabletIcon />,
  LAPTOP: <LaptopIcon />,
  DESKTOP: <DesktopWindowsIcon />,
};

const DEVICE_COLORS: Record<string, { color: string; bg: string }> = {
  PHONE: { color: '#1565C0', bg: '#E3F2FD' },
  TABLET: { color: '#7B1FA2', bg: '#F3E5F5' },
  LAPTOP: { color: '#00897B', bg: '#E0F2F1' },
  DESKTOP: { color: '#FB8C00', bg: '#FFF3E0' },
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

function SetupDnsDialog({ child, open, onClose }: { child: ChildProfile; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const privateDns = child.dnsClientId ? `${child.dnsClientId}.dns.shield.rstglobal.in` : '';

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
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#00897B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>1</Box>
              <Typography fontWeight={600} fontSize={14}>Download the Shield App</Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Typography variant="body2" color="text.secondary" mb={1.5}>
                Install the Shield app on {child.name}'s Android device to enable full content filtering and activity monitoring.
              </Typography>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                href="/shield-app.apk"
                download="Shield.apk"
                sx={{ bgcolor: '#00897B', '&:hover': { bgcolor: '#00796B' }, textTransform: 'none', fontWeight: 600 }}
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
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#00897B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>2</Box>
              <Typography fontWeight={600} fontSize={14}>Scan QR Code to Configure DNS</Typography>
            </Box>
            <Box sx={{ pl: 4 }}>
              <Typography variant="body2" color="text.secondary" mb={1.5}>
                Open the Shield app on {child.name}'s device and tap <strong>Scan QR Code</strong> to automatically configure Private DNS filtering.
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                {qrLoading ? (
                  <Box sx={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F5F5F5', borderRadius: 2 }}>
                    <CircularProgress size={32} sx={{ color: '#00897B' }} />
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 1.5, px: 2, py: 1.25 }}>
                  <DnsIcon sx={{ color: '#1565C0', fontSize: 18, flexShrink: 0 }} />
                  <Typography sx={{ fontFamily: 'monospace', fontSize: 13, color: '#1565C0', flex: 1, wordBreak: 'break-all' }}>
                    {privateDns}
                  </Typography>
                  <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                    <IconButton size="small" onClick={() => handleCopy(privateDns)} sx={{ color: copied ? '#00897B' : '#1565C0' }}>
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

export default function DevicesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [setupChild, setSetupChild] = useState<ChildProfile | null>(null);
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

  const onlineCount = (devices || []).filter(d => d.online).length;

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
                  bgcolor: (profileId === c.id) ? '#00897B' : '#E0F2F1',
                  color: (profileId === c.id) ? 'white' : '#00897B',
                  '&:hover': { bgcolor: (profileId === c.id) ? '#00796B' : '#B2DFDB' },
                }}
              />
            ))}
            {activeChild && (
              <Button
                variant="outlined"
                startIcon={<QrCodeIcon />}
                onClick={() => setSetupChild(activeChild)}
                sx={{ borderColor: '#00897B', color: '#00897B', '&:hover': { bgcolor: '#E0F2F1' }, textTransform: 'none', fontWeight: 600 }}
              >
                Connect Device
              </Button>
            )}
            {profileId && (
              <Button
                variant="outlined"
                startIcon={<AndroidIcon />}
                onClick={() => navigate(`/profiles/${profileId}/apps`)}
                sx={{ borderColor: '#43A047', color: '#43A047', '&:hover': { bgcolor: '#F1F8E9' }, textTransform: 'none', fontWeight: 600 }}
              >
                View Apps
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
              sx={{ bgcolor: '#00897B', '&:hover': { bgcolor: '#00796B' } }}
            >
              Add Device
            </Button>
          </Stack>
        }
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : !devices || devices.length === 0 ? (
        <EmptyState
          icon={<DevicesIcon sx={{ fontSize: 36, color: '#00897B' }} />}
          title="No devices registered"
          description="Connect your child's device to start monitoring"
          action={{ label: 'Connect Device', onClick: () => activeChild && setSetupChild(activeChild) }}
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
                    borderTop: `4px solid ${device.online ? '#43A047' : '#E0E0E0'}`,
                    transition: 'all 0.2s ease',
                    '&:hover': { transform: 'translateY(-3px)' },
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
                          sx={{ color: '#E53935', '&:hover': { bgcolor: '#FFEBEE' } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>

                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Status</Typography>
                          <Chip
                            size="small"
                            icon={device.online ? <WifiIcon sx={{ fontSize: 14 }} /> : <WifiOffIcon sx={{ fontSize: 14 }} />}
                            label={device.online ? 'Online' : 'Offline'}
                            color={device.online ? 'success' : 'default'}
                            sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                          />
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Last Seen</Typography>
                          <Typography variant="caption" fontWeight={500}>{formatDate(device.lastSeenAt)}</Typography>
                        </Box>

                        {device.dnsMethod && (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">DNS Method</Typography>
                            <Chip
                              size="small"
                              label={device.dnsMethod}
                              sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: '#E3F2FD', color: '#1565C0' }}
                            />
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

                      <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #F0F0F0' }}>
                        <Button
                          size="small"
                          startIcon={<QrCodeIcon />}
                          onClick={() => activeChild && setSetupChild(activeChild)}
                          sx={{ color: '#00897B', fontWeight: 600, fontSize: 12, textTransform: 'none', '&:hover': { bgcolor: '#E0F2F1' } }}
                        >
                          Setup DNS Filtering
                        </Button>
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
            sx={{ bgcolor: '#00897B', '&:hover': { bgcolor: '#00796B' } }}
          >
            {addMutation.isPending ? 'Registering...' : 'Register'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Setup DNS Dialog */}
      {setupChild && (
        <SetupDnsDialog
          child={setupChild}
          open={!!setupChild}
          onClose={() => setSetupChild(null)}
        />
      )}
    </AnimatedPage>
  );
}
