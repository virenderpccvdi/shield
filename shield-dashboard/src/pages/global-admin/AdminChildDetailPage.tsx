import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, Chip, Button, Grid,
  CircularProgress, Avatar, Tooltip, TextField, MenuItem, Snackbar, Alert,
  IconButton, Switch, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
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
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import DnsIcon from '@mui/icons-material/Dns';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';

interface ChildProfile {
  id: string; customerId: string; tenantId: string; name: string;
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

const filterColors: Record<string, { bg: string; text: string }> = {
  STRICT: { bg: '#FFEBEE', text: '#C62828' },
  MODERATE: { bg: '#FFF8E1', text: '#F57F17' },
  RELAXED: { bg: '#E8F5E9', text: '#2E7D32' },
  CUSTOM: { bg: '#E3F2FD', text: '#1565C0' },
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── Schedule Tab ───────────────────────────────────────────────────────────
function ScheduleTab({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const [grid, setGrid] = useState<Record<string, number[]>>({});
  const [snack, setSnack] = useState('');
  const [overrideDialog, setOverrideDialog] = useState(false);
  const [overrideType, setOverrideType] = useState('PAUSE');
  const [overrideMins, setOverrideMins] = useState(60);

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['admin-schedule', profileId],
    queryFn: () => api.get(`/dns/schedules/${profileId}`).then(r => {
      const d = (r.data?.data || r.data) as ScheduleData;
      if (d?.grid) setGrid(d.grid);
      return d;
    }).catch(() => null),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/dns/schedules/${profileId}`, { grid }),
    onSuccess: () => { setSnack('Schedule saved'); queryClient.invalidateQueries({ queryKey: ['admin-schedule', profileId] }); },
  });

  const presetMutation = useMutation({
    mutationFn: (preset: string) => api.post(`/dns/schedules/${profileId}/preset?preset=${preset}`),
    onSuccess: () => { setSnack('Preset applied'); queryClient.invalidateQueries({ queryKey: ['admin-schedule', profileId] }); },
  });

  const overrideMutation = useMutation({
    mutationFn: () => api.post(`/dns/schedules/${profileId}/override`, { overrideType, durationMinutes: overrideMins }),
    onSuccess: () => { setSnack('Override applied'); setOverrideDialog(false); queryClient.invalidateQueries({ queryKey: ['admin-schedule', profileId] }); },
  });

  const cancelOverrideMutation = useMutation({
    mutationFn: () => api.delete(`/dns/schedules/${profileId}/override`),
    onSuccess: () => { setSnack('Override cancelled'); queryClient.invalidateQueries({ queryKey: ['admin-schedule', profileId] }); },
  });

  const toggle = (day: string, hour: number) => {
    setGrid(g => ({
      ...g,
      [day]: (g[day] || Array(24).fill(1)).map((v, h) => h === hour ? (v === 1 ? 0 : 1) : v),
    }));
  };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

  const presets = [
    { label: 'School Hours', icon: <SchoolIcon sx={{ fontSize: 16 }} />, color: '#1565C0', key: 'SCHOOL' },
    { label: 'Bedtime', icon: <BedtimeIcon sx={{ fontSize: 16 }} />, color: '#7B1FA2', key: 'BEDTIME' },
    { label: 'Weekend', icon: <WeekendIcon sx={{ fontSize: 16 }} />, color: '#FB8C00', key: 'WEEKEND' },
  ];

  return (
    <Box>
      {/* Override banner */}
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
              <Button size="small" color="error" startIcon={<CancelIcon />}
                onClick={() => cancelOverrideMutation.mutate()}>
                Cancel Override
              </Button>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* Preset & Override buttons */}
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
          sx={{ borderRadius: 2, borderColor: '#E5393540', color: '#E53935', '&:hover': { borderColor: '#E53935' } }}>
          Override
        </Button>
      </Box>

      {/* Schedule grid */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: '#C8E6C9', border: '1px solid #A5D6A7' }} />
              <Typography variant="caption" color="text.secondary">Allowed</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: '#FFCDD2', border: '1px solid #EF9A9A' }} />
              <Typography variant="caption" color="text.secondary">Blocked</Typography>
            </Box>
          </Box>

          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: 700 }}>
              <Box sx={{ display: 'flex', mb: 1, ml: '52px' }}>
                {HOURS.map(h => (
                  <Box key={h} sx={{ width: 28, textAlign: 'center', fontSize: 10, fontWeight: 600,
                    color: (h >= 22 || h < 6) ? '#9E9E9E' : '#546E7A' }}>{h}</Box>
                ))}
              </Box>
              {DAYS.map((day, d) => {
                const dayKey = DAY_KEYS[d];
                return (
                <Box key={day} sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
                  <Typography sx={{ width: 48, fontSize: 12, fontWeight: 700, color: d >= 5 ? '#FB8C00' : '#546E7A', pr: 1 }}>{day}</Typography>
                  {HOURS.map(h => {
                    const val = grid[dayKey]?.[h] ?? 1;
                    return (
                      <Tooltip key={h} title={`${day} ${h}:00 - ${val === 1 ? 'Blocked' : 'Allowed'}`} arrow>
                        <Box onClick={() => toggle(dayKey, h)} sx={{
                          width: 26, height: 28, borderRadius: '6px', mr: 0.25, cursor: 'pointer',
                          bgcolor: val === 1 ? '#FFCDD2' : '#C8E6C9',
                          border: '1.5px solid', borderColor: val === 1 ? '#EF9A9A' : '#A5D6A7',
                          transition: 'all 0.15s ease',
                          '&:hover': { transform: 'scale(1.15)', zIndex: 1 },
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
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              sx={{ background: 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)', borderRadius: 2, px: 3 }}>
              {saveMutation.isPending ? 'Saving...' : 'Save Schedule'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Override dialog */}
      <Dialog open={overrideDialog} onClose={() => setOverrideDialog(false)}>
        <DialogTitle>Apply Schedule Override</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 300 }}>
          <TextField select label="Override Type" value={overrideType} onChange={e => setOverrideType(e.target.value)} fullWidth>
            <MenuItem value="PAUSE">Pause Internet</MenuItem>
            <MenuItem value="HOMEWORK">Homework Mode (education only)</MenuItem>
            <MenuItem value="FOCUS">Focus Mode (strict rules)</MenuItem>
            <MenuItem value="BEDTIME_NOW">Bedtime Now (sleep mode)</MenuItem>
          </TextField>
          <TextField label="Duration (minutes)" type="number" value={overrideMins}
            onChange={e => setOverrideMins(+e.target.value)} helperText="0 = until manually cancelled" fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverrideDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => overrideMutation.mutate()}
            disabled={overrideMutation.isPending}
            sx={{ background: 'linear-gradient(135deg, #E53935 0%, #C62828 100%)' }}>
            Apply Override
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}

// ── Budgets Tab ────────────────────────────────────────────────────────────
function BudgetsTab({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [snack, setSnack] = useState('');

  const { isLoading } = useQuery({
    queryKey: ['admin-budgets', profileId],
    queryFn: () => api.get(`/dns/budgets/${profileId}`).then(r => {
      const d = r.data?.data || r.data;
      if (d && typeof d === 'object') setBudgets(d);
      return d;
    }).catch(() => ({})),
  });

  const { data: todayData } = useQuery({
    queryKey: ['admin-budgets-today', profileId],
    queryFn: () => api.get(`/dns/budgets/${profileId}/today`).then(r => r.data?.data || r.data).catch(() => null),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/dns/budgets/${profileId}`, { budgets }),
    onSuccess: () => { setSnack('Budgets saved'); queryClient.invalidateQueries({ queryKey: ['admin-budgets', profileId] }); },
  });

  const defaultApps = ['youtube', 'tiktok', 'gaming', 'social', 'streaming', 'education'];

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

  const allApps = [...new Set([...defaultApps, ...Object.keys(budgets)])];

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Daily Screen Time Budgets (minutes)</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Set daily time limits per app/service. 0 = no limit.
          </Typography>

          <Grid container spacing={2}>
            {allApps.map(app => {
              const usage = todayData?.usage?.[app];
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={app}>
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ textTransform: 'capitalize', mb: 1 }}>{app}</Typography>
                    <TextField
                      type="number" size="small" fullWidth
                      label="Daily limit (min)"
                      value={budgets[app] ?? 0}
                      onChange={e => setBudgets(b => ({ ...b, [app]: Math.max(0, +e.target.value) }))}
                      slotProps={{ htmlInput: { min: 0, step: 15 } }}
                    />
                    {usage && (
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                          flex: 1, height: 6, borderRadius: 3, bgcolor: '#E0E0E0',
                          overflow: 'hidden',
                        }}>
                          <Box sx={{
                            height: '100%', borderRadius: 3,
                            width: `${Math.min(100, usage.limitMinutes > 0 ? (usage.usedMinutes / usage.limitMinutes) * 100 : 0)}%`,
                            bgcolor: usage.status === 'EXCEEDED' ? '#E53935' : '#43A047',
                          }} />
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
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              sx={{ background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)', borderRadius: 2, px: 3 }}>
              {saveMutation.isPending ? 'Saving...' : 'Save Budgets'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}

// ── Content Rules Tab ──────────────────────────────────────────────────────
function RulesTab({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<Record<string, boolean>>({});
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [snack, setSnack] = useState('');

  const { isLoading } = useQuery({
    queryKey: ['admin-rules', profileId],
    queryFn: () => api.get(`/dns/rules/${profileId}`).then(r => {
      const d = r.data?.data || r.data;
      if (d?.enabledCategories) setCategories(d.enabledCategories);
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
    mutationFn: () => api.put(`/dns/rules/${profileId}/categories`, { enabledCategories: categories }),
    onSuccess: () => { setSnack('Categories saved'); queryClient.invalidateQueries({ queryKey: ['admin-rules', profileId] }); },
  });

  const saveBlockMutation = useMutation({
    mutationFn: () => api.put(`/dns/rules/${profileId}/blocklist`, { domains: blocklist }),
    onSuccess: () => { setSnack('Blocklist saved'); queryClient.invalidateQueries({ queryKey: ['admin-rules', profileId] }); },
  });

  const saveAllowMutation = useMutation({
    mutationFn: () => api.put(`/dns/rules/${profileId}/allowlist`, { domains: allowlist }),
    onSuccess: () => { setSnack('Allowlist saved'); queryClient.invalidateQueries({ queryKey: ['admin-rules', profileId] }); },
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

  const catEntries = Object.entries(catLabels || {});

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Categories */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Content Categories</Typography>
          <Grid container spacing={1}>
            {catEntries.map(([slug, label]) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={slug}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  p: 1.5, borderRadius: 2, bgcolor: categories[slug] ? '#FFEBEE' : '#F5F5F5',
                  transition: 'all 0.2s',
                }}>
                  <Typography variant="body2" fontWeight={500}>{label as string}</Typography>
                  <Switch size="small"
                    checked={!!categories[slug]}
                    onChange={(_, checked) => setCategories(c => ({ ...c, [slug]: checked }))}
                    color="error" />
                </Box>
              </Grid>
            ))}
          </Grid>
          <Button variant="contained" startIcon={<SaveIcon />}
            onClick={() => saveCatMutation.mutate()} disabled={saveCatMutation.isPending}
            sx={{ mt: 2, background: 'linear-gradient(135deg, #E53935 0%, #C62828 100%)', borderRadius: 2 }}>
            Save Categories
          </Button>
        </CardContent>
      </Card>

      {/* Blocklist */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Custom Blocklist</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField size="small" placeholder="domain.com" value={newDomain}
              onChange={e => setNewDomain(e.target.value)} sx={{ flex: 1 }} />
            <Button variant="outlined" startIcon={<AddIcon />}
              onClick={() => { if (newDomain.trim()) { setBlocklist(l => [...l, newDomain.trim()]); setNewDomain(''); } }}>
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {blocklist.map((d, i) => (
              <Chip key={i} label={d} size="small" onDelete={() => setBlocklist(l => l.filter((_, j) => j !== i))}
                sx={{ bgcolor: '#FFEBEE', color: '#C62828' }} />
            ))}
          </Box>
          <Button variant="outlined" color="error" startIcon={<SaveIcon />}
            onClick={() => saveBlockMutation.mutate()} disabled={saveBlockMutation.isPending}
            sx={{ mt: 2, borderRadius: 2 }}>
            Save Blocklist
          </Button>
        </CardContent>
      </Card>

      {/* Allowlist */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Custom Allowlist</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField size="small" placeholder="domain.com" value={newDomain}
              onChange={e => setNewDomain(e.target.value)} sx={{ flex: 1 }} />
            <Button variant="outlined" color="success" startIcon={<AddIcon />}
              onClick={() => { if (newDomain.trim()) { setAllowlist(l => [...l, newDomain.trim()]); setNewDomain(''); } }}>
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {allowlist.map((d, i) => (
              <Chip key={i} label={d} size="small" onDelete={() => setAllowlist(l => l.filter((_, j) => j !== i))}
                sx={{ bgcolor: '#E8F5E9', color: '#2E7D32' }} />
            ))}
          </Box>
          <Button variant="outlined" color="success" startIcon={<SaveIcon />}
            onClick={() => saveAllowMutation.mutate()} disabled={saveAllowMutation.isPending}
            sx={{ mt: 2, borderRadius: 2 }}>
            Save Allowlist
          </Button>
        </CardContent>
      </Card>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}

// ── Extension Requests Tab ─────────────────────────────────────────────────
function ExtensionsTab({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const [snack, setSnack] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-extensions', profileId],
    queryFn: () => api.get('/dns/budgets/extension-requests').then(r => {
      const all = (r.data?.data || r.data || []) as ExtensionRequest[];
      return all.filter(e => e.profileId === profileId);
    }).catch(() => []),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/dns/budgets/extension-requests/${id}/approve`),
    onSuccess: () => { setSnack('Request approved'); queryClient.invalidateQueries({ queryKey: ['admin-extensions'] }); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/dns/budgets/extension-requests/${id}/reject`),
    onSuccess: () => { setSnack('Request rejected'); queryClient.invalidateQueries({ queryKey: ['admin-extensions'] }); },
  });

  const requests = data || [];

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      {requests.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <ExtensionIcon sx={{ fontSize: 48, color: '#BDBDBD', mb: 1 }} />
            <Typography color="text.secondary">No extension requests</Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {requests.map((req, i) => (
            <AnimatedPage key={req.id} delay={i * 0.05}>
              <Card sx={{ border: req.status === 'PENDING' ? '1px solid #FFE082' : undefined }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography fontWeight={600}>{req.appName}</Typography>
                      <Chip size="small" label={`+${req.requestedMins}min`}
                        sx={{ bgcolor: '#E3F2FD', color: '#1565C0', fontWeight: 600, fontSize: 11 }} />
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

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AdminChildDetailPage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['admin-child-profile', profileId],
    queryFn: () => api.get(`/profiles/admin/children/${profileId}`).then(r => (r.data?.data || r.data) as ChildProfile),
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (!profile) return <Typography color="error">Profile not found</Typography>;

  const fc = filterColors[profile.filterLevel] || filterColors.MODERATE;
  const tabs = [
    { label: 'Schedule', icon: <ScheduleIcon sx={{ fontSize: 18 }} /> },
    { label: 'Screen Time', icon: <TimerIcon sx={{ fontSize: 18 }} /> },
    { label: 'Content Rules', icon: <ShieldIcon sx={{ fontSize: 18 }} /> },
    { label: 'Extensions', icon: <ExtensionIcon sx={{ fontSize: 18 }} /> },
  ];

  return (
    <AnimatedPage>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/child-profiles')}
        sx={{ mb: 2, color: 'text.secondary', '&:hover': { bgcolor: '#F8FAFC' } }}>
        Back to Child Profiles
      </Button>

      {/* Profile Header */}
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 3, overflow: 'hidden' }}>
          <Box sx={{ height: 6, background: 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)' }} />
          <CardContent sx={{ pt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
              <Avatar sx={{
                width: 64, height: 64,
                background: 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)',
                fontWeight: 700, fontSize: 22,
                boxShadow: '0 4px 14px rgba(123,31,162,0.3)',
              }}>
                {getInitials(profile.name)}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" fontWeight={700}>{profile.name}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Chip size="small" label={profile.ageGroup}
                    sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: '#E3F2FD', color: '#1565C0' }} />
                  <Chip size="small" label={profile.filterLevel}
                    sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: fc.bg, color: fc.text }} />
                  <Chip size="small" icon={<DnsIcon sx={{ fontSize: 14 }} />} label={profile.dnsClientId}
                    sx={{ height: 22, fontSize: 11, fontFamily: 'monospace' }} />
                </Box>
              </Box>
            </Box>
          </CardContent>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
            sx={{
              borderTop: '1px solid #E8EDF2',
              '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 48 },
              '& .Mui-selected': { color: '#7B1FA2' },
            }}>
            {tabs.map(t => <Tab key={t.label} label={t.label} icon={t.icon} iconPosition="start" />)}
          </Tabs>
        </Card>
      </AnimatedPage>

      {/* Tab content */}
      <AnimatedPage delay={0.2}>
        {tab === 0 && <ScheduleTab profileId={profileId!} />}
        {tab === 1 && <BudgetsTab profileId={profileId!} />}
        {tab === 2 && <RulesTab profileId={profileId!} />}
        {tab === 3 && <ExtensionsTab profileId={profileId!} />}
      </AnimatedPage>
    </AnimatedPage>
  );
}
