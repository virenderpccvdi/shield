import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Slider, CircularProgress,
  Button, Chip, LinearProgress, Divider, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Stack
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import PeopleIcon from '@mui/icons-material/People';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import LanguageIcon from '@mui/icons-material/Language';
import SaveIcon from '@mui/icons-material/Save';
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

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  gaming: { label: 'Gaming', icon: <SportsEsportsIcon />, color: '#7B1FA2', bg: '#F3E5F5' },
  social: { label: 'Social Media', icon: <PeopleIcon />, color: '#1565C0', bg: '#E3F2FD' },
  streaming: { label: 'Streaming', icon: <LiveTvIcon />, color: '#00897B', bg: '#E0F2F1' },
  general: { label: 'General Browsing', icon: <LanguageIcon />, color: '#FB8C00', bg: '#FFF3E0' },
};

function formatMins(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export default function TimeLimitsPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);

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

  // Initialize budgets from config
  const effectiveBudgets = dirty ? budgets : (budgetConfig || {
    gaming: 60, social: 30, streaming: 90, general: 120,
  });

  const handleSliderChange = (cat: string, val: number) => {
    const updated = { ...effectiveBudgets, [cat]: val };
    setBudgets(updated);
    setDirty(true);
  };

  if (loadingChildren) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<AccessTimeIcon />} title="Time Limits" subtitle="Set daily screen time budgets" iconColor="#FB8C00" />
        <EmptyState title="No child profiles" description="Add a child profile first to set time limits" />
      </AnimatedPage>
    );
  }

  const totalUsed = todayUsage?.totalMinutesUsed || 0;
  const totalAllowed = todayUsage?.totalMinutesAllowed || Object.values(effectiveBudgets).reduce((a, b) => a + b, 0);
  const usagePercent = totalAllowed > 0 ? Math.min((totalUsed / totalAllowed) * 100, 100) : 0;

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
              <Typography variant="subtitle1" fontWeight={600}>Today's Usage</Typography>
              <Chip
                size="small"
                label={`${formatMins(totalUsed)} / ${formatMins(totalAllowed)}`}
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
                bgcolor: '#F5F5F5',
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

      {/* Category Budget Sliders */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {Object.entries(CATEGORY_CONFIG).map(([key, config], i) => {
          const limit = effectiveBudgets[key] ?? 60;
          const used = todayUsage?.categories?.[key]?.used ?? 0;
          const catPercent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

          return (
            <Grid size={{ xs: 12, sm: 6 }} key={key}>
              <AnimatedPage delay={0.15 + i * 0.05}>
                <Card sx={{ borderLeft: `4px solid ${config.color}` }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                      <Box sx={{
                        width: 40, height: 40, borderRadius: '10px',
                        bgcolor: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: config.color, '& .MuiSvgIcon-root': { fontSize: 20 },
                      }}>
                        {config.icon}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>{config.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatMins(used)} used of {formatMins(limit)}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={catPercent >= 100 ? 'Limit Reached' : `${Math.round(catPercent)}%`}
                        sx={{
                          height: 22, fontSize: 11, fontWeight: 600,
                          bgcolor: catPercent >= 100 ? '#FFEBEE' : catPercent > 70 ? '#FFF8E1' : '#E8F5E9',
                          color: catPercent >= 100 ? '#C62828' : catPercent > 70 ? '#F57F17' : '#2E7D32',
                        }}
                      />
                    </Box>

                    <LinearProgress
                      variant="determinate"
                      value={catPercent}
                      sx={{
                        height: 6, borderRadius: 3, mb: 2, bgcolor: '#F5F5F5',
                        '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: config.color },
                      }}
                    />

                    <Box sx={{ px: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        Daily Limit: {formatMins(limit)}
                      </Typography>
                      <Slider
                        value={limit}
                        min={0}
                        max={480}
                        step={15}
                        onChange={(_, val) => handleSliderChange(key, val as number)}
                        valueLabelDisplay="auto"
                        valueLabelFormat={formatMins}
                        sx={{
                          color: config.color,
                          '& .MuiSlider-thumb': { width: 18, height: 18 },
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          );
        })}
      </Grid>

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
                    py: 1.5, borderBottom: '1px solid #F0F0F0',
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
    </AnimatedPage>
  );
}
