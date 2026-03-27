import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, CircularProgress,
  Stack, Avatar, Table, TableHead, TableRow, TableCell, TableBody,
  Paper, Select, MenuItem, FormControl, InputLabel, Alert,
  Button, Tabs, Tab, TextField, InputAdornment, TablePagination,
  LinearProgress,
} from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface Tenant { id: string; name: string; plan?: string; }
interface Customer { id: string; userId?: string; name?: string; email?: string; }
interface ChildProfile { id: string; name?: string; age?: number; filterLevel?: string; dnsClientId?: string; }
interface HistoryEntry { id: string; domain: string; action: string; category?: string; timestamp: string; deviceIp?: string; }
interface ProfileStats { totalQueries: number; blockedQueries: number; allowedQueries: number; blockRate: number; uniqueDomains: number; totalBlocked?: number; totalAllowed?: number; }
interface PlatformOverview { totalQueries: number; totalBlocked: number; blockRate: number; activeProfiles: number; }

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</Typography>
        <Typography variant="h4" fontWeight={700} sx={{ color, my: 0.5 }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function getInitials(name?: string) {
  if (!name) return 'P';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ['#7B1FA2', '#1565C0', '#00897B', '#E53935', '#FB8C00'];

function exportCSV(rows: HistoryEntry[], profileName?: string) {
  const headers = ['Domain', 'Action', 'Category', 'Timestamp', 'Device IP'];
  const data = rows.map(r => [r.domain, r.action, r.category ?? '', r.timestamp, r.deviceIp ?? '']);
  const csv = [headers, ...data].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `url-activity-${profileName ?? 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function AdminUrlActivityPage() {
  const [selectedTenant, setSelectedTenant] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedProfile, setSelectedProfile] = useState('');
  const [tab, setTab] = useState<'ALL' | 'BLOCKED' | 'ALLOWED'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Platform overview
  const { data: platformOverview } = useQuery<PlatformOverview>({
    queryKey: ['admin-platform-overview'],
    queryFn: () => api.get('/analytics/platform/overview').then(r => r.data?.data ?? r.data).catch(() => null),
  });

  // Tenants list
  const { data: tenantsData } = useQuery({
    queryKey: ['admin-tenants-activity'],
    queryFn: () => api.get('/tenants?size=100').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as Tenant[];
    }).catch(() => []),
  });
  const tenants: Tenant[] = tenantsData ?? [];

  // Customers for selected tenant
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['admin-customers-activity', selectedTenant],
    enabled: !!selectedTenant,
    queryFn: () => api.get('/profiles/customers', { params: { tenantId: selectedTenant, size: 200 } }).then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as Customer[];
    }).catch(() => []),
  });

  // Child profiles for selected customer
  const { data: profiles } = useQuery<ChildProfile[]>({
    queryKey: ['admin-children-activity', selectedCustomer],
    enabled: !!selectedCustomer,
    queryFn: () => api.get(`/profiles/customers/${selectedCustomer}/children`).then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as ChildProfile[];
    }).catch(() => []),
  });

  // Profile stats
  const { data: profileStats } = useQuery<ProfileStats>({
    queryKey: ['admin-profile-stats-activity', selectedProfile],
    enabled: !!selectedProfile,
    queryFn: () => api.get(`/analytics/${selectedProfile}/stats`, { params: { period: 'month' } }).then(r => r.data?.data ?? r.data).catch(() => null),
  });

  // DNS Query history — server-side pagination
  const historyQuery = useQuery<{ content: HistoryEntry[]; totalElements: number }>({
    queryKey: ['admin-profile-history', selectedProfile, page, rowsPerPage, tab],
    enabled: !!selectedProfile,
    queryFn: () => {
      const params: Record<string, string | number> = { page, size: rowsPerPage };
      if (tab !== 'ALL') params.action = tab;
      return api.get(`/analytics/${selectedProfile}/history`, { params }).then(r => {
        const raw = r.data?.data ?? r.data;
        const content = raw?.content ?? (Array.isArray(raw) ? raw : []);
        const totalElements = raw?.totalElements ?? 0;
        return { content, totalElements };
      }).catch(() => ({ content: [], totalElements: 0 }));
    },
  });

  const { data: blockedTotal = 0 } = useQuery<number>({
    queryKey: ['admin-profile-blocked-total', selectedProfile],
    enabled: !!selectedProfile,
    queryFn: () => api.get(`/analytics/${selectedProfile}/history`, { params: { page: 0, size: 1, action: 'BLOCKED' } })
      .then(r => { const raw = r.data?.data ?? r.data; return raw?.totalElements ?? 0; }).catch(() => 0),
    staleTime: 30000,
  });

  const { data: allowedTotal = 0 } = useQuery<number>({
    queryKey: ['admin-profile-allowed-total', selectedProfile],
    enabled: !!selectedProfile,
    queryFn: () => api.get(`/analytics/${selectedProfile}/history`, { params: { page: 0, size: 1, action: 'ALLOWED' } })
      .then(r => { const raw = r.data?.data ?? r.data; return raw?.totalElements ?? 0; }).catch(() => 0),
    staleTime: 30000,
  });

  // Reset child selectors on parent change
  useEffect(() => { setSelectedCustomer(''); setSelectedProfile(''); setPage(0); }, [selectedTenant]);
  useEffect(() => { setSelectedProfile(''); setPage(0); }, [selectedCustomer]);
  useEffect(() => { setPage(0); }, [tab, search]);

  // Reset page when profile or tab changes
  useEffect(() => { setPage(0); }, [selectedProfile, selectedTenant, tab]);

  const rawContent = historyQuery.data?.content ?? [];
  const totalElements = historyQuery.data?.totalElements ?? 0;

  // Client-side search/tab filter applied on the current page's content
  const filteredHistory = rawContent.filter(h =>
    (tab === 'ALL' || h.action === tab) &&
    (!search.trim() || h.domain.toLowerCase().includes(search.trim().toLowerCase()) ||
      (h.category ?? '').toLowerCase().includes(search.trim().toLowerCase()))
  );

  const selectedProfileObj = profiles?.find(p => p.id === selectedProfile);
  const selectedCustomerObj = customers?.find(c => c.id === selectedCustomer);
  const selectedTenantObj = tenants.find(t => t.id === selectedTenant);

  const blockedCount = rawContent.filter(h => h.action === 'BLOCKED').length;
  const allowedCount = rawContent.filter(h => h.action === 'ALLOWED').length;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<TimelineIcon />}
        title="URL Activity"
        subtitle="Platform-wide DNS query history — drill down by tenant, customer, and child"
        iconColor="#7B1FA2"
        action={
          selectedProfile && filteredHistory.length > 0 ? (
            <Button variant="outlined" startIcon={<DownloadIcon />}
              onClick={() => exportCSV(filteredHistory, selectedProfileObj?.name)}
              sx={{ borderColor: '#7B1FA2', color: '#7B1FA2', '&:hover': { bgcolor: '#F3E5F5' } }}>
              Export CSV
            </Button>
          ) : undefined
        }
      />

      {/* Platform Overview Cards */}
      {platformOverview && (
        <AnimatedPage delay={0.05}>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Total Queries" value={(platformOverview.totalQueries ?? 0).toLocaleString()} color="#1565C0" sub="Platform-wide" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Blocked" value={(platformOverview.totalBlocked ?? 0).toLocaleString()} color="#E53935" sub="Blocked requests" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Block Rate" value={`${((platformOverview.blockRate ?? 0) * 100).toFixed(1)}%`} color="#F57F17" sub="Of all queries" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Active Profiles" value={platformOverview.activeProfiles ?? 0} color="#00897B" sub="Child profiles" />
            </Grid>
          </Grid>
        </AnimatedPage>
      )}

      {/* Filters Panel */}
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography fontWeight={700} fontSize={14} sx={{ mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Filter by Hierarchy
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>ISP / Tenant</InputLabel>
                <Select value={selectedTenant} label="ISP / Tenant" onChange={e => setSelectedTenant(e.target.value)}>
                  <MenuItem value=""><em>— All Tenants —</em></MenuItem>
                  {tenants.map(t => (
                    <MenuItem key={t.id} value={t.id}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <BusinessIcon sx={{ fontSize: 14, color: '#64748B' }} />
                        <span>{t.name}</span>
                        {t.plan && <Chip size="small" label={t.plan} sx={{ height: 18, fontSize: 10 }} />}
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 200 }} disabled={!selectedTenant}>
                <InputLabel>Customer</InputLabel>
                <Select value={selectedCustomer} label="Customer" onChange={e => setSelectedCustomer(e.target.value)}>
                  <MenuItem value=""><em>— All Customers —</em></MenuItem>
                  {(customers ?? []).map(c => (
                    <MenuItem key={c.id} value={c.id}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PeopleIcon sx={{ fontSize: 14, color: '#64748B' }} />
                        <span>{c.name || c.email || `User ${(c.userId ?? c.id).slice(0, 8)}…`}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 180 }} disabled={!selectedCustomer}>
                <InputLabel>Child Profile</InputLabel>
                <Select value={selectedProfile} label="Child Profile" onChange={e => setSelectedProfile(e.target.value)}>
                  <MenuItem value=""><em>— Select Profile —</em></MenuItem>
                  {(profiles ?? []).map((p, i) => (
                    <MenuItem key={p.id} value={p.id}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ width: 18, height: 18, fontSize: 9, bgcolor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                          {getInitials(p.name)}
                        </Avatar>
                        <span>{p.name ?? `Profile ${i + 1}`}{p.age ? ` (age ${p.age})` : ''}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedTenant && (
                <Button size="small" onClick={() => { setSelectedTenant(''); setSelectedCustomer(''); setSelectedProfile(''); }}
                  sx={{ color: 'text.secondary', fontSize: 12 }}>
                  Clear filters
                </Button>
              )}
            </Stack>

            {/* Breadcrumb */}
            {(selectedTenant || selectedCustomer || selectedProfile) && (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary">Viewing:</Typography>
                {selectedTenantObj && <Chip size="small" icon={<BusinessIcon sx={{ fontSize: 12 }} />} label={selectedTenantObj.name} sx={{ height: 22, fontSize: 11 }} />}
                {selectedCustomerObj && <><Typography variant="caption" color="text.secondary">›</Typography><Chip size="small" icon={<PeopleIcon sx={{ fontSize: 12 }} />} label={selectedCustomerObj.name || selectedCustomerObj.email || 'Customer'} sx={{ height: 22, fontSize: 11 }} /></>}
                {selectedProfileObj && <><Typography variant="caption" color="text.secondary">›</Typography><Chip size="small" icon={<ChildCareIcon sx={{ fontSize: 12 }} />} label={selectedProfileObj.name ?? 'Profile'} sx={{ height: 22, fontSize: 11, bgcolor: '#EDE7F6', color: '#4527A0' }} /></>}
              </Stack>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* No profile selected */}
      {!selectedProfile && (
        <EmptyState
          icon={<TimelineIcon sx={{ fontSize: 36, color: '#7B1FA2' }} />}
          title="Select a child profile to view URL activity"
          description="Use the filters above — select an ISP tenant, then a customer, then a child profile"
        />
      )}

      {/* Profile selected — stats + history */}
      {selectedProfile && (
        <AnimatedPage delay={0.15}>
          {/* Profile header card */}
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ py: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: '#7B1FA2', fontWeight: 700 }}>{getInitials(selectedProfileObj?.name)}</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={700}>{selectedProfileObj?.name ?? 'Child Profile'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedTenantObj?.name} › {selectedCustomerObj?.name || selectedCustomerObj?.email || 'Customer'}
                    {selectedProfileObj?.filterLevel && ` · Filter: ${selectedProfileObj.filterLevel}`}
                    {selectedProfileObj?.dnsClientId && ` · ${selectedProfileObj.dnsClientId}`}
                  </Typography>
                </Box>
                {profileStats && (
                  <Stack direction="row" spacing={2}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography fontWeight={700} color="#1565C0">{(profileStats.totalQueries ?? 0).toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">Total</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography fontWeight={700} color="#E53935">{(profileStats.blockedQueries ?? profileStats.totalBlocked ?? 0).toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">Blocked</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography fontWeight={700} color="#D97706">{((profileStats.blockRate ?? 0) * 100).toFixed(1)}%</Typography>
                      <Typography variant="caption" color="text.secondary">Block Rate</Typography>
                    </Box>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Filter tabs + search */}
          <Card>
            <CardContent sx={{ pb: '0 !important' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 0 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ flex: 1 }}>
                  <Tab label={`All (${totalElements.toLocaleString()})`} value="ALL" />
                  <Tab label={`Blocked (${blockedTotal.toLocaleString()})`} value="BLOCKED"
                    sx={{ '&.Mui-selected': { color: '#E53935' } }} />
                  <Tab label={`Allowed (${allowedTotal.toLocaleString()})`} value="ALLOWED"
                    sx={{ '&.Mui-selected': { color: '#2E7D32' } }} />
                </Tabs>
                <TextField size="small" placeholder="Search domain or category…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
                  sx={{ minWidth: 220 }} />
              </Stack>
            </CardContent>

            {/* Fetching progress indicator */}
            <Box sx={{ height: 3 }}>
              {historyQuery.isFetching && (
                <LinearProgress sx={{ height: 3 }} />
              )}
            </Box>

            {historyQuery.isLoading ? (
              <LoadingPage />
            ) : filteredHistory.length === 0 ? (
              <Box sx={{ py: 4 }}>
                <Alert severity="info" sx={{ borderRadius: 0 }}>No URL activity found for the selected filters.</Alert>
              </Box>
            ) : (
              <>
                <Paper elevation={0} sx={{ overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                        {['Domain', 'Action', 'Category', 'Time', 'Device IP'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 600, color: '#64748B', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredHistory.map((h, idx) => (
                        <TableRow key={h.id || idx} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{h.domain}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small"
                              icon={h.action === 'BLOCKED' ? <BlockIcon sx={{ fontSize: 11 }} /> : <CheckCircleIcon sx={{ fontSize: 11 }} />}
                              label={h.action}
                              sx={{
                                height: 20, fontSize: 10, fontWeight: 700,
                                bgcolor: h.action === 'BLOCKED' ? '#FFEBEE' : '#E8F5E9',
                                color: h.action === 'BLOCKED' ? '#B71C1C' : '#1B5E20',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {h.category && (
                              <Chip size="small" label={h.category.replace(/_/g, ' ')}
                                sx={{ height: 20, fontSize: 10, bgcolor: '#EDE7F6', color: '#4527A0' }} />
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(h.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {h.deviceIp && <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{h.deviceIp}</Typography>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
                <TablePagination
                  component="div"
                  count={totalElements}
                  page={page}
                  onPageChange={(_, p) => setPage(p)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                  rowsPerPageOptions={[25, 50, 100]}
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count.toLocaleString()} entries`}
                />
              </>
            )}
          </Card>
        </AnimatedPage>
      )}
    </AnimatedPage>
  );
}
