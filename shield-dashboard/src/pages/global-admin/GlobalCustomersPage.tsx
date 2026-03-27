import {
  Box, Typography, Card, Paper, Table, TableHead, TableRow, TableCell, TableBody, TablePagination,
  Chip, TextField, InputAdornment, Avatar, Button, Stack, Snackbar, IconButton, Tooltip,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/People';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BusinessIcon from '@mui/icons-material/Business';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import SkeletonTable from '../../components/SkeletonTable';
import EmptyState from '../../components/EmptyState';

interface Customer {
  id: string;
  name?: string;
  email?: string;
  userId?: string;
  tenantId?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  profileCount?: number;
  maxProfiles?: number;
  createdAt?: string;
}

interface Tenant {
  id: string;
  name: string;
  slug?: string;
  plan?: string;
}

const planColors: Record<string, { bg: string; text: string }> = {
  FREE:       { bg: '#F5F5F5', text: '#757575' },
  BASIC:      { bg: '#E3F2FD', text: '#1565C0' },
  PREMIUM:    { bg: '#F3E5F5', text: '#7B1FA2' },
  ENTERPRISE: { bg: '#FFF8E1', text: '#F57F17' },
};

const ispColors = ['#00897B', '#1565C0', '#7B1FA2', '#E65100', '#2E7D32', '#AD1457'];

function getInitials(name?: string) {
  if (!name) return 'C';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function GlobalCustomersPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [snack, setSnack] = useState('');
  const [ispFilter, setIspFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => { setPage(0); }, [search, ispFilter]);

  // Fetch all tenants to build ISP name map
  const { data: tenantsData } = useQuery({
    queryKey: ['all-tenants-map'],
    queryFn: () => api.get('/tenants?size=200').then(r => {
      const d = r.data?.data;
      return (Array.isArray(d) ? d : d?.content ?? []) as Tenant[];
    }).catch(() => [] as Tenant[]),
  });

  const tenantMap: Record<string, Tenant> = {};
  (tenantsData ?? []).forEach(t => { tenantMap[t.id] = t; });

  // Fetch ALL customers (GLOBAL_ADMIN gets all, no tenant filter)
  const { data, isLoading } = useQuery({
    queryKey: ['all-customers-global', page, rowsPerPage],
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
          const users: any[] = ur.data?.data?.content ?? ur.data?.data ?? [];
          const userMap: Record<string, any> = {};
          users.forEach(u => { userMap[u.id] = u; });
          return {
            list: list.map(c => (!c.name && c.userId && userMap[c.userId]) ? { ...c, name: userMap[c.userId].name, email: userMap[c.userId].email } : c),
            total,
          };
        }
      }
      return { list, total };
    },
  });

  const allCustomers = data?.list ?? [];
  const totalElements = data?.total ?? 0;
  const customers = allCustomers.filter(c => {
    const ispName = c.tenantId ? (tenantMap[c.tenantId]?.name ?? '') : '';
    const matchesSearch = `${c.name ?? ''} ${c.email ?? ''} ${c.subscriptionPlan ?? ''} ${ispName}`.toLowerCase().includes(search.toLowerCase());
    const matchesIsp = !ispFilter || c.tenantId === ispFilter;
    return matchesSearch && matchesIsp;
  });

  // Unique ISPs in the data (from current page — ISP filter chips use tenant list)
  const uniqueIsps = Array.from(new Set(allCustomers.map(c => c.tenantId).filter(Boolean))) as string[];

  const handleToggleSuspend = async (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = (c.subscriptionStatus ?? 'ACTIVE') === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.put(`/profiles/customers/${c.id}`, { subscriptionStatus: newStatus });
      qc.invalidateQueries({ queryKey: ['all-customers-global'] });
      setSnack(`Customer ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`);
    } catch { setSnack('Action failed'); }
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PeopleIcon />}
        title="All Customers"
        subtitle={`${totalElements} total customers across ${(tenantsData ?? []).length} ISPs`}
        iconColor="#00897B"
        action={
          <TextField
            size="small"
            placeholder="Search by name, email, plan, ISP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: '#9E9E9E' }} /></InputAdornment>,
            }}
            sx={{ width: 280, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#F8FAFC' } }}
          />
        }
      />

      {/* ISP filter chips */}
      {uniqueIsps.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            label="All ISPs"
            size="small"
            onClick={() => setIspFilter(null)}
            sx={{ fontWeight: 600, bgcolor: !ispFilter ? '#00897B' : 'action.selected', color: !ispFilter ? '#fff' : 'text.primary' }}
          />
          {uniqueIsps.map((ispId, i) => {
            const isp = tenantMap[ispId];
            if (!isp) return null;
            const color = ispColors[i % ispColors.length];
            const selected = ispFilter === ispId;
            return (
              <Chip
                key={ispId}
                icon={<BusinessIcon sx={{ fontSize: 14, color: selected ? '#fff' : color }} />}
                label={isp.name}
                size="small"
                onClick={() => setIspFilter(selected ? null : ispId)}
                sx={{ fontWeight: 600, bgcolor: selected ? color : color + '15', color: selected ? '#fff' : color, borderColor: color + '40', border: '1px solid' }}
              />
            );
          })}
        </Box>
      )}

      <AnimatedPage delay={0.1}>
        <Card>
          <Paper elevation={0}>
            {isLoading ? (
              <SkeletonTable rows={8} columns={7} />
            ) : customers.length === 0 ? (
              <EmptyState
                icon={<PeopleIcon sx={{ fontSize: 36, color: '#00897B' }} />}
                title="No customers found"
                description={search || ispFilter ? 'Try adjusting your filters' : 'No customers registered on the platform yet'}
              />
            ) : (
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    {['Customer', 'ISP', 'Plan', 'Profiles', 'Status', 'Joined', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, color: '#64748B', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customers.map((c, i) => {
                    const isp = c.tenantId ? tenantMap[c.tenantId] : null;
                    const ispIdx = isp ? uniqueIsps.indexOf(c.tenantId!) : 0;
                    const ispColor = ispColors[ispIdx % ispColors.length];
                    const plan = c.subscriptionPlan || 'FREE';
                    const pc = planColors[plan] || planColors.FREE;
                    const status = c.subscriptionStatus ?? 'ACTIVE';
                    return (
                      <TableRow
                        key={c.id}
                        onClick={() => navigate(`/admin/customers/${c.id}`)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#F5F9FF' },
                          '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                          animation: `fadeInUp 0.3s ease ${0.05 + i * 0.03}s both`,
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 32, height: 32, fontSize: 12, fontWeight: 700, bgcolor: '#00897B' }}>
                              {getInitials(c.name)}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography fontWeight={600} fontSize={13} noWrap>
                                {c.name ?? (c.userId ? `User ${c.userId.slice(0, 8)}…` : `Customer`)}
                              </Typography>
                              {c.email && <Typography variant="caption" color="text.secondary" noWrap>{c.email}</Typography>}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {isp ? (
                            <Chip
                              size="small"
                              icon={<BusinessIcon sx={{ fontSize: 12, color: ispColor }} />}
                              label={isp.name}
                              sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: ispColor + '15', color: ispColor }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={plan} sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: pc.bg, color: pc.text }} />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={`${c.profileCount ?? 0} / ${c.maxProfiles ?? '?'}`}
                            sx={{ height: 22, minWidth: 48, bgcolor: '#E3F2FD', color: '#1565C0', fontWeight: 600, fontSize: 11 }} />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={status}
                            color={status === 'ACTIVE' ? 'success' : 'error'}
                            sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" fontSize={12}>{formatDate(c.createdAt)}</Typography>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="View Details">
                              <IconButton size="small" onClick={() => navigate(`/admin/customers/${c.id}`)}
                                sx={{ color: '#1565C0', '&:hover': { bgcolor: '#E3F2FD' } }}>
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={status === 'ACTIVE' ? 'Suspend' : 'Activate'}>
                              <IconButton size="small" onClick={e => handleToggleSuspend(c, e)}
                                sx={{ color: status === 'ACTIVE' ? '#F57F17' : '#1B5E20',
                                  '&:hover': { bgcolor: status === 'ACTIVE' ? '#FFF8E1' : '#E8F5E9' } }}>
                                {status === 'ACTIVE' ? <PauseCircleIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}
