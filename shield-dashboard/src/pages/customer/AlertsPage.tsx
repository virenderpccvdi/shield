import {
  Box, Typography, Card, CardContent, Chip, IconButton, Tabs, Tab, Button,
  Alert, Stack, CircularProgress, TextField, InputAdornment, Divider,
  Badge, Tooltip,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import SecurityIcon from '@mui/icons-material/Security';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import FenceIcon from '@mui/icons-material/Fence';
import TimerIcon from '@mui/icons-material/Timer';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAlertStore, AlertItem } from '../../store/alert.store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuthStore } from '../../store/auth.store';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import api from '../../api/axios';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationRecord {
  id: string;
  type: string;
  title?: string;
  body?: string;
  profileId?: string;
  status: string;
  createdAt: string;
}

interface ChildProfile { id: string; name: string; }

interface SosEvent {
  id: string;
  profileId: string;
  status: string;
  latitude?: number;
  longitude?: number;
  triggeredAt?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  message?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso?: string) {
  if (!iso) return 'unknown time';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function notifToAlert(n: NotificationRecord, profileMap: Record<string, string>): AlertItem {
  const type = n.type || 'NOTIFICATION';
  const severity: AlertItem['severity'] =
    type === 'SOS_ALERT' ? 'CRITICAL' :
    type.includes('GEOFENCE') ? 'HIGH' :
    (type.includes('BUDGET') || type.includes('SCREEN_TIME') || type.includes('LOW_BATTERY')) ? 'MEDIUM' : 'LOW';
  return {
    id: n.id,
    type,
    message: n.body || n.title || 'Notification',
    profileId: n.profileId || '',
    profileName: n.profileId ? (profileMap[n.profileId] || '') : '',
    severity,
    timestamp: n.createdAt,
    read: n.status === 'READ',
  };
}

const TYPE_GROUPS: Record<string, string[]> = {
  SOS:       ['SOS_ALERT'],
  Geofence:  ['GEOFENCE_ENTRY', 'GEOFENCE_EXIT', 'GEOFENCE_BREACH'],
  Content:   ['CONTENT_BLOCKED', 'DNS_BLOCK', 'CATEGORY_BLOCKED'],
  Budget:    ['BUDGET_WARNING', 'BUDGET_EXHAUSTED', 'SCREEN_TIME_WARNING', 'SCREEN_TIME_EXCEEDED'],
  Battery:   ['LOW_BATTERY', 'DEVICE_OFFLINE'],
  Other:     [],
};

function getTypeGroup(type: string): string {
  for (const [group, types] of Object.entries(TYPE_GROUPS)) {
    if (group === 'Other') continue;
    if (types.some(t => type.includes(t) || t.includes(type))) return group;
  }
  return 'Other';
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  SOS:      <WarningAmberIcon sx={{ fontSize: 15 }} />,
  Geofence: <FenceIcon sx={{ fontSize: 15 }} />,
  Content:  <SecurityIcon sx={{ fontSize: 15 }} />,
  Budget:   <TimerIcon sx={{ fontSize: 15 }} />,
  Battery:  <BatteryAlertIcon sx={{ fontSize: 15 }} />,
  Other:    <NotificationsActiveIcon sx={{ fontSize: 15 }} />,
};

const TYPE_GROUP_COLOR: Record<string, string> = {
  SOS: '#E53935', Geofence: '#FB8C00', Content: '#1565C0',
  Budget: '#7B1FA2', Battery: '#2E7D32', Other: '#546E7A',
};

const SEVERITY_STYLES: Record<string, { border: string; bg: string; glow: string }> = {
  CRITICAL: { border: '#E53935', bg: '#FFF5F5', glow: '0 0 12px rgba(229,57,53,0.2)' },
  HIGH:     { border: '#FB8C00', bg: '#FFF8F0', glow: '0 0 8px rgba(251,140,0,0.12)' },
  MEDIUM:   { border: '#FFC107', bg: '#FFFDF5', glow: 'none' },
  LOW:      { border: '#43A047', bg: '#FAFFF5', glow: 'none' },
};
const SEVERITY_CHIP_COLOR: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
  CRITICAL: 'error', HIGH: 'warning', MEDIUM: 'warning', LOW: 'success',
};

// ── SOS Panel ─────────────────────────────────────────────────────────────────

function SosPanelSection({ children, profileMap }: {
  children: ChildProfile[];
  profileMap: Record<string, string>;
}) {
  const qc = useQueryClient();
  const [sosTab, setSosTab] = useState<'active' | 'history'>('active');

  const { data: allSosEvents = [], isLoading } = useQuery<(SosEvent & { childName: string })[]>({
    queryKey: ['sos-all-events', children.map(c => c.id).join(',')],
    enabled: children.length > 0,
    queryFn: async () => {
      const results: (SosEvent & { childName: string })[] = [];
      await Promise.all(children.map(async (child) => {
        try {
          const r = await api.get(`/location/${child.id}/sos?all=true`);
          const events: SosEvent[] = r.data?.data ?? r.data ?? [];
          events.forEach(ev => results.push({ ...ev, childName: child.name }));
        } catch { /* ignore per-child errors */ }
      }));
      results.sort((a, b) => new Date(b.triggeredAt ?? 0).getTime() - new Date(a.triggeredAt ?? 0).getTime());
      return results;
    },
    refetchInterval: 30000,
  });

  const activeSos  = allSosEvents.filter(e => e.status === 'ACTIVE');
  const historySos = allSosEvents.filter(e => e.status !== 'ACTIVE');

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.post(`/location/sos/${id}/acknowledge`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sos-all-events'] }),
  });
  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/location/sos/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sos-all-events'] }),
  });

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: '#C62828', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <WarningAmberIcon sx={{ fontSize: 22 }} /> SOS Emergency Alerts
        </Typography>
        {isLoading && <CircularProgress size={16} sx={{ color: '#E53935' }} />}
        {activeSos.length > 0 && (
          <Chip label={`${activeSos.length} ACTIVE`} color="error" size="small" sx={{
            fontWeight: 700, fontSize: 11,
            '@keyframes chipPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.65 } },
            animation: 'chipPulse 1.5s ease-in-out infinite',
          }} />
        )}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
          {(['active', 'history'] as const).map(t => (
            <Button key={t} size="small" variant={sosTab === t ? 'contained' : 'outlined'}
              onClick={() => setSosTab(t)}
              sx={{ borderRadius: 2, fontWeight: 600, fontSize: 12, minWidth: 80, textTransform: 'none',
                ...(t === 'active'
                  ? { bgcolor: sosTab === 'active' ? '#C62828' : 'transparent', borderColor: '#C62828', color: sosTab === 'active' ? '#fff' : '#C62828', '&:hover': { bgcolor: '#B71C1C', color: '#fff' } }
                  : { bgcolor: sosTab === 'history' ? '#1565C0' : 'transparent', borderColor: '#1565C0', color: sosTab === 'history' ? '#fff' : '#1565C0', '&:hover': { bgcolor: '#0D47A1', color: '#fff' } }
                ),
              }}>
              {t === 'active' ? `Active${activeSos.length > 0 ? ` (${activeSos.length})` : ''}` : `History (${historySos.length})`}
            </Button>
          ))}
        </Box>
      </Box>

      {activeSos.length > 0 && (
        <Alert severity="error" icon={false} sx={{
          mb: 2, borderRadius: 2, fontWeight: 600, fontSize: 15,
          '@keyframes bannerPulse': { '0%,100%': { boxShadow: '0 0 0 0 rgba(229,57,53,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(229,57,53,0)' } },
          animation: 'bannerPulse 2s ease-in-out infinite',
        }}>
          🚨 {activeSos.length === 1
            ? `${activeSos[0].childName} has triggered an SOS emergency!`
            : `${activeSos.length} children have triggered SOS emergencies!`
          }{' '}Respond immediately below.
        </Alert>
      )}

      {sosTab === 'active' && !isLoading && activeSos.length === 0 && (
        <Chip icon={<CheckCircleIcon />} label="All clear — No active SOS alerts"
          color="success" variant="outlined"
          sx={{ fontWeight: 600, fontSize: 13, px: 1, py: 0.5, height: 36 }} />
      )}

      {sosTab === 'active' && activeSos.map(sos => (
        <Card key={sos.id} sx={{
          mb: 2, border: '2.5px solid #E53935', bgcolor: '#FFF5F5', borderRadius: 3,
          '@keyframes sosPulse': {
            '0%,100%': { borderColor: '#E53935', boxShadow: '0 0 0 0 rgba(229,57,53,0.35)' },
            '50%': { borderColor: '#B71C1C', boxShadow: '0 0 0 10px rgba(229,57,53,0)' },
          },
          animation: 'sosPulse 2s ease-in-out infinite',
        }}>
          <CardContent sx={{ pb: '16px !important' }}>
            <Stack direction="row" alignItems="flex-start" spacing={2}>
              <Typography sx={{ fontSize: 40, lineHeight: 1, mt: 0.5 }}>🚨</Typography>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#B71C1C' }}>{sos.childName}</Typography>
                  <Chip label="SOS — Needs Help!" color="error" size="small" sx={{ fontWeight: 700 }} />
                </Box>
                <Typography variant="body2" sx={{ color: '#C62828', mb: 0.5, fontWeight: 500 }}>
                  Triggered {timeAgo(sos.triggeredAt)}{sos.triggeredAt && ` (${new Date(sos.triggeredAt).toLocaleString()})`}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                  <LocationOnIcon sx={{ fontSize: 16, color: '#E53935' }} />
                  {sos.latitude && sos.longitude ? (
                    <Typography variant="body2" component="a"
                      href={`https://maps.google.com/?q=${sos.latitude},${sos.longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      sx={{ color: '#1565C0', textDecoration: 'underline' }}>
                      {sos.latitude.toFixed(5)}, {sos.longitude.toFixed(5)} — View on Map
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">Location unavailable</Typography>
                  )}
                </Box>
                {sos.message && (
                  <Typography variant="body2" sx={{ mb: 1.5, fontStyle: 'italic', color: '#555' }}>
                    "{sos.message}"
                  </Typography>
                )}
                <Stack direction="row" spacing={1.5} flexWrap="wrap">
                  <Button variant="outlined" color="warning" size="small"
                    sx={{ fontWeight: 600, borderRadius: 2, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                    disabled={ackMutation.isPending} onClick={() => ackMutation.mutate(sos.id)}>
                    {ackMutation.isPending ? <CircularProgress size={14} /> : 'Acknowledge'}
                  </Button>
                  <Button variant="contained" color="success" size="small"
                    sx={{ fontWeight: 600, borderRadius: 2 }}
                    disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate(sos.id)}>
                    {resolveMutation.isPending ? <CircularProgress size={14} sx={{ color: 'white' }} /> : 'Mark Resolved'}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ))}

      {sosTab === 'history' && (
        historySos.length === 0
          ? <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No SOS history yet.</Typography>
          : <Stack spacing={1.5}>
            {historySos.map(sos => (
              <Box key={sos.id} sx={{
                display: 'flex', alignItems: 'flex-start', gap: 2,
                p: 2, borderRadius: 2, border: '1px solid #E8EDF2',
                bgcolor: sos.status === 'RESOLVED' ? '#F1F8F1' : '#FFF8F0',
              }}>
                <Box sx={{ fontSize: 22, mt: 0.25 }}>{sos.status === 'RESOLVED' ? '✅' : '👁️'}</Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                    <Typography fontWeight={700} variant="body2">{sos.childName}</Typography>
                    <Chip size="small" label={sos.status}
                      color={sos.status === 'RESOLVED' ? 'success' : 'warning'}
                      sx={{ fontSize: 10, fontWeight: 700 }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Triggered: {sos.triggeredAt ? new Date(sos.triggeredAt).toLocaleString() : '—'}
                  </Typography>
                  {sos.acknowledgedAt && <Typography variant="caption" color="text.secondary" display="block">Acknowledged: {new Date(sos.acknowledgedAt).toLocaleString()}</Typography>}
                  {sos.resolvedAt && <Typography variant="caption" color="text.secondary" display="block">Resolved: {new Date(sos.resolvedAt).toLocaleString()}</Typography>}
                  {sos.latitude && sos.longitude && (
                    <Typography variant="caption" component="a"
                      href={`https://maps.google.com/?q=${sos.latitude},${sos.longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      sx={{ color: '#1565C0', textDecoration: 'underline', display: 'block', mt: 0.5 }}>
                      📍 {sos.latitude.toFixed(5)}, {sos.longitude.toFixed(5)} — View on Map
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
      )}
    </Box>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [tab, setTab] = useState(0);          // 0=All, 1=Unread
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { alerts, addAlert } = useAlertStore();
  const user = useAuthStore((s) => s.user);

  useWebSocket(`/topic/alerts/${user?.id}`, (data) => addAlert(data as AlertItem), !!user?.id);

  // Fetch child profiles for name enrichment
  const { data: children = [] } = useQuery<ChildProfile[]>({
    queryKey: ['alert-children'],
    queryFn: () => api.get('/profiles/children')
      .then(r => { const d = r.data?.data; return (d?.content ?? d ?? r.data ?? []) as ChildProfile[]; })
      .catch(() => []),
    staleTime: 300000,
  });
  const profileMap = useMemo(() =>
    Object.fromEntries(children.map(c => [c.id, c.name])), [children]);

  // Fetch persisted notification history from backend
  const { data: historyAlerts = [], isLoading } = useQuery<AlertItem[]>({
    queryKey: ['notification-history'],
    queryFn: async () => {
      const r = await api.get('/notifications/my?page=0&size=50');
      const items: NotificationRecord[] = r.data?.data?.content ?? r.data?.data ?? r.data ?? [];
      return items.map(n => notifToAlert(n, profileMap));
    },
    staleTime: 30000,
    enabled: children.length >= 0, // always run, profileMap may be empty initially
  });

  // Merge WebSocket (in-memory) + backend history, dedup by id
  const allAlerts = useMemo(() => {
    const ids = new Set(alerts.map(a => a.id));
    const merged = [...alerts];
    historyAlerts.forEach(a => { if (!ids.has(a.id)) merged.push(a); });
    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return merged;
  }, [alerts, historyAlerts]);

  // Mark as read — updates in-memory store AND calls backend
  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: (_, id) => {
      useAlertStore.getState().markRead(id);
      qc.invalidateQueries({ queryKey: ['notification-history'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.put('/notifications/my/read-all'),
    onSuccess: () => {
      useAlertStore.getState().markAllRead();
      qc.invalidateQueries({ queryKey: ['notification-history'] });
    },
  });

  // Count type groups for filter chips
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allAlerts.length };
    for (const alert of allAlerts) {
      const g = getTypeGroup(alert.type);
      counts[g] = (counts[g] || 0) + 1;
    }
    return counts;
  }, [allAlerts]);

  const unreadCount = allAlerts.filter(a => !a.read).length;

  const filtered = useMemo(() => {
    let list = tab === 1 ? allAlerts.filter(a => !a.read) : allAlerts;
    if (typeFilter !== 'All') {
      list = list.filter(a => getTypeGroup(a.type) === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.message.toLowerCase().includes(q) ||
        a.profileName.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allAlerts, tab, typeFilter, search]);

  return (
    <AnimatedPage>
      <PageHeader
        icon={<NotificationsActiveIcon />}
        title="Alert Centre"
        subtitle={`${allAlerts.length} total · ${unreadCount} unread`}
        iconColor="#E53935"
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            {isLoading && <CircularProgress size={16} sx={{ color: '#E53935' }} />}
            {unreadCount > 0 && (
              <Button variant="outlined" size="small" startIcon={<DoneAllIcon />}
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                sx={{ borderRadius: 2, borderColor: '#E5393530', color: '#E53935', textTransform: 'none' }}>
                Mark all read ({unreadCount})
              </Button>
            )}
          </Stack>
        }
      />

      {/* SOS emergency section */}
      <SosPanelSection children={children} profileMap={profileMap} />

      <Divider sx={{ mb: 3 }} />

      {/* Notifications section */}
      <AnimatedPage delay={0.1}>
        <Card>
          {/* Tabs + search */}
          <Box sx={{ px: 2, pt: 1.5, pb: 0, borderBottom: '1px solid #F1F5F9' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 1 }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
                minHeight: 36,
                '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', minHeight: 36, py: 0.5 },
              }}>
                <Tab label="All Notifications" />
                <Tab label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    Unread
                    {unreadCount > 0 && (
                      <Chip size="small" label={unreadCount} color="error"
                        sx={{ height: 18, minWidth: 18, fontSize: 10, fontWeight: 700 }} />
                    )}
                  </Box>
                } />
              </Tabs>
              <TextField size="small" placeholder="Search alerts..."
                value={search} onChange={e => setSearch(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
                sx={{ width: { xs: '100%', sm: 220 }, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Stack>

            {/* Type filter chips */}
            <Stack direction="row" spacing={0.75} sx={{ pb: 1.5, overflowX: 'auto', flexWrap: 'nowrap' }}>
              {['All', 'SOS', 'Geofence', 'Content', 'Budget', 'Battery', 'Other'].map(group => {
                const count = typeCounts[group] ?? 0;
                if (group !== 'All' && count === 0) return null;
                const color = group === 'All' ? '#546E7A' : TYPE_GROUP_COLOR[group];
                const selected = typeFilter === group;
                return (
                  <Chip
                    key={group}
                    icon={group !== 'All' ? TYPE_ICON[group] as any : <FilterListIcon sx={{ fontSize: 15 }} />}
                    label={`${group} ${count > 0 ? `(${count})` : ''}`}
                    size="small"
                    onClick={() => setTypeFilter(group)}
                    sx={{
                      fontWeight: 600, fontSize: 11, cursor: 'pointer', flexShrink: 0,
                      bgcolor: selected ? color : `${color}18`,
                      color: selected ? '#fff' : color,
                      border: `1px solid ${color}40`,
                      '&:hover': { bgcolor: selected ? color : `${color}30` },
                    }}
                  />
                );
              })}
            </Stack>
          </Box>

          {/* Alert list */}
          {isLoading && filtered.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<NotificationsNoneIcon sx={{ fontSize: 36, color: '#9E9E9E' }} />}
              title={tab === 1 ? 'All caught up!' : search ? 'No matching alerts' : 'No notifications yet'}
              description={tab === 1 ? 'You have no unread alerts' : search ? 'Try adjusting your search' : 'Alerts will appear here when triggered'}
            />
          ) : (
            <Box>
              {filtered.map((alert, i) => {
                const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.LOW;
                const group = getTypeGroup(alert.type);
                const groupColor = TYPE_GROUP_COLOR[group] || '#546E7A';
                const profileName = alert.profileName || (alert.profileId ? profileMap[alert.profileId] : '');
                return (
                  <Box key={alert.id} sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 2,
                    px: 2.5, py: 1.75,
                    borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none',
                    borderLeft: `4px solid ${alert.read ? '#E8EDF2' : style.border}`,
                    bgcolor: alert.read ? 'transparent' : style.bg,
                    boxShadow: !alert.read ? style.glow : 'none',
                    cursor: alert.profileId ? 'pointer' : 'default',
                    transition: 'all 0.18s ease',
                    '&:hover': { bgcolor: '#FAFBFC' },
                    '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                    animation: `fadeInUp 0.3s ease ${Math.min(i * 0.04, 0.4)}s both`,
                  }}
                    onClick={() => {
                      if (alert.profileId) {
                        if (!alert.read) markReadMutation.mutate(alert.id);
                        navigate(`/profiles/${alert.profileId}`);
                      }
                    }}
                  >
                    {/* Severity dot */}
                    {!alert.read && (
                      <Box sx={{
                        width: 8, height: 8, borderRadius: '50%', bgcolor: style.border,
                        mt: 0.75, flexShrink: 0,
                        ...(alert.severity === 'CRITICAL' && {
                          '@keyframes dotPulse': { '0%,100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.5, transform: 'scale(1.4)' } },
                          animation: 'dotPulse 1.5s ease-in-out infinite',
                        }),
                      }} />
                    )}
                    {alert.read && <Box sx={{ width: 8, flexShrink: 0 }} />}

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          icon={TYPE_ICON[group] as any}
                          label={group}
                          sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: `${groupColor}18`, color: groupColor }}
                        />
                        {alert.severity !== 'LOW' && (
                          <Chip size="small" label={alert.severity}
                            color={SEVERITY_CHIP_COLOR[alert.severity]}
                            sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                        )}
                        {profileName && (
                          <Typography variant="caption" fontWeight={600} sx={{ color: '#1565C0' }}>
                            {profileName}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', flexShrink: 0 }}>
                          {timeAgo(alert.timestamp)}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={alert.read ? 400 : 600} noWrap>
                        {alert.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(alert.timestamp).toLocaleString()}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={0.25} flexShrink={0} alignItems="center">
                      {alert.profileId && (
                        <Tooltip title="View profile">
                          <OpenInNewIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                        </Tooltip>
                      )}
                      {!alert.read && (
                        <Tooltip title="Mark as read">
                          <IconButton size="small"
                            onClick={e => { e.stopPropagation(); markReadMutation.mutate(alert.id); }}
                            sx={{ bgcolor: '#F1F5F9', '&:hover': { bgcolor: '#E8EDF2' } }}>
                            <CheckIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          )}
        </Card>
      </AnimatedPage>
    </AnimatedPage>
  );
}
