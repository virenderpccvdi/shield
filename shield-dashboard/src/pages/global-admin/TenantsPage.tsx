import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, Chip, TextField, InputAdornment, CircularProgress, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  MenuItem, IconButton, Tooltip, Alert, Snackbar, Stack, FormControlLabel, Switch,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BusinessIcon from '@mui/icons-material/Business';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import SkeletonTable from '../../components/SkeletonTable';
import EmptyState from '../../components/EmptyState';
import CreateTenantDialog from '../../components/CreateTenantDialog';

interface Tenant {
  id: string; name: string; slug: string; contactEmail: string;
  contactPhone?: string; plan: string; maxCustomers: number;
  maxProfilesPerCustomer: number; status: 'ACTIVE' | 'SUSPENDED';
  customers?: number; createdAt: string;
  subscriptionEndsAt?: string; trialEndsAt?: string;
  features?: Record<string, boolean>;
}
interface TenantForm {
  name: string; slug: string; contactEmail: string; contactPhone: string;
  plan: string; maxCustomers: number; maxProfilesPerCustomer: number; active: boolean;
}

const EMPTY_FORM: TenantForm = {
  name: '', slug: '', contactEmail: '', contactPhone: '',
  plan: 'STARTER', maxCustomers: 100, maxProfilesPerCustomer: 5, active: true,
};
const EMPTY_TENANTS: Tenant[] = [];

const PLAN_GRADIENT: Record<string, { bg: string; color: string }> = {
  STARTER: { bg: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)', color: '#1565C0' },
  GROWTH: { bg: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)', color: '#2E7D32' },
  ENTERPRISE: { bg: 'linear-gradient(135deg, #F3E5F5, #E1BEE7)', color: '#7B1FA2' },
};

export default function TenantsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState<TenantForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [snack, setSnack] = useState('');
  const [formError, setFormError] = useState('');
  const [addIspOpen, setAddIspOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.get('/tenants').then(r => (r.data.data?.content ?? r.data.data) as Tenant[]).catch(() => EMPTY_TENANTS),
  });

  const createMutation = useMutation({
    mutationFn: (body: TenantForm) => api.post('/tenants', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); setSnack('ISP tenant created'); handleClose(); },
    onError: (e: { response?: { data?: { message?: string } } }) => setFormError(e.response?.data?.message || 'Failed to create tenant'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TenantForm }) => api.put(`/tenants/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); setSnack('ISP tenant updated'); handleClose(); },
    onError: (e: { response?: { data?: { message?: string } } }) => setFormError(e.response?.data?.message || 'Failed to update tenant'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tenants/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); setSnack('ISP tenant deleted'); setDeleteTarget(null); },
  });

  const tenants = (data || EMPTY_TENANTS).filter(t =>
    `${t.name} ${t.slug} ${t.contactEmail}`.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setFormError(''); setOpen(true); }
  function openEdit(t: Tenant) {
    setEditing(t);
    setForm({ name: t.name, slug: t.slug, contactEmail: t.contactEmail, contactPhone: t.contactPhone || '', plan: t.plan, maxCustomers: t.maxCustomers, maxProfilesPerCustomer: t.maxProfilesPerCustomer, active: t.status !== 'SUSPENDED' });
    setFormError(''); setOpen(true);
  }
  function handleClose() { setOpen(false); setEditing(null); }
  function handleSave() {
    if (!form.name.trim() || !form.slug.trim() || !form.contactEmail.trim()) { setFormError('Name, slug and email are required'); return; }
    if (editing) updateMutation.mutate({ id: editing.id, body: form });
    else createMutation.mutate(form);
  }
  function autoSlug(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<BusinessIcon />}
        title="ISP Tenants"
        subtitle={`${(data || EMPTY_TENANTS).length} tenants registered`}
        action={
          <Stack direction="row" spacing={2}>
            <TextField size="small" placeholder="Search tenants..." value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} sx={{ width: 240 }} />
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddIspOpen(true)} sx={{ bgcolor: '#1565C0', whiteSpace: 'nowrap' }}>Add ISP</Button>
          </Stack>
        }
      />

      {/* Summary chips */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        {(['STARTER', 'GROWTH', 'ENTERPRISE'] as const).map(plan => {
          const g = PLAN_GRADIENT[plan];
          return (
            <Chip key={plan}
              label={`${plan}: ${(data || EMPTY_TENANTS).filter(t => t.plan === plan).length}`}
              sx={{ background: g.bg, color: g.color, fontWeight: 600, border: 'none' }}
            />
          );
        })}
        <Chip label={`SUSPENDED: ${(data || EMPTY_TENANTS).filter(t => t.status === 'SUSPENDED').length}`}
          sx={{ background: 'linear-gradient(135deg, #FFEBEE, #FFCDD2)', color: '#C62828', fontWeight: 600, border: 'none' }} />
      </Stack>

      {/* Table */}
      {isLoading ? (
        <Card><Paper sx={{ p: 0 }}><SkeletonTable rows={5} columns={7} /></Paper></Card>
      ) : tenants.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BusinessIcon sx={{ fontSize: 36, color: '#1565C0' }} />}
            title="No tenants found"
            description={search ? 'Try adjusting your search query' : 'Get started by adding your first ISP tenant'}
            action={search ? undefined : { label: 'Add ISP', onClick: () => setAddIspOpen(true) }}
          />
        </Card>
      ) : (
        <Card>
          <Paper>
            <Table aria-label="ISP Tenants list">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  {['ISP Name', 'Slug', 'Contact Email', 'Plan', 'Max Customers', 'Sub Ends', 'Features', 'Status', 'Actions'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tenants.map((t, idx) => (
                  <TableRow key={t.id} hover onClick={() => navigate(`/admin/tenants/${t.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/admin/tenants/${t.id}`); }}
                    tabIndex={0} role="link" aria-label={`View tenant ${t.name}`} sx={{
                    cursor: 'pointer',
                    '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                    animation: `fadeInUp 0.3s ease ${idx * 0.05}s both`,
                  }}>
                    <TableCell>
                      <Typography fontWeight={600}>{t.name}</Typography>
                      {t.customers !== undefined && <Typography variant="caption" color="text.secondary">{t.customers.toLocaleString()} customers</Typography>}
                    </TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{t.slug}</Typography></TableCell>
                    <TableCell>{t.contactEmail}</TableCell>
                    <TableCell>
                      {(() => {
                        const g = PLAN_GRADIENT[t.plan];
                        return g
                          ? <Chip size="small" label={t.plan} sx={{ background: g.bg, color: g.color, fontWeight: 600, border: 'none' }} />
                          : <Chip size="small" label={t.plan} />;
                      })()}
                    </TableCell>
                    <TableCell>{t.maxCustomers.toLocaleString()}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {t.subscriptionEndsAt ? new Date(t.subscriptionEndsAt).toLocaleDateString() : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={`${t.features ? Object.values(t.features).filter(Boolean).length : 0} on`}
                        sx={{ height: 22, fontSize: 11, bgcolor: '#E3F2FD', color: '#1565C0' }} />
                    </TableCell>
                    <TableCell><Chip size="small" label={t.status} color={t.status === 'ACTIVE' ? 'success' : 'error'} /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit">
                          <IconButton size="small" aria-label={`Edit ${t.name}`} onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                            sx={{ color: '#1565C0', transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.15)' } }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t.status === 'SUSPENDED' ? 'Activate ISP' : 'Suspend ISP'}>
                          <IconButton size="small"
                            onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: t.id, body: { ...t, active: t.status === 'SUSPENDED', maxCustomers: t.maxCustomers, maxProfilesPerCustomer: t.maxProfilesPerCustomer } as any }); }}
                            sx={{ color: t.status === 'SUSPENDED' ? '#2E7D32' : '#F57F17', transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.15)' } }}>
                            {t.status === 'SUSPENDED' ? <CheckCircleIcon fontSize="small" /> : <BlockIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" aria-label={`Delete ${t.name}`} onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                            sx={{ color: 'error.main', transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.15)' } }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Card>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editing ? 'Edit ISP Tenant' : 'Add New ISP Tenant'}</DialogTitle>
        <DialogContent dividers>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField fullWidth label="ISP Name *" value={form.name} onChange={e => {
                const name = e.target.value;
                setForm(f => ({ ...f, name, slug: editing ? f.slug : autoSlug(name) }));
              }} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label="Slug * (lowercase, hyphens only)" value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                helperText="e.g. vodafone-ie — used in DNS and URLs" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Contact Email *" type="email" value={form.contactEmail}
                onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Contact Phone" value={form.contactPhone}
                onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth select label="Plan *" value={form.plan}
                onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                {['STARTER', 'GROWTH', 'ENTERPRISE'].map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Max Customers" type="number" value={form.maxCustomers}
                onChange={e => setForm(f => ({ ...f, maxCustomers: Number(e.target.value) }))}
                inputProps={{ min: 1, max: 100000 }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Max Profiles/Customer" type="number" value={form.maxProfilesPerCustomer}
                onChange={e => setForm(f => ({ ...f, maxProfilesPerCustomer: Number(e.target.value) }))}
                inputProps={{ min: 1, max: 20 }} />
            </Grid>
            {editing && (
              <Grid size={12}>
                <FormControlLabel
                  control={<Switch checked={form.active} onChange={(_, c) => setForm(f => ({ ...f, active: c }))}
                    sx={{ '& .MuiSwitch-thumb': { bgcolor: form.active ? '#2E7D32' : '#C62828' } }} />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {form.active
                        ? <><CheckCircleIcon sx={{ fontSize: 16, color: '#2E7D32' }} /><Typography variant="body2" fontWeight={600} color="#2E7D32">Active — ISP can operate normally</Typography></>
                        : <><BlockIcon sx={{ fontSize: 16, color: '#C62828' }} /><Typography variant="body2" fontWeight={600} color="#C62828">Suspended — ISP access disabled</Typography></>}
                    </Box>
                  }
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ bgcolor: '#1565C0', minWidth: 100 }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : editing ? 'Save Changes' : 'Create ISP'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Delete ISP Tenant</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add ISP + Admin Dialog */}
      <CreateTenantDialog
        open={addIspOpen}
        onClose={() => setAddIspOpen(false)}
        onSuccess={(msg) => {
          setAddIspOpen(false);
          qc.invalidateQueries({ queryKey: ['tenants'] });
          setSnack(msg);
        }}
      />

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}
