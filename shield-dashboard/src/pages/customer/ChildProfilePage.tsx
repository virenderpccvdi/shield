import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, Chip, Button, Grid,
  CircularProgress, Avatar, Tooltip, TextField, MenuItem, Snackbar, Alert,
  IconButton, Switch, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TimerIcon from '@mui/icons-material/Timer';
import ShieldIcon from '@mui/icons-material/Shield';
import ExtensionIcon from '@mui/icons-material/Extension';
import SaveIcon from '@mui/icons-material/Save';
import SchoolIcon from '@mui/icons-material/School';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import WeekendIcon from '@mui/icons-material/Weekend';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import DnsIcon from '@mui/icons-material/Dns';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import LiveCheckinButton from '../../components/LiveCheckinButton';

interface ChildProfile {
  id: string; customerId: string; name: string;
  ageGroup: string; filterLevel: string; dnsClientId: string; dohUrl: string;
  dateOfBirth?: string; notes?: string; createdAt: string;
}

interface ScheduleData {
  profileId: string;
  grid: Record<string, number[]>;
  activePreset?: string;
  overrideActive?: boolean;
  overrideType?: string;
  overrideEndsAt?: string;
}

interface ExtensionRequest {
  id: string; profileId: string; appName: string;
  requestedMins: number; message: string; status: string;
  createdAt: string; respondedAt?: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const filterColors: Record<string, { bg: string; text: string; border: string }> = {
  STRICT: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  MODERATE: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  RELAXED: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  CUSTOM: { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' },
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function ScheduleTab({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const [grid, setGrid] = useState<Record<string, number[]>>({});
  const [snack, setSnack] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');
  const [scheduleError, setScheduleError] = useState('');
  const [overrideDialog, setOverrideDialog] = useState(false);
  const [overrideType, setOverrideType] = useState('PAUSE');
  const [overrideMins, setOverrideMins] = useState(60);

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['cust-schedule', profileId],
    queryFn: () => api.get(`/dns/schedules/${profileId}`).then(r => {
      const d = (r.data?.data || r.data) as ScheduleData;
      if (d?.grid) { setGrid(d.grid); setScheduleError(''); }
      return d;
    }).catch((e: any) => {
      const msg = e?.response?.data?.message || 'Failed to load schedule';
      setScheduleError(msg);
      return null;
    }),
  });

  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') => {
    setSnackSeverity(severity);
    setSnack(msg);
  };

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/dns/schedules/${profileId}`, { grid }),
    onSuccess: () => { showSnack('Schedule saved'); queryClient.invalidateQueries({ queryKey: ['cust-schedule', profileId] }); },
    onError: (e: any) => showSnack(e?.response?.data?.message || 'Failed to save schedule', 'error'),
  });

  const presetMutation = useMutation({
    mutationFn: (preset: string) => api.post(`/dns/schedules/${profileId}/preset?preset=${preset}`),
    onSuccess: () => { showSnack('Preset applied'); queryClient.invalidateQueries({ queryKey: ['cust-schedule', profileId] }); },
    onError: (e: any) => showSnack(e?.response?.data?.message || 'Failed to apply preset', 'error'),
  });

  const overrideMutation = useMutation({
    mutationFn: () => api.post(`/dns/schedules/${profileId}/override`, { overrideType, durationMinutes: overrideMins }),
    onSuccess: () => { showSnack('Override applied'); setOverrideDialog(false); queryClient.invalidateQueries({ queryKey: ['cust-schedule', profileId] }); },
    onError: (e: any) => showSnack(e?.response?.data?.message || 'Failed to apply override', 'error'),
  });

  const cancelOverrideMutation = useMutation({
    mutationFn: () => api.delete(`/dns/schedules/${profileId}/override`),
    onSuccess: () => { showSnack('Override cancelled'); queryClient.invalidateQueries({ queryKey: ['cust-schedule', profileId] }); },
    onError: (e: any) => showSnack(e?.response?.data?.message || 'Failed to cancel override', 'error'),
  });

  const toggle = (day: string, hour: number) => {
    setGrid(g => ({
      ...g,
      [day]: (g[day] || Array(24).fill(1)).map((v, h) => h === hour ? (v === 1 ? 0 : 1) : v),
    }));
  };

  if (isLoading) return <LoadingPage />;

  if (scheduleError && !schedule) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>{scheduleError} — try refreshing the page.</Alert>
    );
  }

  const presets = [
    { label: 'School Hours', icon: <SchoolIcon sx={{ fontSize: 16 }} />, color: '#4F46E5', key: 'SCHOOL' },
    { label: 'Bedtime', icon: <BedtimeIcon sx={{ fontSize: 16 }} />, color: '#7C3AED', key: 'BEDTIME' },
    { label: 'Weekend', icon: <WeekendIcon sx={{ fontSize: 16 }} />, color: '#D97706', key: 'WEEKEND' },
  ];

  return (
    <Box>
      {schedule?.overrideActive && (
        <AnimatedPage>
          <Card sx={{ mb: 2, bgcolor: '#FFF3E0', border: '1px solid #FFE0B2' }}>
            <CardContent sx={{ py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PauseCircleIcon sx={{ color: '#E65100' }} />
                <Typography fontWeight={600} color="#E65100">
                  Override Active: {schedule.overrideType}
                  {schedule.overrideEndsAt && ` (ends ${new Date(schedule.overrideEndsAt).toLocaleTimeString()})`}
                </Typography>
              </Box>
              <Button size="small" color="error" startIcon={<CancelIcon />} onClick={() => cancelOverrideMutation.mutate()}>
                Cancel Override
              </Button>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {presets.map(p => (
          <Button key={p.key} size="small" variant="outlined" startIcon={p.icon}
            onClick={() => presetMutation.mutate(p.key)}
            sx={{ borderRadius: 2, borderColor: `${p.color}40`, color: p.color, '&:hover': { borderColor: p.color } }}>
            {p.label}
          </Button>
        ))}
        <Button size="small" variant="outlined" startIcon={<PauseCircleIcon />}
          onClick={() => setOverrideDialog(true)}
          sx={{ borderRadius: '8px', borderColor: 'rgba(220,38,38,0.35)', color: '#DC2626', '&:hover': { borderColor: '#DC2626', bgcolor: 'rgba(220,38,38,0.04)' } }}>
          Override
        </Button>
      </Box>
      <Card sx={{ border: '1px solid rgba(79,70,229,0.08)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 3, mb: 2.5, alignItems: 'center' }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 11 }}>
              Weekly Schedule
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: '#D1FAE5', border: '1.5px solid #6EE7B7' }} />
                <Typography variant="caption" color="text.secondary" fontWeight={500}>Allowed</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: '#FEE2E2', border: '1.5px solid #FCA5A5' }} />
                <Typography variant="caption" color="text.secondary" fontWeight={500}>Blocked</Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: 700 }}>
              <Box sx={{ display: 'flex', mb: 1, ml: '52px' }}>
                {HOURS.map(h => (
                  <Box key={h} sx={{ width: 28, textAlign: 'center', fontSize: 10, fontWeight: 600, color: (h >= 22 || h < 6) ? '#CBD5E1' : '#94A3B8' }}>{h}</Box>
                ))}
              </Box>
              {DAYS.map((day, d) => {
                const dayKey = DAY_KEYS[d];
                return (
                <Box key={day} sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
                  <Typography sx={{ width: 48, fontSize: 12, fontWeight: 700, color: d >= 5 ? '#D97706' : '#64748B', pr: 1 }}>{day}</Typography>
                  {HOURS.map(h => {
                    const val = grid[dayKey]?.[h] ?? 1;
                    return (
                      <Tooltip key={h} title={`${day} ${h}:00 — ${val === 1 ? 'Allowed' : 'Blocked'}`} arrow>
                        <Box onClick={() => toggle(dayKey, h)} sx={{
                          width: 26, height: 28, borderRadius: '5px', mr: 0.25, cursor: 'pointer',
                          bgcolor: val === 0 ? '#FEE2E2' : '#D1FAE5',
                          border: '1.5px solid', borderColor: val === 0 ? '#FCA5A5' : '#6EE7B7',
                          transition: 'all 0.12s ease',
                          '&:hover': { transform: 'scale(1.18)', zIndex: 1, boxShadow: val === 0 ? '0 2px 8px rgba(220,38,38,0.3)' : '0 2px 8px rgba(16,185,129,0.3)' },
                        }} />
                      </Tooltip>
                    );
                  })}
                </Box>
                );
              })}
            </Box>
          </Box>
          <Box sx={{ mt: 3 }}>
            <Button variant="contained" startIcon={<SaveIcon />}
              onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              sx={{
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                borderRadius: '10px', px: 3, fontWeight: 700, textTransform: 'none',
                boxShadow: '0 4px 14px rgba(79,70,229,0.3)',
                '&:hover': { background: 'linear-gradient(135deg, #4338CA 0%, #6D28D9 100%)', boxShadow: '0 6px 18px rgba(79,70,229,0.4)' },
              }}>
              {saveMutation.isPending ? 'Saving...' : 'Save Schedule'}
            </Button>
          </Box>
        </CardContent>
      </Card>
      <Dialog open={overrideDialog} onClose={() => setOverrideDialog(false)}>
        <DialogTitle>Apply Schedule Override</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 300 }}>
          <TextField select label="Override Type" value={overrideType} onChange={e => setOverrideType(e.target.value)} fullWidth>
            <MenuItem value="PAUSE">Pause Internet</MenuItem>
            <MenuItem value="HOMEWORK">Homework Mode</MenuItem>
            <MenuItem value="FOCUS">Focus Mode</MenuItem>
            <MenuItem value="BEDTIME_NOW">Bedtime Now</MenuItem>
          </TextField>
          <TextField label="Duration (minutes)" type="number" value={overrideMins}
            onChange={e => setOverrideMins(+e.target.value)} helperText="0 = until manually cancelled" fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverrideDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => overrideMutation.mutate()} disabled={overrideMutation.isPending}
            sx={{ background: 'linear-gradient(135deg, #E53935 0%, #C62828 100%)' }}>
            Apply Override
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snackSeverity} onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}

function BudgetsTab({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [snack, setSnack] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');

  const { isLoading } = useQuery({
    queryKey: ['cust-budgets', profileId],
    queryFn: () => api.get(`/dns/dns-budgets/${profileId}`).then(r => {
      const d = r.data?.data || r.data;
      if (d && typeof d === 'object') setBudgets(d);
      return d;
    }).catch(() => ({})),
  });

  const { data: todayData } = useQuery({
    queryKey: ['cust-budgets-today', profileId],
    queryFn: () => api.get(`/dns/dns-budgets/${profileId}/today`).then(r => r.data?.data || r.data).catch(() => null),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/dns/dns-budgets/${profileId}`, { budgets }),
    onSuccess: () => { setSnackSeverity('success'); setSnack('Budgets saved'); queryClient.invalidateQueries({ queryKey: ['cust-budgets', profileId] }); },
    onError: (e: any) => { setSnackSeverity('error'); setSnack(e?.response?.data?.message || 'Failed to save budgets'); },
  });

  const defaultApps = ['youtube', 'tiktok', 'gaming', 'social', 'streaming', 'education'];
  if (isLoading) return <LoadingPage />;
  const allApps = [...new Set([...defaultApps, ...Object.keys(budgets)])];

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Daily Screen Time Budgets (minutes)</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Set daily time limits per app/service. 0 = no limit.</Typography>
          <Grid container spacing={2}>
            {allApps.map(app => {
              const usage = todayData?.usage?.[app];
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={app}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ textTransform: 'capitalize', mb: 1 }}>{app}</Typography>
                    <TextField type="number" size="small" fullWidth label="Daily limit (min)"
                      value={budgets[app] ?? 0}
                      onChange={e => setBudgets(b => ({ ...b, [app]: Math.max(0, +e.target.value) }))}
                      slotProps={{ htmlInput: { min: 0, step: 15 } }} />
                    {usage && (
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#E0E0E0', overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', borderRadius: 3,
                            width: `${Math.min(100, usage.limitMinutes > 0 ? (usage.usedMinutes / usage.limitMinutes) * 100 : 0)}%`,
                            bgcolor: usage.status === 'EXCEEDED' ? '#E53935' : '#43A047' }} />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {usage.usedMinutes}m / {usage.limitMinutes > 0 ? `${usage.limitMinutes}m` : 'unlimited'}
                        </Typography>
                      </Box>
                    )}
                  </Card>
                </Grid>
              );
            })}
          </Grid>
          <Box sx={{ mt: 3 }}>
            <Button variant="contained" startIcon={<SaveIcon />}
              onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              sx={{
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                borderRadius: '10px', px: 3, fontWeight: 700, textTransform: 'none',
                boxShadow: '0 4px 14px rgba(79,70,229,0.3)',
                '&:hover': { background: 'linear-gradient(135deg, #4338CA 0%, #6D28D9 100%)' },
              }}>
              {saveMutation.isPending ? 'Saving...' : 'Save Budgets'}
            </Button>
          </Box>
        </CardContent>
      </Card>
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snackSeverity} onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}

function RulesTab({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<Record<string, boolean>>({});
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [snack, setSnack] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');
  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') => { setSnackSeverity(severity); setSnack(msg); };

  const { isLoading } = useQuery({
    queryKey: ['cust-rules', profileId],
    queryFn: () => api.get(`/dns/rules/${profileId}`).then(r => {
      const d = r.data?.data || r.data;
      if (d?.categories) setCategories(d.categories);
      else if (d?.enabledCategories) setCategories(d.enabledCategories);
      if (d?.customBlocklist) setBlocklist(d.customBlocklist);
      if (d?.customAllowlist) setAllowlist(d.customAllowlist);
      return d;
    }).catch(() => null),
  });

  const { data: catLabels } = useQuery({
    queryKey: ['dns-categories'],
    queryFn: () => api.get('/dns/categories').then(r => r.data?.data || r.data).catch(() => ({})),
  });

  const saveCatMutation = useMutation({
    mutationFn: () => api.put(`/dns/rules/${profileId}/categories`, { categories }),
    onSuccess: () => { showSnack('Categories saved'); queryClient.invalidateQueries({ queryKey: ['cust-rules', profileId] }); },
    onError: (e: any) => showSnack(e?.response?.data?.message || 'Failed to save categories', 'error'),
  });
  const saveBlockMutation = useMutation({
    mutationFn: () => api.put(`/dns/rules/${profileId}/blocklist`, { domains: blocklist }),
    onSuccess: () => { showSnack('Blocklist saved'); queryClient.invalidateQueries({ queryKey: ['cust-rules', profileId] }); },
    onError: (e: any) => showSnack(e?.response?.data?.message || 'Failed to save blocklist', 'error'),
  });
  const saveAllowMutation = useMutation({
    mutationFn: () => api.put(`/dns/rules/${profileId}/allowlist`, { domains: allowlist }),
    onSuccess: () => { showSnack('Allowlist saved'); queryClient.invalidateQueries({ queryKey: ['cust-rules', profileId] }); },
    onError: (e: any) => showSnack(e?.response?.data?.message || 'Failed to save allowlist', 'error'),
  });

  if (isLoading) return <LoadingPage />;
  const catEntries = Object.entries(catLabels || {});

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Card sx={{ border: '1px solid rgba(79,70,229,0.1)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} letterSpacing="-0.3px">Content Categories</Typography>
              <Typography variant="caption" color="text.secondary">Toggle categories to block on this profile</Typography>
            </Box>
            <Chip
              size="small"
              label={`${Object.values(categories).filter(Boolean).length} blocked`}
              sx={{ bgcolor: 'rgba(220,38,38,0.08)', color: '#DC2626', fontWeight: 700, fontSize: 11 }}
            />
          </Box>
          <Grid container spacing={1}>
            {catEntries.map(([slug, label]) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={slug}>
                <Box
                  onClick={() => setCategories(c => ({ ...c, [slug]: !c[slug] }))}
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    p: 1.5, borderRadius: '10px', cursor: 'pointer',
                    bgcolor: categories[slug] ? 'rgba(220,38,38,0.06)' : '#F8FAFC',
                    border: '1px solid', borderColor: categories[slug] ? 'rgba(220,38,38,0.2)' : '#E2E8F0',
                    transition: 'all 0.18s ease',
                    '&:hover': { borderColor: categories[slug] ? '#DC2626' : '#94A3B8', bgcolor: categories[slug] ? 'rgba(220,38,38,0.09)' : '#F1F5F9' },
                  }}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ color: categories[slug] ? '#DC2626' : '#374151', fontSize: 13 }}>
                    {label as string}
                  </Typography>
                  <Switch
                    size="small"
                    checked={!!categories[slug]}
                    onChange={(_, checked) => setCategories(c => ({ ...c, [slug]: checked }))}
                    onClick={e => e.stopPropagation()}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#DC2626' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#DC2626' },
                    }}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
          <Button variant="contained" startIcon={<SaveIcon />}
            onClick={() => saveCatMutation.mutate()} disabled={saveCatMutation.isPending}
            sx={{
              mt: 2.5, borderRadius: '10px', textTransform: 'none', fontWeight: 700,
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              boxShadow: '0 4px 12px rgba(220,38,38,0.25)',
              '&:hover': { background: 'linear-gradient(135deg, #B91C1C 0%, #991B1B 100%)' },
            }}>
            Save Categories
          </Button>
        </CardContent>
      </Card>
      <Card sx={{ border: '1px solid rgba(220,38,38,0.1)' }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} letterSpacing="-0.3px" sx={{ mb: 0.5 }}>Custom Blocklist</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>Domains added here will always be blocked</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField size="small" placeholder="domain.com" value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
            <Button variant="outlined" startIcon={<AddIcon />}
              onClick={() => { if (newDomain.trim()) { setBlocklist(l => [...l, newDomain.trim()]); setNewDomain(''); } }}
              sx={{ borderRadius: '8px', borderColor: 'rgba(220,38,38,0.4)', color: '#DC2626', '&:hover': { borderColor: '#DC2626', bgcolor: 'rgba(220,38,38,0.04)' }, textTransform: 'none' }}>
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
            {blocklist.map((d, i) => (
              <Chip key={i} label={d} size="small" onDelete={() => setBlocklist(l => l.filter((_, j) => j !== i))}
                sx={{ bgcolor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontWeight: 500 }} />
            ))}
            {blocklist.length === 0 && <Typography variant="caption" color="text.disabled">No domains blocked</Typography>}
          </Box>
          <Button variant="outlined" startIcon={<SaveIcon />}
            onClick={() => saveBlockMutation.mutate()} disabled={saveBlockMutation.isPending}
            sx={{ borderRadius: '8px', borderColor: 'rgba(220,38,38,0.4)', color: '#DC2626', textTransform: 'none', fontWeight: 600, '&:hover': { borderColor: '#DC2626', bgcolor: 'rgba(220,38,38,0.04)' } }}>
            Save Blocklist
          </Button>
        </CardContent>
      </Card>
      <Card sx={{ border: '1px solid rgba(22,163,74,0.1)' }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} letterSpacing="-0.3px" sx={{ mb: 0.5 }}>Custom Allowlist</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>Domains here will never be blocked</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField size="small" placeholder="domain.com" value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
            <Button variant="outlined" color="success" startIcon={<AddIcon />}
              onClick={() => { if (newDomain.trim()) { setAllowlist(l => [...l, newDomain.trim()]); setNewDomain(''); } }}
              sx={{ borderRadius: '8px', textTransform: 'none' }}>
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
            {allowlist.map((d, i) => (
              <Chip key={i} label={d} size="small" onDelete={() => setAllowlist(l => l.filter((_, j) => j !== i))}
                sx={{ bgcolor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', fontWeight: 500 }} />
            ))}
            {allowlist.length === 0 && <Typography variant="caption" color="text.disabled">No domains allowed</Typography>}
          </Box>
          <Button variant="outlined" color="success" startIcon={<SaveIcon />}
            onClick={() => saveAllowMutation.mutate()} disabled={saveAllowMutation.isPending}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}>
            Save Allowlist
          </Button>
        </CardContent>
      </Card>
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snackSeverity} onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}

function ExtensionsTab({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const [snack, setSnack] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['cust-extensions', profileId],
    queryFn: () => api.get('/dns/budgets/extension-requests').then(r => {
      const all = (r.data?.data || r.data || []) as ExtensionRequest[];
      return all.filter(e => e.profileId === profileId);
    }).catch(() => []),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/dns/budgets/extension-requests/${id}/approve`),
    onSuccess: () => { setSnack('Request approved'); queryClient.invalidateQueries({ queryKey: ['cust-extensions'] }); },
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/dns/budgets/extension-requests/${id}/reject`),
    onSuccess: () => { setSnack('Request rejected'); queryClient.invalidateQueries({ queryKey: ['cust-extensions'] }); },
  });

  const requests = data || [];
  if (isLoading) return <LoadingPage />;

  return (
    <Box>
      {requests.length === 0 ? (
        <Card><CardContent sx={{ textAlign: 'center', py: 6 }}>
          <ExtensionIcon sx={{ fontSize: 48, color: '#BDBDBD', mb: 1 }} />
          <Typography color="text.secondary">No extension requests</Typography>
        </CardContent></Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {requests.map((req, i) => (
            <AnimatedPage key={req.id} delay={i * 0.05}>
              <Card sx={{ border: req.status === 'PENDING' ? '1px solid #FFE082' : undefined }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography fontWeight={600}>{req.appName}</Typography>
                      <Chip size="small" label={`+${req.requestedMins}min`} sx={{ bgcolor: '#E3F2FD', color: '#1565C0', fontWeight: 600, fontSize: 11 }} />
                      <Chip size="small" label={req.status}
                        color={req.status === 'APPROVED' ? 'success' : req.status === 'REJECTED' ? 'error' : 'warning'}
                        sx={{ fontSize: 11 }} />
                    </Box>
                    {req.message && <Typography variant="body2" color="text.secondary">"{req.message}"</Typography>}
                    <Typography variant="caption" color="text.secondary">{new Date(req.createdAt).toLocaleString()}</Typography>
                  </Box>
                  {req.status === 'PENDING' && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton color="success" onClick={() => approveMutation.mutate(req.id)}><CheckCircleIcon /></IconButton>
                      <IconButton color="error" onClick={() => rejectMutation.mutate(req.id)}><BlockIcon /></IconButton>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </AnimatedPage>
          ))}
        </Box>
      )}
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}

// Lazy-load heavy pages so they don't bloat the profile page bundle
import { lazy, Suspense } from 'react';
import LoadingPage from '../../components/LoadingPage';
const RewardsPage   = lazy(() => import('./RewardsPage'));
const ReportsPage   = lazy(() => import('./ReportsPage'));

export default function ChildProfilePage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Derive active tab from URL hash so direct links work
  const hashTab = location.hash === '#tasks' ? 4 : location.hash === '#reports' ? 5 : null;
  const [tab, setTab] = useState(hashTab ?? 0);

  const { data: profile, isLoading, isError, error } = useQuery({
    queryKey: ['child-profile', profileId],
    queryFn: () => api.get(`/profiles/children/${profileId}`).then(r => (r.data?.data || r.data) as ChildProfile),
    retry: 1,
  });

  if (isLoading) return <LoadingPage />;
  if (isError || !profile) {
    const status = (error as any)?.response?.status;
    const msg = status === 401 ? 'Your session has expired. Please log in again.'
      : status === 403 ? 'You do not have permission to view this profile.'
      : status === 404 ? 'This child profile was not found or has been deleted.'
      : 'Could not load the child profile. Please try again.';
    return (
      <Box sx={{ mt: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldIcon sx={{ fontSize: 36, color: '#EF5350' }} />
        </Box>
        <Typography variant="h6" fontWeight={700} color="text.primary">Profile Unavailable</Typography>
        <Typography color="text.secondary" textAlign="center" maxWidth={400}>{msg}</Typography>
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/profiles')}
          sx={{ mt: 1, bgcolor: '#1565C0', borderRadius: 2 }}>
          Back to Child Profiles
        </Button>
      </Box>
    );
  }

  const fc = filterColors[profile.filterLevel] || filterColors.MODERATE;
  const tabs = [
    { label: 'Schedule',      icon: <ScheduleIcon    sx={{ fontSize: 18 }} /> },
    { label: 'Screen Time',   icon: <TimerIcon       sx={{ fontSize: 18 }} /> },
    { label: 'Content Rules', icon: <ShieldIcon      sx={{ fontSize: 18 }} /> },
    { label: 'Extensions',    icon: <ExtensionIcon   sx={{ fontSize: 18 }} /> },
    { label: 'Tasks & Rewards', icon: <EmojiEventsIcon sx={{ fontSize: 18 }} /> },
    { label: 'Activity Report', icon: <AssessmentIcon  sx={{ fontSize: 18 }} /> },
  ];

  return (
    <AnimatedPage>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/profiles')}
        sx={{ mb: 2.5, color: '#64748B', fontWeight: 600, textTransform: 'none', borderRadius: '8px',
          '&:hover': { bgcolor: 'rgba(79,70,229,0.06)', color: '#4F46E5' } }}>
        Back to Child Profiles
      </Button>
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 3, overflow: 'hidden', border: '1px solid rgba(79,70,229,0.1)', boxShadow: '0 4px 20px rgba(79,70,229,0.08)' }}>
          {/* Gradient header bar */}
          <Box sx={{ height: 5, background: 'linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #06B6D4 100%)' }} />
          <CardContent sx={{ pt: 3, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              {/* Avatar with colored initials */}
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                <Avatar sx={{
                  width: 72, height: 72,
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  fontWeight: 800, fontSize: 24,
                  boxShadow: '0 6px 20px rgba(79,70,229,0.35)',
                  border: '3px solid white',
                }}>
                  {getInitials(profile.name)}
                </Avatar>
                {/* Filter level indicator dot */}
                <Box sx={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 14, height: 14, borderRadius: '50%',
                  bgcolor: fc.text, border: '2px solid white',
                }} />
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
                  <Typography variant="h5" fontWeight={800} letterSpacing="-0.5px" sx={{ color: '#0F172A' }}>
                    {profile.name}
                  </Typography>
                  <LiveCheckinButton profileId={profile.id} profileName={profile.name} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {/* Age group badge */}
                  <Chip
                    size="small"
                    label={profile.ageGroup}
                    sx={{
                      height: 24, fontSize: 11, fontWeight: 700,
                      bgcolor: '#EEF2FF', color: '#4F46E5',
                      border: '1px solid #C7D2FE',
                    }}
                  />
                  {/* Filter level badge */}
                  <Chip
                    size="small"
                    label={profile.filterLevel}
                    sx={{
                      height: 24, fontSize: 11, fontWeight: 700,
                      bgcolor: fc.bg, color: fc.text,
                      border: `1px solid ${fc.border}`,
                    }}
                  />
                  {/* DNS ID */}
                  <Chip
                    size="small"
                    icon={<DnsIcon sx={{ fontSize: 13 }} />}
                    label={profile.dnsClientId}
                    sx={{ height: 24, fontSize: 11, fontFamily: 'monospace', bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}
                  />
                </Box>
              </Box>
            </Box>
          </CardContent>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderTop: '1px solid #E8EDF2',
              px: 1,
              '& .MuiTab-root': {
                fontWeight: 600, fontSize: 13, textTransform: 'none',
                minHeight: 50, color: '#64748B',
                '&:hover': { color: '#4F46E5', bgcolor: 'rgba(79,70,229,0.04)', borderRadius: '8px' },
              },
              '& .Mui-selected': { color: '#4F46E5', fontWeight: 700 },
              '& .MuiTabs-indicator': { bgcolor: '#4F46E5', borderRadius: '4px 4px 0 0', height: 3 },
            }}
          >
            {tabs.map(t => <Tab key={t.label} label={t.label} icon={t.icon} iconPosition="start" />)}
          </Tabs>
        </Card>
      </AnimatedPage>
      <AnimatedPage delay={0.2}>
        {tab === 0 && <ScheduleTab profileId={profileId!} />}
        {tab === 1 && <BudgetsTab profileId={profileId!} />}
        {tab === 2 && <RulesTab profileId={profileId!} />}
        {tab === 3 && <ExtensionsTab profileId={profileId!} />}
        {tab === 4 && (
          <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}>
            <RewardsPage />
          </Suspense>
        )}
        {tab === 5 && (
          <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}>
            <ReportsPage />
          </Suspense>
        )}
      </AnimatedPage>
    </AnimatedPage>
  );
}
