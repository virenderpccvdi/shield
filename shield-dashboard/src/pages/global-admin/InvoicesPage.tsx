import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody,
  TablePagination, Button, IconButton, Tooltip, Paper,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useQuery } from '@tanstack/react-query';
import { getAllInvoices, openInvoicePdf } from '../../api/billing';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

const statusColors: Record<string, { color: 'success' | 'error' | 'warning' | 'default'; label: string }> = {
  PAID: { color: 'success', label: 'Paid' },
  PENDING: { color: 'warning', label: 'Pending' },
  FAILED: { color: 'error', label: 'Failed' },
  REFUNDED: { color: 'default', label: 'Refunded' },
};

function exportCSV(invoices: any[]) {
  const headers = ['Date', 'Email', 'Plan', 'Amount', 'Currency', 'Status', 'Stripe Invoice'];
  const rows = invoices.map((inv: any) => [
    inv.createdAt, inv.userEmail, inv.planName, inv.amount, inv.currency, inv.status, inv.stripeInvoiceId || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}

export default function InvoicesPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-invoices', page, size],
    queryFn: () => getAllInvoices(page, size),
  });

  const invoices = data?.content || [];
  const total = data?.totalElements || 0;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ReceiptLongIcon />}
        title="Invoices"
        subtitle={`${total} invoice${total !== 1 ? 's' : ''} across the platform`}
        iconColor="#F57F17"
        action={
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
            onClick={() => exportCSV(invoices)} disabled={invoices.length === 0}
            sx={{ borderRadius: 2 }}>Export CSV</Button>
        }
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <ReceiptLongIcon sx={{ fontSize: 48, color: '#BDBDBD', mb: 1 }} />
            <Typography color="text.secondary">No invoices found</Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Paper elevation={0}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    {['Date', 'Email', 'Plan', 'Amount', 'Status', 'PDF'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, color: '#64748B', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((inv: any) => {
                    const sc = statusColors[inv.status] || statusColors.PENDING;
                    return (
                      <TableRow key={inv.id} sx={{ '&:hover': { bgcolor: '#F5F9FF' } }}>
                        <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{inv.userEmail}</TableCell>
                        <TableCell><Chip size="small" label={inv.planName} sx={{ fontWeight: 600 }} /></TableCell>
                        <TableCell><Typography fontWeight={600}>₹{inv.amount}</Typography></TableCell>
                        <TableCell><Chip size="small" label={sc.label} color={sc.color} sx={{ fontWeight: 600 }} /></TableCell>
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
          {total > size && (
            <TablePagination component="div" count={total} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={size}
              onRowsPerPageChange={e => { setSize(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[10, 20, 50]} sx={{ mt: 2 }} />
          )}
        </>
      )}
    </AnimatedPage>
  );
}
