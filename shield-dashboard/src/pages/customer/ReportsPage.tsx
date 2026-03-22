import { useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, CircularProgress, Alert,
  Tabs, Tab, Chip, Table, TableHead, TableRow, TableCell, TableBody,
  Stack, Divider, LinearProgress, Button, Snackbar,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LanguageIcon from '@mui/icons-material/Language';
import CategoryIcon from '@mui/icons-material/Category';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import { gradients } from '../../theme/theme';
import LoadingPage from '../../components/LoadingPage';

type Period = 'TODAY' | 'WEEK' | 'MONTH';

const PIE_COLORS = [
  '#1565C0', '#E53935', '#43A047', '#FB8C00', '#9C27B0',
  '#00ACC1', '#F57F17', '#00897B', '#AD1457', '#546E7A',
];

const PERIOD_LABELS: Record<Period, string> = {
  TODAY: 'Today',
  WEEK: 'This Week',
  MONTH: 'This Month',
};

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface DnsEvent { id: string; domain: string; action: 'ALLOWED' | 'BLOCKED'; category: string; queriedAt: string; }
interface TopDomain { domain: string; count: number; action?: string; }
interface CategoryStat { name: string; value: number; percent: number; }
interface DailyPoint { day: string; queries: number; blocks: number; allowed: number; }
interface AppUsageItem {
  appName: string;
  packageName: string;
  totalMinutes: number;
  blockedCount?: number;
}

interface ReportsPageProps {
  profileId?: string;
}

export default function ReportsPage({ profileId: profileIdProp }: ReportsPageProps) {
  const { profileId: profileIdParam } = useParams<{ profileId: string }>();
  const profileId = profileIdProp ?? profileIdParam;
  const [period, setPeriod] = useState<Period>('WEEK');
  const [chartTab, setChartTab] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const handleDownloadPdf = async () => {
    if (!profileId) return;
    setPdfLoading(true);
    try {
      const response = await api.get(`/analytics/${profileId}/report/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `shield-report-${profileId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: 'PDF downloaded successfully', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to download PDF report', severity: 'error' });
    } finally {
      setPdfLoading(false);
    }
  };

  // Stats query — period-aware
  const statsQuery = useQuery({
    queryKey: ['report-stats', profileId, period],
    queryFn: async () => {
      const r = await api.get(`/analytics/${profileId}/stats`, { params: { period } });
      const raw = r.data?.data ?? r.data;
      // Normalise: API returns blockedQueries/allowedQueries
      return {
        totalQueries: raw?.totalQueries ?? 0,
        totalBlocked: raw?.totalBlocked ?? raw?.blockedQueries ?? 0,
        totalAllowed: raw?.totalAllowed ?? raw?.allowedQueries ?? 0,
        blockRate:    Number.isFinite(raw?.blockRate) ? raw.blockRate : 0,
      } as { totalQueries: number; totalBlocked: number; totalAllowed: number; blockRate: number; };
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Daily chart data
  const dailyQuery = useQuery({
    queryKey: ['report-daily', profileId, period],
    queryFn: async () => {
      const days = period === 'TODAY' ? 1 : period === 'WEEK' ? 7 : 30;
      const r = await api.get(`/analytics/${profileId}/daily`, { params: { days } });
      const raw = (r.data?.data ?? r.data) as { date: string; totalQueries: number; blockedQueries: number }[];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return (raw || []).map(d => {
        const q = d.totalQueries || 0;
        const b = d.blockedQueries || 0;
        return {
          day: period === 'MONTH'
            ? new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })
            : dayNames[new Date(d.date).getDay()] || d.date,
          queries: q,
          blocks: b,
          allowed: q - b,
        } as DailyPoint;
      });
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Category breakdown
  const catQuery = useQuery({
    queryKey: ['report-categories', profileId, period],
    queryFn: async () => {
      const p = period === 'TODAY' ? 'today' : period === 'WEEK' ? 'week' : 'month';
      const r = await api.get(`/analytics/${profileId}/categories`, { params: { period: p } });
      const raw = (r.data?.data ?? r.data) as { category: string; count: number }[];
      if (!raw || !raw.length) return [] as CategoryStat[];
      const total = raw.reduce((s, c) => s + c.count, 0);
      return raw
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(c => ({
          name: c.category || 'Unknown',
          value: c.count,
          percent: total > 0 ? Math.round(c.count / total * 100) : 0,
        }));
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Top blocked domains
  const topBlockedQuery = useQuery({
    queryKey: ['report-top-blocked', profileId],
    queryFn: async () => {
      const r = await api.get(`/analytics/${profileId}/top-domains`, { params: { action: 'BLOCKED', limit: 10 } });
      return (r.data?.data ?? r.data) as TopDomain[];
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Recent activity — all queries (blocked + allowed), auto-refreshes every 60s
  const historyQuery = useQuery({
    queryKey: ['report-history', profileId],
    queryFn: async () => {
      const r = await api.get(`/analytics/${profileId}/history`, { params: { page: 0, size: 50 } });
      const raw = r.data?.content ?? r.data?.data?.content ?? r.data?.data ?? r.data;
      return (Array.isArray(raw) ? raw : []) as DnsEvent[];
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // App usage query
  const appUsageQuery = useQuery({
    queryKey: ['app-usage', profileId],
    queryFn: async () => {
      const r = await api.get(`/analytics/${profileId}/top-apps`);
      const raw = r.data?.data ?? r.data;
      return (Array.isArray(raw) ? raw : raw?.content ?? []) as AppUsageItem[];
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const stats = statsQuery.data;
  const daily = dailyQuery.data ?? [];
  const categories = catQuery.data ?? [];
  const topBlocked = (topBlockedQuery.data ?? []) as TopDomain[];
  const history = (historyQuery.data ?? []) as DnsEvent[];
  const appUsage = (appUsageQuery.data ?? []) as AppUsageItem[];
  const loading = statsQuery.isLoading;

  const totalQ = stats?.totalQueries ?? daily.reduce((s, d) => s + d.queries, 0);
  const totalB = stats?.totalBlocked ?? daily.reduce((s, d) => s + d.blocks, 0);
  const totalA = stats?.totalAllowed ?? (totalQ - totalB);
  const blockRate = stats?.blockRate != null
    ? stats.blockRate.toFixed(1)
    : totalQ > 0 ? ((totalB / totalQ) * 100).toFixed(1) : '0';
  const maxBlocked = topBlocked.length > 0 ? topBlocked[0].count : 1;

  return (
    <AnimatedPage>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <PageHeader
          icon={<AssessmentIcon />}
          title="Reports & Analytics"
          subtitle={`DNS activity report — ${PERIOD_LABELS[period]}`}
          iconColor="#1565C0"
        />
        <Button
          variant="contained"
          startIcon={pdfLoading ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
          onClick={handleDownloadPdf}
          disabled={pdfLoading || !profileId}
          sx={{
            mt: 1,
            bgcolor: '#C62828',
            '&:hover': { bgcolor: '#B71C1C' },
            '&:disabled': { bgcolor: '#E0E0E0' },
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {pdfLoading ? 'Downloading…' : 'Download PDF'}
        </Button>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%', borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Period Selector */}
      <AnimatedPage delay={0.05}>
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={period}
            onChange={(_, v) => setPeriod(v as Period)}
            sx={{
              minHeight: 40,
              '& .MuiTabs-indicator': { height: 3, borderRadius: 2 },
              '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600, fontSize: 14 },
            }}
          >
            <Tab label="Today" value="TODAY" />
            <Tab label="This Week" value="WEEK" />
            <Tab label="This Month" value="MONTH" />
          </Tabs>
        </Box>
      </AnimatedPage>

      {/* Summary Stats Row */}
      {loading ? (
        <LoadingPage />
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                title="Total Queries"
                value={fmt(totalQ)}
                icon={<DnsIcon />}
                gradient={gradients.blue}
                delay={0.1}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                title="Blocked"
                value={fmt(totalB)}
                icon={<BlockIcon />}
                gradient={gradients.red}
                delay={0.15}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                title="Allowed"
                value={fmt(totalA)}
                icon={<CheckCircleIcon />}
                gradient={gradients.green}
                delay={0.2}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                title="Block Rate"
                value={`${blockRate}%`}
                icon={<TrendingUpIcon />}
                gradient={gradients.purple}
                delay={0.25}
              />
            </Grid>
          </Grid>

          {/* Chart Tabs */}
          <AnimatedPage delay={0.3}>
            <Box sx={{ mb: 2 }}>
              <Tabs
                value={chartTab}
                onChange={(_, v) => setChartTab(v)}
                sx={{
                  mb: 3,
                  borderBottom: '1px solid #E8EDF2',
                  '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
                }}
              >
                <Tab label="Daily Activity" />
                <Tab label="Category Breakdown" />
                <Tab label="Top Blocked Domains" />
                <Tab label="Recent Activity" />
                <Tab label="App Usage" />
              </Tabs>

              {/* Tab 0: Daily Activity BarChart */}
              {chartTab === 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                      DNS Queries vs Blocked
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      {period === 'TODAY' ? 'Hourly breakdown' : period === 'WEEK' ? 'Daily breakdown — last 7 days' : 'Daily breakdown — last 30 days'}
                    </Typography>
                    {dailyQuery.isLoading ? (
                      <LoadingPage />
                    ) : daily.length === 0 ? (
                      <EmptyState
                        icon={<DnsIcon sx={{ fontSize: 36, color: '#1565C0' }} />}
                        title="No activity data yet"
                        description="DNS activity will appear here after the child starts browsing"
                      />
                    ) : (
                      <ResponsiveContainer width="100%" height={320}>
                        {period === 'MONTH' ? (
                          <AreaChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                            <defs>
                              <linearGradient id="reportGradQ" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1565C0" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#1565C0" stopOpacity={0.02} />
                              </linearGradient>
                              <linearGradient id="reportGradB" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#E53935" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#E53935" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                            <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, border: '1px solid #E8EDF2' }} />
                            <Legend />
                            <Area type="monotone" dataKey="queries" name="Total Queries" stroke="#1565C0" strokeWidth={2} fill="url(#reportGradQ)" dot={false} />
                            <Area type="monotone" dataKey="blocks" name="Blocked" stroke="#E53935" strokeWidth={2} fill="url(#reportGradB)" dot={false} />
                          </AreaChart>
                        ) : (
                          <BarChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                            <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, border: '1px solid #E8EDF2' }} />
                            <Legend />
                            <Bar dataKey="allowed" name="Allowed" fill="#43A047" radius={[4, 4, 0, 0]} stackId="a" />
                            <Bar dataKey="blocks" name="Blocked" fill="#E53935" radius={[4, 4, 0, 0]} stackId="a" />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tab 1: Category Breakdown */}
              {chartTab === 1 && (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                          Blocked Categories
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Content types that were blocked
                        </Typography>
                        {catQuery.isLoading ? (
                          <LoadingPage />
                        ) : categories.length === 0 ? (
                          <Box sx={{ textAlign: 'center', py: 4 }}>
                            <CategoryIcon sx={{ fontSize: 40, color: '#ccc', mb: 1 }} />
                            <Typography color="text.secondary">No category data available</Typography>
                          </Box>
                        ) : (
                          <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                              <Pie
                                data={categories}
                                cx="50%"
                                cy="50%"
                                outerRadius={105}
                                innerRadius={55}
                                dataKey="value"
                                paddingAngle={2}
                                label={({ name, percent }: any) =>
                                  percent > 8 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                                }
                                labelLine={false}
                              >
                                {categories.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: number) => [fmt(v), 'Queries']} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid size={{ xs: 12, md: 7 }}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                          Category Details
                        </Typography>
                        {catQuery.isLoading ? (
                          <LoadingPage />
                        ) : categories.length === 0 ? (
                          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            No data for this period
                          </Typography>
                        ) : (
                          <Stack spacing={1.5}>
                            {categories.map((cat, i) => (
                              <Box key={cat.name}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Box sx={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    bgcolor: PIE_COLORS[i % PIE_COLORS.length],
                                    flexShrink: 0,
                                  }} />
                                  <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                                    {cat.name}
                                  </Typography>
                                  <Typography variant="body2" fontWeight={700}>
                                    {fmt(cat.value)}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, textAlign: 'right' }}>
                                    {cat.percent}%
                                  </Typography>
                                </Box>
                                <LinearProgress
                                  variant="determinate"
                                  value={cat.percent}
                                  sx={{
                                    height: 4,
                                    borderRadius: 2,
                                    bgcolor: '#F0F0F0',
                                    ml: 2.5,
                                    '& .MuiLinearProgress-bar': {
                                      bgcolor: PIE_COLORS[i % PIE_COLORS.length],
                                      borderRadius: 2,
                                    },
                                  }}
                                />
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}

              {/* Tab 2: Top Blocked Domains */}
              {chartTab === 2 && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                      Top Blocked Domains
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Most frequently blocked sites
                    </Typography>
                    {topBlockedQuery.isLoading ? (
                      <LoadingPage />
                    ) : topBlocked.length === 0 ? (
                      <EmptyState
                        icon={<BlockIcon sx={{ fontSize: 36, color: '#E53935' }} />}
                        title="No blocked domains"
                        description="No domains have been blocked yet during this period"
                      />
                    ) : (
                      <Stack spacing={0}>
                        {topBlocked.map((d, i) => (
                          <Box key={d.domain}>
                            <Box sx={{
                              display: 'flex', alignItems: 'center', gap: 2,
                              py: 1.5, px: 1,
                              borderRadius: 1.5,
                              '&:hover': { bgcolor: '#F8FAFC' },
                              transition: 'background 0.15s',
                            }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  minWidth: 24, fontWeight: 700, color: '#9E9E9E',
                                  fontFamily: '"JetBrains Mono", monospace',
                                }}
                              >
                                #{i + 1}
                              </Typography>
                              <LanguageIcon sx={{ fontSize: 18, color: '#E53935', flexShrink: 0 }} />
                              <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }} noWrap>
                                {d.domain}
                              </Typography>
                              <Box sx={{ flex: 2, mx: 2 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.round((d.count / maxBlocked) * 100)}
                                  sx={{
                                    height: 6, borderRadius: 3,
                                    bgcolor: '#FFE5E5',
                                    '& .MuiLinearProgress-bar': { bgcolor: '#E53935', borderRadius: 3 },
                                  }}
                                />
                              </Box>
                              <Chip
                                label={fmt(d.count)}
                                size="small"
                                sx={{
                                  bgcolor: '#FFE5E5', color: '#C62828',
                                  fontWeight: 700, height: 22, fontSize: 11,
                                }}
                              />
                            </Box>
                            {i < topBlocked.length - 1 && <Divider sx={{ opacity: 0.5 }} />}
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tab 3: Recent Activity */}
              {chartTab === 3 && (
                <Card>
                  <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
                      <Typography variant="subtitle1" fontWeight={600}>Recent Activity</Typography>
                      <Typography variant="body2" color="text.secondary">Latest DNS queries from this profile</Typography>
                    </Box>
                    {historyQuery.isLoading ? (
                      <LoadingPage />
                    ) : history.length === 0 ? (
                      <EmptyState
                        icon={<DnsIcon sx={{ fontSize: 36, color: '#1565C0' }} />}
                        title="No recent activity"
                        description="DNS queries will appear here once the child starts browsing"
                      />
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ '& th': { fontWeight: 700, color: '#546E7A', fontSize: 12, bgcolor: '#F8FAFC' } }}>
                            <TableCell>Domain</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell align="center">Action</TableCell>
                            <TableCell align="right">Time</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {history.map((ev, i) => (
                            <TableRow
                              key={ev.id || i}
                              sx={{
                                borderLeft: `3px solid ${ev.action === 'BLOCKED' ? '#E53935' : '#43A047'}`,
                                '&:hover': { bgcolor: '#FAFBFC' },
                                '& td': { py: 1 },
                              }}
                            >
                              <TableCell>
                                <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 240 }}>
                                  {ev.domain}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={ev.category || 'Unknown'}
                                  size="small"
                                  sx={{
                                    height: 20, fontSize: 11,
                                    bgcolor: '#F1F5F9', color: '#546E7A',
                                  }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  size="small"
                                  label={ev.action}
                                  color={ev.action === 'BLOCKED' ? 'error' : 'success'}
                                  sx={{ height: 22, fontSize: 11, fontWeight: 700 }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>
                                  {relativeTime(ev.queriedAt)}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}
              {/* Tab 4: App Usage */}
              {chartTab === 4 && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                      App Usage
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Time spent per app (top 10)
                    </Typography>
                    {appUsageQuery.isLoading ? (
                      <LoadingPage />
                    ) : appUsage.length === 0 ? (
                      <EmptyState
                        icon={<LanguageIcon sx={{ fontSize: 36, color: '#1565C0' }} />}
                        title="No app usage data yet"
                        description="App usage will appear here after the child uses the Shield app on their device"
                      />
                    ) : (
                      <Stack spacing={1.5}>
                        {[...appUsage]
                          .sort((a, b) => b.totalMinutes - a.totalMinutes)
                          .slice(0, 10)
                          .map(app => {
                            const maxMins = appUsage.reduce((m, a) => Math.max(m, a.totalMinutes), 1);
                            return (
                              <Box key={app.packageName} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Typography
                                  sx={{ width: 150, flexShrink: 0, fontSize: 13, fontWeight: 600 }}
                                  noWrap
                                >
                                  {app.appName}
                                </Typography>
                                <Box sx={{ flex: 1, bgcolor: '#F1F5F9', borderRadius: 1, overflow: 'hidden' }}>
                                  <Box sx={{
                                    height: 20,
                                    width: `${(app.totalMinutes / maxMins) * 100}%`,
                                    bgcolor: 'primary.main',
                                    borderRadius: 1,
                                    minWidth: app.totalMinutes > 0 ? 4 : 0,
                                  }} />
                                </Box>
                                <Typography sx={{ width: 60, textAlign: 'right', fontSize: 13, color: 'text.secondary', flexShrink: 0 }}>
                                  {app.totalMinutes}m
                                </Typography>
                                {(app.blockedCount ?? 0) > 0 && (
                                  <Chip
                                    label={`${app.blockedCount} blocked`}
                                    size="small"
                                    sx={{ height: 20, fontSize: 10, bgcolor: '#FFEBEE', color: '#C62828', fontWeight: 700, flexShrink: 0 }}
                                  />
                                )}
                              </Box>
                            );
                          })}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              )}

            </Box>
          </AnimatedPage>

          {statsQuery.isError && dailyQuery.isError && catQuery.isError && (
            <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
              No report data is available yet. Data will appear after the child starts using their device.
            </Alert>
          )}
        </>
      )}
    </AnimatedPage>
  );
}
