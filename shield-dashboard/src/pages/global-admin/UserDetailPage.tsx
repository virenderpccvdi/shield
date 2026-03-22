import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Table, TableHead,
  TableRow, TableCell, TableBody, Paper, Stack, CircularProgress, Button,
  Avatar, Tabs, Tab,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';
import DevicesIcon from '@mui/icons-material/Devices';
import DnsIcon from '@mui/icons-material/Dns';
import ShieldIcon from '@mui/icons-material/Shield';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
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
import LoadingPage from '../../components/LoadingPage';

const ROLE_COLOR: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
  GLOBAL_ADMIN: 'error', ISP_ADMIN: 'warning', CUSTOMER: 'success',
};

function fmt(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return String(v);
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  // Fetch user info
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => api.get('/auth/users?size=100').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as any[];
    }).catch(() => []),
  });
  const user = users.find((u: any) => u.id === userId);

  // Fetch child profiles if CUSTOMER
  const { data: children = [] } = useQuery({
    queryKey: ['user-children', userId],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as any[];
    }).catch(() => []),
    enabled: user?.role === 'CUSTOMER',
  });

  // Fetch devices
  const { data: devices = [] } = useQuery({
    queryKey: ['user-devices', userId],
    queryFn: () => api.get('/profiles/devices/all?size=100').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as any[];
    }).catch(() => []),
    enabled: user?.role === 'CUSTOMER',
  });

  // Fetch tenant info if ISP_ADMIN
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants-simple'],
    queryFn: () => api.get('/tenants?size=100').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as any[];
    }).catch(() => []),
  });
  const userTenant = tenants.find((t: any) => t.id === user?.tenantId);

  if (isLoading) return <LoadingPage />;
  if (!user) return <EmptyState icon={<PersonIcon sx={{ fontSize: 36 }} />} title="User not found" description="The requested user could not be loaded" />;

  const isCustomer = user.role === 'CUSTOMER';
  const isIspAdmin = user.role === 'ISP_ADMIN';

  return (
    <AnimatedPage>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/users')} sx={{ mb: 2, color: 'text.secondary' }}>
        Back to Users
      </Button>

      <PageHeader
        icon={<PersonIcon />}
        title={user.name}
        subtitle={`${user.email} — ${user.role?.replace('_', ' ')}`}
        iconColor={user.role === 'GLOBAL_ADMIN' ? '#E53935' : user.role === 'ISP_ADMIN' ? '#FB8C00' : '#43A047'}
      />

      {/* User Info Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ width: 56, height: 56, fontSize: 22, fontWeight: 700, bgcolor: user.role === 'GLOBAL_ADMIN' ? '#E53935' : user.role === 'ISP_ADMIN' ? '#FB8C00' : '#43A047' }}>
                  {getInitials(user.name)}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={700}>{user.name}</Typography>
                  <Chip size="small" label={user.role?.replace('_', ' ')} color={ROLE_COLOR[user.role] || 'default'} sx={{ mt: 0.5 }} />
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Stack spacing={1}>
                <Box><Typography variant="caption" color="text.secondary">Email</Typography><Typography>{user.email}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Phone</Typography><Typography>{user.phone || '—'}</Typography></Box>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Stack spacing={1}>
                <Box><Typography variant="caption" color="text.secondary">Status</Typography><br /><Chip size="small" label={user.active ? 'ACTIVE' : 'DISABLED'} color={user.active ? 'success' : 'default'} variant="outlined" /></Box>
                <Box><Typography variant="caption" color="text.secondary">Created</Typography><Typography>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</Typography></Box>
                {userTenant && (
                  <Box><Typography variant="caption" color="text.secondary">Tenant</Typography>
                    <Typography sx={{ cursor: 'pointer', color: '#1565C0', '&:hover': { textDecoration: 'underline' } }}
                      onClick={() => navigate(`/admin/tenants/${user.tenantId}`)}>{userTenant.name}</Typography>
                  </Box>
                )}
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Stat cards for customers */}
      {isCustomer && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title="Child Profiles" value={children.length} icon={<PeopleIcon />} gradient={gradients.blue} delay={0.1} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title="Devices" value={devices.length} icon={<DevicesIcon />} gradient={gradients.green} delay={0.15} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title="Online Devices" value={devices.filter((d: any) => d.online).length} icon={<FiberManualRecordIcon />} gradient={gradients.teal} delay={0.2} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard title="Active Profiles" value={children.filter((c: any) => !c.paused).length} icon={<ShieldIcon />} gradient={gradients.purple} delay={0.25} />
          </Grid>
        </Grid>
      )}

      {/* ISP Admin - show tenant link */}
      {isIspAdmin && userTenant && (
        <Card sx={{ mb: 3, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { boxShadow: 4 } }}
          onClick={() => navigate(`/admin/tenants/${user.tenantId}`)}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Assigned Tenant</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: '#FB8C00' }}>{getInitials(userTenant.name)}</Avatar>
              <Box>
                <Typography fontWeight={600}>{userTenant.name}</Typography>
                <Typography variant="body2" color="text.secondary">{userTenant.slug} — {userTenant.plan} plan</Typography>
              </Box>
              <Box sx={{ ml: 'auto' }}>
                <Chip label={userTenant.status || 'ACTIVE'} color="success" size="small" />
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Customer role */}
      {isCustomer && (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #E8EDF2' }}
            aria-label="User detail tabs">
            <Tab label={`Child Profiles (${children.length})`} />
            <Tab label={`Devices (${devices.length})`} />
          </Tabs>

          {tab === 0 && (
            <Card>
              <Paper>
                {children.length === 0 ? (
                  <EmptyState icon={<PeopleIcon sx={{ fontSize: 36, color: '#1565C0' }} />} title="No child profiles" description="This customer hasn't created any child profiles yet" />
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                        {['Name', 'Filter Level', 'DNS Client ID', 'Online', 'Paused', 'Created'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {children.map((c: any) => (
                        <TableRow key={c.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: '#1565C0' }}>{getInitials(c.name)}</Avatar>
                              <Typography fontWeight={600} fontSize={14}>{c.name}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell><Chip size="small" label={c.filterLevel || '—'} sx={{ fontSize: 11 }} /></TableCell>
                          <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{c.dnsClientId || '—'}</Typography></TableCell>
                          <TableCell>
                            <Chip size="small" label={c.online ? 'Online' : 'Offline'} color={c.online ? 'success' : 'default'}
                              icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important' }} />} sx={{ height: 22 }} />
                          </TableCell>
                          <TableCell>{c.paused ? <Chip size="small" label="PAUSED" color="warning" /> : '—'}</TableCell>
                          <TableCell><Typography variant="body2" color="text.secondary">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</Typography></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Card>
          )}

          {tab === 1 && (
            <Card>
              <Paper>
                {devices.length === 0 ? (
                  <EmptyState icon={<DevicesIcon sx={{ fontSize: 36, color: '#1565C0' }} />} title="No devices" description="No devices registered by this customer" />
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                        {['Device Name', 'Type', 'Status', 'DNS Method', 'MAC Address', 'Last Seen'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {devices.map((d: any) => (
                        <TableRow key={d.id} hover>
                          <TableCell><Typography fontWeight={600} fontSize={14}>{d.name}</Typography></TableCell>
                          <TableCell><Typography variant="body2" color="text.secondary">{d.deviceType || '—'}</Typography></TableCell>
                          <TableCell>
                            <Chip size="small" label={d.online ? 'Online' : 'Offline'} color={d.online ? 'success' : 'default'}
                              icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important' }} />} sx={{ height: 22 }} />
                          </TableCell>
                          <TableCell><Chip size="small" label={d.dnsMethod || 'DOH'} sx={{ fontSize: 11 }} /></TableCell>
                          <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{d.macAddress || '—'}</Typography></TableCell>
                          <TableCell><Typography variant="body2" color="text.secondary">{timeAgo(d.lastSeenAt)}</Typography></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Card>
          )}
        </>
      )}
    </AnimatedPage>
  );
}
