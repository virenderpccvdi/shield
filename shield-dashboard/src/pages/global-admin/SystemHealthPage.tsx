import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, IconButton, Tooltip, Grid,
  LinearProgress, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, Collapse, CircularProgress, Snackbar, TextField, Alert,
} from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TerminalIcon from '@mui/icons-material/Terminal';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import { gradients } from '../../theme/theme';
import LoadingPage from '../../components/LoadingPage';
import { useTheme } from '@mui/material/styles';

interface ServiceInfo {
  name: string;
  unit: string;
  status: string;
}

const SERVICE_PORTS: Record<string, number> = {
  eureka: 8261, config: 8288, gateway: 8280, auth: 8281, tenant: 8282,
  profile: 8283, dns: 8284, location: 8285, notification: 8286,
  rewards: 8287, analytics: 8289, admin: 8290, ai: 8291,
};

export default function SystemHealthPage() {
  const theme = useTheme();
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [logData, setLogData] = useState<Record<string, string>>({});
  const [logLoading, setLogLoading] = useState<Record<string, boolean>>({});
  const [confirmAction, setConfirmAction] = useState<{ name: string; action: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [snack, setSnack] = useState('');
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateVersion, setUpdateVersion] = useState('1.0.1');
  const [updatePushing, setUpdatePushing] = useState(false);

  function refresh() {
    setLoading(true);
    api.get('/admin/platform/services')
      .then(r => setServices((r.data?.data || r.data) as ServiceInfo[]))
      .catch(() => setServices(Object.keys(SERVICE_PORTS).map(name => ({ name, unit: `shield-${name}.service`, status: 'unknown' }))))
      .finally(() => { setLoading(false); setLastChecked(new Date()); });
  }

  useEffect(() => { refresh(); }, []);

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      api.get('/admin/platform/services')
        .then(r => { setServices((r.data?.data || r.data) as ServiceInfo[]); setLastChecked(new Date()); })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  async function fetchLogs(name: string) {
    if (expandedLogs[name]) {
      setExpandedLogs(prev => ({ ...prev, [name]: false }));
      return;
    }
    setLogLoading(prev => ({ ...prev, [name]: true }));
    try {
      const res = await api.get(`/admin/platform/services/${name}/logs?lines=50`);
      const data = res.data?.data || res.data;
      setLogData(prev => ({ ...prev, [name]: data.logs || '' }));
    } catch {
      setLogData(prev => ({ ...prev, [name]: 'Failed to fetch logs' }));
    }
    setLogLoading(prev => ({ ...prev, [name]: false }));
    setExpandedLogs(prev => ({ ...prev, [name]: true }));
  }

  async function execServiceAction(name: string, action: string) {
    setActionLoading(`${name}-${action}`);
    setConfirmAction(null);
    try {
      await api.post(`/admin/platform/services/${name}/${action}`);
      setSnack(`${action} ${name} — success`);
      setTimeout(refresh, 2000);
    } catch {
      setSnack(`${action} ${name} — failed`);
    }
    setActionLoading(null);
  }

  async function pushAppUpdate() {
    setUpdatePushing(true);
    try {
      await api.post('/notifications/push', {
        topic: 'shield-child-devices',
        title: '🔄 Shield App Update Available',
        body: `Shield v${updateVersion} is ready. Tap to download the latest version.`,
        data: {
          type: 'APP_UPDATE',
          version: updateVersion,
          downloadUrl: 'https://shield.rstglobal.in/shield-app.apk',
        },
      });
      setUpdateDialogOpen(false);
      setSnack(`App update v${updateVersion} pushed to all child devices`);
    } catch {
      setSnack('Failed to push app update notification');
    }
    setUpdatePushing(false);
  }

  const upCount = services.filter(s => s.status === 'active').length;
  const downCount = services.filter(s => s.status !== 'active' && s.status !== 'unknown').length;
  const uptimePercent = services.length > 0 ? Math.round((upCount / services.length) * 100) : 0;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<MonitorHeartIcon />}
        title="Service Management"
        subtitle={`Real-time status and control of all platform services${lastChecked ? ` — last checked ${lastChecked.toLocaleTimeString()}` : ''}`}
        iconColor={theme.palette.secondary.main}
        action={
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" startIcon={<SystemUpdateIcon />}
              onClick={() => setUpdateDialogOpen(true)}
              sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}>
              Push App Update
            </Button>
            <Button size="small" variant="outlined" startIcon={<RestartAltIcon />}
              onClick={() => setConfirmAction({ name: 'ALL', action: 'restart' })}>
              Restart All
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={refresh} disabled={loading} sx={{
                transition: 'all 0.3s ease',
                ...(loading && { '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } }, animation: 'spin 1s linear infinite' }),
              }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{
            background: gradients.green, color: '#fff', border: 'none',
            '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
            animation: 'fadeInUp 0.5s ease 0.1s both',
            transition: 'transform 0.2s ease', '&:hover': { transform: 'translateY(-4px)' },
          }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CheckCircleIcon sx={{ fontSize: 36, opacity: 0.85 }} />
              <Box><Typography variant="h4" fontWeight={800}>{upCount}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>Services Up</Typography></Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{
            background: downCount > 0 ? gradients.red : 'linear-gradient(135deg, #78909C 0%, #546E7A 100%)',
            color: '#fff', border: 'none',
            '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
            animation: 'fadeInUp 0.5s ease 0.2s both',
            transition: 'transform 0.2s ease', '&:hover': { transform: 'translateY(-4px)' },
          }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ErrorIcon sx={{ fontSize: 36, opacity: 0.85 }} />
              <Box><Typography variant="h4" fontWeight={800}>{downCount}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>Services Down</Typography></Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{
            background: gradients.blue, color: '#fff', border: 'none',
            '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
            animation: 'fadeInUp 0.5s ease 0.3s both',
            transition: 'transform 0.2s ease', '&:hover': { transform: 'translateY(-4px)' },
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>Uptime</Typography>
                <Typography variant="h4" fontWeight={800}>{uptimePercent}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={uptimePercent}
                sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { bgcolor: '#fff', borderRadius: 4 } }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
        All Services ({services.length})
      </Typography>

      {loading && services.length === 0 ? (
        <LoadingPage />
      ) : (
        <Grid container spacing={2}>
          {services.map((svc, idx) => {
            const isActive = svc.status === 'active';
            const port = SERVICE_PORTS[svc.name] || 0;
            return (
              <Grid key={svc.name} size={{ xs: 12, sm: 6 }}>
                <Card sx={{
                  '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                  animation: `fadeInUp 0.4s ease ${idx * 0.03}s both`,
                  transition: 'all 0.2s ease',
                  '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.1)' },
                }}>
                  <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{
                          '@keyframes pulse': {
                            '0%, 100%': { boxShadow: `0 0 0 0 ${isActive ? theme.palette.success.main + '66' : theme.palette.error.main + '66'}` },
                            '50%': { boxShadow: `0 0 0 6px ${isActive ? theme.palette.success.main + '00' : theme.palette.error.main + '00'}` },
                          },
                          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                          bgcolor: isActive ? 'success.main' : svc.status === 'unknown' ? 'action.disabled' : 'error.main',
                          animation: isActive ? 'pulse 2s ease-in-out infinite' : undefined,
                        }} />
                        <Box>
                          <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>shield-{svc.name}</Typography>
                          <Typography variant="caption" color="text.secondary">Port {port}</Typography>
                        </Box>
                      </Box>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip label={svc.status} color={isActive ? 'success' : 'error'} size="small"
                          sx={{ fontSize: 11, fontWeight: 700, minWidth: 52, transition: 'all 0.3s ease' }} />
                        <Tooltip title="Start">
                          <IconButton size="small" color="success" disabled={isActive || !!actionLoading}
                            onClick={() => setConfirmAction({ name: svc.name, action: 'start' })}>
                            {actionLoading === `${svc.name}-start` ? <CircularProgress size={16} /> : <PlayArrowIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Restart">
                          <IconButton size="small" color="warning" disabled={!!actionLoading}
                            onClick={() => setConfirmAction({ name: svc.name, action: 'restart' })}>
                            {actionLoading === `${svc.name}-restart` ? <CircularProgress size={16} /> : <RestartAltIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Stop">
                          <IconButton size="small" color="error" disabled={!isActive || !!actionLoading}
                            onClick={() => setConfirmAction({ name: svc.name, action: 'stop' })}>
                            {actionLoading === `${svc.name}-stop` ? <CircularProgress size={16} /> : <StopIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Logs">
                          <IconButton size="small" onClick={() => fetchLogs(svc.name)}>
                            {logLoading[svc.name] ? <CircularProgress size={16} /> : expandedLogs[svc.name] ? <ExpandLessIcon fontSize="small" /> : <TerminalIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                    <Collapse in={expandedLogs[svc.name]}>
                      <Box sx={{
                        mt: 1.5, p: 1.5, bgcolor: '#1A1A2E', borderRadius: 1.5, maxHeight: 250, overflow: 'auto',
                        fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, color: '#E0E0E0', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      }}>
                        {logData[svc.name] || 'No logs available'}
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Confirm {confirmAction?.action}</DialogTitle>
        <DialogContent>
          <Typography>
            {confirmAction?.name === 'ALL'
              ? `Are you sure you want to ${confirmAction?.action} ALL services? This may cause brief downtime.`
              : `Are you sure you want to ${confirmAction?.action} shield-${confirmAction?.name}?`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
          <Button variant="contained" color={confirmAction?.action === 'stop' ? 'error' : 'warning'}
            onClick={() => {
              if (confirmAction?.name === 'ALL') {
                services.forEach(s => execServiceAction(s.name, confirmAction.action));
              } else if (confirmAction) {
                execServiceAction(confirmAction.name, confirmAction.action);
              }
            }}>
            {confirmAction?.action === 'stop' ? 'Stop' : confirmAction?.action === 'restart' ? 'Restart' : 'Start'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* App Update Push Dialog */}
      <Dialog open={updateDialogOpen} onClose={() => setUpdateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SystemUpdateIcon sx={{ color: 'secondary.main' }} />
          Push App Update to All Users
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            This will send an FCM push notification to all child app users prompting them to download the latest APK.
          </Alert>
          <TextField
            label="Version Number"
            value={updateVersion}
            onChange={e => setUpdateVersion(e.target.value)}
            fullWidth size="small"
            placeholder="e.g. 1.0.1"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUpdateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={pushAppUpdate} disabled={updatePushing || !updateVersion}
            sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}>
            {updatePushing ? 'Sending...' : 'Push Notification'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}
