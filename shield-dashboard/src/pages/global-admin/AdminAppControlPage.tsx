import { useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, CircularProgress,
  Stack, Avatar, Button, TextField, InputAdornment, Tooltip, Collapse,
  IconButton, Divider, FormControl, InputLabel, Select, MenuItem,
  Switch, Table, TableBody, TableCell, TableHead, TableRow,
  Paper, LinearProgress, Badge, Alert,
} from '@mui/material';
import PhonelinkSetupIcon from '@mui/icons-material/PhonelinkSetup';
import PeopleIcon from '@mui/icons-material/People';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BusinessIcon from '@mui/icons-material/Business';
import TuneIcon from '@mui/icons-material/Tune';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SecurityIcon from '@mui/icons-material/Security';
import CategoryIcon from '@mui/icons-material/Category';
import SaveIcon from '@mui/icons-material/Save';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';
import { AVATAR_COLORS, PLAN_COLORS, FILTER_COLORS, getInitials } from '../../utils/profileUtils';

interface Tenant { id: string; name: string; slug: string; plan: string; active: boolean; }
interface Customer { id: string; userId?: string; name?: string; email?: string; subscriptionPlan?: string; profileCount?: number; tenantId?: string; }
interface ChildProfile { id: string; name?: string; filterLevel?: string; dnsClientId?: string; age?: number; }
interface DnsRules {
  profileId: string;
  filterLevel?: string;
  enabledCategories?: Record<string, boolean>;
  customBlocklist?: string[];
  customAllowlist?: string[];
}

// Categories grouped by risk level
const CATEGORY_GROUPS: Record<string, { label: string; color: string; categories: string[] }> = {
  adult: {
    label: 'Adult Content',
    color: '#C62828',
    categories: ['ADULT_CONTENT', 'PORNOGRAPHY', 'EXPLICIT_VIOLENCE', 'GAMBLING'],
  },
  social: {
    label: 'Social & Gaming',
    color: '#7B1FA2',
    categories: ['SOCIAL_MEDIA', 'GAMING', 'DATING', 'CHAT_AND_MESSAGING'],
  },
  security: {
    label: 'Security & Malware',
    color: '#C2410C',
    categories: ['MALWARE', 'PHISHING', 'CRYPTOMINING', 'HACKING'],
  },
  education: {
    label: 'Education',
    color: '#1565C0',
    categories: ['EDUCATION', 'NEWS', 'REFERENCE'],
  },
  other: {
    label: 'Other',
    color: '#37474F',
    categories: ['STREAMING', 'SHOPPING', 'FOOD_AND_DRINK', 'TRAVEL', 'SPORTS', 'HEALTH'],
  },
};

function formatCategoryName(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Category Toggle Panel ─────────────────────────────────────────────────────

interface CategoryPanelProps {
  profileId: string;
  rules: DnsRules | undefined;
  onRulesChange?: () => void;
}

function CategoryPanel({ profileId, rules, onRulesChange }: CategoryPanelProps) {
  const qc = useQueryClient();
  const [localCategories, setLocalCategories] = useState<Record<string, boolean> | null>(null);
  const [localFilterLevel, setLocalFilterLevel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const enabledCategories = localCategories ?? rules?.enabledCategories ?? {};
  const filterLevel = localFilterLevel ?? rules?.filterLevel ?? 'MODERATE';

  const isCategoryBlocked = (cat: string) => enabledCategories[cat] === false;

  const toggleCategory = (cat: string) => {
    const current = localCategories ?? rules?.enabledCategories ?? {};
    setLocalCategories({ ...current, [cat]: current[cat] === false ? true : false });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/dns/rules/${profileId}`, {
        filterLevel,
        enabledCategories: localCategories ?? rules?.enabledCategories ?? {},
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      qc.invalidateQueries({ queryKey: ['admin-app-ctrl-rules'] });
      onRulesChange?.();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const blockedCount = Object.values(enabledCategories).filter(v => v === false).length;
  const hasChanges = localCategories !== null || localFilterLevel !== null;

  return (
    <Box sx={{ px: 0.5, pb: 1.5 }}>
      {/* Filter level + save row */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Filter Level</InputLabel>
          <Select
            value={filterLevel}
            label="Filter Level"
            onChange={e => { setLocalFilterLevel(e.target.value); setSaved(false); }}
          >
            {Object.entries(FILTER_COLORS).map(([level, conf]) => (
              <MenuItem key={level} value={level}>
                <Chip size="small" label={conf.label} sx={{ bgcolor: conf.bg, color: conf.text, fontWeight: 600, fontSize: 11, height: 20 }} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
          <Chip
            size="small"
            icon={<BlockIcon sx={{ fontSize: 13 }} />}
            label={`${blockedCount} blocked`}
            sx={{ bgcolor: '#FFEBEE', color: '#C62828', fontWeight: 600, fontSize: 11 }}
          />
          <Chip
            size="small"
            icon={<CheckCircleIcon sx={{ fontSize: 13 }} />}
            label={`${Object.keys(enabledCategories).length - blockedCount} allowed`}
            sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 600, fontSize: 11 }}
          />
        </Stack>

        {hasChanges && (
          <Button
            size="small"
            variant="contained"
            startIcon={saving ? <CircularProgress size={13} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{ bgcolor: '#00897B', '&:hover': { bgcolor: '#00695C' }, fontSize: 12 }}
          >
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        )}
      </Stack>

      {/* Category groups */}
      <Grid container spacing={1.5}>
        {Object.entries(CATEGORY_GROUPS).map(([groupKey, group]) => (
          <Grid key={groupKey} size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ px: 1.5, py: 1, bgcolor: `${group.color}08`, borderBottom: '1px solid #E2E8F0' }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CategoryIcon sx={{ fontSize: 14, color: group.color }} />
                  <Typography variant="caption" fontWeight={700} sx={{ color: group.color, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                    {group.label}
                  </Typography>
                  <Badge
                    badgeContent={group.categories.filter(c => isCategoryBlocked(c)).length}
                    color="error"
                    sx={{ ml: 'auto !important', '& .MuiBadge-badge': { fontSize: 9, minWidth: 16, height: 16 } }}
                  />
                </Stack>
              </Box>
              <Table size="small">
                <TableBody>
                  {group.categories.map(cat => {
                    const blocked = isCategoryBlocked(cat);
                    return (
                      <TableRow key={cat} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                        <TableCell sx={{ py: 0.5, fontSize: 12, fontWeight: 500 }}>
                          {formatCategoryName(cat)}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 0.5, width: 80 }}>
                          <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="flex-end">
                            <Typography variant="caption" sx={{ color: blocked ? '#C62828' : '#2E7D32', fontWeight: 600, fontSize: 10 }}>
                              {blocked ? 'Blocked' : 'Allowed'}
                            </Typography>
                            <Switch
                              size="small"
                              checked={!blocked}
                              onChange={() => toggleCategory(cat)}
                              sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': { color: '#43A047' },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#43A047' },
                              }}
                            />
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// ─── Customer Row ──────────────────────────────────────────────────────────────

function CustomerRow({ customer, idx, search }: { customer: Customer; idx: number; search: string }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);

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

  if (search && !displayName.toLowerCase().includes(search.toLowerCase()) &&
      !(customer.email ?? '').toLowerCase().includes(search.toLowerCase())) return null;

  // Compute per-customer stats from rulesMap
  const totalProfiles = profiles?.length ?? 0;
  const strictCount = (profiles ?? []).filter(p => (rulesMap?.[p.id]?.filterLevel ?? p.filterLevel) === 'STRICT').length;
  const blockedCatsTotal = Object.values(rulesMap ?? {}).reduce((sum, r) =>
    sum + Object.values(r.enabledCategories ?? {}).filter(v => v === false).length, 0);

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
            <Stack direction="row" spacing={1.5} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                {customer.email && customer.name ? customer.email : ''}
              </Typography>
              {totalProfiles > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {totalProfiles} child profile{totalProfiles !== 1 ? 's' : ''}
                  {strictCount > 0 ? ` · ${strictCount} strict` : ''}
                  {blockedCatsTotal > 0 ? ` · ${blockedCatsTotal} cats blocked` : ''}
                </Typography>
              )}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => navigate(`/admin/users/${customer.userId ?? customer.id}`)}
              sx={{ fontSize: 11, borderColor: '#CBD5E1', color: 'text.secondary' }}>
              View User
            </Button>
            <Tooltip title={expanded ? 'Collapse' : 'Manage content filters'}>
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
            <Box sx={{ pb: 1 }}>
              {profiles.map((profile, pi) => {
                const rules = rulesMap?.[profile.id];
                const filterConf = FILTER_COLORS[rules?.filterLevel ?? profile.filterLevel ?? 'MODERATE'];
                const isProfileExpanded = expandedProfile === profile.id;
                const blockedCats = Object.values(rules?.enabledCategories ?? {}).filter(v => v === false).length;
                const color = AVATAR_COLORS[pi % AVATAR_COLORS.length];

                return (
                  <Box key={profile.id} sx={{ mb: 1.5 }}>
                    {/* Profile header */}
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
                      bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#EFF6FF', borderColor: '#BFDBFE' },
                    }}
                      onClick={() => setExpandedProfile(isProfileExpanded ? null : profile.id)}
                    >
                      <Avatar sx={{ width: 30, height: 30, fontSize: 11, bgcolor: color, fontWeight: 700 }}>
                        {getInitials(profile.name)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {profile.name ?? `Profile ${pi + 1}`}
                          {profile.age ? <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>age {profile.age}</Typography> : null}
                        </Typography>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={filterConf.label}
                            sx={{ height: 18, fontSize: 10, fontWeight: 600, bgcolor: filterConf.bg, color: filterConf.text }} />
                          {profile.dnsClientId && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                              {profile.dnsClientId}
                            </Typography>
                          )}
                          {blockedCats > 0 && (
                            <Chip size="small" icon={<BlockIcon sx={{ fontSize: 11 }} />}
                              label={`${blockedCats} blocked`}
                              sx={{ height: 18, fontSize: 10, bgcolor: '#FFEBEE', color: '#C62828' }} />
                          )}
                          {rules?.customBlocklist?.length ? (
                            <Chip size="small" label={`+${rules.customBlocklist.length} custom`}
                              sx={{ height: 18, fontSize: 10, bgcolor: '#FFF8E1', color: '#7C4700' }} />
                          ) : null}
                        </Stack>
                      </Box>
                      <Tooltip title={isProfileExpanded ? 'Collapse categories' : 'Manage categories'}>
                        <IconButton size="small" sx={{ color: '#00897B' }}>
                          {isProfileExpanded ? <ExpandLessIcon fontSize="small" /> : <TuneIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {/* Category management panel */}
                    <Collapse in={isProfileExpanded} timeout="auto">
                      <Box sx={{ mt: 1, ml: 1, p: 1.5, bgcolor: '#FAFFFE', borderRadius: 2, border: '1px solid #B2DFDB' }}>
                        <CategoryPanel profileId={profile.id} rules={rules} />
                      </Box>
                    </Collapse>
                  </Box>
                );
              })}
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
}

// ─── Stats Summary ─────────────────────────────────────────────────────────────

interface FilterStats {
  strict: number;
  moderate: number;
  relaxed: number;
  custom: number;
  totalProfiles: number;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminAppControlPage() {
  const [search, setSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [filterLevelFilter, setFilterLevelFilter] = useState<string>('all');

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

  // Aggregate stats query — fetch all children to compute filter-level distribution
  const { data: allChildren } = useQuery<ChildProfile[]>({
    queryKey: ['admin-app-ctrl-all-children', selectedTenant],
    queryFn: () => {
      const url = selectedTenant === 'all'
        ? '/profiles/all-children?size=500'
        : `/profiles/all-children?tenantId=${selectedTenant}&size=500`;
      return api.get(url).then(r => {
        const d = r.data?.data;
        return (d?.content ?? d ?? []) as ChildProfile[];
      }).catch(() => []);
    },
    staleTime: 60_000,
  });

  const filterStats: FilterStats = useMemo(() => {
    const profiles = allChildren ?? [];
    return {
      strict: profiles.filter(p => p.filterLevel === 'STRICT').length,
      moderate: profiles.filter(p => p.filterLevel === 'MODERATE' || !p.filterLevel).length,
      relaxed: profiles.filter(p => p.filterLevel === 'RELAXED').length,
      custom: profiles.filter(p => p.filterLevel === 'CUSTOM').length,
      totalProfiles: profiles.length,
    };
  }, [allChildren]);

  const totalProfiles = (customers ?? []).reduce((sum, c) => sum + (c.profileCount ?? 0), 0);

  // Filter customers by plan/filter level if selected
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (filterLevelFilter === 'all') return customers;
    // For filter level filtering we just show all since we don't have per-customer filter info
    return customers;
  }, [customers, filterLevelFilter]);

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PhonelinkSetupIcon />}
        title="App & Content Control"
        subtitle="Manage DNS category filtering for all customers' child profiles across the platform"
        iconColor="#00897B"
        action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Tenant</InputLabel>
              <Select value={selectedTenant} label="Tenant" onChange={e => setSelectedTenant(e.target.value)}>
                <MenuItem value="all"><em>All Tenants</em></MenuItem>
                {tenants.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Filter Level</InputLabel>
              <Select value={filterLevelFilter} label="Filter Level" onChange={e => setFilterLevelFilter(e.target.value)}>
                <MenuItem value="all"><em>All Levels</em></MenuItem>
                {Object.entries(FILTER_COLORS).map(([level, conf]) => (
                  <MenuItem key={level} value={level}>
                    <Chip size="small" label={conf.label} sx={{ bgcolor: conf.bg, color: conf.text, fontWeight: 600, fontSize: 11, height: 20 }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField size="small" placeholder="Search customers…" value={search}
              onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ minWidth: 200 }} />
          </Stack>
        }
      />

      {/* Platform Summary */}
      <AnimatedPage delay={0.05}>
        <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #052E16 0%, #14532D 100%)', color: 'white' }}>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <BusinessIcon sx={{ color: '#4ADE80', fontSize: 24, mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={700} color="white">{tenants.length}</Typography>
                  <Typography variant="caption" sx={{ color: '#86EFAC' }}>Tenants</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <PeopleIcon sx={{ color: '#4ADE80', fontSize: 24, mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={700} color="white">{(customers ?? []).length}</Typography>
                  <Typography variant="caption" sx={{ color: '#86EFAC' }}>Customers</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <ChildCareIcon sx={{ color: '#4ADE80', fontSize: 24, mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={700} color="white">{filterStats.totalProfiles || totalProfiles}</Typography>
                  <Typography variant="caption" sx={{ color: '#86EFAC' }}>Child Profiles</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <SecurityIcon sx={{ color: '#4ADE80', fontSize: 24, mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={700} color="white">{filterStats.strict}</Typography>
                  <Typography variant="caption" sx={{ color: '#86EFAC' }}>Strict Profiles</Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Filter level distribution */}
      {filterStats.totalProfiles > 0 && (
        <AnimatedPage delay={0.08}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                Filter Level Distribution
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  across {filterStats.totalProfiles} child profile{filterStats.totalProfiles !== 1 ? 's' : ''}
                </Typography>
              </Typography>
              <Grid container spacing={2}>
                {([
                  { label: 'Strict', count: filterStats.strict, key: 'STRICT' },
                  { label: 'Moderate', count: filterStats.moderate, key: 'MODERATE' },
                  { label: 'Relaxed', count: filterStats.relaxed, key: 'RELAXED' },
                  { label: 'Custom', count: filterStats.custom, key: 'CUSTOM' },
                ] as const).map(({ label, count, key }) => {
                  const conf = FILTER_COLORS[key];
                  const pct = filterStats.totalProfiles > 0 ? (count / filterStats.totalProfiles) * 100 : 0;
                  return (
                    <Grid key={key} size={{ xs: 6, sm: 3 }}>
                      <Box>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ color: conf.text }}>{label}</Typography>
                          <Typography variant="body2" fontWeight={700}>{count}</Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 8, borderRadius: 4,
                            bgcolor: `${conf.bg}`,
                            '& .MuiLinearProgress-bar': { bgcolor: conf.text, borderRadius: 4 },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">{pct.toFixed(0)}%</Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* Help tip */}
      <AnimatedPage delay={0.09}>
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2, fontSize: 13 }}>
          Expand a customer row to see their child profiles, then click the <TuneIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} /> icon on any profile to manage its category toggles and filter level.
        </Alert>
      </AnimatedPage>

      {/* Customer list */}
      {isLoading ? (
        <LoadingPage />
      ) : !filteredCustomers || filteredCustomers.length === 0 ? (
        <EmptyState icon={<PeopleIcon sx={{ fontSize: 36, color: '#00897B' }} />} title="No customers found"
          description={selectedTenant === 'all' ? 'No customers exist on the platform yet' : 'This tenant has no customers yet'} />
      ) : (
        <AnimatedPage delay={0.1}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}
              {selectedTenant !== 'all' && tenants.find(t => t.id === selectedTenant) && ` · ${tenants.find(t => t.id === selectedTenant)!.name}`}
              {search && ` · filtering by "${search}"`}
            </Typography>
            {filteredCustomers.map((c, i) => <CustomerRow key={c.id} customer={c} idx={i} search={search} />)}
          </Box>
        </AnimatedPage>
      )}
    </AnimatedPage>
  );
}
