import {
  Box, Typography, Card, CardContent, Chip, IconButton, Tabs, Tab, Button,
  Alert, Stack, CircularProgress,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAlertStore, AlertItem } from '../../store/alert.store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuthStore } from '../../store/auth.store';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import api from '../../api/axios';

const severityColor: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  LOW: 'success', MEDIUM: 'warning', HIGH: 'error', CRITICAL: 'error'
};

const severityStyles: Record<string, { border: string; glow: string; bg: string }> = {
  CRITICAL: { border: '#E53935', glow: '0 0 12px rgba(229,57,53,0.25)', bg: '#FFF5F5' },
  HIGH: { border: '#FB8C00', glow: '0 0 8px rgba(251,140,0,0.15)', bg: '#FFF8F0' },
  MEDIUM: { border: '#FFC107', glow: 'none', bg: '#FFFDF5' },
  LOW: { border: '#43A047', glow: 'none', bg: '#FAFFF5' },
};

interface ChildProfile {
  id: string;
  name: string;
}

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

function timeAgo(iso?: string) {
  if (!iso) return 'unknown time';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
  return `${Math.floor(h / 24)} day${Math.floor(h / 24) !== 1 ? 's' : ''} ago`;
}

function SosPanelSection() {
  const qc = useQueryClient();

  const { data: children = [], isLoading: childrenLoading } = useQuery<ChildProfile[]>({
    queryKey: ['sos-children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data ?? []) as ChildProfile[];
    }).catch(() => []),
    refetchInterval: 30000,
  });

  const { data: allSosEvents = [], isLoading: sosLoading } = useQuery<(SosEvent & { childName: string })[]>({
    queryKey: ['sos-all-events', children.map(c => c.id).join(',')],
    queryFn: async () => {
      const results: (SosEvent & { childName: string })[] = [];
      await Promise.all(children.map(async (child) => {
        try {
          const r = await api.get(`/location/${child.id}/sos?all=true`);
          const events: SosEvent[] = r.data?.data ?? r.data ?? [];
          events.forEach(ev => results.push({ ...ev, childName: child.name }));
        } catch {
          // ignore per-child errors
        }
      }));
      return results;
    },
    enabled: children.length > 0,
    refetchInterval: 30000,
  });

  const activeSos = allSosEvents.filter(e => e.status === 'ACTIVE');

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/location/sos/${id}/acknowledge`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sos-all-events'] }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/location/sos/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sos-all-events'] }),
  });

  const isLoading = childrenLoading || (children.length > 0 && sosLoading);

  return (
    <Box sx={{ mb: 3 }}>
      {/* Section header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: '#C62828' }}>
          SOS Emergency Alerts
        </Typography>
        {isLoading && <CircularProgress size={16} sx={{ color: '#E53935' }} />}
        {activeSos.length > 0 && (
          <Chip
            label={`${activeSos.length} ACTIVE`}
            color="error"
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: 11,
              '@keyframes chipPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.65 } },
              animation: 'chipPulse 1.5s ease-in-out infinite',
            }}
          />
        )}
      </Box>

      {/* Active SOS alert banner */}
      {activeSos.length > 0 && (
        <Alert
          severity="error"
          icon={false}
          sx={{
            mb: 2, borderRadius: 2, fontWeight: 600, fontSize: 15,
            '@keyframes bannerPulse': {
              '0%, 100%': { boxShadow: '0 0 0 0 rgba(229,57,53,0.4)' },
              '50%': { boxShadow: '0 0 0 8px rgba(229,57,53,0)' },
            },
            animation: 'bannerPulse 2s ease-in-out infinite',
          }}
        >
          🚨 {activeSos.length === 1
            ? `${activeSos[0].childName} has triggered an SOS emergency!`
            : `${activeSos.length} children have triggered SOS emergencies!`}
          {' '}Respond immediately below.
        </Alert>
      )}

      {/* No active SOS */}
      {!isLoading && activeSos.length === 0 && (
        <Chip
          icon={<CheckCircleIcon />}
          label="All clear — No active SOS alerts"
          color="success"
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: 13, px: 1, py: 0.5, height: 36 }}
        />
      )}

      {/* Active SOS Cards */}
      {activeSos.map((sos) => (
        <Card
          key={sos.id}
          sx={{
            mb: 2,
            border: '2.5px solid #E53935',
            bgcolor: '#FFF5F5',
            borderRadius: 3,
            '@keyframes sosPulse': {
              '0%, 100%': { borderColor: '#E53935', boxShadow: '0 0 0 0 rgba(229,57,53,0.35)' },
              '50%': { borderColor: '#B71C1C', boxShadow: '0 0 0 10px rgba(229,57,53,0)' },
            },
            animation: 'sosPulse 2s ease-in-out infinite',
          }}
        >
          <CardContent sx={{ pb: '16px !important' }}>
            <Stack direction="row" alignItems="flex-start" spacing={2}>
              {/* Icon */}
              <Typography sx={{ fontSize: 40, lineHeight: 1, mt: 0.5 }}>🚨</Typography>

              <Box sx={{ flex: 1 }}>
                {/* Heading */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#B71C1C' }}>
                    {sos.childName}
                  </Typography>
                  <Chip label="SOS Alert — Needs Help!" color="error" size="small" sx={{ fontWeight: 700 }} />
                </Box>

                {/* Triggered time */}
                <Typography variant="body2" sx={{ color: '#C62828', mb: 0.5, fontWeight: 500 }}>
                  Triggered {timeAgo(sos.triggeredAt)}
                  {sos.triggeredAt && ` (${new Date(sos.triggeredAt).toLocaleString()})`}
                </Typography>

                {/* Location */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                  <LocationOnIcon sx={{ fontSize: 16, color: '#E53935' }} />
                  {sos.latitude && sos.longitude ? (
                    <Typography
                      variant="body2"
                      component="a"
                      href={`https://maps.google.com/?q=${sos.latitude},${sos.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: '#1565C0', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {sos.latitude.toFixed(5)}, {sos.longitude.toFixed(5)} — View on Map
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">Location unavailable</Typography>
                  )}
                </Box>

                {/* Action buttons */}
                <Stack direction="row" spacing={1.5} flexWrap="wrap">
                  <Button
                    variant="outlined"
                    color="warning"
                    size="small"
                    sx={{ fontWeight: 600, borderRadius: 2, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                    disabled={acknowledgeMutation.isPending}
                    onClick={() => acknowledgeMutation.mutate(sos.id)}
                  >
                    {acknowledgeMutation.isPending ? <CircularProgress size={14} /> : 'Acknowledge'}
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    sx={{ fontWeight: 600, borderRadius: 2 }}
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate(sos.id)}
                  >
                    {resolveMutation.isPending ? <CircularProgress size={14} sx={{ color: 'white' }} /> : 'Resolve'}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

export default function AlertsPage() {
  const [tab, setTab] = useState(0);
  const navigate = useNavigate();
  const { alerts, unreadCount, markRead, markAllRead, addAlert } = useAlertStore();
  const user = useAuthStore((s) => s.user);

  useWebSocket(`/topic/alerts/${user?.id}`, (data) => addAlert(data as AlertItem), !!user?.id);

  const filtered = tab === 0 ? alerts : alerts.filter((a) => !a.read);

  return (
    <AnimatedPage>
      <PageHeader
        icon={<NotificationsActiveIcon />}
        title="Alert Centre"
        subtitle={`${alerts.length} total alert${alerts.length !== 1 ? 's' : ''}`}
        iconColor="#E53935"
        action={
          unreadCount > 0 ? (
            <Button variant="outlined" size="small" startIcon={<DoneAllIcon />} onClick={markAllRead}
              sx={{ borderRadius: 2, borderColor: '#E5393530', color: '#E53935' }}>
              Mark all read ({unreadCount})
            </Button>
          ) : undefined
        }
      />

      {/* SOS Panel — shown at top, above notifications */}
      <SosPanelSection />

      <AnimatedPage delay={0.1}>
        <Card>
          <Tabs value={tab} onChange={(_, v: number) => setTab(v)}
            sx={{ borderBottom: '1px solid #E8EDF2', px: 2, '& .MuiTab-root': { fontWeight: 600, textTransform: 'none' } }}>
            <Tab label="All Alerts" />
            <Tab label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Unread
                {unreadCount > 0 && <Chip size="small" label={unreadCount} color="error" sx={{ height: 20, minWidth: 20, fontSize: 11, fontWeight: 700 }} />}
              </Box>
            } />
          </Tabs>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<NotificationsNoneIcon sx={{ fontSize: 36, color: '#9E9E9E' }} />}
              title={tab === 1 ? 'All caught up!' : 'No alerts yet'}
              description={tab === 1 ? 'You have no unread alerts' : 'Alerts will appear here when triggered'}
            />
          ) : (
            <Box>
              {filtered.map((alert, i) => {
                const style = severityStyles[alert.severity] || severityStyles.LOW;
                return (
                  <Box key={alert.id} sx={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    px: 2.5, py: 2,
                    borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none',
                    borderLeft: `4px solid ${style.border}`,
                    bgcolor: alert.read ? 'transparent' : style.bg,
                    boxShadow: !alert.read ? style.glow : 'none',
                    cursor: alert.profileId ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    '&:hover': { bgcolor: '#FAFBFC' },
                    '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                    animation: `fadeInUp 0.3s ease ${Math.min(i * 0.05, 0.5)}s both`,
                  }}
                    onClick={() => { if (alert.profileId) { markRead(alert.id); navigate(`/profiles/${alert.profileId}`); } }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Chip size="small" label={alert.severity} color={severityColor[alert.severity] || 'default'}
                          sx={{ height: 20, fontSize: 10, fontWeight: 700,
                            ...(alert.severity === 'CRITICAL' && {
                              '@keyframes subtlePulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
                              animation: 'subtlePulse 2s ease-in-out infinite',
                            }) }} />
                        <Typography variant="body2" fontWeight={alert.read ? 400 : 600}>{alert.message}</Typography>
                        {alert.profileId && <OpenInNewIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 'auto' }} />}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {alert.profileName} &middot; {new Date(alert.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                    {!alert.read && (
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); markRead(alert.id); }} title="Mark read"
                        sx={{ bgcolor: '#F1F5F9', '&:hover': { bgcolor: '#E8EDF2' } }}>
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    )}
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
