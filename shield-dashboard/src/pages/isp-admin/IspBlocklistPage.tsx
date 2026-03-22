import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, CircularProgress, IconButton, Tooltip,
  Snackbar, Alert, Stack,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface BlockedDomain {
  id?: string;
  domain: string;
  reason?: string;
}

export default function IspBlocklistPage() {
  const [domains, setDomains] = useState<BlockedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newReason, setNewReason] = useState('');
  const [domainError, setDomainError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/tenants/blocklist');
      const data = res.data.data ?? res.data ?? [];
      setDomains(Array.isArray(data) ? data : data.domains?.map((d: string) => ({ domain: d })) ?? []);
    } catch {
      setError('Failed to load tenant blocklist.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) { setDomainError('Domain is required'); return; }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { setDomainError('Enter a valid domain'); return; }

    setSaving(true);
    try {
      await api.post('/tenants/blocklist', { domain, reason: newReason });
      setSnack(`${domain} added to blocklist`);
      setAddOpen(false);
      setNewDomain(''); setNewReason(''); setDomainError('');
      load();
    } catch {
      setSnack('Failed to add domain');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: BlockedDomain) => {
    try {
      if (item.id) {
        await api.delete(`/tenants/blocklist/${item.id}`);
      } else {
        await api.delete(`/tenants/blocklist`, { data: { domain: item.domain } });
      }
      setDomains(prev => prev.filter(d => d.domain !== item.domain));
      setSnack(`${item.domain} removed`);
    } catch {
      setSnack('Failed to remove domain');
    }
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<BlockIcon />}
        title="Tenant Blocklist"
        subtitle="Custom blocked domains for your ISP tenant"
        iconColor="#00695C"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
            sx={{ bgcolor: '#004D40', '&:hover': { bgcolor: '#00695C' } }}>
            Add Domain
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      <Card>
        {loading ? (
          <LoadingPage />
        ) : domains.length === 0 ? (
          <EmptyState
            icon={<BlockIcon sx={{ fontSize: 36, color: '#00695C' }} />}
            title="No tenant blocked domains"
            description="Add domains to block for all customers in your tenant"
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F0FAF8' }}>
                  {['Domain', 'Reason', 'Remove'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {domains.map((row, idx) => (
                  <TableRow key={row.domain} hover sx={{
                    '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                    animation: `fadeInUp 0.3s ease ${idx * 0.04}s both`,
                  }}>
                    <TableCell>
                      <Typography fontWeight={600} sx={{ fontFamily: 'monospace' }}>{row.domain}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{row.reason || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Remove">
                        <IconButton size="small" onClick={() => handleDelete(row)}
                          sx={{ color: '#00695C', transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.15)' } }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setDomainError(''); }} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Add to Tenant Blocklist</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField fullWidth label="Domain *" placeholder="e.g. gambling.com" value={newDomain}
              onChange={e => { setNewDomain(e.target.value); setDomainError(''); }}
              error={!!domainError} helperText={domainError || 'Root domain without http://'} />
            <TextField fullWidth label="Reason (optional)" placeholder="e.g. Not appropriate for children" value={newReason}
              onChange={e => setNewReason(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setAddOpen(false); setDomainError(''); }}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={saving}
            sx={{ bgcolor: '#004D40', '&:hover': { bgcolor: '#00695C' } }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Add Domain'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}
