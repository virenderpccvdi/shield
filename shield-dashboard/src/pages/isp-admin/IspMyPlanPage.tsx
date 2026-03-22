import { Box, Card, CardContent, Typography, Chip, Grid, Stack, LinearProgress, Button, Alert } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import TuneIcon from '@mui/icons-material/Tune';
import DnsIcon from '@mui/icons-material/Dns';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SecurityIcon from '@mui/icons-material/Security';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AssessmentIcon from '@mui/icons-material/Assessment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import LoadingPage from '../../components/LoadingPage';

interface TenantMe {
  id: string;
  name: string;
  plan: string;
  status: string;
  features?: Record<string, boolean>;
  maxCustomers?: number;
  customerCount?: number;
  maxProfiles?: number;
  profileCount?: number;
}

const FEATURE_META = [
  // Core
  { key: 'dns_filtering',      label: 'DNS Filtering',       desc: 'Block harmful/adult content via DNS',            icon: <DnsIcon />,              color: '#1565C0', bg: '#E3F2FD',  group: 'Core' },
  { key: 'screen_time',        label: 'Screen Time',         desc: 'Daily time limits & bedtime lock',               icon: <AccessTimeIcon />,        color: '#E65100', bg: '#FFF3E0',  group: 'Core' },
  { key: 'instant_pause',      label: 'Instant Pause',       desc: 'One-tap pause all internet for child',           icon: <PauseCircleIcon />,       color: '#C62828', bg: '#FFEBEE',  group: 'Core' },
  // Safety
  { key: 'gps_tracking',       label: 'GPS Tracking',        desc: 'Real-time location tracking',                   icon: <LocationOnIcon />,        color: '#00695C', bg: '#E0F2F1',  group: 'Safety' },
  { key: 'geofences',          label: 'Geofences',           desc: 'Safe zones and alerts',                         icon: <LocationOnIcon />,        color: '#1B5E20', bg: '#E8F5E9',  group: 'Safety' },
  { key: 'sos',                label: 'SOS Button',          desc: 'Emergency SOS alert to parents',                icon: <SecurityIcon />,          color: '#B71C1C', bg: '#FFEBEE',  group: 'Safety' },
  { key: 'battery_alerts',     label: 'Battery Alerts',      desc: 'Alert when child battery is low',               icon: <NotificationsIcon />,     color: '#FF6F00', bg: '#FFF8E1',  group: 'Safety' },
  // Intelligence
  { key: 'ai_monitoring',      label: 'AI Monitoring',       desc: 'AI anomaly detection',                          icon: <PsychologyIcon />,        color: '#6A1B9A', bg: '#F3E5F5',  group: 'Intelligence' },
  { key: 'browsing_history',   label: 'Browsing History',    desc: '30-day DNS query log',                          icon: <AssessmentIcon />,        color: '#0277BD', bg: '#E1F5FE',  group: 'Intelligence' },
  { key: 'content_reporting',  label: 'Reports',             desc: 'Detailed activity reports',                     icon: <AssessmentIcon />,        color: '#2E7D32', bg: '#E8F5E9',  group: 'Intelligence' },
  { key: 'ai_chat',            label: 'AI Learning Buddy',   desc: 'Safe educational AI chat',                      icon: <PsychologyIcon />,        color: '#1565C0', bg: '#E3F2FD',  group: 'Intelligence' },
  // Family
  { key: 'rewards',            label: 'Rewards & Badges',    desc: 'Points and achievement badges',                 icon: <EmojiEventsIcon />,       color: '#F9A825', bg: '#FFFDE7',  group: 'Family' },
  { key: 'co_parent',          label: 'Co-Parent Access',    desc: 'Second parent/guardian account',               icon: <SecurityIcon />,          color: '#4527A0', bg: '#EDE7F6',  group: 'Family' },
  { key: 'weekly_digest',      label: 'Weekly Digest',       desc: 'Weekly email summary to parents',              icon: <AssessmentIcon />,        color: '#00838F', bg: '#E0F7FA',  group: 'Family' },
  { key: 'report_cards',       label: 'Report Cards',        desc: 'Monthly graded safety reports',                icon: <AssessmentIcon />,        color: '#558B2F', bg: '#F1F8E9',  group: 'Family' },
  { key: 'location_sharing',   label: 'Location Sharing',    desc: 'Shareable location links',                     icon: <LocationOnIcon />,        color: '#00695C', bg: '#E0F2F1',  group: 'Family' },
  // Advanced
  { key: 'video_checkin',      label: 'Video Check-in',      desc: 'Video call request to child',                  icon: <SecurityIcon />,          color: '#1565C0', bg: '#E3F2FD',  group: 'Advanced' },
  { key: 'advanced_schedules', label: 'Access Schedules',    desc: 'Day+time internet control windows',             icon: <AccessTimeIcon />,        color: '#4E342E', bg: '#EFEBE9',  group: 'Advanced' },
  { key: 'multi_admin',        label: 'Multi-Admin',         desc: 'Multiple ISP admin accounts',                  icon: <SecurityIcon />,          color: '#4527A0', bg: '#EDE7F6',  group: 'Advanced' },
];

const GROUPS = Array.from(new Set(FEATURE_META.map(f => f.group)));

const GROUP_COLORS: Record<string, string> = {
  Core: '#1565C0', Safety: '#B71C1C', Intelligence: '#6A1B9A',
  Family: '#00838F', Advanced: '#4E342E',
};

const PLAN_COLORS: Record<string, { color: string; bg: string }> = {
  STARTER:    { color: '#1565C0', bg: '#E3F2FD' },
  GROWTH:     { color: '#2E7D32', bg: '#E8F5E9' },
  ENTERPRISE: { color: '#6A1B9A', bg: '#F3E5F5' },
};

export default function IspMyPlanPage() {
  const { data: tenant, isLoading } = useQuery<TenantMe>({
    queryKey: ['tenant-me'],
    queryFn: () => api.get('/tenants/me').then(r => r.data?.data ?? r.data),
  });

  if (isLoading) return <LoadingPage />;

  const features = tenant?.features ?? {};
  const enabledCount = FEATURE_META.filter(f => features[f.key]).length;
  const totalFeatures = FEATURE_META.length;
  const lockedCount = totalFeatures - enabledCount;
  const planKey = tenant?.plan ?? 'STARTER';
  const pc = PLAN_COLORS[planKey] ?? PLAN_COLORS.STARTER;

  const customerCount = tenant?.customerCount ?? 0;
  const maxCustomers = tenant?.maxCustomers ?? 0;
  const customerPct = maxCustomers > 0 ? (customerCount / maxCustomers) * 100 : 0;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<TuneIcon />}
        title="My Plan & Features"
        subtitle="Features enabled on your current ISP plan"
        iconColor="#00897B"
      />

      {/* Plan banner */}
      <Card sx={{ mb: 3, overflow: 'hidden' }}>
        <Box sx={{ height: 4, background: `linear-gradient(135deg, ${pc.color}, ${pc.color}99)` }} />
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="h6" fontWeight={800}>{tenant?.name ?? 'My ISP'}</Typography>
                <Chip
                  label={planKey}
                  size="small"
                  sx={{ fontWeight: 800, fontSize: 12, bgcolor: pc.bg, color: pc.color, border: 'none' }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {enabledCount} of {totalFeatures} features enabled on your plan
              </Typography>
            </Box>

            <Stack direction="row" spacing={3}>
              {maxCustomers > 0 && (
                <Box sx={{ minWidth: 140 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Customers</Typography>
                  <Typography variant="body2" fontWeight={700}>{customerCount} / {maxCustomers}</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(customerPct, 100)}
                    sx={{
                      mt: 0.5, height: 5, borderRadius: 3,
                      bgcolor: '#F0F0F0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: customerPct > 90 ? '#E53935' : customerPct > 70 ? '#FB8C00' : pc.color,
                        borderRadius: 3,
                      },
                    }}
                  />
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Features Active</Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color: pc.color, lineHeight: 1 }}>
                  {enabledCount}<Typography component="span" variant="body2" color="text.secondary" fontWeight={400}> / {totalFeatures}</Typography>
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Feature groups */}
      {GROUPS.map(group => {
        const groupFeatures = FEATURE_META.filter(f => f.group === group);
        const groupColor = GROUP_COLORS[group] ?? 'text.secondary';
        return (
          <Box key={group} sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Box sx={{ width: 3, height: 18, borderRadius: 1.5, bgcolor: groupColor }} />
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: groupColor, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {group}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ({groupFeatures.filter(f => features[f.key]).length}/{groupFeatures.length} enabled)
              </Typography>
            </Stack>
            <Grid container spacing={1.5}>
              {groupFeatures.map((f, fi) => {
                const enabled = features[f.key] ?? false;
                return (
                  <Grid key={f.key} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card
                      sx={{
                        border: `1.5px solid ${enabled ? f.color + '50' : '#E2E8F0'}`,
                        bgcolor: enabled ? f.bg + '60' : '#FAFAFA',
                        opacity: enabled ? 1 : 0.65,
                        transition: 'all 0.15s ease',
                        animation: `fadeInUp 0.3s ease ${fi * 0.04}s both`,
                        '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                        '&:hover': enabled ? { boxShadow: `0 2px 12px ${f.color}25`, transform: 'translateY(-1px)' } : {},
                      }}
                    >
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack direction="row" spacing={1.25} alignItems="flex-start">
                          <Box sx={{
                            p: 0.75, borderRadius: 1.5,
                            bgcolor: enabled ? f.bg : '#F0F0F0',
                            color: enabled ? f.color : '#BDBDBD',
                            display: 'flex', flexShrink: 0,
                          }}>
                            {f.icon}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                              <Typography variant="body2" fontWeight={700} noWrap
                                sx={{ color: enabled ? 'text.primary' : 'text.disabled' }}>
                                {f.label}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                              {f.desc}
                            </Typography>
                          </Box>
                          {enabled
                            ? <CheckCircleIcon sx={{ fontSize: 18, color: '#43A047', flexShrink: 0, mt: 0.25 }} />
                            : <LockIcon sx={{ fontSize: 16, color: '#BDBDBD', flexShrink: 0, mt: 0.25 }} />}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        );
      })}

      {/* Upgrade CTA */}
      {lockedCount > 0 && (
        <Alert
          severity="info"
          icon={<UpgradeIcon />}
          sx={{ borderRadius: 2 }}
          action={
            <Button size="small" variant="outlined" color="info" startIcon={<UpgradeIcon />}>
              Upgrade Plan
            </Button>
          }
        >
          <Typography variant="body2" fontWeight={600}>
            {lockedCount} feature{lockedCount !== 1 ? 's' : ''} locked on your current {planKey} plan
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Want more features? Contact your account manager or upgrade your plan.
          </Typography>
        </Alert>
      )}
    </AnimatedPage>
  );
}
