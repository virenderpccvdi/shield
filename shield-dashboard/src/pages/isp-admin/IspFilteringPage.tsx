import { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Card, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Switch, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, CircularProgress, IconButton, Tooltip,
  Snackbar, Alert, Stack, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface CategoryRow { key: string; label: string; blocked: boolean; }
interface DomainEntry { id?: string; domain: string; reason?: string; }

export default function IspFilteringPage() {
  const [tab, setTab] = useState(0);

  // Categories tab
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catDirty, setCatDirty] = useState(false);
  const [catSaving, setCatSaving] = useState(false);

  // Blocklist tab
  const [blocked, setBlocked] = useState<DomainEntry[]>([]);
  const [blockLoading, setBlockLoading] = useState(false);

  // Allowlist tab
  const [allowed, setAllowed] = useState<DomainEntry[]>([]);
  const [allowLoading, setAllowLoading] = useState(false);

  // Platform inherited rules
  const [platformBlocklist, setPlatformBlocklist] = useState<string[]>([]);
  const [platformAllowlist, setPlatformAllowlist] = useState<string[]>([]);

  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newListType, setNewListType] = useState<'block' | 'allow'>('block');
  const [domainErr, setDomainErr] = useState('');
  const [saving, setSaving] = useState(false);

  // Load categories + tenant DNS settings
  const loadCategories = useCallback(async () => {
    setCatLoading(true);
    setError('');
    try {
      const [catRes, tenantRes, platformRes] = await Promise.all([
        api.get('/dns/categories'),
        api.get('/dns/rules/tenant').catch(() => ({ data: { data: null } })),
        api.get('/dns/rules/platform').catch(() => ({ data: { data: null } })),
      ]);
      const pd = platformRes.data?.data;
      if (pd) {
        setPlatformBlocklist(pd.customBlocklist || []);
        setPlatformAllowlist(pd.customAllowlist || []);
      }
      const catMap: Record<string, string> = catRes.data.data || catRes.data;
      const tenantSettings = tenantRes.data?.data;
      const enabledCats: Record<string, boolean> = tenantSettings?.enabledCategories || {};
      const rows: CategoryRow[] = Object.entries(catMap).map(([key, label]) => ({
        key, label: label as string,
        blocked: enabledCats[key] === false,
      }));
      rows.sort((a, b) => {
        if (a.blocked !== b.blocked) return a.blocked ? -1 : 1;
        return a.label.localeCompare(b.label);
      });
      setCategories(rows);
      setCatDirty(false);
    } catch {
      setError('Failed to load DNS settings.');
    } finally {
      setCatLoading(false);
    }
  }, []);

  const loadBlocklist = useCallback(async () => {
    setBlockLoading(true);
    try {
      const res = await api.get('/tenants/blocklist');
      const d = res.data?.data ?? res.data ?? [];
      const list = Array.isArray(d) ? d : d.content ?? [];
      setBlocked(list.map((e: any) => ({ id: e.id, domain: e.domain, reason: e.reason })));
    } catch {
      setError('Failed to load blocklist.');
    } finally {
      setBlockLoading(false);
    }
  }, []);

  const loadAllowlist = useCallback(async () => {
    setAllowLoading(true);
    try {
      const res = await api.get('/tenants/allowlist');
      const d = res.data?.data ?? res.data ?? [];
      const list = Array.isArray(d) ? d : d.content ?? [];
      setAllowed(list.map((e: any) => ({ id: e.id, domain: e.domain, reason: e.reason })));
    } catch {
      setError('Failed to load allowlist.');
    } finally {
      setAllowLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const handleTabChange = (_: any, v: number) => {
    setTab(v);
    if (v === 1 && !blocked.length) loadBlocklist();
    if (v === 2 && !allowed.length) loadAllowlist();
  };

  const handleCatToggle = (i: number) => {
    setCategories(prev => prev.map((c, idx) => idx === i ? { ...c, blocked: !c.blocked } : c));
    setCatDirty(true);
  };

  const handleSaveCategories = async () => {
    setCatSaving(true);
    try {
      const payload: Record<string, boolean> = {};
      categories.forEach(c => { payload[c.key] = !c.blocked; }); // true = enabled, false = blocked
      await api.put('/dns/rules/tenant/categories', { categories: payload }).catch(() => {
        // Fallback: try the base endpoint
        return api.put('/dns/rules/tenant', { enabledCategories: payload });
      });
      setSnack('Content categories saved');
      setCatDirty(false);
    } catch {
      setSnack('Failed to save categories');
    } finally {
      setCatSaving(false);
    }
  };

  const handleAddDomain = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) { setDomainErr('Domain is required'); return; }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { setDomainErr('Enter a valid domain'); return; }
    setSaving(true);
    try {
      if (newListType === 'block') {
        await api.post('/tenants/blocklist', { domain, reason: newReason });
        setSnack(`${domain} added to blocklist`);
        loadBlocklist();
      } else {
        await api.post('/tenants/allowlist', { domain, reason: newReason });
        setSnack(`${domain} added to allowlist`);
        loadAllowlist();
      }
      setAddOpen(false);
      setNewDomain(''); setNewReason(''); setDomainErr('');
    } catch (e: any) {
      setSnack(e?.response?.data?.message || 'Failed to add domain');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDomain = async (entry: DomainEntry, type: 'block' | 'allow') => {
    const base = type === 'block' ? '/tenants/blocklist' : '/tenants/allowlist';
    try {
      if (entry.id) await api.delete(`${base}/${entry.id}`);
      setSnack(`${entry.domain} removed`);
      if (type === 'block') setBlocked(p => p.filter(d => d.domain !== entry.domain));
      else setAllowed(p => p.filter(d => d.domain !== entry.domain));
    } catch {
      setSnack('Failed to remove domain');
    }
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<DnsIcon />}
        title="DNS Filtering"
        subtitle="Content categories, blocked and allowed domains for your tenant"
        iconColor="#00695C"
        action={
          tab > 0 ? (
            <Button variant="contained" startIcon={<AddIcon />}
              onClick={() => { setNewListType(tab === 1 ? 'block' : 'allow'); setAddOpen(true); }}
              sx={{ bgcolor: tab === 1 ? '#B71C1C' : '#1B5E20', '&:hover': { bgcolor: tab === 1 ? '#C62828' : '#2E7D32' } }}>
              Add {tab === 1 ? 'Blocked' : 'Allowed'} Domain
            </Button>
          ) : catDirty ? (
            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveCategories}
              disabled={catSaving}
              sx={{ bgcolor: '#004D40', '&:hover': { bgcolor: '#00695C' } }}>
              {catSaving ? <CircularProgress size={18} color="inherit" /> : 'Save Changes'}
            </Button>
          ) : null
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <Card>
        <Tabs value={tab} onChange={handleTabChange} sx={{
          borderBottom: '1px solid', borderColor: 'divider',
          '& .MuiTab-root': { fontWeight: 600, fontSize: 13 },
          '& .Mui-selected': { color: '#00695C' },
          '& .MuiTabs-indicator': { bgcolor: '#00695C' },
        }}>
          <Tab label="Content Categories" icon={<DnsIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Blocked Domains" icon={<BlockIcon fontSize="small" />} iconPosition="start" />
          <Tab label="Allowed Domains" icon={<CheckCircleIcon fontSize="small" />} iconPosition="start" />
        </Tabs>

        {/* Tab 0: Categories */}
        {tab === 0 && (
          catLoading ? (
            <LoadingPage />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F0FAF8' }}>
                    {['Category', 'Status', 'Block'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.map((cat, i) => (
                    <TableRow key={cat.key} hover sx={{
                      '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                      animation: `fadeInUp 0.25s ease ${i * 0.03}s both`,
                    }}>
                      <TableCell>
                        <Typography fontWeight={600} fontSize={14}>{cat.label}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{cat.key}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={cat.blocked ? 'Blocked' : 'Allowed'}
                          sx={{ height: 22, fontSize: 11, fontWeight: 600,
                            bgcolor: cat.blocked ? '#FFEBEE' : '#E8F5E9',
                            color: cat.blocked ? '#B71C1C' : '#1B5E20' }} />
                      </TableCell>
                      <TableCell>
                        <Switch checked={cat.blocked} onChange={() => handleCatToggle(i)}
                          size="small"
                          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#E53935' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#EF9A9A' } }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )
        )}

        {/* Tab 1: Blocklist */}
        {tab === 1 && (
          blockLoading ? (
            <LoadingPage />
          ) : (
            <>
              {platformBlocklist.length > 0 && (
                <Box sx={{ px: 2, py: 1.5, bgcolor: '#FFF3E0', borderBottom: '1px solid #FFE0B2' }}>
                  <Typography variant="caption" fontWeight={700} color="#E65100" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Platform-Inherited Rules ({platformBlocklist.length} domains — managed by Super Admin)
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                    {platformBlocklist.map(d => (
                      <Chip key={d} size="small" label={d} sx={{ height: 22, fontSize: 11, bgcolor: '#FFCCBC', color: '#BF360C', fontFamily: 'monospace' }} />
                    ))}
                  </Box>
                </Box>
              )}
              {blocked.length === 0 && platformBlocklist.length === 0 ? (
                <EmptyState icon={<BlockIcon sx={{ fontSize: 36, color: '#B71C1C' }} />} title="No blocked domains" description="Add domains to block for all customers in your tenant" />
              ) : blocked.length > 0 ? (
                <DomainTable entries={blocked} onDelete={e => handleDeleteDomain(e, 'block')} color="#B71C1C" bg="#FFEBEE" />
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No ISP-specific blocked domains. Add domains above.</Typography>
                </Box>
              )}
            </>
          )
        )}

        {/* Tab 2: Allowlist */}
        {tab === 2 && (
          allowLoading ? (
            <LoadingPage />
          ) : (
            <>
              {platformAllowlist.length > 0 && (
                <Box sx={{ px: 2, py: 1.5, bgcolor: '#E8F5E9', borderBottom: '1px solid #C8E6C9' }}>
                  <Typography variant="caption" fontWeight={700} color="#1B5E20" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Platform-Inherited Rules ({platformAllowlist.length} domains — managed by Super Admin)
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                    {platformAllowlist.map(d => (
                      <Chip key={d} size="small" label={d} sx={{ height: 22, fontSize: 11, bgcolor: '#C8E6C9', color: '#1B5E20', fontFamily: 'monospace' }} />
                    ))}
                  </Box>
                </Box>
              )}
              {allowed.length === 0 && platformAllowlist.length === 0 ? (
                <EmptyState icon={<CheckCircleIcon sx={{ fontSize: 36, color: '#1B5E20' }} />} title="No allowed domains" description="Add domains to always allow for your tenant's customers" />
              ) : allowed.length > 0 ? (
                <DomainTable entries={allowed} onDelete={e => handleDeleteDomain(e, 'allow')} color="#1B5E20" bg="#E8F5E9" />
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No ISP-specific allowed domains. Add domains above.</Typography>
                </Box>
              )}
            </>
          )
        )}
      </Card>

      {/* Add Domain Dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setDomainErr(''); }} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>
          Add to {newListType === 'block' ? 'Blocklist' : 'Allowlist'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <ToggleButtonGroup exclusive value={newListType} onChange={(_, v) => v && setNewListType(v)} size="small" fullWidth>
              <ToggleButton value="block" sx={{ fontWeight: 600, '&.Mui-selected': { bgcolor: '#FFEBEE', color: '#B71C1C' } }}>
                <BlockIcon fontSize="small" sx={{ mr: 0.5 }} /> Block
              </ToggleButton>
              <ToggleButton value="allow" sx={{ fontWeight: 600, '&.Mui-selected': { bgcolor: '#E8F5E9', color: '#1B5E20' } }}>
                <CheckCircleIcon fontSize="small" sx={{ mr: 0.5 }} /> Allow
              </ToggleButton>
            </ToggleButtonGroup>
            <TextField fullWidth label="Domain *" placeholder="e.g. tiktok.com"
              value={newDomain} onChange={e => { setNewDomain(e.target.value); setDomainErr(''); }}
              error={!!domainErr} helperText={domainErr || 'Root domain without http://'} />
            <TextField fullWidth label="Reason (optional)" placeholder="e.g. Social media not allowed"
              value={newReason} onChange={e => setNewReason(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setAddOpen(false); setDomainErr(''); }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddDomain} disabled={saving}
            sx={{ bgcolor: newListType === 'block' ? '#B71C1C' : '#1B5E20', '&:hover': { opacity: 0.9 } }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Add Domain'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}

function DomainTable({ entries, onDelete, color, bg }: { entries: DomainEntry[]; onDelete: (e: DomainEntry) => void; color: string; bg: string }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: '#F8FAFC' }}>
            {['Domain', 'Reason', 'Remove'].map(h => (
              <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((row, idx) => (
            <TableRow key={row.domain} hover sx={{
              '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
              animation: `fadeInUp 0.3s ease ${idx * 0.04}s both`,
            }}>
              <TableCell>
                <Chip size="small" label={row.domain}
                  sx={{ height: 24, fontFamily: 'monospace', fontWeight: 600, fontSize: 12, bgcolor: bg, color }} />
              </TableCell>
              <TableCell><Typography variant="body2" color="text.secondary">{row.reason || '—'}</Typography></TableCell>
              <TableCell>
                <Tooltip title="Remove">
                  <IconButton size="small" onClick={() => onDelete(row)}
                    sx={{ color, transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.15)' } }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
