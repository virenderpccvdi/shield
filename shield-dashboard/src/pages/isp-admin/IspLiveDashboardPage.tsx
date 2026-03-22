import { useState, useEffect, useCallback } from 'react';
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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import { gradients } from '../../theme/theme';
import { useAuthStore } from '../../store/auth.store';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TenantOverview {
  activeProfiles: number;
  totalProfiles: number;
  totalQueriesToday: number;
  blockedQueriesToday: number;
  topBlockedDomains: string[];
  topCategories: string[];
  activeAlerts: number;
  bandwidthSaved: number;
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

// ─── Status Chip ─────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: CustomerActivity['status'] }) {
  const cfg = {
    active: { label: 'Active', color: '#2E7D32', bg: '#E8F5E9' },
    idle: { label: 'Idle', color: '#E65100', bg: '#FFF3E0' },
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
      background: gradient,
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' },
      '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      animation: `fadeInUp 0.5s ease ${delay}s both`,
    }}>
      <Box sx={{ position: 'absolute', top: -18, right: -18, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
      <CardContent sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 500, fontSize: 13 }}>{title}</Typography>
          <Box sx={{ opacity: 0.7 }}>{icon}</Box>
        </Box>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 0.25 }}>{value}</Typography>
        {sub && (
          <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 500 }}>{sub}</Typography>
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IspLiveDashboardPage() {
  const navigate = useNavigate();
  const tenantId = useAuthStore(s => s.user?.tenantId) ?? localStorage.getItem('shield_tenant_id') ?? '';
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [sortField, setSortField] = useState<SortField>('queriesToday');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Queries ────────────────────────────────────────────────────────────────

  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
  } = useQuery<TenantOverview>({
    queryKey: ['isp-live-overview', tenantId],
    queryFn: async () => {
      const r = await api.get(`/analytics/tenant/overview?tenantId=${tenantId}`);
      return r.data?.data ?? r.data;
    },
    enabled: !!tenantId,
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
      const r = await api.get(`/analytics/tenant/hourly?tenantId=${tenantId}`);
      const d = Array.isArray(r.data) ? r.data : r.data?.data ?? [];
      return d;
    },
    enabled: !!tenantId,
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
      const r = await api.get(`/analytics/tenant/customers?tenantId=${tenantId}`);
      const d = Array.isArray(r.data) ? r.data : r.data?.data ?? [];
      return d;
    },
    enabled: !!tenantId,
    refetchOnWindowFocus: false,
    staleTime: 25_000,
  });

  // ── Auto-refresh every 30 seconds ─────────────────────────────────────────

  const doRefresh = useCallback(() => {
    refetchOverview();
    refetchHourly();
    refetchCustomers();
    setLastUpdated(new Date());
  }, [refetchOverview, refetchHourly, refetchCustomers]);

  useEffect(() => {
    const timer = setInterval(doRefresh, 30_000);
    return () => clearInterval(timer);
  }, [doRefresh]);

  // ── Derived data ───────────────────────────────────────────────────────────

  // Build hourly chart data: add "allowed" bar = totalQueries - blockedQueries
  const hourlyData = hourlyRaw.map(p => ({
    hour: p.hour,
    label: p.hour === 0 ? '12a' : p.hour < 12 ? `${p.hour}a` : p.hour === 12 ? '12p' : `${p.hour - 12}p`,
    allowed: Math.max(0, p.totalQueries - p.blockedQueries),
    blocked: p.blockedQueries,
  }));

  // Sort customers
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

  // Overview values
  const activeProfiles = overview?.activeProfiles ?? 0;
  const totalProfiles = overview?.totalProfiles ?? 0;
  const totalQueries = overview?.totalQueriesToday ?? 0;
  const blockedQueries = overview?.blockedQueriesToday ?? 0;
  const blockedPct = totalQueries > 0 ? ((blockedQueries / totalQueries) * 100).toFixed(1) : '0';
  const bandwidthSaved = overview?.bandwidthSaved ?? 0;
  const topBlockedDomains = overview?.topBlockedDomains ?? [];

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
            title="Queries Today"
            value={formatK(totalQueries)}
            sub="DNS lookups processed"
            icon={<DnsIcon />}
            gradient={gradients.green}
            delay={0.1}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <LiveStatCard
            title="Blocked Today"
            value={formatK(blockedQueries)}
            sub={`${blockedPct}% of all queries`}
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

      {/* Section 2 — Hourly Chart */}
      <AnimatedPage delay={0.25}>
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

      {/* Section 3 — Customer Activity Table */}
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
                    {sortedCustomers.map((row, i) => (
                      <TableRow
                        key={row.profileId}
                        hover
                        sx={{
                          cursor: 'pointer',
                          '@keyframes fadeInRow': { from: { opacity: 0, transform: 'translateX(-6px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                          animation: `fadeInRow 0.3s ease ${0.05 * i}s both`,
                          '&:last-child td': { border: 0 },
                        }}
                        onClick={() => navigate(`/isp/customers/${row.profileId}`)}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                            {row.profileName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <StatusChip status={row.status} />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={500}>
                            {formatK(row.queriesToday)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                            <Typography variant="body2" fontWeight={500} color={row.blockedToday > 0 ? 'error.main' : 'text.secondary'}>
                              {formatK(row.blockedToday)}
                            </Typography>
                            {row.queriesToday > 0 && (
                              <Typography variant="caption" color="text.disabled">
                                ({((row.blockedToday / row.queriesToday) * 100).toFixed(0)}%)
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
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Section 4 — Top Blocked Domains */}
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
                {topBlockedDomains.map((domain, i) => (
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
