import { useState, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Switch, Chip, Button, CircularProgress, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  List, ListItem, ListItemText, Snackbar, Alert, LinearProgress, Divider,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import SecurityIcon from '@mui/icons-material/Security';
import BlockIcon from '@mui/icons-material/Block';
import CasinoIcon from '@mui/icons-material/Casino';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import PeopleIcon from '@mui/icons-material/People';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import BugReportIcon from '@mui/icons-material/BugReport';
import PhishingIcon from '@mui/icons-material/Phishing';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

interface Category { id: string; name: string; key: string; blocked: boolean; alwaysOn?: boolean; emoji: string; }

interface DnsRulesResponse {
  profileId: string;
  enabledCategories: Record<string, boolean>;
  customAllowlist: string[];
  customBlocklist: string[];
}

const CATEGORY_META: Record<string, { name: string; alwaysOn?: boolean }> = {
  adult: { name: 'Adult Content' },
  gambling: { name: 'Gambling' },
  gaming: { name: 'Gaming' },
  social: { name: 'Social Media' },
  streaming: { name: 'Streaming' },
  drugs: { name: 'Drugs' },
  violence: { name: 'Violence / Weapons' },
  malware: { name: 'Malware', alwaysOn: true },
  phishing: { name: 'Phishing', alwaysOn: true },
  vpn: { name: 'VPN / Proxy' },
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Adult Content', key: 'adult', blocked: true, alwaysOn: false, emoji: '18+' },
  { id: '2', name: 'Gambling', key: 'gambling', blocked: true, alwaysOn: false, emoji: '[G]' },
  { id: '3', name: 'Gaming', key: 'gaming', blocked: false, alwaysOn: false, emoji: '[V]' },
  { id: '4', name: 'Social Media', key: 'social', blocked: false, alwaysOn: false, emoji: '[S]' },
  { id: '5', name: 'Streaming', key: 'streaming', blocked: false, alwaysOn: false, emoji: '[TV]' },
  { id: '6', name: 'Drugs', key: 'drugs', blocked: true, alwaysOn: false, emoji: '[D]' },
  { id: '7', name: 'Violence / Weapons', key: 'violence', blocked: true, alwaysOn: false, emoji: '[!]' },
  { id: '8', name: 'Malware', key: 'malware', blocked: true, alwaysOn: true, emoji: '[M]' },
  { id: '9', name: 'Phishing', key: 'phishing', blocked: true, alwaysOn: true, emoji: '[P]' },
  { id: '10', name: 'VPN / Proxy', key: 'vpn', blocked: true, alwaysOn: false, emoji: '[L]' },
];

function rulesToCategories(rules: DnsRulesResponse): Category[] {
  // enabledCategories: true = allowed, false = blocked (UI "blocked" is the opposite)
  return Object.entries(rules.enabledCategories).map(([key, enabled], i) => {
    const meta = CATEGORY_META[key] || { name: key };
    return { id: String(i + 1), name: meta.name, key, blocked: !enabled, alwaysOn: meta.alwaysOn || false, emoji: '' };
  });
}

const categoryIcons: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  adult: { icon: <BlockIcon />, color: '#E53935', bg: '#FFEBEE' },
  gambling: { icon: <CasinoIcon />, color: '#FB8C00', bg: '#FFF3E0' },
  gaming: { icon: <SportsEsportsIcon />, color: '#7B1FA2', bg: '#F3E5F5' },
  social: { icon: <PeopleIcon />, color: '#1565C0', bg: '#E3F2FD' },
  streaming: { icon: <LiveTvIcon />, color: '#00897B', bg: '#E0F2F1' },
  drugs: { icon: <LocalPharmacyIcon />, color: '#C62828', bg: '#FFEBEE' },
  violence: { icon: <ReportProblemIcon />, color: '#D84315', bg: '#FBE9E7' },
  malware: { icon: <BugReportIcon />, color: '#B71C1C', bg: '#FFCDD2' },
  phishing: { icon: <PhishingIcon />, color: '#880E4F', bg: '#FCE4EC' },
  vpn: { icon: <VpnKeyIcon />, color: '#4527A0', bg: '#EDE7F6' },
};

const parseDomainsCsv = (text: string): string[] => {
  return text
    .split(/[\n,\r]+/)
    .map(line => line.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(d => d.length > 3 && d.includes('.') && !d.startsWith('#'));
};

interface CsvImportDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onImport: (domains: string[], onProgress: (done: number, total: number) => void) => Promise<void>;
}

function CsvImportDialog({ open, title, onClose, onImport }: CsvImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setDomains(parseDomainsCsv(text));
    };
    reader.readAsText(file);
  };

  const handleConfirm = async () => {
    setImporting(true);
    setDone(false);
    try {
      await onImport(domains, (d, t) => setProgress({ done: d, total: t }));
      setDone(true);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (importing) return;
    setDomains([]);
    setProgress(null);
    setDone(false);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        {done ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon sx={{ fontSize: 56, color: '#43A047', mb: 1 }} />
            <Typography variant="h6" fontWeight={700}>Import Complete</Typography>
            <Typography color="text.secondary">{domains.length} domains imported successfully</Typography>
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload a CSV or TXT file. Each line or comma-separated value should be a domain (e.g. <code>example.com</code>).
              Lines starting with # are skipped.
            </Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
              fullWidth
              sx={{ mb: 2, borderStyle: 'dashed', py: 2 }}
            >
              Choose File (.csv / .txt)
              <input ref={fileRef} type="file" accept=".csv,.txt" hidden onChange={handleFile} />
            </Button>

            {domains.length > 0 && (
              <Box>
                <Chip
                  label={`Found ${domains.length} domain${domains.length !== 1 ? 's' : ''} to import`}
                  color="success"
                  sx={{ mb: 1.5, fontWeight: 600 }}
                />
                <Box sx={{ maxHeight: 180, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1 }}>
                  <List dense disablePadding>
                    {domains.slice(0, 50).map((d, i) => (
                      <ListItem key={i} disablePadding sx={{ py: 0.25 }}>
                        <ListItemText primaryTypographyProps={{ fontSize: 13 }} primary={d} />
                      </ListItem>
                    ))}
                    {domains.length > 50 && (
                      <ListItem disablePadding sx={{ py: 0.5 }}>
                        <ListItemText primaryTypographyProps={{ fontSize: 12, color: 'text.secondary' }} primary={`...and ${domains.length - 50} more`} />
                      </ListItem>
                    )}
                  </List>
                </Box>
              </Box>
            )}

            {importing && progress && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Importing {progress.done}/{progress.total} domains...
                </Typography>
                <LinearProgress variant="determinate" value={(progress.done / progress.total) * 100} sx={{ borderRadius: 2 }} />
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={importing}>{done ? 'Close' : 'Cancel'}</Button>
        {!done && (
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={domains.length === 0 || importing}
            startIcon={importing ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {importing ? 'Importing...' : `Import ${domains.length > 0 ? domains.length : ''} Domains`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

interface AddDomainDialogProps {
  open: boolean;
  title: string;
  color: string;
  onClose: () => void;
  onAdd: (domain: string) => void;
}

function AddDomainDialog({ open, title, color, onClose, onAdd }: AddDomainDialogProps) {
  const [value, setValue] = useState('');
  const handleAdd = () => {
    const cleaned = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (cleaned && cleaned.includes('.')) {
      onAdd(cleaned);
      setValue('');
      onClose();
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus fullWidth label="Domain" placeholder="e.g. example.com" size="small"
          value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={!value.trim()} sx={{ bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.9)' } }}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function RulesPage() {
  const { profileId } = useParams();
  const qc = useQueryClient();
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [addAllowOpen, setAddAllowOpen] = useState(false);
  const [csvBlockOpen, setCsvBlockOpen] = useState(false);
  const [csvAllowOpen, setCsvAllowOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['rules', profileId],
    queryFn: () => api.get(`/dns/rules/${profileId}`).then(r => r.data.data as DnsRulesResponse).catch(() => null),
  });

  const categories = rulesData ? rulesToCategories(rulesData) : DEFAULT_CATEGORIES;
  const customAllowlist: string[] = rulesData?.customAllowlist ?? [];
  const customBlocklist: string[] = rulesData?.customBlocklist ?? [];

  const toggleMutation = useMutation({
    mutationFn: ({ key, blocked }: { key: string; blocked: boolean }) => {
      // Backend stores enabledCategories: true = allowed, false = blocked
      // UI "blocked" flag is the inverse of backend "enabled"
      // Block action (blocked=true)  → send enabled=false
      // Allow action (blocked=false) → send enabled=true
      const currentCategories: Record<string, boolean> = {};
      categories.forEach(c => {
        const isBlocked = c.key === key ? blocked : c.blocked;
        currentCategories[c.key] = !isBlocked; // convert UI-blocked → backend-enabled
      });
      return api.put(`/dns/rules/${profileId}/categories`, { categories: currentCategories });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules', profileId] }),
  });

  const addToListMutation = useMutation({
    mutationFn: ({ list, domain }: { list: 'allowlist' | 'blocklist'; domain: string }) =>
      api.post(`/dns/rules/${profileId}/domain/action`, {
        domain,
        action: list === 'allowlist' ? 'ALLOW' : 'BLOCK',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules', profileId] }),
  });

  const removeFromListMutation = useMutation({
    mutationFn: async ({ list, domain }: { list: 'allowlist' | 'blocklist'; domain: string }) => {
      // Fetch current list, remove the domain, then PUT the updated full list
      const r = await api.get(`/dns/rules/${profileId}`);
      const currentRules: DnsRulesResponse = r.data?.data ?? r.data;
      const currentList: string[] = list === 'allowlist'
        ? (currentRules.customAllowlist ?? [])
        : (currentRules.customBlocklist ?? []);
      const updated = currentList.filter(d => d !== domain);
      return api.put(`/dns/rules/${profileId}/${list}`, { domains: updated });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules', profileId] }),
  });

  const handleCsvImport = async (
    list: 'allowlist' | 'blocklist',
    domains: string[],
    onProgress: (done: number, total: number) => void
  ) => {
    const BATCH = 50;
    let done = 0;
    for (let i = 0; i < domains.length; i += BATCH) {
      const batch = domains.slice(i, i + BATCH);
      await Promise.all(batch.map(d => api.post(`/dns/rules/${profileId}/domain/action`, {
        domain: d,
        action: list === 'allowlist' ? 'ALLOW' : 'BLOCK',
      }).catch(() => null)));
      done += batch.length;
      onProgress(Math.min(done, domains.length), domains.length);
    }
    qc.invalidateQueries({ queryKey: ['rules', profileId] });
    setSnackbar({ open: true, message: `Successfully imported ${domains.length} domains`, severity: 'success' });
  };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<SecurityIcon />}
        title="Content Rules"
        subtitle="Manage category filtering for this profile"
        iconColor="#7B1FA2"
      />

      <Grid container spacing={2}>
        {categories.map((cat, i) => {
          const config = categoryIcons[cat.key] || { icon: <BlockIcon />, color: '#757575', bg: '#F5F5F5' };
          return (
            <Grid size={{ xs: 12, sm: 6 }} key={cat.id}>
              <AnimatedPage delay={0.05 + i * 0.04}>
                <Card sx={{
                  transition: 'all 0.2s ease',
                  borderLeft: `4px solid ${cat.blocked ? config.color : '#E0E0E0'}`,
                  opacity: cat.blocked ? 1 : 0.75,
                  '&:hover': { transform: 'translateY(-2px)', opacity: 1 },
                }}>
                  <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{
                          width: 40, height: 40, borderRadius: '10px',
                          bgcolor: config.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: config.color,
                          '& .MuiSvgIcon-root': { fontSize: 20 },
                        }}>
                          {config.icon}
                        </Box>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={600}>{cat.name}</Typography>
                            {cat.alwaysOn && (
                              <Chip size="small" label="Always On" sx={{
                                height: 18, fontSize: 10, fontWeight: 700,
                                bgcolor: '#FFEBEE', color: '#C62828',
                              }} />
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {cat.blocked ? 'Blocked' : 'Allowed'}
                          </Typography>
                        </Box>
                      </Box>
                      <Switch
                        checked={cat.blocked}
                        disabled={cat.alwaysOn}
                        onChange={(e) => toggleMutation.mutate({ key: cat.key, blocked: e.target.checked })}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: config.color },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: config.color },
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          );
        })}
      </Grid>

      {/* Custom Domain Lists */}
      <Grid container spacing={2.5} sx={{ mt: 1 }}>
        {/* Blocklist */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.5}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} color="#E53935">
                    Custom Blocklist
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small" variant="outlined" startIcon={<UploadFileIcon />}
                      onClick={() => setCsvBlockOpen(true)}
                      sx={{ borderRadius: 2, borderColor: '#E53935', color: '#E53935', fontSize: 12,
                        '&:hover': { bgcolor: '#FFF5F5', borderColor: '#E53935' } }}
                    >
                      Import CSV
                    </Button>
                    <Button
                      size="small" variant="outlined" startIcon={<AddCircleOutlineIcon />}
                      onClick={() => setAddBlockOpen(true)}
                      sx={{ borderRadius: 2, borderColor: '#E53935', color: '#E53935', fontSize: 12,
                        '&:hover': { bgcolor: '#FFF5F5', borderColor: '#E53935' } }}
                    >
                      Add
                    </Button>
                  </Box>
                </Box>
                <Divider sx={{ mb: 1 }} />
                {customBlocklist.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No custom blocked domains
                  </Typography>
                ) : (
                  <List dense disablePadding sx={{ maxHeight: 240, overflowY: 'auto' }}>
                    {customBlocklist.map((domain) => (
                      <ListItem
                        key={domain}
                        disablePadding
                        sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
                        secondaryAction={
                          <IconButton size="small" edge="end"
                            onClick={() => removeFromListMutation.mutate({ list: 'blocklist', domain })}
                            sx={{ color: '#E53935', '&:hover': { bgcolor: '#FFF5F5' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={domain}
                          primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Allowlist */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.55}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} color="#43A047">
                    Custom Allowlist
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small" variant="outlined" startIcon={<UploadFileIcon />}
                      onClick={() => setCsvAllowOpen(true)}
                      sx={{ borderRadius: 2, borderColor: '#43A047', color: '#43A047', fontSize: 12,
                        '&:hover': { bgcolor: '#F5FFF5', borderColor: '#43A047' } }}
                    >
                      Import CSV
                    </Button>
                    <Button
                      size="small" variant="outlined" startIcon={<AddCircleOutlineIcon />}
                      onClick={() => setAddAllowOpen(true)}
                      sx={{ borderRadius: 2, borderColor: '#43A047', color: '#43A047', fontSize: 12,
                        '&:hover': { bgcolor: '#F5FFF5', borderColor: '#43A047' } }}
                    >
                      Add
                    </Button>
                  </Box>
                </Box>
                <Divider sx={{ mb: 1 }} />
                {customAllowlist.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No custom allowed domains
                  </Typography>
                ) : (
                  <List dense disablePadding sx={{ maxHeight: 240, overflowY: 'auto' }}>
                    {customAllowlist.map((domain) => (
                      <ListItem
                        key={domain}
                        disablePadding
                        sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
                        secondaryAction={
                          <IconButton size="small" edge="end"
                            onClick={() => removeFromListMutation.mutate({ list: 'allowlist', domain })}
                            sx={{ color: '#43A047', '&:hover': { bgcolor: '#F5FFF5' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={domain}
                          primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>
      </Grid>

      {/* Dialogs */}
      <AddDomainDialog
        open={addBlockOpen}
        title="Block a Domain"
        color="#E53935"
        onClose={() => setAddBlockOpen(false)}
        onAdd={(domain) => addToListMutation.mutate({ list: 'blocklist', domain })}
      />
      <AddDomainDialog
        open={addAllowOpen}
        title="Allow a Domain"
        color="#43A047"
        onClose={() => setAddAllowOpen(false)}
        onAdd={(domain) => addToListMutation.mutate({ list: 'allowlist', domain })}
      />
      <CsvImportDialog
        open={csvBlockOpen}
        title="Import Domains to Blocklist"
        onClose={() => setCsvBlockOpen(false)}
        onImport={(domains, onProgress) => handleCsvImport('blocklist', domains, onProgress)}
      />
      <CsvImportDialog
        open={csvAllowOpen}
        title="Import Domains to Allowlist"
        onClose={() => setCsvAllowOpen(false)}
        onImport={(domains, onProgress) => handleCsvImport('allowlist', domains, onProgress)}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
