import {
  Box, Typography, Card, CardContent, Chip, Avatar,
  Tab, Tabs, Alert, CircularProgress, LinearProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Tooltip, IconButton, Select, MenuItem, FormControl, InputLabel,
  Grid,
} from '@mui/material';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import RefreshIcon from '@mui/icons-material/Refresh';
import BlockIcon from '@mui/icons-material/Block';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import LoadingPage from '../../components/LoadingPage';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppUsageEntry {
  appName: string;
  rootDomain: string | null;
  queryCount: number;
  blockedCount: number;
  uniqueDomains: number;
  estimatedSeconds: number;
  other: boolean;
}

interface ChildProfile {
  id: string;
  name: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const THEME_COLOR = '#00695C';
const BLOCKED_COLOR = '#C62828';

const APP_COLORS: Record<string, string> = {
  YouTube:    '#FF0000',
  Instagram:  '#E1306C',
  TikTok:     '#010101',
  Facebook:   '#1877F2',
  'Twitter/X': '#1DA1F2',
  Snapchat:   '#FFFC00',
  Roblox:     '#E02020',
  Discord:    '#5865F2',
  WhatsApp:   '#25D366',
  Netflix:    '#E50914',
  Other:      '#9E9E9E',
};

const PERIODS = [
  { value: 'day',   label: 'Today' },
  { value: 'week',  label: 'This Week' },
  { value: 'month', label: 'This Month' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function appColor(name: string): string {
  return APP_COLORS[name] ?? THEME_COLOR;
}

function appInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? '?';
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon, color,
}: {
  label: string; value: string; icon: React.ReactNode; color: string;
}) {
  return (
    <Card sx={{ flex: 1, minWidth: 140 }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ color }}>{icon}</Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
            {label}
          </Typography>
        </Box>
        <Typography variant="h5" fontWeight={800} sx={{ color }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AppUsagePage() {
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [data, setData] = useState<AppUsageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load profiles
  useEffect(() => {
    setProfilesLoading(true);
    api.get('/profiles/children')
      .then((res) => {
        const list: ChildProfile[] = res.data?.data ?? res.data ?? [];
        setProfiles(list);
        if (list.length > 0) setSelectedProfile(list[0].id);
      })
      .catch(() => setError('Failed to load child profiles'))
      .finally(() => setProfilesLoading(false));
  }, []);

  // Load app usage
  const fetchUsage = useCallback(async () => {
    if (!selectedProfile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/analytics/profiles/${selectedProfile}/app-usage`, {
        params: { period },
      });
      setData(res.data ?? []);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to load app usage data');
    } finally {
      setLoading(false);
    }
  }, [selectedProfile, period]);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const namedApps = data.filter((e) => !e.other);
  const totalQueries = data.reduce((s, e) => s + e.queryCount, 0);
  const totalBlocked = data.reduce((s, e) => s + e.blockedCount, 0);
  const totalSeconds = data.reduce((s, e) => s + e.estimatedSeconds, 0);
  const topApp = namedApps[0];
  const maxCount = namedApps.length > 0 ? Math.max(...namedApps.map((e) => e.queryCount)) : 1;
  const chartData = namedApps.slice(0, 5).map((e) => ({
    name: e.appName,
    queries: e.queryCount,
    blocked: e.blockedCount,
  }));

  if (profilesLoading) return <LoadingPage />;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<QueryStatsIcon />}
        title="App Usage Reports"
        subtitle="See what apps and websites your child is spending time on"
        action={
          <Tooltip title="Refresh">
            <IconButton onClick={fetchUsage} size="small" disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Profile selector + Period tabs */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        {profiles.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Child Profile</InputLabel>
            <Select
              label="Child Profile"
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
            >
              {profiles.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {profiles.length === 1 && (
          <Chip
            avatar={<Avatar sx={{ bgcolor: THEME_COLOR, color: 'white', fontWeight: 700 }}>{profiles[0]?.name?.charAt(0)}</Avatar>}
            label={profiles[0]?.name}
            sx={{ fontWeight: 600 }}
          />
        )}
        <Tabs
          value={period}
          onChange={(_, v) => setPeriod(v)}
          sx={{ '& .MuiTab-root': { minWidth: 90, fontWeight: 600 } }}
        >
          {PERIODS.map((p) => (
            <Tab key={p.value} value={p.value} label={p.label} />
          ))}
        </Tabs>
      </Box>

      {/* Summary cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <SummaryCard
          label="Est. Screen Time"
          value={totalSeconds > 0 ? formatDuration(totalSeconds) : '—'}
          icon={<AccessTimeIcon />}
          color={THEME_COLOR}
        />
        <SummaryCard
          label="Most Used App"
          value={topApp?.appName ?? '—'}
          icon={<QueryStatsIcon />}
          color={THEME_COLOR}
        />
        <SummaryCard
          label="Blocked Requests"
          value={totalBlocked > 0 ? String(totalBlocked) : '0'}
          icon={<BlockIcon />}
          color={totalBlocked > 0 ? BLOCKED_COLOR : 'text.secondary'}
        />
        <SummaryCard
          label="Total DNS Queries"
          value={totalQueries > 0 ? String(totalQueries) : '0'}
          icon={<QueryStatsIcon />}
          color='#1565C0'
        />
      </Box>

      {/* Bar chart — top 5 apps */}
      {chartData.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: THEME_COLOR, mb: 2 }}>
              Top 5 Apps — DNS Queries
            </Typography>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'queries' ? 'Total Queries' : 'Blocked',
                  ]}
                />
                <Bar dataKey="queries" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={appColor(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* App usage table */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: THEME_COLOR, mb: 2 }}>
            App Breakdown
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: THEME_COLOR }} />
            </Box>
          ) : data.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <QueryStatsIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No usage data for this period</Typography>
              <Typography variant="body2" color="text.disabled">
                DNS queries will appear here once the child's device is active
              </Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>App / Domain</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Queries</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Blocked</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Est. Time</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Usage</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((entry) => {
                    const pct = totalQueries > 0
                      ? Math.round((entry.queryCount / totalQueries) * 100)
                      : 0;
                    const color = entry.other ? '#9E9E9E' : appColor(entry.appName);
                    return (
                      <TableRow
                        key={entry.appName}
                        hover
                        sx={{ '&:last-child td': { border: 0 } }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar
                              sx={{
                                width: 32, height: 32,
                                bgcolor: color,
                                fontSize: 14, fontWeight: 700,
                                color: color === '#FFFC00' ? '#333' : 'white',
                              }}
                            >
                              {appInitial(entry.appName)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {entry.appName}
                              </Typography>
                              {entry.rootDomain && (
                                <Typography variant="caption" color="text.secondary">
                                  {entry.rootDomain}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600}>
                            {entry.queryCount.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {entry.blockedCount > 0 ? (
                            <Chip
                              label={entry.blockedCount}
                              size="small"
                              sx={{
                                bgcolor: '#FFEBEE', color: BLOCKED_COLOR,
                                fontWeight: 700, fontSize: 11, height: 20,
                              }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary">
                            {formatDuration(entry.estimatedSeconds)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              sx={{
                                flex: 1, height: 6, borderRadius: 3,
                                bgcolor: '#E0E0E0',
                                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 30 }}>
                              {pct}%
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>
    </AnimatedPage>
  );
}
