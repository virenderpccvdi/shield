import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Table, TableHead,
  TableRow, TableCell, TableBody, Paper, Stack, CircularProgress, Button, Alert,
  Avatar, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Snackbar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import DevicesIcon from '@mui/icons-material/Devices';
import DnsIcon from '@mui/icons-material/Dns';
import ShieldIcon from '@mui/icons-material/Shield';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useState } from 'react';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import { gradients } from '../../theme/theme';

const TENANT_PLANS = [
  { value: 'STARTER', label: 'Starter', description: 'Up to 100 customers' },
  { value: 'GROWTH', label: 'Growth', description: 'Up to 1,000 customers' },
  { value: 'ENTERPRISE', label: 'Enterprise', description: 'Unlimited customers' },
];

function fmt(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return String(v);
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [syncingSaving, setSyncingSaving] = useState(false);
  const [snack, setSnack] = useState('');

  const { data: tenant, isLoading: loadingTenant } = useQuery({
    queryKey: ['tenant-detail', tenantId],
    queryFn: () => api.get(`/tenants/${tenantId}`).then(r => r.data?.data || r.data).catch(() => null),
    enabled: !!tenantId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['tenant-customers', tenantId],
    queryFn: () => api.get('/profiles/customers').then(r => {
      const d = r.data?.data;
      const all = (d?.content ?? d ?? []) as any[];
      return tenantId ? all.filter((c: any) => c.tenantId === tenantId) : all;
    }).catch(() => []),
    enabled: !!tenantId,
  });

  const { data: daily = [] } = useQuery({
    queryKey: ['tenant-daily', tenantId],
    queryFn: () => api.get(`/analytics/tenant/${tenantId}/daily?days=7`).then(r => {
      const d = Array.isArray(r.data) ? r.data : r.data?.data || [];
      return d.map((p: any) => ({
        day: new Date(p.date).toLocaleDateString('en', { weekday: 'short' }),
        queries: p.totalQueries || 0,
        blocked: p.blockedQueries || 0,
      }));
    }).catch(() => []),
    enabled: !!tenantId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['tenant-users', tenantId],
    queryFn: () => api.get('/auth/users?size=100').then(r => {
      const d = r.data?.data;
      const list = (d?.content ?? d ?? []) as any[];
      return list.filter((u: any) => u.tenantId === tenantId);
    }).catch(() => []),
    enabled: !!tenantId,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['tenant-invoices', tenantId],
    queryFn: () => api.get('/admin/invoices', { params: { tenantId, page: 0, size: 20 } }).then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as any[];
    }).catch(() => []),
    enabled: !!tenantId && tab === 3,
  });
  const invoices = invoicesData ?? [];

  const handleChangePlan = async () => {
    if (!selectedPlan || !tenantId) return;
    setSaving(true);
    try {
      await api.put(`/tenants/${tenantId}`, { plan: selectedPlan });
      qc.invalidateQueries({ queryKey: ['tenant-detail', tenantId] });
      setSnack(`Plan changed to ${selectedPlan} — features auto-applied`);
      setChangePlanOpen(false);
    } catch {
      setSnack('Failed to change plan');
    }
    setSaving(false);
  };

  const handleSyncFeatures = async () => {
    if (!tenantId) return;
    setSyncingSaving(true);
    try {
      await api.post(`/tenants/${tenantId}/sync-features`);
      qc.invalidateQueries({ queryKey: ['tenant-detail', tenantId] });
      setSnack(`Features synced to ${tenant.plan} plan defaults`);
    } catch {
      setSnack('Failed to sync features');
    }
    setSyncingSaving(false);
  };

  const handleToggleStatus = async () => {
    if (!tenantId) return;
    setStatusSaving(true);
    const newActive = !tenant.active;
    try {
      await api.put(`/tenants/${tenantId}`, { active: newActive });
      qc.invalidateQueries({ queryKey: ['tenant-detail', tenantId] });
      setSnack(newActive ? 'ISP tenant activated' : 'ISP tenant suspended');
    } catch {
      setSnack('Failed to update tenant status');
    }
    setStatusSaving(false);
  };

  if (loadingTenant) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (!tenant) return <EmptyState icon={<BusinessIcon sx={{ fontSize: 36 }} />} title="Tenant not found" description="The requested ISP tenant could not be loaded" />;

  const totalQueries = daily.reduce((s: number, d: any) => s + d.queries, 0);
  const totalBlocked = daily.reduce((s: number, d: any) => s + d.blocked, 0);
  const featureCount = tenant.features ? Object.values(tenant.features).filter(Boolean).length : 0;

  return (
    <AnimatedPage>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/tenants')} sx={{ mb: 2, color: 'text.secondary' }}>
        Back to Tenants
      </Button>

      <PageHeader
        icon={<BusinessIcon />}
        title={tenant.name}
        subtitle={`${tenant.slug} — ${tenant.plan} plan`}
        iconColor="#1565C0"
        action={
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<EditIcon />}
              onClick={() => { setSelectedPlan(tenant.plan ?? 'STARTER'); setChangePlanOpen(true); }}
              sx={{ borderColor: '#1565C0', color: '#1565C0' }}>
              Change Plan
            </Button>
            <Button
              variant="outlined"
              startIcon={statusSaving ? <CircularProgress size={14} /> : tenant.active ? <BlockIcon /> : <CheckCircleIcon />}
              onClick={handleToggleStatus}
              disabled={statusSaving}
              color={tenant.active ? 'error' : 'success'}
              sx={{ fontWeight: 600 }}>
              {tenant.active ? 'Suspend ISP' : 'Activate ISP'}
            </Button>
          </Stack>
        }
      />

      {/* Stat cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard title="Customers" value={customers.length} icon={<PeopleIcon />} gradient={gradients.blue} delay={0.1} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard title="Users" value={users.length} icon={<PeopleIcon />} gradient={gradients.green} delay={0.15} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard title="DNS Queries (7d)" value={fmt(totalQueries)} icon={<DnsIcon />} gradient={gradients.purple} delay={0.2} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard title="Features Enabled" value={featureCount} icon={<ShieldIcon />} gradient={gradients.teal} delay={0.25} />
        </Grid>
      </Grid>

      {/* Tenant Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Tenant Details</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack spacing={1}>
                <Box><Typography variant="caption" color="text.secondary">Contact Email</Typography><Typography>{tenant.contactEmail}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Contact Phone</Typography><Typography>{tenant.contactPhone || '—'}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Status</Typography><br /><Chip size="small" label={tenant.status || tenant.isActive ? 'ACTIVE' : 'SUSPENDED'} color={tenant.status === 'ACTIVE' || tenant.isActive ? 'success' : 'error'} /></Box>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack spacing={1}>
                <Box><Typography variant="caption" color="text.secondary">Plan</Typography><Typography fontWeight={600}>{tenant.plan}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Max Customers</Typography><Typography>{tenant.maxCustomers?.toLocaleString()}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Subscription Ends</Typography><Typography>{tenant.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt).toLocaleDateString() : '—'}</Typography></Box>
              </Stack>
            </Grid>
          </Grid>
          {tenant.features && Object.keys(tenant.features).length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Enabled Features ({Object.values(tenant.features).filter(Boolean).length}/{Object.keys(tenant.features).length})
                </Typography>
                <Button size="small" variant="outlined" onClick={handleSyncFeatures} disabled={syncingSaving}
                  sx={{ fontSize: 11, py: 0.25, px: 1, borderColor: '#1565C0', color: '#1565C0' }}>
                  {syncingSaving ? <CircularProgress size={12} /> : 'Sync to Plan'}
                </Button>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {Object.entries(tenant.features).map(([key, val]) => (
                  <Chip key={key} size="small" label={key.replace(/_/g, ' ')}
                    color={val ? 'success' : 'default'} variant={val ? 'filled' : 'outlined'}
                    sx={{ fontSize: 11, textTransform: 'capitalize', mb: 0.5 }} />
                ))}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #E8EDF2' }}
        aria-label="Tenant detail tabs">
        <Tab label="DNS Traffic" />
        <Tab label={`Customers (${customers.length})`} />
        <Tab label={`Users (${users.length})`} />
        <Tab label="Billing" />
      </Tabs>

      {tab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>DNS Queries vs Blocked (7 days)</Typography>
            {daily.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No DNS data available for this tenant yet.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="tdQ" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1565C0" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#1565C0" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="tdB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E53935" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#E53935" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [fmt(v), '']} />
                  <Area type="monotone" dataKey="queries" name="Queries" stroke="#1565C0" strokeWidth={2} fill="url(#tdQ)" dot={{ r: 3, fill: '#1565C0' }} />
                  <Area type="monotone" dataKey="blocked" name="Blocked" stroke="#E53935" strokeWidth={2} fill="url(#tdB)" dot={{ r: 3, fill: '#E53935' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <Paper>
            {customers.length === 0 ? (
              <EmptyState icon={<PeopleIcon sx={{ fontSize: 36, color: '#1565C0' }} />} title="No customers" description="No customers registered for this tenant yet" />
            ) : (
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    {['Customer', 'Email', 'Profiles', 'Status', 'Joined'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customers.map((c: any) => (
                    <TableRow key={c.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/users/${c.userId || c.id}`)}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: '#00897B' }}>{getInitials(c.name)}</Avatar>
                          <Typography fontWeight={600} fontSize={14}>{c.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{c.email}</Typography></TableCell>
                      <TableCell><Chip size="small" label={c.profiles || 0} sx={{ height: 22, bgcolor: '#E3F2FD', color: '#1565C0' }} /></TableCell>
                      <TableCell><Chip size="small" label={c.status || 'ACTIVE'} color={c.status === 'ACTIVE' || !c.status ? 'success' : 'error'} sx={{ height: 22, fontSize: 11 }} /></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{c.joinedAt ? new Date(c.joinedAt).toLocaleDateString() : '—'}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Card>
      )}

      {tab === 2 && (
        <Card>
          <Paper>
            {users.length === 0 ? (
              <EmptyState icon={<PeopleIcon sx={{ fontSize: 36, color: '#1565C0' }} />} title="No users" description="No users assigned to this tenant" />
            ) : (
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    {['Name', 'Email', 'Role', 'Status', 'Created'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u: any) => (
                    <TableRow key={u.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/users/${u.id}`)}>
                      <TableCell><Typography fontWeight={600} fontSize={14}>{u.name}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{u.email}</Typography></TableCell>
                      <TableCell><Chip size="small" label={u.role?.replace('_', ' ')} sx={{ fontSize: 11 }} /></TableCell>
                      <TableCell><Chip size="small" label={u.active ? 'ACTIVE' : 'DISABLED'} color={u.active ? 'success' : 'default'} variant="outlined" /></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Card>
      )}

      {/* Billing Tab */}
      {tab === 3 && (
        <Card>
          <CardContent>
            {/* Subscription summary */}
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5, p: 2, bgcolor: '#F8FAFC', borderRadius: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">Current Plan</Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                  <Typography variant="h6" fontWeight={700}>{tenant.plan ?? 'STARTER'}</Typography>
                  <Chip size="small" label={tenant.active ? 'Active' : 'Suspended'}
                    color={tenant.active ? 'success' : 'error'} sx={{ height: 20, fontSize: 11 }} />
                </Stack>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Max Customers</Typography>
                <Typography fontWeight={600}>{tenant.maxCustomers?.toLocaleString() ?? '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Max Profiles/Customer</Typography>
                <Typography fontWeight={600}>{tenant.maxProfilesPerCustomer ?? '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Subscription Ends</Typography>
                <Typography fontWeight={600}>{tenant.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</Typography>
              </Box>
              <Button variant="outlined" size="small" startIcon={<EditIcon />}
                onClick={() => { setSelectedPlan(tenant.plan ?? 'STARTER'); setChangePlanOpen(true); }}
                sx={{ borderColor: '#1565C0', color: '#1565C0' }}>
                Change Plan
              </Button>
            </Stack>

            <Typography fontWeight={600} sx={{ mb: 1.5 }}>Invoice History</Typography>
            {invoices.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No invoices found for this tenant.</Typography>
            ) : (
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                      {['Invoice', 'Plan', 'Amount', 'Status', 'Date'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 0.5 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoices.map((inv: any) => (
                      <TableRow key={inv.id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                        <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 11 }}>{inv.id?.slice(0, 8).toUpperCase()}</Typography></TableCell>
                        <TableCell><Chip size="small" label={inv.planName} sx={{ height: 20, fontSize: 11, fontWeight: 600, bgcolor: '#EDE7F6', color: '#4527A0' }} /></TableCell>
                        <TableCell><Typography variant="body2" fontWeight={600}>₹{inv.amount}</Typography></TableCell>
                        <TableCell><Chip size="small" label={inv.status} color={inv.status === 'PAID' ? 'success' : 'warning'} sx={{ height: 20, fontSize: 11 }} /></TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </CardContent>
        </Card>
      )}

      {/* Change Plan Dialog */}
      <Dialog open={changePlanOpen} onClose={() => setChangePlanOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Change ISP Plan</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Current plan: <strong>{tenant.plan}</strong>
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Select Plan</InputLabel>
            <Select value={selectedPlan} label="Select Plan" onChange={e => setSelectedPlan(e.target.value)}>
              {TENANT_PLANS.map(p => (
                <MenuItem key={p.value} value={p.value}>
                  <Box>
                    <Typography fontWeight={600}>{p.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.description}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setChangePlanOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleChangePlan} disabled={saving || !selectedPlan || selectedPlan === tenant.plan}
            sx={{ bgcolor: '#1565C0' }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Change Plan'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}
