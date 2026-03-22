import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Button, Stack, Alert, Snackbar, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tab, Tabs, Paper,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import HistoryIcon from '@mui/icons-material/History';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TodayIcon from '@mui/icons-material/Today';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface ChildProfile { id: string; name: string; }

interface DnsHistoryEntry {
  id: string;
  domain: string;
  wasBlocked: boolean;
  category: string;
  queryType: string;
  queriedAt: string;
}

interface DnsHistoryPage {
  content: DnsHistoryEntry[];
  totalElements: number;
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
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card sx={{ flex: 1, minWidth: 0 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{
            width: 40, height: 40, borderRadius: '10px',
            bgcolor: `${color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Box sx={{ color }}>{icon}</Box>
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.1, color }}>
              {value ?? '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
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
  const [clearDialog, setClearDialog] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () =>
      api.get('/profile/profiles').then(r => {
        const d = r.data?.data;
        return (d?.content ?? d ?? r.data) as ChildProfile[];
      }).catch(() => [] as ChildProfile[]),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dns-history-stats', profileId],
    queryFn: () =>
      api.get(`/dns/history/${profileId}/stats`).then(r => r.data?.data ?? r.data as DnsStats),
    enabled: !!profileId,
  });

  const blockedOnly = tab === 1 ? true : tab === 2 ? false : undefined;
  const historyParams: Record<string, string | boolean | number> = { page: 0, size: 50, period };
  if (tab === 1) historyParams.blockedOnly = true;
  if (tab === 2) historyParams.blockedOnly = false;

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['dns-history', profileId, tab, period],
    queryFn: () =>
      api.get(`/dns/history/${profileId}`, { params: historyParams })
        .then(r => {
          const d = r.data?.data ?? r.data;
          return (d?.content ? d : { content: Array.isArray(d) ? d : [], totalElements: Array.isArray(d) ? d.length : 0 }) as DnsHistoryPage;
        }).catch(() => ({ content: [], totalElements: 0 } as DnsHistoryPage)),
    enabled: !!profileId,
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete(`/dns/history/${profileId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dns-history', profileId] });
      qc.invalidateQueries({ queryKey: ['dns-history-stats', profileId] });
      setClearDialog(false);
      setSnackbar({ open: true, message: 'Browsing history cleared', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to clear history', severity: 'error' }),
  });

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

  const entries = historyData?.content ?? [];

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
            />
            <StatCard
              label="Blocked Today"
              value={stats?.blockedToday}
              icon={<BlockIcon fontSize="small" />}
              color="#C62828"
            />
            <StatCard
              label="Allowed Today"
              value={stats?.allowedToday}
              icon={<CheckCircleIcon fontSize="small" />}
              color="#2E7D32"
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
              <Stack direction="row" spacing={0.75}>
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
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* History Table */}
      <AnimatedPage delay={0.15}>
        <Card>
          {loadingHistory ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : entries.length === 0 ? (
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
                  {entries.map((entry, i) => (
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
                          label={entry.wasBlocked ? 'Blocked' : 'Allowed'}
                          sx={{
                            height: 20,
                            fontSize: 10,
                            fontWeight: 700,
                            bgcolor: entry.wasBlocked ? '#FFEBEE' : '#E8F5E9',
                            color: entry.wasBlocked ? '#C62828' : '#2E7D32',
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
                  ))}
                </TableBody>
              </Table>
              {historyData && historyData.totalElements > entries.length && (
                <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary">
                    Showing {entries.length} of {historyData.totalElements} entries
                  </Typography>
                </Box>
              )}
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
