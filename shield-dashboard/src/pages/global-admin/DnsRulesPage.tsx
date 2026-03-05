import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Switch, CircularProgress,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Tabs, Tab, Snackbar, Stack, IconButton, Tooltip, Alert,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import DnsIcon from '@mui/icons-material/Dns';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface CategoryRow { key: string; label: string; blocked: boolean; }

export default function DnsRulesPage() {
  const [tab, setTab] = useState(0);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState('');
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newType, setNewType] = useState<'BLOCK' | 'ALLOW'>('BLOCK');
  const [newReason, setNewReason] = useState('');
  const [domainError, setDomainError] = useState('');
  const [dirty, setDirty] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [catRes, platformRes] = await Promise.all([
        api.get('/dns/categories'),
        api.get('/dns/rules/platform'),
      ]);

      const catMap: Record<string, string> = catRes.data.data || catRes.data;
      const platform = platformRes.data.data;
      const enabledCats: Record<string, boolean> = platform.enabledCategories || {};

      // Build category rows: merge labels with current enabled/blocked state
      const rows: CategoryRow[] = Object.entries(catMap).map(([key, label]) => ({
        key,
        label,
        blocked: enabledCats[key] === false, // false = blocked, true = allowed
      }));

      // Sort: blocked first, then alphabetical
      rows.sort((a, b) => {
        if (a.blocked !== b.blocked) return a.blocked ? -1 : 1;
        return a.label.localeCompare(b.label);
      });

      setCategories(rows);
      setBlocklist(platform.customBlocklist || []);
      setAllowlist(platform.customAllowlist || []);
      setDirty(false);
    } catch (err) {
      setError('Failed to load DNS rules. Check that the DNS service is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = (index: number) => {
    setCategories(prev => prev.map((c, i) => i === index ? { ...c, blocked: !c.blocked } : c));
    setDirty(true);
  };

  const handleSaveCategories = async () => {
    setSaving(true);
    try {
      // Convert rows to API format: {key: boolean} where false=blocked, true=allowed
      const catMap: Record<string, boolean> = {};
      categories.forEach(c => { catMap[c.key] = !c.blocked; });
      await api.put('/dns/rules/platform/categories', { categories: catMap });
      setSnack('Category rules saved successfully');
      setDirty(false);
    } catch {
      setSnack('Failed to save category rules');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBlocklist = async (list: string[]) => {
    setSaving(true);
    try {
      await api.put('/dns/rules/platform/blocklist', { domains: list });
      setBlocklist(list);
      setSnack('Blocklist updated');
    } catch {
      setSnack('Failed to update blocklist');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllowlist = async (list: string[]) => {
    setSaving(true);
    try {
      await api.put('/dns/rules/platform/allowlist', { domains: list });
      setAllowlist(list);
      setSnack('Allowlist updated');
    } catch {
      setSnack('Failed to update allowlist');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) { setDomainError('Domain is required'); return; }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { setDomainError('Enter a valid domain (e.g. example.com)'); return; }

    if (newType === 'BLOCK') {
      if (blocklist.includes(domain)) { setDomainError('Domain already in blocklist'); return; }
      const updated = [...blocklist, domain];
      // Remove from allowlist if present
      const updatedAllow = allowlist.filter(d => d !== domain);
      handleSaveBlocklist(updated);
      if (updatedAllow.length !== allowlist.length) handleSaveAllowlist(updatedAllow);
    } else {
      if (allowlist.includes(domain)) { setDomainError('Domain already in allowlist'); return; }
      const updated = [...allowlist, domain];
      const updatedBlock = blocklist.filter(d => d !== domain);
      handleSaveAllowlist(updated);
      if (updatedBlock.length !== blocklist.length) handleSaveBlocklist(updatedBlock);
    }

    setSnack(`${domain} added to ${newType === 'BLOCK' ? 'blocklist' : 'allowlist'}`);
    setAddOpen(false); setNewDomain(''); setNewReason(''); setNewType('BLOCK'); setDomainError('');
  };

  const handleDeleteDomain = (domain: string, type: 'BLOCK' | 'ALLOW') => {
    if (type === 'BLOCK') {
      handleSaveBlocklist(blocklist.filter(d => d !== domain));
    } else {
      handleSaveAllowlist(allowlist.filter(d => d !== domain));
    }
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<DnsIcon />}
        title="Global DNS Rules"
        subtitle="Platform-wide content filter defaults for all new profiles"
        iconColor="#00897B"
      />

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #E8EDF2' }}>
        <Tab label="Category Filters" />
        <Tab label={`Custom Blocklist (${blocklist.length})`} />
        <Tab label={`Custom Allowlist (${allowlist.length})`} />
      </Tabs>

      <Box sx={{
        '@keyframes tabFadeIn': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      }}>
        {/* TAB 0 -- Category Filters */}
        {tab === 0 && (
          <Box sx={{ animation: 'tabFadeIn 0.4s ease both' }}>
            <Card>
              <CardContent sx={{ pb: '16px !important' }}>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
                ) : (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {categories.filter(c => c.blocked).length} of {categories.length} categories blocked
                      </Typography>
                      <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveCategories}
                        disabled={saving || !dirty} sx={{ bgcolor: '#1565C0' }}>
                        {saving ? <CircularProgress size={18} color="inherit" /> : 'Save Changes'}
                      </Button>
                    </Box>
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
                            <TableRow key={cat.key} hover sx={{
                              '& td': { py: 1 },
                              '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                              animation: `fadeInUp 0.3s ease ${idx * 0.02}s both`,
                            }}>
                              <TableCell><Typography variant="body2" fontWeight={600}>{cat.label}</Typography></TableCell>
                              <TableCell>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{cat.key}</Typography>
                              </TableCell>
                              <TableCell>
                                <Chip label={cat.blocked ? 'Blocked' : 'Allowed'} color={cat.blocked ? 'error' : 'success'} size="small"
                                  sx={{ fontWeight: 600, fontSize: 11 }} />
                              </TableCell>
                              <TableCell align="center">
                                <Switch
                                  checked={cat.blocked}
                                  onChange={() => handleToggle(idx)}
                                  size="small"
                                  color="error"
                                  sx={{
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#E53935' },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#E53935', opacity: 0.5 },
                                    '& .MuiSwitch-track': { borderRadius: 10 },
                                    '& .MuiSwitch-thumb': { boxShadow: '0 2px 4px rgba(0,0,0,0.15)' },
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </CardContent>
            </Card>
          </Box>
        )}

        {/* TAB 1 -- Custom Blocklist */}
        {tab === 1 && (
          <Box sx={{ animation: 'tabFadeIn 0.4s ease both' }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="contained" startIcon={<AddIcon />} color="error" onClick={() => { setNewType('BLOCK'); setAddOpen(true); }}>
                Add Blocked Domain
              </Button>
            </Box>
            <DomainTable domains={blocklist} type="BLOCK" onDelete={(d) => handleDeleteDomain(d, 'BLOCK')} color="error" />
          </Box>
        )}

        {/* TAB 2 -- Custom Allowlist */}
        {tab === 2 && (
          <Box sx={{ animation: 'tabFadeIn 0.4s ease both' }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="contained" startIcon={<AddIcon />} color="success" onClick={() => { setNewType('ALLOW'); setAddOpen(true); }}>
                Add Allowed Domain
              </Button>
            </Box>
            <DomainTable domains={allowlist} type="ALLOW" onDelete={(d) => handleDeleteDomain(d, 'ALLOW')} color="success" />
          </Box>
        )}
      </Box>

      {/* Add Domain Dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setDomainError(''); }} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Add Domain to {newType === 'BLOCK' ? 'Blocklist' : 'Allowlist'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <ToggleButtonGroup value={newType} exclusive onChange={(_, v) => v && setNewType(v)} fullWidth size="small">
              <ToggleButton value="BLOCK" color="error">Block</ToggleButton>
              <ToggleButton value="ALLOW" color="success">Allow</ToggleButton>
            </ToggleButtonGroup>
            <TextField fullWidth label="Domain *" placeholder="e.g. example.com" value={newDomain}
              onChange={e => { setNewDomain(e.target.value); setDomainError(''); }}
              error={!!domainError} helperText={domainError || 'Enter the root domain without http://'} />
            <TextField fullWidth label="Reason (optional)" placeholder="e.g. Educational whitelist" value={newReason}
              onChange={e => setNewReason(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setAddOpen(false); setDomainError(''); }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddDomain} disabled={saving}
            color={newType === 'BLOCK' ? 'error' : 'success'}>
            Add Domain
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}

function DomainTable({ domains, type, onDelete, color }: { domains: string[]; type: string; onDelete: (d: string) => void; color: 'error' | 'success' }) {
  if (domains.length === 0) return (
    <Card>
      <EmptyState
        icon={<DnsIcon sx={{ fontSize: 36, color: color === 'error' ? '#E53935' : '#43A047' }} />}
        title={`No custom ${color === 'error' ? 'blocked' : 'allowed'} domains`}
        description={`Add domains to the ${color === 'error' ? 'blocklist' : 'allowlist'} using the button above`}
      />
    </Card>
  );
  return (
    <Card>
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
            {domains.map((domain, idx) => (
              <TableRow key={domain} hover sx={{
                '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                animation: `fadeInUp 0.3s ease ${idx * 0.05}s both`,
              }}>
                <TableCell><Typography fontWeight={600} sx={{ fontFamily: 'monospace' }}>{domain}</Typography></TableCell>
                <TableCell><Chip size="small" label={type} color={color} sx={{ fontWeight: 600, fontSize: 11 }} /></TableCell>
                <TableCell>
                  <Tooltip title="Remove">
                    <IconButton size="small" color="error" onClick={() => onDelete(domain)}
                      sx={{ transition: 'transform 0.15s ease', '&:hover': { transform: 'scale(1.15)' } }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
