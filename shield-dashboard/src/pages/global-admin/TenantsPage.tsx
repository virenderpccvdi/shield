import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, TablePagination, Chip, TextField, InputAdornment, CircularProgress, Button,
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
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
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

// Plan badge styles using palette-aligned values
const PLAN_STYLES: Record<string, { bgKey: 'primary' | 'success' | 'secondary'; label: string }> = {
  STARTER: { bgKey: 'primary', label: 'STARTER' },
  GROWTH: { bgKey: 'success', label: 'GROWTH' },
  ENTERPRISE: { bgKey: 'secondary', label: 'ENTERPRISE' },
};

export default function TenantsPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [open, setOpen] = useState(false);

  useEffect(() => { setPage(0); }, [search]);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState<TenantForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [snack, setSnack] = useState('');
  const [formError, setFormError] = useState('');
  const [addIspOpen, setAddIspOpen] = useState(false);

  const { data: tenantsData, isLoading } = useQuery({
    queryKey: ['tenants', page, rowsPerPage],
    queryFn: () => api.get(`/tenants?page=${page}&size=${rowsPerPage}`)
      .then(r => {
        const d = r.data?.data ?? r.data;
        return { tenants: (d?.content ?? d ?? EMPTY_TENANTS) as Tenant[], total: d?.totalElements ?? 0 };
      })
      .catch(() => ({ tenants: EMPTY_TENANTS, total: 0 })),
  });
  const data = tenantsData?.tenants ?? EMPTY_TENANTS;
  const totalElements = tenantsData?.total ?? 0;

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

  const tenants = data.filter(t =>
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
        subtitle={`${totalElements} tenants registered`}
        action={
          <Stack direction="row" spacing={2}>
            <TextField size="small" placeholder="Search tenants..." value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} sx={{ width: 240 }} />
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddIspOpen(true)} sx={{ bgcolor: 'primary.main', whiteSpace: 'nowrap' }}>Add ISP</Button>
          </Stack>
        }
      />

      {/* Summary chips */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Chip
          label={`STARTER: ${data.filter(t => t.plan === 'STARTER').length}`}
          sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main', fontWeight: 600, border: 'none' }}
        />
        <Chip
          label={`GROWTH: ${data.filter(t => t.plan === 'GROWTH').length}`}
          sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.dark', fontWeight: 600, border: 'none' }}
        />
        <Chip
          label={`ENTERPRISE: ${data.filter(t => t.plan === 'ENTERPRISE').length}`}
          sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.12), color: 'secondary.main', fontWeight: 600, border: 'none' }}
        />
        <Chip label={`SUSPENDED: ${data.filter(t => t.status === 'SUSPENDED').length}`}
          sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main', fontWeight: 600, border: 'none' }} />
      </Stack>

      {/* Table */}
      {isLoading ? (
        <Card><Paper sx={{ p: 0 }}><SkeletonTable rows={5} columns={7} /></Paper></Card>
      ) : tenants.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BusinessIcon sx={{ fontSize: 36, color: 'primary.main' }} />}
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
                <TableRow sx={{ bgcolor: 'background.default' }}>
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
                        const planColorMap: Record<string, { bg: string; color: string }> = {
                          STARTER: { bg: alpha(theme.palette.primary.main, 0.12), color: theme.palette.primary.main },
                          GROWTH: { bg: alpha(theme.palette.success.main, 0.12), color: theme.palette.success.dark },
                          ENTERPRISE: { bg: alpha(theme.palette.secondary.main, 0.12), color: theme.palette.secondary.main },
                        };
                        const g = planColorMap[t.plan];
                        return g
                          ? <Chip size="small" label={t.plan} sx={{ bgcolor: g.bg, color: g.color, fontWeight: 600, border: 'none' }} />
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
                        sx={{ height: 22, fontSize: 11, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
                    </TableCell>
                    <TableCell><Chip size="small" label={t.status} color={t.status === 'ACTIVE' ? 'success' : 'error'} /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit">
                          <IconButton size="small" aria-label={`Edit ${t.name}`} onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                            sx={{ color: 'primary.main', transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.15)' } }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t.status === 'SUSPENDED' ? 'Activate ISP' : 'Suspend ISP'}>
                          <IconButton size="small"
                            onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: t.id, body: { ...t, active: t.status === 'SUSPENDED', maxCustomers: t.maxCustomers, maxProfilesPerCustomer: t.maxProfilesPerCustomer } as any }); }}
                            sx={{ color: t.status === 'SUSPENDED' ? 'success.main' : 'warning.main', transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.15)' } }}>
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
            <TablePagination
              component="div"
              count={totalElements}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]}
            />
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
                    sx={{ '& .MuiSwitch-thumb': { bgcolor: form.active ? 'success.main' : 'error.main' } }} />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {form.active
                        ? <><CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} /><Typography variant="body2" fontWeight={600} color="success.main">Active — ISP can operate normally</Typography></>
                        : <><BlockIcon sx={{ fontSize: 16, color: 'error.main' }} /><Typography variant="body2" fontWeight={600} color="error.main">Suspended — ISP access disabled</Typography></>}
                    </Box>
                  }
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ bgcolor: 'primary.main', minWidth: 100 }}>
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
