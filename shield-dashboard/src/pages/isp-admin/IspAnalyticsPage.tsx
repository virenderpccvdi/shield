import { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, CircularProgress, Button,
  Tabs, Tab, Stack, Chip, LinearProgress, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, Paper,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import DownloadIcon from '@mui/icons-material/Download';
import DnsIcon from '@mui/icons-material/Dns';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BlockIcon from '@mui/icons-material/Block';
import PeopleIcon from '@mui/icons-material/People';
import CategoryIcon from '@mui/icons-material/Category';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import { gradients } from '../../theme/theme';
import { useAuthStore } from '../../store/auth.store';
import LoadingPage from '../../components/LoadingPage';

interface DayQueries { day: string; queries: number; blocks: number; }
interface CategoryStat { name: string; value: number; percent: number; }
interface TopDomain { domain: string; category: string | null; count: number; percent: number; }
interface HourlyPoint { hour: number; count: number; }

const PIE_COLORS = [
  '#00897B', '#1565C0', '#E53935', '#FB8C00', '#9C27B0',
  '#43A047', '#00ACC1', '#F57F17', '#AD1457', '#546E7A',
];

function formatK(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function exportIspCSV(data: DayQueries[], totalQueries: number, avgQueries: number, categories: CategoryStat[]) {
  const lines = [
    '# ISP Analytics Export',
    `"Generated","${new Date().toISOString()}"`,
    `"Total Queries This Week","${totalQueries}"`,
    `"Daily Average","${avgQueries}"`,
    '',
    '"Day","Queries","Blocked"',
    ...data.map(d => `"${d.day}","${d.queries}","${d.blocks}"`),
    '',
    '"Category","Queries","Percent"',
    ...categories.map(c => `"${c.name}","${c.value}","${c.percent}%"`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `isp-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function IspAnalyticsPage() {
  const [tab, setTab] = useState(0);
  const [daily, setDaily] = useState<DayQueries[]>([]);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [overview, setOverview] = useState({ totalQueries: 0, totalBlocked: 0, blockRate: 0, activeProfiles: 0 });
  const [topDomains, setTopDomains] = useState<TopDomain[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyPoint[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hourlyLoading, setHourlyLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const tenantId = useAuthStore(s => s.user?.tenantId);

  useEffect(() => {
    const dailyEndpoint = tenantId
      ? `/analytics/tenant/${tenantId}/daily?days=7`
      : '/analytics/platform/daily?days=7';
    const catEndpoint = tenantId
      ? `/analytics/tenant/${tenantId}/categories?period=week`
      : '/analytics/platform/categories?period=week';
    const overviewEndpoint = tenantId
      ? `/analytics/tenant/${tenantId}/overview?period=week`
      : '/analytics/platform/overview?period=week';
    const topDomainsEndpoint = tenantId
      ? `/analytics/tenant/${tenantId}/top-domains?period=week&limit=10`
      : null;

    const requests: Promise<any>[] = [
      api.get(dailyEndpoint).catch(() => ({ data: [] })),
      api.get(catEndpoint).catch(() => ({ data: [] })),
      api.get(overviewEndpoint).catch(() => ({ data: {} })),
    ];
    if (topDomainsEndpoint) {
      requests.push(api.get(topDomainsEndpoint).catch(() => ({ data: [] })));
    }

    Promise.all(requests).then(([dailyRes, catRes, overviewRes, domainsRes]) => {
      // Daily
      const dailyRaw = Array.isArray(dailyRes.data) ? dailyRes.data : (dailyRes.data?.data || []);
      if (dailyRaw.length) {
        setDaily(dailyRaw.map((p: any) => ({
          day: new Date(p.date).toLocaleDateString('en', { weekday: 'short' }),
          queries: p.totalQueries || 0,
          blocks: p.blockedQueries || 0,
        })));
      }
      // Categories
      const catRaw = Array.isArray(catRes.data) ? catRes.data : (catRes.data?.data || []);
      if (catRaw.length) {
        const total = catRaw.reduce((s: number, c: any) => s + (c.count || 0), 0);
        setCategories(
          catRaw
            .sort((a: any, b: any) => b.count - a.count)
            .slice(0, 8)
            .map((c: any) => ({
              name: c.category || 'Unknown',
              value: c.count || 0,
              percent: total > 0 ? Math.round(c.count / total * 100) : 0,
            }))
        );
      }
      // Overview
      const ov = overviewRes.data?.data || overviewRes.data || {};
      setOverview({
        totalQueries: ov.totalQueries || dailyRaw.reduce((s: number, d: any) => s + (d.totalQueries || 0), 0),
        totalBlocked: ov.totalBlocked || dailyRaw.reduce((s: number, d: any) => s + (d.blockedQueries || 0), 0),
        blockRate: ov.blockRate || 0,
        activeProfiles: ov.activeProfiles || 0,
      });
      // Top Domains
      if (domainsRes) {
        const domsRaw = Array.isArray(domainsRes.data) ? domainsRes.data : (domainsRes.data?.data || []);
        if (domsRaw.length) {
          const total = domsRaw.reduce((s: number, d: any) => s + (d.count || 0), 0);
          setTopDomains(domsRaw.map((d: any) => ({
            domain: d.domain || '',
            category: d.category || null,
            count: d.count || 0,
            percent: total > 0 ? Math.round(d.count / total * 1000) / 10 : 0,
          })));
        }
      }
    }).finally(() => setLoading(false));
  }, [tenantId]);

  const loadHourlyData = async (date: string) => {
    if (!tenantId) return;
    setHourlyLoading(true);
    try {
      const res = await api.get(`/analytics/tenant/${tenantId}/hourly?date=${date}`);
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setHourlyData(raw.map((p: any) => ({ hour: p.hour, count: p.count || 0 })));
    } catch {
      setHourlyData([]);
    } finally {
      setHourlyLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 3 && tenantId) {
      loadHourlyData(selectedDate);
    }
  }, [tab, tenantId]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    if (tenantId) loadHourlyData(newDate);
  };

  const totalQueries = overview.totalQueries || daily.reduce((s, d) => s + d.queries, 0);
  const totalBlocked = overview.totalBlocked || daily.reduce((s, d) => s + d.blocks, 0);
  const peakDay = daily.length > 0 ? daily.reduce((a, b) => a.queries > b.queries ? a : b) : null;
  const avgQueries = daily.length > 0 ? Math.round(totalQueries / daily.length) : 0;

  // Format hour label
  const formatHour = (h: number) => {
    if (h === 0) return '12am';
    if (h < 12) return `${h}am`;
    if (h === 12) return '12pm';
    return `${h - 12}pm`;
  };

  const hourlyChartData = hourlyData.map(p => ({
    hour: formatHour(p.hour),
    queries: p.count,
  }));

  return (
    <AnimatedPage>
      <PageHeader
        icon={<BarChartIcon />}
        title="ISP Analytics"
        subtitle="DNS query volume and content insights for your customers"
        iconColor="#00897B"
        action={
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => exportIspCSV(daily, totalQueries, avgQueries, categories)}
            disabled={daily.length === 0}
            sx={{ borderRadius: 2 }}
          >
            Export CSV
          </Button>
        }
      />

      {/* Stats Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard title="Queries This Week" value={formatK(totalQueries)} icon={<DnsIcon />} gradient={gradients.teal} delay={0.05} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard title="Total Blocked" value={formatK(totalBlocked)} icon={<BlockIcon />} gradient={gradients.red} delay={0.1} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard title="Daily Average" value={formatK(avgQueries)} icon={<TrendingUpIcon />} gradient={gradients.blue} delay={0.15} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard title="Peak Day" value={peakDay ? peakDay.day : '--'} unit={peakDay ? formatK(peakDay.queries) : ''} icon={<PeopleIcon />} gradient={gradients.purple} delay={0.2} />
        </Grid>
      </Grid>

      {/* Chart Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
        }}
      >
        <Tab label="DNS Traffic" />
        <Tab label="Category Breakdown" />
        <Tab label="Top Blocked Domains" />
        <Tab label="Hourly Activity" />
      </Tabs>

      {loading && <LoadingPage />}

      {/* Tab 0: DNS Traffic */}
      {!loading && tab === 0 && (
        <AnimatedPage delay={0.1}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                Daily DNS Queries & Blocks
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Query volume over the past 7 days
              </Typography>
              {daily.length === 0 ? (
                <EmptyState
                  icon={<DnsIcon sx={{ fontSize: 36, color: '#00897B' }} />}
                  title="No DNS query data yet"
                  description="Data will appear once your customers start making DNS queries"
                />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="ispGradQ" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00897B" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00897B" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="ispGradB" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E53935" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#E53935" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={formatK} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: number, name: string) => [formatK(v), name]}
                      contentStyle={{ borderRadius: 8, border: '1px solid #E8EDF2' }}
                    />
                    <Legend />
                    <Area
                      type="monotone" dataKey="queries" name="Total Queries"
                      stroke="#00897B" strokeWidth={2.5} fill="url(#ispGradQ)"
                      dot={{ r: 4, fill: '#00897B', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6 }}
                    />
                    <Area
                      type="monotone" dataKey="blocks" name="Blocked"
                      stroke="#E53935" strokeWidth={2} fill="url(#ispGradB)"
                      dot={{ r: 3, fill: '#E53935', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* Tab 1: Category Breakdown */}
      {!loading && tab === 1 && (
        <AnimatedPage delay={0.1}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                    Queries by Category
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Share of DNS queries per content type
                  </Typography>
                  {categories.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CategoryIcon sx={{ fontSize: 40, color: '#ccc', mb: 1, display: 'block', mx: 'auto' }} />
                      <Typography color="text.secondary">No category data available</Typography>
                    </Box>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={categories}
                          cx="50%"
                          cy="50%"
                          outerRadius={110}
                          innerRadius={60}
                          dataKey="value"
                          paddingAngle={2}
                          label={({ name, percent }: any) =>
                            percent > 0.08 ? `${name.slice(0, 8)} ${(percent * 100).toFixed(0)}%` : ''
                          }
                          labelLine={false}
                        >
                          {categories.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [formatK(v), 'Queries']} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 7 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2.5 }}>
                    Category Details
                  </Typography>
                  {categories.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      No data available
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
                              {formatK(cat.value)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, textAlign: 'right' }}>
                              {cat.percent}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={cat.percent}
                            sx={{
                              height: 5, borderRadius: 2, ml: 2.5,
                              bgcolor: '#F0F0F0',
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
        </AnimatedPage>
      )}

      {/* Tab 2: Top Blocked Domains */}
      {!loading && tab === 2 && (
        <AnimatedPage delay={0.1}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                Top Blocked Domains
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Most frequently blocked domains across your customers this week
              </Typography>
              {topDomains.length === 0 ? (
                <EmptyState
                  icon={<BlockIcon sx={{ fontSize: 36, color: 'error.main' }} />}
                  title="No blocked domain data"
                  description="Data will appear once customers start filtering content"
                />
              ) : (
                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 700, width: 40 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Domain</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                        <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Count</TableCell>
                        <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>% of Blocked</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topDomains.map((d, i) => (
                        <TableRow key={d.domain} hover>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" fontWeight={600}>{i + 1}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                              {d.domain}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {d.category ? (
                              <Chip
                                label={d.category}
                                size="small"
                                sx={{ fontSize: 11, height: 20, bgcolor: '#E53935' + '15', color: '#E53935', fontWeight: 600 }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.disabled">—</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" fontWeight={700}>{formatK(d.count)}</Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" color="text.secondary">{d.percent}%</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* Tab 3: Hourly Activity */}
      {!loading && tab === 3 && (
        <AnimatedPage delay={0.1}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Hourly Query Activity
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    DNS queries by hour of day for all customers
                  </Typography>
                </Box>
                <TextField
                  type="date"
                  size="small"
                  value={selectedDate}
                  onChange={e => handleDateChange(e.target.value)}
                  inputProps={{ max: new Date().toISOString().slice(0, 10) }}
                  sx={{ width: 160 }}
                  label="Date"
                  InputLabelProps={{ shrink: true }}
                />
              </Box>

              <Box sx={{ mt: 3 }}>
                {!tenantId ? (
                  <EmptyState
                    icon={<AccessTimeIcon sx={{ fontSize: 36, color: '#00897B' }} />}
                    title="No tenant selected"
                    description="Hourly activity is available for ISP tenants"
                  />
                ) : hourlyLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress sx={{ color: '#00897B' }} />
                  </Box>
                ) : hourlyChartData.every(p => p.queries === 0) ? (
                  <EmptyState
                    icon={<AccessTimeIcon sx={{ fontSize: 36, color: '#00897B' }} />}
                    title="No data for this date"
                    description="Select a date with DNS query activity to see the hourly breakdown"
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={hourlyChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00897B" stopOpacity={1} />
                          <stop offset="100%" stopColor="#00695C" stopOpacity={0.85} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                      <YAxis tickFormatter={formatK} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(v: number) => [formatK(v), 'Queries']}
                        contentStyle={{ borderRadius: 8, border: '1px solid #E8EDF2' }}
                      />
                      <Bar dataKey="queries" name="Queries" fill="url(#hourlyGrad)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Box>

              {/* Peak hours summary */}
              {!hourlyLoading && hourlyChartData.some(p => p.queries > 0) && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Peak Hours:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                    {[...hourlyChartData]
                      .sort((a, b) => b.queries - a.queries)
                      .slice(0, 5)
                      .filter(p => p.queries > 0)
                      .map(p => (
                        <Chip
                          key={p.hour}
                          label={`${p.hour}: ${formatK(p.queries)}`}
                          size="small"
                          sx={{ fontSize: 11, bgcolor: '#00897B15', color: '#00897B', fontWeight: 600 }}
                        />
                      ))}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        </AnimatedPage>
      )}
    </AnimatedPage>
  );
}
