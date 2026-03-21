import {
  Box, Typography, Card, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Stack, Grid, Skeleton,
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PersonIcon from '@mui/icons-material/Person';
import DevicesIcon from '@mui/icons-material/Devices';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WifiIcon from '@mui/icons-material/Wifi';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { gradients } from '../../theme/theme';

interface Visitor {
  id: string;
  sessionId?: string;
  ipAddress?: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  pagePath?: string;
  referrer?: string;
  userAgent?: string;
  isMobile?: boolean;
  visitedAt: string;
}

interface VisitorStats {
  total: number;
  today: number;
  week: number;
  uniqueToday: number;
  byCountry: Record<string, number>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatLocation(visitor: Visitor): string {
  if (visitor.city && visitor.country) return `${visitor.city}, ${visitor.country}`;
  if (visitor.country) return visitor.country;
  return visitor.ipAddress ?? '—';
}

export default function VisitorsPage() {
  const { data: stats } = useQuery<VisitorStats>({
    queryKey: ['visitor-stats'],
    queryFn: () => api.get('/admin/visitors/stats').then(r => r.data?.data ?? r.data).catch(() => ({
      total: 0, today: 0, week: 0, uniqueToday: 0, byCountry: {},
    })),
    refetchInterval: 60000,
  });

  const { data: visitors = [], isLoading } = useQuery<Visitor[]>({
    queryKey: ['visitors'],
    queryFn: () =>
      api.get('/admin/visitors?page=0&size=50').then(r =>
        r.data?.data?.content ?? r.data?.content ?? []
      ).catch(() => []),
    refetchInterval: 60000,
  });

  // Top 10 countries sorted by count
  const topCountries: Array<{ country: string; count: number }> = stats?.byCountry
    ? Object.entries(stats.byCountry)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([country, count]) => ({ country, count }))
    : [];

  const maxCount = topCountries[0]?.count || 1;
  const totalVisitors = stats?.total || 1;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PublicIcon />}
        title="Website Visitors"
        subtitle="Real-time visitor analytics"
        iconColor="#00897B"
      />

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Visitors"
            value={stats?.total ?? 0}
            icon={<PublicIcon />}
            gradient={gradients.teal}
            delay={0}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Today"
            value={stats?.today ?? 0}
            icon={<TrendingUpIcon />}
            gradient={gradients.blue}
            delay={0.05}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="This Week"
            value={stats?.week ?? 0}
            icon={<WifiIcon />}
            gradient={gradients.purple}
            delay={0.1}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Unique Today"
            value={stats?.uniqueToday ?? 0}
            icon={<PersonIcon />}
            gradient={gradients.green}
            delay={0.15}
          />
        </Grid>
      </Grid>

      {/* Main content: table + countries */}
      <Grid container spacing={2.5}>
        {/* Recent visitors table */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={700}>Recent Visitors</Typography>
              <Typography variant="caption" color="text.secondary">Last 50 site visits</Typography>
            </Box>
            {isLoading ? (
              <Box sx={{ p: 2 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} variant="rectangular" height={44} sx={{ mb: 0.5, borderRadius: 1 }} />
                ))}
              </Box>
            ) : visitors.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <PublicIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1.5 }} />
                <Typography variant="h6" color="text.secondary" fontWeight={600}>No visitor data yet</Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" component={Paper} elevation={0}>
                  <TableHead>
                    <TableRow>
                      {['Time', 'IP Address', 'Location', 'Page', 'Device'].map(h => (
                        <TableCell key={h} sx={{
                          fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                          letterSpacing: 0.8, color: 'text.secondary', bgcolor: 'grey.50',
                          borderBottom: '2px solid', borderColor: 'divider',
                        }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visitors.map((v, idx) => (
                      <TableRow
                        key={v.id}
                        hover
                        sx={{
                          '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
                          animation: `fadeIn 0.2s ease ${(idx % 25) * 0.02}s both`,
                        }}
                      >
                        {/* Time */}
                        <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 110 }}>
                          <Typography variant="body2" fontSize={12} fontWeight={600} color="text.primary">
                            {timeAgo(v.visitedAt)}
                          </Typography>
                        </TableCell>

                        {/* IP */}
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace" fontSize={11} color="text.secondary">
                            {v.ipAddress ?? '—'}
                          </Typography>
                        </TableCell>

                        {/* Location */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LocationOnIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                            <Typography variant="caption" fontSize={12} color="text.secondary">
                              {formatLocation(v)}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Page */}
                        <TableCell sx={{ maxWidth: 180 }}>
                          <Typography
                            variant="caption"
                            fontFamily="monospace"
                            fontSize={11}
                            color="text.secondary"
                            sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {v.pagePath ?? '/'}
                          </Typography>
                        </TableCell>

                        {/* Device */}
                        <TableCell>
                          {v.isMobile ? (
                            <Chip
                              size="small"
                              label="Mobile"
                              sx={{ bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700, fontSize: 11, height: 22 }}
                            />
                          ) : (
                            <Chip
                              size="small"
                              icon={<DevicesIcon style={{ fontSize: 12 }} />}
                              label="Desktop"
                              sx={{ bgcolor: '#E3F2FD', color: '#1565C0', fontWeight: 700, fontSize: 11, height: 22 }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Card>
        </Grid>

        {/* Top Countries */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: 2, height: '100%' }}>
            <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={700}>Top Countries</Typography>
              <Typography variant="caption" color="text.secondary">By total visit count</Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              {topCountries.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <PublicIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">No data yet</Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {topCountries.map(({ country, count }) => {
                    const pct = Math.round((count / maxCount) * 100);
                    const sharePct = Math.round((count / totalVisitors) * 100);
                    return (
                      <Box key={country}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <PublicIcon sx={{ fontSize: 14, color: '#00897B' }} />
                            <Typography variant="body2" fontSize={13} fontWeight={600}>
                              {country}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography variant="caption" fontWeight={700} color="text.primary">
                              {count.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ({sharePct}%)
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ height: 6, bgcolor: 'grey.100', borderRadius: 3, overflow: 'hidden' }}>
                          <Box
                            sx={{
                              height: '100%',
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, #00897B 0%, #00ACC1 100%)',
                              borderRadius: 3,
                              transition: 'width 0.6s ease',
                            }}
                          />
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>
    </AnimatedPage>
  );
}
