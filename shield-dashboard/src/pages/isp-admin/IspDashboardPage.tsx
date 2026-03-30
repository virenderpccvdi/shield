import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Grid, Card, CardContent, Typography, Avatar, Chip, Stack, Skeleton, Alert, Button, ToggleButton, ToggleButtonGroup } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import ShieldIcon from '@mui/icons-material/Shield';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import RouterIcon from '@mui/icons-material/Router';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { gradients } from '../../theme/theme';
import { useAuthStore } from '../../store/auth.store';

const PIE_COLORS = ['#E53935', '#7B1FA2', '#FB8C00', '#1565C0', '#78909C', '#00897B'];

function PlatformSosBanner() {
  const navigate = useNavigate();
  const { data: sosList = [] } = useQuery<unknown[]>({
    queryKey: ['isp-sos-platform'],
    queryFn: () =>
      api.get('/location/sos/platform')
        .then(r => {
          const list = r.data?.data ?? [];
          return Array.isArray(list) ? list : [];
        })
        .catch(() => []),
    refetchInterval: 30000,
  });

  const sosCount = sosList.length;
  if (sosCount === 0) return null;

  return (
    <Alert
      severity="error"
      icon={<WarningAmberIcon sx={{ animation: 'pulse 1.5s infinite' }} />}
      sx={{
        mb: 3,
        borderRadius: 2,
        fontWeight: 600,
        '@keyframes pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.4 },
        },
      }}
      action={
        <Typography
          component="span"
          onClick={() => navigate('/isp/alerts')}
          variant="body2"
          sx={{ fontWeight: 700, color: 'error.dark', textDecoration: 'underline', cursor: 'pointer', alignSelf: 'center' }}
        >
          View Details
        </Typography>
      }
    >
      {sosCount} active SOS alert{sosCount !== 1 ? 's' : ''} — immediate attention required
    </Alert>
  );
}

function formatK(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const INITIAL_COLORS = ['#00897B', '#1565C0', '#7B1FA2', '#FB8C00', '#E53935'];

interface RecentCustomer {
  id: string;
  name?: string;
  email?: string;
  userId?: string;
  joinedAt?: string;
  createdAt?: string;
  profiles?: number;
  profileCount?: number;
}

interface DailyPoint { day: string; queries: number; }
interface CategoryEntry { name: string; value: number; color: string; }

interface DashboardData {
  customerCount: number;
  profileCount: number;
  recentSignups: RecentCustomer[];
  trend: DailyPoint[];
  blockRate: number;
  categories: CategoryEntry[];
}

function exportDashboardCSV(
  trend: DailyPoint[],
  customerCount: number,
  profileCount: number,
  blockRate: number,
  days: number,
) {
  const lines: string[] = [];
  lines.push('Shield ISP Dashboard Export');
  lines.push(`Generated,${new Date().toLocaleString()}`);
  lines.push(`Period,Last ${days} days`);
  lines.push('');
  lines.push('Summary');
  lines.push(`Total Customers,${customerCount}`);
  lines.push(`Active Profiles,${profileCount}`);
  lines.push(`Block Rate,${Number(blockRate).toFixed(1)}%`);
  lines.push('');
  lines.push('DNS Query Trend');
  lines.push('Day,Queries');
  trend.forEach(p => lines.push(`${p.day},${p.queries}`));
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `isp-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function IspDashboardPage() {
  const tenantId = useAuthStore(s => s.user?.tenantId);
  const tId = tenantId || '';
  const [days, setDays] = useState<7 | 14 | 30>(7);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['isp-dashboard', tId, days],
    queryFn: async () => {
      const [customersRes, dailyRes, overviewRes, catRes] = await Promise.allSettled([
        api.get('/profiles/customers', { params: tId ? { tenantId: tId } : undefined }),
        tId
          ? api.get(`/analytics/tenant/${tId}/daily?days=${days}`)
          : api.get(`/analytics/platform/daily?days=${days}`),
        tId
          ? api.get(`/analytics/tenant/${tId}/overview?period=today`)
          : api.get('/analytics/platform/overview?period=today'),
        tId
          ? api.get(`/analytics/tenant/${tId}/categories?period=week`)
          : api.get('/analytics/platform/categories?period=week'),
      ]);

      let customerCount = 0;
      let profileCount = 0;
      let recentSignups: RecentCustomer[] = [];
      if (customersRes.status === 'fulfilled') {
        const d = customersRes.value.data?.data;
        const list = (d?.content ?? d) as RecentCustomer[];
        if (Array.isArray(list)) {
          customerCount = d?.totalElements ?? list.length;
          profileCount = list.reduce((s, c) => s + (c.profileCount || c.profiles || 0), 0);
          recentSignups = list.slice(0, 5);
        }
      }

      let trend: DailyPoint[] = [];
      if (dailyRes.status === 'fulfilled') {
        const d = Array.isArray(dailyRes.value.data) ? dailyRes.value.data : dailyRes.value.data?.data || [];
        if (d.length) {
          trend = d.map((p: { date: string; totalQueries?: number }) => ({
            day: new Date(p.date).toLocaleDateString('en', { weekday: 'short' }),
            queries: p.totalQueries || 0,
          }));
        }
      }

      let blockRate = 0;
      if (overviewRes.status === 'fulfilled') {
        const d = overviewRes.value.data?.data ?? overviewRes.value.data;
        blockRate = d?.blockRate ?? 0;
      }

      let categories: CategoryEntry[] = [];
      if (catRes.status === 'fulfilled') {
        const raw = catRes.value.data?.data ?? catRes.value.data;
        const d = Array.isArray(raw) ? raw : [];
        if (d.length) {
          const total = d.reduce((s: number, c: { count: number }) => s + c.count, 0);
          categories = d.slice(0, 5).map((c: { category?: string; count: number }, i: number) => ({
            name: c.category || 'Unknown',
            value: total > 0 ? Math.round(c.count / total * 100) : 0,
            color: PIE_COLORS[i % PIE_COLORS.length],
          }));
        }
      }

      return { customerCount, profileCount, recentSignups, trend, blockRate, categories };
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const customerCount = data?.customerCount ?? 0;
  const profileCount = data?.profileCount ?? 0;
  const recentSignups = data?.recentSignups ?? [];
  const trend = data?.trend ?? [];
  const blockRate = data?.blockRate ?? 0;
  const categories = data?.categories ?? [];
  const totalQueries = trend.reduce((s, d) => s + d.queries, 0);

  if (isLoading) {
    return (
      <AnimatedPage>
        <PageHeader icon={<BusinessIcon />} title="ISP Dashboard" subtitle="Monitor your customers and DNS infrastructure" iconColor="#00897B" />
        <Box sx={{ p: 0 }}>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {[1, 2, 3, 4].map(i => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                <Skeleton variant="rounded" height={120} />
              </Grid>
            ))}
          </Grid>
          <Skeleton variant="rounded" height={300} sx={{ mb: 3 }} />
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Skeleton variant="rounded" height={300} />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Skeleton variant="rounded" height={300} />
            </Grid>
          </Grid>
        </Box>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<BusinessIcon />}
        title="ISP Dashboard"
        subtitle="Monitor your customers and DNS infrastructure"
        iconColor="#00897B"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <ToggleButtonGroup
              value={days}
              exclusive
              size="small"
              onChange={(_, v) => { if (v) setDays(v); }}
              sx={{ bgcolor: 'background.paper' }}
            >
              {([7, 14, 30] as const).map(d => (
                <ToggleButton key={d} value={d} sx={{ px: 1.5, fontSize: 12, fontWeight: 600 }}>
                  {d}D
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadIcon />}
              onClick={() => exportDashboardCSV(trend, customerCount, profileCount, blockRate, days)}
              sx={{ borderColor: '#00897B', color: '#00897B', '&:hover': { bgcolor: '#E0F2F1' }, fontSize: 12 }}
            >
              Export CSV
            </Button>
          </Stack>
        }
      />

      <PlatformSosBanner />

      {/* Getting Started card — shown when no customers yet */}
      {customerCount === 0 && (
        <AnimatedPage delay={0.1}>
          <Card sx={{ mb: 4, border: '1px dashed', borderColor: '#00897B60', bgcolor: '#00897B05' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <RocketLaunchIcon sx={{ color: '#00897B', fontSize: 28 }} />
                <Box>
                  <Typography variant="h6" fontWeight={700}>Welcome to Shield ISP Dashboard</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Get started by following these steps to onboard your first customers
                  </Typography>
                </Box>
              </Box>
              <Grid container spacing={2}>
                {[
                  { icon: <CheckCircleIcon sx={{ color: '#43A047' }} />, step: '1', title: 'Account Ready', desc: 'Your ISP account is configured and active', done: true },
                  { icon: <GroupAddIcon sx={{ color: '#1565C0' }} />, step: '2', title: 'Add Customers', desc: 'Invite customers via the Customers page or bulk import CSV', done: false },
                  { icon: <RouterIcon sx={{ color: '#FB8C00' }} />, step: '3', title: 'Configure DNS', desc: 'Customers configure their router to use your DNS endpoint', done: false },
                  { icon: <DnsIcon sx={{ color: '#00897B' }} />, step: '4', title: 'See Live Data', desc: 'DNS queries and analytics appear here automatically', done: false },
                ].map(item => (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.step}>
                    <Box sx={{
                      p: 2, borderRadius: 2, border: '1px solid', height: '100%',
                      borderColor: item.done ? '#43A04730' : 'divider',
                      bgcolor: item.done ? '#43A04708' : 'background.paper',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {item.icon}
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                          STEP {item.step}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>{item.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <a href="/app/isp/customers" style={{ textDecoration: 'none' }}>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ color: '#00897B', textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    Go to Customers →
                  </Typography>
                </a>
              </Box>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* Stat Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Total Customers" value={customerCount} icon={<PeopleIcon />} gradient={gradients.teal} delay={0.1} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Active Profiles" value={profileCount} icon={<ShieldIcon />} gradient={gradients.blue} delay={0.2} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title={`DNS Queries (${days}d)`} value={formatK(totalQueries)} icon={<DnsIcon />} gradient={gradients.purple} delay={0.3} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Block Rate" value={`${Number(blockRate).toFixed(1)}%`} icon={<BlockIcon />} gradient={gradients.orange} delay={0.4} />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* DNS Query Trend Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <AnimatedPage delay={0.3}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                  {days}-Day DNS Query Trend
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Total queries processed across all customers
                </Typography>
                {trend.length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No DNS query data available yet.</Typography>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="ispDashGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00897B" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00897B" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={formatK} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => [formatK(v), 'Queries']} />
                      <Area type="monotone" dataKey="queries" stroke="#00897B" strokeWidth={2.5}
                        fill="url(#ispDashGrad)" dot={{ r: 4, fill: '#00897B', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, stroke: '#00897B', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Recent Signups */}
        <Grid size={{ xs: 12, md: 4 }}>
          <AnimatedPage delay={0.4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                  <PersonAddIcon sx={{ color: '#00897B', fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={600}>Recent Signups</Typography>
                </Box>
                {recentSignups.length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No customers yet.</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {recentSignups.map((signup, i) => (
                      <Box key={signup.id} sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2,
                        transition: 'all 0.2s ease', '&:hover': { bgcolor: 'action.hover', transform: 'translateX(4px)' },
                        '@keyframes fadeInRight': { from: { opacity: 0, transform: 'translateX(-10px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                        animation: `fadeInRight 0.4s ease ${0.5 + i * 0.1}s both`,
                      }}>
                        <Avatar sx={{ width: 36, height: 36, fontSize: 13, fontWeight: 700, bgcolor: INITIAL_COLORS[i % INITIAL_COLORS.length] }}>
                          {signup.name ? getInitials(signup.name) : (signup.userId?.slice(0, 2).toUpperCase() ?? 'C')}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{signup.name || `Customer ${i + 1}`}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(signup.createdAt || signup.joinedAt) ? new Date(signup.createdAt || signup.joinedAt || '').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (signup.email || '')}
                          </Typography>
                        </Box>
                        <Chip size="small"
                          label={`${signup.profileCount || signup.profiles || 0} profile${(signup.profileCount || signup.profiles || 0) !== 1 ? 's' : ''}`}
                          sx={{ height: 22, fontSize: 11, bgcolor: 'success.light', color: 'success.dark' }} />
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>
      </Grid>

      {/* Row 3: Pie chart + placeholder */}
      {categories.length > 0 && (
        <Grid container spacing={3} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <AnimatedPage delay={0.5}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Top Blocked Categories</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={categories} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                          paddingAngle={3} dataKey="value">
                          {categories.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${v}%`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" sx={{ mt: 1 }}>
                    {categories.map(c => (
                      <Chip key={c.name} size="small" label={`${c.name} ${c.value}%`}
                        sx={{ bgcolor: `${c.color}15`, color: c.color, fontWeight: 600, fontSize: 11 }} />
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <AnimatedPage delay={0.6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <TrendingUpIcon sx={{ color: '#00897B', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={600}>Customer Summary</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {customerCount} total customers with {profileCount} active profiles
                  </Typography>
                  {trend.length > 0 && (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={formatK} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => [formatK(v), 'Queries']} />
                        <Line type="monotone" dataKey="queries" stroke="#00897B" strokeWidth={2.5}
                          dot={{ r: 4, fill: '#00897B', strokeWidth: 2, stroke: '#fff' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>
        </Grid>
      )}
    </AnimatedPage>
  );
}
