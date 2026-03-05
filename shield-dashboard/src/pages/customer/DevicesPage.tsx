import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Button,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Stack, MenuItem, Select, InputLabel, FormControl, IconButton
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DevicesIcon from '@mui/icons-material/Devices';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import TabletIcon from '@mui/icons-material/Tablet';
import LaptopIcon from '@mui/icons-material/Laptop';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface ChildProfile { id: string; name: string; }

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

export default function DevicesPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', deviceType: 'PHONE', profileId: '' });

  const { data: children } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => []),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

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
          <Stack direction="row" spacing={1}>
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
          description="Register your child's device to start monitoring"
          action={{ label: 'Add Device', onClick: () => setAddOpen(true) }}
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
    </AnimatedPage>
  );
}
