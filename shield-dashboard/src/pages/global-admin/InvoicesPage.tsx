import { useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody,
  TablePagination, Button, IconButton, Tooltip, Paper, Snackbar, Alert, Stack,
  Grid, TextField, MenuItem, InputAdornment,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorIcon from '@mui/icons-material/Error';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllInvoices, openInvoicePdf } from '../../api/billing';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import LoadingPage from '../../components/LoadingPage';
import { alpha, useTheme } from '@mui/material/styles';

const STATUS_CONFIG: Record<string, { color: 'success' | 'error' | 'warning' | 'default'; label: string; icon: React.ReactNode }> = {
  PAID:     { color: 'success', label: 'Paid',     icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
  PENDING:  { color: 'warning', label: 'Pending',  icon: <HourglassEmptyIcon sx={{ fontSize: 14 }} /> },
  FAILED:   { color: 'error',   label: 'Failed',   icon: <ErrorIcon sx={{ fontSize: 14 }} /> },
  REFUNDED: { color: 'default', label: 'Refunded', icon: <ReceiptLongIcon sx={{ fontSize: 14 }} /> },
};

function exportCSV(invoices: any[]) {
  const headers = ['Date', 'Invoice ID', 'Tenant', 'Email', 'Plan', 'Amount', 'Currency', 'Status', 'Stripe Invoice'];
  const rows = invoices.map((inv: any) => [
    inv.createdAt, inv.id, inv.tenantName || '', inv.userEmail, inv.planName, inv.amount, inv.currency || 'INR', inv.status, inv.stripeInvoiceId || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}

export default function InvoicesPage() {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-invoices', page, size],
    queryFn: () => getAllInvoices(page, size),
  });

  const now = new Date();
  const generateBatchMutation = useMutation({
    mutationFn: () => api.post('/admin/invoices/generate-batch', { month: now.getMonth() + 1, year: now.getFullYear() }),
    onSuccess: (res) => {
      const count = res.data?.data?.count ?? res.data?.count ?? '?';
      setSnackbar({ open: true, message: `Generated ${count} invoice(s) for ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`, severity: 'success' });
      qc.invalidateQueries({ queryKey: ['admin-invoices'] });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to generate invoices', severity: 'error' }),
  });

  const allInvoices: any[] = data?.content || [];
  const total = data?.totalElements || 0;

  // Client-side filters (applied on top of server pagination)
  const filtered = useMemo(() => allInvoices.filter(inv => {
    if (search && !`${inv.userEmail} ${inv.planName} ${inv.tenantName || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && inv.status !== statusFilter) return false;
    if (planFilter && inv.planName !== planFilter) return false;
    return true;
  }), [allInvoices, search, statusFilter, planFilter]);

  // Stats
  const stats = useMemo(() => ({
    total,
    paid:    allInvoices.filter(i => i.status === 'PAID').length,
    pending: allInvoices.filter(i => i.status === 'PENDING').length,
    failed:  allInvoices.filter(i => i.status === 'FAILED').length,
    revenue: allInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (i.amount || 0), 0),
  }), [allInvoices, total]);

  const uniquePlans = [...new Set(allInvoices.map(i => i.planName).filter(Boolean))];
  const hasFilters = !!(search || statusFilter || planFilter);

  const STAT_CARDS = [
    { label: 'Total Invoices',  value: total,                              icon: <ReceiptLongIcon />,    color: theme.palette.primary.main,  bg: alpha(theme.palette.primary.main, 0.08) },
    { label: 'Total Revenue',   value: `₹${stats.revenue.toLocaleString()}`, icon: <TrendingUpIcon />,     color: theme.palette.success.main,  bg: alpha(theme.palette.success.main, 0.08) },
    { label: 'Paid',            value: stats.paid,                         icon: <CheckCircleIcon />,    color: theme.palette.success.main,  bg: alpha(theme.palette.success.main, 0.08) },
    { label: 'Pending / Failed',value: `${stats.pending} / ${stats.failed}`, icon: <HourglassEmptyIcon />, color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.08) },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ReceiptLongIcon />}
        title="Invoices"
        subtitle={`${total} invoice${total !== 1 ? 's' : ''} across the platform`}
        iconColor={theme.palette.warning.main}
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
              onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}
              sx={{ borderRadius: 2 }}>
              Export CSV
            </Button>
            <Button variant="contained" size="small"
              startIcon={generateBatchMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <AutorenewIcon />}
              onClick={() => generateBatchMutation.mutate()}
              disabled={generateBatchMutation.isPending}
              sx={{ borderRadius: 2, bgcolor: 'warning.main', '&:hover': { bgcolor: 'warning.dark' } }}>
              {generateBatchMutation.isPending ? 'Generating...' : 'Generate Monthly'}
            </Button>
          </Stack>
        }
      />

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STAT_CARDS.map((s, i) => (
          <Grid key={s.label} size={{ xs: 6, sm: 3 }}>
            <Card sx={{
              border: `1px solid ${s.bg}`,
              animation: `fadeInUp 0.3s ease ${i * 0.06}s both`,
              '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1 } },
              transition: 'all 0.2s ease', '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.08)', transform: 'translateY(-2px)' },
            }}>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>{s.label}</Typography>
                    <Typography variant="h5" fontWeight={800} sx={{ color: s.color, lineHeight: 1.2 }}>{s.value}</Typography>
                  </Box>
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: s.bg, color: s.color, display: 'flex' }}>{s.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
            <FilterListIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
            <TextField
              size="small" placeholder="Search email, plan, tenant…" value={search}
              onChange={e => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 180 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <TextField size="small" select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 130 }}>
              <MenuItem value="">All Statuses</MenuItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="Plan" value={planFilter} onChange={e => setPlanFilter(e.target.value)} sx={{ minWidth: 130 }}>
              <MenuItem value="">All Plans</MenuItem>
              {uniquePlans.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
            {hasFilters && (
              <Button size="small" onClick={() => { setSearch(''); setStatusFilter(''); setPlanFilter(''); }}
                sx={{ whiteSpace: 'nowrap', color: 'error.main' }}>Clear Filters</Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingPage />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <ReceiptLongIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">{hasFilters ? 'No invoices match your filters' : 'No invoices found'}</Typography>
            {hasFilters && <Button size="small" onClick={() => { setSearch(''); setStatusFilter(''); setPlanFilter(''); }} sx={{ mt: 1 }}>Clear filters</Button>}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Paper elevation={0}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.default' }}>
                    {['Date', 'Invoice #', 'Email', 'Plan', 'Amount', 'Status', 'PDF'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((inv: any, idx: number) => {
                    const sc = STATUS_CONFIG[inv.status] || STATUS_CONFIG.PENDING;
                    return (
                      <TableRow key={inv.id} sx={{
                        '&:hover': { bgcolor: 'background.default' },
                        animation: `fadeInUp 0.25s ease ${idx * 0.02}s both`,
                      }}>
                        <TableCell>
                          <Typography variant="body2">{new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: 'background.default', px: 0.75, py: 0.25, borderRadius: 1, border: '1px solid', borderColor: 'divider', fontSize: 11 }}>
                            {inv.id?.slice(0, 8)?.toUpperCase() || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box>
                            {inv.userName && <Typography variant="body2" fontWeight={600}>{inv.userName}</Typography>}
                            <Typography variant="body2" color={inv.userName ? 'text.secondary' : 'text.primary'} sx={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.userEmail}</Typography>
                            {inv.tenantName && <Typography variant="caption" sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.12), color: 'secondary.main', px: 0.75, py: 0.1, borderRadius: 0.5, fontSize: 10, fontWeight: 600 }}>{inv.tenantName}</Typography>}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={inv.planName} sx={{ fontWeight: 600, fontSize: 11 }} />
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={700} color="success.dark">₹{(inv.amount || 0).toLocaleString()}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            icon={sc.icon as any}
                            label={sc.label}
                            color={sc.color}
                            sx={{ fontWeight: 600, fontSize: 11, '& .MuiChip-icon': { fontSize: 14 } }}
                          />
                        </TableCell>
                        <TableCell>
                          {inv.status === 'PAID' ? (
                            <Tooltip title="View Invoice PDF">
                              <IconButton size="small" onClick={() => openInvoicePdf(inv.id, true)}>
                                <PictureAsPdfIcon fontSize="small" color="error" />
                              </IconButton>
                            </Tooltip>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          </Card>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={size}
            onRowsPerPageChange={e => { setSize(+e.target.value); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]}
            sx={{ mt: 1 }}
          />
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
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
