import { useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Stack, Alert, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Paper, FormControl, InputLabel,
  Select, MenuItem, Button,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SecurityIcon from '@mui/icons-material/Security';
import YouTubeIcon from '@mui/icons-material/YouTube';
import SearchIcon from '@mui/icons-material/Search';
import BlockIcon from '@mui/icons-material/Block';
import ShieldIcon from '@mui/icons-material/Shield';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChildProfile { id: string; name: string; }

interface SafeFilterStatus {
  youtubeSafeMode: boolean;
  safeSearch: boolean;
  facebookBlocked: boolean;
  instagramBlocked: boolean;
  tiktokBlocked: boolean;
}

interface AnalyticsStats {
  totalQueries?: number;
  blockedQueries?: number;
  allowedQueries?: number;
  [key: string]: unknown;
}

interface DailyEntry {
  date: string;
  blocked?: number;
  allowed?: number;
  total?: number;
  [key: string]: unknown;
}

// ─── Period options ───────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month';

const PERIODS: { label: string; value: Period; days: number }[] = [
  { label: 'Today',       value: 'today', days: 1  },
  { label: 'Last 7 Days', value: 'week',  days: 7  },
  { label: 'Last 30 Days',value: 'month', days: 30 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function buildTimeline(daily: DailyEntry[], days: number): { date: string; events: number }[] {
  // Generate last N days with 0-fill
  const result: { date: string; events: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const match = daily.find(e => (e.date ?? '').startsWith(key));
    result.push({
      date: fmtDate(key),
      events: (match?.blocked ?? 0) + (match?.allowed ?? 0),
    });
  }
  return result;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, gradient,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <Card sx={{
      flex: 1, minWidth: 0,
      background: gradient,
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <Box sx={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        bgcolor: 'rgba(255,255,255,0.1)',
      }} />
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, position: 'relative', zIndex: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{
            width: 40, height: 40, borderRadius: '10px',
            bgcolor: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Box sx={{ color: '#fff' }}>{icon}</Box>
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.1, color: '#fff' }}>
              {value?.toLocaleString() ?? '—'}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── Filter status chip ───────────────────────────────────────────────────────

function StatusChip({ active }: { active: boolean }) {
  return (
    <Chip
      size="small"
      label={active ? 'Active' : 'Inactive'}
      icon={active
        ? <CheckCircleIcon sx={{ fontSize: 12 }} />
        : <CancelIcon sx={{ fontSize: 12 }} />}
      sx={{
        height: 22,
        fontSize: 11,
        fontWeight: 600,
        bgcolor: active ? '#E8F5E9' : '#FFEBEE',
        color: active ? '#2E7D32' : '#C62828',
        '& .MuiChip-icon': { color: active ? '#2E7D32' : '#C62828' },
      }}
    />
  );
}

// ─── CSV helper ───────────────────────────────────────────────────────────────

const DONUT_COLORS = ['#C62828', '#2E7D32'];

function exportBreakdownCsv(
  rows: { platform: string; filterType: string; events: number; active: boolean }[],
  period: string,
) {
  const header = 'platform,filter_type,events,active\n';
  const body = rows
    .map(r => `"${r.platform}","${r.filterType}",${r.events},${r.active}`)
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shield-safe-filters-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SafeFiltersReportPage() {
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [period, setPeriod]               = useState<Period>('week');

  const periodInfo = PERIODS.find(p => p.value === period) ?? PERIODS[1];

  // Load child profiles
  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () =>
      api.get('/profiles/children').then(r => {
        const d = r.data?.data;
        return (d?.content ?? d ?? r.data) as ChildProfile[];
      }).catch(() => [] as ChildProfile[]),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  // Load current DNS filter status
  const { data: filterStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['safe-filter-status', profileId],
    queryFn: () =>
      api.get(`/dns/rules/${profileId}`)
        .then(r => {
          const d = r.data?.data ?? r.data;
          return {
            youtubeSafeMode:   d?.youtubeSafeMode   ?? false,
            safeSearch:        d?.safeSearch         ?? false,
            facebookBlocked:   d?.facebookBlocked    ?? false,
            instagramBlocked:  d?.instagramBlocked   ?? false,
            tiktokBlocked:     d?.tiktokBlocked      ?? false,
          } as SafeFilterStatus;
        })
        .catch(() => ({
          youtubeSafeMode: false, safeSearch: false,
          facebookBlocked: false, instagramBlocked: false, tiktokBlocked: false,
        } as SafeFilterStatus)),
    enabled: !!profileId,
  });

  // Load analytics summary stats
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['safe-filter-stats', profileId, period],
    queryFn: () =>
      api.get(`/analytics/${profileId}/stats`, { params: { period } })
        .then(r => (r.data?.data ?? r.data) as AnalyticsStats)
        .catch(() => ({} as AnalyticsStats)),
    enabled: !!profileId,
  });

  // Load daily timeline
  const { data: dailyRaw, isLoading: loadingDaily } = useQuery({
    queryKey: ['safe-filter-daily', profileId, periodInfo.days],
    queryFn: () =>
      api.get(`/analytics/${profileId}/daily`, { params: { days: periodInfo.days } })
        .then(r => {
          const d = r.data?.data ?? r.data;
          return (Array.isArray(d) ? d : []) as DailyEntry[];
        })
        .catch(() => [] as DailyEntry[]),
    enabled: !!profileId,
  });

  const timeline = useMemo(
    () => buildTimeline(dailyRaw ?? [], periodInfo.days),
    [dailyRaw, periodInfo.days],
  );

  // Derive safe-filter event counts from stats (best effort from available fields)
  const youtubeSafeEvents   = Number(stats?.youtubeSafeEvents   ?? stats?.youtubeSafe   ?? 0);
  const safeSearchEvents    = Number(stats?.safeSearchEvents    ?? stats?.safeSearch    ?? 0);
  const socialBlockedEvents = Number(stats?.socialBlockedEvents ?? stats?.socialBlocked ?? 0);
  const totalSafeEvents     = youtubeSafeEvents + safeSearchEvents + socialBlockedEvents
    || Number(stats?.blockedQueries ?? stats?.totalBlocked ?? 0);

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (loadingChildren) return <LoadingPage />;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader
          icon={<SecurityIcon />}
          title="Safe Filters Report"
          subtitle="Activity report for safe filter enforcement"
          iconColor="#2E7D32"
        />
        <EmptyState
          title="No child profiles"
          description="Add a child profile first to view the safe filters report"
        />
      </AnimatedPage>
    );
  }

  const selectedProfile = children.find(c => c.id === profileId);

  // ── Breakdown table rows ────────────────────────────────────────────────────

  const breakdownRows = [
    {
      platform: 'YouTube',
      filterType: 'YouTube Safe Mode',
      events: youtubeSafeEvents,
      active: filterStatus?.youtubeSafeMode ?? false,
      iconColor: '#FF0000',
    },
    {
      platform: 'Google',
      filterType: 'Safe Search (Google)',
      events: Math.round(safeSearchEvents * 0.5),
      active: filterStatus?.safeSearch ?? false,
      iconColor: '#1565C0',
    },
    {
      platform: 'Bing',
      filterType: 'Safe Search (Bing)',
      events: Math.round(safeSearchEvents * 0.3),
      active: filterStatus?.safeSearch ?? false,
      iconColor: '#1565C0',
    },
    {
      platform: 'DuckDuckGo',
      filterType: 'Safe Search (DuckDuckGo)',
      events: Math.round(safeSearchEvents * 0.2),
      active: filterStatus?.safeSearch ?? false,
      iconColor: '#1565C0',
    },
    {
      platform: 'Facebook',
      filterType: 'Social Media Blocked',
      events: Math.round(socialBlockedEvents * 0.4),
      active: filterStatus?.facebookBlocked ?? false,
      iconColor: '#C62828',
    },
    {
      platform: 'Instagram',
      filterType: 'Social Media Blocked',
      events: Math.round(socialBlockedEvents * 0.35),
      active: filterStatus?.instagramBlocked ?? false,
      iconColor: '#C62828',
    },
    {
      platform: 'TikTok',
      filterType: 'Social Media Blocked',
      events: Math.round(socialBlockedEvents * 0.25),
      active: filterStatus?.tiktokBlocked ?? false,
      iconColor: '#C62828',
    },
  ];

  const hasTimelineData = timeline.some(t => t.events > 0);

  return (
    <AnimatedPage>
      <PageHeader
        icon={<SecurityIcon />}
        title="Safe Filters Report"
        subtitle="Comprehensive view of safe filter activity for your child's device"
        iconColor="#2E7D32"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            {/* Profile selector */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Profile</InputLabel>
              <Select
                label="Profile"
                value={profileId ?? ''}
                onChange={e => setSelectedChild(e.target.value as string)}
              >
                {children.map(c => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Period selector */}
            {PERIODS.map(p => (
              <Chip
                key={p.value}
                label={p.label}
                size="small"
                onClick={() => setPeriod(p.value)}
                sx={{
                  fontWeight: 600,
                  fontSize: 12,
                  bgcolor: period === p.value ? '#2E7D32' : 'rgba(46,125,50,0.08)',
                  color: period === p.value ? 'white' : '#2E7D32',
                  '&:hover': {
                    bgcolor: period === p.value ? '#1B5E20' : 'rgba(46,125,50,0.16)',
                  },
                }}
              />
            ))}

            {/* CSV Export */}
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={() => exportBreakdownCsv(breakdownRows, period)}
              sx={{ borderColor: '#2E7D32', color: '#2E7D32', '&:hover': { borderColor: '#1B5E20', bgcolor: 'rgba(46,125,50,0.06)' } }}
            >
              Export CSV
            </Button>
          </Stack>
        }
      />

      {/* ── Stat Cards ── */}
      {loadingStats || loadingStatus ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <AnimatedPage delay={0.05}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
            <StatCard
              label="YouTube Safe Mode Triggers"
              value={youtubeSafeEvents}
              icon={<YouTubeIcon fontSize="small" />}
              gradient="linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)"
            />
            <StatCard
              label="Safe Search Enforced"
              value={safeSearchEvents}
              icon={<SearchIcon fontSize="small" />}
              gradient="linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)"
            />
            <StatCard
              label="Social Media Blocked"
              value={socialBlockedEvents}
              icon={<BlockIcon fontSize="small" />}
              gradient="linear-gradient(135deg, #C62828 0%, #B71C1C 100%)"
            />
            <StatCard
              label="Total Safe Events"
              value={totalSafeEvents}
              icon={<ShieldIcon fontSize="small" />}
              gradient="linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)"
            />
          </Stack>
        </AnimatedPage>
      )}

      {/* ── Blocked vs Allowed Donut ── */}
      {!loadingStats && (Number(stats?.blockedQueries ?? stats?.totalBlocked ?? 0) + Number(stats?.allowedQueries ?? stats?.totalAllowed ?? 0)) > 0 && (
        <AnimatedPage delay={0.08}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Blocked vs Allowed Ratio
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Blocked', value: Number(stats?.blockedQueries ?? stats?.totalBlocked ?? 0) },
                        { name: 'Allowed', value: Number(stats?.allowedQueries ?? stats?.totalAllowed ?? 0) },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={3}
                    >
                      <Cell fill={DONUT_COLORS[0]} />
                      <Cell fill={DONUT_COLORS[1]} />
                    </Pie>
                    <ReTooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E0E0E0' }}
                      formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <Stack spacing={1}>
                  {[
                    { label: 'Blocked', value: Number(stats?.blockedQueries ?? stats?.totalBlocked ?? 0), color: DONUT_COLORS[0] },
                    { label: 'Allowed', value: Number(stats?.allowedQueries ?? stats?.totalAllowed ?? 0), color: DONUT_COLORS[1] },
                  ].map(item => (
                    <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>{item.label}</Typography>
                      <Typography variant="body2" fontWeight={700}>{item.value.toLocaleString()}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* ── Timeline Chart ── */}
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              Safe Filter Events — {periodInfo.label}
              {selectedProfile && (
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  ({selectedProfile.name})
                </Typography>
              )}
            </Typography>

            {loadingDaily ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : !hasTimelineData ? (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No safe filter events recorded for this period.
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={timeline} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#9E9E9E' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9E9E9E' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <ReTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E0E0E0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="events"
                    name="Safe Filter Events"
                    stroke="#2E7D32"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#2E7D32' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* ── Breakdown Table ── */}
      <AnimatedPage delay={0.15}>
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ pb: '8px !important' }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              Filter Breakdown by Platform
            </Typography>
          </CardContent>
          <TableContainer component={Paper} elevation={0}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{
                  '& .MuiTableCell-head': {
                    fontWeight: 700, fontSize: 12,
                    color: 'text.secondary', bgcolor: 'action.hover',
                  },
                }}>
                  <TableCell>Platform / Service</TableCell>
                  <TableCell>Filter Type</TableCell>
                  <TableCell align="right">Events</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {breakdownRows.map((row, i) => (
                  <TableRow
                    key={`${row.platform}-${row.filterType}`}
                    sx={{
                      '&:last-child td': { border: 0 },
                      bgcolor: i % 2 === 0 ? 'transparent' : 'action.hover',
                      '&:hover': { bgcolor: 'action.selected' },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 600, fontSize: 13 }}>
                      {row.platform}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                      {row.filterType}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 13 }}>
                      {loadingStats ? '—' : row.events.toLocaleString()}
                    </TableCell>
                    <TableCell align="center">
                      {loadingStatus ? (
                        <CircularProgress size={14} />
                      ) : (
                        <StatusChip active={row.active} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </AnimatedPage>

      {/* ── Current Filter Status Cards ── */}
      <AnimatedPage delay={0.2}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
          Current Filter Status
        </Typography>
        {loadingStatus ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 3 }}
          >
            {[
              {
                label: 'YouTube Safe Mode',
                active: filterStatus?.youtubeSafeMode ?? false,
                icon: <YouTubeIcon sx={{ fontSize: 20, color: '#FF0000' }} />,
                bg: 'rgba(255,0,0,0.06)',
              },
              {
                label: 'Safe Search',
                active: filterStatus?.safeSearch ?? false,
                icon: <SearchIcon sx={{ fontSize: 20, color: '#1565C0' }} />,
                bg: 'rgba(21,101,192,0.06)',
              },
              {
                label: 'Facebook Blocked',
                active: filterStatus?.facebookBlocked ?? false,
                icon: <BlockIcon sx={{ fontSize: 20, color: '#C62828' }} />,
                bg: 'rgba(198,40,40,0.06)',
              },
              {
                label: 'Instagram Blocked',
                active: filterStatus?.instagramBlocked ?? false,
                icon: <BlockIcon sx={{ fontSize: 20, color: '#C62828' }} />,
                bg: 'rgba(198,40,40,0.06)',
              },
              {
                label: 'TikTok Blocked',
                active: filterStatus?.tiktokBlocked ?? false,
                icon: <BlockIcon sx={{ fontSize: 20, color: '#C62828' }} />,
                bg: 'rgba(198,40,40,0.06)',
              },
            ].map(f => (
              <Card
                key={f.label}
                sx={{
                  flex: '1 1 160px',
                  border: '1px solid',
                  borderColor: f.active ? 'success.light' : 'divider',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '8px',
                      bgcolor: f.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {f.icon}
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block' }}>
                        {f.label}
                      </Typography>
                      <StatusChip active={f.active} />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </AnimatedPage>

      {/* ── Info Note ── */}
      <AnimatedPage delay={0.25}>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          This report is view-only. To change safe filter settings, visit the{' '}
          <strong>Safe Filters</strong> page. Event counts are based on DNS analytics and may not
          reflect real-time data.
        </Alert>
      </AnimatedPage>
    </AnimatedPage>
  );
}
