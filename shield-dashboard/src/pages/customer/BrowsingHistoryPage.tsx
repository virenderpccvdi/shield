import { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Button, Stack, Alert, Snackbar, Divider, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tab, Tabs, Paper, TextField, InputAdornment, TablePagination,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import HistoryIcon from '@mui/icons-material/History';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TodayIcon from '@mui/icons-material/Today';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface ChildProfile { id: string; name: string; }

interface DnsHistoryEntry {
  id: string;
  domain: string;
  action: 'BLOCKED' | 'ALLOWED';
  category: string;
  queriedAt: string;
}

interface DnsHistoryPage {
  content: DnsHistoryEntry[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface DnsStats {
  totalToday: number;
  blockedToday: number;
  allowedToday: number;
  topDomains: { domain: string; count: number }[];
}

type FilterTab = 0 | 1 | 2; // All | Blocked | Allowed
type Period = 'TODAY' | 'WEEK' | 'MONTH';

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Today', value: 'TODAY' },
  { label: 'Week', value: 'WEEK' },
  { label: 'Month', value: 'MONTH' },
];

function getPeriodCutoff(period: Period): Date {
  const now = new Date();
  if (period === 'TODAY') {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (period === 'WEEK') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function exportCsv(entries: DnsHistoryEntry[], profileId: string | null) {
  const header = 'Domain,Action,Category,Time\n';
  const rows = entries.map(e =>
    [
      `"${e.domain}"`,
      e.action,
      `"${e.category ?? ''}"`,
      `"${formatDateTime(e.queriedAt)}"`,
    ].join(',')
  );
  const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dns-history-${profileId ?? 'profile'}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CategoryBadge({ category }: { category: string }) {
  if (!category) return null;
  return (
    <Chip
      label={category}
      size="small"
      sx={{
        height: 20,
        fontSize: 10,
        fontWeight: 600,
        bgcolor: 'action.hover',
        color: 'text.secondary',
        textTransform: 'capitalize',
      }}
    />
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  gradient,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}) {
  return (
    <Card sx={{
      flex: 1, minWidth: 0,
      background: gradient,
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <Box sx={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.1)' }} />
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, position: 'relative', zIndex: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{
            width: 40, height: 40, borderRadius: '10px',
            bgcolor: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Box sx={{ color: '#fff' }}>{icon}</Box>
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.1, color: '#fff' }}>
              {value?.toLocaleString() ?? '—'}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function BrowsingHistoryPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>(0);
  const [period, setPeriod] = useState<Period>('TODAY');
  const [search, setSearch] = useState('');
  const [clearDialog, setClearDialog] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () =>
      api.get('/profiles/children').then(r => {
        const d = r.data?.data;
        return (d?.content ?? d ?? r.data) as ChildProfile[];
      }).catch(() => [] as ChildProfile[]),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  // Reset page to 0 when tab, period, or profileId changes
  useEffect(() => { setPage(0); }, [tab, period, profileId]);

  // Fetch stats: two parallel calls to /analytics/{profileId}/stats and /analytics/{profileId}/top-domains
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dns-analytics-stats', profileId],
    queryFn: async () => {
      const [statsRes, topRes] = await Promise.all([
        api.get(`/analytics/${profileId}/stats`, { params: { period: 'today' } }),
        api.get(`/analytics/${profileId}/top-domains`, { params: { action: 'BLOCKED', limit: 10 } }),
      ]);
      const s = statsRes.data?.data ?? statsRes.data;
      const topRaw = topRes.data?.data ?? topRes.data;
      const topDomains: { domain: string; count: number }[] = Array.isArray(topRaw)
        ? topRaw
        : [];
      return {
        totalToday: s?.totalQueries ?? s?.totalToday ?? 0,
        blockedToday: s?.blockedQueries ?? s?.totalBlocked ?? 0,
        allowedToday: s?.allowedQueries ?? s?.totalAllowed ?? 0,
        topDomains,
      } as DnsStats;
    },
    enabled: !!profileId,
  });

  const { data: historyData, isLoading: loadingHistory, isFetching: fetchingHistory } = useQuery({
    queryKey: ['dns-analytics-history', profileId, tab, page, rowsPerPage],
    queryFn: () => {
      const params: Record<string, string | number> = { page, size: rowsPerPage };
      if (tab === 1) params.action = 'BLOCKED';
      else if (tab === 2) params.action = 'ALLOWED';
      return api.get(`/analytics/${profileId}/history`, { params })
        .then(r => {
          const d = r.data?.data ?? r.data;
          if (d?.content) {
            return d as DnsHistoryPage;
          }
          const arr = Array.isArray(d) ? d : [];
          return {
            content: arr,
            totalElements: arr.length,
            totalPages: 1,
            number: 0,
            size: arr.length,
          } as DnsHistoryPage;
        })
        .catch(() => ({
          content: [],
          totalElements: 0,
          totalPages: 0,
          number: 0,
          size: rowsPerPage,
        } as DnsHistoryPage));
    },
    enabled: !!profileId,
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete(`/dns/history/${profileId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dns-analytics-history', profileId] });
      qc.invalidateQueries({ queryKey: ['dns-analytics-stats', profileId] });
      setClearDialog(false);
      setSnackbar({ open: true, message: 'Browsing history cleared', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to clear history', severity: 'error' }),
  });

  // Client-side filtering: period date cutoff + domain search applied to current page data only
  const filteredEntries = useMemo(() => {
    const cutoff = getPeriodCutoff(period);
    const raw = historyData?.content ?? [];
    return raw.filter(e => {
      const withinPeriod = new Date(e.queriedAt) > cutoff;
      const matchesSearch = !search || e.domain.toLowerCase().includes(search.toLowerCase());
      return withinPeriod && matchesSearch;
    });
  }, [historyData, period, search]);

  if (loadingChildren) return <LoadingPage />;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader
          icon={<HistoryIcon />}
          title="Browsing History"
          subtitle="View DNS query history for your child's device"
          iconColor="#1565C0"
        />
        <EmptyState
          title="No child profiles"
          description="Add a child profile first to view browsing history"
        />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<HistoryIcon />}
        title="Browsing History"
        subtitle="DNS query history for your child's device"
        iconColor="#1565C0"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: profileId === c.id ? '#1565C0' : 'rgba(21,101,192,0.08)',
                  color: profileId === c.id ? 'white' : '#1565C0',
                  '&:hover': { bgcolor: profileId === c.id ? '#0D47A1' : 'rgba(21,101,192,0.16)' },
                }}
              />
            ))}
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteSweepIcon />}
              onClick={() => setClearDialog(true)}
              disabled={!profileId}
              sx={{ fontWeight: 600 }}
            >
              Clear History
            </Button>
          </Stack>
        }
      />

      {/* Stats Cards */}
      {loadingStats ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <AnimatedPage delay={0.05}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <StatCard
              label="Total Today"
              value={stats?.totalToday}
              icon={<TodayIcon fontSize="small" />}
              color="#1565C0"
              gradient="linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)"
            />
            <StatCard
              label="Blocked Today"
              value={stats?.blockedToday}
              icon={<BlockIcon fontSize="small" />}
              color="#C62828"
              gradient="linear-gradient(135deg, #C62828 0%, #B71C1C 100%)"
            />
            <StatCard
              label="Allowed Today"
              value={stats?.allowedToday}
              icon={<CheckCircleIcon fontSize="small" />}
              color="#2E7D32"
              gradient="linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)"
            />
          </Stack>
        </AnimatedPage>
      )}

      {/* Top Blocked Domains */}
      {stats?.topDomains && stats.topDomains.length > 0 && (
        <AnimatedPage delay={0.1}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ pb: '16px !important' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                Top Blocked Domains
              </Typography>
              <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                {stats.topDomains.slice(0, 10).map((d: { domain: string; count: number }) => (
                  <Chip
                    key={d.domain}
                    label={`${d.domain} (${d.count})`}
                    size="small"
                    icon={<BlockIcon />}
                    sx={{
                      bgcolor: '#FFEBEE',
                      color: '#C62828',
                      fontFamily: 'monospace',
                      fontSize: 11,
                      '& .MuiChip-icon': { color: '#C62828', fontSize: 14 },
                    }}
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* Filters */}
      <AnimatedPage delay={0.12}>
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ pb: '12px !important', pt: 1.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v as FilterTab)}
                sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0, fontSize: 13, fontWeight: 600 } }}
              >
                <Tab label="All" />
                <Tab label="Blocked" />
                <Tab label="Allowed" />
              </Tabs>
              <Stack direction="row" spacing={0.75} alignItems="center">
                {PERIODS.map(p => (
                  <Chip
                    key={p.value}
                    label={p.label}
                    size="small"
                    onClick={() => setPeriod(p.value)}
                    sx={{
                      fontWeight: 600,
                      fontSize: 12,
                      bgcolor: period === p.value ? '#1565C0' : 'action.hover',
                      color: period === p.value ? 'white' : 'text.secondary',
                      '&:hover': { bgcolor: period === p.value ? '#0D47A1' : 'action.selected' },
                    }}
                  />
                ))}
              </Stack>
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            {/* Search + Export row */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <TextField
                size="small"
                placeholder="Search domain… (current page)"
                value={search}
                onChange={e => setSearch(e.target.value)}
                sx={{ flex: 1, maxWidth: { sm: 340 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                }}
              />
              {search && (
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  Searching within current page
                </Typography>
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadIcon />}
                disabled={filteredEntries.length === 0}
                onClick={() => exportCsv(filteredEntries, profileId)}
                sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                Export CSV
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* History Table */}
      <AnimatedPage delay={0.15}>
        <Card>
          {/* LinearProgress shown while fetching (page transitions) */}
          <Box sx={{ height: 3 }}>
            {fetchingHistory && <LinearProgress sx={{ height: 3 }} />}
          </Box>

          {loadingHistory ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : filteredEntries.length === 0 ? (
            <CardContent>
              <EmptyState
                icon={<DnsIcon sx={{ fontSize: 36, color: 'primary.main' }} />}
                title="No history found"
                description={
                  tab === 1
                    ? 'No blocked queries for this period'
                    : tab === 2
                    ? 'No allowed queries for this period'
                    : 'No DNS queries recorded for this period'
                }
              />
            </CardContent>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 700, fontSize: 12, color: 'text.secondary', bgcolor: 'action.hover' } }}>
                    <TableCell>Domain</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEntries.map((entry, i) => {
                    const isBlocked = entry.action === 'BLOCKED';
                    return (
                      <TableRow
                        key={entry.id}
                        sx={{
                          '&:last-child td': { border: 0 },
                          bgcolor: i % 2 === 0 ? 'transparent' : 'action.hover',
                          '&:hover': { bgcolor: 'action.selected' },
                        }}
                      >
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12.5, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.domain}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={isBlocked ? 'Blocked' : 'Allowed'}
                            sx={{
                              height: 20,
                              fontSize: 10,
                              fontWeight: 700,
                              bgcolor: isBlocked ? '#FFEBEE' : '#E8F5E9',
                              color: isBlocked ? '#C62828' : '#2E7D32',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <CategoryBadge category={entry.category} />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {formatDateTime(entry.queriedAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <TablePagination
                component="div"
                count={historyData?.totalElements ?? 0}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}–${to} of ${count} entries`
                }
                sx={{ borderTop: '1px solid', borderColor: 'divider' }}
              />
            </TableContainer>
          )}
        </Card>
      </AnimatedPage>

      {/* Clear History Confirmation Dialog */}
      <Dialog open={clearDialog} onClose={() => setClearDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Clear Browsing History</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently delete all DNS query history for this profile. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setClearDialog(false)} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
            sx={{ fontWeight: 600 }}
          >
            {clearMutation.isPending ? 'Clearing...' : 'Clear History'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
