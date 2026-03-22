import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Button, Chip, Switch, FormControlLabel, TextField, Stack,
  Divider, Alert, Snackbar,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NightlightIcon from '@mui/icons-material/Nightlight';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import LockClockIcon from '@mui/icons-material/LockClock';
import SaveIcon from '@mui/icons-material/Save';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

const ICON_COLOR = '#1A237E';
const BG_COLOR = 'rgba(26,35,126,0.08)';

interface ChildProfile { id: string; name: string; }

interface BedtimeStatus {
  enabled: boolean;
  bedtimeStart?: string;
  bedtimeEnd?: string;
  activeNow?: boolean;
}

interface BedtimeForm {
  enabled: boolean;
  bedtimeStart: string;
  bedtimeEnd: string;
}

function formatTime12(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}

export default function BedtimeLockPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [form, setForm] = useState<BedtimeForm>({ enabled: false, bedtimeStart: '21:00', bedtimeEnd: '07:00' });
  const [dirty, setDirty] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => [] as ChildProfile[]),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const { data: status, isLoading: loadingStatus } = useQuery({
    queryKey: ['bedtime-status', profileId],
    queryFn: () => api.get(`/dns/rules/${profileId}/bedtime/status`).then(r => r.data?.data as BedtimeStatus).catch(() => ({
      enabled: false,
      bedtimeStart: '21:00',
      bedtimeEnd: '07:00',
      activeNow: false,
    } as BedtimeStatus)),
    enabled: !!profileId,
  });

  // Sync form when status loads
  useEffect(() => {
    if (status && !dirty) {
      setForm({
        enabled: status.enabled ?? false,
        bedtimeStart: status.bedtimeStart ?? '21:00',
        bedtimeEnd: status.bedtimeEnd ?? '07:00',
      });
    }
  }, [status, dirty]);

  const saveMutation = useMutation({
    mutationFn: (data: BedtimeForm) =>
      api.post(`/dns/rules/${profileId}/bedtime/configure`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bedtime-status', profileId] });
      setDirty(false);
      setSnackbar({ open: true, message: 'Bedtime lock settings saved', severity: 'success' });
    },
    onError: () => {
      setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' });
    },
  });

  const handleChange = (field: keyof BedtimeForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const isOvernightWindow = form.bedtimeStart > form.bedtimeEnd;

  const windowDescription = () => {
    if (!form.bedtimeStart || !form.bedtimeEnd) return '';
    const start = formatTime12(form.bedtimeStart);
    const end = formatTime12(form.bedtimeEnd);
    if (isOvernightWindow) {
      return `${start} – ${end} locks overnight`;
    }
    return `${start} – ${end}`;
  };

  if (loadingChildren) {
    return (
      <AnimatedPage>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      </AnimatedPage>
    );
  }

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader
          icon={<NightlightIcon />}
          title="Bedtime Lock"
          subtitle="Block internet access during bedtime hours"
          iconColor={ICON_COLOR}
        />
        <EmptyState title="No child profiles" description="Add a child profile first to configure bedtime lock" />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<NightlightIcon />}
        title="Bedtime Lock"
        subtitle="Automatically block internet access during bedtime hours"
        iconColor={ICON_COLOR}
        action={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => { setSelectedChild(c.id); setDirty(false); }}
                sx={{
                  fontWeight: 600,
                  bgcolor: profileId === c.id ? ICON_COLOR : BG_COLOR,
                  color: profileId === c.id ? 'white' : ICON_COLOR,
                  '&:hover': { bgcolor: profileId === c.id ? '#0D1B6E' : 'rgba(26,35,126,0.16)' },
                }}
              />
            ))}
          </Stack>
        }
      />

      {/* Status Card */}
      <AnimatedPage delay={0.05}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                  width: 52, height: 52, borderRadius: '14px',
                  bgcolor: BG_COLOR,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: ICON_COLOR,
                }}>
                  <LockClockIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>Bedtime Lock Status</Typography>
                  {loadingStatus ? (
                    <CircularProgress size={14} sx={{ mt: 0.5 }} />
                  ) : (
                    <Chip
                      size="small"
                      label={status?.activeNow ? 'Active now' : (form.enabled ? 'Scheduled' : 'Inactive')}
                      sx={{
                        mt: 0.5,
                        fontWeight: 700,
                        fontSize: 11,
                        bgcolor: status?.activeNow
                          ? 'rgba(198,40,40,0.10)'
                          : form.enabled
                          ? BG_COLOR
                          : 'rgba(0,0,0,0.06)',
                        color: status?.activeNow ? '#C62828' : form.enabled ? ICON_COLOR : 'text.secondary',
                      }}
                    />
                  )}
                </Box>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.enabled}
                    onChange={e => handleChange('enabled', e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: ICON_COLOR },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ICON_COLOR },
                    }}
                  />
                }
                label={
                  <Typography variant="body2" fontWeight={600}>
                    {form.enabled ? 'Enabled' : 'Disabled'}
                  </Typography>
                }
                labelPlacement="start"
                sx={{ m: 0 }}
              />
            </Box>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Configuration Card */}
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Bedtime Window
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <BedtimeIcon sx={{ color: ICON_COLOR, fontSize: 18 }} />
                  <Typography variant="body2" fontWeight={600} color="text.secondary">
                    Bedtime Start
                  </Typography>
                </Box>
                <TextField
                  type="time"
                  value={form.bedtimeStart}
                  onChange={e => handleChange('bedtimeStart', e.target.value)}
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { step: 300 } }}
                  sx={{
                    '& input': { fontWeight: 600, fontSize: 16 },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Internet lock begins at this time
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <WbSunnyIcon sx={{ color: '#F57F17', fontSize: 18 }} />
                  <Typography variant="body2" fontWeight={600} color="text.secondary">
                    Bedtime End
                  </Typography>
                </Box>
                <TextField
                  type="time"
                  value={form.bedtimeEnd}
                  onChange={e => handleChange('bedtimeEnd', e.target.value)}
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { step: 300 } }}
                  sx={{
                    '& input': { fontWeight: 600, fontSize: 16 },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Internet access resumes at this time
                </Typography>
              </Grid>
            </Grid>

            {/* Overnight window explanation */}
            {form.bedtimeStart && form.bedtimeEnd && (
              <Box sx={{
                mt: 3, px: 2, py: 1.5, borderRadius: 2,
                bgcolor: isOvernightWindow ? BG_COLOR : 'rgba(67,160,71,0.06)',
                border: '1px solid',
                borderColor: isOvernightWindow ? 'rgba(26,35,126,0.20)' : 'rgba(67,160,71,0.15)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NightlightIcon sx={{ fontSize: 16, color: isOvernightWindow ? ICON_COLOR : '#2E7D32' }} />
                  <Typography variant="body2" fontWeight={600} color={isOvernightWindow ? ICON_COLOR : '#2E7D32'}>
                    {windowDescription()}
                  </Typography>
                </Box>
                {isOvernightWindow && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Overnight window — internet is blocked from {formatTime12(form.bedtimeStart)} tonight
                    until {formatTime12(form.bedtimeEnd)} the next morning.
                  </Typography>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* How it works */}
      <AnimatedPage delay={0.15}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11 }}>
              How Bedtime Lock Works
            </Typography>
            <Stack spacing={1}>
              {[
                'All internet traffic is blocked on the child\'s device during the configured window.',
                'Overnight windows are fully supported (e.g. 9:00 PM – 7:00 AM).',
                'Emergency contacts remain reachable regardless of the lock.',
                'You can temporarily override the lock from this page at any time.',
              ].map((text, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1.5 }}>
                  <Box sx={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    bgcolor: BG_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography variant="caption" fontWeight={700} sx={{ color: ICON_COLOR, fontSize: 10 }}>
                      {i + 1}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">{text}</Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Save Button */}
      {dirty && (
        <AnimatedPage delay={0}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
              sx={{ bgcolor: ICON_COLOR, '&:hover': { bgcolor: '#0D1B6E' } }}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </Box>
        </AnimatedPage>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
