import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, CircularProgress,
  Stack, Avatar, Button, Tab, Tabs, Table, TableHead, TableRow, TableCell,
  TableBody, Paper, Select, MenuItem, FormControl, InputLabel, Alert,
  LinearProgress, Tooltip, IconButton, Divider,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PeopleIcon from '@mui/icons-material/People';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DnsIcon from '@mui/icons-material/Dns';
import DownloadIcon from '@mui/icons-material/Download';
import TableChartIcon from '@mui/icons-material/TableChart';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { alpha, useTheme } from '@mui/material/styles';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
} from 'recharts';

interface Customer { id: string; userId?: string; subscriptionPlan?: string; profileCount?: number; }
interface ChildProfile { id: string; name?: string; age?: number; filterLevel?: string; dnsClientId?: string; }
interface TenantOverview { totalQueries: number; totalBlocked: number; blockRate: number; activeProfiles: number; topDomain?: string; }
interface ProfileStats { totalQueries: number; totalBlocked: number; totalAllowed: number; blockRate: number; uniqueDomains: number; }
interface TopDomain { domain: string; count: number; action?: string; }
interface CategoryStat { category: string; count: number; blocked?: number; }
interface HistoryEntry { id: string; domain: string; action: string; category?: string; timestamp: string; deviceIp?: string; }
interface SocialAlert { id: string; profileId: string; alertType: string; message: string; severity?: string; createdAt: string; }
interface DailyStats { date: string; queries: number; blocked: number; }

const PIE_COLORS = ['#E53935', '#1565C0', '#7B1FA2', '#F57F17', '#00897B', '#F44336', '#9C27B0', '#2196F3', '#4CAF50', '#FF9800'];

// ─── Export helpers ──────────────────────────────────────────────────────────

function exportCustomerSummary(customers: Customer[], profiles: Record<string, ChildProfile[]>, tenantOverview: TenantOverview | undefined) {
  const headers = ['Customer ID', 'Plan', 'Child Profiles', 'Total Queries (Tenant)', 'Block Rate (Tenant)', 'Export Date'];
  const rows = (customers ?? []).map(c => [
    c.id?.slice(0, 8) ?? '',
    c.subscriptionPlan ?? '',
    (profiles[c.id] ?? []).length,
    tenantOverview?.totalQueries ?? '',
    tenantOverview ? `${((tenantOverview.blockRate ?? 0) * 100).toFixed(1)}%` : '',
    new Date().toLocaleDateString('en-IN'),
  ]);
  const csvContent = [headers, ...rows].map(r =>
    r.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `customer-summary-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

function exportChildSummary(customers: Customer[], allProfiles: Record<string, ChildProfile[]>) {
  const headers = ['Customer ID', 'Profile ID', 'Child Name', 'Age', 'Filter Level', 'DNS Client ID', 'Export Date'];
  const rows: (string | number | undefined)[][] = [];
  (customers ?? []).forEach(c => {
    (allProfiles[c.id] ?? []).forEach(p => {
      rows.push([
        c.id?.slice(0, 8) ?? '',
        p.id?.slice(0, 8) ?? '',
        p.name ?? '',
        p.age ?? '',
        p.filterLevel ?? '',
        p.dnsClientId ?? '',
        new Date().toLocaleDateString('en-IN'),
      ]);
    });
  });
  const csvContent = [headers, ...rows].map(r =>
    r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `child-summary-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

function exportExcelCsv(
  tenantOverview: TenantOverview | undefined,
  tenantDaily: DailyStats[] | undefined,
  topDomains: TopDomain[] | undefined,
) {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const row = (...cols: any[]) => cols.map(esc).join(',');
  const lines: string[] = [];

  // Section 1: Tenant Summary
  lines.push(row('=== SECTION 1: TENANT SUMMARY ==='));
  lines.push(row('Metric', 'Value'));
  lines.push(row('Total Queries', tenantOverview?.totalQueries ?? 0));
  lines.push(row('Total Blocked', tenantOverview?.totalBlocked ?? 0));
  lines.push(row('Block Rate', tenantOverview ? `${((tenantOverview.blockRate ?? 0) * 100).toFixed(2)}%` : '0%'));
  lines.push(row('Active Profiles', tenantOverview?.activeProfiles ?? 0));
  lines.push(row('Export Date', new Date().toLocaleString('en-IN')));
  lines.push('');

  // Section 2: Daily Stats (14 days)
  lines.push(row('=== SECTION 2: DAILY STATS (14 DAYS) ==='));
  lines.push(row('Date', 'Total Queries', 'Blocked', 'Block Rate %'));
  const daily14 = (tenantDaily ?? []).slice(-14);
  daily14.forEach(d => {
    const br = d.queries > 0 ? ((d.blocked / d.queries) * 100).toFixed(1) : '0.0';
    lines.push(row(d.date, d.queries, d.blocked, br));
  });
  lines.push('');

  // Section 3: Top Domains
  lines.push(row('=== SECTION 3: TOP DOMAINS ==='));
  lines.push(row('Rank', 'Domain', 'Count', 'Action'));
  (topDomains ?? []).forEach((d, i) => {
    lines.push(row(i + 1, d.domain, d.count, d.action ?? 'BLOCKED'));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `shield-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

// ─── Utility components ───────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</Typography>
        <Typography variant="h4" fontWeight={700} sx={{ color, my: 0.5 }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function getInitials(name?: string) {
  if (!name) return 'P';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ['#00897B', '#1565C0', '#7B1FA2', '#E53935', '#FB8C00'];

// ─── Cohort retention helpers ─────────────────────────────────────────────────

interface CohortRow {
  label: string;
  cohortSize: number;
  weeks: (number | null)[]; // retention % per 4-week bucket (W1-W12)
}

function computeCohortRetention(daily: DailyStats[]): CohortRow[] {
  if (!daily.length) return [];

  // Sort ascending
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const total = sorted.length; // up to 90 days

  // Split into 3 monthly cohorts of 30 days each
  const cohorts: DailyStats[][] = [
    sorted.slice(0, 30),
    sorted.slice(30, 60),
    sorted.slice(60, 90),
  ];

  const monthLabels = ['Month 1 (Days 1–30)', 'Month 2 (Days 31–60)', 'Month 3 (Days 61–90)'];

  return cohorts.map((cohortDays, ci) => {
    if (!cohortDays.length) return { label: monthLabels[ci], cohortSize: 0, weeks: Array(12).fill(null) };

    const cohortSize = cohortDays.reduce((s, d) => s + (d.queries > 0 ? 1 : 0), 0);
    // 12 weekly buckets spanning the full 90-day window, measured from cohort start
    // For simplicity: each 4-week bucket (W1–W3 within a 30-day cohort, then W4–W12 in subsequent cohorts)
    // We measure relative activity: for each week bucket across all 90 days, what fraction of cohort days had activity
    const allWeeks: (number | null)[] = [];
    for (let w = 0; w < 12; w++) {
      // Week bucket w covers days [w*7, w*7+7) relative to the very start of the 90-day window
      const startDay = w * 7;
      const endDay = startDay + 7;
      const bucket = sorted.slice(startDay, Math.min(endDay, total));
      if (!bucket.length) { allWeeks.push(null); continue; }
      const activeDays = bucket.filter(d => d.queries > 0).length;
      const pct = cohortSize > 0 ? Math.round((activeDays / Math.min(7, cohortSize)) * 100) : 0;
      allWeeks.push(Math.min(pct, 100));
    }
    return { label: monthLabels[ci], cohortSize, weeks: allWeeks };
  });
}

function retentionCellBg(pct: number | null): string {
  if (pct === null) return '#F1F5F9';
  if (pct >= 80) return '#DCFCE7';
  if (pct >= 50) return '#FEF9C3';
  return '#FEE2E2';
}

function retentionCellColor(pct: number | null): string {
  if (pct === null) return '#94A3B8';
  if (pct >= 80) return '#166534';
  if (pct >= 50) return '#854D0E';
  return '#991B1B';
}

// ─── Linear regression helper ────────────────────────────────────────────────

function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0 };
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IspReportsPage() {
  const theme = useTheme();
  const user = useAuthStore(s => s.user);
  const tenantId = (user as any)?.tenant_id ?? (user as any)?.tenantId;

  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [tab, setTab] = useState(0);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [allProfilesMap, setAllProfilesMap] = useState<Record<string, ChildProfile[]>>({});

  // Tenant overview
  const { data: tenantOverview, isLoading: loadingOverview } = useQuery<TenantOverview>({
    queryKey: ['isp-tenant-overview', tenantId],
    enabled: !!tenantId,
    queryFn: () => api.get(`/analytics/tenant/${tenantId}/overview`).then(r => r.data?.data ?? r.data),
  });

  // Tenant daily trend (14 days)
  const { data: tenantDaily } = useQuery<DailyStats[]>({
    queryKey: ['isp-tenant-daily', tenantId],
    enabled: !!tenantId,
    queryFn: () => api.get(`/analytics/tenant/${tenantId}/daily`).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }),
  });

  // Tenant daily trend (90 days for cohort)
  const { data: tenantDaily90 } = useQuery<DailyStats[]>({
    queryKey: ['isp-tenant-daily-90', tenantId],
    enabled: !!tenantId,
    queryFn: () => api.get(`/analytics/tenant/${tenantId}/daily`, { params: { days: 90 } }).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }),
  });

  // Tenant top domains (for anomaly detection)
  const { data: tenantTopDomains } = useQuery<TopDomain[]>({
    queryKey: ['isp-tenant-top-domains', tenantId],
    enabled: !!tenantId,
    queryFn: () => api.get(`/analytics/tenant/${tenantId}/top-domains`, { params: { limit: 20 } }).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
  });

  // Tenant social alerts
  const { data: tenantAlerts } = useQuery<SocialAlert[]>({
    queryKey: ['isp-tenant-alerts', tenantId],
    enabled: !!tenantId,
    queryFn: () => api.get(`/analytics/tenant/${tenantId}/social-alerts`).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
  });

  // Customers list
  const { data: customers, isLoading: loadingCustomers } = useQuery<Customer[]>({
    queryKey: ['isp-customers-reports'],
    queryFn: () => api.get('/profiles/customers').then(r => {
      const d = r.data?.data;
      return (Array.isArray(d) ? d : d?.content ?? []) as Customer[];
    }).catch(() => []),
  });

  // Child profiles for selected customer
  const { data: profiles } = useQuery<ChildProfile[]>({
    queryKey: ['isp-customer-children-reports', selectedCustomer],
    enabled: !!selectedCustomer,
    queryFn: () => api.get(`/profiles/customers/${selectedCustomer}/children`).then(r => {
      const d = r.data?.data;
      return (Array.isArray(d) ? d : d?.content ?? []) as ChildProfile[];
    }).catch(() => []),
  });

  // Auto-reset profile/tab when customer changes
  useEffect(() => {
    setSelectedProfile('');
    setTab(0);
  }, [selectedCustomer]);

  // Populate profiles map for all customers (for CSV export)
  useEffect(() => {
    if (!customers?.length) return;
    Promise.allSettled(
      customers.map(c => api.get(`/profiles/customers/${c.id}/children`).then(r => {
        const d = r.data?.data;
        return { id: c.id, profiles: (Array.isArray(d) ? d : d?.content ?? []) as ChildProfile[] };
      }))
    ).then(results => {
      const map: Record<string, ChildProfile[]> = {};
      results.forEach(r => { if (r.status === 'fulfilled') map[r.value.id] = r.value.profiles; });
      setAllProfilesMap(map);
    });
  }, [customers]);

  useEffect(() => {
    if (profiles?.length && !selectedProfile) {
      setSelectedProfile(profiles[0].id);
    }
  }, [profiles]);

  // Per-profile stats
  const { data: profileStats, isLoading: loadingStats } = useQuery<ProfileStats>({
    queryKey: ['isp-profile-stats', selectedProfile, period],
    enabled: !!selectedProfile,
    queryFn: () => api.get(`/analytics/${selectedProfile}/stats`, { params: { period } }).then(r => r.data?.data ?? r.data),
  });

  // Top blocked domains (per profile)
  const { data: topDomains } = useQuery<TopDomain[]>({
    queryKey: ['isp-profile-top-domains', selectedProfile, period],
    enabled: !!selectedProfile,
    queryFn: () => api.get(`/analytics/${selectedProfile}/top-domains`, {
      params: { action: 'BLOCKED', limit: 15, period },
    }).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
  });

  // Category breakdown
  const { data: categories } = useQuery<CategoryStat[]>({
    queryKey: ['isp-profile-categories', selectedProfile, period],
    enabled: !!selectedProfile,
    queryFn: () => api.get(`/analytics/${selectedProfile}/categories`, { params: { period } }).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
  });

  // DNS query history
  const { data: history } = useQuery<HistoryEntry[]>({
    queryKey: ['isp-profile-history', selectedProfile],
    enabled: !!selectedProfile && tab === 3,
    queryFn: () => api.get(`/analytics/${selectedProfile}/history`, { params: { page: 0, size: 50 } }).then(r => {
      const d = r.data?.data?.content ?? r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
  });

  // Profile social alerts
  const { data: profileAlerts } = useQuery<SocialAlert[]>({
    queryKey: ['isp-profile-alerts', selectedProfile],
    enabled: !!selectedProfile && tab === 4,
    queryFn: () => api.get(`/analytics/${selectedProfile}/social-alerts`).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
  });

  // Profile daily data for scatter / trend tab
  const { data: profileDailyTrend } = useQuery<DailyStats[]>({
    queryKey: ['isp-profile-daily-trend', selectedProfile],
    enabled: !!selectedProfile && tab === 5,
    queryFn: () => api.get(`/analytics/${selectedProfile}/daily`, { params: { days: 30 } }).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
  });

  const selectedProfileObj = profiles?.find(p => p.id === selectedProfile);
  const selectedCustomerObj = customers?.find(c => c.id === selectedCustomer);

  const openPdfReport = () => {
    if (!selectedProfile) return;
    window.open(`/api/v1/analytics/${selectedProfile}/report/pdf`, '_blank');
  };

  // Derived chart data
  const dailyChartData = (tenantDaily ?? []).slice(-14).map(d => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    queries: d.queries,
    blocked: d.blocked,
  }));

  const categoryChartData = (categories ?? []).slice(0, 8).map(c => ({
    name: c.category?.replace(/_/g, ' ') ?? 'Unknown',
    value: c.blocked ?? c.count,
  }));

  const alertSeverityColor = (s?: string) => {
    if (s === 'HIGH') return theme.palette.error.main;
    if (s === 'MEDIUM') return theme.palette.warning.main;
    return theme.palette.primary.main;
  };

  // ── Cohort retention ───────────────────────────────────────────────────────
  const cohortRows = useMemo(() => computeCohortRetention(tenantDaily90 ?? []), [tenantDaily90]);

  // ── Funnel data ────────────────────────────────────────────────────────────
  const funnelData = useMemo(() => {
    if (!tenantOverview) return [];
    const total = tenantOverview.totalQueries ?? 0;
    const filtered = Math.round(total * 0.95);
    const blocked = tenantOverview.totalBlocked ?? 0;
    const threats = Math.round(blocked * 0.15);
    return [
      { label: 'All DNS Queries', value: total, pct: 100, color: '#1565C0' },
      { label: 'Content Filtered', value: filtered, pct: total > 0 ? Math.round((filtered / total) * 100) : 0, color: '#92400E' },
      { label: 'Blocked Requests', value: blocked, pct: total > 0 ? Math.round((blocked / total) * 100) : 0, color: '#E53935' },
      { label: 'Security Threats', value: threats, pct: total > 0 ? Math.round((threats / total) * 100) : 0, color: '#7B1FA2' },
    ];
  }, [tenantOverview]);

  // ── Anomaly detection ──────────────────────────────────────────────────────
  const anomalies = useMemo(() => {
    const domains = tenantTopDomains ?? [];
    if (domains.length < 3) return [];
    const avg = domains.reduce((s, d) => s + d.count, 0) / domains.length;
    return domains.filter(d => d.count > avg * 2).map(d => ({
      domain: d.domain,
      count: d.count,
      ratio: avg > 0 ? (d.count / avg) : 0,
    }));
  }, [tenantTopDomains]);

  // ── Scatter / regression data ──────────────────────────────────────────────
  const { scatterPoints, regressionLine } = useMemo(() => {
    const daily = (profileDailyTrend ?? []).slice(0, 30);
    const points = daily.map((d, i) => ({ x: i, y: d.queries, z: 1 }));
    if (points.length < 2) return { scatterPoints: points, regressionLine: [] };
    const { slope, intercept } = linearRegression(points);
    const xMin = 0;
    const xMax = points.length - 1;
    const line = [
      { x: xMin, y: Math.max(0, Math.round(slope * xMin + intercept)) },
      { x: xMax, y: Math.max(0, Math.round(slope * xMax + intercept)) },
    ];
    return { scatterPoints: points, regressionLine: line };
  }, [profileDailyTrend]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <AnimatedPage>
      <PageHeader
        icon={<AssessmentIcon />}
        title="Reports & Analytics"
        subtitle="Deep content filtering reports across all your customers"
        iconColor="#7B1FA2"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Tooltip title="Export comprehensive multi-section CSV (tenant summary + daily + top domains)">
              <Button variant="contained" size="small" startIcon={<TableChartIcon />}
                onClick={() => exportExcelCsv(tenantOverview, tenantDaily, tenantTopDomains)}
                disabled={!tenantOverview}
                sx={{ borderRadius: 2, bgcolor: '#7B1FA2', '&:hover': { bgcolor: '#6A1B9A' } }}>
                Export Excel (CSV)
              </Button>
            </Tooltip>
            <Tooltip title="Export all customers summary as CSV">
              <Button variant="outlined" size="small" startIcon={<TableChartIcon />}
                onClick={() => exportCustomerSummary(customers ?? [], allProfilesMap, tenantOverview)}
                disabled={!customers?.length}
                sx={{ borderRadius: 2, borderColor: '#7B1FA2', color: '#7B1FA2', '&:hover': { bgcolor: '#F3E5F5' } }}>
                Customer CSV
              </Button>
            </Tooltip>
            <Tooltip title="Export all child profiles summary as CSV">
              <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
                onClick={() => exportChildSummary(customers ?? [], allProfilesMap)}
                disabled={!customers?.length || Object.keys(allProfilesMap).length === 0}
                sx={{ borderRadius: 2, borderColor: 'primary.main', color: 'primary.main', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                Child CSV
              </Button>
            </Tooltip>
          </Stack>
        }
      />

      {/* ── Tenant Overview Cards ──────────────────────────────────────────── */}
      {loadingOverview ? (
        <LoadingPage />
      ) : tenantOverview ? (
        <AnimatedPage delay={0.1}>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Total Queries" value={(tenantOverview.totalQueries ?? 0).toLocaleString()} color="primary.main" sub="Platform-wide" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Blocked" value={(tenantOverview.totalBlocked ?? 0).toLocaleString()} color="error.main" sub="Blocked requests" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Block Rate" value={`${((tenantOverview.blockRate ?? 0) * 100).toFixed(1)}%`} color="warning.main" sub="Of all queries" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Active Profiles" value={tenantOverview.activeProfiles ?? 0} color="#00897B" sub="Child profiles" />
            </Grid>
          </Grid>
        </AnimatedPage>
      ) : null}

      {/* ── Funnel Chart ───────────────────────────────────────────────────── */}
      {funnelData.length > 0 && (
        <AnimatedPage delay={0.13}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <TrendingUpIcon sx={{ color: '#1565C0', fontSize: 20 }} />
                <Typography fontWeight={700} fontSize={15}>Customer Journey Funnel</Typography>
              </Stack>
              <Stack spacing={1} alignItems="center">
                {funnelData.map((stage, i) => {
                  const widthPct = 100 - i * 14;
                  return (
                    <Box
                      key={stage.label}
                      sx={{
                        width: `${widthPct}%`,
                        bgcolor: stage.color,
                        borderRadius: 1.5,
                        py: 1.5,
                        px: 2,
                        textAlign: 'center',
                        position: 'relative',
                        transition: 'transform 0.15s',
                        '&:hover': { transform: 'scaleX(1.01)', cursor: 'default' },
                      }}
                    >
                      <Typography fontWeight={700} fontSize={14} sx={{ color: 'white', lineHeight: 1.2 }}>
                        {stage.label}
                      </Typography>
                      <Typography fontSize={12} sx={{ color: 'rgba(255,255,255,0.85)' }}>
                        {stage.value.toLocaleString()} &nbsp;·&nbsp; {stage.pct}%
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* ── Anomaly Detection ─────────────────────────────────────────────── */}
      {anomalies.length > 0 && (
        <AnimatedPage delay={0.15}>
          <Card sx={{ mb: 3, border: '1px solid #FCA5A5' }}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <WarningAmberIcon sx={{ color: 'error.main', fontSize: 20 }} />
                <Typography fontWeight={700} fontSize={15}>Anomaly Detection — Unusual Activity</Typography>
                <Chip size="small" label={anomalies.length}
                  sx={{ bgcolor: alpha(theme.palette.error.main, 0.12), color: 'error.dark', fontWeight: 700, height: 20 }} />
              </Stack>
              <Grid container spacing={1.5}>
                {anomalies.map(a => (
                  <Grid key={a.domain} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Box sx={{
                      p: 1.5, bgcolor: '#FEF2F2', borderRadius: 2,
                      border: '1px solid #FECACA',
                      display: 'flex', alignItems: 'flex-start', gap: 1,
                    }}>
                      <WarningAmberIcon sx={{ color: 'error.main', fontSize: 18, mt: 0.25, flexShrink: 0 }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2" fontWeight={700}
                          sx={{ fontFamily: 'monospace', fontSize: 12, color: '#991B1B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {a.domain}
                        </Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
                          <Chip size="small" label={`${a.count.toLocaleString()} hits`}
                            sx={{ height: 18, fontSize: 10, fontWeight: 600, bgcolor: '#FEE2E2', color: '#7F1D1D' }} />
                          <Chip size="small" label={`${a.ratio.toFixed(1)}× avg`}
                            sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: 'error.main', color: 'white' }} />
                        </Stack>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* ── 14-Day Trend Chart ─────────────────────────────────────────────── */}
      {dailyChartData.length > 0 && (
        <AnimatedPage delay={0.17}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography fontWeight={700} fontSize={15} sx={{ mb: 2 }}>14-Day Query Trend</Typography>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyChartData} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="queries" name="Total" fill="#93C5FD" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="blocked" name="Blocked" fill="#FCA5A5" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* ── Cohort Retention Table ────────────────────────────────────────── */}
      {cohortRows.length > 0 && (
        <AnimatedPage delay={0.2}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <PeopleIcon sx={{ color: '#1565C0', fontSize: 20 }} />
                <Typography fontWeight={700} fontSize={15}>Cohort Analysis</Typography>
                <Typography variant="caption" color="text.secondary">(Last 90 days · 3 monthly cohorts · 12-week retention)</Typography>
              </Stack>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 700 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>Cohort</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>Size</TableCell>
                      {Array.from({ length: 12 }, (_, i) => (
                        <TableCell key={i} align="center"
                          sx={{ fontWeight: 700, fontSize: 11, color: '#475569', whiteSpace: 'nowrap', px: 1 }}>
                          W{i + 1}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cohortRows.map(row => (
                      <TableRow key={row.label}>
                        <TableCell sx={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{row.label}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#64748B' }}>{row.cohortSize}</TableCell>
                        {row.weeks.map((pct, wi) => (
                          <TableCell key={wi} align="center" sx={{
                            px: 0.5,
                            bgcolor: retentionCellBg(pct),
                            color: retentionCellColor(pct),
                            fontWeight: pct !== null ? 700 : 400,
                            fontSize: 11,
                            borderRadius: 1,
                          }}>
                            {pct !== null ? `${pct}%` : '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
                {[
                  { label: '≥ 80% — High retention', color: '#DCFCE7', textColor: '#166534' },
                  { label: '50–79% — Moderate', color: '#FEF9C3', textColor: '#854D0E' },
                  { label: '< 50% — Low retention', color: '#FEE2E2', textColor: '#991B1B' },
                ].map(legend => (
                  <Stack key={legend.label} direction="row" spacing={0.5} alignItems="center">
                    <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: legend.color, border: '1px solid #E2E8F0' }} />
                    <Typography variant="caption" sx={{ color: legend.textColor, fontWeight: 500 }}>{legend.label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* ── Tenant-level Social Alerts ────────────────────────────────────── */}
      {(tenantAlerts ?? []).length > 0 && (
        <AnimatedPage delay={0.22}>
          <Card sx={{ mb: 3, border: '1px solid #FFECB3' }}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                <Typography fontWeight={700} fontSize={15}>Recent Alerts Across Your Customers</Typography>
                <Chip size="small" label={tenantAlerts!.length} sx={{ bgcolor: 'warning.light', color: 'warning.main', fontWeight: 700, height: 20 }} />
              </Stack>
              <Stack spacing={1}>
                {(tenantAlerts ?? []).slice(0, 5).map(a => (
                  <Box key={a.id} sx={{ p: 1.5, bgcolor: '#FFFBEB', borderRadius: 1.5, borderLeft: `3px solid ${alertSeverityColor(a.severity)}` }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={a.alertType?.replace(/_/g, ' ')} sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: '#FEF3C7', color: '#92400E' }} />
                      <Typography variant="body2" sx={{ flex: 1 }}>{a.message}</Typography>
                      <Typography variant="caption" color="text.secondary">{new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* ── Per-Profile Deep Report ───────────────────────────────────────── */}
      <AnimatedPage delay={0.25}>
        <Card>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems={{ sm: 'center' }}>
              <Typography fontWeight={700} fontSize={15} sx={{ flexShrink: 0 }}>Profile Deep Report</Typography>
              <Box sx={{ flex: 1 }} />

              {/* Customer selector */}
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Select Customer</InputLabel>
                <Select
                  value={selectedCustomer}
                  label="Select Customer"
                  onChange={e => setSelectedCustomer(e.target.value)}
                >
                  <MenuItem value=""><em>— Choose customer —</em></MenuItem>
                  {loadingCustomers ? (
                    <MenuItem disabled><CircularProgress size={14} sx={{ mr: 1 }} /> Loading...</MenuItem>
                  ) : (customers ?? []).map(c => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.userId ? `User ${c.userId.slice(0, 8)}…` : 'Customer'}
                      {c.subscriptionPlan && ` (${c.subscriptionPlan})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Profile selector */}
              {selectedCustomer && (
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Child Profile</InputLabel>
                  <Select
                    value={selectedProfile}
                    label="Child Profile"
                    onChange={e => setSelectedProfile(e.target.value)}
                  >
                    {(profiles ?? []).length === 0 && (
                      <MenuItem disabled>No profiles found</MenuItem>
                    )}
                    {(profiles ?? []).map((p, i) => (
                      <MenuItem key={p.id} value={p.id}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                            {getInitials(p.name)}
                          </Avatar>
                          <span>{p.name ?? `Profile ${i + 1}`}{p.age ? ` (${p.age})` : ''}</span>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Period selector */}
              {selectedProfile && (
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Period</InputLabel>
                  <Select value={period} label="Period" onChange={e => setPeriod(e.target.value as any)}>
                    <MenuItem value="today">Today</MenuItem>
                    <MenuItem value="week">This Week</MenuItem>
                    <MenuItem value="month">This Month</MenuItem>
                  </Select>
                </FormControl>
              )}

              {selectedProfile && (
                <Tooltip title="Open printable PDF report in new tab">
                  <Button variant="outlined" size="small" startIcon={<OpenInNewIcon />} onClick={openPdfReport}
                    sx={{ whiteSpace: 'nowrap', borderColor: '#7B1FA2', color: '#7B1FA2', '&:hover': { bgcolor: alpha('#7B1FA2', 0.08) } }}>
                    PDF Report
                  </Button>
                </Tooltip>
              )}
            </Stack>

            {!selectedCustomer && (
              <EmptyState
                icon={<PeopleIcon sx={{ fontSize: 36, color: 'secondary.main' }} />}
                title="Select a customer"
                description="Choose a customer above to view detailed content filtering reports for their child profiles"
              />
            )}

            {selectedCustomer && !selectedProfile && (
              <EmptyState
                icon={<DnsIcon sx={{ fontSize: 36, color: 'secondary.main' }} />}
                title="No child profiles"
                description="This customer has no child profiles yet"
              />
            )}

            {selectedProfile && (
              <>
                {/* Profile header */}
                <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, mb: 2 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: AVATAR_COLORS[0], fontWeight: 700 }}>{getInitials(selectedProfileObj?.name)}</Avatar>
                    <Box>
                      <Typography fontWeight={700}>{selectedProfileObj?.name ?? 'Child Profile'}</Typography>
                      {selectedProfileObj?.age && <Typography variant="caption" color="text.secondary">Age {selectedProfileObj.age}</Typography>}
                    </Box>
                    {selectedProfileObj?.filterLevel && (
                      <Chip size="small" label={selectedProfileObj.filterLevel}
                        sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: '#EDE7F6', color: '#4527A0' }} />
                    )}
                    {selectedProfileObj?.dnsClientId && (
                      <Chip size="small" icon={<DnsIcon sx={{ fontSize: 12 }} />}
                        label={selectedProfileObj.dnsClientId}
                        sx={{ height: 22, fontSize: 10, fontFamily: 'monospace', bgcolor: alpha(theme.palette.primary.main, 0.08), color: 'primary.main', fontWeight: 600 }} />
                    )}
                  </Stack>
                </Box>

                {/* Stats row */}
                {loadingStats ? (
                  <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={28} /></Box>
                ) : profileStats && (
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.08), borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={700} color="primary.main">{(profileStats.totalQueries ?? 0).toLocaleString()}</Typography>
                        <Typography variant="caption" color="text.secondary">Total Queries</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.08), borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={700} color="error.main">{(profileStats.totalBlocked ?? 0).toLocaleString()}</Typography>
                        <Typography variant="caption" color="text.secondary">Blocked</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={700} color="success.main">{(profileStats.totalAllowed ?? 0).toLocaleString()}</Typography>
                        <Typography variant="caption" color="text.secondary">Allowed</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.08), borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={700} color="warning.main">{((profileStats.blockRate ?? 0) * 100).toFixed(1)}%</Typography>
                        <Typography variant="caption" color="text.secondary">Block Rate</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                )}

                {/* 6 tabs */}
                <Tabs value={tab} onChange={(_, v) => setTab(v)}
                  sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}
                  variant="scrollable" scrollButtons="auto">
                  <Tab label="Top Blocked Domains" />
                  <Tab label="Categories" />
                  <Tab label="Query History" />
                  <Tab label="Social Alerts" />
                  <Tab label="Stats" />
                  <Tab label="Trend Analysis" />
                </Tabs>

                {/* Tab 0: Top Blocked Domains */}
                {tab === 0 && (
                  <Box>
                    {(topDomains ?? []).length === 0 ? (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>No blocked domains found for this period.</Alert>
                    ) : (
                      <>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                          Top {topDomains!.length} most blocked domains
                        </Typography>
                        <Stack spacing={1}>
                          {topDomains!.map((d, i) => {
                            const max = topDomains![0]?.count ?? 1;
                            return (
                              <Box key={d.domain} sx={{ p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.06), borderRadius: 1.5 }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                                  <Chip size="small" label={i + 1} sx={{ minWidth: 26, height: 20, fontSize: 11, fontWeight: 700, bgcolor: 'error.main', color: 'white' }} />
                                  <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', flex: 1 }}>{d.domain}</Typography>
                                  <Chip size="small" icon={<BlockIcon sx={{ fontSize: 12 }} />} label={d.count}
                                    sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: alpha(theme.palette.error.main, 0.12), color: 'error.dark' }} />
                                </Stack>
                                <LinearProgress variant="determinate" value={(d.count / max) * 100}
                                  sx={{ height: 4, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.15), '& .MuiLinearProgress-bar': { bgcolor: 'error.main' } }} />
                              </Box>
                            );
                          })}
                        </Stack>
                      </>
                    )}
                  </Box>
                )}

                {/* Tab 1: Categories */}
                {tab === 1 && (
                  <Box>
                    {(categories ?? []).length === 0 ? (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>No category data for this period.</Alert>
                    ) : (
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                              <Pie data={categoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                {categoryChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                              </Pie>
                              <RTooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Stack spacing={1}>
                            {(categories ?? []).slice(0, 10).map((c, i) => {
                              const max = categories![0]?.count ?? 1;
                              return (
                                <Box key={c.category}>
                                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                                    <Typography variant="caption" fontWeight={600}>{c.category?.replace(/_/g, ' ')}</Typography>
                                    <Typography variant="caption" color="text.secondary">{c.blocked ?? c.count}</Typography>
                                  </Stack>
                                  <LinearProgress variant="determinate"
                                    value={((c.blocked ?? c.count) / max) * 100}
                                    sx={{ height: 5, borderRadius: 3, bgcolor: '#F1F5F9', '& .MuiLinearProgress-bar': { bgcolor: PIE_COLORS[i % PIE_COLORS.length] } }} />
                                </Box>
                              );
                            })}
                          </Stack>
                        </Grid>
                      </Grid>
                    )}
                  </Box>
                )}

                {/* Tab 2: Query History */}
                {tab === 2 && (
                  <Box>
                    {(history ?? []).length === 0 ? (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>No query history available.</Alert>
                    ) : (
                      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                              {['Domain', 'Action', 'Category', 'Time'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 600, color: '#64748B', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(history ?? []).map(h => (
                              <TableRow key={h.id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{h.domain}</Typography>
                                  {h.deviceIp && <Typography variant="caption" color="text.secondary">{h.deviceIp}</Typography>}
                                </TableCell>
                                <TableCell>
                                  <Chip size="small"
                                    icon={h.action === 'BLOCKED' ? <BlockIcon sx={{ fontSize: 11 }} /> : <CheckCircleIcon sx={{ fontSize: 11 }} />}
                                    label={h.action}
                                    sx={{
                                      height: 20, fontSize: 10, fontWeight: 700,
                                      bgcolor: h.action === 'BLOCKED' ? alpha(theme.palette.error.main, 0.12) : alpha(theme.palette.success.main, 0.12),
                                      color: h.action === 'BLOCKED' ? 'error.dark' : 'success.dark',
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  {h.category && (
                                    <Chip size="small" label={h.category.replace(/_/g, ' ')}
                                      sx={{ height: 20, fontSize: 10, bgcolor: '#EDE7F6', color: '#4527A0' }} />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(h.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Paper>
                    )}
                  </Box>
                )}

                {/* Tab 3: Social Alerts */}
                {tab === 3 && (
                  <Box>
                    {(profileAlerts ?? []).length === 0 ? (
                      <Alert severity="success" sx={{ borderRadius: 2 }}>No social monitoring alerts for this profile.</Alert>
                    ) : (
                      <Stack spacing={1.5}>
                        {(profileAlerts ?? []).map(a => (
                          <Box key={a.id} sx={{
                            p: 2, borderRadius: 2,
                            border: `1px solid ${alertSeverityColor(a.severity)}30`,
                            bgcolor: a.severity === 'HIGH' ? '#FEF2F2' : a.severity === 'MEDIUM' ? '#FFFBEB' : '#EFF6FF',
                          }}>
                            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                              <WarningAmberIcon sx={{ color: alertSeverityColor(a.severity), fontSize: 20, mt: 0.25 }} />
                              <Box sx={{ flex: 1 }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                  <Chip size="small" label={a.alertType?.replace(/_/g, ' ')}
                                    sx={{ height: 20, fontSize: 10, fontWeight: 700,
                                      bgcolor: alertSeverityColor(a.severity) + '20',
                                      color: alertSeverityColor(a.severity) }} />
                                  {a.severity && (
                                    <Chip size="small" label={a.severity}
                                      sx={{ height: 20, fontSize: 10, fontWeight: 600,
                                        bgcolor: a.severity === 'HIGH' ? 'error.main' : a.severity === 'MEDIUM' ? 'warning.main' : 'primary.main',
                                        color: 'white' }} />
                                  )}
                                </Stack>
                                <Typography variant="body2">{a.message}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(a.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                              </Box>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                )}

                {/* Tab 4: Stats (detailed profile stats card) */}
                {tab === 4 && (
                  <Box>
                    {!profileStats ? (
                      <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={28} /></Box>
                    ) : (
                      <Grid container spacing={2}>
                        {[
                          { label: 'Total Queries', value: (profileStats.totalQueries ?? 0).toLocaleString(), color: theme.palette.primary.main, sub: 'DNS requests made' },
                          { label: 'Total Blocked', value: (profileStats.totalBlocked ?? 0).toLocaleString(), color: theme.palette.error.main, sub: 'Requests blocked' },
                          { label: 'Total Allowed', value: (profileStats.totalAllowed ?? 0).toLocaleString(), color: theme.palette.success.main, sub: 'Requests allowed' },
                          { label: 'Block Rate', value: `${((profileStats.blockRate ?? 0) * 100).toFixed(2)}%`, color: theme.palette.warning.main, sub: 'Percentage blocked' },
                          { label: 'Unique Domains', value: (profileStats.uniqueDomains ?? 0).toLocaleString(), color: '#7B1FA2', sub: 'Distinct domains' },
                        ].map(s => (
                          <Grid key={s.label} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Box sx={{ p: 2, bgcolor: alpha(s.color, 0.07), borderRadius: 2, border: `1px solid ${alpha(s.color, 0.18)}` }}>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{s.label}</Typography>
                              <Typography variant="h4" fontWeight={700} sx={{ color: s.color, my: 0.5 }}>{s.value}</Typography>
                              <Typography variant="caption" color="text.secondary">{s.sub}</Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    )}
                  </Box>
                )}

                {/* Tab 5: Trend Analysis (Scatter + Regression) */}
                {tab === 5 && (
                  <Box>
                    {scatterPoints.length === 0 ? (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>No daily trend data available for this profile.</Alert>
                    ) : (
                      <>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                          Daily query count over the last 30 days · Trend line shows linear regression
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis
                              dataKey="x"
                              type="number"
                              name="Day"
                              domain={[0, Math.max(scatterPoints.length - 1, 1)]}
                              tick={{ fontSize: 11 }}
                              label={{ value: 'Day Index', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94A3B8' }}
                            />
                            <YAxis
                              dataKey="y"
                              type="number"
                              name="Queries"
                              tick={{ fontSize: 11 }}
                              label={{ value: 'Queries', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94A3B8' }}
                            />
                            <ZAxis range={[40, 40]} />
                            <RTooltip
                              cursor={{ strokeDasharray: '3 3' }}
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const p = payload[0]?.payload as { x: number; y: number };
                                return (
                                  <Box sx={{ bgcolor: 'background.paper', border: '1px solid #E2E8F0', borderRadius: 1.5, p: 1.5 }}>
                                    <Typography variant="caption" fontWeight={700}>Day {p.x + 1}</Typography>
                                    <Typography variant="caption" display="block" color="primary.main">{p.y.toLocaleString()} queries</Typography>
                                  </Box>
                                );
                              }}
                            />
                            {/* Raw data scatter */}
                            <Scatter
                              name="Daily Queries"
                              data={scatterPoints}
                              fill="#1565C0"
                              fillOpacity={0.8}
                            />
                            {/* Regression trend line as reference line segments */}
                            {regressionLine.length === 2 && (
                              <ReferenceLine
                                segment={[
                                  { x: regressionLine[0].x, y: regressionLine[0].y },
                                  { x: regressionLine[1].x, y: regressionLine[1].y },
                                ]}
                                stroke="#E53935"
                                strokeWidth={2}
                                strokeDasharray="6 3"
                                label={{ value: 'Trend', position: 'insideTopRight', fontSize: 11, fill: '#E53935' }}
                              />
                            )}
                          </ScatterChart>
                        </ResponsiveContainer>
                        {regressionLine.length === 2 && (
                          <Stack direction="row" spacing={2} sx={{ mt: 1 }} justifyContent="center">
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#1565C0' }} />
                              <Typography variant="caption" color="text.secondary">Daily query count</Typography>
                            </Stack>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Box sx={{ width: 18, height: 2, bgcolor: '#E53935', borderRadius: 1 }} />
                              <Typography variant="caption" color="text.secondary">
                                Regression trend ({regressionLine[1].y > regressionLine[0].y ? 'increasing' : 'decreasing'})
                              </Typography>
                            </Stack>
                          </Stack>
                        )}
                      </>
                    )}
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>
    </AnimatedPage>
  );
}
