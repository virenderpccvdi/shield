import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Stack, Divider,
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSubscription, getActivePlans, createCheckout, cancelSubscription, getMyInvoices } from '../../api/billing';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

export default function IspBillingPage() {
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [snack, setSnack] = useState('');

  const { data: sub, isLoading } = useQuery({ queryKey: ['my-subscription'], queryFn: getSubscription });
  const { data: plans } = useQuery({ queryKey: ['active-plans'], queryFn: getActivePlans });
  const { data: invoices } = useQuery({ queryKey: ['my-invoices'], queryFn: () => getMyInvoices(0, 10) });

  const checkoutMutation = useMutation({
    mutationFn: (planId: string) => createCheckout(planId),
    onSuccess: (data) => { if (data.sessionUrl) window.location.href = data.sessionUrl; },
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
      <PageHeader icon={<PaymentIcon />} title="Billing & Subscription" subtitle="Manage your ISP plan and invoices" iconColor="#00897B" />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          <Card sx={{ mb: 3 }}>
            <Box sx={{ height: 4, background: 'linear-gradient(135deg, #00897B 0%, #4DB6AC 100%)' }} />
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>{sub?.planDisplayName || 'No Plan'}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Chip size="small" label={sub?.status || 'NONE'} color={sub?.status === 'ACTIVE' ? 'success' : 'default'} />
                    {sub?.price > 0 && <Chip size="small" label={`₹${sub.price}/${sub.billingCycle === 'YEARLY' ? 'yr' : 'mo'}`} variant="outlined" />}
                  </Stack>
                </Box>
                {sub?.status === 'ACTIVE' && sub?.stripeSubscriptionId && (
                  <Button variant="outlined" color="error" size="small" startIcon={<CancelIcon />}
                    onClick={() => setCancelOpen(true)}>Cancel</Button>
                )}
              </Box>
              {sub?.features && (
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {Object.entries(sub.features).map(([k, v]) => (
                    <Chip key={k} size="small" icon={v ? <CheckCircleIcon /> : undefined}
                      label={k.replace(/_/g, ' ')} color={v ? 'success' : 'default'} variant={v ? 'filled' : 'outlined'}
                      sx={{ textTransform: 'capitalize' }} />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Plans</Typography>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {activePlans.map((plan: any) => {
              const isCurrent = plan.name === sub?.planName;
              return (
                <Grid key={plan.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card sx={{ border: isCurrent ? '2px solid #00897B' : '1px solid #E0E0E0' }}>
                    <CardContent>
                      <Typography variant="h6" fontWeight={700}>{plan.displayName}</Typography>
                      <Typography variant="h4" fontWeight={800} color="#00897B" sx={{ my: 1 }}>
                        ₹{plan.price}<Typography component="span" variant="body2" color="text.secondary">/{plan.billingCycle === 'YEARLY' ? 'yr' : 'mo'}</Typography>
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{plan.description}</Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Typography variant="caption">Up to {plan.maxCustomers} customers, {plan.maxProfilesPerCustomer} profiles each</Typography>
                      <Box sx={{ mt: 2 }}>
                        {isCurrent ? (
                          <Button fullWidth variant="outlined" disabled>Current Plan</Button>
                        ) : (
                          <Button fullWidth variant="contained" sx={{ bgcolor: '#00897B' }}
                            disabled={checkoutMutation.isPending}
                            onClick={() => checkoutMutation.mutate(plan.id)}>
                            {checkoutMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Subscribe'}
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {myInvoices.length > 0 && (
            <>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Invoice History</Typography>
              <Card>
                <CardContent sx={{ p: 0 }}>
                  {myInvoices.map((inv: any) => (
                    <Box key={inv.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid #F0F0F0' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{inv.planName} — ₹{inv.amount}</Typography>
                        <Typography variant="caption" color="text.secondary">{new Date(inv.createdAt).toLocaleDateString()}</Typography>
                      </Box>
                      <Chip size="small" label={inv.status} color={inv.status === 'PAID' ? 'success' : 'warning'} />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)}>
        <DialogTitle fontWeight={700}>Cancel Subscription</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to cancel your <strong>{sub?.planDisplayName}</strong> subscription?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)}>Keep Plan</Button>
          <Button variant="contained" color="error" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
            {cancelMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Cancel'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="info" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
