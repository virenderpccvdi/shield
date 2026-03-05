import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Switch, Grid, Button,
  Chip, CircularProgress, Snackbar, Tooltip, Stack,
} from '@mui/material';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

interface Tenant {
  id: string; name: string; slug: string; plan: string; status: string;
  features?: Record<string, boolean>;
}

const FEATURES = [
  { key: 'dns_filtering', label: 'DNS Filtering', desc: 'Block malicious and adult content via DNS' },
  { key: 'ai_monitoring', label: 'AI Monitoring', desc: 'AI-powered anomaly detection for browsing patterns' },
  { key: 'gps_tracking', label: 'GPS Tracking', desc: 'Real-time device location tracking' },
  { key: 'screen_time', label: 'Screen Time', desc: 'Daily screen time limits and schedules' },
  { key: 'rewards', label: 'Rewards', desc: 'Gamified rewards for responsible browsing' },
  { key: 'instant_pause', label: 'Instant Pause', desc: 'One-click internet pause for any device' },
  { key: 'content_reporting', label: 'Content Reports', desc: 'Detailed browsing and blocking reports' },
  { key: 'multi_admin', label: 'Multi-Admin', desc: 'Multiple admin accounts per tenant' },
];

const PLAN_COLORS: Record<string, string> = {
  STARTER: '#1565C0', GROWTH: '#2E7D32', ENTERPRISE: '#7B1FA2',
};

export default function FeatureManagementPage() {
  const qc = useQueryClient();
  const [snack, setSnack] = useState('');

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants-features'],
    queryFn: () => api.get('/tenants').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d) as Tenant[];
    }).catch(() => []),
  });

  const toggleMut = useMutation({
    mutationFn: ({ tenantId, feature, enabled }: { tenantId: string; feature: string; enabled: boolean }) =>
      api.patch(`/tenants/${tenantId}/features/${feature}`, { enabled }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants-features'] }); setSnack('Feature updated'); },
  });

  const bulkToggleMut = useMutation({
    mutationFn: async ({ feature, enabled }: { feature: string; enabled: boolean }) => {
      await Promise.all(tenants.map(t => api.patch(`/tenants/${t.id}/features/${feature}`, { enabled })));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants-features'] }); setSnack('Bulk update complete'); },
  });

  const activeTenants = tenants.filter(t => t.status === 'ACTIVE');

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ToggleOnIcon />}
        title="Feature Management"
        subtitle={`Manage features across ${activeTenants.length} active tenants`}
        iconColor="#00897B"
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : tenants.length === 0 ? (
        <Card><CardContent><Typography color="text.secondary">No tenants found</Typography></CardContent></Card>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          {FEATURES.map((feature, fi) => {
            const enabledCount = tenants.filter(t => t.features?.[feature.key]).length;
            const allEnabled = enabledCount === tenants.length;
            return (
              <AnimatedPage key={feature.key} delay={fi * 0.05}>
                <Card sx={{ mb: 2, transition: 'all 0.2s ease', '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' } }}>
                  <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" fontWeight={700}>{feature.label}</Typography>
                          <Chip size="small" label={`${enabledCount}/${tenants.length}`}
                            color={allEnabled ? 'success' : enabledCount > 0 ? 'warning' : 'default'}
                            sx={{ height: 22, fontSize: 11 }} />
                        </Box>
                        <Typography variant="body2" color="text.secondary">{feature.desc}</Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Enable for all">
                          <Button size="small" variant="outlined" color="success" disabled={allEnabled || bulkToggleMut.isPending}
                            onClick={() => bulkToggleMut.mutate({ feature: feature.key, enabled: true })}>
                            Enable All
                          </Button>
                        </Tooltip>
                        <Tooltip title="Disable for all">
                          <Button size="small" variant="outlined" color="error" disabled={enabledCount === 0 || bulkToggleMut.isPending}
                            onClick={() => bulkToggleMut.mutate({ feature: feature.key, enabled: false })}>
                            Disable All
                          </Button>
                        </Tooltip>
                      </Stack>
                    </Box>
                    <Grid container spacing={1}>
                      {tenants.map(tenant => {
                        const enabled = tenant.features?.[feature.key] ?? false;
                        return (
                          <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={tenant.id}>
                            <Box sx={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              p: 1, borderRadius: 1.5, bgcolor: enabled ? '#F1F8E9' : '#FAFAFA',
                              border: '1px solid', borderColor: enabled ? '#C5E1A5' : '#EEEEEE',
                              transition: 'all 0.2s ease',
                            }}>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="body2" fontWeight={600} noWrap>{tenant.name}</Typography>
                                <Chip size="small" label={tenant.plan}
                                  sx={{ height: 18, fontSize: 10, bgcolor: `${PLAN_COLORS[tenant.plan] || '#666'}15`, color: PLAN_COLORS[tenant.plan] || '#666' }} />
                              </Box>
                              <Switch size="small" checked={enabled}
                                onChange={() => toggleMut.mutate({ tenantId: tenant.id, feature: feature.key, enabled: !enabled })}
                                disabled={toggleMut.isPending} />
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </CardContent>
                </Card>
              </AnimatedPage>
            );
          })}
        </Box>
      )}

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}
