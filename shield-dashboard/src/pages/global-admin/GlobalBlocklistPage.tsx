import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Switch, FormControlLabel, CircularProgress,
  IconButton, Tooltip, Snackbar, Alert, Stack, TablePagination,
  InputAdornment,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newEmergency, setNewEmergency] = useState(false);
  const [domainError, setDomainError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p = page, s = size) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/blocklist/global?page=${p}&size=${s}`);
      const bl = res.data?.data ?? res.data;
      setDomains(bl?.content ?? (Array.isArray(bl) ? bl : []));
      setTotal(bl?.totalElements ?? (Array.isArray(bl) ? bl.length : 0));
    } catch {
      setError('Failed to load global blocklist. Check that the admin service is running.');
    } finally {
      setLoading(false);
    }
  }, [page, size]);

  useEffect(() => { load(page, size); }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = search.trim()
    ? domains.filter(d =>
        d.domain.toLowerCase().includes(search.toLowerCase()) ||
        (d.reason ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : domains;

  const handleAdd = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) { setDomainError('Domain is required'); return; }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { setDomainError('Enter a valid domain (e.g. example.com)'); return; }

    setSaving(true);
    try {
      if (newEmergency) {
        await api.post('/admin/blocklist/emergency', { domain, reason: newReason });
      } else {
        await api.post('/admin/blocklist/global', { domains: [domain], reason: newReason });
      }
      setSnack(`${domain} added to global blocklist`);
      setAddOpen(false);
      setNewDomain(''); setNewReason(''); setNewEmergency(false); setDomainError('');
      load(0, size);
      setPage(0);
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
      setTotal(prev => Math.max(0, prev - 1));
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
        subtitle={`Platform-wide blocked domains applied to all tenants${total > 0 ? ` — ${total} domain${total !== 1 ? 's' : ''}` : ''}`}
        iconColor="#C62828"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
            sx={{ bgcolor: '#C62828', '&:hover': { bgcolor: '#B71C1C' }, borderRadius: 2 }}>
            Add Domain
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {/* Search bar */}
      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search domains or reasons..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ minWidth: 320 }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment>,
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')}><ClearIcon fontSize="small" /></IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
        {search && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} matching "{search}"
          </Typography>
        )}
      </Box>

      <Card>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<BlockIcon sx={{ fontSize: 36, color: '#C62828' }} />}
            title={search ? `No domains matching "${search}"` : 'No global blocked domains'}
            description={search ? 'Try a different search term' : 'Add domains that should be blocked across the entire platform for all tenants and users.'}
          />
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#FFF8F8' }}>
                    {['Domain', 'Reason', 'Type', 'Added', ''].map((h, i) => (
                      <TableCell key={i} sx={{
                        fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                        letterSpacing: 0.8, color: 'text.secondary',
                        ...(h === '' ? { width: 48 } : {}),
                      }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((row, idx) => (
                    <TableRow key={row.id} hover sx={{
                      '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                      animation: `fadeInUp 0.25s ease ${idx * 0.03}s both`,
                    }}>
                      <TableCell>
                        <Chip
                          label={row.domain}
                          size="small"
                          sx={{
                            fontFamily: 'monospace', fontWeight: 600, fontSize: 12.5,
                            bgcolor: '#FFF3E0', color: '#E65100', borderRadius: '6px',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 240 }}>
                          {row.reason || <Typography component="span" variant="body2" color="text.disabled" fontStyle="italic">No reason</Typography>}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {row.emergency ? (
                          <Chip
                            icon={<WarningAmberIcon />}
                            label="Emergency"
                            color="error"
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                        ) : (
                          <Chip label="Standard" size="small" variant="outlined" sx={{ fontWeight: 600, color: 'text.secondary' }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={`Remove ${row.domain}`}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(row.id, row.domain)}
                            sx={{ transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.15)' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {!search && total > size && (
              <TablePagination
                component="div"
                count={total}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={size}
                onRowsPerPageChange={e => { setSize(+e.target.value); setPage(0); }}
                rowsPerPageOptions={[25, 50, 100]}
              />
            )}
          </>
        )}
      </Card>

      {/* Add dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setDomainError(''); }} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Add to Global Blocklist</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Domain *"
              placeholder="e.g. malicious.com"
              value={newDomain}
              onChange={e => { setNewDomain(e.target.value); setDomainError(''); }}
              error={!!domainError}
              helperText={domainError || 'Root domain without http://'}
              autoFocus
            />
            <TextField
              fullWidth
              label="Reason (optional)"
              placeholder="e.g. Malware distribution, phishing"
              value={newReason}
              onChange={e => setNewReason(e.target.value)}
            />
            <FormControlLabel
              control={<Switch checked={newEmergency} onChange={e => setNewEmergency(e.target.checked)} color="error" />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Emergency Block</Typography>
                  <Typography variant="caption" color="text.secondary">Blocks immediately across all active sessions</Typography>
                </Box>
              }
            />
            {newEmergency && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                Emergency blocks are propagated in real-time and cannot be undone quickly.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setAddOpen(false); setDomainError(''); setNewDomain(''); setNewReason(''); setNewEmergency(false); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={saving}
            sx={{ bgcolor: newEmergency ? '#C62828' : 'primary.main', '&:hover': { bgcolor: newEmergency ? '#B71C1C' : 'primary.dark' } }}
          >
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Add Domain'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack('')}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </AnimatedPage>
  );
}
