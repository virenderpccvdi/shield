import { useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Stack, MenuItem, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TablePagination, Chip, Avatar, CircularProgress, Button,
  Tooltip, IconButton, ToggleButtonGroup, ToggleButton,
  Divider,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import PeopleIcon from '@mui/icons-material/People';
import PercentIcon from '@mui/icons-material/Percent';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HistoryIcon from '@mui/icons-material/History';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import { alpha, useTheme } from '@mui/material/styles';

// ── Types ────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  domain?: string;
  status?: string;
}

interface Overview {
  totalQueries: number;
  blockedQueries: number;
  allowedQueries: number;
  blockRate: number;
  activeCustomers?: number;
}

interface DailyPoint {
  date: string;
  totalQueries: number;
  blockedQueries: number;
  allowedQueries: number;
}

interface TopDomain {
  domain: string;
  count: number;
  category?: string;
}

interface CategoryStat {
  category: string;
  count: number;
}

interface HourlyPoint {
  hour: number;
  count: number;
}

interface AuditEntry {
  id: string;
  createdAt: string;
  action: string;
  userName?: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: 'Today', value: 'today', days: 1 },
  { label: 'Week', value: 'week', days: 7 },
  { label: 'Month', value: 'month', days: 30 },
  { label: '3 Months', value: '3months', days: 90 },
];

const CATEGORY_COLORS = [
  '#1565C0', '#2E7D32', '#E65100', '#6A1B9A', '#00695C',
  '#C62828', '#F57F17', '#00838F', '#4527A0', '#37474F',
];

const HOUR_GRADIENT = ['#E3F2FD', '#90CAF9', '#42A5F5', '#1E88E5', '#1565C0', '#0D47A1'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatIp(ip: string): string {
  if (!ip) return '—';
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function hourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

function heatColor(ratio: number, palette: string[]): string {
  const n = palette.length - 1;
  const idx = Math.min(n, Math.floor(ratio * n));
  return palette[idx];
}

function exportDailyCSV(tenant: Tenant | undefined, rows: DailyPoint[]) {
  if (!rows.length || !tenant) return;
  const headers = ['Date', 'Total Queries', 'Blocked Queries', 'Allowed Queries'];
  const data = rows.map(r => [r.date, r.totalQueries, r.blockedQueries, r.allowedQueries]);
  const csv = [headers, ...data]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `isp-report-${tenant.name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  sub?: string;
  loading?: boolean;
  delay?: number;
}

function KpiCard({ title, value, icon, color, sub, loading, delay = 0 }: KpiCardProps) {
  return (
    <Card sx={{
      height: '100%',
      borderRadius: 2,
      border: `1px solid ${alpha(color, 0.2)}`,
      background: `linear-gradient(135deg, ${alpha(color, 0.07)} 0%, ${alpha(color, 0.02)} 100%)`,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 8px 24px ${alpha(color, 0.18)}` },
      '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      animation: `fadeInUp 0.45s ease ${delay}s both`,
    }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={600} fontSize={12.5}>
            {title}
          </Typography>
          <Box sx={{
            width: 38, height: 38, borderRadius: '10px',
            bgcolor: alpha(color, 0.12),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color,
          }}>
            {icon}
          </Box>
        </Box>
        {loading ? (
          <Box sx={{ pt: 0.5 }}><CircularProgress size={20} sx={{ color }} /></Box>
        ) : (
          <>
            <Typography variant="h4" fontWeight={800} color="text.primary" sx={{ lineHeight: 1.1 }}>
              {typeof value === 'number' ? fmt(value) : value}
            </Typography>
            {sub && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {sub}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>{icon}</Box>
      <Typography variant="subtitle1" fontWeight={700} color="text.primary">{title}</Typography>
    </Box>
  );
}

// ── Hourly Heatmap ────────────────────────────────────────────────────────────

function HourlyHeatmap({ data, loading }: { data: HourlyPoint[]; loading: boolean }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const palette = isDark
    ? ['#1A2744', '#1E3A6E', '#1565C0', '#1976D2', '#42A5F5', '#90CAF9']
    : HOUR_GRADIENT;

  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Build a full 24-slot array even if API returns sparse data
  const slots = Array.from({ length: 24 }, (_, h) => {
    const found = data.find(d => d.hour === h);
    return { hour: h, count: found?.count ?? 0 };
  });

  return (
    <Card sx={{ borderRadius: 2, height: '100%' }}>
      <CardContent>
        <SectionHeader icon={<AccessTimeIcon />} title="Hourly Activity" />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', mt: 1 }}>
              {slots.map(({ hour, count }) => {
                const ratio = count / maxCount;
                const bg = heatColor(ratio, palette);
                return (
                  <Tooltip key={hour} title={`${hourLabel(hour)}: ${count.toLocaleString()} queries`} arrow>
                    <Box sx={{
                      flex: '0 0 calc(4.16% - 3px)',
                      minWidth: 28,
                      height: 48,
                      borderRadius: 1,
                      bgcolor: bg,
                      border: `1px solid ${alpha('#000', 0.06)}`,
                      cursor: 'default',
                      transition: 'transform 0.15s',
                      '&:hover': { transform: 'scaleY(1.15)', zIndex: 1 },
                    }} />
                  </Tooltip>
                );
              })}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              {[0, 4, 8, 12, 16, 20, 23].map(h => (
                <Typography key={h} variant="caption" color="text.secondary" fontSize={10}>{hourLabel(h)}</Typography>
              ))}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, justifyContent: 'flex-end' }}>
              <Typography variant="caption" color="text.secondary" fontSize={10}>Low</Typography>
              <Box sx={{ display: 'flex', gap: 0.25 }}>
                {palette.map((c, i) => (
                  <Box key={i} sx={{ width: 14, height: 10, bgcolor: c, borderRadius: 0.5 }} />
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" fontSize={10}>High</Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IspActivityReportPage() {
  const theme = useTheme();
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [period, setPeriod] = useState<string>('week');
  const [domainsPage, setDomainsPage] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const auditSize = 20;

  const periodDef = PERIOD_OPTIONS.find(p => p.value === period) ?? PERIOD_OPTIONS[1];
  const days = periodDef.days;

  // ── Fetch tenants ──────────────────────────────────────────────────────────
  const { data: tenantsData } = useQuery({
    queryKey: ['isp-report-tenants'],
    queryFn: () => api.get('/tenants?size=100&sort=name,asc').then(r => {
      const d = r.data?.data ?? r.data;
      return (d?.content ?? d) as Tenant[];
    }),
    staleTime: 120_000,
  });

  const tenants: Tenant[] = tenantsData ?? [];

  // Auto-select first tenant when list loads
  const activeTenantId = selectedTenantId || (tenants[0]?.id ?? '');
  const activeTenant = tenants.find(t => t.id === activeTenantId);

  // ── Overview / KPI ─────────────────────────────────────────────────────────
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: ['isp-overview', activeTenantId, period],
    queryFn: () => api.get(`/analytics/tenant/${activeTenantId}/overview?period=${period}`).then(r => {
      const d = r.data?.data ?? r.data;
      return d as Overview;
    }).catch(() => null),
    enabled: !!activeTenantId,
    staleTime: 60_000,
  });

  // Active customers from profile service
  const { data: activeCustomers } = useQuery({
    queryKey: ['isp-customers-count', activeTenantId],
    queryFn: () => api.get(`/profile/customers?tenantId=${activeTenantId}&size=1`).then(r => {
      const d = r.data?.data ?? r.data;
      return (d?.totalElements ?? 0) as number;
    }).catch(() => 0),
    enabled: !!activeTenantId,
    staleTime: 120_000,
  });

  // ── Daily trend ────────────────────────────────────────────────────────────
  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['isp-daily', activeTenantId, days],
    queryFn: () => api.get(`/analytics/tenant/${activeTenantId}/daily?days=${days}`).then(r => {
      const d = r.data?.data ?? r.data;
      return (d?.content ?? d ?? []) as DailyPoint[];
    }).catch(() => [] as DailyPoint[]),
    enabled: !!activeTenantId,
    staleTime: 60_000,
  });

  // ── Top blocked domains ────────────────────────────────────────────────────
  const { data: topDomains, isLoading: domainsLoading } = useQuery({
    queryKey: ['isp-top-domains', activeTenantId, period],
    queryFn: () => api.get(`/analytics/tenant/${activeTenantId}/top-domains?action=BLOCKED&limit=50`).then(r => {
      const d = r.data?.data ?? r.data;
      return (d?.content ?? d ?? []) as TopDomain[];
    }).catch(() => [] as TopDomain[]),
    enabled: !!activeTenantId,
    staleTime: 60_000,
  });

  // ── Category breakdown ─────────────────────────────────────────────────────
  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ['isp-categories', activeTenantId, period],
    queryFn: () => api.get(`/analytics/tenant/${activeTenantId}/categories?period=${period}`).then(r => {
      const d = r.data?.data ?? r.data;
      return (d?.content ?? d ?? []) as CategoryStat[];
    }).catch(() => [] as CategoryStat[]),
    enabled: !!activeTenantId,
    staleTime: 60_000,
  });

  // ── Hourly activity ────────────────────────────────────────────────────────
  const { data: hourlyData, isLoading: hourlyLoading } = useQuery({
    queryKey: ['isp-hourly', activeTenantId],
    queryFn: () => api.get(`/analytics/tenant/${activeTenantId}/hourly`).then(r => {
      const d = r.data?.data ?? r.data;
      return (d?.content ?? d ?? []) as HourlyPoint[];
    }).catch(() => [] as HourlyPoint[]),
    enabled: !!activeTenantId,
    staleTime: 60_000,
  });

  // ── Audit log ──────────────────────────────────────────────────────────────
  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['isp-audit', activeTenantId, auditPage],
    queryFn: () => api.get(`/admin/audit-logs?tenantId=${activeTenantId}&size=${auditSize}&page=${auditPage}&sort=createdAt,desc`).then(r => {
      const d = r.data?.data ?? r.data;
      return { content: (d?.content ?? d ?? []) as AuditEntry[], totalElements: (d?.totalElements ?? 0) as number };
    }).catch(() => ({ content: [] as AuditEntry[], totalElements: 0 })),
    enabled: !!activeTenantId,
    staleTime: 30_000,
  });

  const handleRefresh = useCallback(() => { refetchOverview(); }, [refetchOverview]);

  const exportCsv = useCallback(() => {
    exportDailyCSV(activeTenant, dailyData ?? []);
  }, [activeTenant, dailyData]);

  const domainsRows = topDomains ?? [];
  const visibleDomains = domainsRows.slice(domainsPage * 10, domainsPage * 10 + 10);

  const catRows = (categories ?? []).slice().sort((a, b) => b.count - a.count).slice(0, 12);

  const auditEntries = auditData?.content ?? [];
  const auditTotal = auditData?.totalElements ?? 0;

  const blockRate = overview?.blockRate
    ? `${overview.blockRate.toFixed(1)}%`
    : overview?.totalQueries
    ? `${((overview.blockedQueries / overview.totalQueries) * 100).toFixed(1)}%`
    : '—';

  const noTenantSelected = !activeTenantId;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<AssessmentIcon />}
        title="ISP Activity Report"
        subtitle={activeTenant ? `Viewing: ${activeTenant.name}` : 'Select an ISP tenant to view reports'}
        iconColor="#1565C0"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Refresh data">
              <IconButton size="small" onClick={handleRefresh}
                disabled={!activeTenantId || overviewLoading}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined" size="small" startIcon={<DownloadIcon />}
              onClick={exportCsv}
              disabled={!dailyData?.length}
              sx={{ borderRadius: 2 }}
            >
              Export CSV
            </Button>
          </Stack>
        }
      />

      {/* ── Selectors ───────────────────────────────────────────────────────── */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <Box sx={{ px: 2.5, py: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <TextField
                select
                size="small"
                label="ISP Tenant"
                value={activeTenantId}
                onChange={e => { setSelectedTenantId(e.target.value); setDomainsPage(0); setAuditPage(0); }}
                sx={{ minWidth: 240 }}
              >
                {tenants.length === 0 && (
                  <MenuItem value="" disabled>Loading tenants…</MenuItem>
                )}
                {tenants.map(t => (
                  <MenuItem key={t.id} value={t.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: 'primary.main' }}>
                        {t.name[0]?.toUpperCase()}
                      </Avatar>
                      <span>{t.name}</span>
                      {t.status && (
                        <Chip label={t.status} size="small"
                          sx={{ height: 16, fontSize: 9, ml: 0.5,
                            bgcolor: t.status === 'ACTIVE' ? alpha('#2E7D32', 0.12) : alpha('#C2410C', 0.12),
                            color: t.status === 'ACTIVE' ? '#2E7D32' : '#92400E',
                          }} />
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <ToggleButtonGroup
                value={period}
                exclusive
                onChange={(_, v) => v && setPeriod(v)}
                size="small"
              >
                {PERIOD_OPTIONS.map(opt => (
                  <ToggleButton key={opt.value} value={opt.value}
                    sx={{ px: 2, fontWeight: 600, fontSize: 12.5 }}>
                    {opt.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </Stack>
        </Box>
      </Card>

      {noTenantSelected ? (
        <Card sx={{ borderRadius: 2 }}>
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <AssessmentIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" fontWeight={600}>No Tenant Selected</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Choose an ISP tenant from the dropdown above to view its activity report.
            </Typography>
          </Box>
        </Card>
      ) : (
        <Stack spacing={3}>

          {/* ── KPI Cards ─────────────────────────────────────────────────── */}
          <Grid container spacing={2}>
            {[
              {
                title: 'Total DNS Queries',
                value: overview?.totalQueries ?? 0,
                icon: <DnsIcon fontSize="small" />,
                color: '#1565C0',
                sub: `${period === 'today' ? 'Today' : `Last ${days} days`}`,
                delay: 0,
              },
              {
                title: 'Blocked Queries',
                value: overview?.blockedQueries ?? 0,
                icon: <BlockIcon fontSize="small" />,
                color: '#C62828',
                sub: `${overview?.allowedQueries?.toLocaleString() ?? '—'} allowed`,
                delay: 0.05,
              },
              {
                title: 'Block Rate',
                value: blockRate,
                icon: <PercentIcon fontSize="small" />,
                color: '#C2410C',
                sub: overview?.totalQueries ? `of ${fmt(overview.totalQueries)} total` : 'queries',
                delay: 0.1,
              },
              {
                title: 'Active Customers',
                value: activeCustomers ?? overview?.activeCustomers ?? 0,
                icon: <PeopleIcon fontSize="small" />,
                color: '#2E7D32',
                sub: 'registered under this ISP',
                delay: 0.15,
              },
            ].map(kpi => (
              <Grid key={kpi.title} size={{ xs: 12, sm: 6, md: 3 }}>
                <KpiCard
                  title={kpi.title}
                  value={kpi.value}
                  icon={kpi.icon}
                  color={kpi.color}
                  sub={kpi.sub}
                  loading={overviewLoading}
                  delay={kpi.delay}
                />
              </Grid>
            ))}
          </Grid>

          {/* ── Daily Trend Chart ──────────────────────────────────────────── */}
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <SectionHeader icon={<TrendingUpIcon />} title={`Daily DNS Activity — Last ${days} Days`} />
              {dailyLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : !dailyData?.length ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography color="text.secondary" variant="body2">No daily data available for this period.</Typography>
                </Box>
              ) : (
                <Box sx={{ height: 260, mt: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1565C0" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#1565C0" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradBlocked" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#C62828" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#C62828" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.6)} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        tickFormatter={d => {
                          const dt = new Date(d);
                          return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                        }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        tickFormatter={fmt}
                        tickLine={false}
                        axisLine={false}
                        width={50}
                      />
                      <ReTooltip
                        contentStyle={{
                          background: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value: number, name: string) => [
                          value.toLocaleString(),
                          name === 'totalQueries' ? 'Total' : name === 'blockedQueries' ? 'Blocked' : 'Allowed',
                        ]}
                        labelFormatter={l => `Date: ${new Date(l).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                      />
                      <Area type="monotone" dataKey="totalQueries" stroke="#1565C0" strokeWidth={2}
                        fill="url(#gradTotal)" dot={false} />
                      <Area type="monotone" dataKey="blockedQueries" stroke="#C62828" strokeWidth={2}
                        fill="url(#gradBlocked)" dot={false} strokeDasharray="4 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              )}
              <Stack direction="row" spacing={2.5} justifyContent="center" sx={{ mt: 1 }}>
                {[
                  { color: '#1565C0', label: 'Total Queries' },
                  { color: '#C62828', label: 'Blocked Queries', dashed: true },
                ].map(item => (
                  <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 24, height: 2, bgcolor: item.color, opacity: 0.9,
                      borderRadius: 1, borderTop: item.dashed ? `2px dashed ${item.color}` : undefined,
                    }} />
                    <Typography variant="caption" color="text.secondary" fontSize={11}>{item.label}</Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          {/* ── Top Blocked Domains + Category Breakdown ───────────────────── */}
          <Grid container spacing={2.5}>
            {/* Top Blocked Domains */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Card sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <SectionHeader icon={<BlockIcon />} title="Top Blocked Domains" />
                  {domainsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : !domainsRows.length ? (
                    <Box sx={{ textAlign: 'center', py: 5 }}>
                      <Typography color="text.secondary" variant="body2">No blocked domain data available.</Typography>
                    </Box>
                  ) : (
                    <>
                      <TableContainer component={Paper} elevation={0}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              {['#', 'Domain', 'Category', 'Count'].map(h => (
                                <TableCell key={h} sx={{
                                  fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                                  letterSpacing: 0.8, color: 'text.secondary', bgcolor: 'grey.50',
                                  borderBottom: '2px solid', borderColor: 'divider',
                                  ...(h === '#' ? { width: 36 } : {}),
                                  ...(h === 'Count' ? { textAlign: 'right' } : {}),
                                }}>
                                  {h}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {visibleDomains.map((row, idx) => {
                              const rank = domainsPage * 10 + idx + 1;
                              return (
                                <TableRow key={row.domain} hover
                                  sx={{ '&:last-child td': { border: 0 } }}>
                                  <TableCell sx={{ width: 36, color: 'text.disabled', fontWeight: 700, fontSize: 12 }}>
                                    {rank}
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" fontSize={12.5} fontWeight={500}
                                      fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                                      {row.domain}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    {row.category ? (
                                      <Chip label={row.category} size="small" variant="outlined"
                                        sx={{ height: 20, fontSize: 10, borderColor: alpha('#1565C0', 0.4), color: '#1565C0' }} />
                                    ) : (
                                      <Typography variant="caption" color="text.disabled">—</Typography>
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ textAlign: 'right' }}>
                                    <Typography variant="body2" fontSize={12.5} fontWeight={700} color="error.main">
                                      {row.count.toLocaleString()}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <TablePagination
                        component="div"
                        count={domainsRows.length}
                        page={domainsPage}
                        onPageChange={(_, p) => setDomainsPage(p)}
                        rowsPerPage={10}
                        rowsPerPageOptions={[10]}
                        sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 0.5 }}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Category Breakdown */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <SectionHeader icon={<CategoryIcon />} title="Category Breakdown" />
                  {catsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : !catRows.length ? (
                    <Box sx={{ textAlign: 'center', py: 5 }}>
                      <Typography color="text.secondary" variant="body2">No category data available.</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ height: 320, mt: 0.5 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={catRows}
                          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false}
                            stroke={alpha(theme.palette.divider, 0.5)} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
                            tickFormatter={fmt} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="category" width={90}
                            tick={{ fontSize: 10.5, fill: theme.palette.text.secondary }}
                            tickLine={false} axisLine={false}
                            tickFormatter={v => v.length > 13 ? v.slice(0, 12) + '…' : v} />
                          <ReTooltip
                            contentStyle={{
                              background: theme.palette.background.paper,
                              border: `1px solid ${theme.palette.divider}`,
                              borderRadius: 8, fontSize: 12,
                            }}
                            formatter={(v: number) => [v.toLocaleString(), 'Queries']}
                          />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
                            {catRows.map((_, i) => (
                              <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* ── Hourly Heatmap ─────────────────────────────────────────────── */}
          <HourlyHeatmap data={hourlyData ?? []} loading={hourlyLoading} />

          {/* ── Recent Audit Log ───────────────────────────────────────────── */}
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>
                    <HistoryIcon />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={700}>Recent Audit Log</Typography>
                  {auditTotal > 0 && (
                    <Chip label={`${auditTotal.toLocaleString()} events`} size="small"
                      sx={{ height: 20, fontSize: 10, bgcolor: alpha('#1565C0', 0.1), color: '#1565C0' }} />
                  )}
                </Box>
              </Box>

              {auditLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : !auditEntries.length ? (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                  <HistoryIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary" variant="body2">No audit log entries for this tenant.</Typography>
                </Box>
              ) : (
                <>
                  <TableContainer component={Paper} elevation={0}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {['Time', 'Action', 'User', 'Resource', 'IP'].map(h => (
                            <TableCell key={h} sx={{
                              fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                              letterSpacing: 0.8, color: 'text.secondary', bgcolor: 'grey.50',
                              borderBottom: '2px solid', borderColor: 'divider',
                            }}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {auditEntries.map(entry => (
                          <TableRow key={entry.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                            <TableCell sx={{ whiteSpace: 'nowrap', width: 130 }}>
                              <Typography variant="caption" fontSize={11} color="text.secondary">
                                {formatTime(entry.createdAt)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ width: 180 }}>
                              <Chip label={entry.action} size="small"
                                sx={{
                                  height: 20, fontSize: 10, fontWeight: 700,
                                  bgcolor: alpha('#1565C0', 0.1), color: '#1565C0',
                                  maxWidth: 160, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                                }} />
                            </TableCell>
                            <TableCell sx={{ width: 140 }}>
                              {entry.userName ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: 'primary.main' }}>
                                    {entry.userName[0]?.toUpperCase()}
                                  </Avatar>
                                  <Typography variant="body2" fontSize={12} noWrap sx={{ maxWidth: 100 }}>
                                    {entry.userName}
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography variant="caption" color="text.disabled">System</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {entry.resourceType ? (
                                <Box>
                                  <Typography variant="body2" fontSize={12} fontWeight={600}>
                                    {entry.resourceType}
                                  </Typography>
                                  {entry.resourceId && (
                                    <Typography variant="caption" color="text.secondary" fontFamily="monospace" fontSize={10}>
                                      #{entry.resourceId.substring(0, 8)}…
                                    </Typography>
                                  )}
                                </Box>
                              ) : (
                                <Typography variant="caption" color="text.disabled">—</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ width: 110 }}>
                              <Typography variant="caption" fontFamily="monospace" fontSize={11} color="text.secondary">
                                {formatIp(entry.ipAddress ?? '')}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={auditTotal}
                    page={auditPage}
                    onPageChange={(_, p) => setAuditPage(p)}
                    rowsPerPage={auditSize}
                    rowsPerPageOptions={[20]}
                    sx={{ borderTop: '1px solid', borderColor: 'divider' }}
                  />
                </>
              )}
            </CardContent>
          </Card>

        </Stack>
      )}
    </AnimatedPage>
  );
}
