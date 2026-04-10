import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  TablePagination,
  TextField,
  InputAdornment,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import TimelineIcon from '@mui/icons-material/Timeline';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import BlockIcon from '@mui/icons-material/Block';
import PercentIcon from '@mui/icons-material/Percent';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Client } from '@stomp/stompjs';
import { useAuthStore } from '../../store/auth.store';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DnsEvent {
  id: string;
  domain: string;
  action: 'ALLOWED' | 'BLOCKED';
  category: string;
  queriedAt: string;
}

interface ActivityStats {
  totalQueries: number;
  totalBlocked: number;
  totalAllowed: number;
  blockRate: number;
}

interface HourlyBucket {
  hour: number;
  count: number;
}

interface CategoryBucket {
  category: string;
  count: number;
}

interface ActivityPageProps {
  profileId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DONUT_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444',
  '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
];

const EVENT_ROW_BASE_SX: SxProps<Theme> = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  px: 2.5,
  py: 1.5,
  borderBottom: '1px solid #F1F5F9',
  transition: 'all 0.2s ease',
  '&:hover': { bgcolor: '#FAFBFC' },
  '@keyframes slideInLeft': {
    from: { opacity: 0, transform: 'translateX(-20px)' },
    to: { opacity: 1, transform: 'translateX(0)' },
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];

function downloadCsv(rows: DnsEvent[], profileId: string) {
  if (rows.length === 0) return;
  const header = 'domain,action,category,timestamp\n';
  const body = rows
    .map(r => [
      `"${r.domain.replace(/"/g, '""')}"`,
      r.action,
      `"${(r.category ?? '').replace(/"/g, '""')}"`,
      new Date(r.queriedAt).toISOString(),
    ].join(','))
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shield-activity-${profileId}-${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActivityPage({ profileId: profileIdProp }: ActivityPageProps) {
  const theme = useTheme();
  const { profileId: profileIdParam } = useParams<{ profileId: string }>();
  const profileId = profileIdProp ?? profileIdParam;

  // ── Live feed state ────────────────────────────────────────────────────────
  const [recentEvents, setRecentEvents] = useState<DnsEvent[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  // ── History table state ────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ALLOWED' | 'BLOCKED'>('ALL');
  const [histPage, setHistPage] = useState(0);
  const [histRowsPerPage, setHistRowsPerPage] = useState(25);

  const token = useAuthStore((s) => s.accessToken);
  const onMessageRef = useRef<(data: DnsEvent) => void>(() => undefined);

  // ── Reset history page when profile changes ────────────────────────────────
  useEffect(() => {
    setHistPage(0);
  }, [profileId]);

  // ── WebSocket: live events ─────────────────────────────────────────────────
  useEffect(() => {
    onMessageRef.current = (data: DnsEvent) => {
      setRecentEvents((prev) => [data, ...prev].slice(0, 20));
    };
  });

  useEffect(() => {
    if (!profileId || !token) return;

    const client = new Client({
      brokerURL: `wss://${window.location.host}/ws/websocket`,
      connectHeaders: { Authorization: `Bearer ${token}` },
      onConnect: () => {
        setWsConnected(true);
        client.subscribe(`/topic/activity/${profileId}`, (msg) => {
          try {
            onMessageRef.current(JSON.parse(msg.body) as DnsEvent);
          } catch {
            // ignore malformed frames
          }
        });
      },
      onDisconnect: () => setWsConnected(false),
      onStompError: () => setWsConnected(false),
      reconnectDelay: 5000,
    });

    client.activate();
    return () => {
      setWsConnected(false);
      client.deactivate();
    };
  }, [profileId, token]);

  // ── Query: paginated history ───────────────────────────────────────────────
  const historyQuery = useQuery({
    queryKey: ['activity-history', profileId, histPage, histRowsPerPage],
    queryFn: () =>
      api
        .get(`/analytics/${profileId}/history`, {
          params: { page: histPage, size: histRowsPerPage },
        })
        .then((r) => {
          // Support both wrapped ({ data: { content, totalElements } }) and direct responses
          const payload = r.data?.data ?? r.data;
          const content: DnsEvent[] = Array.isArray(payload?.content)
            ? payload.content
            : Array.isArray(payload)
            ? payload
            : [];
          const totalElements: number =
            typeof payload?.totalElements === 'number' ? payload.totalElements : content.length;
          return { content, totalElements };
        })
        .catch(() => ({ content: [] as DnsEvent[], totalElements: 0 })),
    enabled: !!profileId,
    refetchInterval: 30_000,
  });

  // ── Query: today stats ─────────────────────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ['activity-stats', profileId],
    queryFn: () =>
      api
        .get(`/analytics/${profileId}/stats`, { params: { period: 'week' } })
        .then((r) => {
          const raw = r.data?.data ?? r.data;
          return {
            totalQueries: raw?.totalQueries ?? 0,
            totalBlocked: raw?.totalBlocked ?? raw?.blockedQueries ?? 0,
            totalAllowed: raw?.totalAllowed ?? raw?.allowedQueries ?? 0,
            blockRate: Number.isFinite(raw?.blockRate) ? raw.blockRate : 0,
          } as ActivityStats;
        })
        .catch(
          () => ({ totalQueries: 0, totalBlocked: 0, totalAllowed: 0, blockRate: 0 } as ActivityStats),
        ),
    enabled: !!profileId,
    refetchInterval: 30_000,
  });

  // ── Query: hourly activity ─────────────────────────────────────────────────
  const { data: hourlyData } = useQuery({
    queryKey: ['activity-hourly', profileId, todayStr()],
    queryFn: () =>
      api
        .get(`/analytics/${profileId}/hourly`, { params: { date: todayStr() } })
        .then((r) => {
          const raw = r.data?.data ?? r.data;
          // Normalise to full 24-hour array (fill missing hours with 0)
          const map = new Map<number, number>();
          (Array.isArray(raw) ? raw : []).forEach((b: HourlyBucket) => {
            map.set(Number(b.hour), Number(b.count) || 0);
          });
          return Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            label: `${String(h).padStart(2, '0')}:00`,
            count: map.get(h) ?? 0,
          }));
        })
        .catch(() =>
          Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            label: `${String(h).padStart(2, '0')}:00`,
            count: 0,
          })),
        ),
    enabled: !!profileId,
    refetchInterval: 60_000,
  });

  // ── Query: category breakdown ──────────────────────────────────────────────
  const { data: categoryData } = useQuery({
    queryKey: ['activity-categories', profileId],
    queryFn: () =>
      api
        .get(`/analytics/${profileId}/categories`, { params: { period: 'today' } })
        .then((r) => {
          const raw = r.data?.data ?? r.data;
          return (Array.isArray(raw) ? raw : []) as CategoryBucket[];
        })
        .catch(() => [] as CategoryBucket[]),
    enabled: !!profileId,
    refetchInterval: 60_000,
  });

  // ── Filtered live feed ─────────────────────────────────────────────────────
  const filteredFeed = recentEvents.filter(
    (e) =>
      (filter === 'ALL' || e.action === filter) &&
      (!search || e.domain.toLowerCase().includes(search.toLowerCase())),
  );

  // ── Filtered history rows (client-side filter on current page) ─────────────
  const historyRows = (historyQuery.data?.content ?? []).filter(
    (e) =>
      (filter === 'ALL' || e.action === filter) &&
      (!search || e.domain.toLowerCase().includes(search.toLowerCase())),
  );

  const blockRateDisplay = Number.isFinite(stats?.blockRate)
    ? `${stats!.blockRate.toFixed(1)}%`
    : '0.0%';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatedPage>
      <PageHeader
        icon={<TimelineIcon />}
        title="Live Activity"
        subtitle={[
          'Real-time DNS query monitoring',
          recentEvents.length > 0 ? `${recentEvents.length} live events` : '',
          stats ? `Block rate: ${blockRateDisplay}` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
        iconColor={theme.palette.primary.main}
      />

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <AnimatedPage delay={0.05}>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Total Today"
              value={stats?.totalQueries ?? 0}
              icon={<QueryStatsIcon />}
              gradient="linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)"
              delay={0}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Blocked (7d)"
              value={stats?.totalBlocked ?? 0}
              icon={<BlockIcon />}
              gradient="linear-gradient(135deg, #EF4444 0%, #F87171 100%)"
              delay={0.05}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Block Rate"
              value={Number.isFinite(stats?.blockRate) ? stats!.blockRate.toFixed(1) : '0.0'}
              unit="%"
              icon={<PercentIcon />}
              gradient="linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)"
              delay={0.1}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Live Status"
              value={wsConnected ? 'Connected' : 'Offline'}
              icon={wsConnected ? <WifiIcon /> : <WifiOffIcon />}
              gradient={
                wsConnected
                  ? 'linear-gradient(135deg, #10B981 0%, #34D399 100%)'
                  : 'linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)'
              }
              delay={0.15}
            />
          </Grid>
        </Grid>
      </AnimatedPage>

      {/* ── Live Feed + Donut ─────────────────────────────────────────────── */}
      <AnimatedPage delay={0.15}>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Live Event Feed */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ pb: 1 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                  Live Event Feed
                </Typography>
              </CardContent>
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                {filteredFeed.length === 0 ? (
                  <EmptyState
                    icon={<WifiIcon sx={{ fontSize: 36, color: 'primary.main' }} />}
                    title="Waiting for DNS events..."
                    description="Events will appear here in real-time as they are processed"
                  />
                ) : (
                  <Box sx={{ maxHeight: 340, overflowY: 'auto' }}>
                    {filteredFeed.map((ev, i) => (
                      <Box
                        key={ev.id || i}
                        sx={{
                          ...EVENT_ROW_BASE_SX,
                          borderLeft: `4px solid ${
                            ev.action === 'BLOCKED'
                              ? theme.palette.error.main
                              : theme.palette.success.main
                          }`,
                          animation: `slideInLeft 0.3s ease ${Math.min(i * 0.03, 0.5)}s both`,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            minWidth: 76,
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: 11,
                            bgcolor: '#F8FAFC',
                            px: 1,
                            py: 0.3,
                            borderRadius: 1,
                            flexShrink: 0,
                          }}
                        >
                          {new Date(ev.queriedAt).toLocaleTimeString()}
                        </Typography>

                        <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }} noWrap>
                          {ev.domain}
                        </Typography>

                        <Chip
                          size="small"
                          label={ev.action}
                          color={ev.action === 'BLOCKED' ? 'error' : 'success'}
                          sx={{ height: 22, fontSize: 11, fontWeight: 700, flexShrink: 0 }}
                        />

                        {ev.category && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              bgcolor: '#F1F5F9',
                              px: 1,
                              py: 0.3,
                              borderRadius: 1,
                              flexShrink: 0,
                              maxWidth: 100,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ev.category}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Category Donut */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  Top Categories (Today)
                </Typography>
                {!categoryData || categoryData.length === 0 ? (
                  <Box
                    sx={{
                      height: 200,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      No category data yet
                    </Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={categoryData.slice(0, 8)}
                        dataKey="count"
                        nameKey="category"
                        cx="50%"
                        cy="45%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {categoryData.slice(0, 8).map((_, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={DONUT_COLORS[idx % DONUT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          value.toLocaleString(),
                          name,
                        ]}
                        contentStyle={{
                          borderRadius: 8,
                          border: '1px solid #E2E8F0',
                          fontSize: 12,
                        }}
                      />
                      <Legend
                        iconSize={10}
                        iconType="circle"
                        wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                        formatter={(value: string) =>
                          value.length > 14 ? `${value.slice(0, 14)}…` : value
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </AnimatedPage>

      {/* ── Hourly Bar Chart ──────────────────────────────────────────────── */}
      <AnimatedPage delay={0.2}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              Activity by Hour (Today)
            </Typography>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={hourlyData ?? []}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                barSize={12}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [value.toLocaleString(), 'Queries']}
                  labelFormatter={(label: string) => `Hour: ${label}`}
                />
                <Bar
                  dataKey="count"
                  fill={theme.palette.primary.main}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* ── Filter + History Table ─────────────────────────────────────────── */}
      <AnimatedPage delay={0.25}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: '#9E9E9E' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              minWidth: 240,
              '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#F8FAFC' },
            }}
          />
          {(['ALL', 'BLOCKED', 'ALLOWED'] as const).map((f) => (
            <Chip
              key={f}
              label={f}
              variant={filter === f ? 'filled' : 'outlined'}
              color={f === 'BLOCKED' ? 'error' : f === 'ALLOWED' ? 'success' : 'default'}
              onClick={() => setFilter(f)}
              sx={{
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                '&:hover': { transform: 'translateY(-1px)' },
              }}
            />
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {historyQuery.data?.totalElements ?? 0} result
            {(historyQuery.data?.totalElements ?? 0) !== 1 ? 's' : ''}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={() => downloadCsv(historyRows, profileId ?? 'unknown')}
            disabled={historyRows.length === 0}
            sx={{ flexShrink: 0 }}
          >
            Export CSV
          </Button>
        </Box>

        {historyQuery.isFetching && (
          <LinearProgress sx={{ mb: 0.5, borderRadius: 1 }} />
        )}

        <Card>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {historyRows.length === 0 ? (
              <EmptyState
                icon={<WifiIcon sx={{ fontSize: 36, color: 'primary.main' }} />}
                title="No matching events"
                description="Try adjusting the search or filter above"
              />
            ) : (
              <Box>
                {historyRows.map((ev, i) => (
                  <Box
                    key={ev.id || `hist-${i}`}
                    sx={{
                      ...EVENT_ROW_BASE_SX,
                      borderLeft: `4px solid ${
                        ev.action === 'BLOCKED'
                          ? theme.palette.error.main
                          : theme.palette.success.main
                      }`,
                      animation: `slideInLeft 0.3s ease ${Math.min(i * 0.02, 0.4)}s both`,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        minWidth: 76,
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 11,
                        bgcolor: '#F8FAFC',
                        px: 1,
                        py: 0.3,
                        borderRadius: 1,
                        flexShrink: 0,
                      }}
                    >
                      {new Date(ev.queriedAt).toLocaleTimeString()}
                    </Typography>

                    <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }} noWrap>
                      {ev.domain}
                    </Typography>

                    <Chip
                      size="small"
                      label={ev.action}
                      color={ev.action === 'BLOCKED' ? 'error' : 'success'}
                      sx={{ height: 22, fontSize: 11, fontWeight: 700, flexShrink: 0 }}
                    />

                    {ev.category && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          bgcolor: '#F1F5F9',
                          px: 1,
                          py: 0.3,
                          borderRadius: 1,
                          flexShrink: 0,
                          maxWidth: 120,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ev.category}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
          <TablePagination
            component="div"
            count={historyQuery.data?.totalElements ?? 0}
            page={histPage}
            onPageChange={(_, p) => setHistPage(p)}
            rowsPerPage={histRowsPerPage}
            onRowsPerPageChange={(e) => {
              setHistRowsPerPage(parseInt(e.target.value, 10));
              setHistPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count}`}
          />
        </Card>
      </AnimatedPage>
    </AnimatedPage>
  );
}
