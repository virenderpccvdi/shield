import { useState } from 'react';
import {
  Box, Typography, Card, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, TextField, InputAdornment, Stack, Grid, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip, Select, MenuItem,
  FormControl, InputLabel, Alert,
} from '@mui/material';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { gradients } from '../../theme/theme';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  source: string;
  status: string;
  notes?: string;
  ipAddress?: string;
  createdAt: string;
  updatedAt: string;
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  closed: number;
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  NEW:       { bg: '#E3F2FD', color: '#1565C0', label: 'New' },
  CONTACTED: { bg: '#FFF3E0', color: '#E65100', label: 'Contacted' },
  QUALIFIED: { bg: '#E8F5E9', color: '#2E7D32', label: 'Qualified' },
  CLOSED:    { bg: '#EEEEEE', color: '#616161', label: 'Closed' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function truncate(str: string | undefined, max: number): string {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  const { data: stats } = useQuery<LeadStats>({
    queryKey: ['lead-stats'],
    queryFn: () => api.get('/admin/contact/leads/stats').then(r => r.data?.data ?? r.data),
  });

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['leads', statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: '0', size: '50' });
      if (statusFilter) params.set('status', statusFilter);
      return api.get(`/admin/contact/leads?${params}`).then(r => {
        return r.data?.data?.content ?? r.data?.content ?? [];
      }).catch(() => []);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; status: string; notes: string }) =>
      api.put(`/admin/contact/leads/${payload.id}`, { status: payload.status, notes: payload.notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      setEditLead(null);
    },
    onError: () => setError('Failed to update lead.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/contact/leads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      setDeleteTarget(null);
    },
    onError: () => setError('Failed to delete lead.'),
  });

  const filtered = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      (l.company ?? '').toLowerCase().includes(q);
  });

  function openEdit(lead: Lead) {
    setEditLead(lead);
    setEditStatus(lead.status);
    setEditNotes(lead.notes ?? '');
  }

  function handleInlineStatus(lead: Lead, newStatus: string) {
    updateMutation.mutate({ id: lead.id, status: newStatus, notes: lead.notes ?? '' });
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ContactMailIcon />}
        title="CRM Leads"
        subtitle="Website contact form submissions"
        iconColor="#7B1FA2"
      />

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Leads"
            value={stats?.total ?? 0}
            icon={<ContactMailIcon />}
            gradient={gradients.purple}
            delay={0}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="New"
            value={stats?.new ?? 0}
            icon={<PersonIcon />}
            gradient={gradients.blue}
            delay={0.05}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Contacted"
            value={stats?.contacted ?? 0}
            icon={<EmailIcon />}
            gradient={gradients.orange}
            delay={0.1}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Qualified"
            value={stats?.qualified ?? 0}
            icon={<CheckCircleIcon />}
            gradient={gradients.green}
            delay={0.15}
          />
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 2.5, borderRadius: 2 }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center" useFlexGap>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              placeholder="Search name, email, company…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ minWidth: 260 }}
            />
          </Stack>
        </Box>
      </Card>

      {/* Table */}
      <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">Loading leads…</Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <ContactMailIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="h6" color="text.secondary" fontWeight={600}>No leads found</Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" component={Paper} elevation={0}>
              <TableHead>
                <TableRow>
                  {['Name / Email', 'Company', 'Message', 'Source', 'Status', 'Date', 'Actions'].map(h => (
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
                {filtered.map((lead, idx) => {
                  const cfg = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.NEW;
                  return (
                    <TableRow
                      key={lead.id}
                      hover
                      sx={{
                        '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
                        animation: `fadeIn 0.2s ease ${(idx % 25) * 0.02}s both`,
                      }}
                    >
                      {/* Name / Email */}
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} fontSize={13}>
                          {lead.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                          <EmailIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.secondary" fontSize={11}>
                            {lead.email}
                          </Typography>
                        </Box>
                        {lead.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.secondary" fontSize={11}>
                              {lead.phone}
                            </Typography>
                          </Box>
                        )}
                      </TableCell>

                      {/* Company */}
                      <TableCell>
                        {lead.company ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <BusinessIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                            <Typography variant="body2" fontSize={12}>{lead.company}</Typography>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )}
                      </TableCell>

                      {/* Message */}
                      <TableCell sx={{ maxWidth: 220 }}>
                        {lead.message ? (
                          <Tooltip title={lead.message}>
                            <Typography variant="caption" color="text.secondary" fontSize={11}>
                              {truncate(lead.message, 60)}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )}
                      </TableCell>

                      {/* Source */}
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace" fontSize={11}>
                          {lead.source || '—'}
                        </Typography>
                      </TableCell>

                      {/* Status */}
                      <TableCell sx={{ minWidth: 140 }}>
                        <Select
                          size="small"
                          value={lead.status}
                          onChange={e => handleInlineStatus(lead, e.target.value)}
                          renderValue={v => {
                            const c = STATUS_CONFIG[v] ?? STATUS_CONFIG.NEW;
                            return (
                              <Chip
                                size="small"
                                label={c.label}
                                sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: 11, height: 22, cursor: 'pointer' }}
                              />
                            );
                          }}
                          sx={{
                            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                            '& .MuiSelect-select': { py: 0.25, px: 0.5 },
                          }}
                        >
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <MenuItem key={k} value={k}>
                              <Chip size="small" label={v.label} sx={{ bgcolor: v.bg, color: v.color, fontWeight: 700, fontSize: 11, height: 22 }} />
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>

                      {/* Date */}
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" fontSize={11} whiteSpace="nowrap">
                          {formatDate(lead.createdAt)}
                        </Typography>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Edit / Notes">
                            <IconButton size="small" onClick={() => openEdit(lead)}
                              sx={{ color: '#1565C0', '&:hover': { bgcolor: '#E3F2FD' } }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => setDeleteTarget(lead)}
                              sx={{ color: '#C62828', '&:hover': { bgcolor: '#FFEBEE' } }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editLead} onClose={() => setEditLead(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Lead</DialogTitle>
        <DialogContent dividers>
          {editLead && (
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Name</Typography>
                  <Typography variant="body2">{editLead.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Email</Typography>
                  <Typography variant="body2">{editLead.email}</Typography>
                </Box>
                {editLead.phone && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Phone</Typography>
                    <Typography variant="body2">{editLead.phone}</Typography>
                  </Box>
                )}
                {editLead.company && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Company</Typography>
                    <Typography variant="body2">{editLead.company}</Typography>
                  </Box>
                )}
              </Box>
              {editLead.message && (
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Message</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, fontSize: 13 }}>
                    {editLead.message}
                  </Typography>
                </Box>
              )}
              <FormControl size="small" fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={editStatus} label="Status" onChange={e => setEditStatus(e.target.value)}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <MenuItem key={k} value={k}>{v.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Notes"
                multiline
                rows={3}
                size="small"
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Add internal notes about this lead…"
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Source</Typography>
                  <Typography variant="body2">{editLead.source || '—'}</Typography>
                </Box>
                {editLead.ipAddress && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>IP Address</Typography>
                    <Typography variant="body2" fontFamily="monospace">{editLead.ipAddress}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Received</Typography>
                  <Typography variant="body2">{formatDate(editLead.createdAt)}</Typography>
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditLead(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => editLead && updateMutation.mutate({ id: editLead.id, status: editStatus, notes: editNotes })}
            disabled={updateMutation.isPending}
            sx={{ background: gradients.purple }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Lead</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the lead from <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email})?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </AnimatedPage>
  );
}
