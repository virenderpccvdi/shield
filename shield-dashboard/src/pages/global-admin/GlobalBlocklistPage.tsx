import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Switch, FormControlLabel, CircularProgress,
  IconButton, Tooltip, Snackbar, Alert, Stack,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface BlockedDomain {
  id: string;
  domain: string;
  reason?: string;
  emergency: boolean;
  createdAt?: string;
}

export default function GlobalBlocklistPage() {
  const [domains, setDomains] = useState<BlockedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newEmergency, setNewEmergency] = useState(false);
  const [domainError, setDomainError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/blocklist/global');
      setDomains(res.data.data ?? res.data ?? []);
    } catch {
      setError('Failed to load global blocklist. Check that the admin service is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) { setDomainError('Domain is required'); return; }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { setDomainError('Enter a valid domain (e.g. example.com)'); return; }

    setSaving(true);
    try {
      if (newEmergency) {
        await api.post('/admin/blocklist/emergency', { domain, reason: newReason });
      } else {
        await api.post('/admin/blocklist/global', { domain, reason: newReason, emergency: false });
      }
      setSnack(`${domain} added to global blocklist`);
      setAddOpen(false);
      setNewDomain(''); setNewReason(''); setNewEmergency(false); setDomainError('');
      load();
    } catch {
      setSnack('Failed to add domain');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, domain: string) => {
    try {
      await api.delete(`/admin/blocklist/global/${id}`);
      setDomains(prev => prev.filter(d => d.id !== id));
      setSnack(`${domain} removed from blocklist`);
    } catch {
      setSnack('Failed to remove domain');
    }
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<BlockIcon />}
        title="Global Blocklist"
        subtitle="Platform-wide blocked domains applied to all tenants"
        iconColor="#C62828"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
            sx={{ bgcolor: '#C62828', '&:hover': { bgcolor: '#B71C1C' } }}>
            Add Domain
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : domains.length === 0 ? (
          <EmptyState
            icon={<BlockIcon sx={{ fontSize: 36, color: '#C62828' }} />}
            title="No global blocked domains"
            description="Add domains that should be blocked across the entire platform"
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#FFF8F8' }}>
                  {['Domain', 'Reason', 'Type', 'Added', 'Remove'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {domains.map((row, idx) => (
                  <TableRow key={row.id} hover sx={{
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
                      {row.emergency ? (
                        <Chip icon={<WarningAmberIcon />} label="Emergency" color="error" size="small" sx={{ fontWeight: 700 }} />
                      ) : (
                        <Chip label="Standard" size="small" sx={{ fontWeight: 600 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Remove">
                        <IconButton size="small" color="error" onClick={() => handleDelete(row.id, row.domain)}
                          sx={{ transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.15)' } }}>
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
        <DialogTitle fontWeight={700}>Add to Global Blocklist</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField fullWidth label="Domain *" placeholder="e.g. malicious.com" value={newDomain}
              onChange={e => { setNewDomain(e.target.value); setDomainError(''); }}
              error={!!domainError} helperText={domainError || 'Root domain without http://'} />
            <TextField fullWidth label="Reason (optional)" placeholder="e.g. Malware distribution" value={newReason}
              onChange={e => setNewReason(e.target.value)} />
            <FormControlLabel
              control={<Switch checked={newEmergency} onChange={e => setNewEmergency(e.target.checked)} color="error" />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Emergency Block</Typography>
                  <Typography variant="caption" color="text.secondary">Blocks immediately across all active sessions</Typography>
                </Box>
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setAddOpen(false); setDomainError(''); }}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={saving}
            sx={{ bgcolor: '#C62828', '&:hover': { bgcolor: '#B71C1C' } }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Add Domain'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}
