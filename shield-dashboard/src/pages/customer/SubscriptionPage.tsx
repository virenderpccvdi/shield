import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Stack, Divider,
} from '@mui/material';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSubscription, createCheckout, cancelSubscription, getMyInvoices, openInvoicePdf } from '../../api/billing';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import LoadingPage from '../../components/LoadingPage';

const planColors: Record<string, string> = {
  STARTER: '#43A047',
  GROWTH: '#1565C0',
  ENTERPRISE: '#7B1FA2',
  FREE: '#78909C',
};

export default function SubscriptionPage() {
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [snack, setSnack] = useState('');

  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: getSubscription,
  });

  // Fetch only this ISP's customer plans (backend scopes by X-Tenant-Id for CUSTOMER role)
  const { data: plans } = useQuery({
    queryKey: ['active-plans'],
    queryFn: () => api.get('/admin/plans').then(r => {
      const d = r.data?.data || r.data;
      return (Array.isArray(d) ? d : d?.content || []).filter((p: any) => p.active);
    }),
  });

  const { data: invoices } = useQuery({
    queryKey: ['my-invoices'],
    queryFn: () => getMyInvoices(0, 5).then(raw => {
      const content = raw?.content ?? (Array.isArray(raw) ? raw : []);
      return { content };
    }),
  });

  const checkoutMutation = useMutation({
    mutationFn: (planId: string) => createCheckout(planId),
    onSuccess: (data) => {
      if (data.sessionUrl) window.location.href = data.sessionUrl;
    },
    onError: () => setSnack('Failed to start checkout'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSubscription(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-subscription'] }); setSnack('Subscription cancelled'); setCancelOpen(false); },
  });

  const activePlans = (plans || []) as any[];
  const myInvoices = (invoices?.content || []) as any[];

  return (
    <AnimatedPage>
      <PageHeader icon={<CardMembershipIcon />} title="Subscription" subtitle="Manage your plan and billing" iconColor="#7B1FA2" />

      {subLoading ? (
        <LoadingPage />
      ) : (
        <>
          {/* Current Plan */}
          <Card sx={{ mb: 3 }}>
            <Box sx={{ height: 4, background: `linear-gradient(135deg, ${planColors[sub?.planName] || '#78909C'} 0%, ${planColors[sub?.planName] || '#78909C'}80 100%)` }} />
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>{sub?.planDisplayName || sub?.planName || 'No Plan'}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Chip size="small" label={sub?.status || 'NONE'} color={sub?.status === 'ACTIVE' ? 'success' : 'default'} />
                    {sub?.price > 0 && <Chip size="small" label={`₹${sub.price}/${sub.billingCycle === 'YEARLY' ? 'yr' : 'mo'}`} variant="outlined" />}
                    {sub?.maxProfiles && <Chip size="small" label={`${sub.maxProfiles} profiles`} variant="outlined" />}
                  </Stack>
                </Box>
                {sub?.status === 'ACTIVE' && sub?.stripeSubscriptionId && (
                  <Button variant="outlined" color="error" size="small" startIcon={<CancelIcon />}
                    onClick={() => setCancelOpen(true)}>Cancel Plan</Button>
                )}
              </Box>
              {sub?.features && Object.keys(sub.features).length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {Object.entries(sub.features).map(([k, v]) => (
                    <Chip key={k} size="small" icon={v ? <CheckCircleIcon /> : undefined}
                      label={k.replace(/_/g, ' ')}
                      color={v ? 'success' : 'default'} variant={v ? 'filled' : 'outlined'}
                      sx={{ textTransform: 'capitalize' }} />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Available Plans */}
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Available Plans</Typography>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {activePlans.map((plan: any) => {
              const isCurrent = plan.name === sub?.planName;
              const color = planColors[plan.name] || '#1565C0';
              return (
                <Grid key={plan.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={{ border: isCurrent ? `2px solid ${color}` : '1px solid #E0E0E0', transition: 'all 0.2s', '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.1)' } }}>
                    <Box sx={{ height: 4, bgcolor: color }} />
                    <CardContent>
                      <Typography variant="h6" fontWeight={700}>{plan.displayName}</Typography>
                      <Typography variant="h4" fontWeight={800} sx={{ color, my: 1 }}>
                        ₹{plan.price}<Typography component="span" variant="body2" color="text.secondary">/{plan.billingCycle === 'YEARLY' ? 'yr' : 'mo'}</Typography>
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{plan.description}</Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Stack spacing={0.5} sx={{ mb: 2 }}>
                        <Typography variant="caption">Up to {plan.maxProfilesPerCustomer} child profiles</Typography>
                        <Typography variant="caption">{plan.billingCycle === 'YEARLY' ? 'Billed annually' : 'Billed monthly'}</Typography>
                      </Stack>
                      {isCurrent ? (
                        <Button fullWidth variant="outlined" disabled>Current Plan</Button>
                      ) : (
                        <Button fullWidth variant="contained" sx={{ bgcolor: color }}
                          disabled={checkoutMutation.isPending}
                          onClick={() => checkoutMutation.mutate(plan.id)}>
                          {checkoutMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Subscribe'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {/* Recent Invoices */}
          {myInvoices.length > 0 && (
            <>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Recent Invoices</Typography>
              <Card>
                <CardContent sx={{ p: 0 }}>
                  {myInvoices.map((inv: any) => (
                    <Box key={inv.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid #F0F0F0' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{inv.planName} — ₹{inv.amount}</Typography>
                        <Typography variant="caption" color="text.secondary">{new Date(inv.createdAt).toLocaleDateString()}</Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {inv.status === 'PAID' && (
                          <Button size="small" startIcon={<PictureAsPdfIcon />}
                            onClick={() => openInvoicePdf(inv.id)}
                            sx={{ textTransform: 'none', fontSize: 12 }}>
                            Invoice
                          </Button>
                        )}
                        <Chip size="small" label={inv.status} color={inv.status === 'PAID' ? 'success' : 'warning'} />
                      </Stack>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)}>
        <DialogTitle fontWeight={700}>Cancel Subscription</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to cancel your <strong>{sub?.planDisplayName}</strong> subscription?</Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>You will lose access to premium features at the end of your billing period.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)}>Keep Plan</Button>
          <Button variant="contained" color="error" onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}>
            {cancelMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Cancel Subscription'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="info" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
