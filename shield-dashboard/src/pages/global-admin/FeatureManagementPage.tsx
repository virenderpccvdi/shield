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
import SecurityIcon from '@mui/icons-material/Security';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HistoryIcon from '@mui/icons-material/History';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import EmailIcon from '@mui/icons-material/Email';
import ShareIcon from '@mui/icons-material/Share';
import VideocamIcon from '@mui/icons-material/Videocam';
import ScheduleIcon from '@mui/icons-material/Schedule';
import BrushIcon from '@mui/icons-material/Brush';
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
  // Core
  { key: 'dns_filtering',      label: 'DNS Filtering',        desc: 'Block malicious & adult content via DNS',          icon: <DnsIcon />,              color: '#1565C0', bg: '#E3F2FD',  group: 'Core' },
  { key: 'screen_time',        label: 'Screen Time',          desc: 'Daily screen time limits & schedules',             icon: <AccessTimeIcon />,        color: '#E65100', bg: '#FFF3E0',  group: 'Core' },
  { key: 'instant_pause',      label: 'Instant Pause',        desc: 'One-click internet pause per child',               icon: <PauseCircleIcon />,       color: '#C62828', bg: '#FFEBEE',  group: 'Core' },
  // Safety
  { key: 'gps_tracking',       label: 'GPS Tracking',         desc: 'Real-time device location tracking',               icon: <LocationOnIcon />,        color: '#00695C', bg: '#E0F2F1',  group: 'Safety' },
  { key: 'geofences',          label: 'Geofences',            desc: 'Safe zones with entry/exit alerts',                icon: <LocationOnIcon />,        color: '#1B5E20', bg: '#E8F5E9',  group: 'Safety' },
  { key: 'sos',                label: 'SOS Panic Button',     desc: 'Emergency SOS alert to parents & contacts',        icon: <SecurityIcon />,          color: '#B71C1C', bg: '#FFEBEE',  group: 'Safety' },
  { key: 'battery_alerts',     label: 'Battery Alerts',       desc: 'Alert parents when battery is low',                icon: <NotificationsIcon />,     color: '#FF6F00', bg: '#FFF8E1',  group: 'Safety' },
  // Intelligence
  { key: 'ai_monitoring',      label: 'AI Monitoring',        desc: 'AI-powered anomaly & threat detection',            icon: <PsychologyIcon />,        color: '#6A1B9A', bg: '#F3E5F5',  group: 'Intelligence' },
  { key: 'browsing_history',   label: 'Browsing History',     desc: 'Full DNS query log with blocked/allowed filter',   icon: <HistoryIcon />,           color: '#0277BD', bg: '#E1F5FE',  group: 'Intelligence' },
  { key: 'content_reporting',  label: 'Content Reports',      desc: 'Detailed browsing & blocking reports',             icon: <AssessmentIcon />,        color: '#2E7D32', bg: '#E8F5E9',  group: 'Intelligence' },
  { key: 'ai_chat',            label: 'AI Learning Buddy',    desc: 'Safe educational AI chat for children',            icon: <SmartToyIcon />,          color: '#1565C0', bg: '#E3F2FD',  group: 'Intelligence' },
  // Family
  { key: 'rewards',            label: 'Rewards & Badges',     desc: 'Gamified rewards for responsible internet use',    icon: <EmojiEventsIcon />,       color: '#F9A825', bg: '#FFFDE7',  group: 'Family' },
  { key: 'co_parent',          label: 'Co-Parent Access',     desc: 'Invite second parent/guardian to account',         icon: <SupervisorAccountIcon />, color: '#4527A0', bg: '#EDE7F6',  group: 'Family' },
  { key: 'weekly_digest',      label: 'Weekly Digest',        desc: 'Automated weekly summary email to parents',        icon: <EmailIcon />,             color: '#00838F', bg: '#E0F7FA',  group: 'Family' },
  { key: 'report_cards',       label: 'Monthly Report Cards', desc: 'Monthly graded internet safety report email',      icon: <AssessmentIcon />,        color: '#558B2F', bg: '#F1F8E9',  group: 'Family' },
  { key: 'location_sharing',   label: 'Location Sharing',     desc: 'Temporary shareable location links',               icon: <ShareIcon />,             color: '#00695C', bg: '#E0F2F1',  group: 'Family' },
  // Advanced
  { key: 'video_checkin',      label: 'Video Check-in',       desc: 'One-tap video call request to child device',       icon: <VideocamIcon />,          color: '#1565C0', bg: '#E3F2FD',  group: 'Advanced' },
  { key: 'advanced_schedules', label: 'Access Schedules',     desc: 'Day-of-week + time-window internet control',       icon: <ScheduleIcon />,          color: '#4E342E', bg: '#EFEBE9',  group: 'Advanced' },
  { key: 'multi_admin',        label: 'Multi-Admin',          desc: 'Multiple ISP admin accounts',                      icon: <SupervisorAccountIcon />, color: '#4527A0', bg: '#EDE7F6',  group: 'Advanced' },
  // ISP
  { key: 'ai_insights',        label: 'AI Insights',          desc: 'AI-powered usage pattern analysis',                icon: <PsychologyIcon />,        color: '#880E4F', bg: '#FCE4EC',  group: 'ISP' },
  { key: 'white_label',        label: 'White Label',          desc: 'Custom branding for ISP customers',                icon: <BrushIcon />,             color: '#37474F', bg: '#ECEFF1',  group: 'ISP' },
];

const PLAN_COLORS: Record<string, { color: string; bg: string }> = {
  STARTER:    { color: '#1565C0', bg: '#E3F2FD' },
  GROWTH:     { color: '#2E7D32', bg: '#E8F5E9' },
  ENTERPRISE: { color: '#6A1B9A', bg: '#F3E5F5' },
};

const PLAN_DEFAULTS: Record<string, Record<string, boolean>> = {
  STARTER: {
    dns_filtering: true,  screen_time: true,   instant_pause: true,
    gps_tracking: false,  geofences: false,    sos: false,          battery_alerts: false,
    ai_monitoring: false, browsing_history: false, content_reporting: false, ai_chat: false,
    rewards: false,       co_parent: false,    weekly_digest: false, report_cards: false, location_sharing: false,
    video_checkin: false, advanced_schedules: false, multi_admin: false,
    ai_insights: false,   white_label: false,
  },
  GROWTH: {
    dns_filtering: true,  screen_time: true,   instant_pause: true,
    gps_tracking: true,   geofences: true,     sos: true,           battery_alerts: false,
    ai_monitoring: true,  browsing_history: true, content_reporting: true, ai_chat: true,
    rewards: true,        co_parent: false,    weekly_digest: true, report_cards: false, location_sharing: false,
    video_checkin: false, advanced_schedules: false, multi_admin: false,
    ai_insights: false,   white_label: false,
  },
  ENTERPRISE: {
    dns_filtering: true,  screen_time: true,   instant_pause: true,
    gps_tracking: true,   geofences: true,     sos: true,           battery_alerts: true,
    ai_monitoring: true,  browsing_history: true, content_reporting: true, ai_chat: true,
    rewards: true,        co_parent: true,     weekly_digest: true, report_cards: true, location_sharing: true,
    video_checkin: true,  advanced_schedules: true, multi_admin: true,
    ai_insights: true,    white_label: true,
  },
};

// Get ordered list of unique groups
const GROUPS = Array.from(new Set(FEATURES.map(f => f.group)));

const GROUP_COLORS: Record<string, string> = {
  Core: '#1565C0', Safety: '#B71C1C', Intelligence: '#6A1B9A',
  Family: '#00838F', Advanced: '#4E342E', ISP: '#880E4F',
};

export default function FeatureManagementPage() {
  const qc = useQueryClient();
  const [snack, setSnack] = useState('');

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
      if (!window.confirm(`Apply "${feature}" toggle to ALL ${tenants.length} tenants?`)) return;
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
                {GROUPS.map(group => (
                  <>
                    <TableRow key={`group-${group}`} sx={{ bgcolor: '#F8FAFC' }}>
                      <TableCell colSpan={4} sx={{ py: 0.75, px: 2 }}>
                        <Typography variant="caption" fontWeight={800} sx={{ color: GROUP_COLORS[group] ?? 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
                          {group}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {FEATURES.filter(f => f.group === group).map(f => (
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
                  </>
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
                                <Chip size="small" label={`${enabledFeatureCount}/21`} sx={{ height: 16, fontSize: 9, bgcolor: '#F0F0F0', color: 'text.secondary' }} />
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
