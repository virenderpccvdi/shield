import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, CircularProgress,
  Stack, Avatar, Button, TextField, InputAdornment, Tooltip, Collapse,
  IconButton, Divider, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import PhonelinkSetupIcon from '@mui/icons-material/PhonelinkSetup';
import PeopleIcon from '@mui/icons-material/People';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BusinessIcon from '@mui/icons-material/Business';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';
import CompactProfileCard from '../../components/CompactProfileCard';
import { AVATAR_COLORS, PLAN_COLORS, getInitials } from '../../utils/profileUtils';

interface Tenant { id: string; name: string; slug: string; plan: string; active: boolean; }
interface Customer { id: string; userId?: string; name?: string; email?: string; subscriptionPlan?: string; profileCount?: number; tenantId?: string; }
interface ChildProfile { id: string; name?: string; filterLevel?: string; dnsClientId?: string; }
interface DnsRules { profileId: string; enabledCategories?: Record<string, boolean>; customBlocklist?: string[]; customAllowlist?: string[]; }

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
              {profiles.map((profile, pi) => (
                <Grid key={profile.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <CompactProfileCard
                    profile={profile}
                    rules={rulesMap?.[profile.id]}
                    colorIndex={pi}
                    manageLabel="View DNS Rules"
                    onManage={() => navigate(`/admin/dns-rules?profileId=${profile.id}`)}
                  />
                </Grid>
              ))}
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
        <LoadingPage />
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
