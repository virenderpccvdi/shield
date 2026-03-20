import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Slider, CircularProgress,
  Button, Chip, LinearProgress, Divider, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Stack, Accordion,
  AccordionSummary, AccordionDetails, Switch, FormControlLabel, Snackbar, Alert,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import PeopleIcon from '@mui/icons-material/People';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import LanguageIcon from '@mui/icons-material/Language';
import SchoolIcon from '@mui/icons-material/School';
import SaveIcon from '@mui/icons-material/Save';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WeekendIcon from '@mui/icons-material/Weekend';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface ChildProfile { id: string; name: string; }

interface BudgetToday {
  totalMinutesUsed: number;
  totalMinutesAllowed: number;
  categories: Record<string, { used: number; allowed: number }>;
}

interface ExtensionRequest {
  id: string;
  profileName?: string;
  category: string;
  requestedMinutes: number;
  reason?: string;
  status: string;
  createdAt: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; apps: string[] }> = {
  social: { label: 'Social Media', icon: <PeopleIcon />, color: '#1565C0', bg: '#E3F2FD', apps: ['Facebook', 'Instagram', 'TikTok', 'Snapchat', 'Twitter/X'] },
  gaming: { label: 'Gaming', icon: <SportsEsportsIcon />, color: '#7B1FA2', bg: '#F3E5F5', apps: ['Steam', 'Roblox', 'Minecraft', 'Fortnite', 'Mobile Games'] },
  streaming: { label: 'Streaming', icon: <LiveTvIcon />, color: '#00897B', bg: '#E0F2F1', apps: ['YouTube', 'Netflix', 'Disney+', 'Prime Video', 'Twitch'] },
  general: { label: 'General Browsing', icon: <LanguageIcon />, color: '#FB8C00', bg: '#FFF3E0', apps: ['Web browsers', 'News sites', 'General internet'] },
  educational: { label: 'Educational', icon: <SchoolIcon />, color: '#2E7D32', bg: '#E8F5E9', apps: ['Khan Academy', 'Duolingo', 'School portals', 'Wikipedia'] },
};

const PRESETS: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string; budgets: Record<string, number> }> = {
  schoolDay: {
    label: 'School Day',
    icon: <SchoolIcon />,
    color: '#1565C0',
    desc: 'Minimal distractions for focus',
    budgets: { social: 30, gaming: 30, streaming: 60, general: 120, educational: 480 },
  },
  weekend: {
    label: 'Weekend',
    icon: <WeekendIcon />,
    color: '#7B1FA2',
    desc: 'More freedom for leisure time',
    budgets: { social: 90, gaming: 120, streaming: 120, general: 240, educational: 60 },
  },
  homeworkTime: {
    label: 'Homework Time',
    icon: <DoNotDisturbIcon />,
    color: '#E53935',
    desc: 'Block all distractions',
    budgets: { social: 0, gaming: 0, streaming: 0, general: 30, educational: 480 },
  },
};

function formatMins(m: number) {
  if (m === 0) return 'No limit set (0)';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min > 0 ? `${min}m` : ''}`.trim() : `${min}m`;
}

function formatMinsShort(m: number) {
  if (m === 0) return '0m';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min > 0 ? `${min}m` : ''}`.trim() : `${min}m`;
}

function UsageBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const barColor = pct > 80 ? '#E53935' : pct > 50 ? '#FB8C00' : color;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          Today: {formatMinsShort(used)} used
        </Typography>
        <Typography variant="caption" fontWeight={600} color={pct > 80 ? 'error' : pct > 50 ? 'warning.main' : 'success.main'}>
          {limit > 0 ? `${Math.round(pct)}%` : 'No limit'}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={limit > 0 ? pct : 0}
        sx={{
          height: 6, borderRadius: 3,
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: barColor },
        }}
      />
    </Box>
  );
}

export default function TimeLimitsPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [noLimit, setNoLimit] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [expanded, setExpanded] = useState<string | false>('social');

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => []),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const { data: budgetConfig, isLoading: loadingBudgets } = useQuery({
    queryKey: ['budgets', profileId],
    queryFn: () => api.get(`/dns/budgets/${profileId}`).then(r => r.data.data as Record<string, number>),
    enabled: !!profileId,
  });

  const { data: todayUsage } = useQuery({
    queryKey: ['budgets-today', profileId],
    queryFn: () => api.get(`/dns/budgets/${profileId}/today`).then(r => r.data.data as BudgetToday),
    enabled: !!profileId,
    refetchInterval: 30000,
  });

  const { data: extensionRequests } = useQuery({
    queryKey: ['extension-requests'],
    queryFn: () => api.get('/dns/budgets/extension-requests').then(r => r.data.data as ExtensionRequest[]).catch(() => []),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, number>) =>
      api.put(`/dns/budgets/${profileId}`, { budgets: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets', profileId] });
      setDirty(false);
      setSnackbar({ open: true, message: 'Time limits saved successfully' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/dns/budgets/extension-requests/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['extension-requests'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/dns/budgets/extension-requests/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['extension-requests'] }),
  });

  const defaultBudgets: Record<string, number> = { gaming: 60, social: 30, streaming: 90, general: 120, educational: 480 };
  const effectiveBudgets: Record<string, number> = dirty ? budgets : (budgetConfig || defaultBudgets);

  const handleSliderChange = (cat: string, val: number) => {
    const updated = { ...effectiveBudgets, [cat]: val };
    setBudgets(updated);
    setDirty(true);
  };

  const handleNoLimitToggle = (cat: string, checked: boolean) => {
    setNoLimit(prev => ({ ...prev, [cat]: checked }));
    if (checked) {
      const updated = { ...effectiveBudgets, [cat]: 0 };
      setBudgets(updated);
      setDirty(true);
    }
  };

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    setBudgets(preset.budgets);
    setNoLimit({});
    setDirty(true);
    setSnackbar({ open: true, message: `"${preset.label}" preset applied — click Save to confirm` });
  };

  const totalUsed = todayUsage?.totalMinutesUsed || 0;
  const totalAllowed = todayUsage?.totalMinutesAllowed || Object.values(effectiveBudgets).filter(v => v > 0).reduce((a, b) => a + b, 0);
  const usagePercent = totalAllowed > 0 ? Math.min((totalUsed / totalAllowed) * 100, 100) : 0;

  if (loadingChildren) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<AccessTimeIcon />} title="Time Limits" subtitle="Set daily screen time budgets" iconColor="#FB8C00" />
        <EmptyState title="No child profiles" description="Add a child profile first to set time limits" />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<AccessTimeIcon />}
        title="Time Limits"
        subtitle="Manage daily screen time budgets per category"
        iconColor="#FB8C00"
        action={
          <Stack direction="row" spacing={1}>
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => { setSelectedChild(c.id); setDirty(false); }}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? '#FB8C00' : '#FFF3E0',
                  color: (profileId === c.id) ? 'white' : '#FB8C00',
                  '&:hover': { bgcolor: (profileId === c.id) ? '#F57C00' : '#FFE0B2' },
                }}
              />
            ))}
          </Stack>
        }
      />

      {/* Today's Usage Overview */}
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>Today's Overview</Typography>
              <Chip
                size="small"
                label={`${formatMinsShort(totalUsed)} / ${formatMinsShort(totalAllowed)}`}
                sx={{
                  fontWeight: 600,
                  bgcolor: usagePercent > 80 ? '#FFEBEE' : '#E8F5E9',
                  color: usagePercent > 80 ? '#C62828' : '#2E7D32',
                }}
              />
            </Box>
            <LinearProgress
              variant="determinate"
              value={usagePercent}
              sx={{
                height: 10, borderRadius: 5,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 5,
                  background: usagePercent > 80
                    ? 'linear-gradient(90deg, #FB8C00, #E53935)'
                    : 'linear-gradient(90deg, #43A047, #66BB6A)',
                },
              }}
            />
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Quick Presets */}
      <AnimatedPage delay={0.15}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <FlashOnIcon sx={{ color: '#FB8C00' }} />
              <Typography variant="subtitle1" fontWeight={600}>Quick Presets</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Apply a preset to quickly set time limits. You can fine-tune afterwards.
            </Typography>
            <Grid container spacing={1.5}>
              {Object.entries(PRESETS).map(([key, preset]) => (
                <Grid size={{ xs: 12, sm: 4 }} key={key}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={preset.icon}
                    onClick={() => applyPreset(key)}
                    sx={{
                      borderRadius: 2, py: 1.5, flexDirection: 'column', gap: 0.5,
                      borderColor: preset.color, color: preset.color,
                      '& .MuiButton-startIcon': { margin: 0 },
                      '&:hover': { bgcolor: `${preset.color}11`, borderColor: preset.color },
                    }}
                  >
                    <Box component="span" sx={{ fontWeight: 700, fontSize: 14 }}>{preset.label}</Box>
                    <Box component="span" sx={{ fontSize: 11, fontWeight: 400, color: 'text.secondary', textTransform: 'none' }}>{preset.desc}</Box>
                  </Button>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Category Budgets as Accordions */}
      <AnimatedPage delay={0.2}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
          Category Budgets
        </Typography>
        {loadingBudgets ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <Box sx={{ mb: 3 }}>
            {Object.entries(CATEGORY_CONFIG).map(([key, config], i) => {
              const limit = effectiveBudgets[key] ?? 0;
              const used = todayUsage?.categories?.[key]?.used ?? 0;
              const isNoLimit = noLimit[key] || false;

              return (
                <Accordion
                  key={key}
                  expanded={expanded === key}
                  onChange={(_, isExpanded) => setExpanded(isExpanded ? key : false)}
                  elevation={0}
                  sx={{
                    mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: '12px !important',
                    '&:before': { display: 'none' },
                    '&.Mui-expanded': { borderColor: config.color },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 64 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                      <Box sx={{
                        width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
                        bgcolor: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: config.color, '& .MuiSvgIcon-root': { fontSize: 20 },
                      }}>
                        {config.icon}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600}>{config.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {isNoLimit ? 'No limit' : formatMinsShort(limit)} daily
                          {used > 0 && ` · ${formatMinsShort(used)} used today`}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={isNoLimit ? 'No limit' : formatMinsShort(limit)}
                        sx={{
                          mr: 1, fontWeight: 700, fontSize: 11,
                          bgcolor: isNoLimit ? '#E8F5E9' : limit === 0 ? '#FFEBEE' : '#F3E5F5',
                          color: isNoLimit ? '#2E7D32' : limit === 0 ? '#C62828' : config.color,
                        }}
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0, pb: 2.5, px: 2.5 }}>
                    <Divider sx={{ mb: 2 }} />

                    {/* App examples */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Includes
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                        {config.apps.map(app => (
                          <Chip key={app} label={app} size="small" sx={{ fontSize: 11, height: 22 }} />
                        ))}
                      </Box>
                    </Box>

                    {/* Usage bar */}
                    {!isNoLimit && <Box sx={{ mb: 2 }}>
                      <UsageBar used={used} limit={limit} color={config.color} />
                    </Box>}

                    {/* No limit toggle */}
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={isNoLimit}
                          onChange={(e) => handleNoLimitToggle(key, e.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: '#43A047' },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#43A047' },
                          }}
                        />
                      }
                      label={<Typography variant="body2">No daily limit</Typography>}
                      sx={{ mb: isNoLimit ? 0 : 1.5 }}
                    />

                    {/* Slider */}
                    {!isNoLimit && (
                      <Box sx={{ px: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          Daily Limit: <strong>{formatMins(limit)}</strong>
                        </Typography>
                        <Slider
                          value={limit}
                          min={0}
                          max={480}
                          step={15}
                          onChange={(_, val) => handleSliderChange(key, val as number)}
                          valueLabelDisplay="auto"
                          valueLabelFormat={formatMinsShort}
                          marks={[
                            { value: 0, label: '0' },
                            { value: 60, label: '1h' },
                            { value: 120, label: '2h' },
                            { value: 240, label: '4h' },
                            { value: 480, label: '8h' },
                          ]}
                          sx={{
                            color: config.color,
                            '& .MuiSlider-thumb': { width: 18, height: 18 },
                            '& .MuiSlider-markLabel': { fontSize: 11 },
                          }}
                        />
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )}
      </AnimatedPage>

      {/* Save Button */}
      {dirty && (
        <AnimatedPage delay={0}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => saveMutation.mutate(budgets)}
              disabled={saveMutation.isPending}
              sx={{ bgcolor: '#FB8C00', '&:hover': { bgcolor: '#F57C00' } }}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </AnimatedPage>
      )}

      {/* Extension Requests */}
      {extensionRequests && extensionRequests.length > 0 && (
        <AnimatedPage delay={0.4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Extension Requests
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {extensionRequests.map((req) => (
                <Box
                  key={req.id}
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    py: 1.5, borderBottom: '1px solid', borderColor: 'divider',
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {req.profileName || 'Child'} requests +{req.requestedMinutes}min for {CATEGORY_CONFIG[req.category]?.label || req.category}
                    </Typography>
                    {req.reason && (
                      <Typography variant="caption" color="text.secondary">{req.reason}</Typography>
                    )}
                  </Box>
                  {req.status === 'PENDING' ? (
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="small"
                        onClick={() => approveMutation.mutate(req.id)}
                        sx={{ color: '#43A047', '&:hover': { bgcolor: '#E8F5E9' } }}
                      >
                        <CheckCircleIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => rejectMutation.mutate(req.id)}
                        sx={{ color: '#E53935', '&:hover': { bgcolor: '#FFEBEE' } }}
                      >
                        <CloseIcon />
                      </IconButton>
                    </Stack>
                  ) : (
                    <Chip
                      size="small"
                      label={req.status}
                      color={req.status === 'APPROVED' ? 'success' : 'error'}
                      sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                    />
                  )}
                </Box>
              ))}
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
