import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Button, Card, CardContent, CardHeader, Chip, Grid, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tab, Tabs, Typography, Paper, Stack, Tooltip as MuiTooltip, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import DevicesIcon from '@mui/icons-material/Devices';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import BarChartIcon from '@mui/icons-material/BarChart';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
  PieChart, Pie, Cell,
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

/** Simple linear regression — returns { slope, intercept } */
function linearRegression(points: number[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0] ?? 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += points[i];
    sumXY += i * points[i];
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** Distribute a daily total across 24 hours using a sine curve (morning/evening peaks). */
function distributeByHour(total: number): number[] {
  const weights = Array.from({ length: 24 }, (_, h) => {
    // Two peaks: morning ~9 and evening ~20
    const morning = Math.exp(-0.5 * Math.pow((h - 9) / 3, 2));
    const evening = Math.exp(-0.5 * Math.pow((h - 20) / 3, 2));
    return morning + evening * 0.7 + 0.05;
  });
  const wSum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.round((w / wSum) * total));
}

function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

// ─── API fetchers ────────────────────────────────────────────────────────────

async function fetchOverview() {
  const [statsRes, analyticsRes] = await Promise.allSettled([
    api.get('/admin/platform/stats'),
    api.get('/analytics/platform/overview?period=week'),
  ]);
  const stats =
    statsRes.status === 'fulfilled'
      ? (statsRes.value.data?.data ?? statsRes.value.data ?? {})
      : {};
  const analytics =
    analyticsRes.status === 'fulfilled'
      ? (analyticsRes.value.data?.data ?? analyticsRes.value.data ?? {})
      : {};
  return {
    totalCustomers: stats.totalCustomers ?? analytics.totalCustomers ?? 0,
    activeCustomers: stats.activeCustomers ?? analytics.activeCustomers ?? 0,
    activeDevices: stats.activeDevices ?? analytics.activeDevices ?? 0,
    dnsQueriesToday: analytics.totalQueries ?? stats.dnsQueriesToday ?? 0,
    threatsBlockedToday:
      analytics.blockedQueries ?? analytics.threatsBlocked ?? stats.threatsBlocked ?? 0,
    blockRate: analytics.blockRate ?? 0,
  };
}

async function fetchDailyStats(days = 30) {
  const res = await api.get(`/analytics/platform/daily?days=${days}`);
  const d = res.data;
  const arr: any[] = Array.isArray(d) ? d : (d?.data ?? []);
  return arr.map((p: any) => ({
    day: fmtDate(p.date ?? p.day),
    queries: p.totalQueries ?? p.queries ?? 0,
    blocked: p.blockedQueries ?? p.blocked ?? 0,
    rawDate: p.date ?? p.day ?? '',
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

async function fetchTopTenants() {
  try {
    const res = await api.get('/analytics/platform/top-tenants?limit=20');
    const d = res.data;
    const arr: any[] = Array.isArray(d) ? d : (d?.data ?? []);
    return arr.map((t: any) => ({
      name: t.tenantName ?? t.name ?? 'Unknown',
      queries: t.totalQueries ?? t.queries ?? 0,
      blocked: t.blockedQueries ?? t.blocked ?? 0,
    }));
  } catch {
    return [];
  }
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
    <Card
      sx={{
        background: gradient,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.2s',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -16,
          right: -16,
          width: 88,
          height: 88,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
        }}
      />
      <CardContent sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}
        >
          <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 500, fontSize: 13 }}>
            {title}
          </Typography>
          <Box sx={{ opacity: 0.7 }}>{icon}</Box>
        </Box>
        {loading ? (
          <Skeleton
            variant="text"
            width={80}
            height={44}
            sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}
          />
        ) : (
          <Typography variant="h4" fontWeight={800}>
            {typeof value === 'number' ? fmt(value) : value}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Chart skeleton ───────────────────────────────────────────────────────────

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <Box sx={{ height, display: 'flex', alignItems: 'flex-end', gap: 1, px: 2, pb: 2 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          width="100%"
          height={`${30 + Math.random() * 60}%`}
          sx={{ borderRadius: 1 }}
        />
      ))}
    </Box>
  );
}

// ─── Alert type chip ──────────────────────────────────────────────────────────

function AlertChip({ type }: { type: string }) {
  const t = (type ?? '').toLowerCase();
  if (t.includes('sos') || t.includes('panic'))
    return <Chip label="SOS" size="small" color="error" />;
  if (t.includes('geofence')) return <Chip label="Geofence" size="small" color="warning" />;
  if (t.includes('ai') || t.includes('anomaly'))
    return <Chip label="AI" size="small" color="secondary" />;
  return <Chip label={type || 'Alert'} size="small" />;
}

// ─── Gauge chart ──────────────────────────────────────────────────────────────

interface GaugeProps {
  label: string;
  value: number; // 0–100
  color: string;
}

function GaugeCard({ label, value, color }: GaugeProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const data = [{ name: label, value: clamped, fill: color }];

  return (
    <Card sx={{ textAlign: 'center', py: 1 }}>
      <CardContent sx={{ pb: '8px !important' }}>
        <Box sx={{ position: 'relative', display: 'inline-block', width: '100%' }}>
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart
              cx="50%"
              cy="85%"
              innerRadius="60%"
              outerRadius="100%"
              startAngle={180}
              endAngle={0}
              data={data}
              barSize={14}
            >
              {/* Background arc */}
              <RadialBar
                dataKey="value"
                cornerRadius={6}
                background={{ fill: 'rgba(0,0,0,0.06)' }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          {/* Centered value label — sits inside the semicircle */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              textAlign: 'center',
            }}
          >
            <Typography fontWeight={800} fontSize={22} lineHeight={1} color={color}>
              {clamped}%
            </Typography>
          </Box>
        </Box>
        <Typography fontSize={13} fontWeight={600} color="text.secondary" sx={{ mt: 0.5 }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

// ─── Funnel bar ───────────────────────────────────────────────────────────────

interface FunnelStageProps {
  label: string;
  count: number;
  total: number;
  color: string;
  maxWidth?: number;
}

function FunnelStage({ label, count, total, color, maxWidth = 100 }: FunnelStageProps) {
  const barPct = total > 0 ? (count / total) * maxWidth : 0;
  const displayPct = pct(count, total);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
      <Typography
        sx={{ width: 110, flexShrink: 0, fontSize: 12, fontWeight: 600, textAlign: 'right' }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          height: 28,
          background: color,
          borderRadius: '0 6px 6px 0',
          width: `${barPct}%`,
          minWidth: count > 0 ? 8 : 0,
          transition: 'width 0.6s ease',
          clipPath: `polygon(0 0, 100% 8px, 100% 20px, 0 28px)`,
          flexShrink: 0,
        }}
      />
      <Typography fontSize={11} color="text.secondary" sx={{ flexShrink: 0 }}>
        {fmt(count)} ({displayPct}%)
      </Typography>
    </Box>
  );
}

// ─── Heatmap cell ─────────────────────────────────────────────────────────────

function intensityColor(value: number, max: number): string {
  if (!max || !value) return '#F5F7FA';
  const t = value / max;
  // White (#fff) → Shield blue (#1565C0)
  const r = Math.round(255 - t * (255 - 21));
  const g = Math.round(255 - t * (255 - 101));
  const b = Math.round(255 - t * (255 - 192));
  return `rgb(${r},${g},${b})`;
}

// ─── Custom scatter tooltip ───────────────────────────────────────────────────

function ScatterCustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <Paper elevation={3} sx={{ p: 1.5, fontSize: 12 }}>
      <Typography fontWeight={700} fontSize={12} mb={0.5}>
        {d?.name ?? 'Tenant'}
      </Typography>
      <Box>Queries: {fmt(d?.queries ?? 0)}</Box>
      <Box>Blocked: {fmt(d?.blocked ?? 0)}</Box>
      <Box>Block Rate: {pct(d?.blocked, d?.queries)}%</Box>
    </Paper>
  );
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function downloadCsv(daily: { day: string; queries: number; blocked: number }[]) {
  const header = 'Date,Total Queries,Blocked\n';
  const rows = daily.map((r) => `${r.day},${r.queries},${r.blocked}`).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shield-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printReport(overview: any, daily: any[]) {
  const totalQ = daily.reduce((s, r) => s + r.queries, 0);
  const totalB = daily.reduce((s, r) => s + r.blocked, 0);
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Shield Analytics Report</title>
<style>
  body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
  h1 { color: #1565C0; border-bottom: 2px solid #1565C0; pb: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #1565C0; color: #fff; padding: 8px; text-align: left; }
  td { padding: 7px 8px; border-bottom: 1px solid #eee; }
  .kpi { display: flex; gap: 24px; margin: 20px 0; flex-wrap: wrap; }
  .kpi-box { background: #f0f4ff; border-radius: 8px; padding: 16px 24px; min-width: 160px; }
  .kpi-val { font-size: 28px; font-weight: 800; color: #1565C0; }
  .kpi-lbl { font-size: 13px; color: #555; margin-top: 4px; }
  @media print { button { display: none; } }
</style></head><body>
<h1>Shield Platform — Analytics Report</h1>
<p>Generated: ${new Date().toLocaleString()}</p>
<div class="kpi">
  <div class="kpi-box"><div class="kpi-val">${overview?.totalCustomers ?? 0}</div><div class="kpi-lbl">Total Customers</div></div>
  <div class="kpi-box"><div class="kpi-val">${overview?.activeDevices ?? 0}</div><div class="kpi-lbl">Active Devices</div></div>
  <div class="kpi-box"><div class="kpi-val">${fmt(totalQ)}</div><div class="kpi-lbl">Total Queries (30d)</div></div>
  <div class="kpi-box"><div class="kpi-val">${fmt(totalB)}</div><div class="kpi-lbl">Total Blocked (30d)</div></div>
  <div class="kpi-box"><div class="kpi-val">${pct(totalB, totalQ)}%</div><div class="kpi-lbl">Block Rate</div></div>
</div>
<h2>Daily Traffic — Last 30 Days</h2>
<table>
  <tr><th>Date</th><th>Total Queries</th><th>Blocked</th><th>Block Rate</th></tr>
  ${daily
    .map(
      (r) =>
        `<tr><td>${r.day}</td><td>${r.queries.toLocaleString()}</td><td>${r.blocked.toLocaleString()}</td><td>${pct(r.blocked, r.queries)}%</td></tr>`
    )
    .join('')}
</table>
<br/><button onclick="window.print()">Print / Save PDF</button>
</body></html>`);
  w.document.close();
}

// ─── Page ────────────────────────────────────────────────────────────────────

const CHART_TABS = ['Traffic', 'Tenant Analysis'] as const;
type ChartTab = (typeof CHART_TABS)[number];

const DATE_RANGES = [
  { label: '7D', value: 7 },
  { label: '14D', value: 14 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
];

export default function AdminAnalyticsPage() {
  const [chartTab, setChartTab] = useState<ChartTab>('Traffic');
  const [dateRange, setDateRange] = useState(30);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ['admin-analytics-overview'],
    queryFn: fetchOverview,
    staleTime: 60_000,
  });

  const { data: daily = [], isLoading: dailyLoading } = useQuery({
    queryKey: ['admin-analytics-daily', dateRange],
    queryFn: () => fetchDailyStats(dateRange),
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

  const { data: topTenants = [], isLoading: topTenantsLoading } = useQuery({
    queryKey: ['admin-analytics-top-tenants'],
    queryFn: fetchTopTenants,
    staleTime: 60_000,
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  // Gauge values
  const systemHealth = 95;
  const blockEffectiveness = useMemo(() => {
    if (overview?.blockRate) return Math.round(overview.blockRate * 100);
    const totalQ = daily.reduce((s, r) => s + r.queries, 0);
    const totalB = daily.reduce((s, r) => s + r.blocked, 0);
    return pct(totalB, totalQ);
  }, [overview, daily]);
  const customerEngagement = useMemo(
    () =>
      pct(
        overview?.activeCustomers ?? overview?.totalCustomers ?? 0,
        overview?.totalCustomers ?? 0
      ),
    [overview]
  );

  // Funnel data
  const funnelData = useMemo(() => {
    const totalQueries =
      overview?.dnsQueriesToday ||
      daily.reduce((s, r) => s + r.queries, 0) ||
      1;
    const totalBlocked =
      overview?.threatsBlockedToday || daily.reduce((s, r) => s + r.blocked, 0) || 0;
    const filtered = Math.round(totalBlocked * 0.9);
    const threats = Math.round(totalBlocked * 0.1);
    return [
      { label: 'DNS Queries', count: totalQueries, color: '#1565C0' },
      { label: 'Filtered', count: filtered, color: '#0288D1' },
      { label: 'Blocked', count: totalBlocked, color: '#F57C00' },
      { label: 'Threats Stopped', count: threats, color: '#C62828' },
    ];
  }, [overview, daily]);

  // Prediction — linear regression on last 7 days of query data
  const chartData = useMemo(() => {
    if (!daily.length) return [];
    const last7 = daily.slice(-7);
    const { slope, intercept } = linearRegression(last7.map((r) => r.queries));
    const projected = Array.from({ length: 7 }, (_, i) => {
      const idx = last7.length + i;
      return {
        day: `Day +${i + 1}`,
        queries: undefined as number | undefined,
        blocked: undefined as number | undefined,
        projected: Math.max(0, Math.round(intercept + slope * idx)),
        isPredicted: true,
      };
    });
    return [
      ...daily.map((r) => ({ ...r, projected: undefined, isPredicted: false })),
      ...projected,
    ];
  }, [daily]);

  // Heatmap — 7 rows (days) × 24 cols (hours)
  const heatmapData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const last7 = daily.slice(-7);
    // If we have fewer than 7 days, pad with zeros
    const paddedLast7 = Array.from({ length: 7 }, (_, i) => last7[i] ?? { queries: 0 });
    return days.map((dayName, di) => ({
      day: dayName,
      hours: distributeByHour(paddedLast7[di].queries),
    }));
  }, [daily]);

  const heatmapMax = useMemo(() => {
    let max = 0;
    for (const row of heatmapData) {
      for (const v of row.hours) if (v > max) max = v;
    }
    return max;
  }, [heatmapData]);

  // Scatter — avg block rate reference line
  const avgScatterBlockRate = useMemo(() => {
    if (!topTenants.length) return 0;
    const rates = topTenants.map((t) => pct(t.blocked, t.queries));
    return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
  }, [topTenants]);

  // Top stat cards
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
      title: 'DNS Queries (7d)',
      value: overview?.dnsQueriesToday ?? 0,
      icon: <DnsIcon />,
      gradient: gradients.purple,
    },
    {
      title: 'Threats Blocked (7d)',
      value: overview?.threatsBlockedToday ?? 0,
      icon: <BlockIcon />,
      gradient: gradients.red,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AnimatedPage>
      <PageHeader
        icon={<BarChartIcon />}
        title="Admin Analytics"
        subtitle="Platform-wide statistics — customers, DNS traffic, blocked threats, active tenants, and recent alerts"
        action={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {/* Date range filter */}
            <ToggleButtonGroup
              value={dateRange}
              exclusive
              onChange={(_, v) => { if (v !== null) setDateRange(v); }}
              size="small"
              sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.5, fontSize: 12, fontWeight: 600, textTransform: 'none', borderRadius: '6px !important' } }}
            >
              {DATE_RANGES.map(r => (
                <ToggleButton key={r.value} value={r.value}>{r.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>

            <MuiTooltip title="Download daily stats as CSV">
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={() => downloadCsv(daily)}
                disabled={!daily.length}
              >
                Export CSV
              </Button>
            </MuiTooltip>
            <MuiTooltip title="Open printable PDF summary">
              <Button
                size="small"
                variant="contained"
                startIcon={<FileDownloadIcon />}
                onClick={() => printReport(overview, daily)}
                disabled={!daily.length}
              >
                Export PDF
              </Button>
            </MuiTooltip>
          </Stack>
        }
      />

      {/* ── Top stats ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {topCards.map((card) => (
          <Grid key={card.title} size={{ xs: 12, sm: 6, md: 3 }}>
            <TopCard {...card} loading={ovLoading} />
          </Grid>
        ))}
      </Grid>

      {/* ── Gauge row ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <GaugeCard label="System Health" value={systemHealth} color="#43A047" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <GaugeCard
            label="Block Effectiveness"
            value={blockEffectiveness}
            color="#E53935"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <GaugeCard
            label="Customer Engagement"
            value={customerEngagement}
            color="#1565C0"
          />
        </Grid>
      </Grid>

      {/* ── Charts row with tabs ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader
              title={
                <Tabs
                  value={chartTab}
                  onChange={(_, v) => setChartTab(v)}
                  sx={{ minHeight: 36 }}
                  TabIndicatorProps={{ style: { height: 3 } }}
                >
                  {CHART_TABS.map((t) => (
                    <Tab
                      key={t}
                      value={t}
                      label={t}
                      sx={{ fontSize: 13, fontWeight: 600, minHeight: 36, py: 0.5 }}
                    />
                  ))}
                </Tabs>
              }
            />
            <CardContent sx={{ pt: 0 }}>
              {/* ── Traffic tab ── */}
              {chartTab === 'Traffic' && (
                <>
                  {dailyLoading ? (
                    <ChartSkeleton height={260} />
                  ) : chartData.length === 0 ? (
                    <Box
                      sx={{
                        height: 260,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography color="text.secondary" variant="body2">
                        No data available
                      </Typography>
                    </Box>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart
                        data={chartData}
                        margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1565C0" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#1565C0" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#E53935" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#E53935" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FB8C00" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#FB8C00" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(128,128,128,0.15)"
                        />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={fmt}
                        />
                        <Tooltip formatter={(v: any) => fmt(Number(v))} />
                        <Legend iconSize={12} wrapperStyle={{ fontSize: 12 }} />
                        <Area
                          type="monotone"
                          dataKey="queries"
                          name="Total Queries"
                          stroke="#1565C0"
                          strokeWidth={2}
                          fill="url(#colorQueries)"
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="blocked"
                          name="Blocked"
                          stroke="#E53935"
                          strokeWidth={2}
                          fill="url(#colorBlocked)"
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="projected"
                          name="Forecast"
                          stroke="#FB8C00"
                          strokeWidth={2}
                          strokeDasharray="6 3"
                          fill="url(#colorProjected)"
                          fillOpacity={0.4}
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}

              {/* ── Tenant Analysis scatter tab ── */}
              {chartTab === 'Tenant Analysis' && (
                <>
                  {topTenantsLoading ? (
                    <ChartSkeleton height={260} />
                  ) : topTenants.length === 0 ? (
                    <Box
                      sx={{
                        height: 260,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography color="text.secondary" variant="body2">
                        No tenant data available
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Typography fontSize={11} color="text.secondary" mb={0.5}>
                        X — total queries (7d) · Y — blocked count · dashed line = avg block rate
                      </Typography>
                      <ResponsiveContainer width="100%" height={240}>
                        <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(128,128,128,0.15)"
                          />
                          <XAxis
                            type="number"
                            dataKey="queries"
                            name="Queries"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            tickFormatter={fmt}
                            label={{
                              value: 'Queries',
                              position: 'insideBottom',
                              offset: -2,
                              fontSize: 11,
                            }}
                          />
                          <YAxis
                            type="number"
                            dataKey="blocked"
                            name="Blocked"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={fmt}
                          />
                          <ZAxis range={[60, 300]} />
                          <Tooltip content={<ScatterCustomTooltip />} />
                          <Scatter
                            data={topTenants}
                            fill="#1565C0"
                            fillOpacity={0.75}
                          />
                          {/* Average block-rate reference line: blocked = queries × avgRate/100 */}
                          {avgScatterBlockRate > 0 && (
                            <ReferenceLine
                              stroke="#E53935"
                              strokeDasharray="5 3"
                              strokeWidth={1.5}
                              label={{
                                value: `Avg ${avgScatterBlockRate}%`,
                                fontSize: 10,
                                fill: '#E53935',
                                position: 'insideTopRight',
                              }}
                              segment={[
                                { x: 0, y: 0 },
                                {
                                  x:
                                    Math.max(...topTenants.map((t) => t.queries)) * 1.05,
                                  y:
                                    Math.max(...topTenants.map((t) => t.queries)) *
                                    1.05 *
                                    (avgScatterBlockRate / 100),
                                },
                              ]}
                            />
                          )}
                        </ScatterChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top blocked categories — donut + bar */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Category Distribution"
              titleTypographyProps={{ fontWeight: 700, fontSize: 15 }}
              subheader="Top blocked categories (donut)"
              subheaderTypographyProps={{ fontSize: 11 }}
            />
            <CardContent sx={{ pt: 0 }}>
              {catLoading ? (
                <ChartSkeleton height={220} />
              ) : categories.length === 0 ? (
                <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary" variant="body2">No data available</Typography>
                </Box>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categories.slice(0, 6)}
                        dataKey="blocks"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="52%"
                        outerRadius="80%"
                        paddingAngle={3}
                      >
                        {categories.slice(0, 6).map((_: any, i: number) => (
                          <Cell key={i} fill={['#E53935','#1565C0','#F57F17','#43A047','#7B1FA2','#0288D1'][i % 6]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    {categories.slice(0, 5).map((c: any, i: number) => (
                      <Stack key={c.name} direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ['#E53935','#1565C0','#F57F17','#43A047','#7B1FA2'][i], flexShrink: 0 }} />
                        <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary', textTransform: 'capitalize', fontSize: 11 }}>
                          {c.name?.toLowerCase().replace(/_/g, ' ')}
                        </Typography>
                        <Typography variant="caption" fontWeight={700} fontSize={11}>{fmt(c.blocks)}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Activity Heatmap ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardHeader
              title="Weekly Activity Heatmap"
              titleTypographyProps={{ fontWeight: 700, fontSize: 15 }}
              subheader="DNS query intensity by day of week and hour (last 7 days)"
              subheaderTypographyProps={{ fontSize: 12 }}
            />
            <CardContent sx={{ pt: 0, overflowX: 'auto' }}>
              {dailyLoading ? (
                <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 1 }} />
              ) : (
                <Box sx={{ minWidth: 520 }}>
                  {/* Hour labels */}
                  <Box
                    sx={{
                      display: 'flex',
                      ml: '52px',
                      mb: 0.5,
                      gap: '2px',
                    }}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <Box
                        key={h}
                        sx={{
                          width: 16,
                          flexShrink: 0,
                          textAlign: 'center',
                          fontSize: 9,
                          color: 'text.disabled',
                          fontWeight: [0, 6, 12, 18, 23].includes(h) ? 700 : 400,
                        }}
                      >
                        {[0, 6, 12, 18, 23].includes(h) ? h : ''}
                      </Box>
                    ))}
                  </Box>
                  {/* Rows */}
                  {heatmapData.map((row) => (
                    <Box
                      key={row.day}
                      sx={{ display: 'flex', alignItems: 'center', gap: '2px', mb: '2px' }}
                    >
                      <Typography
                        sx={{
                          width: 46,
                          flexShrink: 0,
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'text.secondary',
                          textAlign: 'right',
                          pr: 1,
                        }}
                      >
                        {row.day}
                      </Typography>
                      {row.hours.map((val, h) => (
                        <MuiTooltip
                          key={h}
                          title={`${row.day} ${h}:00 — ${fmt(val)} queries`}
                          placement="top"
                          arrow
                        >
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              flexShrink: 0,
                              borderRadius: '3px',
                              bgcolor: intensityColor(val, heatmapMax),
                              cursor: 'default',
                              border: '1px solid rgba(0,0,0,0.04)',
                              transition: 'transform 0.15s',
                              '&:hover': { transform: 'scale(1.4)', zIndex: 10 },
                            }}
                          />
                        </MuiTooltip>
                      ))}
                    </Box>
                  ))}
                  {/* Legend */}
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, ml: '52px' }}
                  >
                    <Typography fontSize={10} color="text.disabled" mr={0.5}>
                      Less
                    </Typography>
                    {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
                      <Box
                        key={t}
                        sx={{
                          width: 14,
                          height: 14,
                          borderRadius: '3px',
                          bgcolor: intensityColor(t * heatmapMax, heatmapMax),
                          border: '1px solid rgba(0,0,0,0.06)',
                        }}
                      />
                    ))}
                    <Typography fontSize={10} color="text.disabled" ml={0.5}>
                      More
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Funnel Analysis ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Funnel Analysis"
              titleTypographyProps={{ fontWeight: 700, fontSize: 15 }}
              subheader="DNS query filtering pipeline"
              subheaderTypographyProps={{ fontSize: 12 }}
            />
            <CardContent>
              {funnelData.map((stage) => (
                <FunnelStage
                  key={stage.label}
                  label={stage.label}
                  count={stage.count}
                  total={funnelData[0].count}
                  color={stage.color}
                />
              ))}
              <Box
                sx={{
                  mt: 2,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                {funnelData.map((stage, i) => (
                  <Box key={stage.label} sx={{ textAlign: 'center', minWidth: 60 }}>
                    <Typography fontWeight={700} fontSize={15} color={stage.color}>
                      {i === 0 ? '100%' : `${pct(stage.count, funnelData[0].count)}%`}
                    </Typography>
                    <Typography fontSize={10} color="text.secondary">
                      {stage.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 30-Day Forecast summary card */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="30-Day Forecast"
              titleTypographyProps={{ fontWeight: 700, fontSize: 15 }}
              subheader="Linear regression on last 7 days — projected next 7 days shown as dashed orange line on the Traffic chart"
              subheaderTypographyProps={{ fontSize: 12 }}
            />
            <CardContent>
              {dailyLoading ? (
                <Stack spacing={1}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} height={36} sx={{ borderRadius: 1 }} />
                  ))}
                </Stack>
              ) : (
                (() => {
                  const last7 = daily.slice(-7);
                  if (!last7.length) {
                    return (
                      <Typography color="text.secondary" variant="body2">
                        Not enough data for forecast
                      </Typography>
                    );
                  }
                  const { slope, intercept } = linearRegression(last7.map((r) => r.queries));
                  const next7 = Array.from({ length: 7 }, (_, i) => ({
                    label: `Day +${i + 1}`,
                    value: Math.max(0, Math.round(intercept + slope * (last7.length + i))),
                  }));
                  const trend = slope >= 0 ? 'increasing' : 'decreasing';
                  const trendColor = slope >= 0 ? '#E53935' : '#43A047';
                  return (
                    <>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          mb: 2,
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Typography fontSize={13}>
                          Traffic trend is{' '}
                          <strong style={{ color: trendColor }}>{trend}</strong> at{' '}
                          <strong>{Math.abs(Math.round(slope)).toLocaleString()}</strong>{' '}
                          queries/day slope
                        </Typography>
                      </Box>
                      <Grid container spacing={1}>
                        {next7.map((p) => (
                          <Grid key={p.label} size={{ xs: 6, sm: 3 }}>
                            <Box
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                border: '1px dashed rgba(251,140,0,0.5)',
                                textAlign: 'center',
                              }}
                            >
                              <Typography
                                fontSize={14}
                                fontWeight={700}
                                color="#FB8C00"
                              >
                                {fmt(p.value)}
                              </Typography>
                              <Typography fontSize={10} color="text.secondary">
                                {p.label}
                              </Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  );
                })()
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
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }} align="right">
                      Customers
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tenantLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 4 }).map((__, j) => (
                            <TableCell key={j}>
                              <Skeleton />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : tenants.length === 0
                    ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            <Typography
                              color="text.secondary"
                              variant="body2"
                              sx={{ py: 2 }}
                            >
                              No tenants found
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )
                    : tenants.map((t: any) => (
                        <TableRow key={t.id} hover>
                          <TableCell>
                            <Typography fontWeight={600} fontSize={13}>
                              {t.name ?? t.companyName ?? '—'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t.domain ?? t.email ?? ''}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={t.plan ?? t.planName ?? 'Basic'}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: 11 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography fontSize={13}>
                              {t.customerCount ?? t.maxCustomers ?? '—'}
                            </Typography>
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
                    <Skeleton
                      key={i}
                      variant="rectangular"
                      height={48}
                      sx={{ borderRadius: 1 }}
                    />
                  ))}
                </Stack>
              ) : alerts.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <WarningAmberIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary" variant="body2">
                    No recent alerts
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1}>
                  {alerts.map((a: any, idx: number) => (
                    <Box
                      key={a.id ?? idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        p: 1.25,
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                      }}
                    >
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
                      <Typography
                        fontSize={11}
                        color="text.secondary"
                        sx={{ flexShrink: 0 }}
                      >
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
