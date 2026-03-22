import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, CircularProgress,
  Button, Stack, Select, MenuItem, FormControl, InputLabel,
  Alert, Snackbar, Divider,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SchoolIcon from '@mui/icons-material/School';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface ChildProfile { id: string; name: string; }
interface HomeworkStatus {
  active: boolean;
  endsAt?: string;
  startedAt?: string;
  durationMinutes?: number;
}

const DURATIONS = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

function minutesUntil(isoString: string): number {
  const diff = new Date(isoString).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 60000));
}

function formatCountdown(isoString: string): string {
  const mins = minutesUntil(isoString);
  if (mins <= 0) return 'Ending soon';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
}

export default function HomeworkModePage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(60);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });
  const [tick, setTick] = useState(0);

  // Refresh countdown every minute
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => []),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const { data: status, isLoading: loadingStatus } = useQuery({
    queryKey: ['homework-status', profileId],
    queryFn: () => api.get(`/dns/rules/${profileId}/homework/status`).then(r => r.data.data as HomeworkStatus),
    enabled: !!profileId,
    refetchInterval: 60000,
  });

  const startMutation = useMutation({
    mutationFn: () => api.post(`/dns/rules/${profileId}/homework/start`, { durationMinutes: duration }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homework-status', profileId] });
      setSnackbar({ open: true, message: 'Homework Mode started successfully', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to start Homework Mode', severity: 'error' }),
  });

  const stopMutation = useMutation({
    mutationFn: () => api.post(`/dns/rules/${profileId}/homework/stop`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homework-status', profileId] });
      setSnackbar({ open: true, message: 'Homework Mode stopped', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to stop Homework Mode', severity: 'error' }),
  });

  if (loadingChildren) return <LoadingPage />;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<SchoolIcon />} title="Homework Mode" subtitle="Focus mode for study time" iconColor="#1565C0" />
        <EmptyState title="No child profiles" description="Add a child profile first to use Homework Mode" />
      </AnimatedPage>
    );
  }

  const isActive = status?.active === true;
  const minsLeft = isActive && status?.endsAt ? minutesUntil(status.endsAt) : 0;
  void tick; // used to trigger re-render for countdown

  return (
    <AnimatedPage>
      <PageHeader
        icon={<SchoolIcon />}
        title="Homework Mode"
        subtitle="Temporarily block distractions so your child can focus on schoolwork"
        iconColor="#1565C0"
        action={
          <Stack direction="row" spacing={1}>
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? '#1565C0' : 'rgba(21,101,192,0.08)',
                  color: (profileId === c.id) ? 'white' : '#1565C0',
                  '&:hover': { bgcolor: (profileId === c.id) ? '#0D47A1' : 'rgba(21,101,192,0.16)' },
                }}
              />
            ))}
          </Stack>
        }
      />

      {/* Status Card */}
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 3, border: '1px solid', borderColor: isActive ? 'success.light' : 'divider' }}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{
                  width: 56, height: 56, borderRadius: '14px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  bgcolor: isActive ? 'rgba(67,160,71,0.1)' : 'rgba(21,101,192,0.08)',
                }}>
                  {loadingStatus ? (
                    <CircularProgress size={24} />
                  ) : isActive ? (
                    <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
                  ) : (
                    <SchoolIcon sx={{ color: '#1565C0', fontSize: 28 }} />
                  )}
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {loadingStatus ? 'Loading...' : isActive ? 'Homework Mode Active' : 'Homework Mode Inactive'}
                  </Typography>
                  {isActive && status?.endsAt && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <AccessTimeIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      <Typography variant="body2" color="success.main" fontWeight={600}>
                        Ends in {formatCountdown(status.endsAt)}
                      </Typography>
                    </Stack>
                  )}
                  {!isActive && (
                    <Typography variant="body2" color="text.secondary">
                      Start a session to block distracting sites
                    </Typography>
                  )}
                </Box>
              </Stack>
              {isActive && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={stopMutation.isPending ? <CircularProgress size={16} /> : <StopIcon />}
                  onClick={() => stopMutation.mutate()}
                  disabled={stopMutation.isPending}
                  sx={{ fontWeight: 600 }}
                >
                  Stop Mode
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Start Card */}
      {!isActive && (
        <AnimatedPage delay={0.2}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Start Homework Mode
              </Typography>
              <Divider sx={{ mb: 2.5 }} />
              <Grid container spacing={2} alignItems="flex-end">
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Duration</InputLabel>
                    <Select
                      value={duration}
                      label="Duration"
                      onChange={e => setDuration(Number(e.target.value))}
                    >
                      {DURATIONS.map(d => (
                        <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={startMutation.isPending ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <PlayArrowIcon />}
                    onClick={() => startMutation.mutate()}
                    disabled={startMutation.isPending || !profileId}
                    sx={{ bgcolor: '#1565C0', '&:hover': { bgcolor: '#0D47A1' }, fontWeight: 600 }}
                  >
                    {startMutation.isPending ? 'Starting...' : 'Start Homework Mode'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* How it works */}
      <AnimatedPage delay={0.3}>
        <Card sx={{ bgcolor: 'rgba(21,101,192,0.04)', border: '1px solid rgba(21,101,192,0.15)' }}>
          <CardContent>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <InfoOutlinedIcon sx={{ color: '#1565C0', mt: 0.25, flexShrink: 0 }} />
              <Box>
                <Typography variant="subtitle2" fontWeight={700} color="#1565C0" sx={{ mb: 1 }}>
                  How Homework Mode works
                </Typography>
                <Stack spacing={0.75}>
                  {[
                    'Instantly blocks social media, gaming sites, and streaming platforms',
                    'Educational sites like Khan Academy and Wikipedia remain accessible',
                    'Automatically deactivates when the timer expires',
                    'You can stop it early at any time from this page',
                  ].map((point, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main', mt: 0.3, flexShrink: 0 }} />
                      <Typography variant="body2" color="text.secondary">{point}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </AnimatedPage>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
