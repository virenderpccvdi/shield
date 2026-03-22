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
import LoadingPage from '../../components/LoadingPage';

interface Category { id: string; name: string; key: string; blocked: boolean; alwaysOn?: boolean; emoji: string; }

interface DnsRulesResponse {
  profileId: string;
  enabledCategories: Record<string, boolean>;
  customAllowlist: string[];
  customBlocklist: string[];
}

const CATEGORY_META: Record<string, { name: string; alwaysOn?: boolean; group: string }> = {
  // Safety (always recommended on)
  malware:        { name: 'Malware & Viruses',    alwaysOn: true, group: 'Safety' },
  phishing:       { name: 'Phishing & Scams',     alwaysOn: true, group: 'Safety' },
  csam:           { name: 'Child Abuse Material',  alwaysOn: true, group: 'Safety' },
  ransomware:     { name: 'Ransomware',            alwaysOn: true, group: 'Safety' },
  // Adult
  adult:          { name: 'Adult Content',         group: 'Adult' },
  pornography:    { name: 'Pornography',           group: 'Adult' },
  dating:         { name: 'Dating Sites',          group: 'Adult' },
  nudity:         { name: 'Nudity',                group: 'Adult' },
  // Social & Communication
  social_media:   { name: 'Social Media',          group: 'Social' },
  messaging:      { name: 'Messaging Apps',        group: 'Social' },
  forums:         { name: 'Forums & Boards',       group: 'Social' },
  chat:           { name: 'Chat Platforms',         group: 'Social' },
  // Entertainment
  streaming:      { name: 'Video Streaming',       group: 'Entertainment' },
  music:          { name: 'Music Streaming',       group: 'Entertainment' },
  podcasts:       { name: 'Podcasts',              group: 'Entertainment' },
  live_streaming: { name: 'Live Streaming',        group: 'Entertainment' },
  // Gaming
  gaming:         { name: 'Gaming',                group: 'Gaming' },
  online_gaming:  { name: 'Online Multiplayer',    group: 'Gaming' },
  esports:        { name: 'eSports',               group: 'Gaming' },
  game_stores:    { name: 'Game Stores',           group: 'Gaming' },
  // Restricted
  gambling:       { name: 'Gambling',              group: 'Restricted' },
  alcohol:        { name: 'Alcohol',               group: 'Restricted' },
  tobacco:        { name: 'Tobacco & Vaping',      group: 'Restricted' },
  drugs:          { name: 'Drugs',                 group: 'Restricted' },
  weapons:        { name: 'Weapons',               group: 'Restricted' },
  violence:       { name: 'Violence & Gore',       group: 'Restricted' },
  hate_speech:    { name: 'Hate Speech',           group: 'Restricted' },
  // Privacy & Security
  vpn_proxy:      { name: 'VPN & Proxies',        group: 'Privacy' },
  anonymizers:    { name: 'Anonymizers',           group: 'Privacy' },
  tor:            { name: 'Tor Networks',          group: 'Privacy' },
  // Productivity
  ads:            { name: 'Ads & Tracking',        group: 'Productivity' },
  shopping:       { name: 'Online Shopping',       group: 'Productivity' },
  news:           { name: 'News & Media',          group: 'Productivity' },
  sports:         { name: 'Sports',                group: 'Productivity' },
  entertainment:  { name: 'General Entertainment', group: 'Productivity' },
  humor:          { name: 'Humor & Memes',         group: 'Productivity' },
  // Education
  education:      { name: 'Educational Content',   group: 'Education' },
  search_engines: { name: 'Search Engines',        group: 'Education' },
  reference:      { name: 'Reference & Research',  group: 'Education' },
  // Tech
  downloads:      { name: 'File Downloads',        group: 'Tech' },
  software:       { name: 'Software Sites',        group: 'Tech' },
  hacking:        { name: 'Hacking Tools',         group: 'Tech' },
  crypto:         { name: 'Cryptocurrency',        group: 'Tech' },
};

// No hardcoded defaults — we merge backend categories with CATEGORY_META at runtime

/** Build UI category list by merging ALL known categories with the profile's enabled states.
 *  Categories present in the profile use their stored state; missing ones default to "allowed" (not blocked).
 *  Internal keys like __paused__, __schedule_blocked__, __budget_exhausted__ are hidden. */
function rulesToCategories(
  rules: DnsRulesResponse | null,
  allCategories: Record<string, string> | null,
): Category[] {
  const profileCats = rules?.enabledCategories ?? {};
  // Build full key set: prefer backend /dns/categories, fall back to CATEGORY_META keys
  const allKeys: string[] = allCategories
    ? Object.keys(allCategories)
    : Object.keys(CATEGORY_META);
  // Also include any profile keys not in allKeys (edge case: old data)
  for (const k of Object.keys(profileCats)) {
    if (!allKeys.includes(k)) allKeys.push(k);
  }
  return allKeys
    .filter(k => !k.startsWith('__')) // hide internal flags
    .map((key, i) => {
      const meta = CATEGORY_META[key] || { name: allCategories?.[key] || key.replace(/_/g, ' ') };
      const enabled = profileCats[key] ?? true; // default: allowed (not blocked)
      return {
        id: String(i + 1),
        name: meta.name,
        key,
        blocked: !enabled,
        alwaysOn: meta.alwaysOn || false,
        emoji: '',
      };
    });
}

const categoryIcons: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  // Safety
  malware:    { icon: <BugReportIcon />,       color: '#B71C1C', bg: 'rgba(183,28,28,0.10)' },
  phishing:   { icon: <PhishingIcon />,        color: '#880E4F', bg: 'rgba(136,14,79,0.08)' },
  csam:       { icon: <SecurityIcon />,        color: '#B71C1C', bg: 'rgba(183,28,28,0.10)' },
  ransomware: { icon: <BugReportIcon />,       color: '#C62828', bg: 'rgba(198,40,40,0.08)' },
  // Adult
  adult:      { icon: <BlockIcon />,           color: '#C62828', bg: 'rgba(229,57,53,0.08)' },
  pornography:{ icon: <BlockIcon />,           color: '#C62828', bg: 'rgba(229,57,53,0.08)' },
  dating:     { icon: <PeopleIcon />,          color: '#C62828', bg: 'rgba(229,57,53,0.08)' },
  nudity:     { icon: <BlockIcon />,           color: '#C62828', bg: 'rgba(229,57,53,0.08)' },
  // Social
  social_media:{ icon: <PeopleIcon />,         color: '#1565C0', bg: 'rgba(21,101,192,0.08)' },
  messaging:  { icon: <PeopleIcon />,          color: '#1565C0', bg: 'rgba(21,101,192,0.08)' },
  forums:     { icon: <PeopleIcon />,          color: '#1565C0', bg: 'rgba(21,101,192,0.08)' },
  chat:       { icon: <PeopleIcon />,          color: '#1565C0', bg: 'rgba(21,101,192,0.08)' },
  // Entertainment
  streaming:      { icon: <LiveTvIcon />,      color: '#00897B', bg: '#E0F2F1' },
  music:          { icon: <LiveTvIcon />,      color: '#00897B', bg: '#E0F2F1' },
  podcasts:       { icon: <LiveTvIcon />,      color: '#00897B', bg: '#E0F2F1' },
  live_streaming: { icon: <LiveTvIcon />,      color: '#00897B', bg: '#E0F2F1' },
  // Gaming
  gaming:        { icon: <SportsEsportsIcon />,color: '#7B1FA2', bg: '#F3E5F5' },
  online_gaming: { icon: <SportsEsportsIcon />,color: '#7B1FA2', bg: '#F3E5F5' },
  esports:       { icon: <SportsEsportsIcon />,color: '#7B1FA2', bg: '#F3E5F5' },
  game_stores:   { icon: <SportsEsportsIcon />,color: '#7B1FA2', bg: '#F3E5F5' },
  // Restricted
  gambling:   { icon: <CasinoIcon />,          color: '#FB8C00', bg: 'rgba(251,140,0,0.08)' },
  alcohol:    { icon: <LocalPharmacyIcon />,   color: '#D84315', bg: '#FBE9E7' },
  tobacco:    { icon: <LocalPharmacyIcon />,   color: '#D84315', bg: '#FBE9E7' },
  drugs:      { icon: <LocalPharmacyIcon />,   color: '#D84315', bg: '#FBE9E7' },
  weapons:    { icon: <ReportProblemIcon />,    color: '#D84315', bg: '#FBE9E7' },
  violence:   { icon: <ReportProblemIcon />,    color: '#D84315', bg: '#FBE9E7' },
  hate_speech:{ icon: <ReportProblemIcon />,    color: '#D84315', bg: '#FBE9E7' },
  // Privacy
  vpn_proxy:  { icon: <VpnKeyIcon />,          color: '#4527A0', bg: '#EDE7F6' },
  anonymizers:{ icon: <VpnKeyIcon />,          color: '#4527A0', bg: '#EDE7F6' },
  tor:        { icon: <VpnKeyIcon />,          color: '#4527A0', bg: '#EDE7F6' },
  // Productivity
  ads:        { icon: <BlockIcon />,           color: '#FB8C00', bg: 'rgba(251,140,0,0.08)' },
  shopping:   { icon: <BlockIcon />,           color: '#FB8C00', bg: 'rgba(251,140,0,0.08)' },
  news:       { icon: <BlockIcon />,           color: '#FB8C00', bg: 'rgba(251,140,0,0.08)' },
  sports:     { icon: <BlockIcon />,           color: '#FB8C00', bg: 'rgba(251,140,0,0.08)' },
  entertainment:{ icon: <LiveTvIcon />,        color: '#FB8C00', bg: 'rgba(251,140,0,0.08)' },
  humor:      { icon: <BlockIcon />,           color: '#FB8C00', bg: 'rgba(251,140,0,0.08)' },
  // Education
  education:     { icon: <SecurityIcon />,     color: '#2E7D32', bg: '#E8F5E9' },
  search_engines:{ icon: <SecurityIcon />,     color: '#2E7D32', bg: '#E8F5E9' },
  reference:     { icon: <SecurityIcon />,     color: '#2E7D32', bg: '#E8F5E9' },
  // Tech
  downloads:  { icon: <BugReportIcon />,       color: '#37474F', bg: '#ECEFF1' },
  software:   { icon: <BugReportIcon />,       color: '#37474F', bg: '#ECEFF1' },
  hacking:    { icon: <BugReportIcon />,       color: '#B71C1C', bg: 'rgba(183,28,28,0.08)' },
  crypto:     { icon: <BugReportIcon />,       color: '#37474F', bg: '#ECEFF1' },
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
            <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main', mb: 1 }} />
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

  // Fetch all possible categories from backend so unconfigured ones also appear
  const { data: allCategories } = useQuery({
    queryKey: ['dns-categories'],
    queryFn: () => api.get('/dns/categories').then(r => (r.data.data ?? r.data) as Record<string, string>).catch(() => null),
    staleTime: 5 * 60 * 1000, // cache 5 min
  });

  const categories = rulesToCategories(rulesData ?? null, allCategories ?? null);
  const customAllowlist: string[] = rulesData?.customAllowlist ?? [];
  const customBlocklist: string[] = rulesData?.customBlocklist ?? [];

  const toggleMutation = useMutation({
    mutationFn: async ({ key, blocked }: { key: string; blocked: boolean }) => {
      // Fetch current FULL categories from API to avoid overwriting with defaults
      const fresh = await api.get(`/dns/rules/${profileId}`).then(r => r.data.data as DnsRulesResponse);
      const currentCategories: Record<string, boolean> = { ...(fresh.enabledCategories || {}) };
      // Block action (blocked=true)  → send enabled=false
      // Allow action (blocked=false) → send enabled=true
      currentCategories[key] = !blocked;
      return api.put(`/dns/rules/${profileId}/categories`, { categories: currentCategories });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules', profileId] }),
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update category';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
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

  if (isLoading) return <LoadingPage />;

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
                                bgcolor: 'rgba(229,57,53,0.08)', color: 'error.main',
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
                  <Typography variant="subtitle1" fontWeight={600} color="error.main">
                    Custom Blocklist
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small" variant="outlined" startIcon={<UploadFileIcon />}
                      onClick={() => setCsvBlockOpen(true)}
                      sx={{ borderRadius: 2, borderColor: 'error.main', color: 'error.main', fontSize: 12,
                        '&:hover': { bgcolor: 'rgba(229,57,53,0.04)', borderColor: 'error.main' } }}
                    >
                      Import CSV
                    </Button>
                    <Button
                      size="small" variant="outlined" startIcon={<AddCircleOutlineIcon />}
                      onClick={() => setAddBlockOpen(true)}
                      sx={{ borderRadius: 2, borderColor: 'error.main', color: 'error.main', fontSize: 12,
                        '&:hover': { bgcolor: 'rgba(229,57,53,0.04)', borderColor: 'error.main' } }}
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
                            sx={{ color: 'error.main', '&:hover': { bgcolor: 'rgba(229,57,53,0.04)' } }}
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
                  <Typography variant="subtitle1" fontWeight={600} color="success.main">
                    Custom Allowlist
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small" variant="outlined" startIcon={<UploadFileIcon />}
                      onClick={() => setCsvAllowOpen(true)}
                      sx={{ borderRadius: 2, borderColor: 'success.main', color: 'success.main', fontSize: 12,
                        '&:hover': { bgcolor: 'rgba(67,160,71,0.04)', borderColor: 'success.main' } }}
                    >
                      Import CSV
                    </Button>
                    <Button
                      size="small" variant="outlined" startIcon={<AddCircleOutlineIcon />}
                      onClick={() => setAddAllowOpen(true)}
                      sx={{ borderRadius: 2, borderColor: 'success.main', color: 'success.main', fontSize: 12,
                        '&:hover': { bgcolor: 'rgba(67,160,71,0.04)', borderColor: 'success.main' } }}
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
                            sx={{ color: 'success.main', '&:hover': { bgcolor: 'rgba(67,160,71,0.04)' } }}
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
        color="error.main"
        onClose={() => setAddBlockOpen(false)}
        onAdd={(domain) => addToListMutation.mutate({ list: 'blocklist', domain })}
      />
      <AddDomainDialog
        open={addAllowOpen}
        title="Allow a Domain"
        color="success.main"
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
