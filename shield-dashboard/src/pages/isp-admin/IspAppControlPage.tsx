import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Stack, Avatar, Button, TextField, InputAdornment, Tooltip,
  Collapse, IconButton, Divider, Chip,
} from '@mui/material';
import PhonelinkSetupIcon from '@mui/icons-material/PhonelinkSetup';
import PeopleIcon from '@mui/icons-material/People';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TuneIcon from '@mui/icons-material/Tune';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';
import CompactProfileCard from '../../components/CompactProfileCard';
import { AVATAR_COLORS, PLAN_COLORS, getInitials } from '../../utils/profileUtils';

interface Customer { id: string; userId?: string; name?: string; email?: string; subscriptionPlan?: string; profileCount?: number; }
interface ChildProfile { id: string; name?: string; age?: number; filterLevel?: string; dnsClientId?: string; }
interface DnsRules { profileId: string; enabledCategories?: Record<string, boolean>; customBlocklist?: string[]; customAllowlist?: string[]; }

function CustomerRow({ customer, idx, search }: { customer: Customer; idx: number; search: string }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const { data: profiles, isLoading: loadingProfiles } = useQuery<ChildProfile[]>({
    queryKey: ['isp-app-control-children', customer.id],
    enabled: expanded,
    queryFn: () => api.get(`/profiles/customers/${customer.id}/children`).then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as ChildProfile[];
    }).catch(() => []),
  });

  const { data: rulesMap } = useQuery<Record<string, DnsRules>>({
    queryKey: ['isp-app-control-rules', customer.id, (profiles ?? []).map(p => p.id).join(',')],
    enabled: expanded && !!(profiles?.length),
    queryFn: async () => {
      const map: Record<string, DnsRules> = {};
      await Promise.all((profiles ?? []).map(async p => {
        try {
          const r = await api.get(`/dns/rules/${p.id}`);
          map[p.id] = r.data?.data ?? r.data;
        } catch { /* ignore */ }
      }));
      return map;
    },
  });

  const planConf = PLAN_COLORS[customer.subscriptionPlan ?? ''] ?? PLAN_COLORS.STARTER;
  const displayName = customer.name || customer.email || `User ${(customer.userId ?? customer.id).slice(0, 8)}…`;

  // Filter match
  if (search && !displayName.toLowerCase().includes(search.toLowerCase()) &&
      !(customer.email ?? '').toLowerCase().includes(search.toLowerCase())) {
    return null;
  }

  return (
    <Card sx={{
      mb: 1.5,
      border: expanded ? '1px solid #4ADE8040' : '1px solid transparent',
      transition: 'all 0.2s ease',
      '&:hover': { borderColor: '#4ADE8060' },
    }}>
      {/* Customer header row */}
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: expanded ? 0 : '12px !important' } }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{
            bgcolor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
            width: 40, height: 40, fontWeight: 700, fontSize: 14,
          }}>
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
              {customer.profileCount !== undefined ? `${customer.profileCount} child profile${customer.profileCount !== 1 ? 's' : ''}` : 'Click to view profiles'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" variant="outlined" onClick={() => navigate(`/isp/customers/${customer.id}`)}
              sx={{ fontSize: 11, borderColor: '#CBD5E1', color: 'text.secondary', '&:hover': { borderColor: '#00897B', color: '#00897B' } }}>
              Customer Detail
            </Button>
            <Tooltip title={expanded ? 'Collapse profiles' : 'Expand profiles'}>
              <IconButton size="small" onClick={() => setExpanded(!expanded)}
                sx={{ bgcolor: expanded ? '#DCFCE7' : '#F8FAFC', '&:hover': { bgcolor: '#DCFCE7' } }}>
                {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Child profiles expansion */}
        <Collapse in={expanded} timeout="auto">
          <Divider sx={{ mt: 1.5, mb: 1.5 }} />
          {loadingProfiles ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
          ) : !profiles || profiles.length === 0 ? (
            <Box sx={{ py: 1.5, px: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ChildCareIcon sx={{ fontSize: 16 }} /> No child profiles for this customer yet.
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
                    manageLabel="Manage DNS Rules"
                    onManage={() => navigate(`/isp/customers/${customer.id}`)}
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

export default function IspAppControlPage() {
  const [search, setSearch] = useState('');

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ['isp-app-control-customers'],
    queryFn: () => api.get('/profiles/customers?size=200').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as Customer[];
    }).catch(() => []),
  });

  const totalProfiles = (customers ?? []).reduce((sum, c) => sum + (c.profileCount ?? 0), 0);

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PhonelinkSetupIcon />}
        title="App & Content Control"
        subtitle="Manage DNS filtering for all customers' child profiles"
        iconColor="#00897B"
        action={
          <TextField size="small" placeholder="Search customers…" value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            sx={{ minWidth: 220 }} />
        }
      />

      {/* Summary card */}
      <AnimatedPage delay={0.05}>
        <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #052E16 0%, #14532D 100%)', color: 'white' }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <PeopleIcon sx={{ color: '#4ADE80', fontSize: 24, mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={700} color="white">{(customers ?? []).length}</Typography>
                  <Typography variant="caption" sx={{ color: '#86EFAC' }}>Total Customers</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <ChildCareIcon sx={{ color: '#4ADE80', fontSize: 24, mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={700} color="white">{totalProfiles}</Typography>
                  <Typography variant="caption" sx={{ color: '#86EFAC' }}>Child Profiles</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <PhonelinkSetupIcon sx={{ color: '#4ADE80', fontSize: 24, mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={700} color="white">DNS</Typography>
                  <Typography variant="caption" sx={{ color: '#86EFAC' }}>Filtering Active</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <TuneIcon sx={{ color: '#4ADE80', fontSize: 24, mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={700} color="white">Manage</Typography>
                  <Typography variant="caption" sx={{ color: '#86EFAC' }}>Per Profile</Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Info banner */}
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 3, bgcolor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <CardContent sx={{ py: 1.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <PhonelinkSetupIcon sx={{ color: '#1D4ED8', fontSize: 18 }} />
              <Typography variant="body2" color="#1E40AF">
                Expand any customer to view and manage DNS filtering for each of their child profiles. Click <strong>Manage DNS Rules</strong> to configure categories, blocklists, and allowlists per child.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Customer list */}
      {isLoading ? (
        <LoadingPage />
      ) : !customers || customers.length === 0 ? (
        <EmptyState
          icon={<PeopleIcon sx={{ fontSize: 36, color: '#00897B' }} />}
          title="No customers yet"
          description="Customers who sign up under your ISP account will appear here"
        />
      ) : (
        <AnimatedPage delay={0.15}>
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                {(customers ?? []).length} customer{customers.length !== 1 ? 's' : ''}
                {search && ` · filtering by "${search}"`}
              </Typography>
            </Stack>
            {(customers ?? []).map((c, i) => (
              <CustomerRow key={c.id} customer={c} idx={i} search={search} />
            ))}
          </Box>
        </AnimatedPage>
      )}
    </AnimatedPage>
  );
}
