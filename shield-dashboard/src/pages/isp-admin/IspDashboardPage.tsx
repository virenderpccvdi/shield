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
import { useAuthStore } from '../../store/auth.store';

const PIE_COLORS = ['#EF4444', '#7C3AED', '#F59E0B', '#4F46E5', '#64748B', '#06B6D4'];

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

const INITIAL_COLORS = ['#06B6D4', '#4F46E5', '#7C3AED', '#F59E0B', '#EF4444'];

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
  const navigate = useNavigate();
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
          ? api.get(`/analytics/tenant/${tId}/overview?period=week`)
          : api.get('/analytics/platform/overview?period=week'),
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
        iconColor="#4F46E5"
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ToggleButtonGroup
              value={days}
              exclusive
              size="small"
              onChange={(_, v) => { if (v) setDays(v); }}
              sx={{ bgcolor: 'background.paper', '& .MuiToggleButton-root': { borderRadius: '8px', fontWeight: 600, fontSize: 12 }, '& .Mui-selected': { bgcolor: 'rgba(79,70,229,0.1)', color: '#4F46E5', borderColor: 'rgba(79,70,229,0.2)' } }}
            >
              {([7, 14, 30] as const).map(d => (
                <ToggleButton key={d} value={d} sx={{ px: 1.5 }}>
                  {d}D
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadIcon />}
              onClick={() => exportDashboardCSV(trend, customerCount, profileCount, blockRate, days)}
              sx={{ borderColor: 'rgba(79,70,229,0.3)', color: '#4F46E5', borderRadius: '8px', fontSize: 12, textTransform: 'none', '&:hover': { bgcolor: 'rgba(79,70,229,0.04)', borderColor: '#4F46E5' } }}
            >
              Export CSV
            </Button>
          </Stack>
        }
      />

      <PlatformSosBanner />

      {/* ── Hero Stats Bar ────────────────────────────────────────────────── */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
        gap: 2,
        mb: 4,
        p: 2.5,
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #003D72 0%, #005DAC 60%, #1976D2 100%)',
        boxShadow: '0 8px 32px -4px rgba(0,61,114,0.28)',
        position: 'relative',
        overflow: 'hidden',
        '&::after': {
          content: '""',
          position: 'absolute', top: -60, right: -60,
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        },
      }}>
        {[
          { label: 'Total Customers', value: customerCount, suffix: '', color: '#E3F2FD' },
          { label: 'Active Profiles', value: profileCount, suffix: '', color: '#E1F5FE' },
          { label: `DNS Queries (${days}d)`, value: formatK(totalQueries), suffix: '', color: '#E8F5E9' },
          { label: 'Block Rate', value: `${Number(blockRate).toFixed(1)}%`, suffix: '', color: blockRate > 15 ? '#FFEBEE' : '#E8F5E9' },
        ].map((stat, i) => (
          <Box key={i} sx={{
            textAlign: 'center', py: 1,
            borderRight: { md: i < 3 ? '1px solid rgba(255,255,255,0.12)' : 'none' },
          }}>
            <Typography sx={{
              fontFamily: '"Manrope", sans-serif', fontWeight: 800, fontSize: '1.75rem',
              color: '#FFFFFF', letterSpacing: '-0.03em', lineHeight: 1.1,
            }}>
              {stat.value}
            </Typography>
            <Typography sx={{
              fontFamily: '"Inter", sans-serif', fontSize: 12, fontWeight: 500,
              color: 'rgba(255,255,255,0.72)', mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {stat.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Getting Started card — shown when no customers yet */}
      {customerCount === 0 && (
        <AnimatedPage delay={0.1}>
          <Card sx={{ mb: 4, bgcolor: '#F7FBF8', border: 'none', boxShadow: '0 8px 32px -4px rgba(15,31,61,0.04)', borderRadius: '12px' }}>
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
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {[
          {
            title: 'Total Customers', value: customerCount, color: '#0277BD',
            iconBg: '#E1F5FE',
            icon: <PeopleIcon sx={{ fontSize: 20 }} />, subtitle: 'registered accounts',
            trend: customerCount > 0 ? 'active' : 'none',
          },
          {
            title: 'Active Profiles', value: profileCount, color: '#005DAC',
            iconBg: '#E3F2FD',
            icon: <ShieldIcon sx={{ fontSize: 20 }} />, subtitle: 'child profiles protected',
            trend: profileCount > 0 ? 'active' : 'none',
          },
          {
            title: `DNS Queries (${days}d)`, value: formatK(totalQueries), color: '#005DAC',
            iconBg: '#E3F2FD',
            icon: <DnsIcon sx={{ fontSize: 20 }} />, subtitle: 'queries processed',
            trend: totalQueries > 1000 ? 'high' : 'normal',
          },
          {
            title: 'Block Rate', value: `${Number(blockRate).toFixed(1)}%`,
            color: blockRate > 15 ? '#C62828' : '#2E7D32',
            iconBg: blockRate > 15 ? '#FFEBEE' : '#E8F5E9',
            icon: <BlockIcon sx={{ fontSize: 20 }} />, subtitle: blockRate > 15 ? 'elevated — review rules' : 'healthy range',
            trend: blockRate > 15 ? 'high' : 'low',
          },
        ].map((card, i) => (
          <Grid key={card.title} size={{ xs: 12, sm: 6, md: 3 }}>
            <AnimatedPage delay={0.1 + i * 0.08}>
              <Card sx={{
                height: '100%', overflow: 'hidden', position: 'relative',
                bgcolor: '#FFFFFF', border: 'none',
                boxShadow: '0 8px 32px -4px rgba(15,31,61,0.06)',
                borderRadius: '12px',
                transition: 'transform 0.22s ease, box-shadow 0.22s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 32px -4px rgba(15,31,61,0.10)' },
                '&::before': {
                  content: '""', position: 'absolute',
                  top: 0, left: 0, bottom: 0, width: 3,
                  background: card.color, borderRadius: '12px 0 0 12px',
                },
              }}>
                <Box sx={{ px: 2.5, py: 2.25 }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1.25 }}>
                    <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 500, fontSize: 12, color: '#4A6481', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      {card.title}
                    </Typography>
                    <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, flexShrink: 0 }}>
                      {card.icon}
                    </Box>
                  </Stack>
                  <Typography sx={{ fontFamily: '"Manrope", sans-serif', fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', color: '#005DAC', mb: 0.4 }}>
                    {card.value}
                  </Typography>
                  <Typography sx={{ fontFamily: '"Inter", sans-serif', fontSize: 11.5, color: '#4A6481', mt: 0.3 }}>{card.subtitle}</Typography>
                  <Box sx={{ mt: 0.75 }}>
                    <Chip
                      size="small"
                      label={card.trend === 'high' ? 'High' : card.trend === 'active' ? 'Active' : card.trend === 'low' ? 'Low' : 'Normal'}
                      sx={{
                        height: 20, fontSize: 10, fontWeight: 700, border: 'none',
                        bgcolor: card.trend === 'high' ? '#FFEBEE' : card.trend === 'active' ? '#E8F5E9' : '#F0F4F8',
                        color: card.trend === 'high' ? '#C62828' : card.trend === 'active' ? '#2E7D32' : '#4A6481',
                      }}
                    />
                  </Box>
                </Box>
              </Card>
            </AnimatedPage>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions Row */}
      <AnimatedPage delay={0.25}>
        <Card sx={{ mb: 3, bgcolor: '#FFFFFF', border: 'none', boxShadow: '0 8px 32px -4px rgba(15,31,61,0.06)', borderRadius: '12px' }}>
          <CardContent sx={{ py: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
              <Typography fontWeight={700} fontSize={13} letterSpacing="-0.2px" sx={{ mr: 1 }}>Quick Actions</Typography>
              {[
                { label: 'Add Customer', icon: <PersonAddIcon sx={{ fontSize: 16 }} />, color: '#4F46E5', bg: 'rgba(79,70,229,0.08)', path: '/isp/customers' },
                { label: 'DNS Config', icon: <RouterIcon sx={{ fontSize: 16 }} />, color: '#06B6D4', bg: 'rgba(6,182,212,0.08)', path: '/isp/dns' },
                { label: 'View Alerts', icon: <WarningAmberIcon sx={{ fontSize: 16 }} />, color: '#D97706', bg: 'rgba(245,158,11,0.08)', path: '/isp/alerts' },
                { label: 'Billing', icon: <TrendingUpIcon sx={{ fontSize: 16 }} />, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', path: '/isp/billing' },
                { label: 'Reports', icon: <FileDownloadIcon sx={{ fontSize: 16 }} />, color: '#10B981', bg: 'rgba(16,185,129,0.08)', path: '/isp/reports' },
              ].map(action => (
                <Button
                  key={action.label}
                  size="small"
                  startIcon={action.icon}
                  onClick={() => navigate(action.path)}
                  sx={{
                    borderRadius: '10px', bgcolor: action.bg, color: action.color,
                    fontWeight: 600, fontSize: 12, textTransform: 'none',
                    border: '1px solid', borderColor: `${action.color}20`,
                    px: 2, py: 0.75,
                    '&:hover': { bgcolor: action.bg, borderColor: action.color, transform: 'translateY(-1px)', boxShadow: `0 4px 10px ${action.color}20` },
                    transition: 'all 0.18s ease',
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </AnimatedPage>

      <Grid container spacing={3}>
        {/* DNS Query Trend Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <AnimatedPage delay={0.3}>
            <Card sx={{ bgcolor: '#FFFFFF', border: 'none', boxShadow: '0 8px 32px -4px rgba(15,31,61,0.06)', borderRadius: '12px' }}>
              <CardContent>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2.5 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} letterSpacing="-0.3px">
                      DNS Query Trend
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontSize={13}>
                      Last {days} days · {formatK(totalQueries)} total queries
                    </Typography>
                  </Box>
                  <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(79,70,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DnsIcon sx={{ color: '#4F46E5', fontSize: 18 }} />
                  </Box>
                </Stack>
                {trend.length === 0 ? (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography color="text.secondary">No DNS query data available yet.</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="ispDashGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#005DAC" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#005DAC" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={formatK} tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                        formatter={(v: number) => [formatK(v), 'Queries']}
                      />
                      <Area type="monotone" dataKey="queries" stroke="#005DAC" strokeWidth={2.5}
                        fill="url(#ispDashGrad)" dot={{ r: 4, fill: '#005DAC', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, stroke: '#005DAC', strokeWidth: 2, fill: '#fff' }} />
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
            <Card sx={{ height: '100%', bgcolor: '#FFFFFF', border: 'none', boxShadow: '0 8px 32px -4px rgba(15,31,61,0.06)', borderRadius: '12px' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'rgba(79,70,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PersonAddIcon sx={{ color: '#4F46E5', fontSize: 18 }} />
                    </Box>
                    <Typography variant="subtitle1" fontWeight={700} letterSpacing="-0.3px">Recent Customers</Typography>
                  </Box>
                  <Chip size="small" label={`${recentSignups.length} shown`} sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(79,70,229,0.08)', color: '#4F46E5', fontWeight: 600 }} />
                </Stack>
                {recentSignups.length === 0 ? (
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <Box sx={{ width: 48, height: 48, borderRadius: '12px', bgcolor: 'rgba(79,70,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
                      <PeopleIcon sx={{ color: '#4F46E5', fontSize: 24 }} />
                    </Box>
                    <Typography color="text.secondary" fontSize={14}>No customers yet</Typography>
                    <Typography variant="caption" color="text.disabled">Add customers to get started</Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {recentSignups.map((signup, i) => {
                      const profileCnt = signup.profileCount || signup.profiles || 0;
                      return (
                        <Box key={signup.id} sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5,
                          p: 1.5, borderRadius: '10px', border: '1px solid #F1F5F9',
                          transition: 'all 0.18s ease',
                          '&:hover': { bgcolor: 'rgba(79,70,229,0.03)', borderColor: 'rgba(79,70,229,0.12)', transform: 'translateX(3px)' },
                          '@keyframes fadeInRight': { from: { opacity: 0, transform: 'translateX(-12px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                          animation: `fadeInRight 0.4s ease ${0.5 + i * 0.08}s both`,
                        }}>
                          <Avatar sx={{
                            width: 38, height: 38, fontSize: 13, fontWeight: 800,
                            background: `linear-gradient(135deg, ${INITIAL_COLORS[i % INITIAL_COLORS.length]}, ${INITIAL_COLORS[(i + 1) % INITIAL_COLORS.length]})`,
                            boxShadow: `0 4px 10px ${INITIAL_COLORS[i % INITIAL_COLORS.length]}35`,
                          }}>
                            {signup.name ? getInitials(signup.name) : (signup.userId?.slice(0, 2).toUpperCase() ?? 'C')}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700} noWrap fontSize={13}>{signup.name || `Customer ${i + 1}`}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {(signup.createdAt || signup.joinedAt) ? new Date(signup.createdAt || signup.joinedAt || '').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : (signup.email || 'No email')}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                            <Chip size="small"
                              label={profileCnt > 0 ? `${profileCnt} profile${profileCnt !== 1 ? 's' : ''}` : 'No profiles'}
                              sx={{ height: 20, fontSize: 10, fontWeight: 700,
                                bgcolor: profileCnt > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(107,114,128,0.08)',
                                color: profileCnt > 0 ? '#059669' : '#6B7280' }} />
                            <Chip size="small" label="Active"
                              sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'rgba(6,182,212,0.08)', color: '#0891B2' }} />
                          </Box>
                        </Box>
                      );
                    })}
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
              <Card sx={{ border: '1px solid rgba(79,70,229,0.08)' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                        <TrendingUpIcon sx={{ color: '#4F46E5', fontSize: 18 }} />
                        <Typography variant="subtitle1" fontWeight={700} letterSpacing="-0.3px">Customer Summary</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {customerCount} customers · {profileCount} profiles protected
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Chip size="small" label={`${customerCount} customers`} sx={{ height: 22, fontSize: 11, bgcolor: 'rgba(6,182,212,0.08)', color: '#0891B2', fontWeight: 600 }} />
                      <Chip size="small" label={`${profileCount} profiles`} sx={{ height: 22, fontSize: 11, bgcolor: 'rgba(79,70,229,0.08)', color: '#4F46E5', fontWeight: 600 }} />
                    </Stack>
                  </Stack>
                  {trend.length > 0 && (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={formatK} tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                          formatter={(v: number) => [formatK(v), 'Queries']}
                        />
                        <Line type="monotone" dataKey="queries" stroke="#4F46E5" strokeWidth={2.5}
                          dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }} />
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
