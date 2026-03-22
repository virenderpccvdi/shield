import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Button, Stack, Alert, Snackbar, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Checkbox, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Paper, IconButton, Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import DnsIcon from '@mui/icons-material/Dns';
import BarChartIcon from '@mui/icons-material/BarChart';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import LoadingPage from '../../components/LoadingPage';

const ICON_COLOR = '#1A237E';
const BG_COLOR = 'rgba(26,35,126,0.08)';

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalProfiles: number;
  totalQueriesAllTime: number;
  topBlockedCategory: string;
}

interface Tenant {
  id: string;
  name: string;
  status: string;
  plan: string;
  createdAt: string;
}

interface TenantsPage {
  content: Tenant[];
  totalElements: number;
  page: number;
  size: number;
}

function StatusChip({ status }: { status: string }) {
  const s = status?.toLowerCase();
  if (s === 'active') return (
    <Chip size="small" label="Active"
      sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'rgba(46,125,50,0.10)', color: '#2E7D32' }} />
  );
  if (s === 'suspended') return (
    <Chip size="small" label="Suspended"
      sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'rgba(198,40,40,0.10)', color: '#C62828' }} />
  );
  return (
    <Chip size="small" label={status}
      sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'action.hover', color: 'text.secondary' }} />
  );
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n ?? 0);
}

export default function PlatformAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // Platform stats
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useQuery({
    queryKey: ['platform-admin-stats'],
    queryFn: () =>
      api.get('/admin/tenants/stats')
        .then(r => (r.data?.data ?? r.data) as PlatformStats)
        .catch(() => ({
          totalTenants: 0, activeTenants: 0,
          totalProfiles: 0, totalQueriesAllTime: 0,
          topBlockedCategory: 'N/A',
        } as PlatformStats)),
  });

  // Tenants list
  const { data: tenantsPage, isLoading: loadingTenants, refetch: refetchTenants } = useQuery({
    queryKey: ['platform-admin-tenants', page],
    queryFn: () =>
      api.get('/tenants', { params: { page, size: PAGE_SIZE } })
        .then(r => {
          const d = r.data?.data;
          if (d?.content) return d as TenantsPage;
          if (Array.isArray(d)) return { content: d, totalElements: d.length, page: 0, size: PAGE_SIZE } as TenantsPage;
          return { content: [], totalElements: 0, page: 0, size: PAGE_SIZE } as TenantsPage;
        }).catch(() => ({ content: [], totalElements: 0, page: 0, size: PAGE_SIZE } as TenantsPage)),
  });

  const tenants = tenantsPage?.content ?? [];
  const totalPages = Math.ceil((tenantsPage?.totalElements ?? 0) / PAGE_SIZE);

  const suspendMutation = useMutation({
    mutationFn: ({ tenantIds, reason }: { tenantIds: string[]; reason: string }) =>
      api.post('/admin/tenants/bulk/suspend', { tenantIds, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-admin-tenants'] });
      qc.invalidateQueries({ queryKey: ['platform-admin-stats'] });
      setSelected(new Set());
      setSuspendDialog(false);
      setSuspendReason('');
      setSnackbar({ open: true, message: `${selected.size} tenant(s) suspended`, severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to suspend tenants', severity: 'error' }),
  });

  const activateMutation = useMutation({
    mutationFn: (tenantIds: string[]) =>
      api.post('/admin/tenants/bulk/activate', { tenantIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-admin-tenants'] });
      qc.invalidateQueries({ queryKey: ['platform-admin-stats'] });
      setSelected(new Set());
      setSnackbar({ open: true, message: `${selected.size} tenant(s) activated`, severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to activate tenants', severity: 'error' }),
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(tenants.map(t => t.id)));
    } else {
      setSelected(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allSelected = tenants.length > 0 && selected.size === tenants.length;
  const someSelected = selected.size > 0 && !allSelected;

  const STAT_CARDS = [
    {
      label: 'Total Tenants',
      value: formatNumber(stats?.totalTenants ?? 0),
      icon: <BusinessIcon sx={{ fontSize: 22 }} />,
      color: '#1565C0',
      bg: 'rgba(21,101,192,0.08)',
    },
    {
      label: 'Active Tenants',
      value: formatNumber(stats?.activeTenants ?? 0),
      icon: <CheckCircleIcon sx={{ fontSize: 22 }} />,
      color: '#2E7D32',
      bg: 'rgba(46,125,50,0.08)',
    },
    {
      label: 'Child Profiles',
      value: formatNumber(stats?.totalProfiles ?? 0),
      icon: <PeopleIcon sx={{ fontSize: 22 }} />,
      color: '#6A1B9A',
      bg: 'rgba(106,27,154,0.08)',
    },
    {
      label: 'Total Queries',
      value: formatNumber(stats?.totalQueriesAllTime ?? 0),
      icon: <DnsIcon sx={{ fontSize: 22 }} />,
      color: '#E65100',
      bg: 'rgba(230,81,0,0.08)',
    },
  ];

  if (loadingStats && loadingTenants) return <LoadingPage />;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<AdminPanelSettingsIcon />}
        title="Platform Administration"
        subtitle="Global platform management — tenants, bulk actions, and system-wide statistics"
        iconColor={ICON_COLOR}
        action={
          <Tooltip title="Refresh data">
            <IconButton
              onClick={() => { refetchStats(); refetchTenants(); }}
              sx={{ color: ICON_COLOR, bgcolor: BG_COLOR, '&:hover': { bgcolor: 'rgba(26,35,126,0.14)' } }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        }
      />

      {/* Stats cards */}
      <AnimatedPage delay={0.05}>
        <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
          {STAT_CARDS.map(card => (
            <Card key={card.label} sx={{ flex: 1, minWidth: 160 }}>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                {loadingStats ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                    <CircularProgress size={20} />
                  </Box>
                ) : (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{
                      width: 44, height: 44, borderRadius: '12px',
                      bgcolor: card.bg, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: card.color, flexShrink: 0,
                    }}>
                      {card.icon}
                    </Box>
                    <Box>
                      <Typography variant="h5" fontWeight={800} sx={{ color: card.color, lineHeight: 1.1 }}>
                        {card.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{card.label}</Typography>
                    </Box>
                  </Stack>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Top blocked category */}
          {stats?.topBlockedCategory && stats.topBlockedCategory !== 'N/A' && (
            <Card sx={{ minWidth: 180 }}>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{
                    width: 44, height: 44, borderRadius: '12px',
                    bgcolor: 'rgba(198,40,40,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#C62828', flexShrink: 0,
                  }}>
                    <BlockIcon sx={{ fontSize: 22 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={700} color="#C62828" noWrap>
                      {stats.topBlockedCategory}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Top blocked category</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      </AnimatedPage>

      {/* Tenants table */}
      <AnimatedPage delay={0.1}>
        <Card>
          <CardContent sx={{ pb: 0, '&:last-child': { pb: 0 } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{
                  width: 38, height: 38, borderRadius: '10px',
                  bgcolor: BG_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: ICON_COLOR,
                }}>
                  <BarChartIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>All Tenants</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {tenantsPage?.totalElements ?? 0} total
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            {/* Bulk action bar */}
            {selected.size > 0 && (
              <Box sx={{
                mb: 2, px: 2, py: 1.5, borderRadius: 2,
                bgcolor: BG_COLOR,
                border: '1px solid rgba(26,35,126,0.20)',
                display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
              }}>
                <Typography variant="body2" fontWeight={600} color={ICON_COLOR}>
                  {selected.size} tenant{selected.size !== 1 ? 's' : ''} selected
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => activateMutation.mutate(Array.from(selected))}
                  disabled={activateMutation.isPending || suspendMutation.isPending}
                  sx={{
                    bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' },
                    fontWeight: 600, fontSize: 12,
                  }}
                >
                  Activate Selected
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<BlockIcon />}
                  onClick={() => setSuspendDialog(true)}
                  disabled={activateMutation.isPending || suspendMutation.isPending}
                  sx={{
                    bgcolor: '#C62828', '&:hover': { bgcolor: '#B71C1C' },
                    fontWeight: 600, fontSize: 12,
                  }}
                >
                  Suspend Selected
                </Button>
              </Box>
            )}

            <Divider />
          </CardContent>

          {loadingTenants ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : tenants.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <BusinessIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">No tenants found</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 700, fontSize: 12, color: 'text.secondary', bgcolor: 'background.default' } }}>
                    <TableCell padding="checkbox" sx={{ bgcolor: 'background.default' }}>
                      <Checkbox
                        size="small"
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={e => handleSelectAll(e.target.checked)}
                        sx={{ '&.Mui-checked': { color: ICON_COLOR }, '&.MuiCheckbox-indeterminate': { color: ICON_COLOR } }}
                      />
                    </TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tenants.map((tenant, i) => (
                    <TableRow
                      key={tenant.id}
                      hover
                      selected={selected.has(tenant.id)}
                      sx={{
                        '&:last-child td': { border: 0 },
                        bgcolor: selected.has(tenant.id) ? BG_COLOR : undefined,
                        '&.Mui-selected': { bgcolor: BG_COLOR },
                        '&.Mui-selected:hover': { bgcolor: 'rgba(26,35,126,0.12)' },
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={selected.has(tenant.id)}
                          onChange={e => handleSelectOne(tenant.id, e.target.checked)}
                          sx={{ '&.Mui-checked': { color: ICON_COLOR } }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box sx={{
                            width: 32, height: 32, borderRadius: '8px',
                            bgcolor: BG_COLOR, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0,
                          }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: ICON_COLOR }}>
                              {tenant.name?.charAt(0)?.toUpperCase() ?? 'T'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{tenant.name}</Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                              {tenant.id.slice(0, 8)}...
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={tenant.status} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {tenant.plan ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(tenant.createdAt)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Page {page + 1} of {totalPages}
              </Typography>
              <IconButton size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <NavigateBeforeIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <NavigateNextIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Card>
      </AnimatedPage>

      {/* Suspend Confirmation Dialog */}
      <Dialog open={suspendDialog} onClose={() => setSuspendDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Suspend {selected.size} Tenant{selected.size !== 1 ? 's' : ''}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning" sx={{ fontSize: 13 }}>
              Suspending a tenant will immediately cut off access for all their users and child profiles.
            </Alert>
            <TextField
              label="Reason for suspension"
              placeholder="e.g. Payment overdue, Terms violation..."
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              multiline
              rows={3}
              fullWidth
              size="small"
              required
              helperText="Required — will be logged in the audit trail"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setSuspendDialog(false)} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => suspendMutation.mutate({ tenantIds: Array.from(selected), reason: suspendReason })}
            disabled={suspendMutation.isPending || !suspendReason.trim()}
            sx={{ fontWeight: 600 }}
          >
            {suspendMutation.isPending ? 'Suspending...' : `Suspend ${selected.size} Tenant${selected.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
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
