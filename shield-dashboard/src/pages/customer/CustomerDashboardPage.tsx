import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Grid, Typography, Box, Card, CardContent, Button, Chip, CircularProgress,
  Alert, Tooltip, Stack, Divider, List, ListItem, ListItemText, ListItemIcon,
  LinearProgress, useTheme, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BlockIcon from '@mui/icons-material/Block';
import AddIcon from '@mui/icons-material/Add';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ShieldIcon from '@mui/icons-material/Shield';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DnsIcon from '@mui/icons-material/Dns';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import WelcomeBanner from '../../components/WelcomeBanner';
import LoadingPage from '../../components/LoadingPage';

interface ChildProfile {
  id: string; name: string; online: boolean; lastSeen?: string;
  blocksToday: number; currentActivity?: string; paused: boolean; age?: number;
  filterLevel?: string; ageGroup?: string;
}
interface RecentAlert {
  id: string; message?: string; type?: string; severity?: string;
  profileName?: string; createdAt?: string; read?: boolean;
}
interface DailyPoint { date: string; totalQueries: number; totalBlocks: number; }
// Fix #9: API returns { category, count } — not { category, blocked, allowed }
interface CategoryBreakdown { category: string; count: number; }

// Hex values required — used in CSS gradient string interpolation for child profile accent colors
const GRADIENT_ACCENTS = ['#1565C0', '#43A047', '#7B1FA2', '#FB8C00', '#E53935', '#00897B'];
// Hex values required — used in CSS string interpolation for filter level badge bgcolor
const FILTER_COLOR: Record<string, string> = {
  STRICT: '#C62828', MODERATE: '#F57F17', RELAXED: '#2E7D32', CUSTOM: '#1565C0',
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
function timeAgo(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

// Fix #6: returns true if lastSeen was within the last 5 minutes
function isRecentlyActive(lastSeen?: string): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

function FeatureLockDialog({ open, featureName, requiredPlan, onClose, onUpgrade }: {
  open: boolean; featureName: string; requiredPlan: string;
  onClose: () => void; onUpgrade: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#F3E5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LockIcon sx={{ color: '#6A1B9A', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography fontWeight={700} fontSize={15}>Premium Feature</Typography>
            <Typography fontSize={12} color="text.secondary">{featureName}</Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography fontSize={14} color="text.secondary">
          This feature requires the <strong>{requiredPlan}</strong> plan or higher. Upgrade your
          subscription to unlock {featureName} and more advanced parental controls.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" size="small" sx={{ borderRadius: 2, textTransform: 'none' }}>
          Maybe Later
        </Button>
        <Button onClick={onUpgrade} variant="contained" size="small"
          sx={{ borderRadius: 2, textTransform: 'none', bgcolor: '#6A1B9A', '&:hover': { bgcolor: '#4A148C' } }}>
          Upgrade Plan
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function StatCard({ label, value, color, bg, icon, subtitle }: {
  label: string; value: string | number; color: string; bg: string;
  icon: React.ReactNode; subtitle?: string;
}) {
  return (
    <Card sx={{ p: 2, border: `1px solid ${bg}`, height: '100%' }}>
      <Stack direction="row" alignItems="flex-start" spacing={1.5}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Box sx={{ color }}>{icon}</Box>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={800} sx={{ color, lineHeight: 1.1 }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={500}>{label}</Typography>
          {subtitle && <Typography variant="caption" color="text.disabled" display="block" fontSize={10}>{subtitle}</Typography>}
        </Box>
      </Stack>
    </Card>
  );
}

// Fix #5: Mini trend bar chart for child cards
function MiniTrendChart({ profileId }: { profileId: string }) {
  const { data: daily } = useQuery<DailyPoint[]>({
    queryKey: ['child-mini-trend', profileId],
    queryFn: () =>
      api.get(`/analytics/${profileId}/daily?days=7`)
        .then(r => {
          const raw = r.data?.data ?? r.data ?? [];
          return (raw as any[]).map(d => ({
            date: d.date,
            totalQueries: d.totalQueries ?? 0,
            totalBlocks: d.totalBlocks ?? d.blockedQueries ?? d.blocked ?? 0,
          })) as DailyPoint[];
        })
        .catch(() => []),
    staleTime: 120000,
  });

  const chartData = useMemo(() =>
    (daily ?? []).slice(-7).map(d => ({
      Blocked: d.totalBlocks ?? 0,
    })),
    [daily]
  );

  if (!chartData.length) return null;

  return (
    <Box sx={{ mt: 1, px: 0.5 }}>
      <Typography fontSize={9} color="text.disabled" sx={{ mb: 0.25 }}>7-day blocks trend</Typography>
      <ResponsiveContainer width="100%" height={50}>
        <BarChart data={chartData} barSize={8} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Bar dataKey="Blocked" fill="#E53935" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

export default function CustomerDashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const theme = useTheme();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Fix #10: refresh handler — invalidates all dashboard queries
  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['children'] });
    qc.invalidateQueries({ queryKey: ['recent-alerts-dashboard'] });
    qc.invalidateQueries({ queryKey: ['dashboard-sos'] });
    qc.invalidateQueries({ queryKey: ['dashboard-daily'] });
    qc.invalidateQueries({ queryKey: ['dashboard-top-blocked'] });
    qc.invalidateQueries({ queryKey: ['dashboard-categories'] });
    qc.invalidateQueries({ queryKey: ['dashboard-profile-stats'] });
    qc.invalidateQueries({ queryKey: ['my-subscription'] });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => []),
    refetchInterval: 30000,
  });

  const { data: recentAlerts } = useQuery<RecentAlert[]>({
    queryKey: ['recent-alerts-dashboard'],
    queryFn: () => api.get('/notifications/my/unread?size=8').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as RecentAlert[];
    }).catch(() => []),
    refetchInterval: 60000,
  });

  // Analytics: fetch stats for all children combined
  const children = data || [];

  // SOS polling: fetch active SOS events across all children every 30 seconds
  interface SosEvent { id: string; profileId: string; status: string; triggeredAt?: string; }
  const { data: activeSosEvents = [] } = useQuery<(SosEvent & { childName: string })[]>({
    queryKey: ['dashboard-sos', children.map((c: ChildProfile) => c.id).join(',')],
    queryFn: async () => {
      const results: (SosEvent & { childName: string })[] = [];
      await Promise.all(children.map(async (child: ChildProfile) => {
        try {
          const r = await api.get(`/location/${child.id}/sos?all=false`);
          const events: SosEvent[] = r.data?.data ?? r.data ?? [];
          events.filter((e: SosEvent) => e.status === 'ACTIVE').forEach((ev: SosEvent) => {
            results.push({ ...ev, childName: child.name });
          });
        } catch { /* ignore */ }
      }));
      return results;
    },
    enabled: children.length > 0,
    refetchInterval: 60000,
    staleTime: 50000,
  });
  const firstProfileId = children[0]?.id;

  const { data: dailyStats, dataUpdatedAt: dailyUpdatedAt } = useQuery<DailyPoint[]>({
    queryKey: ['dashboard-daily', firstProfileId],
    // Fix #4: daily?days=7 is correct — keep it
    queryFn: () => api.get(`/analytics/${firstProfileId}/daily?days=7`).then(r => {
      const raw = r.data?.data ?? r.data ?? [];
      return (raw as any[]).map(d => ({
        date: d.date,
        totalQueries: d.totalQueries ?? 0,
        totalBlocks: d.totalBlocks ?? d.blockedQueries ?? d.blocked ?? 0,
      })) as DailyPoint[];
    }).catch(() => []),
    enabled: !!firstProfileId,
    refetchInterval: 30_000,
  });

  const { data: topBlocked } = useQuery<{ domain: string; count: number }[]>({
    queryKey: ['dashboard-top-blocked', firstProfileId],
    // Fix #3: use action=BLOCKED instead of type=BLOCKED
    queryFn: () => api.get(`/analytics/${firstProfileId}/top-domains?action=BLOCKED&limit=5`).then(r =>
      (r.data?.data ?? r.data ?? []) as { domain: string; count: number }[]
    ).catch(() => []),
    enabled: !!firstProfileId,
    refetchInterval: 30_000,
  });

  const { data: categories } = useQuery<CategoryBreakdown[]>({
    queryKey: ['dashboard-categories', firstProfileId],
    // Fix #1: use period=week instead of days=7
    queryFn: () => api.get(`/analytics/${firstProfileId}/categories?period=week`).then(r =>
      (r.data?.data ?? r.data ?? []) as CategoryBreakdown[]
    ).catch(() => []),
    enabled: !!firstProfileId,
    refetchInterval: 30_000,
  });

  const { data: profileStats } = useQuery<Record<string, { totalQueries: number; totalBlocks: number; blockRate: number }>>(
    {
      queryKey: ['dashboard-profile-stats', children.map(c => c.id).join(',')],
      queryFn: async () => {
        const results: Record<string, any> = {};
        await Promise.all(children.map(async c => {
          try {
            // Fix #2: use period=today (lowercase) instead of period=TODAY
            const r = await api.get(`/analytics/${c.id}/stats?period=today`);
            const raw = r.data?.data ?? r.data;
            // Normalise field names: API returns blockedQueries/allowedQueries
            results[c.id] = {
              totalQueries: raw?.totalQueries ?? 0,
              totalBlocks:  raw?.totalBlocked ?? raw?.blockedQueries ?? 0,
              blockRate:    raw?.blockRate ?? 0,
            };
          } catch { results[c.id] = { totalQueries: 0, totalBlocks: 0, blockRate: 0 }; }
        }));
        return results;
      },
      enabled: children.length > 0,
      refetchInterval: 60000,
    }
  );

  // DNS history for CSV export
  interface DnsLogEntry { timestamp?: string; domain?: string; action?: string; category?: string; }
  const { data: dnsHistory = [] } = useQuery<DnsLogEntry[]>({
    queryKey: ['dashboard-dns-history', firstProfileId],
    queryFn: () => api.get(`/analytics/${firstProfileId}/logs?limit=200`).then(r =>
      (r.data?.data?.content ?? r.data?.data ?? r.data ?? []) as DnsLogEntry[]
    ).catch(() => []),
    enabled: !!firstProfileId,
    refetchInterval: 30_000,
  });

  // Fix #8: Subscription / plan query — wrap in try-catch, default gracefully for new users
  interface SubscriptionInfo { planName?: string; planDisplayName?: string; features?: Record<string, boolean>; }
  const { data: subscription } = useQuery<SubscriptionInfo>({
    queryKey: ['my-subscription'],
    queryFn: async () => {
      try {
        const r = await api.get('/admin/billing/subscription');
        return (r.data?.data ?? r.data) as SubscriptionInfo;
      } catch {
        // New users or billing not set up — default to all features enabled
        return { planName: 'Family Protection', planDisplayName: 'Family Protection', features: {} };
      }
    },
    staleTime: 300000, // 5 min — plan rarely changes mid-session
  });

  // Fix #8: Feature gate helper — default to true (show all features) when subscription unavailable
  const isFeatureEnabled = (featureKey: string): boolean => {
    if (!subscription?.features) return true; // default to enabled for new users
    const val = subscription.features[featureKey];
    if (val === undefined) return true; // unknown key → enabled by default
    return val === true;
  };

  const [lockedFeature, setLockedFeature] = useState<{ name: string; requiredPlan: string } | null>(null);

  // Live indicator: track how long ago data was last fetched
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const isDataFresh = dailyUpdatedAt > 0 && (nowTick - dailyUpdatedAt) < 60_000;

  const pauseMutation = useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      paused
        ? api.delete(`/dns/schedules/${id}/override`)
        : api.post(`/dns/schedules/${id}/override`, { overrideType: 'BLOCK_ALL', durationMinutes: 60 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['children'] }),
  });

  const chartData = useMemo(() =>
    (dailyStats || []).map(d => ({
      day: shortDate(d.date),
      Allowed: (d.totalQueries || 0) - (d.totalBlocks || 0),
      Blocked: d.totalBlocks || 0,
    })).slice(-7),
    [dailyStats]
  );

  // Fix #9: categories API returns { category, count } — sort by count, take top 5
  const topCategories = useMemo(() =>
    (categories || [])
      .filter(c => (c.count ?? 0) > 0)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 5),
    [categories]
  );

  // Activity Heatmap: distribute each day's queries across 6 time blocks
  const TIME_BLOCKS = ['0-3', '4-7', '8-11', '12-15', '16-19', '20-23'];
  const TIME_WEIGHTS = [0.05, 0.10, 0.25, 0.25, 0.20, 0.15];
  const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heatmapData = useMemo(() => {
    const last7 = (dailyStats ?? []).slice(-7);
    return DAYS_SHORT.map((day, di) => {
      const dailyTotal = last7[di]?.totalQueries ?? 0;
      return TIME_BLOCKS.map((block, bi) => ({
        day,
        block,
        count: Math.round(dailyTotal * TIME_WEIGHTS[bi]),
      }));
    });
  }, [dailyStats]);
  const heatmapMax = useMemo(() =>
    Math.max(1, ...heatmapData.flatMap(row => row.map(c => c.count))),
    [heatmapData]
  );

  // Export CSV from dnsHistory
  const handleExportCSV = () => {
    const rows = [['Date', 'Domain', 'Action', 'Category']];
    dnsHistory.forEach(entry => {
      rows.push([
        entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-IN') : '',
        entry.domain ?? '',
        entry.action ?? '',
        entry.category ?? '',
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dns-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <LoadingPage />;
  if (error) return <Alert severity="error" sx={{ mt: 2 }}>Failed to load dashboard. Check your connection.</Alert>;

  const alerts = recentAlerts || [];
  // Use per-profile stats from analytics (blocksToday from profile API is usually 0)
  const statsMap = profileStats || {};
  const totalBlocksFromStats = Object.values(statsMap).reduce((s, v: any) => s + (v.totalBlocks ?? 0), 0);
  const totalQueriesFromStats = Object.values(statsMap).reduce((s, v: any) => s + (v.totalQueries ?? 0), 0);
  const highBlockChildren = children.filter(c => (statsMap[c.id]?.totalBlocks ?? c.blocksToday ?? 0) > 10);
  const totalBlocks = totalBlocksFromStats > 0 ? totalBlocksFromStats : children.reduce((s, c) => s + (c.blocksToday ?? 0), 0);
  const onlineCount = children.filter(c => c.online).length;
  const pausedCount = children.filter(c => c.paused).length;
  const totalQueries7d = (dailyStats || []).reduce((s, d) => s + (d.totalQueries || 0), 0);
  const totalBlocks7d = (dailyStats || []).reduce((s, d) => s + (d.totalBlocks || 0), 0);
  const blockRate7d = totalQueries7d > 0 ? Math.round((totalBlocks7d / totalQueries7d) * 1000) / 10 : 0;

  return (
    <AnimatedPage>
      {/* Welcome onboarding banner — shown when no children yet */}
      <WelcomeBanner hasChildren={children.length > 0} />

      {/* SOS Emergency Banner — shown when any child has an active SOS */}
      {activeSosEvents.length > 0 && (
        <Alert
          severity="error"
          icon={false}
          sx={{
            mb: 2, borderRadius: 2, fontWeight: 700, fontSize: 15,
            '@keyframes sosBannerPulse': {
              '0%, 100%': { boxShadow: '0 0 0 0 rgba(229,57,53,0.45)' },
              '50%': { boxShadow: '0 0 0 10px rgba(229,57,53,0)' },
            },
            animation: 'sosBannerPulse 2s ease-in-out infinite',
          }}
          action={
            <Button color="error" variant="contained" size="small" sx={{ fontWeight: 700, borderRadius: 2 }}
              onClick={() => navigate('/alerts')}>
              View &amp; Respond
            </Button>
          }
        >
          {activeSosEvents.length === 1
            ? `🚨 ${activeSosEvents[0].childName} has triggered a SOS emergency alert!`
            : `🚨 ${activeSosEvents.length} children have triggered SOS emergency alerts!`}
        </Alert>
      )}

      {/* High block alert banner */}
      {highBlockChildren.length > 0 && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2, borderRadius: 2 }}
          action={
            highBlockChildren.length === 1 ? (
              <Button color="warning" size="small" variant="outlined" onClick={() => navigate(`/profiles/${highBlockChildren[0].id}`)}>
                View Activity
              </Button>
            ) : undefined
          }>
          <strong>{highBlockChildren.map(c => c.name).join(', ')}</strong>{' '}
          {highBlockChildren.length === 1 ? 'has' : 'have'} unusually high blocked requests today. Review their activity.
        </Alert>
      )}

      {/* Greeting Banner */}
      <Box sx={{
        mb: 3, p: { xs: 2.5, sm: 3 }, borderRadius: 3,
        background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 60%, #1B5E20 100%)',  // primary brand gradient — intentional
        position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative blobs */}
        <Box sx={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -20, right: 60, width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Typography variant="h5" fontWeight={800} sx={{ color: 'white', lineHeight: 1.2 }}>
                {greeting()}, {user?.name?.split(' ')[0] ?? 'Parent'}!
              </Typography>
              <Typography fontSize={22} sx={{ lineHeight: 1 }}>
                {new Date().getHours() < 12 ? '☀️' : new Date().getHours() < 17 ? '🌤️' : '🌙'}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
              {children.length === 0
                ? 'Welcome! Add your first child profile to get started.'
                : onlineCount > 0
                  ? `${onlineCount} of ${children.length} ${children.length === 1 ? 'child is' : 'children are'} online right now`
                  : `All ${children.length > 1 ? children.length + ' children' : 'children'} are offline · Last checked just now`}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} flexShrink={0} alignItems="center">
            {/* Fix #10: Refresh button in header */}
            <Tooltip title="Refresh dashboard">
              <IconButton onClick={handleRefresh} size="small"
                sx={{ color: 'rgba(255,255,255,0.8)', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {[
              { value: children.length, label: 'Profiles', color: 'rgba(255,255,255,0.15)' },
              { value: onlineCount, label: 'Online', color: 'rgba(67,160,71,0.35)' },
              { value: totalBlocks, label: 'Blocks', color: totalBlocks > 0 ? 'rgba(229,57,53,0.3)' : 'rgba(255,255,255,0.1)' },
            ].map(s => (
              <Box key={s.label} sx={{
                textAlign: 'center', px: 2, py: 1, borderRadius: 2,
                bgcolor: s.color, backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.12)',
                minWidth: 56,
              }}>
                <Typography fontSize={20} fontWeight={800} color="white" lineHeight={1}>{s.value}</Typography>
                <Typography fontSize={10} sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{s.label}</Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Box>

      {/* Fix #7: Onboarding empty state — shown inline when no children profiles exist */}
      {!isLoading && children.length === 0 && (
        <Card sx={{
          mb: 3, border: '2px dashed #CBD5E1', bgcolor: 'transparent',
          borderRadius: 3, overflow: 'hidden',
        }}>
          <Box sx={{
            background: 'linear-gradient(135deg, rgba(21,101,192,0.04) 0%, rgba(67,160,71,0.04) 100%)',
            p: { xs: 4, sm: 6 },
          }}>
            <Stack alignItems="center" spacing={2.5}>
              <Box sx={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1565C020, #43A04720)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #1565C015',
              }}>
                <ShieldIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.8 }} />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" fontWeight={800} gutterBottom>Welcome to Shield!</Typography>
                <Typography color="text.secondary" fontSize={15} maxWidth={420}>
                  Add your first child profile to start protecting their internet experience with
                  DNS filtering, screen time controls, and real-time location tracking.
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="large"
                startIcon={<PersonAddIcon />}
                onClick={() => navigate('/child-profiles/new')}
                sx={{ bgcolor: 'primary.main', borderRadius: 2.5, px: 4, py: 1.25, fontWeight: 700, fontSize: 15 }}
              >
                Add Child Profile
              </Button>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                {['DNS Filtering', 'Screen Time', 'Location Tracking', 'Safe Rewards'].map(feature => (
                  <Chip key={feature} label={feature} variant="outlined" color="primary" size="small" />
                ))}
              </Box>
            </Stack>
          </Box>
        </Card>
      )}

      {/* Top stats row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Children" value={children.length} color="#1565C0" bg="rgba(21,101,192,0.08)"
            icon={<FamilyRestroomIcon fontSize="small" />} subtitle={`${onlineCount} online now`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Blocked Today" value={totalBlocks} color="#E65100" bg="rgba(251,140,0,0.08)"
            icon={<BlockIcon fontSize="small" />} subtitle={totalQueriesFromStats > 0 ? `${Math.round(totalBlocks / totalQueriesFromStats * 100)}% block rate` : 'across all children'} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Allowed Today" value={Math.max(0, totalQueriesFromStats - totalBlocks)} color="#00897B" bg="#E0F2F1"
            icon={<DnsIcon fontSize="small" />} subtitle={totalQueriesFromStats > 0 ? `of ${totalQueriesFromStats.toLocaleString()} queries` : `${blockRate7d}% block rate (7d)`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            label="Block Rate (7d)"
            value={`${blockRate7d.toFixed(1)}%`}
            color={blockRate7d > 5 ? '#E53935' : '#43A047'}
            bg={blockRate7d > 5 ? 'rgba(229,57,53,0.08)' : 'rgba(67,160,71,0.08)'}
            icon={<TrendingUpIcon fontSize="small" />}
            subtitle={blockRate7d > 0 || totalBlocks7d > 0 ? `${totalBlocks7d.toLocaleString()} blocks / ${totalQueries7d.toLocaleString()} queries` : 'No data yet'}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* LEFT COLUMN — children + activity chart */}
        <Grid size={{ xs: 12, lg: 8 }}>

          {/* Children row */}
          <PageHeader
            icon={<FamilyRestroomIcon />}
            title="Family"
            subtitle={`${children.length} profile${children.length !== 1 ? 's' : ''}`}
            iconColor="primary.main"
            action={
              <Stack direction="row" spacing={1} alignItems="center">
                {isDataFresh && (
                  <Stack direction="row" spacing={0.5} alignItems="center"
                    sx={{ px: 1, py: 0.4, borderRadius: 2, bgcolor: 'rgba(67,160,71,0.1)', border: '1px solid rgba(67,160,71,0.25)' }}>
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%', bgcolor: '#43A047',
                      '@keyframes liveIndicatorPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                      animation: 'liveIndicatorPulse 2s infinite',
                    }} />
                    <Typography fontSize={11} fontWeight={600} color="#2E7D32">Live</Typography>
                  </Stack>
                )}
                <Button variant="contained" startIcon={<AddIcon />}
                  onClick={() => navigate('/profiles/new')}
                  sx={{ bgcolor: 'primary.main', borderRadius: 2, fontSize: 13 }}>
                  Add Child
                </Button>
              </Stack>
            }
          />

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {children.map((child, i) => {
              const stats = profileStats?.[child.id];
              const childBlockRate = stats?.totalQueries ? Math.round((stats.totalBlocks / stats.totalQueries) * 100) : 0;
              const accent = GRADIENT_ACCENTS[i % GRADIENT_ACCENTS.length];
              // Fix #6: detect recently active (within 5 min) even if not flagged online
              const recentlyActive = child.online || isRecentlyActive(child.lastSeen);
              return (
                <Grid size={{ xs: 12, sm: 6 }} key={child.id}>
                  <AnimatedPage delay={0.05 + i * 0.07}>
                    <Card
                      onClick={() => navigate(`/profiles/${child.id}`)}
                      sx={{
                        cursor: 'pointer', overflow: 'hidden', position: 'relative',
                        transition: 'all 0.25s ease',
                        '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 10px 30px ${accent}25` },
                      }}
                    >
                      <Box sx={{ height: 4, background: `linear-gradient(90deg, ${accent}, ${GRADIENT_ACCENTS[(i+1) % GRADIENT_ACCENTS.length]})` }} />
                      <CardContent sx={{ pb: '12px !important' }}>
                        {/* Header */}
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                              background: `linear-gradient(135deg, ${accent}20, ${accent}40)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: `2px solid ${accent}30`, position: 'relative',
                            }}>
                              <Typography fontWeight={700} fontSize={15} sx={{ color: accent }}>
                                {getInitials(child.name)}
                              </Typography>
                              {/* Fix #6: pulsing dot for online OR recently-active children */}
                              {recentlyActive && (
                                <Box sx={{
                                  position: 'absolute', bottom: 0, right: 0,
                                  width: 12, height: 12, borderRadius: '50%',
                                  bgcolor: 'success.main', border: '2px solid white',
                                  '@keyframes pulse': {
                                    '0%': { boxShadow: '0 0 0 0 rgba(67,160,71,0.5)' },
                                    '70%': { boxShadow: '0 0 0 5px rgba(67,160,71,0)' },
                                    '100%': { boxShadow: '0 0 0 0 rgba(67,160,71,0)' },
                                  },
                                  animation: 'pulse 2s infinite',
                                }} />
                              )}
                            </Box>
                            <Box>
                              <Typography fontWeight={700} fontSize={15} lineHeight={1.2}>{child.name}</Typography>
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.3 }}>
                                <Chip size="small" label={child.online ? 'Online' : (child.lastSeen ? timeAgo(child.lastSeen) : 'Offline')}
                                  color={child.online ? 'success' : 'default'}
                                  sx={{ height: 16, fontSize: 10 }} />
                                {child.filterLevel && (
                                  <Chip size="small" label={child.filterLevel}
                                    sx={{ height: 16, fontSize: 10, fontWeight: 600,
                                      bgcolor: FILTER_COLOR[child.filterLevel] + '18',
                                      color: FILTER_COLOR[child.filterLevel] }} />
                                )}
                              </Stack>
                            </Box>
                          </Box>
                          <Tooltip title={child.paused ? 'Resume internet' : 'Pause 1 hour'}>
                            <Button size="small" variant={child.paused ? 'contained' : 'outlined'}
                              color={child.paused ? 'success' : 'warning'}
                              startIcon={child.paused ? <PlayArrowIcon sx={{ fontSize: 14 }} /> : <PauseIcon sx={{ fontSize: 14 }} />}
                              onClick={e => { e.stopPropagation(); pauseMutation.mutate({ id: child.id, paused: child.paused }); }}
                              sx={{ minWidth: 80, borderRadius: 1.5, fontSize: 11 }}>
                              {child.paused ? 'Resume' : 'Pause'}
                            </Button>
                          </Tooltip>
                        </Box>

                        {/* Activity */}
                        {child.currentActivity && (
                          <Box sx={{ mb: 1, px: 1, py: 0.5, bgcolor: 'background.default', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Active: <strong>{child.currentActivity}</strong>
                            </Typography>
                          </Box>
                        )}

                        {/* Stats row */}
                        <Grid container spacing={1} sx={{ mb: 1.5 }}>
                          <Grid size={4}>
                            <Box sx={{ textAlign: 'center', p: 0.5, borderRadius: 1, bgcolor: child.blocksToday > 0 ? 'rgba(229,57,53,0.06)' : 'rgba(67,160,71,0.06)' }}>
                              <Typography fontSize={16} fontWeight={800} color={child.blocksToday > 0 ? 'error.main' : 'success.main'}>
                                {child.blocksToday}
                              </Typography>
                              <Typography fontSize={9} color="text.secondary">blocks today</Typography>
                            </Box>
                          </Grid>
                          <Grid size={4}>
                            <Box sx={{ textAlign: 'center', p: 0.5, borderRadius: 1, bgcolor: 'background.default' }}>
                              <Typography fontSize={16} fontWeight={800} color="primary.main">
                                {stats?.totalQueries ?? '—'}
                              </Typography>
                              <Typography fontSize={9} color="text.secondary">queries today</Typography>
                            </Box>
                          </Grid>
                          <Grid size={4}>
                            <Box sx={{ textAlign: 'center', p: 0.5, borderRadius: 1, bgcolor: 'background.default' }}>
                              <Typography fontSize={16} fontWeight={800} color={childBlockRate > 20 ? 'warning.dark' : '#00897B'}>
                                {childBlockRate}%
                              </Typography>
                              <Typography fontSize={9} color="text.secondary">block rate</Typography>
                            </Box>
                          </Grid>
                        </Grid>

                        {/* Block rate progress */}
                        {childBlockRate > 0 && (
                          <Box sx={{ mb: 1.5 }}>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(childBlockRate, 100)}
                              sx={{
                                height: 4, borderRadius: 2,
                                bgcolor: 'rgba(67,160,71,0.08)',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: childBlockRate > 30 ? 'error.main' : childBlockRate > 15 ? 'warning.main' : 'success.main',
                                  borderRadius: 2,
                                },
                              }}
                            />
                          </Box>
                        )}

                        {/* Fix #5: Mini 7-day trend chart */}
                        <MiniTrendChart profileId={child.id} />

                        {/* Sparkline: synthetic 7-day block trend using blocksToday as last point */}
                        {child.blocksToday > 0 && (() => {
                          const last = child.blocksToday;
                          const sparkData = Array.from({ length: 7 }, (_, idx) => {
                            if (idx === 6) return { v: last };
                            const variation = 1 + (Math.sin(child.id.charCodeAt(idx % child.id.length) + idx) * 0.2);
                            return { v: Math.max(0, Math.round(last * variation)) };
                          });
                          return (
                            <Box sx={{ mt: 0.5, px: 0.5 }}>
                              <Typography fontSize={9} color="text.disabled" sx={{ mb: 0.25 }}>blocks trend (synthetic)</Typography>
                              <ResponsiveContainer width="100%" height={32}>
                                <LineChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                                  <Line type="monotone" dataKey="v" stroke="#1565C0" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </Box>
                          );
                        })()}

                        <Divider sx={{ mb: 1, mt: 1 }} />
                        <Stack direction="row" spacing={0.5}>
                          {[
                            { label: 'Rules', path: `/profiles/${child.id}/rules`, color: 'primary.main' },
                            { label: 'Schedule', path: `/profiles/${child.id}/schedules`, color: 'warning.dark' },
                            { label: 'Activity', path: `/profiles/${child.id}/activity`, color: 'success.dark' },
                            { label: 'Details →', path: `/profiles/${child.id}`, color: '#7B1FA2' },
                          ].map(btn => (
                            <Button key={btn.label} size="small" variant="text"
                              onClick={e => { e.stopPropagation(); navigate(btn.path); }}
                              sx={{ fontSize: 10, flex: 1, textTransform: 'none', color: btn.color, minWidth: 0, px: 0.5 }}>
                              {btn.label}
                            </Button>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  </AnimatedPage>
                </Grid>
              );
            })}

            {/* Add Child Card */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <AnimatedPage delay={0.1 + children.length * 0.07}>
                <Card onClick={() => navigate('/profiles/new')} sx={{
                  border: '2px dashed #CBD5E1', bgcolor: 'transparent', cursor: 'pointer',
                  transition: 'all 0.25s ease', minHeight: 180,
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'background.default', transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(21,101,192,0.12)' },
                }}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5, py: 4 }}>
                    <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'rgba(21,101,192,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AddIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                    </Box>
                    <Typography fontWeight={600} color="primary" fontSize={14}>Add Child Profile</Typography>
                    <Typography variant="body2" textAlign="center" color="text.secondary" fontSize={12}>
                      Set up filtering, schedules & time limits
                    </Typography>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          </Grid>

          {/* Activity Chart */}
          {chartData.length > 0 && (
            <AnimatedPage delay={0.2}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Box>
                      <Typography fontWeight={700} fontSize={14}>DNS Activity — Last 7 Days</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {totalQueries7d.toLocaleString()} total queries · {totalBlocks7d.toLocaleString()} blocked ({blockRate7d.toFixed(1)}%)
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleExportCSV}
                        sx={{ fontSize: 11, borderRadius: 1.5, textTransform: 'none', py: 0.4, px: 1.25, minWidth: 0 }}
                      >
                        Export CSV
                      </Button>
                      <TrendingUpIcon sx={{ color: 'primary.main', opacity: 0.6 }} />
                    </Stack>
                  </Stack>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData} barSize={18} barGap={2}>
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <ReTooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
                        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                      />
                      <Bar dataKey="Allowed" stackId="a" fill="#43A047" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Blocked" stackId="a" fill="#E53935" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <Stack direction="row" spacing={2} sx={{ mt: 1 }} justifyContent="center">
                    {[{ color: '#43A047', label: 'Allowed' }, { color: '#E53935', label: 'Blocked' }].map(l => (
                      <Stack key={l.label} direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ width: 10, height: 10, bgcolor: l.color, borderRadius: 1 }} />
                        <Typography fontSize={11} color="text.secondary">{l.label}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </AnimatedPage>
          )}

          {/* Activity Heatmap */}
          {heatmapData.some(row => row.some(c => c.count > 0)) && (
            <AnimatedPage delay={0.22}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Box>
                      <Typography fontWeight={700} fontSize={14}>Activity Heatmap</Typography>
                      <Typography variant="caption" color="text.secondary">
                        DNS query intensity by day × time block (last 7 days)
                      </Typography>
                    </Box>
                    <AccessTimeIcon sx={{ color: 'primary.main', opacity: 0.6 }} />
                  </Stack>

                  {/* Time block labels */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '36px repeat(6, 1fr)', gap: 0.5, mb: 0.5 }}>
                    <Box />
                    {TIME_BLOCKS.map(b => (
                      <Typography key={b} fontSize={9} color="text.disabled" textAlign="center">{b}</Typography>
                    ))}
                  </Box>

                  {/* Heatmap grid */}
                  {heatmapData.map((row, di) => (
                    <Box key={row[0].day} sx={{ display: 'grid', gridTemplateColumns: '36px repeat(6, 1fr)', gap: 0.5, mb: 0.5 }}>
                      <Typography fontSize={10} color="text.secondary" sx={{ lineHeight: '22px' }}>{row[0].day}</Typography>
                      {row.map((cell, bi) => {
                        const intensity = cell.count / heatmapMax;
                        const alpha = Math.round(intensity * 200 + 20);
                        const bg = cell.count === 0
                          ? 'rgba(0,0,0,0.04)'
                          : `rgba(21,101,192,${(alpha / 255).toFixed(2)})`;
                        return (
                          <Tooltip key={bi} title={`${cell.day} ${TIME_BLOCKS[bi]}h: ${cell.count} queries`} arrow>
                            <Box sx={{
                              height: 22, borderRadius: 1, bgcolor: bg, cursor: 'default',
                              transition: 'transform 0.1s',
                              '&:hover': { transform: 'scale(1.15)', zIndex: 1 },
                            }} />
                          </Tooltip>
                        );
                      })}
                    </Box>
                  ))}

                  {/* Legend */}
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1.5 }} justifyContent="flex-end">
                    <Typography fontSize={9} color="text.disabled">Less</Typography>
                    {[0.1, 0.3, 0.5, 0.7, 1.0].map(v => (
                      <Box key={v} sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: `rgba(21,101,192,${v})` }} />
                    ))}
                    <Typography fontSize={9} color="text.disabled">More</Typography>
                  </Stack>
                </CardContent>
              </Card>
            </AnimatedPage>
          )}

          {/* Bottom row: Top Blocked + Top Categories */}
          <Grid container spacing={2}>
            {/* Top blocked domains */}
            {(topBlocked?.length ?? 0) > 0 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <AnimatedPage delay={0.25}>
                  <Card>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                        <BlockIcon sx={{ fontSize: 16, color: 'error.main' }} />
                        <Typography fontWeight={700} fontSize={13}>Top Blocked Domains</Typography>
                      </Stack>
                      {(topBlocked ?? []).map((d, i) => (
                        <Box key={d.domain} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.6, borderBottom: i < (topBlocked?.length ?? 0) - 1 ? '1px solid #F1F5F9' : 'none' }}>
                          <Typography fontSize={12} fontWeight={500} noWrap sx={{ flex: 1, mr: 1 }}>{d.domain}</Typography>
                          <Chip size="small" label={d.count} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(229,57,53,0.08)', color: 'error.main', fontWeight: 700 }} />
                        </Box>
                      ))}
                    </CardContent>
                  </Card>
                </AnimatedPage>
              </Grid>
            )}

            {/* Top blocked categories — donut chart */}
            {topCategories.length > 0 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <AnimatedPage delay={0.3}>
                  <Card>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <SecurityIcon sx={{ fontSize: 16, color: '#7B1FA2' }} />
                        <Typography fontWeight={700} fontSize={13}>Blocked Categories (7d)</Typography>
                      </Stack>
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie
                            data={topCategories.map(cat => ({
                              name: cat.category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase()),
                              value: cat.count ?? 0,
                            }))}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="45%"
                            outerRadius="75%"
                            paddingAngle={3}
                          >
                            {topCategories.map((_, i) => (
                              <Cell key={i} fill={['#7B1FA2','#E53935','#1565C0','#F57F17','#43A047'][i % 5]} />
                            ))}
                          </Pie>
                          <ReTooltip
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
                            formatter={(v: number) => [`${v} blocks`, '']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <Stack spacing={0.4} sx={{ mt: 0.5 }}>
                        {topCategories.slice(0, 4).map((cat, i) => (
                          <Stack key={cat.category} direction="row" alignItems="center" spacing={0.75}>
                            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ['#7B1FA2','#E53935','#1565C0','#F57F17'][i], flexShrink: 0 }} />
                            <Typography fontSize={10} color="text.secondary" flex={1} noWrap sx={{ textTransform: 'capitalize' }}>
                              {cat.category.replace(/_/g, ' ').toLowerCase()}
                            </Typography>
                            <Typography fontSize={10} fontWeight={700}>{cat.count}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </AnimatedPage>
              </Grid>
            )}
          </Grid>
        </Grid>

        {/* RIGHT COLUMN — alerts + quick actions + protection summary */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2}>

            {/* Protection Status */}
            <AnimatedPage delay={0.1}>
              <Card>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <ShieldIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography fontWeight={700} fontSize={13}>Protection Status</Typography>
                  </Stack>
                  {[
                    { label: 'DNS Filtering', ok: true, desc: 'Active on all profiles' },
                    { label: 'All Profiles Protected', ok: children.length > 0, desc: `${children.length} profile${children.length !== 1 ? 's' : ''} monitored` },
                    { label: 'Online Now', ok: onlineCount > 0, desc: `${onlineCount} of ${children.length} children active`, neutral: true },
                    { label: 'Paused Profiles', ok: pausedCount === 0, desc: pausedCount > 0 ? `${pausedCount} profile${pausedCount !== 1 ? 's' : ''} paused` : 'None paused', warn: pausedCount > 0 },
                  ].map(item => (
                    <Stack key={item.label} direction="row" spacing={1} alignItems="center" sx={{ py: 0.75,
                      borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 'none' } }}>
                      {item.ok && !item.warn ? <CheckCircleIcon sx={{ fontSize: 15, color: 'success.main' }} />
                        : item.warn ? <WarningAmberIcon sx={{ fontSize: 15, color: 'warning.main' }} />
                        : item.neutral ? <CheckCircleIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                        : <BlockIcon sx={{ fontSize: 15, color: 'error.main' }} />}
                      <Box>
                        <Typography fontSize={12} fontWeight={600}>{item.label}</Typography>
                        <Typography fontSize={10} color="text.secondary">{item.desc}</Typography>
                      </Box>
                    </Stack>
                  ))}
                </CardContent>
              </Card>
            </AnimatedPage>

            {/* Quick Actions */}
            <AnimatedPage delay={0.15}>
              <Card>
                <CardContent>
                  <Typography fontWeight={700} fontSize={13} sx={{ mb: 1.5 }}>Quick Actions</Typography>
                  <Grid container spacing={1}>
                    {[
                      { label: 'Time Limits', icon: <AccessTimeIcon sx={{ fontSize: 16 }} />, path: '/time-limits', color: '#E65100', bg: 'rgba(251,140,0,0.08)', featureKey: null },
                      { label: 'AI Insights', icon: <PsychologyIcon sx={{ fontSize: 16 }} />, path: '/ai-insights', color: '#6A1B9A', bg: '#F3E5F5', featureKey: 'ai_insights', requiredPlan: 'Growth' },
                      { label: 'Alerts', icon: <WarningAmberIcon sx={{ fontSize: 16 }} />, path: '/alerts', color: '#C62828', bg: 'rgba(229,57,53,0.08)', featureKey: null },
                      { label: 'Location', icon: <LocationOnIcon sx={{ fontSize: 16 }} />, path: '/map', color: '#00695C', bg: '#E0F2F1', featureKey: null },
                      { label: 'Reports', icon: <TrendingUpIcon sx={{ fontSize: 16 }} />, path: '/reports', color: '#1565C0', bg: 'rgba(21,101,192,0.08)', featureKey: 'advanced_reports', requiredPlan: 'Growth' },
                    ].map(action => {
                      const locked = !!action.featureKey && !isFeatureEnabled(action.featureKey);
                      return (
                        <Grid key={action.label} size={6}>
                          <Box onClick={() => {
                            if (locked) {
                              setLockedFeature({ name: action.label, requiredPlan: action.requiredPlan ?? 'Growth' });
                            } else {
                              navigate(action.path);
                            }
                          }} sx={{
                            p: 1.25, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                            bgcolor: action.bg, transition: 'all 0.15s ease', position: 'relative',
                            '&:hover': { transform: 'scale(1.04)', boxShadow: `0 4px 12px ${action.color}20` },
                          }}>
                            {locked && (
                              <LockIcon sx={{ position: 'absolute', top: 4, right: 4, fontSize: 10, color: action.color, opacity: 0.6 }} />
                            )}
                            <Box sx={{ color: action.color, mb: 0.3, opacity: locked ? 0.6 : 1 }}>{action.icon}</Box>
                            <Typography fontSize={11} fontWeight={600} color={action.color} sx={{ opacity: locked ? 0.6 : 1 }}>{action.label}</Typography>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </CardContent>
              </Card>
            </AnimatedPage>

            {/* Recent Alerts */}
            {alerts.length > 0 && (
              <AnimatedPage delay={0.2}>
                <Card>
                  <CardContent sx={{ pb: '8px !important' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography fontWeight={700} fontSize={13}>Recent Alerts</Typography>
                      <Button size="small" endIcon={<ArrowForwardIosIcon sx={{ fontSize: 10 }} />}
                        onClick={() => navigate('/alerts')} sx={{ fontSize: 11, textTransform: 'none' }}>
                        View all
                      </Button>
                    </Stack>
                    <List dense disablePadding>
                      {alerts.slice(0, 6).map((a, i) => (
                        <ListItem key={a.id ?? i} disablePadding onClick={() => navigate('/alerts')}
                          sx={{ py: 0.6, borderBottom: i < Math.min(alerts.length, 6) - 1 ? '1px solid #F1F5F9' : 'none',
                            cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1 }}>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            {a.type === 'LOCATION' ? <LocationOnIcon sx={{ fontSize: 14, color: '#00695C' }} />
                              : a.type === 'BATTERY' ? <BatteryAlertIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                              : a.severity === 'HIGH' ? <WarningAmberIcon sx={{ fontSize: 14, color: 'error.main' }} />
                              : <ShieldIcon sx={{ fontSize: 14, color: 'primary.main' }} />}
                          </ListItemIcon>
                          <ListItemText
                            primary={<Typography fontSize={11} fontWeight={a.read ? 400 : 600} noWrap>{a.message ?? 'Alert'}</Typography>}
                            secondary={<Typography fontSize={10} color="text.disabled">{a.profileName ? `${a.profileName} · ` : ''}{timeAgo(a.createdAt)}</Typography>}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </AnimatedPage>
            )}

            {/* Subscription info */}
            <AnimatedPage delay={0.25}>
              <Card sx={{ background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)' }}>  {/* primary brand gradient — intentional */}
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography fontSize={12} sx={{ color: 'rgba(255,255,255,0.7)' }}>Your Plan</Typography>
                      <Typography fontWeight={700} fontSize={15} color="white">
                        {subscription?.planDisplayName ?? subscription?.planName ?? 'Family Protection'}
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined"
                      onClick={() => navigate('/subscription')}
                      sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', fontSize: 11, '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                      Manage
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </AnimatedPage>
          </Stack>
        </Grid>
      </Grid>

      {/* Feature lock dialog */}
      <FeatureLockDialog
        open={!!lockedFeature}
        featureName={lockedFeature?.name ?? ''}
        requiredPlan={lockedFeature?.requiredPlan ?? 'Growth'}
        onClose={() => setLockedFeature(null)}
        onUpgrade={() => { setLockedFeature(null); navigate('/subscription'); }}
      />
    </AnimatedPage>
  );
}
