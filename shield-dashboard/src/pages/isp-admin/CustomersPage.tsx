import { Box, Typography, Card, Paper, Table, TableHead, TableRow, TableCell, TableBody, TablePagination, Chip, TextField, InputAdornment, Avatar, Button, Stack, Snackbar, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import SkeletonTable from '../../components/SkeletonTable';
import EmptyState from '../../components/EmptyState';
import CreateCustomerDialog from '../../components/CreateCustomerDialog';

interface Customer {
  id: string;
  name?: string;
  email?: string;
  profiles?: number;
  status?: string;
  joinedAt?: string;
  createdAt?: string;
  userId?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  profileCount?: number;
}

function getInitials(name?: string) {
  if (!name) return 'C';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function displayId(c: Customer, i: number) {
  if (c.name) return c.name;
  if (c.userId) return `User ${c.userId.slice(0, 8)}…`;
  return `Customer ${i + 1}`;
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const statusConfig: Record<string, { color: 'success' | 'error' | 'warning' | 'default'; bg: string }> = {
  ACTIVE: { color: 'success', bg: '#E8F5E9' },
  SUSPENDED: { color: 'error', bg: '#FFEBEE' },
  PENDING: { color: 'warning', bg: '#FFF8E1' },
};

const planColors: Record<string, { bg: string; text: string }> = {
  FREE: { bg: '#F5F5F5', text: '#757575' },
  BASIC: { bg: '#E3F2FD', text: '#1565C0' },
  PREMIUM: { bg: '#F3E5F5', text: '#7B1FA2' },
  ENTERPRISE: { bg: '#FFF8E1', text: '#F57F17' },
};

export default function CustomersPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => { setPage(0); }, [search]);
  const [snack, setSnack] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleToggleSuspend = async (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = (c.subscriptionStatus ?? c.status ?? 'ACTIVE') === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.put(`/profiles/customers/${c.id}`, { subscriptionStatus: newStatus });
      qc.invalidateQueries({ queryKey: ['isp-customers'] });
      setSnack(`Customer ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`);
    } catch { setSnack('Action failed'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    setDeleteTarget(null);
    // Optimistically remove from cache immediately so stale rows can't be re-clicked
    qc.setQueryData(['isp-customers', page, rowsPerPage], (old: { list: Customer[]; total: number } | undefined) =>
      old ? { list: old.list.filter(c => c.id !== target.id), total: Math.max(0, old.total - 1) } : old
    );
    try {
      await api.delete(`/profiles/customers/${target.id}`);
      setSnack('Customer deleted');
    } catch (e: any) {
      // 404 = already gone — still treat as success
      if (e?.response?.status !== 404) {
        setSnack(e?.response?.data?.message ?? 'Delete failed');
        qc.invalidateQueries({ queryKey: ['isp-customers'] }); // restore on real error
        setDeleting(false);
        return;
      }
      setSnack('Customer deleted');
    }
    qc.invalidateQueries({ queryKey: ['isp-customers'] });
    setDeleting(false);
  };
  const { data, isLoading } = useQuery({
    queryKey: ['isp-customers', page, rowsPerPage],
    queryFn: async () => {
      const r = await api.get(`/profiles/customers?page=${page}&size=${rowsPerPage}`).catch(() => ({ data: { data: [] } }));
      const d = r.data?.data;
      const list: Customer[] = (d?.content ?? d) as Customer[];
      const total: number = d?.totalElements ?? list.length;
      // Enrich with user name/email for records that don't have them stored
      const missing = list.filter(c => !c.name && !c.email && c.userId);
      if (missing.length > 0) {
        const ur = await api.get('/auth/users', { params: { size: 500, role: 'CUSTOMER' } }).catch(() => null);
        if (ur) {
          const ud = ur.data?.data;
          const users: any[] = (ud?.content ?? ud ?? []);
          const userMap: Record<string, any> = {};
          users.forEach(u => { userMap[u.id] = u; });
          return {
            list: list.map(c => (!c.name && userMap[c.userId!]) ? { ...c, name: userMap[c.userId!].name, email: userMap[c.userId!].email } : c),
            total,
          };
        }
      }
      return { list, total };
    },
  });
  const allCustomers = data?.list ?? [];
  const totalElements = data?.total ?? 0;
  const customers = allCustomers.filter(c =>
    `${c.name ?? ''} ${c.email ?? ''} ${c.userId ?? ''} ${c.subscriptionPlan ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PeopleIcon />}
        title="Customers"
        subtitle={`${totalElements} registered customers`}
        iconColor="#00897B"
        action={
          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              placeholder="Search customers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: '#9E9E9E' }} /></InputAdornment>,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: '#F8FAFC',
                  '&:hover': { bgcolor: '#F1F5F9' },
                  '&.Mui-focused': { bgcolor: '#fff' },
                },
              }}
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
              sx={{ bgcolor: '#00897B', whiteSpace: 'nowrap', '&:hover': { bgcolor: '#00796B' } }}>
              Add Customer
            </Button>
          </Stack>
        }
      />

      <AnimatedPage delay={0.15}>
        <Card>
          <Paper elevation={0}>
            {isLoading ? (
              <SkeletonTable rows={5} columns={5} />
            ) : customers.length === 0 ? (
              <EmptyState
                icon={<PeopleIcon sx={{ fontSize: 36, color: '#00897B' }} />}
                title="No customers found"
                description={search ? 'Try adjusting your search terms' : 'Get started by adding your first customer'}
                action={search ? undefined : { label: 'Add Customer', onClick: () => setAddOpen(true) }}
              />
            ) : (
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    {['Customer', 'Email', 'Plan', 'Profiles', 'Status', 'Joined', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, color: '#64748B', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customers.map((c, i) => (
                    <TableRow
                      key={c.id}
                      onClick={() => navigate(`/isp/customers/${c.id}`)}
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': { bgcolor: '#F5F9FF' },
                        '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                        animation: `fadeInUp 0.3s ease ${0.1 + i * 0.05}s both`,
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: '#00897B' }}>
                            {getInitials(c.name)}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={600} fontSize={14} noWrap>{displayId(c, i)}</Typography>
                            {c.email && <Typography variant="caption" color="text.secondary" noWrap>{c.email}</Typography>}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>{c.email ?? '—'}</Typography></TableCell>
                      <TableCell>
                        {(() => { const plan = c.subscriptionPlan || 'FREE'; const pc = planColors[plan] || planColors.FREE; return (
                          <Chip size="small" label={plan} sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: pc.bg, color: pc.text }} />
                        ); })()}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={c.profileCount ?? c.profiles ?? 0} sx={{ height: 22, minWidth: 28, bgcolor: '#E3F2FD', color: '#1565C0', fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={c.subscriptionStatus ?? c.status ?? 'ACTIVE'}
                          color={statusConfig[c.subscriptionStatus ?? c.status ?? 'ACTIVE']?.color || 'success'}
                          sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{formatDate(c.createdAt ?? c.joinedAt)}</Typography></TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => navigate(`/isp/customers/${c.id}`)} sx={{ color: '#1565C0', '&:hover': { bgcolor: '#E3F2FD' } }}>
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={(c.subscriptionStatus ?? c.status ?? 'ACTIVE') === 'ACTIVE' ? 'Suspend' : 'Activate'}>
                            <IconButton size="small" onClick={e => handleToggleSuspend(c, e)}
                              sx={{ color: (c.subscriptionStatus ?? c.status ?? 'ACTIVE') === 'ACTIVE' ? '#F57F17' : '#1B5E20',
                                '&:hover': { bgcolor: (c.subscriptionStatus ?? c.status ?? 'ACTIVE') === 'ACTIVE' ? '#FFF8E1' : '#E8F5E9' } }}>
                              {(c.subscriptionStatus ?? c.status ?? 'ACTIVE') === 'ACTIVE' ? <PauseCircleIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Customer">
                            <IconButton size="small" onClick={e => { e.stopPropagation(); setDeleteTarget(c); }}
                              sx={{ color: '#E53935', '&:hover': { bgcolor: '#FFEBEE' } }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!isLoading && totalElements > 0 && (
              <TablePagination
                component="div"
                count={totalElements}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            )}
          </Paper>
        </Card>
      </AnimatedPage>

      <CreateCustomerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={(msg) => {
          setAddOpen(false);
          qc.invalidateQueries({ queryKey: ['isp-customers'] });
          setSnack(msg);
        }}
      />

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} sx={{ color: '#B71C1C' }}>Delete Customer?</DialogTitle>
        <DialogContent>
          <Typography>This will permanently delete the customer and all their profiles and data. This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}
