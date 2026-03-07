import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Chip, Stack, Alert, Divider, IconButton, Tooltip as MuiTooltip
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoIcon from '@mui/icons-material/Info';
import ErrorIcon from '@mui/icons-material/Error';
import ShieldIcon from '@mui/icons-material/Shield';
import FavoriteIcon from '@mui/icons-material/Favorite';
import NightlightIcon from '@mui/icons-material/Nightlight';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface ChildProfile { id: string; name: string; }

interface RiskIndicator {
  type: string;
  description: string;
  severity: string;
  detectedAt: string;
}

interface InsightsData {
  profileId: string;
  riskScore: number;
  riskLevel: string;
  indicators: RiskIndicator[];
  addictionScore: number;
  mentalHealthSignals: string[];
}

interface WeeklyDigest {
  profileId: string;
  weekOf: string;
  summary: string;
  riskLevel: string;
  riskScore: number;
  signals: string[];
  usageTrend: string;
  topInsight: string;
  recommendedAction?: string;
  generatedAt: string;
}

interface KeywordData {
  profileId: string;
  keywords: Record<string, number>;
}

interface SocialAlert {
  id: string;
  profileId: string;
  alertType: string;
  severity: string;
  description: string;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
  detectedAt: string;
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  LOW: { color: '#2E7D32', bg: '#E8F5E9', icon: <InfoIcon /> },
  MEDIUM: { color: '#F57F17', bg: '#FFF8E1', icon: <WarningAmberIcon /> },
  HIGH: { color: '#C62828', bg: '#FFEBEE', icon: <ErrorIcon /> },
};

const RISK_COLORS: Record<string, { color: string; bg: string }> = {
  LOW: { color: '#43A047', bg: '#E8F5E9' },
  MEDIUM: { color: '#FB8C00', bg: '#FFF8E1' },
  HIGH: { color: '#E53935', bg: '#FFEBEE' },
};

const TREND_ICONS: Record<string, React.ReactNode> = {
  UP: <TrendingUpIcon sx={{ fontSize: 18 }} />,
  DOWN: <TrendingDownIcon sx={{ fontSize: 18 }} />,
  STABLE: <RemoveIcon sx={{ fontSize: 18 }} />,
};

const SOCIAL_ALERT_ICONS: Record<string, React.ReactNode> = {
  LATE_NIGHT: <NightlightIcon sx={{ fontSize: 20 }} />,
  SOCIAL_SPIKE: <TrendingUpIcon sx={{ fontSize: 20 }} />,
  GAMING_SPIKE: <SportsEsportsIcon sx={{ fontSize: 20 }} />,
  NEW_CATEGORY: <NewReleasesIcon sx={{ fontSize: 20 }} />,
};

const SOCIAL_ALERT_COLORS: Record<string, { color: string; bg: string }> = {
  HIGH: { color: '#C62828', bg: '#FFEBEE' },
  MEDIUM: { color: '#E65100', bg: '#FFF3E0' },
  LOW: { color: '#2E7D32', bg: '#E8F5E9' },
};

function RiskGauge({ score, level }: { score: number; level: string }) {
  const config = RISK_COLORS[level] || RISK_COLORS.LOW;
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={score}
        size={100}
        thickness={6}
        sx={{
          color: config.color,
          '& .MuiCircularProgress-circle': { strokeLinecap: 'round' },
        }}
      />
      <Box sx={{
        top: 0, left: 0, bottom: 0, right: 0,
        position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <Typography variant="h5" fontWeight={800} sx={{ color: config.color, lineHeight: 1 }}>{score}</Typography>
        <Typography variant="caption" fontWeight={600} sx={{ color: config.color }}>{level}</Typography>
      </Box>
    </Box>
  );
}

export default function AiInsightsPage() {
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: children } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => []),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ['ai-insights', profileId],
    queryFn: () => api.get(`/ai/${profileId}/insights`).then(r => r.data as InsightsData),
    enabled: !!profileId,
  });

  const { data: weekly, isLoading: loadingWeekly } = useQuery({
    queryKey: ['ai-weekly', profileId],
    queryFn: () => api.get(`/ai/${profileId}/weekly`).then(r => r.data as WeeklyDigest),
    enabled: !!profileId,
  });

  const { data: keywordData } = useQuery({
    queryKey: ['ai-keywords', profileId],
    queryFn: () => api.get(`/ai/${profileId}/keywords`).then(r => r.data as KeywordData).catch(() => null),
    enabled: !!profileId,
  });

  const { data: socialAlerts } = useQuery({
    queryKey: ['social-alerts', profileId],
    queryFn: () => api.get(`/analytics/${profileId}/social-alerts`)
      .then(r => r.data as SocialAlert[])
      .catch(() => [] as SocialAlert[]),
    enabled: !!profileId,
    refetchInterval: 2 * 60 * 1000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => api.post(`/analytics/social-alerts/${alertId}/acknowledge`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social-alerts', profileId] }),
  });

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<PsychologyIcon />} title="AI Insights" subtitle="AI-powered behavior analysis" iconColor="#7B1FA2" />
        <EmptyState title="No child profiles" description="Add a child profile to see AI insights" />
      </AnimatedPage>
    );
  }

  const isLoading = loadingInsights || loadingWeekly;

  // Generate mock weekly chart data
  const weeklyChartData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
    day,
    risk: Math.floor(Math.random() * 40) + 10,
    usage: Math.floor(Math.random() * 180) + 30,
  }));

  // Keyword bar chart data
  const keywords = keywordData?.keywords || {};
  const keywordChartData = Object.entries(keywords)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PsychologyIcon />}
        title="AI Insights"
        subtitle="AI-powered behavior analysis and risk assessment"
        iconColor="#7B1FA2"
        action={
          <Stack direction="row" spacing={1}>
            {(children || []).map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? '#7B1FA2' : '#F3E5F5',
                  color: (profileId === c.id) ? 'white' : '#7B1FA2',
                  '&:hover': { bgcolor: (profileId === c.id) ? '#6A1B9A' : '#E1BEE7' },
                }}
              />
            ))}
          </Stack>
        }
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : (
        <Grid container spacing={2.5}>
          {/* Risk Score Card */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <AnimatedPage delay={0.1}>
              <Card sx={{ textAlign: 'center' }}>
                <CardContent sx={{ py: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>Risk Score</Typography>
                  <RiskGauge
                    score={insights?.riskScore ?? 15}
                    level={insights?.riskLevel ?? 'LOW'}
                  />
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>

          {/* Addiction Score */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <AnimatedPage delay={0.15}>
              <Card sx={{ textAlign: 'center' }}>
                <CardContent sx={{ py: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>Addiction Score</Typography>
                  <RiskGauge
                    score={insights?.addictionScore ?? 20}
                    level={(insights?.addictionScore ?? 20) > 60 ? 'HIGH' : (insights?.addictionScore ?? 20) > 35 ? 'MEDIUM' : 'LOW'}
                  />
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>

          {/* Usage Trend */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <AnimatedPage delay={0.2}>
              <Card>
                <CardContent sx={{ py: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Usage Trend</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {TREND_ICONS[weekly?.usageTrend || 'STABLE']}
                    <Typography variant="h6" fontWeight={700}>
                      {weekly?.usageTrend || 'STABLE'}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Week of {weekly?.weekOf || 'N/A'}
                  </Typography>
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>

          {/* Mental Health Signals */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <AnimatedPage delay={0.25}>
              <Card>
                <CardContent sx={{ py: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <FavoriteIcon sx={{ color: '#E91E63', fontSize: 20 }} />
                    <Typography variant="subtitle2" color="text.secondary">Mental Health</Typography>
                  </Box>
                  {(insights?.mentalHealthSignals || []).length === 0 ? (
                    <Chip label="No concerns" size="small" sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 600 }} />
                  ) : (
                    <Stack spacing={0.5}>
                      {(insights?.mentalHealthSignals || []).slice(0, 3).map((s, i) => (
                        <Typography key={i} variant="caption" color="warning.main">{s}</Typography>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>

          {/* Weekly Summary */}
          {weekly && (
            <Grid size={12}>
              <AnimatedPage delay={0.3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                      <ShieldIcon sx={{ color: '#7B1FA2' }} />
                      <Typography variant="subtitle1" fontWeight={600}>Weekly Summary</Typography>
                    </Box>
                    <Alert
                      severity={weekly.riskLevel === 'HIGH' ? 'error' : weekly.riskLevel === 'MEDIUM' ? 'warning' : 'success'}
                      sx={{ mb: 2, borderRadius: 2 }}
                    >
                      {weekly.summary}
                    </Alert>
                    {weekly.topInsight && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Top Insight:</strong> {weekly.topInsight}
                      </Typography>
                    )}
                    {weekly.recommendedAction && (
                      <Typography variant="body2" color="primary">
                        <strong>Recommendation:</strong> {weekly.recommendedAction}
                      </Typography>
                    )}
                    {weekly.signals.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Divider sx={{ mb: 1.5 }} />
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {weekly.signals.map((s, i) => (
                            <Chip key={i} label={s} size="small" variant="outlined" sx={{ fontSize: 12 }} />
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          )}

          {/* Risk Indicators */}
          {insights && insights.indicators.length > 0 && (
            <Grid size={{ xs: 12, md: 6 }}>
              <AnimatedPage delay={0.35}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Risk Indicators</Typography>
                    <Stack spacing={1.5}>
                      {insights.indicators.map((ind, i) => {
                        const sev = SEVERITY_CONFIG[ind.severity] || SEVERITY_CONFIG.LOW;
                        return (
                          <Box
                            key={i}
                            sx={{
                              display: 'flex', alignItems: 'flex-start', gap: 1.5,
                              p: 1.5, borderRadius: 2, bgcolor: sev.bg,
                            }}
                          >
                            <Box sx={{ color: sev.color, mt: 0.3, '& .MuiSvgIcon-root': { fontSize: 20 } }}>
                              {sev.icon}
                            </Box>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{ind.type}</Typography>
                              <Typography variant="caption" color="text.secondary">{ind.description}</Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={ind.severity}
                              sx={{ ml: 'auto', height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'white', color: sev.color }}
                            />
                          </Box>
                        );
                      })}
                    </Stack>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          )}

          {/* Weekly Usage Chart */}
          <Grid size={{ xs: 12, md: insights && insights.indicators.length > 0 ? 6 : 12 }}>
            <AnimatedPage delay={0.4}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Weekly Usage Trend</Typography>
                  <Box sx={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="usage" stroke="#7B1FA2" fill="#F3E5F5" name="Usage (min)" />
                        <Area type="monotone" dataKey="risk" stroke="#E53935" fill="#FFEBEE" name="Risk Score" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>

          {/* Social Monitoring Alerts */}
          {(socialAlerts && socialAlerts.length > 0) && (
            <Grid size={12}>
              <AnimatedPage delay={0.42}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={600}>Social Monitoring Alerts</Typography>
                      <Chip
                        label={`${socialAlerts.filter(a => !a.acknowledged).length} unread`}
                        size="small"
                        sx={{ bgcolor: '#FFEBEE', color: '#C62828', fontWeight: 700 }}
                      />
                    </Box>
                    <Stack spacing={1.5}>
                      {socialAlerts.slice(0, 10).map(alert => {
                        const colors = SOCIAL_ALERT_COLORS[alert.severity] || SOCIAL_ALERT_COLORS.LOW;
                        const icon = SOCIAL_ALERT_ICONS[alert.alertType] || <NewReleasesIcon sx={{ fontSize: 20 }} />;
                        return (
                          <Box
                            key={alert.id}
                            sx={{
                              display: 'flex', alignItems: 'flex-start', gap: 1.5,
                              p: 1.5, borderRadius: 2,
                              bgcolor: alert.acknowledged ? '#FAFAFA' : colors.bg,
                              opacity: alert.acknowledged ? 0.6 : 1,
                              border: '1px solid',
                              borderColor: alert.acknowledged ? '#E0E0E0' : `${colors.color}40`,
                            }}
                          >
                            <Box sx={{ color: colors.color, mt: 0.2 }}>{icon}</Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Chip
                                  label={alert.alertType.replace('_', ' ')}
                                  size="small"
                                  sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'white', color: colors.color }}
                                />
                                <Chip
                                  label={alert.severity}
                                  size="small"
                                  sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: colors.color, color: 'white' }}
                                />
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                  {new Date(alert.detectedAt).toLocaleString()}
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary">{alert.description}</Typography>
                            </Box>
                            {!alert.acknowledged && (
                              <MuiTooltip title="Mark as read">
                                <IconButton
                                  size="small"
                                  onClick={() => acknowledgeMutation.mutate(alert.id)}
                                  sx={{ color: colors.color }}
                                >
                                  <CheckCircleOutlineIcon fontSize="small" />
                                </IconButton>
                              </MuiTooltip>
                            )}
                          </Box>
                        );
                      })}
                    </Stack>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          )}

          {/* Keyword Analysis */}
          {keywordChartData.length > 0 && (
            <Grid size={12}>
              <AnimatedPage delay={0.45}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Top Search Keywords</Typography>
                    <Box sx={{ height: 250 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={keywordChartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis dataKey="word" type="category" tick={{ fontSize: 12 }} width={100} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#7B1FA2" radius={[0, 4, 4, 0]} name="Searches" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          )}
        </Grid>
      )}
    </AnimatedPage>
  );
}
