import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Grid, Typography, Box, Card, CardContent, Button, Chip, CircularProgress,
  Alert, Tooltip, Stack, Divider, List, ListItem, ListItemText, ListItemIcon,
  LinearProgress, useTheme,
} from '@mui/material';
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
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import WelcomeBanner from '../../components/WelcomeBanner';

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
interface CategoryBreakdown { category: string; blocked: number; allowed: number; }

const GRADIENT_ACCENTS = ['#1565C0', '#43A047', '#7B1FA2', '#FB8C00', '#E53935', '#00897B'];
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
    refetchInterval: 30000,
  });
  const firstProfileId = children[0]?.id;

  const { data: dailyStats } = useQuery<DailyPoint[]>({
    queryKey: ['dashboard-daily', firstProfileId],
    queryFn: () => api.get(`/analytics/${firstProfileId}/daily?days=7`).then(r =>
      (r.data?.data ?? r.data ?? []) as DailyPoint[]
    ).catch(() => []),
    enabled: !!firstProfileId,
  });

  const { data: topBlocked } = useQuery<{ domain: string; count: number }[]>({
    queryKey: ['dashboard-top-blocked', firstProfileId],
    queryFn: () => api.get(`/analytics/${firstProfileId}/top-domains?type=BLOCKED&limit=5`).then(r =>
      (r.data?.data ?? r.data ?? []) as { domain: string; count: number }[]
    ).catch(() => []),
    enabled: !!firstProfileId,
  });

  const { data: categories } = useQuery<CategoryBreakdown[]>({
    queryKey: ['dashboard-categories', firstProfileId],
    queryFn: () => api.get(`/analytics/${firstProfileId}/categories?days=7`).then(r =>
      (r.data?.data ?? r.data ?? []) as CategoryBreakdown[]
    ).catch(() => []),
    enabled: !!firstProfileId,
  });

  const { data: profileStats } = useQuery<Record<string, { totalQueries: number; totalBlocks: number; blockRate: number }>>(
    {
      queryKey: ['dashboard-profile-stats', children.map(c => c.id).join(',')],
      queryFn: async () => {
        const results: Record<string, any> = {};
        await Promise.all(children.map(async c => {
          try {
            const r = await api.get(`/analytics/${c.id}/stats?period=TODAY`);
            results[c.id] = r.data?.data ?? r.data;
          } catch { results[c.id] = { totalQueries: 0, totalBlocks: 0, blockRate: 0 }; }
        }));
        return results;
      },
      enabled: children.length > 0,
      refetchInterval: 60000,
    }
  );

  const pauseMutation = useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      paused
        ? api.delete(`/dns/schedules/${id}/override`)
        : api.post(`/dns/schedules/${id}/override`, { action: 'BLOCK_ALL', durationMinutes: 60 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['children'] }),
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ mt: 2 }}>Failed to load dashboard. Check your connection.</Alert>;

  const alerts = recentAlerts || [];
  const highBlockChildren = children.filter(c => (c.blocksToday ?? 0) > 10);
  const totalBlocks = children.reduce((s, c) => s + (c.blocksToday ?? 0), 0);
  const onlineCount = children.filter(c => c.online).length;
  const pausedCount = children.filter(c => c.paused).length;
  const totalQueries7d = (dailyStats || []).reduce((s, d) => s + (d.totalQueries || 0), 0);
  const totalBlocks7d = (dailyStats || []).reduce((s, d) => s + (d.totalBlocks || 0), 0);
  const blockRate7d = totalQueries7d > 0 ? Math.round((totalBlocks7d / totalQueries7d) * 100) : 0;

  const chartData = (dailyStats || []).map(d => ({
    day: shortDate(d.date),
    Allowed: (d.totalQueries || 0) - (d.totalBlocks || 0),
    Blocked: d.totalBlocks || 0,
  })).slice(-7);

  const topCategories = (categories || [])
    .filter(c => c.blocked > 0)
    .sort((a, b) => b.blocked - a.blocked)
    .slice(0, 5);

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
        background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 60%, #1B5E20 100%)',
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
          <Stack direction="row" spacing={1.5} flexShrink={0}>
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

      {/* Top stats row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Children" value={children.length} color="#1565C0" bg="#E3F2FD"
            icon={<FamilyRestroomIcon fontSize="small" />} subtitle={`${onlineCount} online now`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Blocks Today" value={totalBlocks} color="#E65100" bg="#FFF3E0"
            icon={<BlockIcon fontSize="small" />} subtitle="across all children" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Queries (7d)" value={totalQueries7d.toLocaleString()} color="#00897B" bg="#E0F2F1"
            icon={<DnsIcon fontSize="small" />} subtitle={`${blockRate7d}% block rate`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Active Alerts" value={alerts.length} color="#7B1FA2" bg="#F3E5F5"
            icon={<WarningAmberIcon fontSize="small" />} subtitle={pausedCount > 0 ? `${pausedCount} paused` : 'all running'} />
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
            iconColor="#1565C0"
            action={
              <Button variant="contained" startIcon={<AddIcon />}
                onClick={() => navigate('/profiles/new')}
                sx={{ background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)', borderRadius: 2, fontSize: 13 }}>
                Add Child
              </Button>
            }
          />

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {children.map((child, i) => {
              const stats = profileStats?.[child.id];
              const childBlockRate = stats?.totalQueries ? Math.round((stats.totalBlocks / stats.totalQueries) * 100) : 0;
              const accent = GRADIENT_ACCENTS[i % GRADIENT_ACCENTS.length];
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
                              {child.online && (
                                <Box sx={{
                                  position: 'absolute', bottom: 0, right: 0,
                                  width: 12, height: 12, borderRadius: '50%',
                                  bgcolor: '#43A047', border: '2px solid white',
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
                          <Box sx={{ mb: 1, px: 1, py: 0.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#F8FAFC', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Active: <strong>{child.currentActivity}</strong>
                            </Typography>
                          </Box>
                        )}

                        {/* Stats row */}
                        <Grid container spacing={1} sx={{ mb: 1.5 }}>
                          <Grid size={4}>
                            <Box sx={{ textAlign: 'center', p: 0.5, borderRadius: 1, bgcolor: child.blocksToday > 0 ? '#FFF3F0' : '#F6FFF6' }}>
                              <Typography fontSize={16} fontWeight={800} color={child.blocksToday > 0 ? 'error.main' : 'success.main'}>
                                {child.blocksToday}
                              </Typography>
                              <Typography fontSize={9} color="text.secondary">blocks today</Typography>
                            </Box>
                          </Grid>
                          <Grid size={4}>
                            <Box sx={{ textAlign: 'center', p: 0.5, borderRadius: 1, bgcolor: '#F8FAFC' }}>
                              <Typography fontSize={16} fontWeight={800} color="#1565C0">
                                {stats?.totalQueries ?? '—'}
                              </Typography>
                              <Typography fontSize={9} color="text.secondary">queries today</Typography>
                            </Box>
                          </Grid>
                          <Grid size={4}>
                            <Box sx={{ textAlign: 'center', p: 0.5, borderRadius: 1, bgcolor: '#F8FAFC' }}>
                              <Typography fontSize={16} fontWeight={800} color={childBlockRate > 20 ? '#E65100' : '#00897B'}>
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
                                bgcolor: '#E8F5E9',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: childBlockRate > 30 ? '#E53935' : childBlockRate > 15 ? '#FB8C00' : '#43A047',
                                  borderRadius: 2,
                                },
                              }}
                            />
                          </Box>
                        )}

                        <Divider sx={{ mb: 1 }} />
                        <Stack direction="row" spacing={0.5}>
                          {[
                            { label: 'Rules', path: `/profiles/${child.id}/rules`, color: '#1565C0' },
                            { label: 'Schedule', path: `/profiles/${child.id}/schedules`, color: '#E65100' },
                            { label: 'Activity', path: `/profiles/${child.id}/activity`, color: '#2E7D32' },
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
                  '&:hover': { borderColor: '#1565C0', bgcolor: '#F5F9FF', transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(21,101,192,0.12)' },
                }}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5, py: 4 }}>
                    <Box sx={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AddIcon sx={{ fontSize: 24, color: '#1565C0' }} />
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
                        {totalQueries7d.toLocaleString()} total queries · {totalBlocks7d.toLocaleString()} blocked ({blockRate7d}%)
                      </Typography>
                    </Box>
                    <TrendingUpIcon sx={{ color: '#1565C0', opacity: 0.6 }} />
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

          {/* Bottom row: Top Blocked + Top Categories */}
          <Grid container spacing={2}>
            {/* Top blocked domains */}
            {(topBlocked?.length ?? 0) > 0 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <AnimatedPage delay={0.25}>
                  <Card>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                        <BlockIcon sx={{ fontSize: 16, color: '#E53935' }} />
                        <Typography fontWeight={700} fontSize={13}>Top Blocked Domains</Typography>
                      </Stack>
                      {(topBlocked ?? []).map((d, i) => (
                        <Box key={d.domain} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.6, borderBottom: i < (topBlocked?.length ?? 0) - 1 ? '1px solid #F1F5F9' : 'none' }}>
                          <Typography fontSize={12} fontWeight={500} noWrap sx={{ flex: 1, mr: 1 }}>{d.domain}</Typography>
                          <Chip size="small" label={d.count} sx={{ height: 18, fontSize: 10, bgcolor: '#FFEBEE', color: '#C62828', fontWeight: 700 }} />
                        </Box>
                      ))}
                    </CardContent>
                  </Card>
                </AnimatedPage>
              </Grid>
            )}

            {/* Top blocked categories */}
            {topCategories.length > 0 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <AnimatedPage delay={0.3}>
                  <Card>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                        <SecurityIcon sx={{ fontSize: 16, color: '#7B1FA2' }} />
                        <Typography fontWeight={700} fontSize={13}>Blocked Categories (7d)</Typography>
                      </Stack>
                      {topCategories.map((cat, i) => {
                        const total = cat.blocked + cat.allowed;
                        const pct = total > 0 ? Math.round((cat.blocked / total) * 100) : 0;
                        return (
                          <Box key={cat.category} sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                              <Typography fontSize={12} fontWeight={500} textTransform="capitalize">
                                {cat.category.replace(/_/g, ' ').toLowerCase()}
                              </Typography>
                              <Typography fontSize={11} color="text.secondary">{cat.blocked} blocked</Typography>
                            </Box>
                            <LinearProgress variant="determinate" value={pct}
                              sx={{ height: 5, borderRadius: 3, bgcolor: '#F3E5F5',
                                '& .MuiLinearProgress-bar': { bgcolor: '#7B1FA2', borderRadius: 3 } }} />
                          </Box>
                        );
                      })}
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
                    <ShieldIcon sx={{ fontSize: 18, color: '#1565C0' }} />
                    <Typography fontWeight={700} fontSize={13}>Protection Status</Typography>
                  </Stack>
                  {[
                    { label: 'DNS Filtering', ok: true, desc: 'Active on all profiles' },
                    { label: 'All Profiles Protected', ok: children.length > 0, desc: `${children.length} profile${children.length !== 1 ? 's' : ''} monitored` },
                    { label: 'Online Now', ok: onlineCount > 0, desc: `${onlineCount} of ${children.length} children active`, neutral: true },
                    { label: 'Paused Profiles', ok: pausedCount === 0, desc: pausedCount > 0 ? `${pausedCount} profile${pausedCount !== 1 ? 's' : ''} paused` : 'None paused', warn: pausedCount > 0 },
                  ].map(item => (
                    <Stack key={item.label} direction="row" spacing={1} alignItems="center" sx={{ py: 0.75,
                      borderBottom: '1px solid #F1F5F9', '&:last-child': { borderBottom: 'none' } }}>
                      {item.ok && !item.warn ? <CheckCircleIcon sx={{ fontSize: 15, color: '#43A047' }} />
                        : item.warn ? <WarningAmberIcon sx={{ fontSize: 15, color: '#FB8C00' }} />
                        : item.neutral ? <CheckCircleIcon sx={{ fontSize: 15, color: '#78909C' }} />
                        : <BlockIcon sx={{ fontSize: 15, color: '#E53935' }} />}
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
                      { label: 'Time Limits', icon: <AccessTimeIcon sx={{ fontSize: 16 }} />, path: '/time-limits', color: '#E65100', bg: '#FFF3E0' },
                      { label: 'AI Insights', icon: <PsychologyIcon sx={{ fontSize: 16 }} />, path: '/ai-insights', color: '#6A1B9A', bg: '#F3E5F5' },
                      { label: 'Alerts', icon: <WarningAmberIcon sx={{ fontSize: 16 }} />, path: '/alerts', color: '#C62828', bg: '#FFEBEE' },
                      { label: 'Location', icon: <LocationOnIcon sx={{ fontSize: 16 }} />, path: '/map', color: '#00695C', bg: '#E0F2F1' },
                    ].map(action => (
                      <Grid key={action.label} size={6}>
                        <Box onClick={() => navigate(action.path)} sx={{
                          p: 1.25, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                          bgcolor: action.bg, transition: 'all 0.15s ease',
                          '&:hover': { transform: 'scale(1.04)', boxShadow: `0 4px 12px ${action.color}20` },
                        }}>
                          <Box sx={{ color: action.color, mb: 0.3 }}>{action.icon}</Box>
                          <Typography fontSize={11} fontWeight={600} color={action.color}>{action.label}</Typography>
                        </Box>
                      </Grid>
                    ))}
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
                              : a.type === 'BATTERY' ? <BatteryAlertIcon sx={{ fontSize: 14, color: '#F57F17' }} />
                              : a.severity === 'HIGH' ? <WarningAmberIcon sx={{ fontSize: 14, color: '#E53935' }} />
                              : <ShieldIcon sx={{ fontSize: 14, color: '#1565C0' }} />}
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
              <Card sx={{ bgcolor: 'linear-gradient(135deg, #1565C0, #0D47A1)', background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography fontSize={12} sx={{ color: 'rgba(255,255,255,0.7)' }}>Your Plan</Typography>
                      <Typography fontWeight={700} fontSize={15} color="white">Family Protection</Typography>
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
    </AnimatedPage>
  );
}
