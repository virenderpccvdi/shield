import {
  Box, Typography, Card, CardContent, Button, Stack, Alert,
  CircularProgress, Snackbar, FormControlLabel, Switch, Select,
  MenuItem, FormControl, InputLabel, Skeleton,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { alpha, useTheme } from '@mui/material/styles';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

interface Profile {
  id: string;
  name: string;
  avatarUrl?: string;
  filterLevel?: string;
}

interface CheckinReminderSettings {
  enabled: boolean;
  reminderIntervalMin: number;
  quietStart: string;
  quietEnd: string;
  lastSeenAt?: string;
}

const INTERVAL_OPTIONS = [
  { value: 15,  label: '15 minutes' },
  { value: 30,  label: '30 minutes' },
  { value: 60,  label: '1 hour' },
  { value: 120, label: '2 hours' },
];

function formatLastSeen(iso?: string): string {
  if (!iso) return 'No recent check-in';
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} hour${diffH !== 1 ? 's' : ''} ago`;
  return d.toLocaleDateString();
}

export default function CheckinReminderPage() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [snack, setSnack] = useState('');

  // Local editable state
  const [enabled, setEnabled] = useState(true);
  const [intervalMin, setIntervalMin] = useState(60);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');

  // Load profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery<Profile[]>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const r = await api.get('/api/v1/profile/profiles');
      const raw = r.data?.data ?? r.data;
      return (Array.isArray(raw) ? raw : raw?.content ?? []) as Profile[];
    },
  });

  // Auto-select first profile
  useEffect(() => {
    if (profiles && profiles.length > 0 && !selectedProfileId) {
      setSelectedProfileId(profiles[0].id);
    }
  }, [profiles, selectedProfileId]);

  // Load settings for selected profile
  const {
    data: settings,
    isLoading: settingsLoading,
    isError: settingsError,
  } = useQuery<CheckinReminderSettings>({
    queryKey: ['checkin-reminder', selectedProfileId],
    queryFn: async () => {
      const r = await api.get(`/api/v1/location/checkin-reminder/${selectedProfileId}`);
      return (r.data?.data ?? r.data) as CheckinReminderSettings;
    },
    enabled: !!selectedProfileId,
  });

  // Sync fetched settings into local form state
  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setIntervalMin(settings.reminderIntervalMin ?? 60);
      setQuietStart(settings.quietStart ?? '22:00');
      setQuietEnd(settings.quietEnd ?? '07:00');
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/api/v1/location/checkin-reminder/${selectedProfileId}`, {
        enabled,
        reminderIntervalMin: intervalMin,
        quietStart,
        quietEnd,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkin-reminder', selectedProfileId] });
      setSnack('Check-in reminder settings saved');
    },
  });

  const selectedProfile = profiles?.find((p) => p.id === selectedProfileId);
  const isLoadingSettings = settingsLoading && !!selectedProfileId;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<NotificationsActiveIcon />}
        title="Check-in Reminders"
        subtitle="Get notified if your child's device stops reporting location"
        iconColor="primary.main"
        hero
      />

      <Stack spacing={3} maxWidth={680}>

        {/* Info banner */}
        <Alert
          severity="info"
          icon={<InfoOutlinedIcon />}
          sx={{
            borderRadius: 2.5,
            bgcolor: alpha(theme.palette.info.main, 0.06),
            border: `1px solid ${alpha(theme.palette.info.main, 0.22)}`,
            '& .MuiAlert-message': { fontSize: 13.5 },
          }}
        >
          Your child&apos;s Shield app reports location automatically. This reminder alerts you if no
          update is received within your chosen interval.
        </Alert>

        {/* Profile selector */}
        <Card elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.6)}`, borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <PersonIcon color="primary" />
              <Typography fontWeight={700} fontSize={15}>Select Child Profile</Typography>
            </Box>

            {profilesLoading ? (
              <Skeleton variant="rounded" height={56} />
            ) : (
              <FormControl fullWidth size="small">
                <InputLabel>Child profile</InputLabel>
                <Select
                  value={selectedProfileId}
                  label="Child profile"
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  {(profiles ?? []).map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </CardContent>
        </Card>

        {/* Settings card */}
        {selectedProfileId && (
          <Card elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.6)}`, borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>

              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <AccessTimeIcon color="primary" />
                  <Typography fontWeight={700} fontSize={15}>
                    Reminder Settings
                    {selectedProfile && (
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                        — {selectedProfile.name}
                      </Typography>
                    )}
                  </Typography>
                </Box>
                {isLoadingSettings && <CircularProgress size={18} />}
              </Box>

              {settingsError && (
                <Alert severity="warning" sx={{ mb: 2.5 }}>
                  Could not load saved settings. Showing defaults — changes will still be saved.
                </Alert>
              )}

              {/* Last seen info */}
              {settings?.lastSeenAt !== undefined && (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  mb: 2.5, px: 2, py: 1.25,
                  bgcolor: alpha(theme.palette.success.main, 0.06),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                  borderRadius: 2,
                }}>
                  <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18 }} />
                  <Typography variant="body2" color="text.secondary">
                    Last location check-in:{' '}
                    <Typography component="span" fontWeight={700} variant="body2" color="text.primary">
                      {formatLastSeen(settings.lastSeenAt)}
                    </Typography>
                  </Typography>
                </Box>
              )}

              {/* Enable toggle */}
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                px: 2, py: 1.5,
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                borderRadius: 2, mb: 2.5,
              }}>
                <Box>
                  <Typography fontWeight={600} fontSize={14}>Enable Reminders</Typography>
                  <Typography variant="body2" color="text.secondary" fontSize={12.5}>
                    Receive push notifications when no check-in is received
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      color="primary"
                    />
                  }
                  label=""
                  sx={{ m: 0 }}
                />
              </Box>

              {/* Interval selector */}
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary"
                  sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Reminder Interval
                </Typography>
                <FormControl fullWidth size="small" disabled={!enabled}>
                  <InputLabel>Interval</InputLabel>
                  <Select
                    value={intervalMin}
                    label="Interval"
                    onChange={(e) => setIntervalMin(Number(e.target.value))}
                    sx={{ borderRadius: 2 }}
                  >
                    {INTERVAL_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontSize: 12 }}>
                  You will be notified if no location update is received within this period.
                </Typography>
              </Box>

              {/* Quiet hours */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary"
                  sx={{ display: 'block', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Quiet Hours
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: 12.5 }}>
                  No reminder notifications will be sent during quiet hours (e.g. while your child sleeps).
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      Start
                    </Typography>
                    <Box
                      component="input"
                      type="time"
                      value={quietStart}
                      disabled={!enabled}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuietStart(e.target.value)}
                      sx={{
                        width: '100%',
                        px: 1.5, py: 1,
                        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                        borderRadius: '8px',
                        fontSize: 14,
                        fontFamily: 'inherit',
                        color: enabled ? theme.palette.text.primary : theme.palette.text.disabled,
                        bgcolor: enabled
                          ? theme.palette.background.paper
                          : alpha(theme.palette.action.disabledBackground, 0.5),
                        outline: 'none',
                        cursor: enabled ? 'pointer' : 'not-allowed',
                        '&:focus': {
                          borderColor: theme.palette.primary.main,
                          boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                        },
                      }}
                    />
                  </Box>
                  <Typography color="text.secondary" sx={{ pt: 2.5 }}>to</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      End
                    </Typography>
                    <Box
                      component="input"
                      type="time"
                      value={quietEnd}
                      disabled={!enabled}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuietEnd(e.target.value)}
                      sx={{
                        width: '100%',
                        px: 1.5, py: 1,
                        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                        borderRadius: '8px',
                        fontSize: 14,
                        fontFamily: 'inherit',
                        color: enabled ? theme.palette.text.primary : theme.palette.text.disabled,
                        bgcolor: enabled
                          ? theme.palette.background.paper
                          : alpha(theme.palette.action.disabledBackground, 0.5),
                        outline: 'none',
                        cursor: enabled ? 'pointer' : 'not-allowed',
                        '&:focus': {
                          borderColor: theme.palette.primary.main,
                          boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                        },
                      }}
                    />
                  </Box>
                </Stack>
              </Box>

              {/* Save mutation error */}
              {saveMutation.isError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {(saveMutation.error as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? 'Failed to save settings. Please try again.'}
                </Alert>
              )}

              {/* Save button */}
              <Button
                variant="contained"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || isLoadingSettings}
                startIcon={
                  saveMutation.isPending
                    ? <CircularProgress size={16} color="inherit" />
                    : <CheckCircleIcon />
                }
                sx={{ fontWeight: 700, borderRadius: 2, px: 3 }}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty state when no profiles */}
        {!profilesLoading && profiles?.length === 0 && (
          <Alert severity="info">
            No child profiles found. Add a child profile first to configure check-in reminders.
          </Alert>
        )}

      </Stack>

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack('')}
        message={snack}
      />
    </AnimatedPage>
  );
}
