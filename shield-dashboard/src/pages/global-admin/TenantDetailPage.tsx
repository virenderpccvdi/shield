import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Table, TableHead,
  TableRow, TableCell, TableBody, Paper, Stack, CircularProgress, Button,
  Avatar, Tabs, Tab,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import DevicesIcon from '@mui/icons-material/Devices';
import DnsIcon from '@mui/icons-material/Dns';
import ShieldIcon from '@mui/icons-material/Shield';
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
  const [tab, setTab] = useState(0);

  const { data: tenant, isLoading: loadingTenant } = useQuery({
    queryKey: ['tenant-detail', tenantId],
    queryFn: () => api.get(`/tenants/${tenantId}`).then(r => r.data?.data || r.data).catch(() => null),
    enabled: !!tenantId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['tenant-customers', tenantId],
    queryFn: () => api.get('/profiles/customers').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as any[];
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
              <Typography variant="caption" color="text.secondary">Enabled Features</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                {Object.entries(tenant.features).map(([key, val]) => (
                  <Chip key={key} size="small" label={key.replace(/_/g, ' ')}
                    color={val ? 'success' : 'default'} variant="outlined"
                    sx={{ fontSize: 11, textTransform: 'capitalize' }} />
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
    </AnimatedPage>
  );
}
