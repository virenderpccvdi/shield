import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, CircularProgress,
  Avatar, Stack, Switch, Button, TextField, InputAdornment, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SearchIcon from '@mui/icons-material/Search';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockIcon from '@mui/icons-material/Lock';
import AndroidIcon from '@mui/icons-material/Android';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import LoadingPage from '../../components/LoadingPage';

interface AppInfo {
  id: string; profileId: string; packageName: string; appName?: string;
  versionName?: string; systemApp: boolean; blocked: boolean;
  timeLimitMinutes?: number; usageTodayMinutes: number; lastReportedAt?: string;
}

const POPULAR_ICONS: Record<string, string> = {
  'com.whatsapp': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/32px-WhatsApp.svg.png',
  'com.instagram.android': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Instagram_logo_2016.svg/32px-Instagram_logo_2016.svg.png',
  'com.facebook.katana': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/32px-2021_Facebook_icon.svg.png',
  'com.google.android.youtube': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/32px-YouTube_full-color_icon_%282017%29.svg.png',
};

function appIcon(packageName: string) {
  return POPULAR_ICONS[packageName] || null;
}

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function ChildAppsPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showSystem, setShowSystem] = useState(false);
  const [pinDialog, setPinDialog] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  const { data: apps = [], isLoading } = useQuery<AppInfo[]>({
    queryKey: ['child-apps', profileId],
    queryFn: () => api.get(`/profiles/apps/${profileId}`).then(r => r.data?.data ?? []).catch(() => []),
    refetchInterval: 60000,
  });

  const blockMutation = useMutation({
    mutationFn: ({ packageName, blocked }: { packageName: string; blocked: boolean }) =>
      api.patch(`/profiles/apps/${profileId}/${encodeURIComponent(packageName)}`, { blocked }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['child-apps', profileId] }),
  });

  const pinMutation = useMutation({
    mutationFn: (pin: string) => api.post('/profiles/apps/uninstall-pin', { pin }),
    onSuccess: () => { setPinMsg('Uninstall PIN set successfully!'); setTimeout(() => setPinDialog(false), 1500); },
    onError: () => setPinMsg('Failed to set PIN. Please try again.'),
  });

  const filtered = apps.filter(a => {
    if (!showSystem && a.systemApp) return false;
    if (search && !a.appName?.toLowerCase().includes(search.toLowerCase()) &&
        !a.packageName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const blockedCount = apps.filter(a => a.blocked).length;
  const userApps = apps.filter(a => !a.systemApp).length;

  if (isLoading) return (
    <AnimatedPage>
      <LoadingPage />
    </AnimatedPage>
  );

  return (
    <AnimatedPage>
      <PageHeader
        icon={<AndroidIcon />}
        title="Installed Apps"
        subtitle={`Apps on child's device — block, set limits, and view usage`}
        iconColor="#43A047"
        action={
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} variant="outlined" size="small">
            Back
          </Button>
        }
      />

      {/* Stats bar */}
      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Chip icon={<AndroidIcon />} label={`${userApps} User Apps`} color="default" variant="outlined" />
        <Chip icon={<BlockIcon />} label={`${blockedCount} Blocked`} color="error" variant={blockedCount > 0 ? 'filled' : 'outlined'} />
        <Chip
          icon={<LockIcon />}
          label="Set Uninstall PIN"
          color="warning"
          variant="outlined"
          onClick={() => { setPinDialog(true); setPinMsg(''); setPinValue(''); }}
          sx={{ cursor: 'pointer' }}
        />
      </Stack>

      {apps.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <AndroidIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No app data yet. The child device needs to sync.</Typography>
          <Typography variant="caption" color="text.disabled">Apps sync automatically when the Shield app is open on the child's device.</Typography>
        </Card>
      ) : (
        <>
          {/* Search + filter */}
          <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
            <TextField size="small" placeholder="Search apps..." value={search}
              onChange={e => setSearch(e.target.value)} sx={{ flex: 1, maxWidth: 400 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> }} />
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="caption" color="text.secondary">Show system apps</Typography>
              <Switch size="small" checked={showSystem} onChange={e => setShowSystem(e.target.checked)} />
            </Stack>
          </Stack>

          <Grid container spacing={2}>
            {filtered.map(app => {
              const icon = appIcon(app.packageName);
              return (
                <Grid key={app.packageName} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={{
                    border: app.blocked ? '1px solid #FFCDD2' : '1px solid transparent',
                    bgcolor: app.blocked ? '#FFF8F8' : 'background.paper',
                    transition: 'all 0.2s',
                  }}>
                    <CardContent sx={{ pb: '12px !important' }}>
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        {icon ? (
                          <Box component="img" src={icon} sx={{ width: 36, height: 36, borderRadius: 1, flexShrink: 0 }} />
                        ) : (
                          <Avatar sx={{ width: 36, height: 36, fontSize: 13, fontWeight: 700,
                            bgcolor: app.blocked ? '#FFCDD2' : '#E3F2FD', color: app.blocked ? '#C62828' : '#1565C0' }}>
                            {getInitials(app.appName)}
                          </Avatar>
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={600} fontSize={13} noWrap>
                            {app.appName || app.packageName}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block' }}>
                            {app.packageName}
                          </Typography>
                          {app.usageTodayMinutes > 0 && (
                            <Chip size="small" label={`${app.usageTodayMinutes}m today`}
                              sx={{ height: 18, fontSize: 10, mt: 0.5 }} />
                          )}
                        </Box>
                        <Tooltip title={app.blocked ? 'Unblock app' : 'Block app'}>
                          <Switch
                            size="small"
                            checked={!app.blocked}
                            onChange={e => blockMutation.mutate({ packageName: app.packageName, blocked: !e.target.checked })}
                            sx={{ '& .MuiSwitch-thumb': { bgcolor: app.blocked ? '#EF5350' : '#43A047' } }}
                          />
                        </Tooltip>
                      </Stack>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                        {app.systemApp && <Chip size="small" label="System" sx={{ height: 18, fontSize: 10, bgcolor: '#F3F4F6' }} />}
                        {app.blocked && <Chip size="small" icon={<BlockIcon sx={{ fontSize: 10 }} />}
                          label="Blocked" color="error" sx={{ height: 18, fontSize: 10 }} />}
                        {!app.blocked && <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: 10 }} />}
                          label="Allowed" color="success" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}

      {/* Uninstall PIN Dialog */}
      <Dialog open={pinDialog} onClose={() => setPinDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LockIcon color="warning" />
            <span>Set Uninstall Protection PIN</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your child will need this PIN to uninstall the Shield app from their device.
          </Typography>
          <TextField
            fullWidth autoFocus label="4-6 digit PIN" value={pinValue}
            onChange={e => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
            type="password"
          />
          {pinMsg && <Alert severity={pinMsg.includes('success') ? 'success' : 'error'} sx={{ mt: 1.5 }}>{pinMsg}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPinDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => pinMutation.mutate(pinValue)}
            disabled={pinValue.length < 4 || pinMutation.isPending}>
            Save PIN
          </Button>
        </DialogActions>
      </Dialog>
    </AnimatedPage>
  );
}
