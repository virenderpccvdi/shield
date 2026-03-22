import { Box, Typography, Card, CardContent, Chip, TextField, InputAdornment, type SxProps, type Theme } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import TimelineIcon from '@mui/icons-material/Timeline';
import WifiIcon from '@mui/icons-material/Wifi';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface DnsEvent { id: string; domain: string; action: 'ALLOWED' | 'BLOCKED'; category: string; queriedAt: string; }

interface ActivityStats {
  totalQueries: number;
  totalBlocked: number;
  totalAllowed: number;
  blockRate: number;
}

interface ActivityPageProps {
  profileId?: string;
}

const EVENT_ROW_BASE_SX: SxProps<Theme> = {
  display: 'flex', alignItems: 'center', gap: 1.5,
  px: 2.5, py: 1.5,
  borderBottom: '1px solid #F1F5F9',
  transition: 'all 0.2s ease',
  '&:hover': { bgcolor: '#FAFBFC' },
  '@keyframes slideInLeft': { from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
} as const;

export default function ActivityPage({ profileId: profileIdProp }: ActivityPageProps) {
  const theme = useTheme();
  const { profileId: profileIdParam } = useParams();
  const profileId = profileIdProp ?? profileIdParam;
  const [events, setEvents] = useState<DnsEvent[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ALLOWED' | 'BLOCKED'>('ALL');

  // Load recent history — auto-refreshes every 30s
  const { data: history } = useQuery({
    queryKey: ['activity-history', profileId],
    queryFn: () => api.get(`/analytics/${profileId}/history`, { params: { page: 0, size: 100 } })
      .then(r => {
        const raw = r.data?.content ?? r.data?.data?.content ?? r.data?.data ?? r.data;
        return (Array.isArray(raw) ? raw : []) as DnsEvent[];
      })
      .catch(() => [] as DnsEvent[]),
    enabled: !!profileId,
    refetchInterval: 30000,
  });

  // Stats summary — normalise backend field names to guard against NaN
  const { data: stats } = useQuery({
    queryKey: ['activity-stats', profileId],
    queryFn: () => api.get(`/analytics/${profileId}/stats`, { params: { period: 'TODAY' } })
      .then(r => {
        const raw = r.data?.data ?? r.data;
        return {
          totalQueries: raw?.totalQueries ?? 0,
          totalBlocked: raw?.totalBlocked ?? raw?.blockedQueries ?? 0,
          totalAllowed: raw?.totalAllowed ?? raw?.allowedQueries ?? 0,
          blockRate: Number.isFinite(raw?.blockRate) ? raw.blockRate : 0,
        } as ActivityStats;
      })
      .catch(() => ({ totalQueries: 0, totalBlocked: 0, totalAllowed: 0, blockRate: 0 } as ActivityStats)),
    enabled: !!profileId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (history && history.length > 0) {
      setEvents(history);
    }
  }, [history]);

  // Prepend real-time WebSocket events
  useWebSocket(`/topic/activity/${profileId}`, (data) => {
    setEvents((prev) => [data as DnsEvent, ...prev].slice(0, 500));
  }, !!profileId);

  const filtered = events.filter(e =>
    (filter === 'ALL' || e.action === filter) &&
    (!search || e.domain.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AnimatedPage>
      <PageHeader
        icon={<TimelineIcon />}
        title="Live Activity"
        subtitle={[
          'Real-time DNS query monitoring',
          events.length > 0 ? `${events.length} events` : '',
          stats ? `Block rate: ${Number.isFinite(stats.blockRate) ? stats.blockRate.toFixed(1) : '0.0'}%` : '',
        ].filter(Boolean).join(' · ')}
        iconColor={theme.palette.primary.main}
      />

      <AnimatedPage delay={0.1}>
        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField size="small" placeholder="Search domains..." value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: '#9E9E9E' }} /></InputAdornment> } }}
            sx={{ minWidth: 240, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#F8FAFC' } }}
          />
          {(['ALL', 'BLOCKED', 'ALLOWED'] as const).map(f => (
            <Chip key={f} label={f} variant={filter === f ? 'filled' : 'outlined'}
              color={f === 'BLOCKED' ? 'error' : f === 'ALLOWED' ? 'success' : 'default'}
              onClick={() => setFilter(f)}
              sx={{ cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s ease', '&:hover': { transform: 'translateY(-1px)' } }}
            />
          ))}
        </Box>
      </AnimatedPage>

      <AnimatedPage delay={0.2}>
        <Card>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {filtered.length === 0 ? (
              <EmptyState
                icon={<WifiIcon sx={{ fontSize: 36, color: 'primary.main' }} />}
                title="Waiting for DNS events..."
                description="Events will appear here in real-time as they are processed"
              />
            ) : (
              <Box>
                {filtered.slice(0, 100).map((ev, i) => (
                  <Box key={ev.id || i} sx={{
                    ...EVENT_ROW_BASE_SX,
                    borderLeft: `4px solid ${ev.action === 'BLOCKED' ? theme.palette.error.main : theme.palette.success.main}`,
                    animation: `slideInLeft 0.3s ease ${Math.min(i * 0.03, 0.5)}s both`,
                  }}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, bgcolor: '#F8FAFC', px: 1, py: 0.3, borderRadius: 1 }}>
                      {new Date(ev.queriedAt).toLocaleTimeString()}
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }} noWrap>{ev.domain}</Typography>
                    <Chip size="small" label={ev.action} color={ev.action === 'BLOCKED' ? 'error' : 'success'} sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ bgcolor: '#F8FAFC', px: 1, py: 0.3, borderRadius: 1 }}>
                      {ev.category}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>
    </AnimatedPage>
  );
}
