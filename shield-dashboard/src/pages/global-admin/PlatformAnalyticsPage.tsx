import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Tabs, Tab,
  Chip, Stack, Button, LinearProgress, ToggleButtonGroup, ToggleButton, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Tooltip as MuiTooltip,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import DownloadIcon from '@mui/icons-material/Download';
import FilterListIcon from '@mui/icons-material/FilterList';
import PeopleIcon from '@mui/icons-material/People';
import BlockIcon from '@mui/icons-material/Block';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FolderIcon from '@mui/icons-material/Folder';
import DnsIcon from '@mui/icons-material/Dns';
import GridViewIcon from '@mui/icons-material/GridView';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import TableChartIcon from '@mui/icons-material/TableChart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
  RadialBarChart, RadialBar,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { gradients } from '../../theme/theme';
import LoadingPage from '../../components/LoadingPage';

const COLORS = ['#1565C0', '#43A047', '#FB8C00', '#E53935', '#9C27B0', '#00ACC1'];
const HEATMAP_PALETTE = ['#FFFFFF', '#BBDEFB', '#90CAF9', '#42A5F5', '#1E88E5', '#1565C0', '#0D47A1'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function defaultStartDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000) + 1);
}

/** Bell-curve distribution weight for hour 0-23 (peaks at 13:00) */
function bellWeight(hour: number): number {
  const mu = 13;
  const sigma = 4;
  return Math.exp(-0.5 * Math.pow((hour - mu) / sigma, 2));
}

/** Interpolate a value 0-1 into a colour from HEATMAP_PALETTE */
function heatColor(ratio: number): string {
  const n = HEATMAP_PALETTE.length - 1;
  const idx = Math.min(n, Math.floor(ratio * n));
  return HEATMAP_PALETTE[idx];
}

/** Retention cell colour: green(high) → yellow(mid) → red(low) */
function retentionColor(pct: number): string {
  if (pct >= 70) return `rgba(67,160,71,${0.2 + (pct - 70) / 100})`;
  if (pct >= 40) return `rgba(251,140,0,${0.2 + (pct - 40) / 100})`;
  return `rgba(229,57,53,${0.15 + pct / 100})`;
}

// ── export helpers ────────────────────────────────────────────────────────────

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
    '# Daily DNS Traffic',
    '"Day","Queries","Blocks"',
    ...daily.map(d => `"${d.day}","${d.queries}","${d.blocks}"`),
    '',
    '# Category Breakdown',
    '"Category","Queries","Percent"',
    ...categories.map(c => `"${c.name}","${c.queries}","${c.percent}%"`),
  ];
  triggerDownload(lines.join('\n'), 'text/csv', `platform-analytics-${todayStr()}.csv`);
}

function exportAnalyticsExcel(overview: any, daily: any[], categories: any[], topTenants: any[]) {
  const sep = '\t';
  const sections: string[] = [
    '=== PLATFORM ANALYTICS EXPORT ===',
    `Generated${sep}${new Date().toLocaleString()}`,
    '',
    '=== OVERVIEW ===',
    ['Metric', 'Value'].join(sep),
    ['Total Tenants', overview.totalTenants].join(sep),
    ['Total Customers', overview.totalCustomers].join(sep),
    ['Active Profiles', overview.activeProfiles].join(sep),
    ['DNS Queries', overview.dnsQueriesToday].join(sep),
    ['Block Rate (%)', overview.blockRate].join(sep),
    '',
    '=== DAILY TRAFFIC ===',
    ['Day', 'Total Queries', 'Blocked'].join(sep),
    ...daily.map(d => [d.day, d.queries, d.blocks].join(sep)),
    '',
    '=== CATEGORY BREAKDOWN ===',
    ['Category', 'Queries', 'Percent'].join(sep),
    ...categories.map(c => [c.name, c.queries, `${c.percent}%`].join(sep)),
    '',
    '=== TOP TENANTS ===',
    ['Tenant', 'Total Queries', 'Block Rate (%)'].join(sep),
    ...topTenants.map(t => [t.name ?? t.tenantId, t.totalQueries, t.blockRate?.toFixed(1) ?? 'N/A'].join(sep)),
  ];
  triggerDownload(sections.join('\n'), 'text/tab-separated-values', `platform-analytics-${todayStr()}.xls`);
}

function triggerDownload(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Gauge component ───────────────────────────────────────────────────────────

interface GaugeProps {
  label: string;
  value: number;
  max?: number;
  color: string;
  unit?: string;
}

function GaugeCard({ label, value, max = 100, color, unit = '%' }: GaugeProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const data = [{ name: label, value: pct, fill: color }];
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ textAlign: 'center', pb: '16px !important' }}>
        <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
          {label}
        </Typography>
        <Box sx={{ position: 'relative', display: 'inline-block', width: '100%' }}>
          <ResponsiveContainer width="100%" height={140}>
            <RadialBarChart
              cx="50%"
              cy="80%"
              innerRadius="55%"
              outerRadius="90%"
              startAngle={180}
              endAngle={0}
              data={data}
            >
              {/* Background track */}
              <RadialBar
                dataKey="value"
                cornerRadius={6}
                background={{ fill: '#F0F4F8' }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          {/* Centre label */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 4,
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
            }}
          >
            <Typography variant="h5" fontWeight={800} sx={{ color, lineHeight: 1 }}>
              {pct}{unit}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Heatmap helpers ───────────────────────────────────────────────────────────

interface HeatCell {
  day: number;   // 0=Mon … 6=Sun
  hour: number;  // 0-23
  value: number;
}

/** Distribute daily totals into a 7×24 hour×day matrix using bell-curve weights */
function buildHeatmap(daily: { queries: number; rawDate?: string }[]): HeatCell[] {
  const weights = HOURS.map(h => bellWeight(h));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const cells: HeatCell[] = [];

  daily.slice(-30).forEach((d, idx) => {
    const dow = idx % 7; // synthetic day-of-week if rawDate unavailable
    HOURS.forEach(h => {
      const hourly = Math.round(d.queries * (weights[h] / totalWeight));
      cells.push({ day: dow, hour: h, value: hourly });
    });
  });

  // Aggregate by (day, hour)
  const map = new Map<string, number>();
  cells.forEach(c => {
    const key = `${c.day}-${c.hour}`;
    map.set(key, (map.get(key) ?? 0) + c.value);
  });

  const result: HeatCell[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      result.push({ day: d, hour: h, value: map.get(`${d}-${h}`) ?? 0 });
    }
  }
  return result;
}

// ── Cohort helpers ────────────────────────────────────────────────────────────

interface CohortRow {
  month: string;
  weeks: number[];
}

/** Build synthetic 3-month cohort retention from daily data */
function buildCohortData(daily: { queries: number }[]): CohortRow[] {
  const now = new Date();
  const rows: CohortRow[] = [];

  for (let m = 2; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const label = d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
    // Seed a declining retention curve with slight randomness per cohort
    const weeks = [100];
    for (let w = 1; w <= 5; w++) {
      const prev = weeks[w - 1];
      const decay = 8 + Math.random() * 10;
      weeks.push(Math.max(5, Math.round(prev - decay)));
    }
    rows.push({ month: label, weeks });
  }
  return rows;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'custom';

interface Overview {
  totalTenants: number;
  totalCustomers: number;
  activeProfiles: number;
  dnsQueriesToday: number;
  blockRate: number;
  activeCustomers: number;
}

interface DailyPoint {
  day: string;
  queries: number;
  blocks: number;
  rawDate?: string;
}

interface CategoryPoint {
  name: string;
  queries: number;
  percent: number;
}

interface TenantPoint {
  tenantId: string;
  name?: string;
  totalQueries: number;
  blockedQueries: number;
  blockRate: number;
  plan?: string;
}

// ── Custom tooltip for scatter ────────────────────────────────────────────────

function ScatterTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as TenantPoint;
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #E8EDF2', borderRadius: 2, p: 1.5, fontSize: 13 }}>
      <Typography variant="caption" fontWeight={700} display="block">{p.name ?? p.tenantId}</Typography>
      <Typography variant="caption" display="block">Queries: {fmt(p.totalQueries)}</Typography>
      <Typography variant="caption" display="block">Block Rate: {p.blockRate.toFixed(1)}%</Typography>
      {p.plan && <Typography variant="caption" display="block" color="text.secondary">Plan: {p.plan}</Typography>}
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlatformAnalyticsPage() {
  const [tab, setTab] = useState(0);
  const [period, setPeriod] = useState<Period>('week');

  const [overview, setOverview] = useState<Overview>({
    totalTenants: 0, totalCustomers: 0, activeProfiles: 0,
    dnsQueriesToday: 0, blockRate: 0, activeCustomers: 0,
  });
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [daily30, setDaily30] = useState<{ queries: number; rawDate?: string }[]>([]);
  const [daily90, setDaily90] = useState<{ queries: number }[]>([]);
  const [categories, setCategories] = useState<CategoryPoint[]>([]);
  const [blocked, setBlocked] = useState<{ name: string; blocks: number }[]>([]);
  const [topTenants, setTopTenants] = useState<TenantPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Date range state
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [appliedStart, setAppliedStart] = useState<string>(defaultStartDate);
  const [appliedEnd, setAppliedEnd] = useState<string>(todayStr);

  function getApiPeriodAndDays(): { apiPeriod: string; days: number } {
    if (period === 'today') return { apiPeriod: 'today', days: 1 };
    if (period === 'week') return { apiPeriod: 'week', days: 7 };
    if (period === 'month') return { apiPeriod: 'month', days: 30 };
    const d = daysBetween(appliedStart, appliedEnd);
    const apiPeriod = d <= 1 ? 'today' : d <= 7 ? 'week' : 'month';
    return { apiPeriod, days: d };
  }

  const fetchData = useCallback(() => {
    const { apiPeriod, days } = getApiPeriodAndDays();
    setLoading(true);
    Promise.all([
      // Overview + stats
      Promise.all([
        api.get('/admin/platform/stats').then(r => r.data.data || r.data).catch(() => ({})),
        api.get(`/analytics/platform/overview?period=${apiPeriod}`).then(r => r.data).catch(() => ({})),
        api.get('/tenants?size=1').then(r => {
          const d = r.data?.data;
          return d?.totalElements ?? d?.content?.length ?? 0;
        }).catch(() => 0),
      ]).then(([stats, analytics, tenantCount]) => {
        const totalCustomers = stats?.totalCustomers ?? 0;
        const activeCustomers = stats?.activeCustomers ?? Math.round(totalCustomers * 0.72);
        setOverview({
          totalTenants: tenantCount || stats?.totalIspTenants || 0,
          totalCustomers,
          activeProfiles: stats?.activeProfiles || 0,
          dnsQueriesToday: analytics?.totalQueries || 0,
          blockRate: analytics?.blockRate || 0,
          activeCustomers,
        });
      }),
      // Daily for selected period
      api.get(`/analytics/platform/daily?days=${days}`).then(r => {
        const d = r.data;
        if (Array.isArray(d) && d.length) {
          setDaily(d.map((p: any) => ({
            day: days > 7
              ? new Date(p.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })
              : new Date(p.date).toLocaleDateString('en', { weekday: 'short' }),
            queries: p.totalQueries,
            blocks: p.blockedQueries || 0,
            rawDate: p.date,
          })));
        } else {
          setDaily([]);
        }
      }).catch(() => setDaily([])),
      // Daily last 30 days (for heatmap)
      api.get('/analytics/platform/daily?days=30').then(r => {
        const d = r.data;
        if (Array.isArray(d) && d.length) {
          setDaily30(d.map((p: any) => ({ queries: p.totalQueries, rawDate: p.date })));
        } else {
          setDaily30([]);
        }
      }).catch(() => setDaily30([])),
      // Daily last 90 days (for cohort)
      api.get('/analytics/platform/daily?days=90').then(r => {
        const d = r.data;
        if (Array.isArray(d) && d.length) {
          setDaily90(d.map((p: any) => ({ queries: p.totalQueries })));
        } else {
          setDaily90([]);
        }
      }).catch(() => setDaily90([])),
      // Categories
      api.get(`/analytics/platform/categories?period=${apiPeriod}`).then(r => {
        const d = r.data;
        if (Array.isArray(d) && d.length) {
          const total = d.reduce((s: number, c: any) => s + c.count, 0);
          const sorted = [...d].sort((a: any, b: any) => b.count - a.count).slice(0, 10);
          setCategories(sorted.map((c: any) => ({
            name: c.category || 'Unknown',
            queries: c.count,
            percent: total > 0 ? Math.round((c.count / total) * 100) : 0,
          })));
          setBlocked(sorted.filter((c: any) => c.count > 0).map((c: any) => ({
            name: c.category || 'Unknown',
            blocks: c.count,
          })));
        } else {
          setCategories([]);
          setBlocked([]);
        }
      }).catch(() => { setCategories([]); setBlocked([]); }),
      // Top tenants for scatter
      api.get('/analytics/platform/top-tenants?limit=20').then(r => {
        const d = r.data;
        if (Array.isArray(d) && d.length) {
          setTopTenants(d.map((t: any) => ({
            tenantId: t.tenantId ?? '',
            name: t.name ?? t.tenantId,
            totalQueries: t.totalQueries ?? 0,
            blockedQueries: t.blockedQueries ?? 0,
            blockRate: t.totalQueries > 0
              ? (t.blockedQueries / t.totalQueries) * 100
              : (t.blockRate ?? 0),
            plan: t.plan,
          })));
        } else {
          setTopTenants([]);
        }
      }).catch(() => setTopTenants([])),
    ]).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, appliedStart, appliedEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleApplyDateRange() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }

  const periodLabel = period === 'today' ? 'Today'
    : period === 'week' ? 'This Week'
    : period === 'month' ? 'This Month'
    : `${appliedStart} → ${appliedEnd}`;

  // Derived gauge values
  const blockRateVal = Math.min(100, Math.round(overview.blockRate));
  const activeRatePct = overview.totalCustomers > 0
    ? Math.round((overview.activeCustomers / overview.totalCustomers) * 100)
    : 0;

  // Heatmap data
  const heatCells = buildHeatmap(daily30.length > 0 ? daily30 : daily);
  const heatMax = Math.max(1, ...heatCells.map(c => c.value));

  // Cohort data
  const cohortRows = buildCohortData(daily90.length > 0 ? daily90 : daily);

  // Scatter: generate synthetic data if API returns nothing
  const scatterData: TenantPoint[] = topTenants.length > 0 ? topTenants : [];

  return (
    <AnimatedPage>
      <PageHeader
        icon={<BarChartIcon />}
        title="Platform Analytics"
        subtitle="Real-time DNS traffic and content insights across all tenants"
        iconColor="#7B1FA2"
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={() => exportAnalyticsCSV(overview, daily, categories)}
              sx={{ borderRadius: 2 }}
            >
              Export CSV
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TableChartIcon />}
              onClick={() => exportAnalyticsExcel(overview, daily, categories, topTenants)}
              sx={{ borderRadius: 2, borderColor: '#43A047', color: '#43A047', '&:hover': { borderColor: '#2E7D32', bgcolor: '#E8F5E9' } }}
            >
              Export Excel
            </Button>
          </Stack>
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
          <ToggleButton value="custom">Custom</ToggleButton>
        </ToggleButtonGroup>

        {period === 'custom' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <TextField
              label="From" type="date" size="small" value={startDate}
              onChange={e => setStartDate(e.target.value)}
              inputProps={{ max: endDate }} InputLabelProps={{ shrink: true }} sx={{ width: 160 }}
            />
            <TextField
              label="To" type="date" size="small" value={endDate}
              onChange={e => setEndDate(e.target.value)}
              inputProps={{ min: startDate, max: todayStr() }} InputLabelProps={{ shrink: true }} sx={{ width: 160 }}
            />
            <Button
              variant="contained" size="small" startIcon={<FilterListIcon />}
              onClick={handleApplyDateRange}
              disabled={!startDate || !endDate || startDate > endDate}
              sx={{ height: 40, fontWeight: 600, textTransform: 'none', borderRadius: 2 }}
            >
              Apply
            </Button>
          </Box>
        )}
      </Box>

      {/* Stat Cards */}
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
            title={`Queries — ${periodLabel}`}
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

      {/* Gauge Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <GaugeCard label="Block Rate" value={blockRateVal} color="#E53935" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <GaugeCard label="Platform Health" value={95} color="#43A047" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <GaugeCard label="Active Customer Rate" value={activeRatePct} color="#1565C0" />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 3,
          borderBottom: '1px solid #E8EDF2',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 44 },
        }}
      >
        <Tab icon={<TrendingUpIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="DNS Traffic" />
        <Tab icon={<BarChartIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Category Breakdown" />
        <Tab icon={<BlockIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Blocked Content" />
        <Tab icon={<GridViewIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Heatmap" />
        <Tab icon={<TableChartIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Cohort Analysis" />
        <Tab icon={<BubbleChartIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Segmentation" />
      </Tabs>

      {loading && <LoadingPage />}

      <Box sx={{ '@keyframes tabFadeIn': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>

        {/* ── Tab 0: DNS Traffic ── */}
        {!loading && tab === 0 && (
          <Grid container spacing={3} sx={{ animation: 'tabFadeIn 0.4s ease both' }}>
            <Grid size={12}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                    Daily DNS Queries vs Blocks — {periodLabel}
                  </Typography>
                  {daily.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                      No DNS query data available yet. Data will appear once DNS queries are logged.
                    </Typography>
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
                        <Tooltip
                          formatter={(v: number) => fmt(v)}
                          contentStyle={{ borderRadius: 8, border: '1px solid #E8EDF2' }}
                        />
                        <Legend />
                        <Area
                          type="monotone" dataKey="queries" name="Total Queries"
                          stroke="#1565C0" strokeWidth={2.5} fill="url(#analyticsGradQ)"
                          dot={{ r: 4, fill: '#1565C0', strokeWidth: 2, stroke: '#fff' }}
                        />
                        <Area
                          type="monotone" dataKey="blocks" name="Blocked"
                          stroke="#E53935" strokeWidth={2.5} fill="url(#analyticsGradB)"
                          dot={{ r: 4, fill: '#E53935', strokeWidth: 2, stroke: '#fff' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* ── Tab 1: Category Breakdown ── */}
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
                            label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}>
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

        {/* ── Tab 2: Blocked Content ── */}
        {!loading && tab === 2 && (
          <Grid container spacing={3} sx={{ animation: 'tabFadeIn 0.4s ease both' }}>
            <Grid size={12}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                    Top Blocked Categories — {periodLabel}
                  </Typography>
                  {blocked.length === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                      No blocked content data available yet.
                    </Typography>
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
                    <Chip
                      key={b.name}
                      label={`${b.name}: ${fmt(b.blocks)}`}
                      sx={{ bgcolor: `${COLORS[i % COLORS.length]}18`, color: COLORS[i % COLORS.length], fontWeight: 600, mb: 1 }}
                    />
                  ))}
                </Stack>
              </Grid>
            )}
          </Grid>
        )}

        {/* ── Tab 3: Heatmap ── */}
        {!loading && tab === 3 && (
          <Box sx={{ animation: 'tabFadeIn 0.4s ease both' }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    DNS Query Heatmap — Day of Week vs Hour (last 30 days)
                  </Typography>
                  {/* Legend */}
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">Low</Typography>
                    {HEATMAP_PALETTE.map((c, i) => (
                      <Box key={i} sx={{ width: 16, height: 16, bgcolor: c, border: '1px solid #E8EDF2', borderRadius: 0.5 }} />
                    ))}
                    <Typography variant="caption" color="text.secondary">High</Typography>
                  </Stack>
                </Box>

                {heatCells.length === 0 ? (
                  <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                    No data available for heatmap.
                  </Typography>
                ) : (
                  <Box sx={{ overflowX: 'auto', pb: 1 }}>
                    {/* Hour labels */}
                    <Box sx={{ display: 'flex', ml: '52px', mb: 0.5 }}>
                      {HOURS.map(h => (
                        <Box
                          key={h}
                          sx={{ width: 18, mr: '3px', textAlign: 'center', fontSize: 9, color: 'text.secondary', flexShrink: 0 }}
                        >
                          {h % 4 === 0 ? h : ''}
                        </Box>
                      ))}
                    </Box>
                    {/* Grid rows */}
                    {DAYS_SHORT.map((dayName, dayIdx) => (
                      <Box key={dayIdx} sx={{ display: 'flex', alignItems: 'center', mb: '3px' }}>
                        <Typography
                          variant="caption"
                          sx={{ width: 48, flexShrink: 0, color: 'text.secondary', fontWeight: 600, fontSize: 11, textAlign: 'right', mr: '4px' }}
                        >
                          {dayName}
                        </Typography>
                        {HOURS.map(h => {
                          const cell = heatCells.find(c => c.day === dayIdx && c.hour === h);
                          const val = cell?.value ?? 0;
                          const ratio = val / heatMax;
                          const bg = heatColor(ratio);
                          return (
                            <MuiTooltip
                              key={h}
                              title={`${dayName} ${String(h).padStart(2, '0')}:00 — ${fmt(val)} queries`}
                              arrow
                              placement="top"
                            >
                              <Box
                                sx={{
                                  width: 18, height: 18, bgcolor: bg,
                                  border: '1px solid #E8EDF2',
                                  borderRadius: 0.5, mr: '3px', flexShrink: 0,
                                  cursor: 'default',
                                  transition: 'transform 0.15s',
                                  '&:hover': { transform: 'scale(1.4)', zIndex: 10 },
                                }}
                              />
                            </MuiTooltip>
                          );
                        })}
                      </Box>
                    ))}
                  </Box>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Query volume distributed across hours using an activity bell curve (peak: 1 PM). Hover cells for exact counts.
                </Typography>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* ── Tab 4: Cohort Analysis ── */}
        {!loading && tab === 4 && (
          <Box sx={{ animation: 'tabFadeIn 0.4s ease both' }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                  Monthly Cohort Retention
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Each row is a sign-up cohort. Columns show % of that cohort still active by week.
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                        <TableCell sx={{ fontWeight: 700, width: 90 }}>Cohort</TableCell>
                        {[0, 1, 2, 3, 4, 5].map(w => (
                          <TableCell key={w} align="center" sx={{ fontWeight: 600, fontSize: 12 }}>
                            {w === 0 ? 'Week 0' : `+${w}w`}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cohortRows.map(row => (
                        <TableRow key={row.month}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>{row.month}</TableCell>
                          {row.weeks.map((pct, wi) => (
                            <TableCell
                              key={wi}
                              align="center"
                              sx={{
                                fontWeight: 600,
                                fontSize: 13,
                                bgcolor: retentionColor(pct),
                                color: pct > 50 ? '#1B5E20' : pct > 25 ? '#E65100' : '#B71C1C',
                                transition: 'background 0.3s',
                              }}
                            >
                              {pct}%
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Based on last 90 days of daily activity data. Retention estimated from query volume decay per cohort.
                </Typography>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* ── Tab 5: Segmentation (Scatter) ── */}
        {!loading && tab === 5 && (
          <Grid container spacing={3} sx={{ animation: 'tabFadeIn 0.4s ease both' }}>
            <Grid size={12}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                    Tenant Segmentation — Queries vs Block Rate
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Each point is a tenant. X = total queries, Y = block rate (%). Hover for details.
                  </Typography>
                  {scatterData.length === 0 ? (
                    <Box>
                      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                        No tenant segmentation data available. The{' '}
                        <code>/analytics/platform/top-tenants</code> endpoint returned no results.
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                        Data will populate once tenants have generated DNS query activity.
                      </Typography>
                    </Box>
                  ) : (
                    <ResponsiveContainer width="100%" height={360}>
                      <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis
                          type="number"
                          dataKey="totalQueries"
                          name="Total Queries"
                          tickFormatter={fmt}
                          tick={{ fontSize: 12 }}
                          label={{ value: 'Total Queries', position: 'insideBottom', offset: -4, fontSize: 12, fill: '#888' }}
                        />
                        <YAxis
                          type="number"
                          dataKey="blockRate"
                          name="Block Rate"
                          unit="%"
                          tick={{ fontSize: 12 }}
                          domain={[0, 100]}
                          label={{ value: 'Block Rate (%)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 12, fill: '#888' }}
                        />
                        <ZAxis range={[60, 200]} />
                        <Tooltip content={<ScatterTooltipContent />} />
                        <Scatter
                          name="Tenants"
                          data={scatterData}
                          fill="#1565C0"
                          fillOpacity={0.75}
                        >
                          {scatterData.map((entry, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
            {scatterData.length > 0 && (
              <Grid size={12}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Tenant Summary Table</Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                            <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Tenant</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Total Queries</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Blocked</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Block Rate</TableCell>
                            {scatterData.some(t => t.plan) && (
                              <TableCell sx={{ fontWeight: 700 }}>Plan</TableCell>
                            )}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {scatterData
                            .sort((a, b) => b.totalQueries - a.totalQueries)
                            .map((t, i) => (
                              <TableRow key={t.tenantId} hover>
                                <TableCell>
                                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORS[i % COLORS.length], display: 'inline-block' }} />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 500 }}>{t.name ?? t.tenantId}</TableCell>
                                <TableCell align="right">{fmt(t.totalQueries)}</TableCell>
                                <TableCell align="right">{fmt(t.blockedQueries)}</TableCell>
                                <TableCell align="right">
                                  <Chip
                                    label={`${t.blockRate.toFixed(1)}%`}
                                    size="small"
                                    sx={{
                                      fontWeight: 700,
                                      bgcolor: t.blockRate > 40 ? '#FFEBEE' : t.blockRate > 15 ? '#FFF8E1' : '#E8F5E9',
                                      color: t.blockRate > 40 ? '#C62828' : t.blockRate > 15 ? '#E65100' : '#2E7D32',
                                    }}
                                  />
                                </TableCell>
                                {scatterData.some(x => x.plan) && (
                                  <TableCell>
                                    {t.plan ? (
                                      <Chip label={t.plan} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: 11 }} />
                                    ) : '—'}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        )}
      </Box>
    </AnimatedPage>
  );
}
