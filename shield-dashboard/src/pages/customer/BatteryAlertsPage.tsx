import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Stack, CircularProgress,
  Slider, Button, Alert, Snackbar, Divider,
} from '@mui/material';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import Battery0BarIcon from '@mui/icons-material/Battery0Bar';
import Battery1BarIcon from '@mui/icons-material/Battery1Bar';
import Battery2BarIcon from '@mui/icons-material/Battery2Bar';
import Battery3BarIcon from '@mui/icons-material/Battery3Bar';
import Battery4BarIcon from '@mui/icons-material/Battery4Bar';
import Battery5BarIcon from '@mui/icons-material/Battery5Bar';
import Battery6BarIcon from '@mui/icons-material/Battery6Bar';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import SaveIcon from '@mui/icons-material/Save';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

const THEME_COLOR = '#E65100';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChildProfile { id: string; name: string; }

interface BatterySettings {
  profileId: string;
  batteryThreshold: number;
  lastBatteryPct: number | null;
  lastAlertAt: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function BatteryIcon({ pct }: { pct: number | null }) {
  if (pct === null) return <Battery0BarIcon sx={{ color: 'text.disabled', fontSize: 40 }} />;
  if (pct >= 88) return <BatteryFullIcon sx={{ color: '#2E7D32', fontSize: 40 }} />;
  if (pct >= 75) return <Battery6BarIcon sx={{ color: '#388E3C', fontSize: 40 }} />;
  if (pct >= 63) return <Battery5BarIcon sx={{ color: '#558B2F', fontSize: 40 }} />;
  if (pct >= 50) return <Battery4BarIcon sx={{ color: '#F9A825', fontSize: 40 }} />;
  if (pct >= 38) return <Battery3BarIcon sx={{ color: '#F57F17', fontSize: 40 }} />;
  if (pct >= 25) return <Battery2BarIcon sx={{ color: '#E65100', fontSize: 40 }} />;
  if (pct >= 13) return <Battery1BarIcon sx={{ color: '#BF360C', fontSize: 40 }} />;
  return <Battery0BarIcon sx={{ color: '#B71C1C', fontSize: 40 }} />;
}

function batteryColor(pct: number | null) {
  if (pct === null) return 'text.disabled';
  if (pct >= 50) return '#2E7D32';
  if (pct >= 25) return '#E65100';
  return '#B71C1C';
}

function timeAgo(iso?: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BatteryAlertsPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(20);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // Fetch child profiles
  const { data: profiles = [], isLoading: profilesLoading } = useQuery<ChildProfile[]>({
    queryKey: ['child-profiles-battery'],
    queryFn: async () => {
      const r = await api.get('/profiles/children');
      const raw = r.data?.data;
      return (Array.isArray(raw) ? raw : raw?.content ?? []) as ChildProfile[];
    },
  } as any);

  // Fetch battery settings for selected profile
  const { data: settings, isLoading: settingsLoading } = useQuery<BatterySettings>({
    queryKey: ['battery-settings', selectedChild],
    queryFn: async () => {
      const r = await api.get(`/location/battery/${selectedChild}/settings`);
      return r.data?.data as BatterySettings;
    },
    enabled: !!selectedChild,
  } as any);

  // Auto-select first child when profiles load
  useEffect(() => {
    if (profiles.length > 0 && !selectedChild) {
      setSelectedChild(profiles[0].id);
    }
  }, [profiles, selectedChild]);

  // Sync threshold slider when settings load
  useEffect(() => {
    if (settings) {
      setThreshold(settings.batteryThreshold);
    }
  }, [settings]);

  // Save threshold mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/location/battery/${selectedChild}/threshold`, { threshold });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['battery-settings', selectedChild] });
      setSnackbar({ open: true, message: 'Alert threshold saved!', severity: 'success' });
    },
    onError: () => {
      setSnackbar({ open: true, message: 'Failed to save threshold', severity: 'error' });
    },
  });

  const handleProfileSelect = (id: string) => {
    setSelectedChild(id);
  };

  const selectedProfile = profiles.find((p) => p.id === selectedChild);
  const isLoading = profilesLoading || settingsLoading;
  const hasProfiles = profiles.length > 0;

  return (
    <AnimatedPage>
      <PageHeader
        title="Battery Alerts"
        subtitle="Get notified when your child's device battery runs low"
        icon={<BatteryAlertIcon sx={{ color: THEME_COLOR }} />}
      />

      {/* Profile selector chips */}
      {hasProfiles && (
        <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {profiles.map((p) => (
            <Chip
              key={p.id}
              icon={<ChildCareIcon />}
              label={p.name}
              onClick={() => handleProfileSelect(p.id)}
              variant={selectedChild === p.id ? 'filled' : 'outlined'}
              sx={{
                bgcolor: selectedChild === p.id ? THEME_COLOR : 'transparent',
                color: selectedChild === p.id ? 'white' : 'text.primary',
                borderColor: THEME_COLOR,
                '& .MuiChip-icon': { color: selectedChild === p.id ? 'white' : THEME_COLOR },
                fontWeight: 600,
              }}
            />
          ))}
        </Box>
      )}

      {profilesLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !hasProfiles ? (
        <EmptyState
          icon={<ChildCareIcon sx={{ fontSize: 56 }} />}
          title="No Child Profiles"
          description="Add a child profile to configure battery alerts."
        />
      ) : !selectedChild ? (
        <Alert severity="info">Select a child profile above to manage battery alerts.</Alert>
      ) : (
        <Stack spacing={3}>
          {/* Current battery status card */}
          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: 'divider' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Current Battery Status
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {selectedProfile?.name ?? 'Child'}'s last reported battery level
              </Typography>

              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <BatteryIcon pct={settings?.lastBatteryPct ?? null} />
                  <Box>
                    <Typography
                      variant="h3"
                      fontWeight={900}
                      sx={{ color: batteryColor(settings?.lastBatteryPct ?? null), lineHeight: 1 }}
                    >
                      {settings?.lastBatteryPct !== null && settings?.lastBatteryPct !== undefined
                        ? `${settings.lastBatteryPct}%`
                        : '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {settings?.lastBatteryPct !== null && settings?.lastBatteryPct !== undefined
                        ? (settings.lastBatteryPct <= settings.batteryThreshold
                          ? 'Battery is LOW — alert sent to parent'
                          : 'Battery level is OK')
                        : 'No data reported yet'}
                    </Typography>
                    {settings?.lastAlertAt && (
                      <Typography variant="caption" color="text.disabled">
                        Last alert: {timeAgo(settings.lastAlertAt)}
                      </Typography>
                    )}
                  </Box>
                  {settings?.lastBatteryPct !== null &&
                   settings?.lastBatteryPct !== undefined &&
                   settings.lastBatteryPct <= settings.batteryThreshold && (
                    <Chip
                      icon={<BatteryAlertIcon />}
                      label="Low Battery"
                      sx={{
                        bgcolor: '#BF360C',
                        color: 'white',
                        fontWeight: 700,
                        ml: 'auto',
                      }}
                    />
                  )}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Threshold settings card */}
          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: 'divider' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Alert Threshold
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                Send a push notification when battery drops below this level
              </Typography>

              <Box sx={{ px: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Alert me when battery is below:</Typography>
                  <Typography variant="h5" fontWeight={900} sx={{ color: THEME_COLOR }}>
                    {threshold}%
                  </Typography>
                </Box>
                <Slider
                  value={threshold}
                  onChange={(_, v) => setThreshold(v as number)}
                  min={5}
                  max={50}
                  step={5}
                  marks={[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((v) => ({
                    value: v,
                    label: v === 5 || v === 20 || v === 50 ? `${v}%` : '',
                  }))}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                  sx={{
                    color: THEME_COLOR,
                    '& .MuiSlider-thumb': { bgcolor: THEME_COLOR },
                    '& .MuiSlider-markLabel': { fontSize: 11 },
                  }}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Current saved threshold:{' '}
                  <strong style={{ color: THEME_COLOR }}>
                    {settings?.batteryThreshold ?? 20}%
                  </strong>
                </Typography>
                <Button
                  variant="contained"
                  startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || threshold === settings?.batteryThreshold}
                  sx={{
                    bgcolor: THEME_COLOR,
                    '&:hover': { bgcolor: '#BF360C' },
                    borderRadius: 2,
                    fontWeight: 700,
                    px: 3,
                  }}
                >
                  Save Threshold
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Info card */}
          <Alert
            severity="info"
            icon={<BatteryAlertIcon />}
            sx={{ borderRadius: 2 }}
          >
            <Typography variant="body2" fontWeight={600}>
              How battery alerts work
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              The child app reports battery level every 5 minutes. When the battery drops below your
              threshold, you'll receive a push notification. Alerts are sent at most once every
              30 minutes to avoid notification spam.
            </Typography>
          </Alert>
        </Stack>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
