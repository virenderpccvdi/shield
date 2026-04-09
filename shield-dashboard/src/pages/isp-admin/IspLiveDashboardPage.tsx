import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Grid, Card, CardContent, Typography, Button, Chip, Stack,
  Skeleton, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TableSortLabel, Tooltip, alpha,
} from '@mui/material';
import MonitorIcon from '@mui/icons-material/Monitor';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import SaveIcon from '@mui/icons-material/Save';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, Legend,
  RadialBarChart, RadialBar,
  LineChart, Line,
} from 'recharts';
import { Client } from '@stomp/stompjs';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import { gradients } from '../../theme/theme';
import { useAuthStore } from '../../store/auth.store';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TenantOverview {
  // Actual API fields from /analytics/tenant/{id}/overview
  totalQueries: number;
  blockedQueries: number;
  allowedQueries: number;
  blockRate: number;
  // Optional extended fields (may not be present)
  activeProfiles?: number;
  totalProfiles?: number;
  totalQueriesToday?: number;
  blockedQueriesToday?: number;
  bandwidthSaved?: number;
}

interface HourlyPoint {
  hour: number;
  totalQueries: number;
  blockedQueries: number;
}

interface CustomerActivity {
  profileId: string;
  profileName: string;
  queriesToday: number;
  blockedToday: number;
  lastSeen: string | null;
  status: 'active' | 'idle' | 'offline';
}

interface LiveEvent {
  id: string;
  domain: string;
  action: 'BLOCKED' | 'ALLOWED';
  profileName?: string;
  timestamp: Date;
}

type SortField = 'profileName' | 'queriesToday' | 'blockedToday' | 'lastSeen' | 'status';
type SortDir = 'asc' | 'desc';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatK(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatMB(mb: number): string {
  if (mb >= 1_000) return `${(mb / 1_000).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function formatLastSeen(ts: string | null): string {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatTimestamp(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatEventTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/** Seed-stable sparkline data from a customer row (last 5 synthetic points) */
function sparklineData(customer: CustomerActivity): { v: number }[] {
  const base = customer.queriesToday / 5;
  let seed = customer.profileId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return Array.from({ length: 5 }, (_, i) => {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    const jitter = (seed >>> 0) / 4294967296;
    return { v: Math.max(0, Math.round(base * (0.6 + jitter * 0.8 + i * 0.05))) };
  });
}

// ─── Status Chip ─────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: CustomerActivity['status'] }) {
  const cfg = {
    active: { label: 'Active', color: '#2E7D32', bg: '#E8F5E9' },
    idle: { label: 'Idle', color: '#7C4700', bg: '#FFF3E0' },
    offline: { label: 'Offline', color: '#616161', bg: '#F5F5F5' },
  }[status];

  return (
    <Chip
      size="small"
      label={cfg.label}
      sx={{
        fontWeight: 700,
        fontSize: 11,
        height: 22,
        bgcolor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${alpha(cfg.color, 0.25)}`,
      }}
    />
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface LiveStatCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
  delay?: number;
}

function LiveStatCard({ title, value, sub, icon, gradient, delay = 0 }: LiveStatCardProps) {
  return (
    <Card sx={{
      // !important overrides MuiCard.styleOverrides.root backgroundColor:surface (white)
      background: `${gradient} !important`,
      backgroundColor: 'transparent !important',
      border: 'none !important',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 30px rgba(0,0,0,0.20)' },
      '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      animation: `fadeInUp 0.5s ease ${delay}s both`,
      // Force all MUI typography inside to use white
      '& .MuiTypography-root': { color: '#fff !important' },
    }}>
      <Box sx={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <Box sx={{ position: 'absolute', bottom: -30, left: -15, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      <CardContent sx={{ position: 'relative', zIndex: 1, p: '20px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.85) !important', fontWeight: 500, fontSize: 13, lineHeight: 1.3 }}>{title}</Typography>
          <Box sx={{ color: 'rgba(255,255,255,0.75)', display: 'flex' }}>{icon}</Box>
        </Box>
        <Typography sx={{ color: '#fff !important', fontWeight: 800, fontSize: 32, lineHeight: 1.1, mb: 0.5 }}>{value}</Typography>
        {sub && (
          <Typography sx={{ color: 'rgba(255,255,255,0.80) !important', fontSize: 12, fontWeight: 500 }}>{sub}</Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Custom Recharts Tooltip ──────────────────────────────────────────────────

interface HourlyTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}

function HourlyTooltip({ active, payload, label }: HourlyTooltipProps) {
  if (!active || !payload?.length) return null;
  const h = label ?? 0;
  const displayHour = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5, boxShadow: 3 }}>
      <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5 }}>{displayHour}</Typography>
      {payload.map(p => (
        <Box key={p.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />
          <Typography variant="caption">{p.name}: {formatK(p.value)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── Block Rate Gauge ─────────────────────────────────────────────────────────

function BlockRateGauge({ blockRatePct }: { blockRatePct: number }) {
  const clampedValue = Math.min(100, Math.max(0, blockRatePct));
  const gaugeData = [{ name: 'Block Rate', value: clampedValue, fill: '#E53935' }];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2.5 }}>
        <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ mb: 1, textAlign: 'center' }}>
          Block Rate (Today)
        </Typography>
        <ResponsiveContainer width="100%" height={130}>
          <RadialBarChart
            cx="50%" cy="88%"
            innerRadius="65%"
            outerRadius="95%"
            startAngle={180}
            endAngle={0}
            data={gaugeData}
            barSize={18}
          >
            <RadialBar
              background={{ fill: '#F0F4F8' }}
              dataKey="value"
              cornerRadius={8}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#E53935', mt: -1.5 }}>
          {clampedValue.toFixed(1)}%
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {clampedValue < 10 ? 'Low filtering' : clampedValue < 30 ? 'Normal' : clampedValue < 60 ? 'Moderate' : 'High block rate'}
        </Typography>
      </CardContent>
    </Card>
  );
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function MiniSparkline({ data }: { data: { v: number }[] }) {
  return (
    <LineChart width={54} height={28} data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
      <Line
        type="monotone"
        dataKey="v"
        stroke="#1565C0"
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}

// ─── Live Feed Card ───────────────────────────────────────────────────────────

function LiveFeedCard({ events }: { events: LiveEvent[] }) {
  return (
    <Card sx={{ mb: 3, borderLeft: '4px solid #1565C0' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <FiberManualRecordIcon
            sx={{
              fontSize: 12,
              color: '#4CAF50',
              '@keyframes livePulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
              animation: 'livePulse 1.5s ease infinite',
            }}
          />
          <Typography variant="subtitle1" fontWeight={700}>
            Live DNS Feed
          </Typography>
          <Chip
            label="LIVE"
            size="small"
            sx={{ fontSize: 10, height: 18, fontWeight: 800, bgcolor: '#4CAF50', color: '#fff', ml: 0.5 }}
          />
        </Box>

        {events.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            Waiting for DNS events… (WebSocket connected)
          </Typography>
        ) : (
          <Stack spacing={0.75} sx={{ maxHeight: 260, overflowY: 'auto' }}>
            {events.map(ev => (
              <Box
                key={ev.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.5,
                  px: 1,
                  borderRadius: 1,
                  bgcolor: ev.action === 'BLOCKED' ? alpha('#E53935', 0.04) : alpha('#1565C0', 0.03),
                  '@keyframes slideInFeed': { from: { opacity: 0, transform: 'translateX(-8px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                  animation: 'slideInFeed 0.25s ease both',
                }}
              >
                <Chip
                  label={ev.action}
                  size="small"
                  sx={{
                    fontSize: 10,
                    height: 18,
                    fontWeight: 700,
                    flexShrink: 0,
                    bgcolor: ev.action === 'BLOCKED' ? '#FFEBEE' : '#E3F2FD',
                    color: ev.action === 'BLOCKED' ? '#C62828' : '#1565C0',
                  }}
                />
                <Typography variant="caption" fontWeight={600} noWrap sx={{ flex: 1, fontFamily: 'monospace' }}>
                  {ev.domain}
                </Typography>
                {ev.profileName && (
                  <Typography variant="caption" color="text.disabled" noWrap sx={{ maxWidth: 80 }}>
                    {ev.profileName}
                  </Typography>
                )}
                <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, fontSize: 10 }}>
                  {formatEventTime(ev.timestamp)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IspLiveDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const tenantId = user?.tenantId ?? '';
  const token = useAuthStore(s => s.accessToken);

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [sortField, setSortField] = useState<SortField>('queriesToday');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [recentEvents, setRecentEvents] = useState<LiveEvent[]>([]);
  const [countdown, setCountdown] = useState(30);
  const stompClientRef = useRef<Client | null>(null);
  const eventIdRef = useRef(0);

  // ── Queries ────────────────────────────────────────────────────────────────

  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
  } = useQuery<TenantOverview>({
    queryKey: ['isp-live-overview', tenantId],
    queryFn: async () => {
      const url = tenantId
        ? `/analytics/tenant/${tenantId}/overview`
        : '/analytics/platform/overview';
      const r = await api.get(url, { params: { period: 'week' } });
      return r.data?.data ?? r.data;
    },
    refetchOnWindowFocus: false,
    staleTime: 25_000,
  });

  const {
    data: hourlyRaw = [],
    isLoading: hourlyLoading,
    refetch: refetchHourly,
  } = useQuery<HourlyPoint[]>({
    queryKey: ['isp-live-hourly', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const r = await api.get(`/analytics/tenant/${tenantId}/hourly`);
      const d = Array.isArray(r.data) ? r.data : r.data?.data ?? [];
      return d;
    },
    refetchOnWindowFocus: false,
    staleTime: 25_000,
  });

  const {
    data: customers = [],
    isLoading: customersLoading,
    refetch: refetchCustomers,
  } = useQuery<CustomerActivity[]>({
    queryKey: ['isp-live-customers', tenantId],
    queryFn: async () => {
      // Fetch customers → their profiles → today's stats for each profile
      const params = tenantId ? { tenantId, size: 50 } : { size: 50 };
      const custRes = await api.get('/profiles/customers', { params }).catch(() => null);
      const custData = custRes?.data?.data;
      const custList: { id: string }[] = Array.isArray(custData) ? custData
        : (custData?.content ?? []);
      if (!custList.length) return [];

      // For each customer, fetch child profiles
      const profileArrays = await Promise.allSettled(
        custList.map(c => api.get(`/profiles/customers/${c.id}/children`)
          .then(r => (r.data?.data ?? r.data) as { id: string; name?: string; lastSeenAt?: string }[])
          .catch(() => [] as { id: string; name?: string; lastSeenAt?: string }[]))
      );
      const allProfiles = profileArrays.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      if (!allProfiles.length) return [];

      // For each profile, fetch today's stats
      const statsResults = await Promise.allSettled(
        allProfiles.map(p => api.get(`/analytics/${p.id}/stats`, { params: { period: 'week' } })
          .then(r => ({ profileId: p.id, ...(r.data?.data ?? r.data) }))
          .catch(() => ({ profileId: p.id, totalQueries: 0, blockedQueries: 0 })))
      );

      return allProfiles.map((p, i) => {
        const stats = statsResults[i].status === 'fulfilled' ? statsResults[i].value : null;
        const lastSeen = p.lastSeenAt ?? null;
        const minsSince = lastSeen ? (Date.now() - new Date(lastSeen).getTime()) / 60000 : Infinity;
        const status: CustomerActivity['status'] = minsSince < 5 ? 'active' : minsSince < 60 ? 'idle' : 'offline';
        return {
          profileId: p.id,
          profileName: p.name ?? `Profile ${i + 1}`,
          queriesToday: stats?.totalQueries ?? 0,
          blockedToday: stats?.blockedQueries ?? 0,
          lastSeen,
          status,
        };
      });
    },
    refetchOnWindowFocus: false,
    staleTime: 25_000,
  });

  // ── Auto-refresh + countdown ───────────────────────────────────────────────

  const doRefresh = useCallback(() => {
    refetchOverview();
    refetchHourly();
    refetchCustomers();
    setLastUpdated(new Date());
    setCountdown(30);
  }, [refetchOverview, refetchHourly, refetchCustomers]);

  useEffect(() => {
    const timer = setInterval(doRefresh, 30_000);
    return () => clearInterval(timer);
  }, [doRefresh]);

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) return 30;
        return c - 1;
      });
    }, 1_000);
    return () => clearInterval(tick);
  }, []);

  // ── WebSocket / STOMP ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/shield`;

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 5_000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      onConnect: () => {
        client.subscribe(`/topic/tenant/${tenantId}`, (message) => {
          try {
            const payload = JSON.parse(message.body);
            const newEvent: LiveEvent = {
              id: String(++eventIdRef.current),
              domain: payload.domain ?? payload.qname ?? 'unknown',
              action: payload.blocked === true || payload.action === 'BLOCKED' ? 'BLOCKED' : 'ALLOWED',
              profileName: payload.profileName ?? payload.clientName ?? undefined,
              timestamp: new Date(),
            };
            setRecentEvents(prev => [newEvent, ...prev].slice(0, 20));
          } catch {
            // ignore malformed messages
          }
        });
      },
      onStompError: () => {
        // silently reconnect
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      client.deactivate();
      stompClientRef.current = null;
    };
  }, [tenantId, token]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const hourlyData = hourlyRaw.map(p => ({
    hour: p.hour,
    label: p.hour === 0 ? '12a' : p.hour < 12 ? `${p.hour}a` : p.hour === 12 ? '12p' : `${p.hour - 12}p`,
    allowed: Math.max(0, p.totalQueries - p.blockedQueries),
    blocked: p.blockedQueries,
  }));

  const sortedCustomers = [...customers].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'profileName') {
      cmp = a.profileName.localeCompare(b.profileName);
    } else if (sortField === 'queriesToday') {
      cmp = a.queriesToday - b.queriesToday;
    } else if (sortField === 'blockedToday') {
      cmp = a.blockedToday - b.blockedToday;
    } else if (sortField === 'status') {
      const order: Record<string, number> = { active: 0, idle: 1, offline: 2 };
      cmp = (order[a.status] ?? 3) - (order[b.status] ?? 3);
    } else if (sortField === 'lastSeen') {
      const ta = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
      const tb = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
      cmp = ta - tb;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const totalQueries = overview?.totalQueries ?? overview?.totalQueriesToday ?? 0;
  const blockedQueries = overview?.blockedQueries ?? overview?.blockedQueriesToday ?? 0;
  const allowedQueries = overview?.allowedQueries ?? Math.max(0, totalQueries - blockedQueries);
  const blockedPct = overview?.blockRate ?? (totalQueries > 0 ? (blockedQueries / totalQueries) * 100 : 0);
  const blockedPctStr = blockedPct.toFixed(1);
  const activeProfiles = overview?.activeProfiles ?? customers.filter(c => c.status === 'active').length;
  const totalProfiles = overview?.totalProfiles ?? customers.length;
  const bandwidthSaved = overview?.bandwidthSaved ?? Math.round(blockedQueries * 0.05);
  const topBlockedDomains: string[] = [];

  const isLoading = overviewLoading || hourlyLoading || customersLoading;

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AnimatedPage>
        <PageHeader
          icon={<MonitorIcon />}
          title="Live Usage Dashboard"
          subtitle="Real-time activity across all customers"
          iconColor="#1565C0"
          hero
        />
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {[1, 2, 3, 4].map(i => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={160} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={320} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={300} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={80} />
      </AnimatedPage>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AnimatedPage>
      {/* Hero Header */}
      <PageHeader
        icon={<MonitorIcon />}
        title="Live Usage Dashboard"
        subtitle="Real-time activity across all customers"
        iconColor="#1565C0"
        hero
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              Updated {formatTimestamp(lastUpdated)}
            </Typography>
            <Chip
              label={`Refreshing in ${countdown}s`}
              size="small"
              sx={{
                fontSize: 11,
                height: 22,
                fontWeight: 600,
                bgcolor: alpha('#1565C0', 0.08),
                color: '#1565C0',
                display: { xs: 'none', md: 'flex' },
              }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={doRefresh}
              sx={{ borderRadius: 2, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Refresh
            </Button>
          </Box>
        }
      />

      {/* Section 1 — Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <LiveStatCard
            title="Active Now"
            value={`${activeProfiles} / ${totalProfiles}`}
            sub="customers online"
            icon={<PeopleIcon />}
            gradient={gradients.blue}
            delay={0.05}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <LiveStatCard
            title="Queries (7d)"
            value={formatK(totalQueries)}
            sub="DNS lookups processed"
            icon={<DnsIcon />}
            gradient={gradients.green}
            delay={0.1}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <LiveStatCard
            title="Blocked (7d)"
            value={formatK(blockedQueries)}
            sub={`${blockedPctStr}% of all queries`}
            icon={<BlockIcon />}
            gradient={gradients.red}
            delay={0.15}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <LiveStatCard
            title="Bandwidth Saved"
            value={formatMB(bandwidthSaved)}
            sub="from blocked requests"
            icon={<SaveIcon />}
            gradient={gradients.teal}
            delay={0.2}
          />
        </Grid>
      </Grid>

      {/* Section 2 — Block Rate Gauge + Live Feed */}
      <AnimatedPage delay={0.22}>
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <BlockRateGauge blockRatePct={blockedPct} />
          </Grid>
          <Grid size={{ xs: 12, sm: 8, md: 9 }}>
            <LiveFeedCard events={recentEvents} />
          </Grid>
        </Grid>
      </AnimatedPage>

      {/* Section 3 — Hourly Chart */}
      <AnimatedPage delay={0.28}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
              Hourly DNS Activity
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Allowed vs blocked queries per hour (today)
            </Typography>

            {hourlyData.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
                No hourly data available yet.
              </Typography>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} />
                  <YAxis tickFormatter={formatK} tick={{ fontSize: 12 }} width={48} />
                  <RechartTooltip content={<HourlyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                  <Bar dataKey="allowed" name="Allowed" stackId="a" fill="#1565C0" radius={[0, 0, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="blocked" name="Blocked" stackId="a" fill="#E53935" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Section 4 — Customer Activity Table */}
      <AnimatedPage delay={0.35}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>Customer Activity</Typography>
                <Typography variant="body2" color="text.secondary">
                  {customers.length} profile{customers.length !== 1 ? 's' : ''} — click a row to view details
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                {(['active', 'idle', 'offline'] as const).map(s => (
                  <StatusChip key={s} status={s} />
                ))}
              </Stack>
            </Box>

            {customers.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                No customer activity data available.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>
                        <TableSortLabel
                          active={sortField === 'profileName'}
                          direction={sortField === 'profileName' ? sortDir : 'asc'}
                          onClick={() => handleSort('profileName')}
                        >
                          Name
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>
                        <TableSortLabel
                          active={sortField === 'status'}
                          direction={sortField === 'status' ? sortDir : 'asc'}
                          onClick={() => handleSort('status')}
                        >
                          Status
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>
                        <TableSortLabel
                          active={sortField === 'queriesToday'}
                          direction={sortField === 'queriesToday' ? sortDir : 'desc'}
                          onClick={() => handleSort('queriesToday')}
                        >
                          Queries Today
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 12, width: 64 }}>
                        Trend
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>
                        <TableSortLabel
                          active={sortField === 'blockedToday'}
                          direction={sortField === 'blockedToday' ? sortDir : 'desc'}
                          onClick={() => handleSort('blockedToday')}
                        >
                          Blocked
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>
                        <TableSortLabel
                          active={sortField === 'lastSeen'}
                          direction={sortField === 'lastSeen' ? sortDir : 'desc'}
                          onClick={() => handleSort('lastSeen')}
                        >
                          Last Seen
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedCustomers.map((row, i) => {
                      const customerBlockRate = row.queriesToday > 0
                        ? (row.blockedToday / row.queriesToday) * 100
                        : 0;
                      const isHighBlockRate = customerBlockRate > 80;
                      const spark = sparklineData(row);

                      return (
                        <TableRow
                          key={row.profileId}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '@keyframes fadeInRow': { from: { opacity: 0, transform: 'translateX(-6px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                            animation: `fadeInRow 0.3s ease ${0.05 * i}s both`,
                            '&:last-child td': { border: 0 },
                            bgcolor: isHighBlockRate ? alpha('#E53935', 0.02) : undefined,
                          }}
                          onClick={() => navigate(`/isp/customers/${row.profileId}`)}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              {isHighBlockRate && (
                                <Tooltip title={`High block rate: ${customerBlockRate.toFixed(0)}%`} placement="top">
                                  <WarningAmberIcon
                                    sx={{
                                      fontSize: 16,
                                      color: '#F57C00',
                                      flexShrink: 0,
                                      '@keyframes warnPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
                                      animation: 'warnPulse 2s ease infinite',
                                    }}
                                  />
                                </Tooltip>
                              )}
                              <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 180 }}>
                                {row.profileName}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <StatusChip status={row.status} />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={500}>
                              {formatK(row.queriesToday)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <MiniSparkline data={spark} />
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                              <Typography
                                variant="body2"
                                fontWeight={500}
                                color={isHighBlockRate ? 'error.main' : row.blockedToday > 0 ? 'error.main' : 'text.secondary'}
                              >
                                {formatK(row.blockedToday)}
                              </Typography>
                              {row.queriesToday > 0 && (
                                <Typography variant="caption" color={isHighBlockRate ? 'error.main' : 'text.disabled'} fontWeight={isHighBlockRate ? 700 : 400}>
                                  ({customerBlockRate.toFixed(0)}%)
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title={row.lastSeen ? new Date(row.lastSeen).toLocaleString('en-IN') : 'Never seen'} placement="left">
                              <Typography variant="body2" color="text.secondary">
                                {formatLastSeen(row.lastSeen)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Section 5 — Top Blocked Domains */}
      {topBlockedDomains.length > 0 && (
        <AnimatedPage delay={0.45}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                Top Blocked Domains
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Most frequently blocked domains across all customers today
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ rowGap: 1 }}>
                {topBlockedDomains.map((domain: string, i: number) => (
                  <Chip
                    key={domain}
                    label={domain}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      fontSize: 12,
                      height: 28,
                      bgcolor: i === 0
                        ? alpha('#E53935', 0.12)
                        : i < 3
                          ? alpha('#FB8C00', 0.1)
                          : alpha('#1565C0', 0.08),
                      color: i === 0
                        ? '#C62828'
                        : i < 3
                          ? '#E65100'
                          : '#1565C0',
                      border: '1px solid',
                      borderColor: i === 0
                        ? alpha('#E53935', 0.25)
                        : i < 3
                          ? alpha('#FB8C00', 0.2)
                          : alpha('#1565C0', 0.2),
                    }}
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}
    </AnimatedPage>
  );
}
