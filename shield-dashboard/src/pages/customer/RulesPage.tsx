import { Box, Typography, Card, CardContent, Switch, Chip, Button, CircularProgress, Grid } from '@mui/material';
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
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

interface Category { id: string; name: string; key: string; blocked: boolean; alwaysOn?: boolean; emoji: string; }

interface DnsRulesResponse {
  profileId: string;
  categories: Record<string, boolean>;
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
  return Object.entries(rules.categories).map(([key, blocked], i) => {
    const meta = CATEGORY_META[key] || { name: key };
    return { id: String(i + 1), name: meta.name, key, blocked, alwaysOn: meta.alwaysOn || false, emoji: '' };
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

export default function RulesPage() {
  const { profileId } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['rules', profileId],
    queryFn: () => api.get(`/dns/rules/${profileId}`).then(r => {
      const rules = r.data.data as DnsRulesResponse;
      return rulesToCategories(rules);
    }).catch(() => DEFAULT_CATEGORIES),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ key, blocked }: { key: string; blocked: boolean }) => {
      // Build the full categories map with the toggled value
      const currentCategories: Record<string, boolean> = {};
      (categories).forEach(c => { currentCategories[c.key] = c.key === key ? blocked : c.blocked; });
      return api.put(`/dns/rules/${profileId}/categories`, { categories: currentCategories });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules', profileId] }),
  });

  const categories = data || DEFAULT_CATEGORIES;

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

      <AnimatedPage delay={0.6}>
        <Box sx={{ mt: 3, display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" size="small" startIcon={<AddCircleOutlineIcon />}
            sx={{ borderRadius: 2, borderColor: '#E53935', color: '#E53935', '&:hover': { bgcolor: '#FFF5F5', borderColor: '#E53935' } }}>
            Add Custom Block
          </Button>
          <Button variant="outlined" size="small" startIcon={<AddCircleOutlineIcon />}
            sx={{ borderRadius: 2, borderColor: '#43A047', color: '#43A047', '&:hover': { bgcolor: '#F5FFF5', borderColor: '#43A047' } }}>
            Add Custom Allow
          </Button>
        </Box>
      </AnimatedPage>
    </AnimatedPage>
  );
}
