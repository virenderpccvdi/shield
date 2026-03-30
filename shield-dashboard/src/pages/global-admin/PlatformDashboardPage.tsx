import {
  Box, Grid, Card, CardContent, Typography, Chip, Stack, Skeleton,
  Divider, Button, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Alert, TablePagination, Tooltip as MuiTooltip,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import ShieldIcon from '@mui/icons-material/Shield';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/PageHeader';
import { gradients } from '../../theme/theme';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function fmtMoney(v: number): string {
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const ACTION_COLORS: Record<string, string> = {
  SERVICE_RESTART: '#FB8C00',
  SERVICE_START: '#43A047',
  SERVICE_STOP: '#E53935',
  PLAN_CREATED: '#43A047',
  PLAN_UPDATED: '#1565C0',
  PLAN_DELETED: '#E53935',
  TENANT_CREATED: '#43A047',
  USER_CREATED: '#1565C0',
  FEATURE_TOGGLED: '#1565C0',
};

const PLAN_CHIP_COLOR: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'default'> = {
  ENTERPRISE: 'primary',
  BUSINESS: 'success',
  STARTER: 'warning',
  FREE: 'default',
};

const DONUT_COLORS = [
  '#1565C0', '#43A047', '#FB8C00', '#E53935',
  '#7B1FA2', '#00897B', '#F06292', '#FF7043',
];

// ─── Animated wrapper ────────────────────────────────────────────────────────

function FadeCard({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <Box sx={{
      '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      animation: `fadeInUp 0.5s ease ${delay}s both`,
    }}>
      {children}
    </Box>
  );
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <AnimatedPage>
      <PageHeader icon={<DashboardIcon />} title="Platform Dashboard" subtitle="Global overview of all Shield metrics" />
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <Card sx={{ p: 2 }}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" height={48} />
            </Card>
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card><CardContent><Skeleton variant="rectangular" height={300} /></CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card><CardContent><Skeleton variant="rectangular" height={300} /></CardContent></Card>
        </Grid>
      </Grid>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card><CardContent><Skeleton variant="rectangular" height={160} /></CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card><CardContent><Skeleton variant="rectangular" height={160} /></CardContent></Card>
        </Grid>
      </Grid>
    </AnimatedPage>
  );
}

// ─── CSV export ──────────────────────────────────────────────────────────────

function exportPlatformCSV(d: ReturnType<typeof buildExportData>, days: number) {
  const lines: string[] = [];
  lines.push('Shield Platform Dashboard Export');
  lines.push(`Generated,${new Date().toLocaleString()}`);
  lines.push(`Period,Last ${days} days`);
  lines.push('');
  lines.push('Platform Summary');
  lines.push(`ISP Tenants,${d.totalIspTenants}`);
  lines.push(`Total Customers,${d.totalCustomers}`);
  lines.push(`Active Profiles,${d.activeProfiles}`);
  lines.push(`DNS Queries Today,${d.totalQueries}`);
  lines.push(`Blocked Queries,${d.blockedQueries}`);
  lines.push(`Block Rate,${Number(d.blockRate).toFixed(1)}%`);
  lines.push(`Monthly Revenue,${d.monthlyRevenue}`);
  lines.push(`Active Subscriptions,${d.activeSubscriptions}`);
  lines.push('');
  lines.push('DNS Query Trend');
  lines.push('Day,Queries,Blocked');
  (d.trend ?? []).forEach((p: { d: string; q: number; b: number }) => lines.push(`${p.d},${p.q},${p.b}`));
  lines.push('');
  lines.push('Top Tenants by DNS Queries');
  lines.push('Tenant,Queries');
  (d.topTenants ?? []).forEach((t: { name: string; queries: number }) => lines.push(`"${t.name}",${t.queries}`));
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `platform-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildExportData(data: any) { return data; }

// ─── Main component ──────────────────────────────────────────────────────────

export default function PlatformDashboardPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const primaryColor = theme.palette.primary.main;
  const errorColor = theme.palette.error.main;
  const [tenantPage, setTenantPage] = useState(0);
  const [tenantRowsPerPage, setTenantRowsPerPage] = useState(5);
  const [auditPage, setAuditPage] = useState(0);
  const [auditRowsPerPage, setAuditRowsPerPage] = useState(10);
  const [days, setDays] = useState<7 | 30 | 90>(7);

  // ── Paginated tenants query ──────────────────────────────────────────
  const { data: tenantsPage } = useQuery({
    queryKey: ['platform-tenants', tenantPage, tenantRowsPerPage],
    queryFn: async () => {
      try {
        const r = await api.get(`/tenants?size=${tenantRowsPerPage}&page=${tenantPage}`);
        const raw = r.data?.data ?? r.data ?? {};
        return { content: raw?.content ?? [], totalElements: raw?.totalElements ?? 0 };
      } catch { return { content: [], totalElements: 0 }; }
    },
  });

  // ── Paginated audit query ────────────────────────────────────────────
  const { data: auditPage2 } = useQuery({
    queryKey: ['platform-audit', auditPage, auditRowsPerPage],
    queryFn: async () => {
      try {
        const r = await api.get(`/admin/audit-logs?size=${auditRowsPerPage}&page=${auditPage}`);
        const raw = r.data?.data ?? r.data ?? {};
        const list: any[] = raw?.content ?? (Array.isArray(raw) ? raw : []);
        const totalElements: number = raw?.totalElements ?? list.length;
        return { content: list.map((a: any) => ({
          id: a.id,
          action: (a.action ?? '').replace(/_/g, ' '),
          resourceType: a.resourceType ?? '',
          resourceId: a.resourceId ? String(a.resourceId).substring(0, 8) : '',
          userName: a.userName ?? a.userEmail ?? (a.userId ? `User ${String(a.userId).substring(0, 6)}` : '—'),
          ipAddress: a.ipAddress ?? '',
          time: a.createdAt ? timeAgo(a.createdAt) : '',
          exactTime: a.createdAt ? new Date(a.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
          color: ACTION_COLORS[a.action] ?? '#78909C',
          rawAction: a.action ?? '',
        })), totalElements };
      } catch { return { content: [], totalElements: 0 }; }
    },
  });

  // ── Data fetch ──────────────────────────────────────────────────────────
  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-dashboard-v2', days],
    queryFn: async () => {
      // Use allSettled so one failure never blocks the whole dashboard
      const [
        statsRes, analyticsRes, dailyRes, categoriesRes,
        topTenantsRes, revenueRes,
        healthRes, servicesRes, allTenantsRes,
      ] = await Promise.allSettled([
        api.get('/admin/platform/stats'),                              // 0
        api.get('/analytics/platform/overview?period=today'),         // 1
        api.get(`/analytics/platform/daily?days=${days}`),            // 2
        api.get('/analytics/platform/categories?period=week'),        // 3
        api.get('/analytics/platform/top-tenants?limit=10&period=week'), // 4
        api.get('/admin/platform/revenue'),                           // 5
        api.get('/admin/platform/health'),                            // 6
        api.get('/admin/platform/services'),                          // 7
        api.get('/tenants?size=100&page=0'),                         // 8 — for name lookup
      ]);

      // ── Parse admin stats ──
      const statsData = statsRes.status === 'fulfilled'
        ? (statsRes.value.data?.data ?? statsRes.value.data ?? {})
        : {};

      // ── Parse analytics overview ──
      const analyticsData = analyticsRes.status === 'fulfilled'
        ? (analyticsRes.value.data?.data ?? analyticsRes.value.data ?? {})
        : {};

      // ── Parse 7-day trend ──
      const rawDaily = dailyRes.status === 'fulfilled'
        ? (Array.isArray(dailyRes.value.data) ? dailyRes.value.data
          : dailyRes.value.data?.data ?? [])
        : [];
      const trend = rawDaily.map((p: any) => ({
        d: new Date(p.date).toLocaleDateString('en', { weekday: 'short' }),
        q: p.totalQueries ?? 0,
        b: p.blockedQueries ?? 0,
      }));

      // ── Parse categories (top 8 for donut) ──
      const rawCats = categoriesRes.status === 'fulfilled'
        ? (Array.isArray(categoriesRes.value.data) ? categoriesRes.value.data
          : categoriesRes.value.data?.data ?? [])
        : [];
      const categories = (rawCats as any[])
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, 8)
        .map((c: any) => ({
          name: (c.category ?? 'Unknown').replace(/_/g, ' '),
          value: c.count ?? 0,
        }));

      // ── Build tenant name lookup map ──
      const allTenantsRaw = allTenantsRes.status === 'fulfilled'
        ? (allTenantsRes.value.data?.data ?? allTenantsRes.value.data ?? {})
        : {};
      const allTenantsList: any[] = allTenantsRaw?.content ?? [];
      const tenantNameMap: Record<string, string> = {};
      allTenantsList.forEach((t: any) => { if (t.id) tenantNameMap[t.id] = t.name ?? t.slug ?? t.id.substring(0, 8); });

      // ── Parse top tenants ──
      // Backend returns List<Object[]> where each item is [tenantId, queryCount]
      const rawTopTenants = topTenantsRes.status === 'fulfilled'
        ? (Array.isArray(topTenantsRes.value.data) ? topTenantsRes.value.data
          : topTenantsRes.value.data?.data ?? [])
        : [];
      const topTenants = (rawTopTenants as any[]).map((t: any) => {
        if (Array.isArray(t)) {
          const tid = t[0] ? String(t[0]) : null;
          const name = tid ? (tenantNameMap[tid] ?? tid.substring(0, 12) + '…') : 'Platform';
          return { tenantId: tid, name, queries: Number(t[1] ?? 0) };
        }
        return { tenantId: t.tenantId ?? null, name: tenantNameMap[t.tenantId] ?? t.name ?? 'Unknown', queries: t.totalQueries ?? t.queries ?? 0 };
      }).filter(t => t.queries > 0);

      // ── Parse revenue ──
      const revenueData = revenueRes.status === 'fulfilled'
        ? (revenueRes.value.data?.data ?? revenueRes.value.data ?? {})
        : {};

      // ── Parse health (map or array) ──
      const healthRaw = healthRes.status === 'fulfilled'
        ? (healthRes.value.data?.data ?? healthRes.value.data ?? {})
        : {};
      let healthList: { name: string; healthy: boolean }[] = [];
      if (healthRaw && typeof healthRaw === 'object' && !Array.isArray(healthRaw)) {
        healthList = Object.entries(healthRaw).map(([name, status]) => ({
          name,
          healthy: status === 'UP' || status === 'healthy' || status === true,
        }));
      } else if (Array.isArray(healthRaw)) {
        healthList = healthRaw.map((s: any) => ({
          name: s.name ?? s.service ?? 'Unknown',
          healthy: s.status === 'UP' || s.status === 'healthy' || s.healthy === true,
        }));
      }

      // ── Fallback to services list if health is empty ──
      if (healthList.length === 0 && servicesRes.status === 'fulfilled') {
        const svcRaw = servicesRes.value.data?.data ?? servicesRes.value.data ?? [];
        const svcArr: any[] = Array.isArray(svcRaw) ? svcRaw : [];
        healthList = svcArr.map((s: any) => ({
          name: s.name ?? s.service ?? 'Unknown',
          healthy: s.status === 'active' || s.status === 'UP' || s.healthy === true,
        }));
      }

      const healthyCount = healthList.filter(h => h.healthy).length;

      return {
        // KPI values
        totalIspTenants: statsData.totalIspTenants ?? 0,
        totalCustomers: statsData.totalCustomers ?? 0,
        activeProfiles: statsData.activeProfiles ?? 0,
        totalUsers: statsData.totalUsers ?? 0,
        totalDevices: statsData.totalDevices ?? 0,
        activeSubscriptions: revenueData.activeSubscriptions ?? statsData.activeSubscriptions ?? 0,
        // Analytics
        totalQueries: analyticsData.totalQueries ?? 0,
        blockedQueries: analyticsData.blockedQueries ?? 0,
        blockRate: analyticsData.blockRate ?? 0,
        // Revenue
        monthlyRevenue: revenueData.monthlyRevenue ?? revenueData.totalRevenue ?? 0,
        totalPlans: revenueData.totalPlans ?? 0,
        // Charts
        trend,
        categories,
        topTenants,
        // Health
        healthList,
        healthyCount,
      };
    },
    refetchInterval: 60_000,
  });

  if (isLoading) return <DashboardSkeleton />;

  const d = data!;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<DashboardIcon />}
        title="Platform Dashboard"
        subtitle="Global overview of all Shield metrics"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <ToggleButtonGroup
              value={days}
              exclusive
              size="small"
              onChange={(_, v) => { if (v) setDays(v); }}
              sx={{ bgcolor: 'background.paper' }}
            >
              {([7, 30, 90] as const).map(n => (
                <ToggleButton key={n} value={n} sx={{ px: 1.5, fontSize: 12, fontWeight: 600 }}>
                  {n}D
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {data && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDownloadIcon />}
                onClick={() => exportPlatformCSV(data, days)}
                sx={{ fontSize: 12 }}
              >
                Export CSV
              </Button>
            )}
          </Stack>
        }
      />

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          Some data failed to load — displaying partial results.
        </Alert>
      )}

      {/* ── Row 1: 6 KPI Cards ──────────────────────────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <StatCard
            title="ISP Tenants"
            value={d.totalIspTenants}
            icon={<BusinessIcon />}
            gradient={gradients.blue}
            delay={0}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <StatCard
            title="Total Customers"
            value={d.totalCustomers}
            icon={<PeopleIcon />}
            gradient={gradients.green}
            delay={0.05}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <StatCard
            title="Active Profiles"
            value={d.activeProfiles}
            icon={<ShieldIcon />}
            gradient={gradients.teal}
            delay={0.1}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <StatCard
            title="DNS Queries Today"
            value={fmt(d.totalQueries)}
            icon={<DnsIcon />}
            gradient={gradients.purple}
            delay={0.15}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <StatCard
            title="Block Rate"
            value={Number(d.blockRate).toFixed(1)}
            unit="%"
            icon={<BlockIcon />}
            gradient={gradients.orange}
            delay={0.2}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <StatCard
            title="Active Subscriptions"
            value={d.activeSubscriptions}
            icon={<CreditCardIcon />}
            gradient={gradients.red}
            delay={0.25}
          />
        </Grid>
      </Grid>

      {/* ── Row 2: Area chart + Donut chart ─────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Left: 7-day area chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <FadeCard delay={0.3}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
                  DNS Queries vs Blocked — 7 Days
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Total queries and blocked requests over the past week
                </Typography>
                {d.trend.length === 0 ? (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <DnsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">No DNS data available yet</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={d.trend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="gradQueries" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={primaryColor} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradBlocked" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={errorColor} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={errorColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                      <XAxis dataKey="d" tick={{ fontSize: 12, fill: theme.palette.text.secondary }} />
                      <YAxis tickFormatter={fmt} tick={{ fontSize: 12, fill: theme.palette.text.secondary }} />
                      <Tooltip
                        formatter={(v: number, name: string) => [v.toLocaleString(), name]}
                        contentStyle={{ borderRadius: 10, border: `1px solid ${theme.palette.divider}`, background: theme.palette.background.paper }}
                        labelStyle={{ fontWeight: 600, color: theme.palette.text.primary }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area
                        type="monotone"
                        dataKey="q"
                        name="Total Queries"
                        stroke={primaryColor}
                        strokeWidth={2.5}
                        fill="url(#gradQueries)"
                        dot={{ r: 3.5, fill: primaryColor, stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 5 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="b"
                        name="Blocked"
                        stroke={errorColor}
                        strokeWidth={2}
                        fill="url(#gradBlocked)"
                        dot={{ r: 3, fill: errorColor, stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </FadeCard>
        </Grid>

        {/* Right: Category donut */}
        <Grid size={{ xs: 12, md: 4 }}>
          <FadeCard delay={0.35}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
                  Top Blocked Categories
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Past 7 days
                </Typography>
                {d.categories.length === 0 ? (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <BlockIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">No category data yet</Typography>
                  </Box>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={d.categories}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {d.categories.map((_: any, idx: number) => (
                            <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => [v.toLocaleString(), 'Blocked']}
                          contentStyle={{ borderRadius: 10, border: `1px solid ${theme.palette.divider}`, background: theme.palette.background.paper }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                      {d.categories.slice(0, 4).map((c: any, idx: number) => (
                        <Box key={c.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: DONUT_COLORS[idx % DONUT_COLORS.length], flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            {c.value.toLocaleString()}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </>
                )}
              </CardContent>
            </Card>
          </FadeCard>
        </Grid>
      </Grid>

      {/* ── Row 3: Revenue card + Platform Health ──────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Revenue */}
        <Grid size={{ xs: 12, md: 4 }}>
          <FadeCard delay={0.4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AttachMoneyIcon sx={{ color: 'success.main' }} />
                  <Typography variant="subtitle1" fontWeight={700}>Revenue & Billing</Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                      Monthly Revenue
                    </Typography>
                    <Typography variant="h4" fontWeight={800} color="success.main">
                      {fmtMoney(d.monthlyRevenue)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 4 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                        Active Subscriptions
                      </Typography>
                      <Typography variant="h6" fontWeight={700}>
                        {d.activeSubscriptions.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                        Plans Available
                      </Typography>
                      <Typography variant="h6" fontWeight={700}>
                        {d.totalPlans || '—'}
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </FadeCard>
        </Grid>

        {/* Platform Health */}
        <Grid size={{ xs: 12, md: 8 }}>
          <FadeCard delay={0.45}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MonitorHeartIcon sx={{ color: 'primary.main' }} />
                    <Typography variant="subtitle1" fontWeight={700}>Platform Health</Typography>
                  </Box>
                  {d.healthList.length > 0 && (
                    <Chip
                      label={`${d.healthyCount}/${d.healthList.length} Healthy`}
                      color={d.healthyCount === d.healthList.length ? 'success' : 'warning'}
                      size="small"
                    />
                  )}
                </Box>
                <Divider sx={{ mb: 2 }} />
                {d.healthList.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">No health data available</Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    {d.healthList.map((svc) => (
                      <Box
                        key={svc.name}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1,
                          px: 1.5, py: 0.75, borderRadius: 2,
                          bgcolor: svc.healthy
                            ? 'rgba(67,160,71,0.08)'
                            : 'rgba(229,57,53,0.08)',
                          border: '1px solid',
                          borderColor: svc.healthy ? 'rgba(67,160,71,0.25)' : 'rgba(229,57,53,0.25)',
                          minWidth: 140,
                        }}
                      >
                        <Box
                          sx={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            bgcolor: svc.healthy ? 'success.main' : 'error.main',
                            boxShadow: svc.healthy
                              ? '0 0 0 3px rgba(67,160,71,0.2)'
                              : '0 0 0 3px rgba(229,57,53,0.2)',
                          }}
                        />
                        <Typography variant="body2" fontWeight={500} sx={{ textTransform: 'capitalize' }}>
                          {svc.name.replace(/-/g, ' ')}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </FadeCard>
        </Grid>
      </Grid>

      {/* ── Row 4: Tenants table + Top tenants by traffic ──────────────── */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Tenants table */}
        <Grid size={{ xs: 12, md: 7 }}>
          <FadeCard delay={0.5}>
            <Card>
              <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BusinessIcon sx={{ color: 'primary.main' }} />
                    <Typography variant="subtitle1" fontWeight={700}>Recent ISP Tenants</Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate('/admin/tenants')}
                    sx={{ borderRadius: 2 }}
                  >
                    View All
                  </Button>
                </Box>
                <Divider sx={{ mb: 0 }} />
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Plan</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Customers</TableCell>
                        <TableCell>Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(tenantsPage?.content ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                            No tenants found
                          </TableCell>
                        </TableRow>
                      ) : (
                        (tenantsPage?.content ?? []).map((t: any) => (
                          <TableRow key={t.id} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600} sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.name ?? 'Unnamed'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={t.plan ?? 'N/A'}
                                size="small"
                                color={PLAN_CHIP_COLOR[t.plan] ?? 'default'}
                                variant="outlined"
                                sx={{ fontSize: 11 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={t.isActive ? 'Active' : 'Inactive'}
                                size="small"
                                color={t.isActive ? 'success' : 'default'}
                                sx={{ fontSize: 11 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {t.customerCount ?? t.maxCustomers ?? '—'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <MuiTooltip title={t.createdAt ? new Date(t.createdAt).toLocaleString('en-IN') : ''}>
                                <Typography variant="caption" color="text.secondary">
                                  {t.createdAt ? fmtDate(t.createdAt) : '—'}
                                </Typography>
                              </MuiTooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={tenantsPage?.totalElements ?? 0}
                  page={tenantPage}
                  onPageChange={(_e, p) => setTenantPage(p)}
                  rowsPerPage={tenantRowsPerPage}
                  onRowsPerPageChange={e => { setTenantRowsPerPage(parseInt(e.target.value, 10)); setTenantPage(0); }}
                  rowsPerPageOptions={[5, 10, 25]}
                  sx={{ borderTop: '1px solid', borderColor: 'divider' }}
                />
              </CardContent>
            </Card>
          </FadeCard>
        </Grid>

        {/* Top tenants by traffic */}
        <Grid size={{ xs: 12, md: 5 }}>
          <FadeCard delay={0.55}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
                  Top Tenants by Traffic
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  DNS query volume by tenant
                </Typography>
                {d.topTenants.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary">No traffic data yet</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={d.topTenants}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} />
                      <XAxis
                        type="number"
                        tickFormatter={fmt}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                        width={110}
                      />
                      <Tooltip
                        formatter={(v: number) => [v.toLocaleString(), 'Queries']}
                        contentStyle={{ borderRadius: 10, border: `1px solid ${theme.palette.divider}`, background: theme.palette.background.paper }}
                      />
                      <Bar
                        dataKey="queries"
                        name="DNS Queries"
                        fill={primaryColor}
                        radius={[0, 5, 5, 0]}
                        barSize={18}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </FadeCard>
        </Grid>
      </Grid>

      {/* ── Row 5: Audit Log ─────────────────────────────────────────────── */}
      <FadeCard delay={0.6}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <WarningAmberIcon sx={{ color: 'warning.main' }} />
              <Typography variant="subtitle1" fontWeight={700}>Recent Audit Activity</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {(auditPage2?.content ?? []).length === 0 ? (
              <Box sx={{ py: 5, textAlign: 'center' }}>
                <Typography color="text.secondary">No audit events recorded yet</Typography>
              </Box>
            ) : (
              <Stack spacing={0.5}>
                {(auditPage2?.content ?? []).map((item: any) => (
                  <Box
                    key={item.id}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      px: 1.5, py: 1, borderRadius: 2,
                      transition: 'background 0.15s',
                      '&:hover': { bgcolor: 'background.default' },
                    }}
                  >
                    {/* Color dot */}
                    <Box sx={{
                      width: 9, height: 9, borderRadius: '50%',
                      bgcolor: item.color, flexShrink: 0,
                      boxShadow: `0 0 0 3px ${item.color}28`,
                    }} />
                    {/* Action chip */}
                    <Chip
                      label={item.rawAction || item.action}
                      size="small"
                      sx={{
                        fontSize: 10, fontWeight: 700, flexShrink: 0,
                        bgcolor: `${item.color}18`,
                        color: item.color,
                        border: `1px solid ${item.color}40`,
                        textTransform: 'uppercase',
                        letterSpacing: 0.3,
                      }}
                    />
                    {/* Resource + User info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {item.userName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.resourceType}{item.resourceId ? ` · ${item.resourceId}` : ''}{item.ipAddress ? ` · ${item.ipAddress}` : ''}
                      </Typography>
                    </Box>
                    {/* Time with exact tooltip */}
                    <MuiTooltip title={item.exactTime || ''} placement="left">
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontWeight: 500, cursor: 'default' }}>
                        {item.time}
                      </Typography>
                    </MuiTooltip>
                  </Box>
                ))}
              </Stack>
            )}
            <TablePagination
              component="div"
              count={auditPage2?.totalElements ?? 0}
              page={auditPage}
              onPageChange={(_e, p) => setAuditPage(p)}
              rowsPerPage={auditRowsPerPage}
              onRowsPerPageChange={e => { setAuditRowsPerPage(parseInt(e.target.value, 10)); setAuditPage(0); }}
              rowsPerPageOptions={[10, 25, 50]}
              sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 1 }}
            />
          </CardContent>
        </Card>
      </FadeCard>
    </AnimatedPage>
  );
}
