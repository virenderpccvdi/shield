import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Button,
  Chip, Avatar, Stack, Divider, Table, TableHead, TableRow, TableCell,
  TableBody, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Switch, IconButton,
  Tooltip, Alert, Snackbar, LinearProgress,
} from '@mui/material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DevicesIcon from '@mui/icons-material/Devices';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import BlockIcon from '@mui/icons-material/Block';
import DnsIcon from '@mui/icons-material/Dns';
import ShieldIcon from '@mui/icons-material/Shield';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import LockResetIcon from '@mui/icons-material/LockReset';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CasinoIcon from '@mui/icons-material/Casino';
import TuneIcon from '@mui/icons-material/Tune';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

/* ─── Types ─────────────────────────────────────────── */
interface Customer {
  id: string; name?: string; email?: string; status?: string;
  joinedAt?: string; createdAt?: string; userId?: string;
  subscriptionPlan?: string; subscriptionStatus?: string;
  profileCount?: number; maxProfiles?: number; tenantId?: string;
}
interface ChildProfile {
  id: string; name?: string; age?: number; filterLevel?: string;
  online?: boolean; blocksToday?: number; dnsClientId?: string;
}
interface Device {
  id: string; name?: string; deviceType?: string; online?: boolean;
  lastSeenAt?: string; dnsMethod?: string; profileId?: string; macAddress?: string;
}
interface DnsRules {
  enabledCategories?: Record<string, boolean>;
  customBlocklist?: string[];
  customAllowlist?: string[];
}

/* ─── Configs ────────────────────────────────────────── */
const FILTER_COLORS: Record<string, { bg: string; text: string }> = {
  STRICT:   { bg: '#FFEBEE', text: '#C62828' },
  MODERATE: { bg: '#FFF8E1', text: '#F57F17' },
  RELAXED:  { bg: '#E8F5E9', text: '#2E7D32' },
  CUSTOM:   { bg: '#E3F2FD', text: '#1565C0' },
};
const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  FREE:       { bg: '#F5F5F5', text: '#757575' },
  BASIC:      { bg: '#E3F2FD', text: '#1565C0' },
  PREMIUM:    { bg: '#F3E5F5', text: '#7B1FA2' },
  ENTERPRISE: { bg: '#FFF8E1', text: '#F57F17' },
};
interface AvailablePlan { id: string; name: string; displayName: string; price: number; billingCycle: string; maxProfilesPerCustomer?: number; features?: Record<string, boolean>; }

function getInitials(name?: string) {
  if (!name) return 'C';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

/* ─── DNS Rules Dialog ───────────────────────────────── */
function DnsRulesDialog({ profile, open, onClose }: { profile: ChildProfile; open: boolean; onClose: () => void }) {
  const [categories, setCategories] = useState<{ key: string; label: string; blocked: boolean }[]>([]);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState('');
  const [newBlockDomain, setNewBlockDomain] = useState('');
  const [newAllowDomain, setNewAllowDomain] = useState('');
  const [tab, setTab] = useState(0);

  const loadRules = async () => {
    setLoading(true);
    try {
      const [catRes, rulesRes] = await Promise.all([
        api.get('/dns/categories'),
        api.get(`/dns/rules/${profile.id}`),
      ]);
      const catMap: Record<string, string> = catRes.data.data || catRes.data;
      const rules: DnsRules = rulesRes.data?.data ?? rulesRes.data;
      const enabled: Record<string, boolean> = rules.enabledCategories ?? {};
      const rows = Object.entries(catMap).map(([key, label]) => ({
        key, label: label as string, blocked: enabled[key] === false,
      }));
      rows.sort((a, b) => { if (a.blocked !== b.blocked) return a.blocked ? -1 : 1; return a.label.localeCompare(b.label); });
      setCategories(rows);
      setBlocklist(rules.customBlocklist ?? []);
      setAllowlist(rules.customAllowlist ?? []);
    } catch { setSnack('Failed to load DNS rules'); }
    finally { setLoading(false); }
  };

  // Load when opened
  const wasOpen = open;
  if (open && categories.length === 0 && !loading) { loadRules(); }

  const saveCategories = async () => {
    setSaving(true);
    const payload: Record<string, boolean> = {};
    categories.forEach(c => { payload[c.key] = !c.blocked; });
    try {
      await api.put(`/dns/rules/${profile.id}/categories`, { categories: payload });
      setSnack('Categories saved');
    } catch { setSnack('Failed to save'); }
    finally { setSaving(false); }
  };

  const saveList = async (type: 'block' | 'allow') => {
    setSaving(true);
    try {
      const endpoint = type === 'block' ? 'blocklist' : 'allowlist';
      const domains = type === 'block' ? blocklist : allowlist;
      await api.put(`/dns/rules/${profile.id}/${endpoint}`, { domains });
      setSnack(`${type === 'block' ? 'Blocklist' : 'Allowlist'} saved`);
    } catch { setSnack('Failed to save'); }
    finally { setSaving(false); }
  };

  const addDomain = (type: 'block' | 'allow') => {
    const val = type === 'block' ? newBlockDomain.trim().toLowerCase() : newAllowDomain.trim().toLowerCase();
    if (!val || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(val)) return;
    if (type === 'block') { if (!blocklist.includes(val)) setBlocklist(p => [...p, val]); setNewBlockDomain(''); }
    else { if (!allowlist.includes(val)) setAllowlist(p => [...p, val]); setNewAllowDomain(''); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TuneIcon sx={{ color: '#00897B' }} />
          <Box>
            <Typography fontWeight={700}>DNS Filtering — {profile.name ?? 'Profile'}</Typography>
            <Typography variant="caption" color="text.secondary">{profile.dnsClientId ?? ''}</Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}
              sx={{ borderBottom: 1, borderColor: 'divider', px: 2,
                '& .Mui-selected': { color: '#00897B' },
                '& .MuiTabs-indicator': { bgcolor: '#00897B' } }}>
              <Tab label="Categories" />
              <Tab label="Blocked Domains" />
              <Tab label="Allowed Domains" />
            </Tabs>

            {tab === 0 && (
              <Box sx={{ p: 2 }}>
                <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                        <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Category</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Block</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {categories.map((cat, i) => (
                        <TableRow key={cat.key} hover>
                          <TableCell><Typography fontSize={13} fontWeight={600}>{cat.label}</Typography></TableCell>
                          <TableCell>
                            <Chip size="small" label={cat.blocked ? 'Blocked' : 'Allowed'}
                              sx={{ height: 20, fontSize: 10, fontWeight: 600,
                                bgcolor: cat.blocked ? '#FFEBEE' : '#E8F5E9',
                                color: cat.blocked ? '#B71C1C' : '#1B5E20' }} />
                          </TableCell>
                          <TableCell>
                            <Switch checked={cat.blocked} size="small"
                              onChange={() => setCategories(p => p.map((c, idx) => idx === i ? { ...c, blocked: !c.blocked } : c))}
                              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#E53935' } }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
                <Box sx={{ pt: 2, textAlign: 'right' }}>
                  <Button variant="contained" startIcon={<SaveIcon />} onClick={saveCategories}
                    disabled={saving} sx={{ bgcolor: '#00897B', '&:hover': { bgcolor: '#00695C' } }}>
                    Save Categories
                  </Button>
                </Box>
              </Box>
            )}

            {tab === 1 && (
              <Box sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <TextField size="small" fullWidth placeholder="e.g. tiktok.com"
                    value={newBlockDomain} onChange={e => setNewBlockDomain(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDomain('block')} />
                  <Button variant="outlined" onClick={() => addDomain('block')}
                    sx={{ whiteSpace: 'nowrap', borderColor: '#B71C1C', color: '#B71C1C', '&:hover': { bgcolor: '#FFEBEE' } }}>
                    Add Block
                  </Button>
                </Stack>
                <Box sx={{ maxHeight: 280, overflowY: 'auto', mb: 2 }}>
                  {blocklist.length === 0 ? (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3, fontSize: 13 }}>No blocked domains</Typography>
                  ) : blocklist.map(d => (
                    <Stack key={d} direction="row" alignItems="center" justifyContent="space-between"
                      sx={{ py: 0.75, px: 1, borderRadius: 1, '&:hover': { bgcolor: '#FFF5F5' } }}>
                      <Chip size="small" label={d} sx={{ fontFamily: 'monospace', bgcolor: '#FFEBEE', color: '#B71C1C', fontWeight: 600 }} />
                      <IconButton size="small" onClick={() => setBlocklist(p => p.filter(x => x !== d))}
                        sx={{ color: '#B71C1C' }}><DeleteIcon fontSize="small" /></IconButton>
                    </Stack>
                  ))}
                </Box>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={() => saveList('block')}
                  disabled={saving} sx={{ bgcolor: '#B71C1C', '&:hover': { bgcolor: '#C62828' } }}>
                  Save Blocklist
                </Button>
              </Box>
            )}

            {tab === 2 && (
              <Box sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <TextField size="small" fullWidth placeholder="e.g. youtube.com"
                    value={newAllowDomain} onChange={e => setNewAllowDomain(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDomain('allow')} />
                  <Button variant="outlined" onClick={() => addDomain('allow')}
                    sx={{ whiteSpace: 'nowrap', borderColor: '#1B5E20', color: '#1B5E20', '&:hover': { bgcolor: '#E8F5E9' } }}>
                    Add Allow
                  </Button>
                </Stack>
                <Box sx={{ maxHeight: 280, overflowY: 'auto', mb: 2 }}>
                  {allowlist.length === 0 ? (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3, fontSize: 13 }}>No allowed domains</Typography>
                  ) : allowlist.map(d => (
                    <Stack key={d} direction="row" alignItems="center" justifyContent="space-between"
                      sx={{ py: 0.75, px: 1, borderRadius: 1, '&:hover': { bgcolor: '#F0FFF4' } }}>
                      <Chip size="small" label={d} sx={{ fontFamily: 'monospace', bgcolor: '#E8F5E9', color: '#1B5E20', fontWeight: 600 }} />
                      <IconButton size="small" onClick={() => setAllowlist(p => p.filter(x => x !== d))}
                        sx={{ color: '#1B5E20' }}><DeleteIcon fontSize="small" /></IconButton>
                    </Stack>
                  ))}
                </Box>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={() => saveList('allow')}
                  disabled={saving} sx={{ bgcolor: '#1B5E20', '&:hover': { bgcolor: '#2E7D32' } }}>
                  Save Allowlist
                </Button>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Dialog>
  );
}

/* ─── Edit Customer Dialog ───────────────────────────── */
function EditCustomerDialog({ customer, open, onClose, onSaved }: {
  customer: Customer; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [plan, setPlan] = useState(customer.subscriptionPlan ?? '');
  const [status, setStatus] = useState(customer.subscriptionStatus ?? 'ACTIVE');
  const [maxProfiles, setMaxProfiles] = useState(customer.maxProfiles ?? 5);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Fetch ISP's tenant-scoped customer plans dynamically
  const { data: availablePlans = [] } = useQuery<AvailablePlan[]>({
    queryKey: ['isp-available-plans'],
    queryFn: () => api.get('/admin/plans?all=true').then(r => {
      const d = r.data;
      return (Array.isArray(d) ? d : d?.data ?? []) as AvailablePlan[];
    }).catch(() => []),
    enabled: open,
  });

  // Sync plan: if current plan doesn't match any of the ISP's tenant plans, default to first
  useEffect(() => {
    if (availablePlans.length) {
      const match = availablePlans.find(p => p.name === plan);
      if (!match) setPlan(availablePlans[0].name);
    }
  }, [availablePlans]);

  const handleSave = async () => {
    setSaving(true);
    setErr('');
    try {
      // Find the selected plan to also update maxProfiles from plan definition
      const selectedPlan = availablePlans.find(p => p.name === plan);
      await api.put(`/profiles/customers/${customer.id}`, {
        subscriptionPlan: plan,
        subscriptionStatus: status,
        maxProfiles: selectedPlan?.features ? maxProfiles : maxProfiles,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Failed to update customer');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Assign Plan & Edit Customer</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {err && <Alert severity="error" sx={{ borderRadius: 1 }}>{err}</Alert>}
          <FormControl fullWidth size="small">
            <InputLabel>Subscription Plan</InputLabel>
            <Select value={plan} label="Subscription Plan" onChange={e => {
              setPlan(e.target.value);
              const selected = availablePlans.find(p => p.name === e.target.value);
              if (selected?.maxProfilesPerCustomer) setMaxProfiles(selected.maxProfilesPerCustomer);
            }}>
              {availablePlans.length === 0 && (
                <MenuItem value="" disabled><em>No plans created yet — go to Plans page first</em></MenuItem>
              )}
              {availablePlans.map(p => (
                <MenuItem key={p.id} value={p.name}>
                  <Stack direction="row" justifyContent="space-between" width="100%" alignItems="center">
                    <Typography fontSize={13} fontWeight={600}>{p.displayName}</Typography>
                    <Typography fontSize={12} color="text.secondary">
                      {p.price > 0 ? `₹${p.price}/${p.billingCycle === 'YEARLY' ? 'yr' : 'mo'}` : 'Free'}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={e => setStatus(e.target.value)}>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="SUSPENDED">Suspended</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" fullWidth label="Max Child Profiles" type="number"
            value={maxProfiles} onChange={e => setMaxProfiles(Number(e.target.value))}
            inputProps={{ min: 1, max: 20 }} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !plan}
          sx={{ bgcolor: '#00897B', '&:hover': { bgcolor: '#00695C' } }}>
          {saving ? <CircularProgress size={18} color="inherit" /> : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Delete Confirm Dialog ──────────────────────────── */
function DeleteDialog({ open, title, onClose, onConfirm, loading }: {
  open: boolean; title: string; onClose: () => void; onConfirm: () => void; loading?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700} sx={{ color: '#B71C1C' }}>Confirm Delete</DialogTitle>
      <DialogContent>
        <Typography>{title}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={onConfirm} disabled={loading}>
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── Main Page ──────────────────────────────────────── */
export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backPath = location.pathname.startsWith('/admin') ? '/admin/customers' : '/isp/customers';
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteCustomerOpen, setDeleteCustomerOpen] = useState(false);
  const [deleteProfileOpen, setDeleteProfileOpen] = useState<ChildProfile | null>(null);
  const [deleteDeviceOpen, setDeleteDeviceOpen] = useState<Device | null>(null);
  const [dnsProfileOpen, setDnsProfileOpen] = useState<ChildProfile | null>(null);
  const [snack, setSnack] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [resetPwdLoading, setResetPwdLoading] = useState(false);
  const [resetPwdCopied, setResetPwdCopied] = useState(false);
  // Add child profile dialog
  const [addProfileOpen, setAddProfileOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileAge, setNewProfileAge] = useState('');
  const [newProfileFilter, setNewProfileFilter] = useState('MODERATE');
  const [addProfileLoading, setAddProfileLoading] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['isp-customer', id],
    queryFn: async () => {
      const r = await api.get(`/profiles/customers/${id}`).catch(() => null);
      if (!r) return null;
      const c: Customer = r.data?.data;
      // Enrich with user details if name/email missing
      if (c && (!c.name || !c.email) && c.userId) {
        const ur = await api.get(`/auth/users`).then(u => {
          const list: any[] = u.data?.data?.content ?? u.data?.data ?? [];
          return list.find(u => u.id === c.userId);
        }).catch(() => null);
        if (ur) { c.name = c.name || ur.name; c.email = c.email || ur.email; }
      }
      return c;
    },
    enabled: !!id,
  });

  const { data: profiles, refetch: refetchProfiles } = useQuery({
    queryKey: ['isp-customer-children', id],
    queryFn: () => api.get(`/profiles/customers/${id}/children`).then(r => {
      const d = r.data?.data;
      return (Array.isArray(d) ? d : d?.content ?? []) as ChildProfile[];
    }).catch(() => []),
    enabled: !!id,
  });

  const { data: devices, refetch: refetchDevices } = useQuery({
    queryKey: ['isp-customer-devices', id],
    queryFn: async () => {
      // Get devices for all child profiles
      const profs = profiles ?? [];
      if (!profs.length) return [] as Device[];
      const results = await Promise.all(profs.map(p =>
        api.get(`/profiles/devices/profile/${p.id}`).then(r => {
          const d = r.data?.data ?? [];
          return (Array.isArray(d) ? d : []) as Device[];
        }).catch(() => [] as Device[])
      ));
      return results.flat();
    },
    enabled: !!id && !!(profiles?.length),
  });

  const { data: stats } = useQuery({
    queryKey: ['customer-stats-isp', id],
    queryFn: () => api.get(`/analytics/customer/${id}`).then(r => r.data?.data).catch(() => ({ totalQueries: 0, totalBlocks: 0, activeDevices: 0 })),
    enabled: !!id,
  });

  if (isLoading) return <LoadingPage />;
  if (!customer) return (
    <AnimatedPage>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)}>Back</Button>
      <EmptyState title="Customer not found" description="This customer may have been removed" />
    </AnimatedPage>
  );

  const plan = customer.subscriptionPlan ?? 'BASIC';
  const planColor = PLAN_COLORS[plan] ?? PLAN_COLORS.BASIC;
  const status = customer.subscriptionStatus ?? customer.status ?? 'ACTIVE';

  const handleDeleteCustomer = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/profiles/customers/${id}`);
    } catch (e: any) {
      // 404 = already deleted — treat as success and navigate away
      if (e?.response?.status !== 404) {
        setSnack(e?.response?.data?.message ?? 'Failed to delete customer');
        setDeleteCustomerOpen(false);
        setActionLoading(false);
        return;
      }
    }
    navigate(backPath);
    setActionLoading(false);
  };

  const handleDeleteProfile = async () => {
    if (!deleteProfileOpen) return;
    setActionLoading(true);
    try {
      await api.delete(`/profiles/customers/${id}/children/${deleteProfileOpen.id}`);
      setSnack('Profile deleted');
      refetchProfiles();
    } catch (e: any) {
      setSnack(e?.response?.data?.message ?? 'Failed to delete profile');
    } finally { setActionLoading(false); setDeleteProfileOpen(null); }
  };

  const handleAddProfile = async () => {
    if (!newProfileName.trim()) return;
    setAddProfileLoading(true);
    try {
      await api.post(`/profiles/customers/${id}/children`, {
        name: newProfileName.trim(),
        filterLevel: newProfileFilter,
        ageGroup: newProfileAge ? (parseInt(newProfileAge) <= 6 ? 'TODDLER' : parseInt(newProfileAge) <= 10 ? 'CHILD' : parseInt(newProfileAge) <= 13 ? 'PRETEEN' : 'TEEN') : 'CHILD',
      });
      setSnack('Child profile created');
      setAddProfileOpen(false);
      setNewProfileName('');
      setNewProfileAge('');
      setNewProfileFilter('MODERATE');
      refetchProfiles();
    } catch (e: any) {
      setSnack(e?.response?.data?.message ?? 'Failed to create profile');
    } finally { setAddProfileLoading(false); }
  };

  const handleDeleteDevice = async () => {
    if (!deleteDeviceOpen) return;
    setActionLoading(true);
    try {
      await api.delete(`/profiles/devices/${deleteDeviceOpen.id}`);
      setSnack('Device removed');
      refetchDevices();
    } catch (e: any) {
      setSnack(e?.response?.data?.message ?? 'Failed to remove device');
    } finally { setActionLoading(false); setDeleteDeviceOpen(null); }
  };

  const toggleSuspend = async () => {
    const newStatus = status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setActionLoading(true);
    try {
      await api.put(`/profiles/customers/${id}`, { subscriptionStatus: newStatus });
      qc.invalidateQueries({ queryKey: ['isp-customer', id] });
      setSnack(`Customer ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`);
    } catch (e: any) {
      setSnack(e?.response?.data?.message ?? 'Action failed');
    } finally { setActionLoading(false); }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let pw = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    pw += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    pw += '0123456789'[Math.floor(Math.random() * 10)];
    pw += '!@#$%&*'[Math.floor(Math.random() * 7)];
    for (let i = 4; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleResetPassword = async () => {
    if (!customer?.userId || !resetPwdValue || resetPwdValue.length < 8) return;
    setResetPwdLoading(true);
    try {
      await api.post(`/auth/admin/users/${customer.userId}/reset-password`, { newPassword: resetPwdValue });
      setSnack('Password reset successfully! Email sent to customer.');
      setResetPwdOpen(false);
      setResetPwdValue('');
    } catch (e: any) {
      setSnack(e?.response?.data?.message ?? 'Failed to reset password');
    } finally { setResetPwdLoading(false); }
  };

  return (
    <AnimatedPage>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)}
        sx={{ mb: 2, color: 'text.secondary', '&:hover': { bgcolor: '#F8FAFC' } }}>
        Back to Customers
      </Button>

      {/* Customer Header */}
      <AnimatedPage delay={0.05}>
        <Card sx={{ mb: 3, overflow: 'hidden' }}>
          <Box sx={{ height: 5, background: 'linear-gradient(135deg, #00897B 0%, #004D40 100%)' }} />
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2.5 }}>
              <Avatar sx={{ width: 60, height: 60, fontSize: 20, fontWeight: 700, bgcolor: '#00897B', mt: 0.5 }}>
                {customer.name ? getInitials(customer.name) : (customer.userId?.slice(0, 2).toUpperCase() ?? 'C')}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.5 }}>
                  <Typography variant="h5" fontWeight={700}>
                    {customer.name ?? (customer.userId ? `User ${customer.userId.slice(0, 8)}…` : 'Customer')}
                  </Typography>
                  <Chip size="small" label={status}
                    sx={{ height: 22, fontSize: 11, fontWeight: 600,
                      bgcolor: status === 'ACTIVE' ? '#E8F5E9' : '#FFEBEE',
                      color: status === 'ACTIVE' ? '#1B5E20' : '#B71C1C' }} />
                  <Chip size="small" label={plan}
                    sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: planColor.bg, color: planColor.text }} />
                </Box>
                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  {customer.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <EmailIcon sx={{ fontSize: 14 }} />
                      <Typography variant="body2">{customer.email}</Typography>
                    </Box>
                  )}
                  {customer.userId && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PersonIcon sx={{ fontSize: 14 }} />
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                        {customer.userId.slice(0, 8)}…
                      </Typography>
                    </Box>
                  )}
                  {(customer.createdAt || customer.joinedAt) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarTodayIcon sx={{ fontSize: 14 }} />
                      <Typography variant="body2">
                        Joined {new Date(customer.createdAt ?? customer.joinedAt ?? '').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
              {/* Action Buttons */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button variant="outlined" startIcon={<EditIcon />} size="small"
                  onClick={() => setEditOpen(true)}
                  sx={{ borderColor: '#00897B', color: '#00897B', fontWeight: 600, '&:hover': { bgcolor: '#E0F2F1' } }}>
                  Edit
                </Button>
                <Button variant="outlined" size="small"
                  startIcon={status === 'ACTIVE' ? <PauseCircleIcon /> : <CheckCircleIcon />}
                  onClick={toggleSuspend} disabled={actionLoading}
                  sx={{ borderColor: status === 'ACTIVE' ? '#F57F17' : '#1B5E20',
                    color: status === 'ACTIVE' ? '#F57F17' : '#1B5E20', fontWeight: 600,
                    '&:hover': { bgcolor: status === 'ACTIVE' ? '#FFF8E1' : '#E8F5E9' } }}>
                  {status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                </Button>
                {customer.userId && (
                  <Tooltip title="Reset customer's password and send email notification">
                    <Button variant="outlined" size="small" startIcon={<LockResetIcon />}
                      onClick={() => { setResetPwdValue(generatePassword()); setResetPwdOpen(true); }}
                      sx={{ borderColor: '#7B1FA2', color: '#7B1FA2', fontWeight: 600, '&:hover': { bgcolor: '#F3E5F5' } }}>
                      Reset Password
                    </Button>
                  </Tooltip>
                )}
                <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />}
                  onClick={() => setDeleteCustomerOpen(true)}
                  sx={{ fontWeight: 600 }}>
                  Delete
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Stats Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'DNS Queries', value: stats?.totalQueries ?? 0, icon: <DnsIcon />, color: '#1565C0', bg: '#E3F2FD' },
          { label: 'Blocked', value: stats?.totalBlocks ?? 0, icon: <BlockIcon />, color: '#E53935', bg: '#FFEBEE' },
          { label: 'Devices', value: (devices ?? []).length, icon: <DevicesIcon />, color: '#00897B', bg: '#E0F2F1' },
          { label: 'Profiles', value: (profiles ?? []).length, icon: <ChildCareIcon />, color: '#7B1FA2', bg: '#F3E5F5' },
        ].map((s, i) => (
          <Grid key={s.label} size={{ xs: 6, sm: 3 }}>
            <AnimatedPage delay={0.1 + i * 0.05}>
              <Card sx={{ textAlign: 'center', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' } }}>
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: s.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: s.color, mx: 'auto', mb: 1, '& svg': { fontSize: 18 } }}>
                    {s.icon}
                  </Box>
                  <Typography variant="h5" fontWeight={700} color={s.color}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
          borderBottom: 1, borderColor: 'divider',
          '& .Mui-selected': { color: '#00897B' },
          '& .MuiTabs-indicator': { bgcolor: '#00897B' },
        }}>
          <Tab label="Child Profiles" icon={<ChildCareIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Devices" icon={<DevicesIcon fontSize="small" />} iconPosition="start" />
        </Tabs>

        {/* Tab 0: Child Profiles */}
        {tab === 0 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1.5, borderBottom: '1px solid #F1F5F9' }}>
              <Button size="small" variant="contained" startIcon={<ChildCareIcon />}
                onClick={() => setAddProfileOpen(true)}
                disabled={(profiles ?? []).length >= (customer?.maxProfiles ?? 5)}
                sx={{ bgcolor: '#7B1FA2', '&:hover': { bgcolor: '#6A1B9A' }, fontSize: 12 }}>
                Add Child Profile
              </Button>
            </Box>
            {!profiles || profiles.length === 0 ? (
              <EmptyState
                icon={<ChildCareIcon sx={{ fontSize: 36, color: '#7B1FA2' }} />}
                title="No profiles"
                description="Add a child profile to start protecting this customer's family"
              />
            ) : (
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    {['Profile', 'Age', 'Filter Level', 'DNS Client', 'Status', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, color: '#64748B', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(profiles ?? []).map((p, i) => {
                    const fc = FILTER_COLORS[p.filterLevel ?? 'MODERATE'] ?? FILTER_COLORS.MODERATE;
                    return (
                      <TableRow key={p.id} hover sx={{
                        '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
                        animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
                      }}>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar sx={{ width: 32, height: 32, fontSize: 12, fontWeight: 700, bgcolor: '#7B1FA2' }}>
                              {getInitials(p.name)}
                            </Avatar>
                            <Typography fontWeight={600} fontSize={14}>{p.name ?? 'Profile'}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell><Typography variant="body2">{p.age ?? '—'}</Typography></TableCell>
                        <TableCell>
                          <Chip size="small" label={p.filterLevel ?? 'MODERATE'}
                            sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: fc.bg, color: fc.text }} />
                        </TableCell>
                        <TableCell>
                          {p.dnsClientId ? (
                            <Tooltip title="Copy DNS hostname">
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#1565C0', cursor: 'pointer' }}
                                onClick={() => { navigator.clipboard.writeText(p.dnsClientId!); setSnack('Copied!'); }}>
                                {p.dnsClientId}
                              </Typography>
                            </Tooltip>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={p.online ? 'Online' : 'Offline'}
                            color={p.online ? 'success' : 'default'}
                            sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Manage DNS Filtering">
                              <IconButton size="small" onClick={() => setDnsProfileOpen(p)}
                                sx={{ color: '#00897B', '&:hover': { bgcolor: '#E0F2F1' } }}>
                                <TuneIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Profile">
                              <IconButton size="small" onClick={() => setDeleteProfileOpen(p)}
                                sx={{ color: '#E53935', '&:hover': { bgcolor: '#FFEBEE' } }}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>
        )}

        {/* Tab 1: Devices */}
        {tab === 1 && (
          <Box>
            {!devices || devices.length === 0 ? (
              <EmptyState
                icon={<SmartphoneIcon sx={{ fontSize: 36, color: '#00897B' }} />}
                title="No devices"
                description="No devices have been registered for this customer's profiles"
              />
            ) : (
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    {['Device', 'Type', 'DNS Method', 'Status', 'Last Seen', 'Remove'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, color: '#64748B', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(devices ?? []).map((d, i) => (
                    <TableRow key={d.id} hover sx={{
                      '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
                      animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
                    }}>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{ width: 30, height: 30, bgcolor: '#E0F2F1' }}>
                            <SmartphoneIcon sx={{ color: '#00897B', fontSize: 16 }} />
                          </Avatar>
                          <Typography fontWeight={600} fontSize={14}>{d.name ?? 'Device'}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell><Chip size="small" label={d.deviceType ?? 'UNKNOWN'} sx={{ height: 20, fontSize: 10, fontWeight: 600 }} /></TableCell>
                      <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{d.dnsMethod ?? '—'}</Typography></TableCell>
                      <TableCell>
                        <Chip size="small" label={d.online ? 'Online' : 'Offline'} color={d.online ? 'success' : 'default'}
                          sx={{ height: 20, fontSize: 10, fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Remove Device">
                          <IconButton size="small" onClick={() => setDeleteDeviceOpen(d)}
                            sx={{ color: '#E53935', '&:hover': { bgcolor: '#FFEBEE' } }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        )}
      </Card>

      {/* Dialogs */}
      {editOpen && (
        <EditCustomerDialog customer={customer} open={editOpen} onClose={() => setEditOpen(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['isp-customer', id] }); setSnack('Customer plan updated successfully'); }} />
      )}
      {dnsProfileOpen && (
        <DnsRulesDialog profile={dnsProfileOpen} open={!!dnsProfileOpen} onClose={() => setDnsProfileOpen(null)} />
      )}
      <DeleteDialog
        open={deleteCustomerOpen}
        title="Delete this customer and all their data? This cannot be undone."
        onClose={() => setDeleteCustomerOpen(false)}
        onConfirm={handleDeleteCustomer}
        loading={actionLoading}
      />
      <DeleteDialog
        open={!!deleteProfileOpen}
        title={`Delete profile "${deleteProfileOpen?.name ?? 'this profile'}"? All DNS rules and data will be lost.`}
        onClose={() => setDeleteProfileOpen(null)}
        onConfirm={handleDeleteProfile}
        loading={actionLoading}
      />
      <DeleteDialog
        open={!!deleteDeviceOpen}
        title={`Remove device "${deleteDeviceOpen?.name ?? 'this device'}"?`}
        onClose={() => setDeleteDeviceOpen(null)}
        onConfirm={handleDeleteDevice}
        loading={actionLoading}
      />

      {/* Reset Password Dialog */}
      <Dialog open={resetPwdOpen} onClose={() => { if (!resetPwdLoading) setResetPwdOpen(false); }} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockResetIcon sx={{ color: '#7B1FA2' }} /> Reset Customer Password
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            A new password will be set and the customer will receive an email notification with their credentials.
          </Alert>
          <Stack spacing={1.5}>
            <TextField
              label="New Password"
              value={resetPwdValue}
              onChange={e => setResetPwdValue(e.target.value)}
              fullWidth size="small"
              helperText="Min. 8 characters"
              slotProps={{
                input: {
                  endAdornment: (
                    <Stack direction="row">
                      <Tooltip title="Copy password">
                        <IconButton size="small" onClick={() => { navigator.clipboard.writeText(resetPwdValue); setResetPwdCopied(true); setTimeout(() => setResetPwdCopied(false), 2000); }}>
                          <ContentCopyIcon fontSize="small" color={resetPwdCopied ? 'success' : 'inherit'} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Generate random password">
                        <IconButton size="small" onClick={() => setResetPwdValue(generatePassword())}>
                          <CasinoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ),
                },
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Typography variant="caption" color="text.secondary">
              Sending to: <strong>{customer?.email ?? 'customer email'}</strong>
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setResetPwdOpen(false); setResetPwdValue(''); }} disabled={resetPwdLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleResetPassword}
            disabled={resetPwdLoading || resetPwdValue.length < 8}
            sx={{ bgcolor: '#7B1FA2', '&:hover': { bgcolor: '#4A148C' }, minWidth: 140 }}>
            {resetPwdLoading ? <CircularProgress size={18} color="inherit" /> : 'Reset & Send Email'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Child Profile Dialog */}
      <Dialog open={addProfileOpen} onClose={() => { if (!addProfileLoading) setAddProfileOpen(false); }} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ChildCareIcon sx={{ color: '#7B1FA2' }} /> Add Child Profile
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField size="small" fullWidth label="Child's Name *" value={newProfileName}
              onChange={e => setNewProfileName(e.target.value)} autoFocus />
            <TextField size="small" fullWidth label="Age" type="number" value={newProfileAge}
              onChange={e => setNewProfileAge(e.target.value)} inputProps={{ min: 2, max: 18 }} />
            <FormControl fullWidth size="small">
              <InputLabel>Filter Level</InputLabel>
              <Select value={newProfileFilter} label="Filter Level" onChange={e => setNewProfileFilter(e.target.value)}>
                <MenuItem value="STRICT">Strict (recommended for young children)</MenuItem>
                <MenuItem value="MODERATE">Moderate (balanced)</MenuItem>
                <MenuItem value="RELAXED">Relaxed (for older teens)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setAddProfileOpen(false)} disabled={addProfileLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleAddProfile}
            disabled={addProfileLoading || !newProfileName.trim()}
            sx={{ bgcolor: '#7B1FA2', '&:hover': { bgcolor: '#6A1B9A' }, minWidth: 140 }}>
            {addProfileLoading ? <CircularProgress size={18} color="inherit" /> : 'Create Profile'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}
