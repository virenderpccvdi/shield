import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Tabs, Tab,
  Chip, Stack, Button, LinearProgress, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import DownloadIcon from '@mui/icons-material/Download';
import PeopleIcon from '@mui/icons-material/People';
import BlockIcon from '@mui/icons-material/Block';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FolderIcon from '@mui/icons-material/Folder';
import DnsIcon from '@mui/icons-material/Dns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { gradients } from '../../theme/theme';
import LoadingPage from '../../components/LoadingPage';

const COLORS = ['#1565C0', '#43A047', '#FB8C00', '#E53935', '#9C27B0', '#00ACC1'];

function exportAnalyticsCSV(overview: any, daily: any[], categories: any[]) {
  const lines = [
    '# Platform Analytics Export',
    `"Generated","${new Date().toISOString()}"`,
    '',
    '# Overview',
    '"Metric","Value"',
    `"Tenants","${overview.totalTenants}"`,
    `"Customers","${overview.totalCustomers}"`,
    `"Active Profiles","${overview.activeProfiles}"`,
    `"DNS Queries Today","${overview.dnsQueriesToday}"`,
    `"Block Rate","${overview.blockRate}%"`,
    '',
    '# Daily DNS Traffic (7 days)',
    '"Day","Queries","Blocks"',
    ...daily.map(d => `"${d.day}","${d.queries}","${d.blocks}"`),
    '',
    '# Category Breakdown',
    '"Category","Queries","Percent"',
    ...categories.map(c => `"${c.name}","${c.queries}","${c.percent}%"`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `platform-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}

function fmt(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return String(v);
}

type Period = 'today' | 'week' | 'month';

export default function PlatformAnalyticsPage() {
  const [tab, setTab] = useState(0);
  const [period, setPeriod] = useState<Period>('week');
  const [overview, setOverview] = useState({ totalTenants: 0, totalCustomers: 0, dnsQueriesToday: 0, blockRate: 0, activeProfiles: 0 });
  const [daily, setDaily] = useState<{ day: string; queries: number; blocks: number }[]>([]);
  const [categories, setCategories] = useState<{ name: string; queries: number; percent: number }[]>([]);
  const [blocked, setBlocked] = useState<{ name: string; blocks: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const days = period === 'today' ? 1 : period === 'week' ? 7 : 30;
    Promise.all([
      Promise.all([
        api.get('/admin/platform/stats').then(r => r.data.data || r.data).catch(() => ({})),
        api.get(`/analytics/platform/overview?period=${period}`).then(r => r.data).catch(() => ({})),
        api.get('/tenants?size=1').then(r => {
          const d = r.data?.data;
          return d?.totalElements ?? d?.content?.length ?? 0;
        }).catch(() => 0),
      ]).then(([stats, analytics, tenantCount]) => {
        setOverview({
          totalTenants: tenantCount || stats?.totalIspTenants || 0,
          totalCustomers: stats?.totalCustomers || 0,
          activeProfiles: stats?.activeProfiles || 0,
          dnsQueriesToday: analytics?.totalQueries || 0,
          blockRate: analytics?.blockRate || 0,
        });
      }),
      api.get(`/analytics/platform/daily?days=${days}`).then(r => {
        const d = r.data;
        if (Array.isArray(d) && d.length) {
          setDaily(d.map((p: any) => ({
            day: period === 'month'
              ? new Date(p.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })
              : new Date(p.date).toLocaleDateString('en', { weekday: 'short' }),
            queries: p.totalQueries,
            blocks: p.blockedQueries || 0,
          })));
        } else {
          setDaily([]);
        }
      }).catch(() => { setDaily([]); }),
      api.get(`/analytics/platform/categories?period=${period}`).then(r => {
        const d = r.data;
        if (Array.isArray(d) && d.length) {
          const total = d.reduce((s: number, c: any) => s + c.count, 0);
          const sorted = [...d].sort((a, b) => b.count - a.count).slice(0, 10);
          setCategories(sorted.map((c: any) => ({
            name: c.category || 'Unknown',
            queries: c.count,
            percent: total > 0 ? Math.round(c.count / total * 100) : 0,
          })));
          setBlocked(sorted.filter((c: any) => c.count > 0).map((c: any) => ({
            name: c.category || 'Unknown',
            blocks: c.count,
          })));
        } else {
          setCategories([]); setBlocked([]);
        }
      }).catch(() => { setCategories([]); setBlocked([]); }),
    ]).finally(() => setLoading(false));
  }, [period]);

  return (
    <AnimatedPage>
      <PageHeader
        icon={<BarChartIcon />}
        title="Platform Analytics"
        subtitle="Real-time DNS traffic and content insights across all tenants"
        iconColor="#7B1FA2"
        action={
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
            onClick={() => exportAnalyticsCSV(overview, daily, categories)}
            sx={{ borderRadius: 2 }}>
            Export CSV
          </Button>
        }
      />

      {/* Period Selector */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>Period:</Typography>
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(_, v) => v && setPeriod(v as Period)}
          size="small"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, px: 2 } }}
        >
          <ToggleButton value="today">Today</ToggleButton>
          <ToggleButton value="week">This Week</ToggleButton>
          <ToggleButton value="month">This Month</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard title="Tenants" value={overview.totalTenants} icon={<PeopleIcon />} gradient={gradients.blue} delay={0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard title="Customers" value={overview.totalCustomers} icon={<PeopleIcon />} gradient={gradients.green} delay={0.08} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard title="Profiles" value={overview.activeProfiles} icon={<FolderIcon />} gradient={gradients.orange} delay={0.16} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard
            title={period === 'today' ? 'Queries Today' : period === 'week' ? 'Queries This Week' : 'Queries This Month'}
            value={fmt(overview.dnsQueriesToday)}
            icon={<DnsIcon />}
            gradient={gradients.purple}
            delay={0.24}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard title="Block Rate" value={overview.blockRate} unit="%" icon={<BlockIcon />} gradient={gradients.red} delay={0.32} />
        </Grid>
      </Grid>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: '1px solid #E8EDF2', '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}
      >
        <Tab label="DNS Traffic" />
        <Tab label="Category Breakdown" />
        <Tab label="Blocked Content" />
      </Tabs>

      {loading && <LoadingPage />}

      <Box sx={{ '@keyframes tabFadeIn': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>
        {!loading && tab === 0 && (
          <Grid container spacing={3} sx={{ animation: 'tabFadeIn 0.4s ease both' }}>
            <Grid size={12}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Daily DNS Queries vs Blocks (7 days)</Typography>
                  {daily.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No DNS query data available yet. Data will appear once DNS queries are logged.</Typography>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <defs>
                          <linearGradient id="analyticsGradQ" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1565C0" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#1565C0" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="analyticsGradB" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#E53935" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#E53935" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, border: '1px solid #E8EDF2' }} />
                        <Legend />
                        <Area type="monotone" dataKey="queries" name="Total Queries" stroke="#1565C0" strokeWidth={2.5} fill="url(#analyticsGradQ)" dot={{ r: 4, fill: '#1565C0', strokeWidth: 2, stroke: '#fff' }} />
                        <Area type="monotone" dataKey="blocks" name="Blocked" stroke="#E53935" strokeWidth={2.5} fill="url(#analyticsGradB)" dot={{ r: 4, fill: '#E53935', strokeWidth: 2, stroke: '#fff' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {!loading && tab === 1 && (
          <Grid container spacing={3} sx={{ animation: 'tabFadeIn 0.4s ease both' }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Queries by Category</Typography>
                  {categories.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No category data available yet.</Typography>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={categories} layout="vertical" margin={{ left: 20, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                        <Tooltip formatter={(v: number) => [fmt(v), 'Queries']} />
                        <Bar dataKey="queries" radius={[0, 4, 4, 0]}>
                          {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Share by Category</Typography>
                  {categories.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No data</Typography>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={categories} cx="50%" cy="50%" outerRadius={90} dataKey="queries"
                            label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => [fmt(v), 'Queries']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                        {categories.map((c, i) => (
                          <Box key={c.name}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORS[i % COLORS.length], flexShrink: 0 }} />
                              <Typography variant="caption" sx={{ flex: 1 }}>{c.name}</Typography>
                              <Typography variant="caption" fontWeight={700}>{fmt(c.queries)}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 28, textAlign: 'right' }}>{c.percent}%</Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={c.percent}
                              sx={{
                                height: 4, borderRadius: 2, ml: 2.5,
                                bgcolor: '#F0F0F0',
                                '& .MuiLinearProgress-bar': { bgcolor: COLORS[i % COLORS.length], borderRadius: 2 },
                              }}
                            />
                          </Box>
                        ))}
                      </Stack>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {!loading && tab === 2 && (
          <Grid container spacing={3} sx={{ animation: 'tabFadeIn 0.4s ease both' }}>
            <Grid size={12}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Top Blocked Categories — {period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month'}</Typography>
                  {blocked.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No blocked content data available yet.</Typography>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={blocked} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <defs>
                          <linearGradient id="blockedBarGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#E53935" stopOpacity={1} />
                            <stop offset="100%" stopColor="#B71C1C" stopOpacity={0.8} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => [fmt(v), 'Blocked']} />
                        <Bar dataKey="blocks" name="Blocked Requests" fill="url(#blockedBarGrad)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
            {blocked.length > 0 && (
              <Grid size={12}>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  {blocked.map((b, i) => (
                    <Chip key={b.name} label={`${b.name}: ${fmt(b.blocks)}`}
                      sx={{ bgcolor: `${COLORS[i % COLORS.length]}18`, color: COLORS[i % COLORS.length], fontWeight: 600, mb: 1 }} />
                  ))}
                </Stack>
              </Grid>
            )}
          </Grid>
        )}
      </Box>
    </AnimatedPage>
  );
}
