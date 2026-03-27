import { useState, useCallback, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, CircularProgress, Alert,
  Tabs, Tab, Chip, Table, TableHead, TableRow, TableCell, TableBody,
  Stack, Divider, LinearProgress, Button, Snackbar, TextField, Tooltip as MuiTooltip,
  TablePagination,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
  ScatterChart, Scatter, ZAxis,
  RadialBarChart, RadialBar,
} from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LanguageIcon from '@mui/icons-material/Language';
import CategoryIcon from '@mui/icons-material/Category';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FilterListIcon from '@mui/icons-material/FilterList';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import { gradients } from '../../theme/theme';
import LoadingPage from '../../components/LoadingPage';

type Period = 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

const PIE_COLORS = [
  '#1565C0', '#E53935', '#43A047', '#FB8C00', '#9C27B0',
  '#00ACC1', '#F57F17', '#00897B', '#AD1457', '#546E7A',
];

const PERIOD_LABELS: Record<Period, string> = {
  TODAY: 'Today',
  WEEK: 'This Week',
  MONTH: 'This Month',
  CUSTOM: 'Custom Range',
};

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function defaultStartDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000) + 1);
}

/** Maps a date-range to the closest named period the analytics API understands */
function dateRangeToApiPeriod(startDate: string, endDate: string): string {
  const days = daysBetween(startDate, endDate);
  if (days <= 1) return 'today';
  if (days <= 7) return 'week';
  return 'month';
}

/** Interpolate between two hex colours given a 0-1 ratio */
function interpolateColor(ratio: number): string {
  // Light blue #E3F2FD → dark blue #0D47A1
  const r = Math.round(0xe3 + (0x0d - 0xe3) * ratio);
  const g = Math.round(0xf2 + (0x47 - 0xf2) * ratio);
  const b = Math.round(0xfd + (0xa1 - 0xfd) * ratio);
  return `rgb(${r},${g},${b})`;
}

interface DnsEvent { id: string; domain: string; action: 'ALLOWED' | 'BLOCKED'; category: string; queriedAt: string; }
interface TopDomain { domain: string; count: number; action?: string; }
interface CategoryStat { name: string; value: number; percent: number; }
interface DailyPoint { day: string; queries: number; blocks: number; allowed: number; }
interface HourlyPoint { hour: number; count: number; }
interface AppUsageItem {
  appName: string;
  packageName: string;
  totalMinutes: number;
  blockedCount?: number;
}

interface ReportsPageProps {
  profileId?: string;
}

// ─── Gauge (block rate) custom label ────────────────────────────────────────
const GaugeCenterLabel = ({ cx, cy, value }: { cx: number; cy: number; value: number }) => (
  <>
    <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 28, fontWeight: 700, fill: '#1565C0' }}>
      {value.toFixed(1)}%
    </text>
    <text x={cx} y={cy + 20} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fill: '#78909C' }}>
      block rate
    </text>
  </>
);

export default function ReportsPage({ profileId: profileIdProp }: ReportsPageProps) {
  const { profileId: profileIdParam } = useParams<{ profileId: string }>();
  const profileId = profileIdProp ?? profileIdParam;
  const queryClient = useQueryClient();

  const [period, setPeriod] = useState<Period>('WEEK');
  const [chartTab, setChartTab] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [histPage, setHistPage] = useState(0);
  const [histRowsPerPage, setHistRowsPerPage] = useState(20);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [hoveredHour, setHoveredHour] = useState<{ hour: number; count: number } | null>(null);

  // Date range state (used when period === 'CUSTOM' or as override for preset periods)
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(todayStr);
  // Committed range — only updates when user clicks Apply
  const [appliedStart, setAppliedStart] = useState<string>(defaultStartDate);
  const [appliedEnd, setAppliedEnd] = useState<string>(todayStr);

  /** Returns the API `period` string and `days` count to use based on current selection */
  function getApiParams(): { apiPeriod: string; days: number } {
    if (period === 'TODAY') return { apiPeriod: 'today', days: 1 };
    if (period === 'WEEK') return { apiPeriod: 'week', days: 7 };
    if (period === 'MONTH') return { apiPeriod: 'month', days: 30 };
    // CUSTOM
    const days = daysBetween(appliedStart, appliedEnd);
    return { apiPeriod: dateRangeToApiPeriod(appliedStart, appliedEnd), days };
  }

  const { apiPeriod, days } = getApiParams();

  // Invalidate all report queries and re-fetch
  function applyDateRange() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    queryClient.invalidateQueries({ queryKey: ['report-stats', profileId] });
    queryClient.invalidateQueries({ queryKey: ['report-daily', profileId] });
    queryClient.invalidateQueries({ queryKey: ['report-categories', profileId] });
    queryClient.invalidateQueries({ queryKey: ['report-top-blocked', profileId] });
    queryClient.invalidateQueries({ queryKey: ['report-history', profileId] });
    queryClient.invalidateQueries({ queryKey: ['app-usage', profileId] });
    queryClient.invalidateQueries({ queryKey: ['report-hourly', profileId] });
  }

  const handleDownloadPdf = () => {
    if (!profileId) return;
    setPdfLoading(true);
    // Backend returns print-friendly HTML — open in new tab and trigger print dialog
    const url = `/api/v1/analytics/${profileId}/report/pdf?period=${apiPeriod}`;
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        win.print();
      });
      setSnackbar({ open: true, message: 'Report opened — use browser print to save as PDF', severity: 'success' });
    } else {
      setSnackbar({ open: true, message: 'Please allow popups to open the report', severity: 'error' });
    }
    setPdfLoading(false);
  };

  // ── CSV Export ──────────────────────────────────────────────────────────────
  const handleDownloadCsv = useCallback(() => {
    const daily = dailyQuery.data ?? [];
    if (daily.length === 0) {
      setSnackbar({ open: true, message: 'No daily data to export', severity: 'error' });
      return;
    }
    const header = 'date,queries,blocked,allowed\n';
    const rows = daily.map(d => `${d.day},${d.queries},${d.blocks},${d.allowed}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shield-dns-${profileId}-${todayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    setSnackbar({ open: true, message: 'CSV exported successfully', severity: 'success' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // ── Stats query — period-aware ──────────────────────────────────────────────
  const statsQuery = useQuery({
    queryKey: ['report-stats', profileId, period, appliedStart, appliedEnd],
    queryFn: async () => {
      const r = await api.get(`/analytics/${profileId}/stats`, { params: { period: apiPeriod } });
      const raw = r.data?.data ?? r.data;
      return {
        totalQueries: raw?.totalQueries ?? 0,
        totalBlocked: raw?.totalBlocked ?? raw?.blockedQueries ?? 0,
        totalAllowed: raw?.totalAllowed ?? raw?.allowedQueries ?? 0,
        blockRate:    Number.isFinite(raw?.blockRate) ? raw.blockRate : 0,
      } as { totalQueries: number; totalBlocked: number; totalAllowed: number; blockRate: number; };
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // ── Previous-period stats for trend arrows ──────────────────────────────────
  const prevStatsQuery = useQuery({
    queryKey: ['report-stats-prev', profileId, period, appliedStart, appliedEnd],
    queryFn: async () => {
      // Map current period to previous period label
      const prevPeriod = period === 'TODAY' ? 'week' : period === 'WEEK' ? 'month' : 'month';
      try {
        const r = await api.get(`/analytics/${profileId}/stats`, { params: { period: prevPeriod } });
        const raw = r.data?.data ?? r.data;
        return {
          totalQueries: raw?.totalQueries ?? 0,
          totalBlocked: raw?.totalBlocked ?? raw?.blockedQueries ?? 0,
          totalAllowed: raw?.totalAllowed ?? raw?.allowedQueries ?? 0,
          blockRate:    Number.isFinite(raw?.blockRate) ? raw.blockRate : 0,
        } as { totalQueries: number; totalBlocked: number; totalAllowed: number; blockRate: number; };
      } catch {
        return null;
      }
    },
    enabled: !!profileId,
    retry: 0,
    staleTime: 120000,
  });

  // ── Daily chart data ────────────────────────────────────────────────────────
  const dailyQuery = useQuery({
    queryKey: ['report-daily', profileId, period, appliedStart, appliedEnd],
    queryFn: async () => {
      const r = await api.get(`/analytics/${profileId}/daily`, { params: { days } });
      const raw = (r.data?.data ?? r.data) as { date: string; totalQueries: number; blockedQueries: number }[];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return (raw || []).map(d => {
        const q = d.totalQueries || 0;
        const b = d.blockedQueries || 0;
        return {
          day: days > 7
            ? new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })
            : dayNames[new Date(d.date).getDay()] || d.date,
          queries: q,
          blocks: b,
          allowed: q - b,
        } as DailyPoint;
      });
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // ── Category breakdown ──────────────────────────────────────────────────────
  const catQuery = useQuery({
    queryKey: ['report-categories', profileId, period, appliedStart, appliedEnd],
    queryFn: async () => {
      const r = await api.get(`/analytics/${profileId}/categories`, { params: { period: apiPeriod } });
      const raw = (r.data?.data ?? r.data) as { category: string; count: number }[];
      if (!raw || !raw.length) return [] as CategoryStat[];
      const total = raw.reduce((s, c) => s + c.count, 0);
      return raw
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(c => ({
          name: c.category || 'Unknown',
          value: c.count,
          percent: total > 0 ? Math.round(c.count / total * 100) : 0,
        }));
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // ── Top blocked domains ─────────────────────────────────────────────────────
  const topBlockedQuery = useQuery({
    queryKey: ['report-top-blocked', profileId, period, appliedStart, appliedEnd],
    queryFn: async () => {
      const r = await api.get(`/analytics/${profileId}/top-domains`, {
        params: { action: 'BLOCKED', limit: 10, period: apiPeriod },
      });
      return (r.data?.data ?? r.data) as TopDomain[];
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // ── Top allowed domains (for scatter plot) ──────────────────────────────────
  const topAllowedQuery = useQuery({
    queryKey: ['report-top-allowed', profileId, period, appliedStart, appliedEnd],
    queryFn: async () => {
      const r = await api.get(`/analytics/${profileId}/top-domains`, {
        params: { action: 'ALLOWED', limit: 10, period: apiPeriod },
      });
      return (r.data?.data ?? r.data) as TopDomain[];
    },
    enabled: !!profileId,
    retry: 1,
    staleTime: 30000,
  });

  // ── Recent activity — all queries (blocked + allowed) ──────────────────────
  const historyQuery = useQuery({
    queryKey: ['report-history', profileId, period, appliedStart, appliedEnd, histPage, histRowsPerPage],
    queryFn: async () => {
      const r = await api.get(`/analytics/${profileId}/history`, { params: { page: histPage, size: histRowsPerPage } });
      const totalElements: number = r.data?.data?.totalElements ?? r.data?.totalElements ?? 0;
      const raw = r.data?.content ?? r.data?.data?.content ?? r.data?.data ?? r.data;
      return { content: (Array.isArray(raw) ? raw : []) as DnsEvent[], totalElements };
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Reset history page when profileId or period changes
  useEffect(() => { setHistPage(0); }, [profileId, period]);

  // ── App usage query ─────────────────────────────────────────────────────────
  const appUsageQuery = useQuery({
    queryKey: ['app-usage', profileId, period, appliedStart, appliedEnd],
    queryFn: async () => {
      const r = await api.get(`/analytics/${profileId}/top-apps`, { params: { period: apiPeriod } });
      const raw = r.data?.data ?? r.data;
      return (Array.isArray(raw) ? raw : raw?.content ?? []) as AppUsageItem[];
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // ── Hourly heatmap data ─────────────────────────────────────────────────────
  const hourlyQuery = useQuery({
    queryKey: ['report-hourly', profileId, todayStr()],
    queryFn: async () => {
      const r = await api.get(`/analytics/${profileId}/hourly`, {
        params: { date: todayStr() },
      });
      const raw = r.data?.data ?? r.data;
      return (Array.isArray(raw) ? raw : []) as HourlyPoint[];
    },
    enabled: !!profileId,
    retry: 1,
    refetchInterval: 300000, // refresh every 5 min
    staleTime: 60000,
  });

  // ── Derived values ──────────────────────────────────────────────────────────
  const stats = statsQuery.data;
  const prevStats = prevStatsQuery.data;
  const daily = dailyQuery.data ?? [];
  const categories = catQuery.data ?? [];
  const topBlocked = (topBlockedQuery.data ?? []) as TopDomain[];
  const topAllowed = (topAllowedQuery.data ?? []) as TopDomain[];
  const history = (historyQuery.data?.content ?? []) as DnsEvent[];
  const appUsage = (appUsageQuery.data ?? []) as AppUsageItem[];
  const hourlyData = (hourlyQuery.data ?? []) as HourlyPoint[];
  const loading = statsQuery.isLoading;

  const totalQ = stats?.totalQueries ?? daily.reduce((s, d) => s + d.queries, 0);
  const totalB = stats?.totalBlocked ?? daily.reduce((s, d) => s + d.blocks, 0);
  const totalA = stats?.totalAllowed ?? (totalQ - totalB);
  const blockRateNum = stats?.blockRate != null
    ? stats.blockRate
    : totalQ > 0 ? (totalB / totalQ) * 100 : 0;
  const blockRate = blockRateNum.toFixed(1);
  const maxBlocked = topBlocked.length > 0 ? topBlocked[0].count : 1;

  // ── Trend helpers ───────────────────────────────────────────────────────────
  function trendIcon(current: number, previous: number | undefined, inverse = false) {
    if (previous == null || previous === 0) return null;
    const up = current > previous;
    const isGood = inverse ? !up : up;
    return up
      ? <TrendingUpIcon sx={{ fontSize: 14, color: isGood ? '#43A047' : '#E53935', ml: 0.5 }} />
      : <TrendingDownIcon sx={{ fontSize: 14, color: isGood ? '#43A047' : '#E53935', ml: 0.5 }} />;
  }

  function trendPct(current: number, previous: number | undefined): string | null {
    if (previous == null || previous === 0) return null;
    const diff = ((current - previous) / previous * 100);
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`;
  }

  // ── Gauge data for RadialBarChart ───────────────────────────────────────────
  const gaugeData = [
    { name: 'Block Rate', value: Math.min(blockRateNum, 100), fill: '#1565C0' },
    { name: 'Allow Rate', value: Math.max(100 - blockRateNum, 0), fill: '#E8F0FE' },
  ];

  // ── Scatter data ────────────────────────────────────────────────────────────
  const scatterBlocked = topBlocked.map(d => ({ x: d.count, y: 100, z: 1, domain: d.domain }));
  const scatterAllowed = topAllowed.map(d => ({ x: d.count, y: 0, z: 1, domain: d.domain }));

  // ── Anomaly detection ───────────────────────────────────────────────────────
  const allDomains = [...topBlocked, ...topAllowed];
  const avgCount = allDomains.length > 0
    ? allDomains.reduce((s, d) => s + d.count, 0) / allDomains.length
    : 0;
  const anomalies = allDomains.filter(d => d.count > avgCount * 3).sort((a, b) => b.count - a.count);

  // ── Hourly heatmap helpers ──────────────────────────────────────────────────
  const hourlyMap: Record<number, number> = {};
  hourlyData.forEach(h => { hourlyMap[h.hour] = h.count; });
  const maxHourlyCount = Math.max(1, ...hourlyData.map(h => h.count));

  return (
    <AnimatedPage>
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <PageHeader
          icon={<AssessmentIcon />}
          title="Reports & Analytics"
          subtitle={`DNS activity report — ${PERIOD_LABELS[period]}${period === 'CUSTOM' ? ` (${appliedStart} → ${appliedEnd})` : ''}`}
          iconColor="#1565C0"
        />
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleDownloadCsv}
            disabled={!profileId || daily.length === 0}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              borderColor: '#1565C0',
              color: '#1565C0',
              '&:hover': { bgcolor: '#E8F0FE', borderColor: '#1565C0' },
            }}
          >
            Export CSV
          </Button>
          <Button
            variant="contained"
            startIcon={pdfLoading ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
            onClick={handleDownloadPdf}
            disabled={pdfLoading || !profileId}
            sx={{
              bgcolor: '#C62828',
              '&:hover': { bgcolor: '#B71C1C' },
              '&:disabled': { bgcolor: '#E0E0E0' },
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {pdfLoading ? 'Downloading…' : 'Download PDF'}
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%', borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Period Selector + Date Range Row */}
      <AnimatedPage delay={0.05}>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Tabs
            value={period}
            onChange={(_, v) => setPeriod(v as Period)}
            sx={{
              minHeight: 40,
              '& .MuiTabs-indicator': { height: 3, borderRadius: 2 },
              '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600, fontSize: 14 },
            }}
          >
            <Tab label="Today" value="TODAY" />
            <Tab label="This Week" value="WEEK" />
            <Tab label="This Month" value="MONTH" />
            <Tab label="Custom" value="CUSTOM" />
          </Tabs>

          {period === 'CUSTOM' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                label="From"
                type="date"
                size="small"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                inputProps={{ max: endDate }}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
              <TextField
                label="To"
                type="date"
                size="small"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                inputProps={{ min: startDate, max: todayStr() }}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<FilterListIcon />}
                onClick={applyDateRange}
                disabled={!startDate || !endDate || startDate > endDate}
                sx={{ height: 40, fontWeight: 600, textTransform: 'none', borderRadius: 2 }}
              >
                Apply
              </Button>
            </Box>
          )}
        </Box>
      </AnimatedPage>

      {/* Summary Stats Row */}
      {loading ? (
        <LoadingPage />
      ) : (
        <>
          {/* KPI cards with trend arrows */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ position: 'relative' }}>
                <StatCard
                  title="Total Queries"
                  value={fmt(totalQ)}
                  icon={<DnsIcon />}
                  gradient={gradients.blue}
                  delay={0.1}
                />
                {prevStats && (
                  <Box sx={{
                    position: 'absolute', top: 10, right: 12,
                    display: 'flex', alignItems: 'center', gap: 0.25,
                    bgcolor: 'rgba(255,255,255,0.85)', borderRadius: 1, px: 0.75, py: 0.25,
                  }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#546E7A' }}>
                      {trendPct(totalQ, prevStats.totalQueries)}
                    </Typography>
                    {trendIcon(totalQ, prevStats.totalQueries)}
                  </Box>
                )}
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ position: 'relative' }}>
                <StatCard
                  title="Blocked"
                  value={fmt(totalB)}
                  icon={<BlockIcon />}
                  gradient={gradients.red}
                  delay={0.15}
                />
                {prevStats && (
                  <Box sx={{
                    position: 'absolute', top: 10, right: 12,
                    display: 'flex', alignItems: 'center', gap: 0.25,
                    bgcolor: 'rgba(255,255,255,0.85)', borderRadius: 1, px: 0.75, py: 0.25,
                  }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#546E7A' }}>
                      {trendPct(totalB, prevStats.totalBlocked)}
                    </Typography>
                    {trendIcon(totalB, prevStats.totalBlocked, true)}
                  </Box>
                )}
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ position: 'relative' }}>
                <StatCard
                  title="Allowed"
                  value={fmt(totalA)}
                  icon={<CheckCircleIcon />}
                  gradient={gradients.green}
                  delay={0.2}
                />
                {prevStats && (
                  <Box sx={{
                    position: 'absolute', top: 10, right: 12,
                    display: 'flex', alignItems: 'center', gap: 0.25,
                    bgcolor: 'rgba(255,255,255,0.85)', borderRadius: 1, px: 0.75, py: 0.25,
                  }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#546E7A' }}>
                      {trendPct(totalA, prevStats.totalAllowed)}
                    </Typography>
                    {trendIcon(totalA, prevStats.totalAllowed)}
                  </Box>
                )}
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ position: 'relative' }}>
                <StatCard
                  title="Block Rate"
                  value={`${blockRate}%`}
                  icon={<TrendingUpIcon />}
                  gradient={gradients.purple}
                  delay={0.25}
                />
                {prevStats && (
                  <Box sx={{
                    position: 'absolute', top: 10, right: 12,
                    display: 'flex', alignItems: 'center', gap: 0.25,
                    bgcolor: 'rgba(255,255,255,0.85)', borderRadius: 1, px: 0.75, py: 0.25,
                  }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#546E7A' }}>
                      {trendPct(blockRateNum, prevStats.blockRate)}
                    </Typography>
                    {trendIcon(blockRateNum, prevStats.blockRate, true)}
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>

          {/* Gauge + Anomaly detection row */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Block Rate Gauge */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                    Block Rate Gauge
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Percentage of queries blocked
                  </Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="100%"
                      startAngle={180}
                      endAngle={0}
                      data={gaugeData}
                      barSize={18}
                    >
                      <RadialBar
                        dataKey="value"
                        cornerRadius={8}
                        background={{ fill: '#F1F5F9' }}
                      />
                      <GaugeCenterLabel cx={0} cy={0} value={blockRateNum} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#1565C0' }} />
                      <Typography variant="caption" color="text.secondary">Blocked</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#43A047' }} />
                      <Typography variant="caption" color="text.secondary">Allowed</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Anomaly Detection */}
            <Grid size={{ xs: 12, sm: 8 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <WarningAmberIcon sx={{ color: '#F57F17', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Anomaly Detection
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Domains with query count &gt;3× the average ({avgCount > 0 ? `avg: ${avgCount.toFixed(0)}` : 'no data'})
                  </Typography>
                  {topBlockedQuery.isLoading || topAllowedQuery.isLoading ? (
                    <LoadingPage />
                  ) : anomalies.length === 0 ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2, color: '#43A047' }}>
                      <CheckCircleIcon sx={{ fontSize: 28 }} />
                      <Typography variant="body2" color="text.secondary">
                        No anomalies detected — traffic patterns look normal
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={1}>
                      {anomalies.slice(0, 6).map(d => {
                        const ratio = avgCount > 0 ? (d.count / avgCount) : 1;
                        const isBlocked = topBlocked.some(b => b.domain === d.domain);
                        return (
                          <Box
                            key={d.domain}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 1.5,
                              p: 1, borderRadius: 1.5,
                              bgcolor: isBlocked ? '#FFF8E1' : '#F3E5F5',
                              border: `1px solid ${isBlocked ? '#FFE082' : '#CE93D8'}`,
                            }}
                          >
                            <WarningAmberIcon sx={{ fontSize: 16, color: isBlocked ? '#F57F17' : '#9C27B0', flexShrink: 0 }} />
                            <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }} noWrap>
                              {d.domain}
                            </Typography>
                            <Chip
                              size="small"
                              label={`${ratio.toFixed(1)}× avg`}
                              sx={{
                                height: 20, fontSize: 10, fontWeight: 700,
                                bgcolor: isBlocked ? '#FFE082' : '#CE93D8',
                                color: isBlocked ? '#5D4037' : '#4A148C',
                              }}
                            />
                            <Chip
                              size="small"
                              label={fmt(d.count)}
                              sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: '#F5F5F5', color: '#424242' }}
                            />
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Hourly Activity Heatmap */}
          <AnimatedPage delay={0.28}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                  Hourly Activity Heatmap — Today
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Query intensity by hour (0–23). Hover a cell for details.
                </Typography>
                {hourlyQuery.isLoading ? (
                  <LoadingPage />
                ) : (
                  <Box>
                    <Box sx={{ display: 'flex', gap: '2px', flexWrap: 'nowrap', overflowX: 'auto', pb: 1 }}>
                      {Array.from({ length: 24 }, (_, hour) => {
                        const count = hourlyMap[hour] ?? 0;
                        const ratio = maxHourlyCount > 0 ? count / maxHourlyCount : 0;
                        const bg = count === 0 ? '#F1F5F9' : interpolateColor(ratio);
                        const isHovered = hoveredHour?.hour === hour;
                        return (
                          <MuiTooltip
                            key={hour}
                            title={`${hour}:00 — ${count} queries`}
                            arrow
                            placement="top"
                          >
                            <Box
                              onMouseEnter={() => setHoveredHour({ hour, count })}
                              onMouseLeave={() => setHoveredHour(null)}
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: 1,
                                bgcolor: bg,
                                flexShrink: 0,
                                cursor: 'default',
                                border: isHovered ? '2px solid #1565C0' : '2px solid transparent',
                                transition: 'border 0.1s, transform 0.1s',
                                transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                                boxShadow: isHovered ? '0 2px 6px rgba(21,101,192,0.3)' : 'none',
                              }}
                            />
                          </MuiTooltip>
                        );
                      })}
                    </Box>
                    {/* Hour labels */}
                    <Box sx={{ display: 'flex', gap: '2px', flexWrap: 'nowrap', overflowX: 'auto', mt: 0.5 }}>
                      {Array.from({ length: 24 }, (_, hour) => (
                        <Box
                          key={hour}
                          sx={{
                            width: 32, height: 16, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Typography sx={{ fontSize: 9, color: '#90A4AE', fontFamily: '"JetBrains Mono", monospace' }}>
                            {hour}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                    {/* Legend gradient bar */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">Low</Typography>
                      <Box sx={{
                        height: 8,
                        width: 120,
                        borderRadius: 1,
                        background: 'linear-gradient(to right, #E3F2FD, #0D47A1)',
                      }} />
                      <Typography variant="caption" color="text.secondary">High</Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>

          {/* Chart Tabs */}
          <AnimatedPage delay={0.3}>
            <Box sx={{ mb: 2 }}>
              <Tabs
                value={chartTab}
                onChange={(_, v) => setChartTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  mb: 3,
                  borderBottom: '1px solid #E8EDF2',
                  '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
                }}
              >
                <Tab label="Daily Activity" />
                <Tab label="Category Breakdown" />
                <Tab label="Top Blocked Domains" />
                <Tab label="Recent Activity" />
                <Tab label="App Usage" />
                <Tab label="Scatter Analysis" />
              </Tabs>

              {/* Tab 0: Daily Activity BarChart */}
              {chartTab === 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                      DNS Queries vs Blocked
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      {days === 1 ? 'Hourly breakdown' : `Daily breakdown — last ${days} days`}
                    </Typography>
                    {dailyQuery.isLoading ? (
                      <LoadingPage />
                    ) : daily.length === 0 ? (
                      <EmptyState
                        icon={<DnsIcon sx={{ fontSize: 36, color: '#1565C0' }} />}
                        title="No activity data yet"
                        description="DNS activity will appear here after the child starts browsing"
                      />
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        {days > 7 ? (
                          <AreaChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                            <defs>
                              <linearGradient id="reportGradQ" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1565C0" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#1565C0" stopOpacity={0.02} />
                              </linearGradient>
                              <linearGradient id="reportGradB" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#E53935" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#E53935" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                            <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, border: '1px solid #E8EDF2' }} />
                            <Legend />
                            <Area type="monotone" dataKey="queries" name="Total Queries" stroke="#1565C0" strokeWidth={2} fill="url(#reportGradQ)" dot={false} />
                            <Area type="monotone" dataKey="blocks" name="Blocked" stroke="#E53935" strokeWidth={2} fill="url(#reportGradB)" dot={false} />
                          </AreaChart>
                        ) : (
                          <BarChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                            <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, border: '1px solid #E8EDF2' }} />
                            <Legend />
                            <Bar dataKey="allowed" name="Allowed" fill="#43A047" radius={[4, 4, 0, 0]} stackId="a" />
                            <Bar dataKey="blocks" name="Blocked" fill="#E53935" radius={[4, 4, 0, 0]} stackId="a" />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tab 1: Category Breakdown — Donut + details */}
              {chartTab === 1 && (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                          Blocked Categories
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Content types that were blocked
                        </Typography>
                        {catQuery.isLoading ? (
                          <LoadingPage />
                        ) : categories.length === 0 ? (
                          <Box sx={{ textAlign: 'center', py: 4 }}>
                            <CategoryIcon sx={{ fontSize: 40, color: '#ccc', mb: 1 }} />
                            <Typography color="text.secondary">No category data available</Typography>
                          </Box>
                        ) : (
                          <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                              <Pie
                                data={categories}
                                cx="50%"
                                cy="50%"
                                outerRadius={105}
                                innerRadius={55}
                                dataKey="value"
                                paddingAngle={2}
                                label={({ name, percent }: { name: string; percent: number }) =>
                                  percent > 0.08 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                                }
                                labelLine={false}
                              >
                                {categories.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: number) => [fmt(v), 'Queries']} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid size={{ xs: 12, md: 7 }}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                          Category Details
                        </Typography>
                        {catQuery.isLoading ? (
                          <LoadingPage />
                        ) : categories.length === 0 ? (
                          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            No data for this period
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
                                    {fmt(cat.value)}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, textAlign: 'right' }}>
                                    {cat.percent}%
                                  </Typography>
                                </Box>
                                <LinearProgress
                                  variant="determinate"
                                  value={cat.percent}
                                  sx={{
                                    height: 4,
                                    borderRadius: 2,
                                    bgcolor: '#F0F0F0',
                                    ml: 2.5,
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
              )}

              {/* Tab 2: Top Blocked Domains */}
              {chartTab === 2 && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                      Top Blocked Domains
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Most frequently blocked sites
                    </Typography>
                    {topBlockedQuery.isLoading ? (
                      <LoadingPage />
                    ) : topBlocked.length === 0 ? (
                      <EmptyState
                        icon={<BlockIcon sx={{ fontSize: 36, color: '#E53935' }} />}
                        title="No blocked domains"
                        description="No domains have been blocked yet during this period"
                      />
                    ) : (
                      <Stack spacing={0}>
                        {topBlocked.map((d, i) => (
                          <Box key={d.domain}>
                            <Box sx={{
                              display: 'flex', alignItems: 'center', gap: 2,
                              py: 1.5, px: 1,
                              borderRadius: 1.5,
                              '&:hover': { bgcolor: '#F8FAFC' },
                              transition: 'background 0.15s',
                            }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  minWidth: 24, fontWeight: 700, color: '#9E9E9E',
                                  fontFamily: '"JetBrains Mono", monospace',
                                }}
                              >
                                #{i + 1}
                              </Typography>
                              <LanguageIcon sx={{ fontSize: 18, color: '#E53935', flexShrink: 0 }} />
                              <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }} noWrap>
                                {d.domain}
                              </Typography>
                              <Box sx={{ flex: 2, mx: 2 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.round((d.count / maxBlocked) * 100)}
                                  sx={{
                                    height: 6, borderRadius: 3,
                                    bgcolor: '#FFE5E5',
                                    '& .MuiLinearProgress-bar': { bgcolor: '#E53935', borderRadius: 3 },
                                  }}
                                />
                              </Box>
                              <Chip
                                label={fmt(d.count)}
                                size="small"
                                sx={{
                                  bgcolor: '#FFE5E5', color: '#C62828',
                                  fontWeight: 700, height: 22, fontSize: 11,
                                }}
                              />
                            </Box>
                            {i < topBlocked.length - 1 && <Divider sx={{ opacity: 0.5 }} />}
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tab 3: Recent Activity */}
              {chartTab === 3 && (
                <Card>
                  <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
                      <Typography variant="subtitle1" fontWeight={600}>Recent Activity</Typography>
                      <Typography variant="body2" color="text.secondary">Latest DNS queries from this profile</Typography>
                    </Box>
                    {historyQuery.isLoading ? (
                      <LoadingPage />
                    ) : history.length === 0 ? (
                      <EmptyState
                        icon={<DnsIcon sx={{ fontSize: 36, color: '#1565C0' }} />}
                        title="No recent activity"
                        description="DNS queries will appear here once the child starts browsing"
                      />
                    ) : (
                      <>
                        {historyQuery.isFetching && (
                          <LinearProgress sx={{ mx: 0 }} />
                        )}
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ '& th': { fontWeight: 700, color: '#546E7A', fontSize: 12, bgcolor: '#F8FAFC' } }}>
                              <TableCell>Domain</TableCell>
                              <TableCell>Category</TableCell>
                              <TableCell align="center">Action</TableCell>
                              <TableCell align="right">Time</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {history.map((ev, i) => (
                              <TableRow
                                key={ev.id || i}
                                sx={{
                                  borderLeft: `3px solid ${ev.action === 'BLOCKED' ? '#E53935' : '#43A047'}`,
                                  '&:hover': { bgcolor: '#FAFBFC' },
                                  '& td': { py: 1 },
                                }}
                              >
                                <TableCell>
                                  <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 240 }}>
                                    {ev.domain}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={ev.category || 'Unknown'}
                                    size="small"
                                    sx={{
                                      height: 20, fontSize: 11,
                                      bgcolor: '#F1F5F9', color: '#546E7A',
                                    }}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    size="small"
                                    label={ev.action}
                                    color={ev.action === 'BLOCKED' ? 'error' : 'success'}
                                    sx={{ height: 22, fontSize: 11, fontWeight: 700 }}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>
                                    {relativeTime(ev.queriedAt)}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <TablePagination
                          component="div"
                          count={historyQuery.data?.totalElements ?? 0}
                          page={histPage}
                          onPageChange={(_, p) => setHistPage(p)}
                          rowsPerPage={histRowsPerPage}
                          onRowsPerPageChange={(e) => { setHistRowsPerPage(+e.target.value); setHistPage(0); }}
                          rowsPerPageOptions={[10, 20, 50]}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tab 4: App Usage */}
              {chartTab === 4 && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                      App Usage
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Time spent per app (top 10)
                    </Typography>
                    {appUsageQuery.isLoading ? (
                      <LoadingPage />
                    ) : appUsage.length === 0 ? (
                      <EmptyState
                        icon={<LanguageIcon sx={{ fontSize: 36, color: '#1565C0' }} />}
                        title="No app usage data yet"
                        description="App usage will appear here after the child uses the Shield app on their device"
                      />
                    ) : (
                      <>
                        {/* Recharts BarChart for app usage */}
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart
                            layout="vertical"
                            data={[...appUsage]
                              .sort((a, b) => b.totalMinutes - a.totalMinutes)
                              .slice(0, 10)
                              .map(a => ({ name: a.appName, minutes: a.totalMinutes, blocked: a.blockedCount ?? 0 }))}
                            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0F0F0" />
                            <XAxis type="number" tickFormatter={v => `${v}m`} tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                            <Tooltip
                              formatter={(v: number, name: string) => [name === 'minutes' ? `${v} min` : v, name === 'minutes' ? 'Usage' : 'Blocked']}
                              contentStyle={{ borderRadius: 8, border: '1px solid #E8EDF2' }}
                            />
                            <Legend />
                            <Bar dataKey="minutes" name="Usage (min)" fill="#1565C0" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="blocked" name="Blocked queries" fill="#E53935" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tab 5: Scatter Analysis */}
              {chartTab === 5 && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                      Scatter Analysis — Domain Frequency vs Block Status
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Each dot is a domain. X-axis = query count, Y-axis = block status.
                      Red = blocked, Green = allowed. Hover for domain name.
                    </Typography>
                    {(topBlockedQuery.isLoading || topAllowedQuery.isLoading) ? (
                      <LoadingPage />
                    ) : (scatterBlocked.length === 0 && scatterAllowed.length === 0) ? (
                      <EmptyState
                        icon={<AssessmentIcon sx={{ fontSize: 36, color: '#1565C0' }} />}
                        title="No domain data available"
                        description="Domain frequency data will appear once DNS activity is recorded"
                      />
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <ScatterChart margin={{ top: 12, right: 24, left: 0, bottom: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                          <XAxis
                            type="number"
                            dataKey="x"
                            name="Query Count"
                            tickFormatter={fmt}
                            tick={{ fontSize: 11 }}
                            label={{ value: 'Query Count', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#78909C' }}
                          />
                          <YAxis
                            type="number"
                            dataKey="y"
                            name="Block Status"
                            domain={[-20, 120]}
                            ticks={[0, 100]}
                            tickFormatter={v => v === 100 ? 'Blocked' : 'Allowed'}
                            tick={{ fontSize: 11 }}
                            width={60}
                          />
                          <ZAxis type="number" dataKey="z" range={[60, 60]} />
                          <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ payload }) => {
                              if (!payload || payload.length === 0) return null;
                              const d = payload[0]?.payload as { x: number; y: number; domain: string };
                              return (
                                <Box sx={{
                                  bgcolor: 'white', border: '1px solid #E8EDF2',
                                  borderRadius: 1.5, p: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                }}>
                                  <Typography variant="body2" fontWeight={700}>{d.domain}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {fmt(d.x)} queries — {d.y === 100 ? 'Blocked' : 'Allowed'}
                                  </Typography>
                                </Box>
                              );
                            }}
                          />
                          <Legend />
                          {scatterBlocked.length > 0 && (
                            <Scatter
                              name="Blocked"
                              data={scatterBlocked}
                              fill="#E53935"
                              fillOpacity={0.8}
                            />
                          )}
                          {scatterAllowed.length > 0 && (
                            <Scatter
                              name="Allowed"
                              data={scatterAllowed}
                              fill="#43A047"
                              fillOpacity={0.8}
                            />
                          )}
                        </ScatterChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              )}

            </Box>
          </AnimatedPage>

          {statsQuery.isError && dailyQuery.isError && catQuery.isError && (
            <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
              No report data is available yet. Data will appear after the child starts using their device.
            </Alert>
          )}
        </>
      )}
    </AnimatedPage>
  );
}
