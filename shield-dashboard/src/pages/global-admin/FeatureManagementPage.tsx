import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Switch, Grid, Button,
  Chip, CircularProgress, Snackbar, Tooltip, Stack, Table, TableHead,
  TableRow, TableCell, TableBody, Paper, LinearProgress, Alert,
  IconButton, Collapse,
} from '@mui/material';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import DnsIcon from '@mui/icons-material/Dns';
import PsychologyIcon from '@mui/icons-material/Psychology';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import LoadingPage from '../../components/LoadingPage';

interface Tenant {
  id: string; name: string; slug: string; plan: string; status: string;
  features?: Record<string, boolean>;
}

const FEATURES = [
  { key: 'dns_filtering',     label: 'DNS Filtering',     desc: 'Block malicious & adult content via DNS', icon: <DnsIcon />,              color: '#1565C0', bg: '#E3F2FD' },
  { key: 'ai_monitoring',     label: 'AI Monitoring',     desc: 'AI-powered anomaly detection',           icon: <PsychologyIcon />,        color: '#6A1B9A', bg: '#F3E5F5' },
  { key: 'gps_tracking',      label: 'GPS Tracking',      desc: 'Real-time device location tracking',     icon: <LocationOnIcon />,        color: '#00695C', bg: '#E0F2F1' },
  { key: 'screen_time',       label: 'Screen Time',       desc: 'Daily screen time limits & schedules',   icon: <AccessTimeIcon />,        color: '#E65100', bg: '#FFF3E0' },
  { key: 'rewards',           label: 'Rewards',           desc: 'Gamified rewards for responsible use',   icon: <EmojiEventsIcon />,       color: '#F9A825', bg: '#FFFDE7' },
  { key: 'instant_pause',     label: 'Instant Pause',     desc: 'One-click internet pause per device',    icon: <PauseCircleIcon />,       color: '#C62828', bg: '#FFEBEE' },
  { key: 'content_reporting', label: 'Content Reports',   desc: 'Detailed browsing & blocking reports',   icon: <AssessmentIcon />,        color: '#2E7D32', bg: '#E8F5E9' },
  { key: 'multi_admin',       label: 'Multi-Admin',       desc: 'Multiple ISP admin accounts',            icon: <SupervisorAccountIcon />, color: '#4527A0', bg: '#EDE7F6' },
];

const PLAN_COLORS: Record<string, { color: string; bg: string }> = {
  STARTER:    { color: '#1565C0', bg: '#E3F2FD' },
  GROWTH:     { color: '#2E7D32', bg: '#E8F5E9' },
  ENTERPRISE: { color: '#6A1B9A', bg: '#F3E5F5' },
};

const PLAN_DEFAULTS: Record<string, Record<string, boolean>> = {
  STARTER:    { dns_filtering: true,  ai_monitoring: false, gps_tracking: false, screen_time: true,  rewards: false, instant_pause: true,  content_reporting: false, multi_admin: false },
  GROWTH:     { dns_filtering: true,  ai_monitoring: true,  gps_tracking: true,  screen_time: true,  rewards: true,  instant_pause: true,  content_reporting: true,  multi_admin: false },
  ENTERPRISE: { dns_filtering: true,  ai_monitoring: true,  gps_tracking: true,  screen_time: true,  rewards: true,  instant_pause: true,  content_reporting: true,  multi_admin: true  },
};

export default function FeatureManagementPage() {
  const qc = useQueryClient();
  const [snack, setSnack] = useState('');
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ['tenants-features'],
    queryFn: () => api.get('/tenants').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as Tenant[];
    }).catch(() => []),
  });

  const toggleMut = useMutation({
    mutationFn: ({ tenantId, feature, enabled }: { tenantId: string; feature: string; enabled: boolean }) =>
      api.patch(`/tenants/${tenantId}/features/${feature}`, { enabled }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants-features'] }); setSnack('Feature updated'); },
    onError: () => setSnack('Failed to update feature'),
  });

  const bulkToggleMut = useMutation({
    mutationFn: async ({ feature, enabled }: { feature: string; enabled: boolean }) => {
      await Promise.all(tenants.map(t => api.patch(`/tenants/${t.id}/features/${feature}`, { enabled })));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants-features'] }); setSnack('Bulk update complete'); },
  });

  const resetPlanMut = useMutation({
    mutationFn: async ({ tenantId, plan }: { tenantId: string; plan: string }) => {
      const defaults = PLAN_DEFAULTS[plan] || PLAN_DEFAULTS.STARTER;
      await Promise.all(
        Object.entries(defaults).map(([feature, enabled]) =>
          api.patch(`/tenants/${tenantId}/features/${feature}`, { enabled })
        )
      );
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants-features'] }); setSnack('Reset to plan defaults'); },
  });

  const activeTenants = tenants.filter(t => t.status !== 'SUSPENDED');

  if (isLoading) return <LoadingPage />;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ToggleOnIcon />}
        title="Feature Management"
        subtitle={`Control features across ${activeTenants.length} active ISP tenants`}
        iconColor="#00897B"
      />

      {/* Feature Overview Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {FEATURES.map((f, fi) => {
          const enabledCount = tenants.filter(t => t.features?.[f.key]).length;
          const pct = tenants.length ? (enabledCount / tenants.length) * 100 : 0;
          return (
            <Grid key={f.key} size={{ xs: 6, sm: 4, md: 3 }}>
              <Card sx={{
                border: '1px solid', borderColor: f.bg,
                transition: 'all 0.2s ease',
                '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.10)', transform: 'translateY(-2px)' },
                animation: `fadeInUp 0.3s ease ${fi * 0.04}s both`,
                '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1 } },
              }}>
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: f.bg, color: f.color, display: 'flex' }}>
                      {f.icon}
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Tooltip title="Enable for all tenants">
                        <Button size="small" sx={{ minWidth: 0, px: 0.5, py: 0.25, fontSize: 10, color: 'success.main', '&:hover': { bgcolor: '#E8F5E9' } }}
                          disabled={enabledCount === tenants.length || bulkToggleMut.isPending}
                          onClick={() => bulkToggleMut.mutate({ feature: f.key, enabled: true })}>All On</Button>
                      </Tooltip>
                      <Tooltip title="Disable for all tenants">
                        <Button size="small" sx={{ minWidth: 0, px: 0.5, py: 0.25, fontSize: 10, color: 'error.main', '&:hover': { bgcolor: '#FFEBEE' } }}
                          disabled={enabledCount === 0 || bulkToggleMut.isPending}
                          onClick={() => bulkToggleMut.mutate({ feature: f.key, enabled: false })}>All Off</Button>
                      </Tooltip>
                    </Stack>
                  </Box>
                  <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.2 }}>{f.label}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, lineHeight: 1.3 }}>{f.desc}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" fontWeight={600} sx={{ color: f.color }}>{enabledCount}/{tenants.length} ISPs</Typography>
                    <Typography variant="caption" color="text.secondary">{Math.round(pct)}%</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={pct}
                    sx={{ height: 5, borderRadius: 3,
                      bgcolor: '#F0F0F0',
                      '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? '#43A047' : pct > 50 ? f.color : '#FB8C00', borderRadius: 3 } }} />
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Plan Feature Matrix */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ height: 4, background: 'linear-gradient(135deg, #1565C0 0%, #00897B 100%)' }} />
        <CardContent sx={{ px: 0, pt: 0, '&:last-child': { pb: 0 } }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #F0F0F0' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <InfoIcon sx={{ fontSize: 18, color: '#1565C0' }} />
              <Typography variant="subtitle2" fontWeight={700}>Plan Feature Matrix — per-plan defaults</Typography>
            </Stack>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', minWidth: 110 }}>Feature</TableCell>
                  {(['STARTER', 'GROWTH', 'ENTERPRISE'] as const).map(plan => {
                    const pc = PLAN_COLORS[plan];
                    return (
                      <TableCell key={plan} align="center" sx={{ fontWeight: 700, minWidth: 110 }}>
                        <Chip label={plan} size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: pc.bg, color: pc.color, border: 'none' }} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {FEATURES.map(f => (
                  <TableRow key={f.key} sx={{ '&:hover': { bgcolor: '#FAFAFA' } }}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ color: f.color, display: 'flex', fontSize: 16 }}>{f.icon}</Box>
                        <Typography variant="body2" fontWeight={600}>{f.label}</Typography>
                      </Stack>
                    </TableCell>
                    {(['STARTER', 'GROWTH', 'ENTERPRISE'] as const).map(plan => (
                      <TableCell key={plan} align="center">
                        {PLAN_DEFAULTS[plan][f.key]
                          ? <CheckCircleIcon sx={{ fontSize: 18, color: '#43A047' }} />
                          : <CancelIcon sx={{ fontSize: 18, color: '#BDBDBD' }} />}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      {/* Per-Tenant Feature Control */}
      {tenants.length === 0 ? (
        <Card><CardContent><Typography color="text.secondary" textAlign="center">No tenants registered yet</Typography></CardContent></Card>
      ) : (
        <Card>
          <Box sx={{ height: 4, background: 'linear-gradient(135deg, #00897B 0%, #26A69A 100%)' }} />
          <CardContent sx={{ px: 0, pt: 0, '&:last-child': { pb: 0 } }}>
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" fontWeight={700}>Per-Tenant Feature Control</Typography>
              <Typography variant="caption" color="text.secondary">{tenants.length} ISP tenants</Typography>
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', minWidth: 180, position: 'sticky', left: 0, bgcolor: '#F8FAFC', zIndex: 1 }}>ISP Tenant</TableCell>
                    {FEATURES.map(f => (
                      <TableCell key={f.key} align="center" sx={{ fontWeight: 600, fontSize: 11, minWidth: 90, color: f.color }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                          <Box sx={{ color: f.color, display: 'flex' }}>{f.icon}</Box>
                          <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10, color: f.color, lineHeight: 1.1 }}>{f.label}</Typography>
                        </Box>
                      </TableCell>
                    ))}
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', minWidth: 110 }}>Reset</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tenants.map((tenant, idx) => {
                    const pc = PLAN_COLORS[tenant.plan];
                    const enabledFeatureCount = FEATURES.filter(f => tenant.features?.[f.key]).length;
                    return (
                      <TableRow key={tenant.id} sx={{
                        '&:hover': { bgcolor: '#F8FAFC' },
                        bgcolor: tenant.status === 'SUSPENDED' ? '#FFF8F8' : 'inherit',
                        animation: `fadeInUp 0.3s ease ${idx * 0.03}s both`,
                      }}>
                        <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'inherit', zIndex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: pc?.bg || '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Typography variant="caption" fontWeight={800} sx={{ color: pc?.color || '#666', fontSize: 12 }}>
                                {tenant.name.slice(0, 2).toUpperCase()}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2" fontWeight={700} noWrap>{tenant.name}</Typography>
                              <Stack direction="row" spacing={0.5}>
                                <Chip size="small" label={tenant.plan} sx={{ height: 16, fontSize: 9, fontWeight: 700, bgcolor: pc?.bg, color: pc?.color, border: 'none' }} />
                                <Chip size="small" label={`${enabledFeatureCount}/8`} sx={{ height: 16, fontSize: 9, bgcolor: '#F0F0F0', color: 'text.secondary' }} />
                              </Stack>
                            </Box>
                          </Box>
                        </TableCell>
                        {FEATURES.map(f => {
                          const enabled = tenant.features?.[f.key] ?? false;
                          return (
                            <TableCell key={f.key} align="center">
                              <Tooltip title={`${enabled ? 'Disable' : 'Enable'} ${f.label} for ${tenant.name}`} arrow>
                                <Switch
                                  size="small"
                                  checked={enabled}
                                  onChange={() => toggleMut.mutate({ tenantId: tenant.id, feature: f.key, enabled: !enabled })}
                                  disabled={toggleMut.isPending || tenant.status === 'SUSPENDED'}
                                  sx={{
                                    '& .MuiSwitch-thumb': { bgcolor: enabled ? f.color : '#BDBDBD' },
                                    '& .MuiSwitch-track': { bgcolor: enabled ? `${f.color}40` : '#E0E0E0' },
                                  }}
                                />
                              </Tooltip>
                            </TableCell>
                          );
                        })}
                        <TableCell align="center">
                          <Tooltip title={`Reset ${tenant.name} to ${tenant.plan} plan defaults`} arrow>
                            <IconButton
                              size="small"
                              disabled={resetPlanMut.isPending || tenant.status === 'SUSPENDED'}
                              onClick={() => resetPlanMut.mutate({ tenantId: tenant.id, plan: tenant.plan })}
                              sx={{ color: '#1565C0', '&:hover': { bgcolor: '#E3F2FD' } }}
                            >
                              <RestartAltIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      )}

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
