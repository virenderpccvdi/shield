import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, TablePagination, Chip, TextField, InputAdornment, CircularProgress, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  MenuItem, Alert, Snackbar, Stack, Avatar, IconButton, Tooltip,
  Switch, FormControlLabel, Select, FormControl, InputLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import DownloadIcon from '@mui/icons-material/Download';
import BusinessIcon from '@mui/icons-material/Business';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import SkeletonTable from '../../components/SkeletonTable';
import EmptyState from '../../components/EmptyState';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';

interface User {
  id: string; name: string; email: string; phone?: string;
  role: string; tenantId?: string; active: boolean; createdAt: string;
}
interface UserForm {
  name: string; email: string; password: string; phone: string;
  role: string; tenantId: string;
}
interface EditForm {
  name: string; phone: string; role: string; active: boolean; tenantId: string;
}
interface Tenant { id: string; name: string; slug: string; }

const EMPTY_FORM: UserForm = { name: '', email: '', password: '', phone: '', role: 'ISP_ADMIN', tenantId: '' };
const ROLE_COLOR: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
  GLOBAL_ADMIN: 'error', ISP_ADMIN: 'warning', CUSTOMER: 'success',
};
// Palette-aligned avatar colors (primary, success, warning, error, secondary, teal)
const AVATAR_COLORS = ['#1565C0', '#43A047', '#FB8C00', '#E53935', '#7B1FA2', '#00897B'];

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function exportCSV(users: User[]) {
  const headers = ['Name', 'Email', 'Role', 'Status', 'Phone', 'Created'];
  const rows = users.map(u => [u.name, u.email, u.role, u.active ? 'ACTIVE' : 'DISABLED', u.phone || '', u.createdAt || '']);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function UsersPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [snack, setSnack] = useState('');
  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', phone: '', role: '', active: true, tenantId: '' });
  const [editError, setEditError] = useState('');
  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  // Reset page when search or filter changes
  useEffect(() => { setPage(0); }, [search, tenantFilter]);

  const { data: usersData, isLoading } = useQuery<{ users: User[]; total: number }>({
    queryKey: ['admin-users', page, rowsPerPage],
    queryFn: () =>
      api.get(`/auth/users?page=${page}&size=${rowsPerPage}`)
        .then(r => {
          const d = r.data.data;
          return { users: (d?.content ?? d ?? []) as User[], total: d?.totalElements ?? 0 };
        })
        .catch(() => ({ users: [], total: 0 })),
  });
  const users = usersData?.users ?? [];
  const totalElements = usersData?.total ?? 0;

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['tenants-simple'],
    queryFn: () =>
      api.get('/tenants?size=100')
        .then(r => (r.data.data?.content ?? r.data.data) as Tenant[])
        .catch(() => []),
  });

  const createMutation = useMutation({
    mutationFn: (body: UserForm) => api.post('/auth/admin/register', {
      name: body.name, email: body.email, password: body.password,
      phone: body.phone || undefined, role: body.role, tenantId: body.tenantId || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setSnack('User created successfully'); setOpen(false); setForm(EMPTY_FORM);
    },
    onError: (e: any) => setFormError(e.response?.data?.message || 'Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditForm }) =>
      api.put(`/auth/admin/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setSnack('User updated successfully'); setEditOpen(false);
    },
    onError: (e: any) => setEditError(e.response?.data?.message || 'Failed to update user'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/admin/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setSnack('User deleted'); setDeleteOpen(false);
    },
  });

  const filtered = users.filter(u => {
    const matchSearch = `${u.name} ${u.email} ${u.role} ${tenants.find(t => t.id === u.tenantId)?.name ?? ''}`.toLowerCase().includes(search.toLowerCase());
    const matchTenant = !tenantFilter || u.tenantId === tenantFilter || (tenantFilter === '__none__' && !u.tenantId);
    return matchSearch && matchTenant;
  });

  function handleSave() {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError('Name, email and password are required'); return;
    }
    if (form.password.length < 8) { setFormError('Password must be at least 8 characters'); return; }
    if (form.role === 'ISP_ADMIN' && !form.tenantId) { setFormError('ISP Admin requires a tenant'); return; }
    setFormError(''); createMutation.mutate(form);
  }

  function openEdit(u: User, e: React.MouseEvent) {
    e.stopPropagation();
    setEditUser(u);
    setEditForm({ name: u.name, phone: u.phone || '', role: u.role, active: u.active, tenantId: u.tenantId || '' });
    setEditError(''); setEditOpen(true);
  }

  function openDelete(u: User, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteUser(u); setDeleteOpen(true);
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PeopleIcon />}
        title="Users"
        subtitle={`${totalElements} users across all tenants`}
        action={
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <TextField size="small" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ width: 220 }} />
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Filter by ISP</InputLabel>
              <Select value={tenantFilter} label="Filter by ISP" onChange={e => setTenantFilter(e.target.value)}>
                <MenuItem value="">All ISPs</MenuItem>
                <MenuItem value="__none__">No ISP (Platform)</MenuItem>
                {tenants.map(t => <MenuItem key={t.id} value={t.id}><Stack direction="row" spacing={0.75} alignItems="center"><BusinessIcon sx={{ fontSize: 14, color: 'primary.main' }} /><span>{t.name}</span></Stack></MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
              onClick={() => exportCSV(filtered)} sx={{ borderRadius: 2 }}>Export</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(EMPTY_FORM); setFormError(''); setOpen(true); }}
              sx={{ bgcolor: 'primary.main', whiteSpace: 'nowrap' }}>Add User</Button>
          </Stack>
        }
      />

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        {(['GLOBAL_ADMIN', 'ISP_ADMIN', 'CUSTOMER'] as const).map(r => (
          <Chip key={r} label={`${r.replace('_', ' ')}: ${users.filter(u => u.role === r).length}`}
            color={ROLE_COLOR[r] || 'default'} variant="outlined" size="small" />
        ))}
      </Stack>

      {isLoading ? (
        <Card><Paper sx={{ p: 0 }}><SkeletonTable rows={5} columns={7} /></Paper></Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<PeopleIcon sx={{ fontSize: 36, color: 'primary.main' }} />} title="No users found"
          description={search ? 'Try adjusting your search query' : 'No users have been registered yet'} /></Card>
      ) : (
        <Card>
          <Paper>
            <Table aria-label="Users list">
              <TableHead>
                <TableRow sx={{ bgcolor: 'background.default' }}>
                  {['Name', 'Email', 'Role', 'Tenant', 'Status', 'Created', 'Actions'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((u, idx) => (

                  <TableRow key={u.id} hover onClick={() => navigate(`/admin/users/${u.id}`)} sx={{
                    cursor: 'pointer',
                    '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                    animation: `fadeInUp 0.3s ease ${idx * 0.03}s both`,
                  }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700, bgcolor: getAvatarColor(u.name) }}>
                          {getInitials(u.name)}
                        </Avatar>
                        <Typography fontWeight={600} variant="body2">{u.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{u.email}</Typography></TableCell>
                    <TableCell><Chip size="small" label={u.role.replace('_', ' ')} color={ROLE_COLOR[u.role] || 'default'} sx={{ fontSize: 11, fontWeight: 600 }} /></TableCell>
                    <TableCell>
                      {u.tenantId ? (() => {
                        const t = tenants.find(t => t.id === u.tenantId);
                        return (
                          <Chip
                            size="small"
                            icon={<BusinessIcon sx={{ fontSize: 13 }} />}
                            label={t?.name ?? `${u.tenantId.slice(0, 8)}…`}
                            sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', maxWidth: 160 }}
                          />
                        );
                      })() : (
                        u.role === 'GLOBAL_ADMIN'
                          ? <Chip size="small" label="Platform" sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.dark' }} />
                          : <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell><Chip size="small" label={u.active ? 'ACTIVE' : 'DISABLED'} color={u.active ? 'success' : 'default'} variant="outlined" /></TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '\u2014'}</Typography></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit"><IconButton size="small" onClick={(e) => openEdit(u, e)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={(e) => openDelete(u, e)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
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
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </Paper>
        </Card>
      )}

      {/* Create User Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Create New User</DialogTitle>
        <DialogContent dividers>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Grid container spacing={2}>
            <Grid size={12}><TextField fullWidth label="Full Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Grid>
            <Grid size={12}><TextField fullWidth label="Password * (min 8 chars)" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Role *" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <MenuItem value="ISP_ADMIN">ISP Admin</MenuItem>
                <MenuItem value="CUSTOMER">Customer</MenuItem>
                <MenuItem value="GLOBAL_ADMIN">Global Admin</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Tenant" value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
                helperText={form.role === 'ISP_ADMIN' ? 'Required for ISP Admin' : 'Optional'}>
                <MenuItem value=""><em>None</em></MenuItem>
                {tenants.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={createMutation.isPending}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={createMutation.isPending} sx={{ bgcolor: 'primary.main', minWidth: 120 }}>
            {createMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Edit User: {editUser?.email}</DialogTitle>
        <DialogContent dividers>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          <Grid container spacing={2}>
            <Grid size={12}><TextField fullWidth label="Full Name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Phone" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Role" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                <MenuItem value="ISP_ADMIN">ISP Admin</MenuItem>
                <MenuItem value="CUSTOMER">Customer</MenuItem>
                <MenuItem value="GLOBAL_ADMIN">Global Admin</MenuItem>
              </TextField>
            </Grid>
            <Grid size={12}>
              <TextField fullWidth select label="Tenant" value={editForm.tenantId} onChange={e => setEditForm(f => ({ ...f, tenantId: e.target.value }))}
                helperText="Assign user to an ISP tenant">
                <MenuItem value=""><em>None (Platform)</em></MenuItem>
                {tenants.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={<Switch checked={editForm.active} onChange={(_, c) => setEditForm(f => ({ ...f, active: c }))} />}
                label={editForm.active ? 'Account Active' : 'Account Disabled'}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => editUser && updateMutation.mutate({ id: editUser.id, data: editForm })}
            disabled={updateMutation.isPending} sx={{ bgcolor: 'primary.main', minWidth: 120 }}>
            {updateMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle fontWeight={700}>Delete User</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{deleteUser?.name}</strong> ({deleteUser?.email})?</Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
            disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}
