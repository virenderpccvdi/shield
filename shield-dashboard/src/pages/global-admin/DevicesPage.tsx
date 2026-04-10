import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, TablePagination, Chip, TextField, InputAdornment, Stack, Grid, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import DevicesIcon from '@mui/icons-material/Devices';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import TabletIcon from '@mui/icons-material/Tablet';
import LaptopIcon from '@mui/icons-material/Laptop';
import TvIcon from '@mui/icons-material/Tv';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import SkeletonTable from '../../components/SkeletonTable';
import EmptyState from '../../components/EmptyState';
import { gradients } from '../../theme/theme';

interface Device {
  id: string; profileId: string; tenantId: string; name: string;
  deviceType: string; macAddress?: string; online: boolean;
  lastSeenAt?: string; dnsMethod: string; createdAt: string;
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  PHONE: <PhoneAndroidIcon fontSize="small" />,
  TABLET: <TabletIcon fontSize="small" />,
  LAPTOP: <LaptopIcon fontSize="small" />,
  TV: <TvIcon fontSize="small" />,
  CONSOLE: <SportsEsportsIcon fontSize="small" />,
};

const DNS_METHOD_COLOR: Record<string, { bg: string; color: string }> = {
  DOH: { bg: '#E3F2FD', color: '#1565C0' },
  WIREGUARD: { bg: '#F3E5F5', color: '#7B1FA2' },
  DHCP: { bg: '#FFF3E0', color: '#92400E' },
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

export default function DevicesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [confirmDelete, setConfirmDelete] = useState<Device | null>(null);

  useEffect(() => { setPage(0); }, [search]);

  const { data: statsData } = useQuery({
    queryKey: ['device-stats'],
    queryFn: () => api.get('/profiles/devices/stats').then(r => r.data?.data || r.data).catch(() => ({ totalDevices: 0, onlineDevices: 0 })),
  });

  const { data: devicesData, isLoading } = useQuery({
    queryKey: ['admin-devices', page, rowsPerPage],
    queryFn: () => api.get(`/profiles/devices/all?page=${page}&size=${rowsPerPage}`).then(r => {
      const d = r.data?.data;
      return { devices: (d?.content ?? d ?? []) as Device[], total: d?.totalElements ?? 0 };
    }).catch(() => ({ devices: [], total: 0 })),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/profiles/devices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-devices'] });
      qc.invalidateQueries({ queryKey: ['device-stats'] });
      setConfirmDelete(null);
    },
  });

  const stats = statsData || { totalDevices: 0, onlineDevices: 0 };
  const allDevices = devicesData?.devices ?? [];
  const totalElements = devicesData?.total ?? 0;
  const devices = allDevices.filter(d =>
    `${d.name} ${d.deviceType} ${d.macAddress || ''} ${d.dnsMethod}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AnimatedPage>
      <PageHeader
        icon={<DevicesIcon />}
        title="Devices"
        subtitle="All registered devices across tenants"
        iconColor="#1565C0"
        action={
          <TextField size="small" placeholder="Search devices..." value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ width: 260 }} />
        }
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="Total Devices" value={stats.totalDevices} icon={<DevicesIcon />} gradient={gradients.blue} delay={0.1} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="Online Now" value={stats.onlineDevices} icon={<FiberManualRecordIcon />} gradient="linear-gradient(135deg, #2E7D32 0%, #66BB6A 100%)" delay={0.2} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="Offline" value={Math.max(0, stats.totalDevices - stats.onlineDevices)} icon={<FiberManualRecordIcon />} gradient="linear-gradient(135deg, #78909C 0%, #B0BEC5 100%)" delay={0.3} />
        </Grid>
      </Grid>

      {/* Summary by type */}
      <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap">
        {['PHONE', 'TABLET', 'LAPTOP', 'TV', 'CONSOLE'].map(type => {
          const count = allDevices.filter(d => d.deviceType === type).length;
          return count > 0 ? (
            <Chip key={type} icon={DEVICE_ICONS[type] as any} label={`${type}: ${count}`} size="small"
              sx={{ fontWeight: 600 }} variant="outlined" />
          ) : null;
        })}
      </Stack>

      {isLoading ? (
        <Card><Paper><SkeletonTable rows={8} columns={7} /></Paper></Card>
      ) : devices.length === 0 ? (
        <Card>
          <EmptyState
            icon={<DevicesIcon sx={{ fontSize: 36, color: '#1565C0' }} />}
            title="No devices found"
            description={search ? 'Try adjusting your search' : 'Devices will appear here once customers register them via the mobile app'}
          />
        </Card>
      ) : (
        <Card>
          <Paper>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  {['Device Name', 'Type', 'Status', 'DNS Method', 'MAC Address', 'Last Seen', 'Registered', ''].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {devices.map((d, idx) => (
                  <TableRow key={d.id} hover sx={{
                    '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                    animation: `fadeInUp 0.3s ease ${idx * 0.03}s both`,
                  }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ color: isOnline(d) ? '#2E7D32' : '#9E9E9E' }}>
                          {DEVICE_ICONS[d.deviceType] || <DevicesIcon fontSize="small" />}
                        </Box>
                        <Typography fontWeight={600} fontSize={14}>{d.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{d.deviceType || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={isOnline(d) ? 'Online' : (d.lastSeenAt ? timeAgo(d.lastSeenAt) : 'Offline')}
                        color={isOnline(d) ? 'success' : 'default'}
                        icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important' }} />}
                        sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const m = DNS_METHOD_COLOR[d.dnsMethod];
                        return m
                          ? <Chip size="small" label={d.dnsMethod} sx={{ bgcolor: m.bg, color: m.color, fontWeight: 600, height: 22, fontSize: 11 }} />
                          : <Typography variant="body2">{d.dnsMethod || '—'}</Typography>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>
                        {d.macAddress || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{timeAgo(d.lastSeenAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete device">
                        <IconButton size="small" onClick={() => setConfirmDelete(d)}
                          sx={{ color: '#E53935', '&:hover': { bgcolor: '#FFEBEE' } }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={totalElements}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </Paper>
        </Card>
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Device</DialogTitle>
        <DialogContent>
          <Typography>
            Remove <strong>{confirmDelete?.name}</strong> from the database? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="contained" color="error"
            disabled={deleteMutation.isPending}
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}>
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </AnimatedPage>
  );
}
