import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, CircularProgress,
  Stack, Avatar, Table, TableHead, TableRow, TableCell, TableBody,
  Paper, Select, MenuItem, FormControl, InputLabel, Alert,
  Button, Tabs, Tab, TextField, InputAdornment, TablePagination, LinearProgress,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import PeopleIcon from '@mui/icons-material/People';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface Customer { id: string; userId?: string; name?: string; email?: string; }
interface ChildProfile { id: string; name?: string; age?: number; filterLevel?: string; dnsClientId?: string; }
interface HistoryEntry { id: string; domain: string; action: string; category?: string; timestamp: string; deviceIp?: string; }
interface ProfileStats { totalQueries: number; totalBlocked: number; totalAllowed: number; blockRate: number; }
interface TenantOverview { totalQueries: number; totalBlocked: number; totalAllowed?: number; blockRate: number; activeProfiles: number; }

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

const AVATAR_COLORS = ['#00897B', '#1565C0', '#7B1FA2', '#E53935', '#FB8C00'];

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

export default function IspUrlActivityPage() {
  const user = useAuthStore(s => s.user);
  const tenantId = (user as any)?.tenant_id ?? (user as any)?.tenantId;

  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedProfile, setSelectedProfile] = useState('');
  const [tab, setTab] = useState<'ALL' | 'BLOCKED' | 'ALLOWED'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [days, setDays] = useState<7 | 14 | 30>(7);

  // Tenant overview — API uses period=week|month, not days
  const period = days <= 7 ? 'week' : 'month';
  const { data: overview } = useQuery<TenantOverview>({
    queryKey: ['isp-url-activity-overview', tenantId, days],
    enabled: !!tenantId,
    queryFn: () => api.get(`/analytics/tenant/${tenantId}/overview`, { params: { period } }).then(r => r.data?.data ?? r.data).catch(() => null),
  });

  // Customers list
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['isp-customers-url-activity'],
    queryFn: () => api.get('/profiles/customers').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as Customer[];
    }).catch(() => []),
  });

  // Child profiles for selected customer
  const { data: profiles } = useQuery<ChildProfile[]>({
    queryKey: ['isp-children-url-activity', selectedCustomer],
    enabled: !!selectedCustomer,
    queryFn: () => api.get(`/profiles/customers/${selectedCustomer}/children`).then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as ChildProfile[];
    }).catch(() => []),
  });

  // Profile stats
  const { data: profileStats } = useQuery<ProfileStats>({
    queryKey: ['isp-url-activity-profile-stats', selectedProfile],
    enabled: !!selectedProfile,
    queryFn: () => api.get(`/analytics/${selectedProfile}/stats`, { params: { period: 'month' } }).then(r => r.data?.data ?? r.data).catch(() => null),
  });

  // DNS Query history — server-side pagination
  const { data: historyResponse, isLoading: loadingHistory, isFetching: fetchingHistory } = useQuery({
    queryKey: ['isp-url-activity-history', selectedProfile, page, rowsPerPage, days],
    enabled: !!selectedProfile,
    queryFn: () => api.get(`/analytics/${selectedProfile}/history`, { params: { page, size: rowsPerPage } }).then(r => {
      // API returns plain Spring Page: {content:[...], totalElements:N}  (no extra 'data' wrapper)
      const totalElements: number = r.data?.data?.totalElements ?? r.data?.totalElements ?? 0;
      const d = r.data?.data?.content ?? r.data?.content ?? r.data?.data ?? r.data;
      return { content: (Array.isArray(d) ? d : []) as HistoryEntry[], totalElements };
    }).catch(() => ({ content: [] as HistoryEntry[], totalElements: 0 })),
  });

  // Auto-select first profile when customer changes
  useEffect(() => { setSelectedProfile(''); setPage(0); }, [selectedCustomer]);
  useEffect(() => { setPage(0); }, [tab, search]);
  useEffect(() => { setPage(0); }, [selectedProfile]);
  useEffect(() => {
    if (profiles?.length && !selectedProfile) setSelectedProfile(profiles[0].id);
  }, [profiles]);

  const allHistory = historyResponse?.content ?? [];
  const totalElements = historyResponse?.totalElements ?? 0;
  const filteredHistory = allHistory.filter(h =>
    (tab === 'ALL' || h.action === tab) &&
    (!search.trim() || h.domain.toLowerCase().includes(search.trim().toLowerCase()) ||
      (h.category ?? '').toLowerCase().includes(search.trim().toLowerCase()))
  );
  // Server returns the current page already — no client-side slice needed
  const pagedHistory = filteredHistory;

  const selectedProfileObj = profiles?.find(p => p.id === selectedProfile);
  const selectedCustomerObj = customers?.find(c => c.id === selectedCustomer);

  return (
    <AnimatedPage>
      <PageHeader
        icon={<TimelineIcon />}
        title="URL Activity"
        subtitle="DNS query history across all your customers' child profiles"
        iconColor="#00897B"
        action={
          selectedProfile && filteredHistory.length > 0 ? (
            <Button variant="outlined" startIcon={<DownloadIcon />}
              onClick={() => exportCSV(filteredHistory, selectedProfileObj?.name)}
              sx={{ borderColor: '#00897B', color: '#00897B', '&:hover': { bgcolor: '#E0F2F1' } }}>
              Export CSV
            </Button>
          ) : undefined
        }
      />

      {/* Tenant Overview KPI Row */}
      {overview && (
        <AnimatedPage delay={0.05}>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Total Queries" value={(overview.totalQueries ?? 0).toLocaleString()} color="#1565C0" sub="All customers" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Blocked" value={(overview.totalBlocked ?? 0).toLocaleString()} color="#E53935" sub="Blocked requests" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Allowed"
                value={(overview.totalAllowed ?? Math.max(0, (overview.totalQueries ?? 0) - (overview.totalBlocked ?? 0))).toLocaleString()}
                color="#2E7D32"
                sub="Allowed requests"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Block Rate" value={`${(overview.blockRate ?? 0).toFixed(1)}%`} color="#F57F17" sub="Of all queries" />
            </Grid>
          </Grid>
        </AnimatedPage>
      )}

      {/* Filter Panel */}
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography fontWeight={700} fontSize={14} sx={{ mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Select Profile
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Customer</InputLabel>
                <Select value={selectedCustomer} label="Customer" onChange={e => setSelectedCustomer(e.target.value)}>
                  <MenuItem value=""><em>— Select Customer —</em></MenuItem>
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

              <FormControl size="small" sx={{ minWidth: 200 }} disabled={!selectedCustomer}>
                <InputLabel>Child Profile</InputLabel>
                <Select value={selectedProfile} label="Child Profile" onChange={e => setSelectedProfile(e.target.value)}>
                  {(profiles ?? []).length === 0 && <MenuItem disabled>No profiles found</MenuItem>}
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

              {selectedCustomer && (
                <Button size="small" onClick={() => { setSelectedCustomer(''); setSelectedProfile(''); }}
                  sx={{ color: 'text.secondary', fontSize: 12 }}>
                  Clear
                </Button>
              )}
              <Box sx={{ ml: 'auto' }}>
                <ToggleButtonGroup
                  value={days}
                  exclusive
                  size="small"
                  onChange={(_, v) => { if (v) { setDays(v); setPage(0); } }}
                >
                  {([7, 14, 30] as const).map(d => (
                    <ToggleButton key={d} value={d} sx={{ px: 1.5, fontSize: 12, fontWeight: 600 }}>
                      {d}D
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            </Stack>

            {/* Breadcrumb */}
            {(selectedCustomer || selectedProfile) && (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary">Viewing:</Typography>
                {selectedCustomerObj && <Chip size="small" icon={<PeopleIcon sx={{ fontSize: 12 }} />} label={selectedCustomerObj.name || selectedCustomerObj.email || 'Customer'} sx={{ height: 22, fontSize: 11 }} />}
                {selectedProfileObj && <><Typography variant="caption" color="text.secondary">›</Typography><Chip size="small" icon={<ChildCareIcon sx={{ fontSize: 12 }} />} label={selectedProfileObj.name ?? 'Profile'} sx={{ height: 22, fontSize: 11, bgcolor: '#DCFCE7', color: '#14532D' }} /></>}
              </Stack>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* No profile selected */}
      {!selectedProfile && (
        <EmptyState
          icon={<TimelineIcon sx={{ fontSize: 36, color: '#00897B' }} />}
          title="Select a child profile to view URL activity"
          description="Choose a customer and child profile above to see their DNS browsing history"
        />
      )}

      {/* Profile history */}
      {selectedProfile && (
        <AnimatedPage delay={0.15}>
          {/* Profile summary */}
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ py: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: '#00897B', fontWeight: 700 }}>{getInitials(selectedProfileObj?.name)}</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={700}>{selectedProfileObj?.name ?? 'Child Profile'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedCustomerObj?.name || selectedCustomerObj?.email || 'Customer'}
                    {selectedProfileObj?.filterLevel && ` · ${selectedProfileObj.filterLevel} filter`}
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
                      <Typography fontWeight={700} color="#E53935">{(profileStats.totalBlocked ?? 0).toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">Blocked</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography fontWeight={700} color="#D97706">{(profileStats.blockRate ?? 0).toFixed(1)}%</Typography>
                      <Typography variant="caption" color="text.secondary">Block Rate</Typography>
                    </Box>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Tabs + search + table */}
          <Card>
            <CardContent sx={{ pb: '0 !important' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ flex: 1 }}>
                  <Tab label={`All (${totalElements})`} value="ALL" />
                  <Tab label={`Blocked (${allHistory.filter(h => h.action === 'BLOCKED').length})`} value="BLOCKED"
                    sx={{ '&.Mui-selected': { color: '#E53935' } }} />
                  <Tab label={`Allowed (${allHistory.filter(h => h.action === 'ALLOWED').length})`} value="ALLOWED"
                    sx={{ '&.Mui-selected': { color: '#2E7D32' } }} />
                </Tabs>
                <TextField size="small" placeholder="Search domain or category…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
                  sx={{ minWidth: 220 }} />
              </Stack>
            </CardContent>

            {loadingHistory ? (
              <LoadingPage />
            ) : filteredHistory.length === 0 ? (
              <Box sx={{ py: 4 }}>
                <Alert severity="info" sx={{ borderRadius: 0 }}>No URL activity found for the selected filters.</Alert>
              </Box>
            ) : (
              <>
                {fetchingHistory && <LinearProgress />}
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
                      {pagedHistory.map((h, idx) => (
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
                                sx={{ height: 20, fontSize: 10, bgcolor: '#DCFCE7', color: '#14532D' }} />
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
                  onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
                  rowsPerPageOptions={[20, 50, 100]}
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count} entries`}
                />
              </>
            )}
          </Card>
        </AnimatedPage>
      )}
    </AnimatedPage>
  );
}
