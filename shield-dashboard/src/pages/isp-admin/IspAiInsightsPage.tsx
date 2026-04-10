import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Chip, Stack, Alert, Button, LinearProgress, IconButton, Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import PsychologyIcon from '@mui/icons-material/Psychology';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ShieldIcon from '@mui/icons-material/Shield';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';

interface AlertItem {
  id: string;
  profileId: string;
  alertType: string;
  severity: string;
  score: number;
  description: string;
  detectedAt: string;
  feedbackGiven: boolean;
}

interface ChildProfile {
  id: string;
  name: string;
}

interface InsightsData {
  profileId: string;
  riskScore: number;
  riskLevel: string;
  indicators: { type: string; description: string; severity: string }[];
  addictionScore: number;
  mentalHealthSignals: string[];
}

interface TrainingStatus {
  status: string;
  last_trained: string | null;
  progress: number;
  message: string | null;
}

interface ModelHealth {
  status: string;
  model_loaded: boolean;
  model_version: string;
  features: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: '#E53935',
  MEDIUM: '#FB8C00',
  LOW: '#43A047',
};

const SEVERITY_BG: Record<string, string> = {
  HIGH: '#FFEBEE',
  MEDIUM: '#FFF8E1',
  LOW: '#E8F5E9',
};

const PIE_COLORS = ['#43A047', '#FB8C00', '#E53935'];

export default function IspAiInsightsPage() {
  const [severity, setSeverity] = useState<string | undefined>(undefined);
  const qc = useQueryClient();

  // Platform-wide AI alerts
  const { data: alerts = [], isLoading: loadingAlerts, refetch: refetchAlerts } = useQuery({
    queryKey: ['isp-ai-alerts', severity],
    queryFn: () => {
      const params = new URLSearchParams({ min_score: '0.2', limit: '100' });
      if (severity) params.set('severity', severity);
      return api.get(`/ai/alerts?${params.toString()}`).then(r => {
        const d = r.data?.data ?? r.data;
        return (Array.isArray(d) ? d : []) as AlertItem[];
      }).catch(() => [] as AlertItem[]);
    },
    refetchInterval: 60_000,
  });

  // AI model health
  const { data: modelHealth } = useQuery({
    queryKey: ['ai-model-health'],
    queryFn: () => api.get('/ai/model/health').then(r => (r.data?.data ?? r.data) as ModelHealth).catch(() => null),
  });

  // Training status
  const { data: trainingStatus } = useQuery({
    queryKey: ['ai-training-status'],
    queryFn: () => api.get('/ai/train/status').then(r => (r.data?.data ?? r.data) as TrainingStatus).catch(() => null),
  });

  // Child profiles to cross-reference
  const { data: childProfiles = [] } = useQuery({
    queryKey: ['isp-child-profiles-ai'],
    queryFn: () => api.get('/profiles/all-children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data ?? []) as ChildProfile[];
    }).catch(() => [] as ChildProfile[]),
  });

  // Retrain model
  const retrainMutation = useMutation({
    mutationFn: () => api.post('/ai/train?days_back=30'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-training-status'] }),
  });

  // Feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: ({ alertId, accurate }: { alertId: string; accurate: boolean }) =>
      api.post(`/ai/alerts/${alertId}/feedback`, { accurate }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['isp-ai-alerts'] }),
  });

  // Stats derived from alerts
  const highCount = alerts.filter(a => a.severity === 'HIGH').length;
  const medCount = alerts.filter(a => a.severity === 'MEDIUM').length;
  const lowCount = alerts.filter(a => a.severity === 'LOW').length;

  const riskDistData = [
    { name: 'Low Risk', value: lowCount },
    { name: 'Medium Risk', value: medCount },
    { name: 'High Risk', value: highCount },
  ].filter(d => d.value > 0);

  // Alert type distribution
  const typeCounts: Record<string, number> = {};
  alerts.forEach(a => { typeCounts[a.alertType] = (typeCounts[a.alertType] ?? 0) + 1; });
  const typeChartData = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => ({ type: type.replace(/_/g, ' '), count }));

  // Top high-risk profiles
  const profileAlertMap: Record<string, { count: number; maxScore: number; severity: string }> = {};
  alerts.forEach(a => {
    if (!profileAlertMap[a.profileId]) {
      profileAlertMap[a.profileId] = { count: 0, maxScore: 0, severity: 'LOW' };
    }
    profileAlertMap[a.profileId].count++;
    if (a.score > profileAlertMap[a.profileId].maxScore) {
      profileAlertMap[a.profileId].maxScore = a.score;
      profileAlertMap[a.profileId].severity = a.severity;
    }
  });
  const topProfiles = Object.entries(profileAlertMap)
    .sort(([, a], [, b]) => b.maxScore - a.maxScore)
    .slice(0, 5);

  const getProfileName = (profileId: string) => {
    const p = childProfiles.find(c => c.id === profileId);
    return p?.name ?? profileId.slice(0, 8) + '...';
  };

  const avgScore = alerts.length > 0
    ? (alerts.reduce((s, a) => s + a.score, 0) / alerts.length).toFixed(2)
    : '0.00';

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PsychologyIcon />}
        title="AI Insights"
        subtitle="Platform-wide AI anomaly detection and risk monitoring"
        iconColor="#6A1B9A"
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => refetchAlerts()}
              sx={{ borderRadius: 2 }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={retrainMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <TrendingUpIcon />}
              onClick={() => retrainMutation.mutate()}
              disabled={retrainMutation.isPending}
              sx={{ bgcolor: '#6A1B9A', '&:hover': { bgcolor: '#4A148C' }, borderRadius: 2 }}
            >
              Retrain Model
            </Button>
          </Stack>
        }
      />

      {/* Model Health Banner */}
      {modelHealth && (
        <Alert
          severity={modelHealth.model_loaded ? 'success' : 'warning'}
          icon={<ShieldIcon />}
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            trainingStatus?.status === 'training' ? (
              <Chip label={`Training ${trainingStatus.progress ?? 0}%`} size="small" color="warning" />
            ) : trainingStatus?.last_trained ? (
              <Typography variant="caption" color="text.secondary">
                Last trained: {new Date(trainingStatus.last_trained).toLocaleString()}
              </Typography>
            ) : null
          }
        >
          AI Model: {modelHealth.model_loaded ? 'Loaded and ready' : 'Not loaded'} — v{modelHealth.model_version} ({modelHealth.features} features)
          {trainingStatus?.status === 'training' && (
            <LinearProgress variant="determinate" value={trainingStatus.progress ?? 0} sx={{ mt: 1, borderRadius: 1 }} />
          )}
        </Alert>
      )}

      {/* Stat Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <AnimatedPage delay={0.05}>
            <StatCard
              title="Total Alerts"
              value={alerts.length}
              icon={<NotificationsActiveIcon />}
              gradient="linear-gradient(135deg, #6A1B9A 0%, #4A148C 100%)"
            />
          </AnimatedPage>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <AnimatedPage delay={0.1}>
            <StatCard
              title="High Risk"
              value={highCount}
              icon={<ErrorIcon />}
              gradient="linear-gradient(135deg, #C62828 0%, #B71C1C 100%)"
            />
          </AnimatedPage>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <AnimatedPage delay={0.15}>
            <StatCard
              title="Profiles Flagged"
              value={Object.keys(profileAlertMap).length}
              icon={<ChildCareIcon />}
              gradient="linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)"
            />
          </AnimatedPage>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <AnimatedPage delay={0.2}>
            <StatCard
              title="Avg Score"
              value={avgScore}
              icon={<TrendingUpIcon />}
              gradient="linear-gradient(135deg, #E65100 0%, #BF360C 100%)"
            />
          </AnimatedPage>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        {/* Risk Distribution Pie */}
        <Grid size={{ xs: 12, md: 5 }}>
          <AnimatedPage delay={0.25}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  Alert Severity Distribution
                </Typography>
                {riskDistData.length === 0 ? (
                  <EmptyState title="No alerts" description="No AI alerts detected yet" />
                ) : (
                  <Box sx={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={riskDistData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {riskDistData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <ReTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Alert Type Bar Chart */}
        <Grid size={{ xs: 12, md: 7 }}>
          <AnimatedPage delay={0.3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  Alerts by Type
                </Typography>
                {typeChartData.length === 0 ? (
                  <EmptyState title="No data" description="Run batch analysis to generate alerts" />
                ) : (
                  <Box sx={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={typeChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <ReTooltip />
                        <Bar dataKey="count" fill="#6A1B9A" radius={[4, 4, 0, 0]} name="Alerts" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Top At-Risk Profiles */}
        <Grid size={{ xs: 12, md: 5 }}>
          <AnimatedPage delay={0.35}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  Top At-Risk Profiles
                </Typography>
                {topProfiles.length === 0 ? (
                  <EmptyState title="No flagged profiles" description="All profiles are within normal parameters" />
                ) : (
                  <Stack spacing={1.5}>
                    {topProfiles.map(([profileId, info]) => (
                      <Box
                        key={profileId}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5,
                          p: 1.5, borderRadius: 2,
                          bgcolor: SEVERITY_BG[info.severity] ?? '#F5F5F5',
                        }}
                      >
                        <ChildCareIcon sx={{ color: SEVERITY_COLORS[info.severity] ?? '#9E9E9E', fontSize: 22 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {getProfileName(profileId)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {info.count} alert{info.count !== 1 ? 's' : ''} — max score {info.maxScore.toFixed(2)}
                          </Typography>
                        </Box>
                        <Chip
                          label={info.severity}
                          size="small"
                          sx={{
                            fontWeight: 700, fontSize: 10,
                            bgcolor: SEVERITY_COLORS[info.severity] ?? '#9E9E9E',
                            color: 'white',
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Recent Alerts Feed */}
        <Grid size={{ xs: 12, md: 7 }}>
          <AnimatedPage delay={0.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600}>Recent AI Alerts</Typography>
                  <Stack direction="row" spacing={0.5}>
                    {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => (
                      <Chip
                        key={s}
                        label={s}
                        size="small"
                        onClick={() => setSeverity(s === 'ALL' ? undefined : s)}
                        sx={{
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          bgcolor: (s === 'ALL' ? !severity : severity === s) ? '#6A1B9A' : 'transparent',
                          color: (s === 'ALL' ? !severity : severity === s) ? 'white' : 'text.secondary',
                          border: '1px solid',
                          borderColor: (s === 'ALL' ? !severity : severity === s) ? '#6A1B9A' : 'divider',
                        }}
                      />
                    ))}
                  </Stack>
                </Box>

                {loadingAlerts ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={28} sx={{ color: '#6A1B9A' }} />
                  </Box>
                ) : alerts.length === 0 ? (
                  <EmptyState title="No alerts" description="No AI alerts match the current filter" />
                ) : (
                  <Stack spacing={1} sx={{ maxHeight: 380, overflowY: 'auto', pr: 0.5 }}>
                    {alerts.slice(0, 20).map(alert => {
                      const sev = alert.severity as string;
                      const color = SEVERITY_COLORS[sev] ?? '#9E9E9E';
                      const bg = SEVERITY_BG[sev] ?? '#F5F5F5';
                      const SevIcon = sev === 'HIGH' ? ErrorIcon : sev === 'MEDIUM' ? WarningAmberIcon : InfoIcon;
                      return (
                        <Box
                          key={alert.id}
                          sx={{
                            display: 'flex', alignItems: 'flex-start', gap: 1.5,
                            p: 1.5, borderRadius: 2, bgcolor: bg,
                            border: '1px solid', borderColor: `${color}30`,
                          }}
                        >
                          <SevIcon sx={{ color, fontSize: 18, mt: 0.2, flexShrink: 0 }} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4, flexWrap: 'wrap' }}>
                              <Chip
                                label={alert.alertType.replace(/_/g, ' ')}
                                size="small"
                                sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'white', color }}
                              />
                              <Chip
                                label={`Score: ${alert.score.toFixed(2)}`}
                                size="small"
                                sx={{ height: 18, fontSize: 9, fontWeight: 600, bgcolor: color, color: 'white' }}
                              />
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                {new Date(alert.detectedAt).toLocaleString()}
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              Profile: {getProfileName(alert.profileId)} — {alert.description}
                            </Typography>
                          </Box>
                          {!alert.feedbackGiven && (
                            <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                              <Tooltip title="Mark accurate">
                                <IconButton
                                  size="small"
                                  onClick={() => feedbackMutation.mutate({ alertId: alert.id, accurate: true })}
                                  sx={{ color: '#43A047', p: 0.5 }}
                                >
                                  <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>
      </Grid>
    </AnimatedPage>
  );
}
