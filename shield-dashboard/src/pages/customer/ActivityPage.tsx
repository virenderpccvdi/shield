import { Box, Typography, Card, CardContent, Chip, TextField, InputAdornment } from '@mui/material';
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

interface DnsEvent { id: string; domain: string; action: 'ALLOWED' | 'BLOCKED'; category: string; timestamp: string; }

export default function ActivityPage() {
  const { profileId } = useParams();
  const [events, setEvents] = useState<DnsEvent[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ALLOWED' | 'BLOCKED'>('ALL');

  // Load recent history on mount
  const { data: history } = useQuery({
    queryKey: ['activity-history', profileId],
    queryFn: () => api.get(`/analytics/${profileId}/history`, { params: { limit: 100 } })
      .then(r => (r.data?.data || r.data || []) as DnsEvent[])
      .catch(() => [] as DnsEvent[]),
    enabled: !!profileId,
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
        subtitle={`Real-time DNS query monitoring${events.length > 0 ? ` · ${events.length} events` : ''}`}
        iconColor="#1565C0"
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
                icon={<WifiIcon sx={{ fontSize: 36, color: '#1565C0' }} />}
                title="Waiting for DNS events..."
                description="Events will appear here in real-time as they are processed"
              />
            ) : (
              <Box>
                {filtered.slice(0, 100).map((ev, i) => (
                  <Box key={ev.id || i} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 2.5, py: 1.5,
                    borderBottom: '1px solid #F1F5F9',
                    borderLeft: `4px solid ${ev.action === 'BLOCKED' ? '#E53935' : '#43A047'}`,
                    transition: 'all 0.2s ease',
                    '&:hover': { bgcolor: '#FAFBFC' },
                    '@keyframes slideInLeft': { from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                    animation: `slideInLeft 0.3s ease ${Math.min(i * 0.03, 0.5)}s both`,
                  }}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, bgcolor: '#F8FAFC', px: 1, py: 0.3, borderRadius: 1 }}>
                      {new Date(ev.timestamp).toLocaleTimeString()}
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
