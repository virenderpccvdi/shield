import { useState, useEffect, useRef } from 'react';
import { Box, Grid, Card, CardContent, Typography, Avatar, Chip, Stack, CircularProgress, Alert } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import ShieldIcon from '@mui/icons-material/Shield';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { gradients } from '../../theme/theme';
import { useAuthStore } from '../../store/auth.store';

const PIE_COLORS = ['#E53935', '#7B1FA2', '#FB8C00', '#1565C0', '#78909C', '#00897B'];

function PlatformSosBanner() {
  const [sosCount, setSosCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSos = () => {
    api.get('/location/sos/platform')
      .then(r => {
        const list = r.data?.data ?? [];
        setSosCount(Array.isArray(list) ? list.length : 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchSos();
    timerRef.current = setInterval(fetchSos, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

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
          component="a"
          href="/app/alerts"
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

export default function IspDashboardPage() {
  const tenantId = useAuthStore(s => s.user?.tenantId);
  const [loading, setLoading] = useState(true);
  const [customerCount, setCustomerCount] = useState(0);
  const [profileCount, setProfileCount] = useState(0);
  const [trend, setTrend] = useState<{ day: string; queries: number }[]>([]);
  const [blockRate, setBlockRate] = useState(0);
  const [recentSignups, setRecentSignups] = useState<RecentCustomer[]>([]);
  const [categories, setCategories] = useState<{ name: string; value: number; color: string }[]>([]);
  const [growth, setGrowth] = useState<{ month: string; customers: number }[]>([]);

  useEffect(() => {
    const tId = tenantId || '';
    Promise.all([
      // Customers list
      api.get('/profiles/customers').then(r => {
        const d = r.data?.data;
        const list = (d?.content ?? d) as RecentCustomer[];
        if (Array.isArray(list)) {
          setCustomerCount(d?.totalElements ?? list.length);
          setProfileCount(list.reduce((s, c) => s + (c.profileCount || c.profiles || 0), 0));
          setRecentSignups(list.slice(0, 5));
        }
      }).catch(() => {}),

      // Daily trend (tenant-scoped if tenantId exists)
      (tId
        ? api.get(`/analytics/tenant/${tId}/daily?days=7`)
        : api.get('/analytics/platform/daily?days=7')
      ).then(r => {
        const d = Array.isArray(r.data) ? r.data : r.data?.data || [];
        if (d.length) {
          setTrend(d.map((p: any) => ({
            day: new Date(p.date).toLocaleDateString('en', { weekday: 'short' }),
            queries: p.totalQueries || 0,
          })));
        }
      }).catch(() => {}),

      // Overview for block rate
      (tId
        ? api.get(`/analytics/tenant/${tId}/overview?period=today`)
        : api.get('/analytics/platform/overview?period=today')
      ).then(r => {
        const d = r.data;
        if (d?.blockRate) setBlockRate(d.blockRate);
      }).catch(() => {}),

      // Blocked categories
      (tId
        ? api.get(`/analytics/tenant/${tId}/categories?period=week`)
        : api.get('/analytics/platform/categories?period=week')
      ).then(r => {
        const d = Array.isArray(r.data) ? r.data : [];
        if (d.length) {
          const total = d.reduce((s: number, c: any) => s + c.count, 0);
          setCategories(d.slice(0, 5).map((c: any, i: number) => ({
            name: c.category || 'Unknown',
            value: total > 0 ? Math.round(c.count / total * 100) : 0,
            color: PIE_COLORS[i % PIE_COLORS.length],
          })));
        }
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [tenantId]);

  const totalQueries = trend.reduce((s, d) => s + d.queries, 0);

  if (loading) {
    return (
      <AnimatedPage>
        <PageHeader icon={<BusinessIcon />} title="ISP Dashboard" subtitle="Monitor your customers and DNS infrastructure" iconColor="#00897B" />
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
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
      />

      <PlatformSosBanner />

      {/* Stat Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Total Customers" value={customerCount} icon={<PeopleIcon />} gradient={gradients.teal} delay={0.1} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Active Profiles" value={profileCount} icon={<ShieldIcon />} gradient={gradients.blue} delay={0.2} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="DNS Queries (7d)" value={formatK(totalQueries)} icon={<DnsIcon />} gradient={gradients.purple} delay={0.3} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Block Rate" value={`${blockRate}%`} icon={<BlockIcon />} gradient={gradients.orange} delay={0.4} />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* DNS Query Trend Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <AnimatedPage delay={0.3}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                  7-Day DNS Query Trend
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
                        transition: 'all 0.2s ease', '&:hover': { bgcolor: '#F5F9FF', transform: 'translateX(4px)' },
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
                          sx={{ height: 22, fontSize: 11, bgcolor: '#E0F2F1', color: '#00695C' }} />
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
