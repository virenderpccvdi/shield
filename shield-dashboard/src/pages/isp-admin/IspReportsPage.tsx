import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, CircularProgress,
  Stack, Avatar, Button, Tab, Tabs, Table, TableHead, TableRow, TableCell,
  TableBody, Paper, Select, MenuItem, FormControl, InputLabel, Alert,
  LinearProgress, Tooltip, IconButton, Divider,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PeopleIcon from '@mui/icons-material/People';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DnsIcon from '@mui/icons-material/Dns';
import DownloadIcon from '@mui/icons-material/Download';
import TableChartIcon from '@mui/icons-material/TableChart';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { alpha, useTheme } from '@mui/material/styles';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

interface Customer { id: string; userId?: string; subscriptionPlan?: string; profileCount?: number; }
interface ChildProfile { id: string; name?: string; age?: number; filterLevel?: string; dnsClientId?: string; }
interface TenantOverview { totalQueries: number; totalBlocked: number; blockRate: number; activeProfiles: number; topDomain?: string; }
interface ProfileStats { totalQueries: number; totalBlocked: number; totalAllowed: number; blockRate: number; uniqueDomains: number; }
interface TopDomain { domain: string; count: number; action?: string; }
interface CategoryStat { category: string; count: number; blocked?: number; }
interface HistoryEntry { id: string; domain: string; action: string; category?: string; timestamp: string; deviceIp?: string; }
interface SocialAlert { id: string; profileId: string; alertType: string; message: string; severity?: string; createdAt: string; }
interface DailyStats { date: string; queries: number; blocked: number; }

const PIE_COLORS = ['#E53935', '#1565C0', '#7B1FA2', '#F57F17', '#00897B', '#F44336', '#9C27B0', '#2196F3', '#4CAF50', '#FF9800'];


function exportCustomerSummary(customers: Customer[], profiles: Record<string, ChildProfile[]>, tenantOverview: TenantOverview | undefined) {
  const headers = ['Customer ID', 'Plan', 'Child Profiles', 'Total Queries (Tenant)', 'Block Rate (Tenant)', 'Export Date'];
  const rows = (customers ?? []).map(c => [
    c.id?.slice(0, 8) ?? '',
    c.subscriptionPlan ?? '',
    (profiles[c.id] ?? []).length,
    tenantOverview?.totalQueries ?? '',
    tenantOverview ? `${((tenantOverview.blockRate ?? 0) * 100).toFixed(1)}%` : '',
    new Date().toLocaleDateString('en-IN'),
  ]);
  const csvContent = [headers, ...rows].map(r =>
    r.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `customer-summary-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

function exportChildSummary(customers: Customer[], allProfiles: Record<string, ChildProfile[]>) {
  const headers = ['Customer ID', 'Profile ID', 'Child Name', 'Age', 'Filter Level', 'DNS Client ID', 'Export Date'];
  const rows: (string | number | undefined)[][] = [];
  (customers ?? []).forEach(c => {
    (allProfiles[c.id] ?? []).forEach(p => {
      rows.push([
        c.id?.slice(0, 8) ?? '',
        p.id?.slice(0, 8) ?? '',
        p.name ?? '',
        p.age ?? '',
        p.filterLevel ?? '',
        p.dnsClientId ?? '',
        new Date().toLocaleDateString('en-IN'),
      ]);
    });
  });
  const csvContent = [headers, ...rows].map(r =>
    r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `child-summary-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

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

// Decorative avatar rotation palette (hex required for dynamic sx bgcolor)
const AVATAR_COLORS = ['#00897B', '#1565C0', '#7B1FA2', '#E53935', '#FB8C00'];

export default function IspReportsPage() {
  const theme = useTheme();
  const user = useAuthStore(s => s.user);
  const tenantId = (user as any)?.tenant_id ?? (user as any)?.tenantId;

  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [tab, setTab] = useState(0);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [allProfilesMap, setAllProfilesMap] = useState<Record<string, ChildProfile[]>>({});

  // Tenant overview
  const { data: tenantOverview, isLoading: loadingOverview } = useQuery<TenantOverview>({
    queryKey: ['isp-tenant-overview', tenantId],
    enabled: !!tenantId,
    queryFn: () => api.get(`/analytics/tenant/${tenantId}/overview`).then(r => r.data?.data ?? r.data),
  });

  // Tenant daily trend
  const { data: tenantDaily } = useQuery<DailyStats[]>({
    queryKey: ['isp-tenant-daily', tenantId],
    enabled: !!tenantId,
    queryFn: () => api.get(`/analytics/tenant/${tenantId}/daily`).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }),
  });

  // Tenant social alerts
  const { data: tenantAlerts } = useQuery<SocialAlert[]>({
    queryKey: ['isp-tenant-alerts', tenantId],
    enabled: !!tenantId,
    queryFn: () => api.get(`/analytics/tenant/${tenantId}/social-alerts`).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
  });

  // Customers list
  const { data: customers, isLoading: loadingCustomers } = useQuery<Customer[]>({
    queryKey: ['isp-customers-reports'],
    queryFn: () => api.get('/profiles/customers').then(r => {
      const d = r.data?.data;
      return (Array.isArray(d) ? d : d?.content ?? []) as Customer[];
    }).catch(() => []),
  });

  // Child profiles for selected customer
  const { data: profiles } = useQuery<ChildProfile[]>({
    queryKey: ['isp-customer-children-reports', selectedCustomer],
    enabled: !!selectedCustomer,
    queryFn: () => api.get(`/profiles/customers/${selectedCustomer}/children`).then(r => {
      const d = r.data?.data;
      return (Array.isArray(d) ? d : d?.content ?? []) as ChildProfile[];
    }).catch(() => []),
  });

  // Auto-select first profile when customer changes
  useEffect(() => {
    setSelectedProfile('');
    setTab(0);
  }, [selectedCustomer]);

  // Populate profiles map for all customers (for export)
  useEffect(() => {
    if (!customers?.length) return;
    Promise.allSettled(
      customers.map(c => api.get(`/profiles/customers/${c.id}/children`).then(r => {
        const d = r.data?.data;
        return { id: c.id, profiles: (Array.isArray(d) ? d : d?.content ?? []) as ChildProfile[] };
      }))
    ).then(results => {
      const map: Record<string, ChildProfile[]> = {};
      results.forEach(r => { if (r.status === 'fulfilled') map[r.value.id] = r.value.profiles; });
      setAllProfilesMap(map);
    });
  }, [customers]);

  useEffect(() => {
    if (profiles?.length && !selectedProfile) {
      setSelectedProfile(profiles[0].id);
    }
  }, [profiles]);

  // Per-profile stats
  const { data: profileStats, isLoading: loadingStats } = useQuery<ProfileStats>({
    queryKey: ['isp-profile-stats', selectedProfile, period],
    enabled: !!selectedProfile,
    queryFn: () => api.get(`/analytics/${selectedProfile}/stats`, { params: { period } }).then(r => r.data?.data ?? r.data),
  });

  // Top blocked domains
  const { data: topDomains } = useQuery<TopDomain[]>({
    queryKey: ['isp-profile-top-domains', selectedProfile, period],
    enabled: !!selectedProfile,
    queryFn: () => api.get(`/analytics/${selectedProfile}/top-domains`, {
      params: { action: 'BLOCKED', limit: 15, period },
    }).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
  });

  // Category breakdown
  const { data: categories } = useQuery<CategoryStat[]>({
    queryKey: ['isp-profile-categories', selectedProfile, period],
    enabled: !!selectedProfile,
    queryFn: () => api.get(`/analytics/${selectedProfile}/categories`, { params: { period } }).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
  });

  // DNS query history
  const { data: history } = useQuery<HistoryEntry[]>({
    queryKey: ['isp-profile-history', selectedProfile],
    enabled: !!selectedProfile && tab === 3,
    queryFn: () => api.get(`/analytics/${selectedProfile}/history`, { params: { page: 0, size: 50 } }).then(r => {
      const d = r.data?.data?.content ?? r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
  });

  // Profile social alerts
  const { data: profileAlerts } = useQuery<SocialAlert[]>({
    queryKey: ['isp-profile-alerts', selectedProfile],
    enabled: !!selectedProfile && tab === 4,
    queryFn: () => api.get(`/analytics/${selectedProfile}/social-alerts`).then(r => {
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    }).catch(() => []),
  });

  const selectedProfileObj = profiles?.find(p => p.id === selectedProfile);
  const selectedCustomerObj = customers?.find(c => c.id === selectedCustomer);

  const openPdfReport = () => {
    if (!selectedProfile) return;
    window.open(`/api/v1/analytics/${selectedProfile}/report/pdf`, '_blank');
  };

  const dailyChartData = (tenantDaily ?? []).slice(-14).map(d => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    queries: d.queries,
    blocked: d.blocked,
  }));

  const categoryChartData = (categories ?? []).slice(0, 8).map(c => ({
    name: c.category?.replace(/_/g, ' ') ?? 'Unknown',
    value: c.blocked ?? c.count,
  }));

  const alertSeverityColor = (s?: string) => {
    if (s === 'HIGH') return theme.palette.error.main;
    if (s === 'MEDIUM') return theme.palette.warning.main;
    return theme.palette.primary.main;
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<AssessmentIcon />}
        title="Reports & Analytics"
        subtitle="Deep content filtering reports across all your customers"
        iconColor="#7B1FA2"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Tooltip title="Export all customers summary as CSV">
              <Button variant="outlined" size="small" startIcon={<TableChartIcon />}
                onClick={() => exportCustomerSummary(customers ?? [], allProfilesMap, tenantOverview)}
                disabled={!customers?.length}
                sx={{ borderRadius: 2, borderColor: '#7B1FA2', color: '#7B1FA2', '&:hover': { bgcolor: '#F3E5F5' } }}>
                Customer CSV
              </Button>
            </Tooltip>
            <Tooltip title="Export all child profiles summary as CSV">
              <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
                onClick={() => exportChildSummary(customers ?? [], allProfilesMap)}
                disabled={!customers?.length || Object.keys(allProfilesMap).length === 0}
                sx={{ borderRadius: 2, borderColor: 'primary.main', color: 'primary.main', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                Child CSV
              </Button>
            </Tooltip>
          </Stack>
        }
      />

      {/* Tenant Overview Cards */}
      {loadingOverview ? (
        <LoadingPage />
      ) : tenantOverview ? (
        <AnimatedPage delay={0.1}>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Total Queries" value={(tenantOverview.totalQueries ?? 0).toLocaleString()} color="primary.main" sub="Platform-wide" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Blocked" value={(tenantOverview.totalBlocked ?? 0).toLocaleString()} color="error.main" sub="Blocked requests" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Block Rate" value={`${((tenantOverview.blockRate ?? 0) * 100).toFixed(1)}%`} color="warning.main" sub="Of all queries" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Active Profiles" value={tenantOverview.activeProfiles ?? 0} color="#00897B" sub="Child profiles" />
            </Grid>
          </Grid>
        </AnimatedPage>
      ) : null}

      {/* Tenant Daily Trend */}
      {dailyChartData.length > 0 && (
        <AnimatedPage delay={0.15}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography fontWeight={700} fontSize={15} sx={{ mb: 2 }}>14-Day Query Trend</Typography>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyChartData} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="queries" name="Total" fill="#93C5FD" radius={[2,2,0,0]} />
                  <Bar dataKey="blocked" name="Blocked" fill="#FCA5A5" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* Tenant-level social alerts */}
      {(tenantAlerts ?? []).length > 0 && (
        <AnimatedPage delay={0.2}>
          <Card sx={{ mb: 3, border: '1px solid #FFECB3' }}>
            <CardContent sx={{ pb: '12px !important' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                <Typography fontWeight={700} fontSize={15}>Recent Alerts Across Your Customers</Typography>
                <Chip size="small" label={tenantAlerts!.length} sx={{ bgcolor: 'warning.light', color: 'warning.main', fontWeight: 700, height: 20 }} />
              </Stack>
              <Stack spacing={1}>
                {(tenantAlerts ?? []).slice(0, 5).map(a => (
                  <Box key={a.id} sx={{ p: 1.5, bgcolor: '#FFFBEB', borderRadius: 1.5, borderLeft: `3px solid ${alertSeverityColor(a.severity)}` }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={a.alertType?.replace(/_/g, ' ')} sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: '#FEF3C7', color: '#92400E' }} />
                      <Typography variant="body2" sx={{ flex: 1 }}>{a.message}</Typography>
                      <Typography variant="caption" color="text.secondary">{new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* Per-Profile Deep Report */}
      <AnimatedPage delay={0.25}>
        <Card>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems={{ sm: 'center' }}>
              <Typography fontWeight={700} fontSize={15} sx={{ flexShrink: 0 }}>Profile Deep Report</Typography>
              <Box sx={{ flex: 1 }} />

              {/* Customer selector */}
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Select Customer</InputLabel>
                <Select
                  value={selectedCustomer}
                  label="Select Customer"
                  onChange={e => setSelectedCustomer(e.target.value)}
                >
                  <MenuItem value=""><em>— Choose customer —</em></MenuItem>
                  {loadingCustomers ? (
                    <MenuItem disabled><CircularProgress size={14} sx={{ mr: 1 }} /> Loading...</MenuItem>
                  ) : (customers ?? []).map(c => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.userId ? `User ${c.userId.slice(0, 8)}…` : `Customer`}
                      {c.subscriptionPlan && ` (${c.subscriptionPlan})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Profile selector */}
              {selectedCustomer && (
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Child Profile</InputLabel>
                  <Select
                    value={selectedProfile}
                    label="Child Profile"
                    onChange={e => setSelectedProfile(e.target.value)}
                  >
                    {(profiles ?? []).length === 0 && (
                      <MenuItem disabled>No profiles found</MenuItem>
                    )}
                    {(profiles ?? []).map((p, i) => (
                      <MenuItem key={p.id} value={p.id}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                            {getInitials(p.name)}
                          </Avatar>
                          <span>{p.name ?? `Profile ${i + 1}`}{p.age ? ` (${p.age})` : ''}</span>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Period selector */}
              {selectedProfile && (
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Period</InputLabel>
                  <Select value={period} label="Period" onChange={e => setPeriod(e.target.value as any)}>
                    <MenuItem value="today">Today</MenuItem>
                    <MenuItem value="week">This Week</MenuItem>
                    <MenuItem value="month">This Month</MenuItem>
                  </Select>
                </FormControl>
              )}

              {selectedProfile && (
                <Tooltip title="Open printable PDF report in new tab">
                  <Button variant="outlined" size="small" startIcon={<OpenInNewIcon />} onClick={openPdfReport}
                    sx={{ whiteSpace: 'nowrap', borderColor: '#7B1FA2', color: '#7B1FA2', '&:hover': { bgcolor: alpha('#7B1FA2', 0.08) } }}>
                    PDF Report
                  </Button>
                </Tooltip>
              )}
            </Stack>

            {!selectedCustomer && (
              <EmptyState
                icon={<PeopleIcon sx={{ fontSize: 36, color: 'secondary.main' }} />}
                title="Select a customer"
                description="Choose a customer above to view detailed content filtering reports for their child profiles"
              />
            )}

            {selectedCustomer && !selectedProfile && (
              <EmptyState
                icon={<DnsIcon sx={{ fontSize: 36, color: 'secondary.main' }} />}
                title="No child profiles"
                description="This customer has no child profiles yet"
              />
            )}

            {selectedProfile && (
              <>
                {/* Profile header */}
                <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, mb: 2 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: AVATAR_COLORS[0], fontWeight: 700 }}>{getInitials(selectedProfileObj?.name)}</Avatar>
                    <Box>
                      <Typography fontWeight={700}>{selectedProfileObj?.name ?? 'Child Profile'}</Typography>
                      {selectedProfileObj?.age && <Typography variant="caption" color="text.secondary">Age {selectedProfileObj.age}</Typography>}
                    </Box>
                    {selectedProfileObj?.filterLevel && (
                      <Chip size="small" label={selectedProfileObj.filterLevel}
                        sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: '#EDE7F6', color: '#4527A0' }} />
                    )}
                    {selectedProfileObj?.dnsClientId && (
                      <Chip size="small" icon={<DnsIcon sx={{ fontSize: 12 }} />}
                        label={selectedProfileObj.dnsClientId}
                        sx={{ height: 22, fontSize: 10, fontFamily: 'monospace', bgcolor: alpha(theme.palette.primary.main, 0.08), color: 'primary.main', fontWeight: 600 }} />
                    )}
                  </Stack>
                </Box>

                {/* Stats row */}
                {loadingStats ? (
                  <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={28} /></Box>
                ) : profileStats && (
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.08), borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={700} color="primary.main">{(profileStats.totalQueries ?? 0).toLocaleString()}</Typography>
                        <Typography variant="caption" color="text.secondary">Total Queries</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.08), borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={700} color="error.main">{(profileStats.totalBlocked ?? 0).toLocaleString()}</Typography>
                        <Typography variant="caption" color="text.secondary">Blocked</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={700} color="success.main">{(profileStats.totalAllowed ?? 0).toLocaleString()}</Typography>
                        <Typography variant="caption" color="text.secondary">Allowed</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.08), borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight={700} color="warning.main">{((profileStats.blockRate ?? 0) * 100).toFixed(1)}%</Typography>
                        <Typography variant="caption" color="text.secondary">Block Rate</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                )}

                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}
                  variant="scrollable" scrollButtons="auto">
                  <Tab label="Top Blocked Domains" />
                  <Tab label="Categories" />
                  <Tab label="Query History" />
                  <Tab label="Social Alerts" />
                </Tabs>

                {/* Tab 0: Top Blocked Domains */}
                {tab === 0 && (
                  <Box>
                    {(topDomains ?? []).length === 0 ? (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>No blocked domains found for this period.</Alert>
                    ) : (
                      <>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                          Top {topDomains!.length} most blocked domains
                        </Typography>
                        <Stack spacing={1}>
                          {topDomains!.map((d, i) => {
                            const max = topDomains![0]?.count ?? 1;
                            return (
                              <Box key={d.domain} sx={{ p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.06), borderRadius: 1.5 }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                                  <Chip size="small" label={i + 1} sx={{ minWidth: 26, height: 20, fontSize: 11, fontWeight: 700, bgcolor: 'error.main', color: 'white' }} />
                                  <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', flex: 1 }}>{d.domain}</Typography>
                                  <Chip size="small" icon={<BlockIcon sx={{ fontSize: 12 }} />} label={d.count}
                                    sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: alpha(theme.palette.error.main, 0.12), color: 'error.dark' }} />
                                </Stack>
                                <LinearProgress variant="determinate" value={(d.count / max) * 100}
                                  sx={{ height: 4, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.15), '& .MuiLinearProgress-bar': { bgcolor: 'error.main' } }} />
                              </Box>
                            );
                          })}
                        </Stack>
                      </>
                    )}
                  </Box>
                )}

                {/* Tab 1: Categories */}
                {tab === 1 && (
                  <Box>
                    {(categories ?? []).length === 0 ? (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>No category data for this period.</Alert>
                    ) : (
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                              <Pie data={categoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                {categoryChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                              </Pie>
                              <RTooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Stack spacing={1}>
                            {(categories ?? []).slice(0, 10).map((c, i) => {
                              const max = categories![0]?.count ?? 1;
                              return (
                                <Box key={c.category}>
                                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                                    <Typography variant="caption" fontWeight={600}>{c.category?.replace(/_/g, ' ')}</Typography>
                                    <Typography variant="caption" color="text.secondary">{c.blocked ?? c.count}</Typography>
                                  </Stack>
                                  <LinearProgress variant="determinate"
                                    value={((c.blocked ?? c.count) / max) * 100}
                                    sx={{ height: 5, borderRadius: 3, bgcolor: '#F1F5F9', '& .MuiLinearProgress-bar': { bgcolor: PIE_COLORS[i % PIE_COLORS.length] } }} />
                                </Box>
                              );
                            })}
                          </Stack>
                        </Grid>
                      </Grid>
                    )}
                  </Box>
                )}

                {/* Tab 2: Query History */}
                {tab === 2 && (
                  <Box>
                    {(history ?? []).length === 0 ? (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>No query history available.</Alert>
                    ) : (
                      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                              {['Domain', 'Action', 'Category', 'Time'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 600, color: '#64748B', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(history ?? []).map(h => (
                              <TableRow key={h.id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{h.domain}</Typography>
                                  {h.deviceIp && <Typography variant="caption" color="text.secondary">{h.deviceIp}</Typography>}
                                </TableCell>
                                <TableCell>
                                  <Chip size="small"
                                    icon={h.action === 'BLOCKED' ? <BlockIcon sx={{ fontSize: 11 }} /> : <CheckCircleIcon sx={{ fontSize: 11 }} />}
                                    label={h.action}
                                    sx={{
                                      height: 20, fontSize: 10, fontWeight: 700,
                                      bgcolor: h.action === 'BLOCKED' ? alpha(theme.palette.error.main, 0.12) : alpha(theme.palette.success.main, 0.12),
                                      color: h.action === 'BLOCKED' ? 'error.dark' : 'success.dark',
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
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Paper>
                    )}
                  </Box>
                )}

                {/* Tab 3: Social Alerts */}
                {tab === 3 && (
                  <Box>
                    {(profileAlerts ?? []).length === 0 ? (
                      <Alert severity="success" sx={{ borderRadius: 2 }}>No social monitoring alerts for this profile.</Alert>
                    ) : (
                      <Stack spacing={1.5}>
                        {(profileAlerts ?? []).map(a => (
                          <Box key={a.id} sx={{
                            p: 2, borderRadius: 2,
                            border: `1px solid ${alertSeverityColor(a.severity)}30`,
                            bgcolor: a.severity === 'HIGH' ? '#FEF2F2' : a.severity === 'MEDIUM' ? '#FFFBEB' : '#EFF6FF',
                          }}>
                            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                              <WarningAmberIcon sx={{ color: alertSeverityColor(a.severity), fontSize: 20, mt: 0.25 }} />
                              <Box sx={{ flex: 1 }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                  <Chip size="small" label={a.alertType?.replace(/_/g, ' ')}
                                    sx={{ height: 20, fontSize: 10, fontWeight: 700,
                                      bgcolor: alertSeverityColor(a.severity) + '20',
                                      color: alertSeverityColor(a.severity) }} />
                                  {a.severity && (
                                    <Chip size="small" label={a.severity}
                                      sx={{ height: 20, fontSize: 10, fontWeight: 600,
                                        bgcolor: a.severity === 'HIGH' ? 'error.main' : a.severity === 'MEDIUM' ? 'warning.main' : 'primary.main',
                                        color: 'white' }} />
                                  )}
                                </Stack>
                                <Typography variant="body2">{a.message}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(a.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                              </Box>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>
    </AnimatedPage>
  );
}
