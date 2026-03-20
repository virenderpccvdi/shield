import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, CircularProgress,
  Stack, Avatar, Button, TextField, InputAdornment, Tooltip, Collapse,
  IconButton, Divider, LinearProgress, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import PhonelinkSetupIcon from '@mui/icons-material/PhonelinkSetup';
import PeopleIcon from '@mui/icons-material/People';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TuneIcon from '@mui/icons-material/Tune';
import DnsIcon from '@mui/icons-material/Dns';
import BusinessIcon from '@mui/icons-material/Business';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface Tenant { id: string; name: string; slug: string; plan: string; active: boolean; }
interface Customer { id: string; userId?: string; name?: string; email?: string; subscriptionPlan?: string; profileCount?: number; tenantId?: string; }
interface ChildProfile { id: string; name?: string; filterLevel?: string; dnsClientId?: string; }
interface DnsRules { profileId: string; enabledCategories?: Record<string, boolean>; customBlocklist?: string[]; customAllowlist?: string[]; }

const FILTER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  STRICT:   { bg: '#FFEBEE', text: '#C62828', label: 'Strict' },
  MODERATE: { bg: '#FFF8E1', text: '#F57F17', label: 'Moderate' },
  RELAXED:  { bg: '#E8F5E9', text: '#2E7D32', label: 'Relaxed' },
  CUSTOM:   { bg: '#E3F2FD', text: '#1565C0', label: 'Custom' },
};
const AVATAR_COLORS = ['#00897B', '#1565C0', '#7B1FA2', '#E53935', '#FB8C00'];
const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  STARTER:    { bg: '#E3F2FD', text: '#1565C0' },
  GROWTH:     { bg: '#E8F5E9', text: '#1B5E20' },
  ENTERPRISE: { bg: '#FFF8E1', text: '#E65100' },
};

function getInitials(name?: string) {
  if (!name) return 'C';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function CustomerRow({ customer, idx, search }: { customer: Customer; idx: number; search: string }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const { data: profiles, isLoading: loadingProfiles } = useQuery<ChildProfile[]>({
    queryKey: ['admin-app-ctrl-children', customer.id],
    enabled: expanded,
    queryFn: () => api.get(`/profiles/customers/${customer.id}/children`).then(r => {
      const d = r.data?.data; return (d?.content ?? d ?? []) as ChildProfile[];
    }).catch(() => []),
  });

  const { data: rulesMap } = useQuery<Record<string, DnsRules>>({
    queryKey: ['admin-app-ctrl-rules', customer.id, (profiles ?? []).map(p => p.id).join(',')],
    enabled: expanded && !!(profiles?.length),
    queryFn: async () => {
      const map: Record<string, DnsRules> = {};
      await Promise.all((profiles ?? []).map(async p => {
        try { const r = await api.get(`/dns/rules/${p.id}`); map[p.id] = r.data?.data ?? r.data; }
        catch { /* ignore */ }
      }));
      return map;
    },
  });

  const planConf = PLAN_COLORS[customer.subscriptionPlan ?? ''] ?? PLAN_COLORS.STARTER;
  const displayName = customer.name || customer.email || `User ${(customer.userId ?? customer.id).slice(0, 8)}…`;

  if (search && !displayName.toLowerCase().includes(search.toLowerCase()) &&
      !(customer.email ?? '').toLowerCase().includes(search.toLowerCase())) return null;

  return (
    <Card sx={{ mb: 1.5, border: expanded ? '1px solid #4ADE8040' : '1px solid transparent', transition: 'all 0.2s ease', '&:hover': { borderColor: '#4ADE8060' } }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: expanded ? 0 : '12px !important' } }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: AVATAR_COLORS[idx % AVATAR_COLORS.length], width: 40, height: 40, fontWeight: 700, fontSize: 14 }}>
            {getInitials(displayName)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography fontWeight={700} fontSize={14} noWrap>{displayName}</Typography>
              {customer.subscriptionPlan && (
                <Chip size="small" label={customer.subscriptionPlan}
                  sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: planConf.bg, color: planConf.text }} />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {customer.email && customer.name ? customer.email : ''}
              {customer.profileCount !== undefined ? ` · ${customer.profileCount} child profile${customer.profileCount !== 1 ? 's' : ''}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => navigate(`/admin/users/${customer.userId ?? customer.id}`)}
              sx={{ fontSize: 11, borderColor: '#CBD5E1', color: 'text.secondary' }}>
              View User
            </Button>
            <Tooltip title={expanded ? 'Collapse' : 'View child profiles'}>
              <IconButton size="small" onClick={() => setExpanded(!expanded)}
                sx={{ bgcolor: expanded ? '#DCFCE7' : '#F8FAFC', '&:hover': { bgcolor: '#DCFCE7' } }}>
                {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Collapse in={expanded} timeout="auto">
          <Divider sx={{ mt: 1.5, mb: 1.5 }} />
          {loadingProfiles ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
          ) : !profiles || profiles.length === 0 ? (
            <Box sx={{ py: 1.5, px: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ChildCareIcon sx={{ fontSize: 16 }} /> No child profiles for this customer.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={1.5} sx={{ pb: 1.5 }}>
              {profiles.map((profile, pi) => {
                const rules = rulesMap?.[profile.id];
                const filterConf = FILTER_COLORS[profile.filterLevel ?? 'MODERATE'];
                const totalCats = Object.keys(rules?.enabledCategories ?? {}).length;
                const blockedCats = Object.values(rules?.enabledCategories ?? {}).filter(v => v === false).length;
                const customBlocked = rules?.customBlocklist?.length ?? 0;
                const customAllowed = rules?.customAllowlist?.length ?? 0;

                return (
                  <Grid key={profile.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Box sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0', transition: 'all 0.2s ease', '&:hover': { bgcolor: '#EFF6FF', borderColor: '#BFDBFE' } }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: AVATAR_COLORS[pi % AVATAR_COLORS.length], fontWeight: 700 }}>
                          {getInitials(profile.name)}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={700} fontSize={13} noWrap>{profile.name ?? `Profile ${pi + 1}`}</Typography>
                        </Box>
                        <Chip size="small" label={filterConf.label}
                          sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: filterConf.bg, color: filterConf.text }} />
                      </Stack>

                      {totalCats > 0 && (
                        <Box sx={{ mb: 1 }}>
                          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                            <Typography variant="caption" color="text.secondary">Categories blocked</Typography>
                            <Typography variant="caption" fontWeight={600}>{blockedCats}/{totalCats}</Typography>
                          </Stack>
                          <LinearProgress variant="determinate"
                            value={totalCats > 0 ? (blockedCats / totalCats) * 100 : 0}
                            sx={{ height: 4, borderRadius: 2, bgcolor: '#E2E8F0', '& .MuiLinearProgress-bar': { bgcolor: '#E53935' } }} />
                        </Box>
                      )}

                      <Stack direction="row" spacing={0.75} sx={{ mb: 1 }}>
                        <Chip size="small" icon={<BlockIcon sx={{ fontSize: 11 }} />} label={`${customBlocked} blocked`}
                          sx={{ height: 20, fontSize: 10, bgcolor: '#FEF2F2', color: '#B71C1C', fontWeight: 600 }} />
                        <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: 11 }} />} label={`${customAllowed} allowed`}
                          sx={{ height: 20, fontSize: 10, bgcolor: '#F0FDF4', color: '#15803D', fontWeight: 600 }} />
                      </Stack>

                      {profile.dnsClientId && (
                        <Tooltip title="Copy DNS address">
                          <Typography variant="caption" onClick={() => navigator.clipboard.writeText(profile.dnsClientId!)}
                            sx={{ fontFamily: 'monospace', fontSize: 10, color: '#1565C0', bgcolor: '#EFF6FF', px: 0.75, py: 0.25, borderRadius: 0.75, display: 'block', mb: 1, cursor: 'pointer' }}>
                            <DnsIcon sx={{ fontSize: 10, mr: 0.25 }} />{profile.dnsClientId}
                          </Typography>
                        </Tooltip>
                      )}

                      <Button fullWidth size="small" variant="outlined" startIcon={<TuneIcon sx={{ fontSize: 13 }} />}
                        onClick={() => navigate(`/admin/dns-rules?profileId=${profile.id}`)}
                        sx={{ fontSize: 11, py: 0.5, borderColor: AVATAR_COLORS[pi % AVATAR_COLORS.length], color: AVATAR_COLORS[pi % AVATAR_COLORS.length], fontWeight: 600 }}>
                        View DNS Rules
                      </Button>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
}

export default function AdminAppControlPage() {
  const [search, setSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<string>('all');

  const { data: tenantsData } = useQuery({
    queryKey: ['admin-app-ctrl-tenants'],
    queryFn: () => api.get('/tenants?size=100').then(r => {
      const d = r.data?.data; return (d?.content ?? d ?? []) as Tenant[];
    }).catch(() => []),
  });
  const tenants = tenantsData ?? [];

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ['admin-app-ctrl-customers', selectedTenant],
    queryFn: () => {
      const url = selectedTenant === 'all'
        ? '/profiles/customers?size=200'
        : `/profiles/customers?tenantId=${selectedTenant}&size=200`;
      return api.get(url).then(r => {
        const d = r.data?.data;
        const all = (d?.content ?? d ?? []) as Customer[];
        return selectedTenant === 'all' ? all : all.filter(c => !c.tenantId || c.tenantId === selectedTenant);
      }).catch(() => []);
    },
  });

  const totalProfiles = (customers ?? []).reduce((sum, c) => sum + (c.profileCount ?? 0), 0);

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PhonelinkSetupIcon />}
        title="App & Content Control"
        subtitle="Manage DNS filtering for all customers' child profiles across the platform"
        iconColor="#00897B"
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Tenant</InputLabel>
              <Select value={selectedTenant} label="Filter by Tenant" onChange={e => setSelectedTenant(e.target.value)}>
                <MenuItem value="all"><em>All Tenants</em></MenuItem>
                {tenants.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" placeholder="Search customers…" value={search}
              onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ minWidth: 200 }} />
          </Stack>
        }
      />

      {/* Summary */}
      <AnimatedPage delay={0.05}>
        <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #052E16 0%, #14532D 100%)', color: 'white' }}>
          <CardContent>
            <Grid container spacing={3}>
              {[
                { icon: <BusinessIcon sx={{ color: '#4ADE80', fontSize: 24, mb: 0.5 }} />, value: tenants.length, label: 'Tenants' },
                { icon: <PeopleIcon sx={{ color: '#4ADE80', fontSize: 24, mb: 0.5 }} />, value: (customers ?? []).length, label: 'Customers' },
                { icon: <ChildCareIcon sx={{ color: '#4ADE80', fontSize: 24, mb: 0.5 }} />, value: totalProfiles, label: 'Child Profiles' },
                { icon: <PhonelinkSetupIcon sx={{ color: '#4ADE80', fontSize: 24, mb: 0.5 }} />, value: 'DNS', label: 'Filtering Active' },
              ].map(s => (
                <Grid key={s.label} size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    {s.icon}
                    <Typography variant="h5" fontWeight={700} color="white">{s.value}</Typography>
                    <Typography variant="caption" sx={{ color: '#86EFAC' }}>{s.label}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Customer list */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : !customers || customers.length === 0 ? (
        <EmptyState icon={<PeopleIcon sx={{ fontSize: 36, color: '#00897B' }} />} title="No customers found"
          description={selectedTenant === 'all' ? 'No customers exist on the platform yet' : 'This tenant has no customers yet'} />
      ) : (
        <AnimatedPage delay={0.1}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {customers.length} customer{customers.length !== 1 ? 's' : ''}
              {selectedTenant !== 'all' && tenants.find(t => t.id === selectedTenant) && ` · ${tenants.find(t => t.id === selectedTenant)!.name}`}
              {search && ` · filtering by "${search}"`}
            </Typography>
            {customers.map((c, i) => <CustomerRow key={c.id} customer={c} idx={i} search={search} />)}
          </Box>
        </AnimatedPage>
      )}
    </AnimatedPage>
  );
}
