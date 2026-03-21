import { useQuery } from '@tanstack/react-query';
import {
  Box, Card, CardContent, CardHeader, Chip, Grid, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Paper, Stack,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import DevicesIcon from '@mui/icons-material/Devices';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import BarChartIcon from '@mui/icons-material/BarChart';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import { gradients } from '../../theme/theme';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v ?? 0);
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '';
  }
}

// ─── API fetchers ────────────────────────────────────────────────────────────

async function fetchOverview() {
  const [statsRes, analyticsRes] = await Promise.allSettled([
    api.get('/admin/platform/stats'),
    api.get('/analytics/platform/overview'),
  ]);
  const stats = statsRes.status === 'fulfilled' ? (statsRes.value.data?.data ?? statsRes.value.data ?? {}) : {};
  const analytics = analyticsRes.status === 'fulfilled' ? (analyticsRes.value.data?.data ?? analyticsRes.value.data ?? {}) : {};
  return {
    totalCustomers: stats.totalCustomers ?? analytics.totalCustomers ?? 0,
    activeDevices: stats.activeDevices ?? analytics.activeDevices ?? 0,
    dnsQueriesToday: analytics.totalQueries ?? stats.dnsQueriesToday ?? 0,
    threatsBlockedToday: analytics.blockedQueries ?? analytics.threatsBlocked ?? stats.threatsBlocked ?? 0,
  };
}

async function fetchDailyStats() {
  const res = await api.get('/analytics/platform/daily?days=30');
  const d = res.data;
  const arr: any[] = Array.isArray(d) ? d : (d?.data ?? []);
  return arr.map((p: any) => ({
    day: fmtDate(p.date ?? p.day),
    queries: p.totalQueries ?? p.queries ?? 0,
    blocked: p.blockedQueries ?? p.blocked ?? 0,
  }));
}

async function fetchCategories() {
  const res = await api.get('/analytics/platform/categories?limit=10');
  const d = res.data;
  const arr: any[] = Array.isArray(d) ? d : (d?.data ?? []);
  return arr.slice(0, 10).map((c: any) => ({
    name: c.category ?? c.name ?? 'Unknown',
    blocks: c.count ?? c.blocks ?? 0,
  }));
}

async function fetchTenants() {
  const res = await api.get('/tenants?size=20&page=0');
  const d = res.data?.data ?? res.data;
  return (d?.content ?? d ?? []) as any[];
}

async function fetchRecentAlerts() {
  const results = await Promise.allSettled([
    api.get('/location/panic/recent?limit=20'),
    api.get('/admin/alerts/recent?limit=20'),
  ]);
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const d = r.value.data;
      const arr: any[] = Array.isArray(d) ? d : (d?.data ?? []);
      if (arr.length) return arr.slice(0, 20);
    }
  }
  return [];
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface TopCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  gradient: string;
  loading: boolean;
}

function TopCard({ title, value, icon, gradient, loading }: TopCardProps) {
  return (
    <Card sx={{
      background: gradient,
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s',
      '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
    }}>
      <Box sx={{
        position: 'absolute', top: -16, right: -16,
        width: 88, height: 88, borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
      }} />
      <CardContent sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 500, fontSize: 13 }}>{title}</Typography>
          <Box sx={{ opacity: 0.7 }}>{icon}</Box>
        </Box>
        {loading ? (
          <Skeleton variant="text" width={80} height={44} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
        ) : (
          <Typography variant="h4" fontWeight={800}>
            {typeof value === 'number' ? fmt(value) : value}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Chart skeletons ─────────────────────────────────────────────────────────

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <Box sx={{ height, display: 'flex', alignItems: 'flex-end', gap: 1, px: 2, pb: 2 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" width="100%"
          height={`${30 + Math.random() * 60}%`}
          sx={{ borderRadius: 1 }} />
      ))}
    </Box>
  );
}

// ─── Alert type chip ─────────────────────────────────────────────────────────

function AlertChip({ type }: { type: string }) {
  const t = (type ?? '').toLowerCase();
  if (t.includes('sos') || t.includes('panic')) return <Chip label="SOS" size="small" color="error" />;
  if (t.includes('geofence')) return <Chip label="Geofence" size="small" color="warning" />;
  if (t.includes('ai') || t.includes('anomaly')) return <Chip label="AI" size="small" color="secondary" />;
  return <Chip label={type || 'Alert'} size="small" />;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['admin-analytics-overview'],
    queryFn: fetchOverview,
    staleTime: 60_000,
  });

  const { data: daily = [], isLoading: dailyLoading } = useQuery({
    queryKey: ['admin-analytics-daily'],
    queryFn: fetchDailyStats,
    staleTime: 60_000,
  });

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['admin-analytics-categories'],
    queryFn: fetchCategories,
    staleTime: 60_000,
  });

  const { data: tenants = [], isLoading: tenantLoading } = useQuery({
    queryKey: ['admin-analytics-tenants'],
    queryFn: fetchTenants,
    staleTime: 60_000,
  });

  const { data: alerts = [], isLoading: alertLoading } = useQuery({
    queryKey: ['admin-analytics-alerts'],
    queryFn: fetchRecentAlerts,
    staleTime: 30_000,
  });

  const topCards = [
    {
      title: 'Total Customers',
      value: overview?.totalCustomers ?? 0,
      icon: <PeopleIcon />,
      gradient: gradients.blue,
    },
    {
      title: 'Active Devices',
      value: overview?.activeDevices ?? 0,
      icon: <DevicesIcon />,
      gradient: gradients.teal,
    },
    {
      title: 'DNS Queries Today',
      value: overview?.dnsQueriesToday ?? 0,
      icon: <DnsIcon />,
      gradient: gradients.purple,
    },
    {
      title: 'Threats Blocked Today',
      value: overview?.threatsBlockedToday ?? 0,
      icon: <BlockIcon />,
      gradient: gradients.red,
    },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        icon={<BarChartIcon />}
        title="Admin Analytics"
        subtitle="Platform-wide statistics — customers, DNS traffic, blocked threats, active tenants, and recent alerts"
      />

      {/* ── Top stats ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {topCards.map((card) => (
          <Grid key={card.title} size={{ xs: 12, sm: 6, md: 3 }}>
            <TopCard {...card} loading={ovLoading} />
          </Grid>
        ))}
      </Grid>

      {/* ── Charts row ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Daily queries line chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader
              title="DNS Traffic — Last 30 Days"
              titleTypographyProps={{ fontWeight: 700, fontSize: 15 }}
            />
            <CardContent sx={{ pt: 0 }}>
              {dailyLoading ? (
                <ChartSkeleton height={260} />
              ) : daily.length === 0 ? (
                <Box sx={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary" variant="body2">No data available</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="queries" name="Total Queries"
                      stroke="#1565C0" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="blocked" name="Blocked"
                      stroke="#E53935" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top blocked categories bar chart */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Top Blocked Categories"
              titleTypographyProps={{ fontWeight: 700, fontSize: 15 }}
            />
            <CardContent sx={{ pt: 0 }}>
              {catLoading ? (
                <ChartSkeleton height={260} />
              ) : categories.length === 0 ? (
                <Box sx={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary" variant="body2">No data available</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={categories} layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} tickFormatter={fmt} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} tickLine={false} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="blocks" name="Blocked" fill="#E53935" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Tenants table + Recent alerts ── */}
      <Grid container spacing={2}>
        {/* Active tenants */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardHeader
              title="Active Tenants"
              titleTypographyProps={{ fontWeight: 700, fontSize: 15 }}
            />
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Tenant</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Plan</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }} align="right">Customers</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tenantLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 4 }).map((__, j) => (
                            <TableCell key={j}><Skeleton /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : tenants.length === 0
                    ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
                              No tenants found
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )
                    : tenants.map((t: any) => (
                        <TableRow key={t.id} hover>
                          <TableCell>
                            <Typography fontWeight={600} fontSize={13}>{t.name ?? t.companyName ?? '—'}</Typography>
                            <Typography variant="caption" color="text.secondary">{t.domain ?? t.email ?? ''}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={t.plan ?? t.planName ?? 'Basic'} size="small" variant="outlined"
                              sx={{ fontSize: 11 }} />
                          </TableCell>
                          <TableCell align="right">
                            <Typography fontSize={13}>{t.customerCount ?? t.maxCustomers ?? '—'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={t.active !== false ? 'Active' : 'Inactive'}
                              size="small"
                              color={t.active !== false ? 'success' : 'default'}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        {/* Recent alerts */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Recent Alerts"
              titleTypographyProps={{ fontWeight: 700, fontSize: 15 }}
              subheader="Last 20 SOS / geofence / AI anomaly alerts"
              subheaderTypographyProps={{ fontSize: 12 }}
            />
            <CardContent sx={{ pt: 0, maxHeight: 400, overflowY: 'auto' }}>
              {alertLoading ? (
                <Stack spacing={1}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
                  ))}
                </Stack>
              ) : alerts.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <WarningAmberIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary" variant="body2">No recent alerts</Typography>
                </Box>
              ) : (
                <Stack spacing={1}>
                  {alerts.map((a: any, idx: number) => (
                    <Box key={a.id ?? idx} sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1.5,
                      p: 1.25, borderRadius: 1,
                      bgcolor: 'action.hover',
                    }}>
                      <Box sx={{ flexShrink: 0, mt: 0.25 }}>
                        <AlertChip type={a.type ?? a.alertType ?? ''} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontSize={12} fontWeight={600} noWrap>
                          {a.profileName ?? a.childName ?? a.message ?? 'Alert'}
                        </Typography>
                        <Typography fontSize={11} color="text.secondary" noWrap>
                          {a.description ?? a.address ?? a.location ?? ''}
                        </Typography>
                      </Box>
                      <Typography fontSize={11} color="text.secondary" sx={{ flexShrink: 0 }}>
                        {timeAgo(a.createdAt ?? a.timestamp ?? '')}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </AnimatedPage>
  );
}
