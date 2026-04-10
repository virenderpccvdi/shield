import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Switch, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, CircularProgress, IconButton, Tooltip,
  Snackbar, Alert, Stack, ToggleButton, ToggleButtonGroup, Grid, FormControlLabel,
} from '@mui/material';
import DnsIcon from '@mui/icons-material/Dns';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SecurityIcon from '@mui/icons-material/Security';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface CategoryRow { key: string; label: string; blocked: boolean; }

interface TenantDnsSettings {
  tenantId: string;
  enabledCategories: Record<string, boolean>;
  customBlocklist: string[];
  customAllowlist: string[];
  safesearchEnabled: boolean;
  adsBlocked: boolean;
}

export default function IspDnsPage() {
  const [tab, setTab] = useState(0);
  const [settings, setSettings] = useState<TenantDnsSettings | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newListType, setNewListType] = useState<'block' | 'allow'>('block');
  const [domainErr, setDomainErr] = useState('');
  const [catDirty, setCatDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [catRes, tenantRes] = await Promise.all([
        api.get('/dns/categories'),
        api.get('/dns/rules/tenant').catch(() => ({ data: { data: null } })),
      ]);
      const catMap: Record<string, string> = catRes.data.data || catRes.data;
      const s: TenantDnsSettings = tenantRes.data?.data ?? {
        tenantId: '', enabledCategories: {}, customBlocklist: [], customAllowlist: [],
        safesearchEnabled: false, adsBlocked: false,
      };
      setSettings(s);
      const rows: CategoryRow[] = Object.entries(catMap).map(([key, label]) => ({
        key, label: label as string,
        blocked: s.enabledCategories[key] === false,
      }));
      rows.sort((a, b) => {
        if (a.blocked !== b.blocked) return a.blocked ? -1 : 1;
        return a.label.localeCompare(b.label);
      });
      setCategories(rows);
      setCatDirty(false);
    } catch {
      setError('Failed to load DNS configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-save categories 600ms after last toggle
  const scheduleSave = useCallback((rows: CategoryRow[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const catMap: Record<string, boolean> = {};
        rows.forEach(c => { catMap[c.key] = !c.blocked; });
        await api.put('/dns/rules/tenant/categories', { categories: catMap });
        setSnack('Category filters saved');
        setCatDirty(false);
      } catch {
        setSnack('Failed to save category filters');
      } finally {
        setSaving(false);
      }
    }, 600);
  }, []);

  const handleToggle = (index: number) => {
    setCategories(prev => {
      const updated = prev.map((c, i) => i === index ? { ...c, blocked: !c.blocked } : c);
      setCatDirty(true);
      scheduleSave(updated);
      return updated;
    });
  };

  const handleToggleSafesearch = async () => {
    if (!settings) return;
    const updated = { ...settings, safesearchEnabled: !settings.safesearchEnabled };
    setSettings(updated);
    try {
      await api.put('/dns/rules/tenant/categories', {
        categories: { SAFESEARCH: updated.safesearchEnabled },
      });
      setSnack(`SafeSearch ${updated.safesearchEnabled ? 'enabled' : 'disabled'}`);
    } catch { setSnack('Failed to update SafeSearch'); }
  };

  const handleToggleAds = async () => {
    if (!settings) return;
    const updated = { ...settings, adsBlocked: !settings.adsBlocked };
    setSettings(updated);
    try {
      await api.put('/dns/rules/tenant/categories', {
        categories: { ADS_TRACKERS: updated.adsBlocked },
      });
      setSnack(`Ad blocking ${updated.adsBlocked ? 'enabled' : 'disabled'}`);
    } catch { setSnack('Failed to update ad blocking'); }
  };

  const handleAddDomain = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) { setDomainErr('Domain is required'); return; }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { setDomainErr('Enter a valid domain (e.g. example.com)'); return; }
    if (!settings) return;

    setSaving(true);
    try {
      if (newListType === 'block') {
        if (settings.customBlocklist.includes(domain)) { setDomainErr('Domain already in blocklist'); setSaving(false); return; }
        const updated = [...settings.customBlocklist, domain];
        await api.put('/dns/rules/tenant/blocklist', { domains: updated });
        setSettings(s => s ? { ...s, customBlocklist: updated } : s);
        setSnack(`${domain} added to blocklist`);
      } else {
        if (settings.customAllowlist.includes(domain)) { setDomainErr('Domain already in allowlist'); setSaving(false); return; }
        const updated = [...settings.customAllowlist, domain];
        await api.put('/dns/rules/tenant/allowlist', { domains: updated });
        setSettings(s => s ? { ...s, customAllowlist: updated } : s);
        setSnack(`${domain} added to allowlist`);
      }
      setAddOpen(false); setNewDomain(''); setNewReason(''); setDomainErr('');
    } catch {
      setSnack('Failed to add domain');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDomain = async (domain: string, type: 'block' | 'allow') => {
    if (!settings) return;
    try {
      if (type === 'block') {
        const updated = settings.customBlocklist.filter(d => d !== domain);
        await api.put('/dns/rules/tenant/blocklist', { domains: updated });
        setSettings(s => s ? { ...s, customBlocklist: updated } : s);
        setSnack(`${domain} removed from blocklist`);
      } else {
        const updated = settings.customAllowlist.filter(d => d !== domain);
        await api.put('/dns/rules/tenant/allowlist', { domains: updated });
        setSettings(s => s ? { ...s, customAllowlist: updated } : s);
        setSnack(`${domain} removed from allowlist`);
      }
    } catch {
      setSnack('Failed to remove domain');
    }
  };

  const blockedCount = categories.filter(c => c.blocked).length;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<DnsIcon />}
        title="DNS Configuration"
        subtitle="Manage DNS filtering rules, blocklists, and allowlists for your tenant"
        iconColor="#00897B"
      />

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {loading ? <LoadingPage /> : (
        <>
          {/* Quick settings */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ borderLeft: '4px solid #1565C0', height: '100%' }}>
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                    Active Filters
                  </Typography>
                  <Typography variant="h4" fontWeight={800} color="#1565C0">{blockedCount}</Typography>
                  <Typography variant="caption" color="text.secondary">of {categories.length} categories</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ borderLeft: '4px solid #E53935', height: '100%' }}>
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                    Blocked Domains
                  </Typography>
                  <Typography variant="h4" fontWeight={800} color="#E53935">{settings?.customBlocklist.length ?? 0}</Typography>
                  <Typography variant="caption" color="text.secondary">custom blocked</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ borderLeft: '4px solid #43A047', height: '100%' }}>
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                    Allowed Domains
                  </Typography>
                  <Typography variant="h4" fontWeight={800} color="#43A047">{settings?.customAllowlist.length ?? 0}</Typography>
                  <Typography variant="caption" color="text.secondary">custom allowed</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ borderLeft: '4px solid #7B1FA2', height: '100%' }}>
                <CardContent sx={{ py: 1.5 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" fontWeight={600} color="text.secondary">SafeSearch</Typography>
                      <Switch size="small" checked={settings?.safesearchEnabled ?? false} onChange={handleToggleSafesearch}
                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#7B1FA2' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#7B1FA2' } }} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" fontWeight={600} color="text.secondary">Block Ads</Typography>
                      <Switch size="small" checked={settings?.adsBlocked ?? false} onChange={handleToggleAds}
                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#7B1FA2' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#7B1FA2' } }} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #E8EDF2' }}>
            <Tab label={`Category Filters (${blockedCount} blocked)`} />
            <Tab label={`Custom Blocklist (${settings?.customBlocklist.length ?? 0})`} />
            <Tab label={`Custom Allowlist (${settings?.customAllowlist.length ?? 0})`} />
          </Tabs>

          {/* TAB 0 — Categories */}
          {tab === 0 && (
            <Card>
              <CardContent sx={{ pb: '16px !important' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Toggles save automatically · {saving && <CircularProgress size={12} sx={{ ml: 0.5, verticalAlign: 'middle' }} />}
                    {!saving && catDirty && <Chip label="Saving..." size="small" sx={{ ml: 1, height: 18, fontSize: 10 }} />}
                    {!saving && !catDirty && <Chip label="Saved" size="small" icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                      sx={{ ml: 1, height: 18, fontSize: 10, bgcolor: '#E8F5E9', color: '#2E7D32' }} />}
                  </Typography>
                </Box>
                <Box sx={{ overflowX: 'auto' }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 } }}>
                          <TableCell>Category</TableCell>
                          <TableCell>Key</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="center">Block</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {categories.map((cat, idx) => (
                          <TableRow key={cat.key} hover sx={{ '& td': { py: 1 } }}>
                            <TableCell><Typography variant="body2" fontWeight={600}>{cat.label}</Typography></TableCell>
                            <TableCell>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{cat.key}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={cat.blocked ? 'Blocked' : 'Allowed'} color={cat.blocked ? 'error' : 'success'} size="small"
                                sx={{ fontWeight: 600, fontSize: 11 }} />
                            </TableCell>
                            <TableCell align="center">
                              <Switch checked={cat.blocked} onChange={() => handleToggle(idx)} size="small" color="error"
                                sx={{
                                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#E53935' },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#E53935', opacity: 0.5 },
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* TAB 1 — Blocklist */}
          {tab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<AddIcon />} color="error"
                  onClick={() => { setNewListType('block'); setAddOpen(true); }}>
                  Add Blocked Domain
                </Button>
              </Box>
              <DomainList domains={settings?.customBlocklist ?? []} type="block"
                onDelete={(d) => handleDeleteDomain(d, 'block')} />
            </Box>
          )}

          {/* TAB 2 — Allowlist */}
          {tab === 2 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<AddIcon />} color="success"
                  onClick={() => { setNewListType('allow'); setAddOpen(true); }}>
                  Add Allowed Domain
                </Button>
              </Box>
              <DomainList domains={settings?.customAllowlist ?? []} type="allow"
                onDelete={(d) => handleDeleteDomain(d, 'allow')} />
            </Box>
          )}
        </>
      )}

      {/* Add Domain Dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setDomainErr(''); }} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Add Domain to {newListType === 'block' ? 'Blocklist' : 'Allowlist'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <ToggleButtonGroup value={newListType} exclusive onChange={(_, v) => v && setNewListType(v)} fullWidth size="small">
              <ToggleButton value="block" color="error">Block</ToggleButton>
              <ToggleButton value="allow" color="success">Allow</ToggleButton>
            </ToggleButtonGroup>
            <TextField fullWidth label="Domain *" placeholder="e.g. example.com" value={newDomain}
              onChange={e => { setNewDomain(e.target.value); setDomainErr(''); }}
              error={!!domainErr} helperText={domainErr || 'Enter root domain without http://'} />
            <TextField fullWidth label="Reason (optional)" value={newReason}
              onChange={e => setNewReason(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setAddOpen(false); setDomainErr(''); }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddDomain} disabled={saving}
            color={newListType === 'block' ? 'error' : 'success'}>
            {saving ? <CircularProgress size={16} color="inherit" /> : 'Add Domain'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}

function DomainList({ domains, type, onDelete }: { domains: string[]; type: 'block' | 'allow'; onDelete: (d: string) => void }) {
  if (domains.length === 0) return (
    <Card>
      <EmptyState
        icon={type === 'block'
          ? <BlockIcon sx={{ fontSize: 36, color: '#E53935' }} />
          : <CheckCircleIcon sx={{ fontSize: 36, color: '#43A047' }} />}
        title={`No custom ${type === 'block' ? 'blocked' : 'allowed'} domains`}
        description={`Add domains to the ${type === 'block' ? 'blocklist' : 'allowlist'} using the button above`}
      />
    </Card>
  );
  return (
    <Card>
      <Box sx={{ overflowX: 'auto' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {['Domain', 'Type', 'Remove'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {domains.map(domain => (
                <TableRow key={domain} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{domain}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={type === 'block' ? 'BLOCKED' : 'ALLOWED'}
                      size="small"
                      color={type === 'block' ? 'error' : 'success'}
                      sx={{ fontWeight: 700, fontSize: 10 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Remove">
                      <IconButton size="small" onClick={() => onDelete(domain)} color="error">
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Card>
  );
}
