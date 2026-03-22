import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Switch, FormControlLabel, CircularProgress, Snackbar, Alert,
  IconButton, Tooltip,
} from '@mui/material';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import { syncPlanToStripe } from '../../api/billing';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import LoadingPage from '../../components/LoadingPage';
import { alpha, useTheme } from '@mui/material/styles';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  billingCycle: string;
  maxCustomers: number;
  maxProfilesPerCustomer: number;
  features: Record<string, boolean>;
  description: string;
  isDefault: boolean;
  active: boolean;
  sortOrder: number;
}

const FEATURE_LABELS: Record<string, string> = {
  dns_filtering: 'DNS Filtering',
  ai_monitoring: 'AI Monitoring',
  gps_tracking: 'GPS Tracking',
  screen_time: 'Screen Time',
  rewards: 'Rewards System',
  instant_pause: 'Instant Pause',
  content_reporting: 'Content Reports',
  multi_admin: 'Multi-Admin',
};

const PLAN_GRADIENTS: Record<string, string> = {
  STARTER: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
  GROWTH: 'linear-gradient(135deg, #2E7D32 0%, #66BB6A 100%)',
  ENTERPRISE: 'linear-gradient(135deg, #7B1FA2 0%, #AB47BC 100%)',
};

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #455A64 0%, #78909C 100%)';

const EMPTY_FORM: Omit<Plan, 'id'> = {
  name: '', displayName: '', price: 0, billingCycle: 'MONTHLY',
  maxCustomers: 100, maxProfilesPerCustomer: 5,
  features: { dns_filtering: true, ai_monitoring: false, gps_tracking: false, screen_time: true, rewards: false, instant_pause: true, content_reporting: false, multi_admin: false },
  description: '', isDefault: false, active: true, sortOrder: 0,
};

export default function SubscriptionPlansPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [snack, setSnack] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');
  const [syncingPlanId, setSyncingPlanId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get('/admin/plans?all=true').then(r => (r.data?.data || r.data) as Plan[]).catch(() => []),
  });

  const createMut = useMutation({
    mutationFn: (body: typeof form) => api.post('/admin/plans', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); setSnackSeverity('success'); setSnack('Plan created'); handleClose(); },
    onError: (e: any) => setFormError(e.response?.data?.message || 'Failed'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: typeof form }) => api.put(`/admin/plans/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); setSnackSeverity('success'); setSnack('Plan updated'); handleClose(); },
    onError: (e: any) => setFormError(e.response?.data?.message || 'Failed'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/plans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plans'] }); setSnackSeverity('success'); setSnack('Plan deleted'); },
  });

  function openAdd() { setEditing(null); setForm({ ...EMPTY_FORM, features: { ...EMPTY_FORM.features } }); setFormError(''); setOpen(true); }
  function openEdit(p: Plan) {
    setEditing(p);
    setForm({ name: p.name, displayName: p.displayName, price: p.price, billingCycle: p.billingCycle, maxCustomers: p.maxCustomers, maxProfilesPerCustomer: p.maxProfilesPerCustomer, features: { ...p.features }, description: p.description, isDefault: p.isDefault, active: p.active, sortOrder: p.sortOrder });
    setFormError(''); setOpen(true);
  }
  function handleClose() { setOpen(false); setEditing(null); }
  function handleSave() {
    if (!form.name.trim() || !form.displayName.trim()) { setFormError('Name and display name required'); return; }
    if (editing) updateMut.mutate({ id: editing.id, body: form });
    else createMut.mutate(form);
  }

  async function handleSyncStripe(planId: string) {
    setSyncingPlanId(planId);
    try {
      await syncPlanToStripe(planId);
      setSnackSeverity('success');
      setSnack('Plan synced to Stripe');
    } catch (e: any) {
      setSnackSeverity('error');
      setSnack(e.response?.data?.message || 'Failed to sync plan to Stripe');
    } finally {
      setSyncingPlanId(null);
    }
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<CardMembershipIcon />}
        title="Subscription Plans"
        subtitle={`${plans.length} plans configured`}
        iconColor={theme.palette.secondary.main}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}
            sx={{ bgcolor: 'secondary.main' }}>
            Create Plan
          </Button>
        }
      />

      {isLoading ? (
        <LoadingPage />
      ) : (
        <Grid container spacing={3}>
          {plans.map((plan, idx) => {
            const gradient = PLAN_GRADIENTS[plan.name] || DEFAULT_GRADIENT;
            const featureCount = plan.features ? Object.values(plan.features).filter(Boolean).length : 0;
            return (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={plan.id}>
                <AnimatedPage delay={idx * 0.08}>
                  <Card sx={{
                    height: '100%', display: 'flex', flexDirection: 'column',
                    transition: 'all 0.3s ease',
                    '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 12px 40px rgba(0,0,0,0.12)' },
                    ...(!plan.active && { opacity: 0.6 }),
                  }}>
                    {/* Header */}
                    <Box sx={{ background: gradient, color: '#fff', p: 3, position: 'relative' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: 1.5 }}>{plan.name}</Typography>
                          <Typography variant="h5" fontWeight={800}>{plan.displayName}</Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Sync to Stripe">
                            <IconButton size="small"
                              sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#fff' } }}
                              onClick={() => handleSyncStripe(plan.id)}
                              disabled={syncingPlanId === plan.id}>
                              {syncingPlanId === plan.id
                                ? <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.8)' }} />
                                : <SyncIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#fff' } }} onClick={() => openEdit(plan)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {!plan.isDefault && (
                            <Tooltip title="Delete">
                              <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#fff' } }}
                                onClick={() => deleteMut.mutate(plan.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Box>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="h3" fontWeight={900} sx={{ display: 'inline' }}>${plan.price}</Typography>
                        <Typography variant="body2" sx={{ opacity: 0.8, display: 'inline', ml: 0.5 }}>/{plan.billingCycle === 'YEARLY' ? 'yr' : 'mo'}</Typography>
                      </Box>
                      {plan.isDefault && (
                        <Chip label="DEFAULT" size="small" sx={{ position: 'absolute', top: 12, right: 12, bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 700, fontSize: 10 }} />
                      )}
                    </Box>
                    {/* Details */}
                    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                        {plan.description}
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                          <Chip size="small" label={`${plan.maxCustomers.toLocaleString()} customers`} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
                          <Chip size="small" label={`${plan.maxProfilesPerCustomer} profiles/cust`} sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.dark' }} />
                        </Stack>
                      </Box>
                      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Features ({featureCount}/{Object.keys(FEATURE_LABELS).length})
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                          const enabled = plan.features?.[key] ?? false;
                          return (
                            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4 }}>
                              {enabled
                                ? <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                : <CancelIcon sx={{ fontSize: 16, color: 'text.disabled' }} />}
                              <Typography variant="body2" sx={{ color: enabled ? 'text.primary' : 'text.disabled' }}>{label}</Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </CardContent>
                  </Card>
                </AnimatedPage>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editing ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
        <DialogContent dividers>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Name (key)" value={form.name} disabled={!!editing}
                onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Display Name" value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Price" type="number" value={form.price}
                onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} inputProps={{ min: 0, step: 0.01 }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth select label="Billing" value={form.billingCycle}
                onChange={e => setForm(f => ({ ...f, billingCycle: e.target.value }))}>
                <MenuItem value="MONTHLY">Monthly</MenuItem>
                <MenuItem value="YEARLY">Yearly</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Sort Order" type="number" value={form.sortOrder}
                onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Max Customers" type="number" value={form.maxCustomers}
                onChange={e => setForm(f => ({ ...f, maxCustomers: Number(e.target.value) }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Max Profiles/Customer" type="number" value={form.maxProfilesPerCustomer}
                onChange={e => setForm(f => ({ ...f, maxProfilesPerCustomer: Number(e.target.value) }))} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label="Description" multiline rows={2} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Grid>
            <Grid size={12}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Feature Toggles</Typography>
              <Grid container spacing={1}>
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={key}>
                    <FormControlLabel
                      control={<Switch checked={form.features?.[key] ?? false}
                        onChange={e => setForm(f => ({ ...f, features: { ...f.features, [key]: e.target.checked } }))} />}
                      label={label}
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            sx={{ bgcolor: 'secondary.main', minWidth: 100 }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : editing ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackSeverity} onClose={() => setSnack('')} variant="filled" sx={{ width: '100%' }}>
          {snack}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
