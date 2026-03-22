import { Box, Grid, Card, CardContent, Typography, Skeleton, Chip, Stack, Alert } from '@mui/material';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import ShieldIcon from '@mui/icons-material/Shield';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import SpeedIcon from '@mui/icons-material/Speed';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/PageHeader';
import { gradients } from '../../theme/theme';

// Uses palette-aligned hex values (primary.main, success.main, error.main, warning.main)
const ACTION_COLORS: Record<string, string> = {
  SERVICE_RESTART: '#FB8C00', SERVICE_START: '#43A047', SERVICE_STOP: '#E53935',
  PLAN_CREATED: '#43A047', PLAN_UPDATED: '#1565C0', PLAN_DELETED: '#E53935',
  TENANT_CREATED: '#43A047', USER_CREATED: '#1565C0', FEATURE_TOGGLED: '#1565C0',
};

function fmt(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return String(v);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function PlatformSosBanner() {
  const navigate = useNavigate();
  const { data: sosCount = 0 } = useQuery({
    queryKey: ['platform-sos-active'],
    queryFn: async () => {
      const r = await api.get('/location/sos/platform');
      const list = r.data?.data ?? [];
      return Array.isArray(list) ? list.length : 0;
    },
    refetchInterval: 30000,
  });

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
          onClick={() => navigate('/admin/alerts')}
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

export default function PlatformDashboardPage() {
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const errorColor = theme.palette.error.main;
  const { data, isLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const [adminRes, analyticsRes, tenantRes, dailyRes, svcRes, topTenantsRes, auditRes, revenueRes] = await Promise.all([
        api.get('/admin/platform/stats').then(r => r.data.data || r.data).catch(() => ({})),
        api.get('/analytics/platform/overview?period=today').then(r => r.data).catch(() => ({})),
        api.get('/tenants?size=1').then(r => { const d = r.data?.data; return d?.totalElements ?? d?.content?.length ?? 0; }).catch(() => 0),
        api.get('/analytics/platform/daily?days=7').then(r => r.data).catch(() => []),
        api.get('/admin/platform/services').then(r => (r.data?.data || r.data) as { name: string; status: string }[]).catch(() => []),
        api.get('/analytics/platform/top-tenants?days=7&limit=5').then(r => {
          const d = Array.isArray(r.data) ? r.data : r.data?.data || [];
          return d.map((t: any) => ({ name: t.tenantId?.substring(0, 12) || 'Unknown', queries: t.totalQueries || t.queries || 0 }));
        }).catch(() => []),
        api.get('/admin/audit-logs?size=10').then(r => {
          const d = r.data?.data;
          const list = d?.content ?? d ?? [];
          return (Array.isArray(list) ? list : []).map((a: any) => ({
            id: a.id, action: (a.action || '').replace(/_/g, ' '),
            detail: `${a.resourceType || ''} ${a.resourceId ? a.resourceId.substring(0, 8) : ''} by ${a.userName || 'system'}`,
            time: a.createdAt ? timeAgo(a.createdAt) : '',
            color: ACTION_COLORS[a.action] || '#78909C',
          }));
        }).catch(() => []),
        api.get('/admin/platform/revenue').then(r => r.data?.data || r.data || {}).catch(() => ({})),
      ]);
      const onlineCount = Array.isArray(svcRes) ? svcRes.filter((s: any) => s.status === 'active').length : 0;
      return {
        totalTenants: tenantRes ?? 0,
        totalCustomers: adminRes.totalCustomers ?? 0,
        dnsQueriesToday: analyticsRes.totalQueries ?? 0,
        blockRate: analyticsRes.blockRate ?? 0,
        activeProfiles: adminRes.activeProfiles ?? 0,
        dnsBlockedToday: analyticsRes.blockedQueries ?? 0,
        servicesOnline: onlineCount,
        avgResponseMs: 0,
        totalRevenue: revenueRes?.totalRevenue ?? revenueRes?.monthlyRevenue ?? adminRes?.totalRevenue ?? 0,
        activeSubscriptions: revenueRes?.activeSubscriptions ?? adminRes?.activeSubscriptions ?? 0,
        trend: Array.isArray(dailyRes) && dailyRes.length
          ? dailyRes.map((p: any) => ({ d: new Date(p.date).toLocaleDateString('en', { weekday: 'short' }), q: p.totalQueries, b: p.blockedQueries || 0 }))
          : [],
        topTenants: topTenantsRes,
        recentActivity: auditRes,
      };
    },
  });
  const stats = data || { totalTenants: 0, totalCustomers: 0, dnsQueriesToday: 0, blockRate: 0, activeProfiles: 0, dnsBlockedToday: 0, servicesOnline: 0, avgResponseMs: 0, totalRevenue: 0, activeSubscriptions: 0, trend: [], topTenants: [], recentActivity: [] };

  if (isLoading) {
    return (
      <AnimatedPage>
        <PageHeader icon={<DashboardIcon />} title="Platform Dashboard" subtitle="Overview of all platform metrics" />
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ p: 2 }}><Skeleton variant="text" width={100} /><Skeleton variant="text" width={60} height={40} /></Card>
            </Grid>
          ))}
        </Grid>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader icon={<DashboardIcon />} title="Platform Dashboard" subtitle="Overview of all platform metrics" />

      <PlatformSosBanner />

      {/* Row 1: Primary stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="ISP Tenants" value={stats.totalTenants} icon={<BusinessIcon />} gradient={gradients.blue} delay={0} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Total Customers" value={stats.totalCustomers} icon={<PeopleIcon />} gradient={gradients.green} delay={0.1} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="DNS Queries Today" value={fmt(stats.dnsQueriesToday)} icon={<DnsIcon />} gradient={gradients.purple} delay={0.2} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Global Block Rate" value={stats.blockRate} unit="%" icon={<BlockIcon />} gradient={gradients.orange} delay={0.3} />
        </Grid>
      </Grid>

      {/* Row 2: Secondary stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Active Profiles" value={stats.activeProfiles} icon={<ShieldIcon />} gradient={gradients.teal} delay={0.15} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="DNS Blocked Today" value={fmt(stats.dnsBlockedToday)} icon={<BlockIcon />} gradient={gradients.red} delay={0.2} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Services Online" value={`${stats.servicesOnline}/13`} icon={<MonitorHeartIcon />} gradient={gradients.green} delay={0.25} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Total Revenue" value={`₹${fmt(stats.totalRevenue)}`} icon={<AttachMoneyIcon />} gradient={gradients.orange} delay={0.3} />
        </Grid>
      </Grid>

      {/* Row 3: Charts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Box sx={{
            '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
            animation: 'fadeInUp 0.5s ease 0.35s both',
          }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>DNS Queries vs Blocked (7 days)</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Total queries and blocked requests trend</Typography>
                {stats.trend.length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No DNS query data available yet.</Typography>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={stats.trend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="queriesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={primaryColor} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="blockedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={errorColor} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={errorColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                      <XAxis dataKey="d" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => [v.toLocaleString(), '']} contentStyle={{ borderRadius: 8, border: '1px solid #E8EDF2' }} />
                      <Area type="monotone" dataKey="q" name="Queries" stroke={primaryColor} strokeWidth={2.5} fill="url(#queriesGrad)" dot={{ r: 3, fill: primaryColor, strokeWidth: 2, stroke: '#fff' }} />
                      <Area type="monotone" dataKey="b" name="Blocked" stroke={errorColor} strokeWidth={2} fill="url(#blockedGrad)" dot={{ r: 3, fill: errorColor, strokeWidth: 2, stroke: '#fff' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={{
            '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
            animation: 'fadeInUp 0.5s ease 0.4s both',
          }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Top Tenants by Queries</Typography>
                {stats.topTenants.length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No tenant query data yet.</Typography>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={stats.topTenants} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0F0F0" />
                      <XAxis type="number" tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                      <Tooltip formatter={(v: number) => [v.toLocaleString(), 'Queries']} />
                      <Bar dataKey="queries" fill={primaryColor} radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>

      {/* Row 4: Recent Activity */}
      <Box sx={{
        '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        animation: 'fadeInUp 0.5s ease 0.45s both',
      }}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Recent Activity</Typography>
            {stats.recentActivity.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No recent activity recorded yet.</Typography>
            ) : (
              <Stack spacing={1.5}>
                {stats.recentActivity.map((item: any) => (
                  <Box key={item.id} sx={{
                    display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 2,
                    transition: 'all 0.2s ease', '&:hover': { bgcolor: 'background.default' },
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color, flexShrink: 0, boxShadow: `0 0 0 3px ${item.color}20` }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600}>{item.action}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.detail}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{item.time}</Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </AnimatedPage>
  );
}
