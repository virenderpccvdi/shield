import { useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Chip, Stack, Alert, Button, LinearProgress, Divider, IconButton, Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from 'recharts';
import PsychologyIcon from '@mui/icons-material/Psychology';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ShieldIcon from '@mui/icons-material/Shield';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import MemoryIcon from '@mui/icons-material/Memory';
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
  MEDIUM: '#92400E',
  LOW: '#43A047',
};

const SEVERITY_BG: Record<string, string> = {
  HIGH: '#FFEBEE',
  MEDIUM: '#FFF8E1',
  LOW: '#E8F5E9',
};

const PIE_COLORS = ['#43A047', '#FB8C00', '#E53935'];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AdminAiInsightsPage() {
  const [severity, setSeverity] = useState<string | undefined>(undefined);
  const [retrainDays, setRetrainDays] = useState(30);
  const qc = useQueryClient();

  // Platform-wide AI alerts
  const { data: alerts = [], isLoading: loadingAlerts, refetch: refetchAlerts } = useQuery({
    queryKey: ['admin-ai-alerts', severity],
    queryFn: () => {
      const params = new URLSearchParams({ min_score: '0.1', limit: '200' });
      if (severity) params.set('severity', severity);
      return api.get(`/ai/alerts?${params.toString()}`).then(r => {
        const d = r.data?.data ?? r.data;
        return (Array.isArray(d) ? d : []) as AlertItem[];
      }).catch(() => [] as AlertItem[]);
    },
    refetchInterval: 60_000,
    staleTime: 30000,
  });

  // AI model health
  const { data: modelHealth, refetch: refetchHealth } = useQuery({
    queryKey: ['admin-ai-model-health'],
    queryFn: () => api.get('/ai/model/health').then(r => (r.data?.data ?? r.data) as ModelHealth).catch(() => null),
    refetchInterval: 60_000,
    staleTime: 30000,
  });

  // Training status
  const { data: trainingStatus, refetch: refetchTraining } = useQuery({
    queryKey: ['admin-ai-training-status'],
    queryFn: () => api.get('/ai/train/status').then(r => (r.data?.data ?? r.data) as TrainingStatus).catch(() => null),
    refetchInterval: 60_000,
    staleTime: 30000,
  });

  // Retrain model
  const retrainMutation = useMutation({
    mutationFn: () => api.post(`/ai/train?days_back=${retrainDays}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ai-training-status'] });
      setTimeout(() => refetchTraining(), 2000);
    },
  });

  // Feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: ({ alertId, accurate }: { alertId: string; accurate: boolean }) =>
      api.post(`/ai/alerts/${alertId}/feedback`, { accurate }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-ai-alerts'] }),
  });

  // Stats
  const highCount = alerts.filter(a => a.severity === 'HIGH').length;
  const medCount = alerts.filter(a => a.severity === 'MEDIUM').length;
  const lowCount = alerts.filter(a => a.severity === 'LOW').length;
  const uniqueProfiles = new Set(alerts.map(a => a.profileId)).size;
  const avgScore = alerts.length > 0
    ? (alerts.reduce((s, a) => s + a.score, 0) / alerts.length).toFixed(3)
    : '0.000';

  const riskDistData = [
    { name: 'Low', value: lowCount },
    { name: 'Medium', value: medCount },
    { name: 'High', value: highCount },
  ].filter(d => d.value > 0);

  // Alert type distribution
  const typeCounts: Record<string, number> = {};
  alerts.forEach(a => { typeCounts[a.alertType] = (typeCounts[a.alertType] ?? 0) + 1; });
  const typeChartData = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => ({ type: type.replace(/_/g, ' '), count }));

  // Real alert trend derived from actual alerts bucketed by day of week
  const alertTrendData = useMemo(() => {
    const dayMap: Record<string, { alerts: number; anomalies: number }> = {};
    DAYS.forEach(d => { dayMap[d] = { alerts: 0, anomalies: 0 }; });
    alerts.forEach(a => {
      const d = new Date(a.detectedAt);
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
      if (dayMap[dayName]) {
        dayMap[dayName].alerts++;
        if (a.score > 0.5) dayMap[dayName].anomalies++;
      }
    });
    return DAYS.map(day => ({ day, ...dayMap[day] }));
  }, [alerts]);

  // Top at-risk profiles
  const profileAlertMap: Record<string, { count: number; maxScore: number; severity: string; types: Set<string> }> = {};
  alerts.forEach(a => {
    if (!profileAlertMap[a.profileId]) {
      profileAlertMap[a.profileId] = { count: 0, maxScore: 0, severity: 'LOW', types: new Set() };
    }
    profileAlertMap[a.profileId].count++;
    profileAlertMap[a.profileId].types.add(a.alertType);
    if (a.score > profileAlertMap[a.profileId].maxScore) {
      profileAlertMap[a.profileId].maxScore = a.score;
      profileAlertMap[a.profileId].severity = a.severity;
    }
  });
  const topProfiles = Object.entries(profileAlertMap)
    .sort(([, a], [, b]) => b.maxScore - a.maxScore)
    .slice(0, 8);

  const trainingStatusColor = trainingStatus?.status === 'completed' ? 'success'
    : trainingStatus?.status === 'training' ? 'warning'
    : trainingStatus?.status === 'failed' ? 'error' : 'info';

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PsychologyIcon />}
        title="AI Insights"
        subtitle="System-wide AI anomaly detection, model management, and risk intelligence"
        iconColor="#6A1B9A"
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => { refetchAlerts(); refetchHealth(); refetchTraining(); }}
              sx={{ borderRadius: 2 }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={retrainMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
              onClick={() => retrainMutation.mutate()}
              disabled={retrainMutation.isPending || trainingStatus?.status === 'training'}
              sx={{ bgcolor: '#6A1B9A', '&:hover': { bgcolor: '#4A148C' }, borderRadius: 2 }}
            >
              Retrain ({retrainDays}d)
            </Button>
          </Stack>
        }
      />

      {/* Model Health + Training Status */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{
            border: '1px solid',
            borderColor: modelHealth?.model_loaded ? '#66BB6A' : '#FFA726',
          }}>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <MemoryIcon sx={{ color: modelHealth?.model_loaded ? '#43A047' : '#FB8C00', fontSize: 28 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    IsolationForest Model
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    v{modelHealth?.model_version ?? '—'} — {modelHealth?.features ?? 11} features
                  </Typography>
                </Box>
                <Chip
                  label={modelHealth?.model_loaded ? 'LOADED' : 'NOT LOADED'}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: 10,
                    bgcolor: modelHealth?.model_loaded ? '#E8F5E9' : '#FFF3E0',
                    color: modelHealth?.model_loaded ? '#2E7D32' : '#92400E',
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ border: '1px solid', borderColor: `${trainingStatusColor}.main` }}>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {trainingStatus?.status === 'training'
                  ? <CircularProgress size={24} sx={{ color: '#FB8C00' }} />
                  : trainingStatus?.status === 'completed'
                  ? <CheckCircleIcon sx={{ color: '#43A047', fontSize: 28 }} />
                  : <HourglassEmptyIcon sx={{ color: '#9E9E9E', fontSize: 28 }} />}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700}>Training Status</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {trainingStatus?.last_trained
                      ? `Last: ${new Date(trainingStatus.last_trained).toLocaleString()}`
                      : 'Never trained'}
                  </Typography>
                </Box>
                <Chip
                  label={(trainingStatus?.status ?? 'IDLE').toUpperCase()}
                  size="small"
                  color={trainingStatusColor as 'success' | 'warning' | 'error' | 'info'}
                  sx={{ fontWeight: 700, fontSize: 10 }}
                />
              </Box>
              {trainingStatus?.status === 'training' && (
                <LinearProgress
                  variant="determinate"
                  value={trainingStatus.progress ?? 0}
                  sx={{ mt: 1, borderRadius: 1, bgcolor: '#FFF3E0', '& .MuiLinearProgress-bar': { bgcolor: '#FB8C00' } }}
                />
              )}
              {trainingStatus?.message && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {trainingStatus.message}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Retrain days selector */}
      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight={600}>Training window:</Typography>
            {[7, 14, 30, 60, 90].map(d => (
              <Chip
                key={d}
                label={`${d} days`}
                size="small"
                onClick={() => setRetrainDays(d)}
                sx={{
                  cursor: 'pointer', fontWeight: 600, fontSize: 11,
                  bgcolor: retrainDays === d ? '#6A1B9A' : 'transparent',
                  color: retrainDays === d ? 'white' : 'text.secondary',
                  border: '1px solid', borderColor: retrainDays === d ? '#6A1B9A' : 'divider',
                }}
              />
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              More days = more training data = better model accuracy
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
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
              value={uniqueProfiles}
              icon={<ChildCareIcon />}
              gradient="linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)"
            />
          </AnimatedPage>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <AnimatedPage delay={0.2}>
            <StatCard
              title="Avg Risk Score"
              value={avgScore}
              icon={<TrendingUpIcon />}
              gradient="linear-gradient(135deg, #E65100 0%, #BF360C 100%)"
            />
          </AnimatedPage>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        {/* Severity Pie */}
        <Grid size={{ xs: 12, md: 4 }}>
          <AnimatedPage delay={0.25}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  Alert Severity
                </Typography>
                {riskDistData.length === 0 ? (
                  <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
                    <CheckCircleIcon sx={{ fontSize: 48, color: '#43A047' }} />
                    <Typography variant="body2" color="text.secondary">No anomalies detected</Typography>
                    <Typography variant="caption" color="text.secondary">System appears healthy</Typography>
                  </Box>
                ) : (
                  <Box sx={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={riskDistData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
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
                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={0.75}>
                  {[
                    { label: 'High', count: highCount, color: '#E53935' },
                    { label: 'Medium', count: medCount, color: '#FB8C00' },
                    { label: 'Low', count: lowCount, color: '#43A047' },
                  ].map(row => (
                    <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.color, flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ flex: 1 }}>{row.label}</Typography>
                      <Typography variant="body2" fontWeight={700}>{row.count}</Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Alert Type Bar */}
        <Grid size={{ xs: 12, md: 8 }}>
          <AnimatedPage delay={0.3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  Alerts by Category
                </Typography>
                {typeChartData.length === 0 ? (
                  <EmptyState title="No data" description="Run batch analysis to generate categorized alerts" />
                ) : (
                  <Box sx={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={typeChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <ReTooltip />
                        <Bar dataKey="count" fill="#7B1FA2" radius={[4, 4, 0, 0]} name="Alerts" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Daily Alert Trend */}
        <Grid size={{ xs: 12, md: 7 }}>
          <AnimatedPage delay={0.35}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  Weekly Alert Trend
                </Typography>
                <Box sx={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={alertTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <ReTooltip />
                      <Area type="monotone" dataKey="alerts" stroke="#7B1FA2" fill="#F3E5F5" name="Alerts" />
                      <Area type="monotone" dataKey="anomalies" stroke="#E53935" fill="#FFEBEE" name="Anomalies" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Top At-Risk Profiles */}
        <Grid size={{ xs: 12, md: 5 }}>
          <AnimatedPage delay={0.4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  Top At-Risk Profiles
                </Typography>
                {topProfiles.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary" variant="body2">No at-risk profiles detected</Typography>
                  </Box>
                ) : (
                  <Stack spacing={1}>
                    {topProfiles.map(([profileId, info]) => (
                      <Box
                        key={profileId}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5,
                          p: 1.25, borderRadius: 2,
                          bgcolor: SEVERITY_BG[info.severity] ?? '#F5F5F5',
                        }}
                      >
                        <ChildCareIcon sx={{ color: SEVERITY_COLORS[info.severity], fontSize: 20 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: 12 }}>
                            {profileId.slice(0, 8)}...
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {info.count} alerts · score {info.maxScore.toFixed(2)}
                          </Typography>
                        </Box>
                        <Chip
                          label={info.severity}
                          size="small"
                          sx={{
                            fontWeight: 700, fontSize: 10,
                            bgcolor: SEVERITY_COLORS[info.severity],
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

        {/* Full Alerts Feed */}
        <Grid size={12}>
          <AnimatedPage delay={0.45}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    All Platform Alerts
                    <Chip label={alerts.length} size="small" sx={{ ml: 1, fontWeight: 700, bgcolor: '#EDE7F6', color: '#6A1B9A' }} />
                  </Typography>
                  <Stack direction="row" spacing={0.5}>
                    {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => (
                      <Chip
                        key={s}
                        label={s}
                        size="small"
                        onClick={() => setSeverity(s === 'ALL' ? undefined : s)}
                        sx={{
                          fontSize: 10, fontWeight: 600, cursor: 'pointer',
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
                  <Stack spacing={1} sx={{ maxHeight: 480, overflowY: 'auto', pr: 0.5 }}>
                    {alerts.slice(0, 50).map(alert => {
                      const sev = alert.severity;
                      const color = SEVERITY_COLORS[sev] ?? '#9E9E9E';
                      const bg = SEVERITY_BG[sev] ?? '#F5F5F5';
                      const SevIcon = sev === 'HIGH' ? ErrorIcon : sev === 'MEDIUM' ? WarningAmberIcon : InfoIcon;
                      return (
                        <Box
                          key={alert.id}
                          sx={{
                            display: 'flex', alignItems: 'flex-start', gap: 1.5,
                            p: 1.5, borderRadius: 2, bgcolor: bg,
                            border: '1px solid', borderColor: `${color}25`,
                          }}
                        >
                          <SevIcon sx={{ color, fontSize: 18, mt: 0.2, flexShrink: 0 }} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, flexWrap: 'wrap' }}>
                              <Chip
                                label={alert.alertType.replace(/_/g, ' ')}
                                size="small"
                                sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'white', color }}
                              />
                              <Chip
                                label={`Score: ${alert.score.toFixed(3)}`}
                                size="small"
                                sx={{ height: 18, fontSize: 9, fontWeight: 600, bgcolor: color, color: 'white' }}
                              />
                              {alert.feedbackGiven && (
                                <Chip
                                  label="Reviewed"
                                  size="small"
                                  sx={{ height: 18, fontSize: 9, bgcolor: '#E3F2FD', color: '#1565C0' }}
                                />
                              )}
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                {new Date(alert.detectedAt).toLocaleString()}
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              Profile {alert.profileId.slice(0, 8)}... — {alert.description}
                            </Typography>
                          </Box>
                          {!alert.feedbackGiven && (
                            <Tooltip title="Mark as accurate alert">
                              <IconButton
                                size="small"
                                onClick={() => feedbackMutation.mutate({ alertId: alert.id, accurate: true })}
                                sx={{ color: '#43A047', flexShrink: 0, p: 0.5 }}
                              >
                                <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
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
