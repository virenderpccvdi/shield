import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Grid, Chip, Stack, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch, FormControlLabel,
  Alert, Snackbar, Tooltip, IconButton, Divider, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SecurityIcon from '@mui/icons-material/Security';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PsychologyIcon from '@mui/icons-material/Psychology';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DnsIcon from '@mui/icons-material/Dns';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  billingCycle: string;
  maxProfilesPerCustomer: number;
  features?: Record<string, boolean>;
  description?: string;
  active: boolean;
  sortOrder: number;
  tenantId?: string;
}

const FEATURE_META = [
  { key: 'dns_filtering',     label: 'DNS Filtering',    icon: <SecurityIcon sx={{ fontSize: 16 }} />,        color: '#1565C0', desc: 'Block harmful/adult content via DNS' },
  { key: 'screen_time',       label: 'Screen Time',      icon: <AccessTimeIcon sx={{ fontSize: 16 }} />,      color: '#E65100', desc: 'Daily screen time limits & schedules' },
  { key: 'gps_tracking',      label: 'GPS Tracking',     icon: <LocationOnIcon sx={{ fontSize: 16 }} />,      color: '#00695C', desc: 'Real-time location tracking' },
  { key: 'ai_monitoring',     label: 'AI Monitoring',    icon: <PsychologyIcon sx={{ fontSize: 16 }} />,      color: '#6A1B9A', desc: 'AI-powered anomaly detection' },
  { key: 'rewards',           label: 'Rewards',          icon: <EmojiEventsIcon sx={{ fontSize: 16 }} />,     color: '#F9A825', desc: 'Gamified rewards for responsible use' },
  { key: 'instant_pause',     label: 'Instant Pause',    icon: <PauseCircleIcon sx={{ fontSize: 16 }} />,     color: '#C62828', desc: 'One-click internet pause per child' },
  { key: 'content_reporting', label: 'Reports',          icon: <AssessmentIcon sx={{ fontSize: 16 }} />,      color: '#2E7D32', desc: 'Detailed browsing & activity reports' },
  { key: 'geofencing',        label: 'Geofencing',       icon: <LocationOnIcon sx={{ fontSize: 16 }} />,      color: '#1B5E20', desc: 'Safe zones and location alerts' },
];

const EMPTY_FEATURES: Record<string, boolean> = {
  dns_filtering: true, screen_time: true, gps_tracking: false,
  ai_monitoring: false, rewards: false, instant_pause: true,
  content_reporting: false, geofencing: false,
};

function PlanDialog({ open, plan, onClose, onSaved }: {
  open: boolean; plan?: Plan; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!plan;
  const [name, setName]               = useState(plan?.name ?? '');
  const [displayName, setDisplayName] = useState(plan?.displayName ?? '');
  const [price, setPrice]             = useState(String(plan?.price ?? '0'));
  const [cycle, setCycle]             = useState(plan?.billingCycle ?? 'MONTHLY');
  const [maxProfiles, setMaxProfiles] = useState(String(plan?.maxProfilesPerCustomer ?? 5));
  const [description, setDesc]        = useState(plan?.description ?? '');
  const [active, setActive]           = useState(plan?.active ?? true);
  const [sortOrder, setSortOrder]     = useState(plan?.sortOrder ?? 0);
  const [features, setFeatures]       = useState<Record<string, boolean>>(plan?.features ?? { ...EMPTY_FEATURES });
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState('');

  const toggleFeature = (key: string) => setFeatures(f => ({ ...f, [key]: !f[key] }));

  const handleSave = async () => {
    if (!name.trim() || !displayName.trim()) { setErr('Name and display name are required'); return; }
    setSaving(true); setErr('');
    try {
      const payload = {
        name: name.trim(), displayName: displayName.trim(),
        price: parseFloat(price) || 0, billingCycle: cycle,
        maxProfilesPerCustomer: parseInt(maxProfiles) || 5,
        description, active, features, planType: 'CUSTOMER',
        sortOrder,
      };
      if (isEdit) {
        await api.put(`/admin/plans/${plan!.id}`, payload);
      } else {
        await api.post('/admin/plans', payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Failed to save plan');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CardMembershipIcon sx={{ color: '#00897B' }} />
        {isEdit ? 'Edit Customer Plan' : 'Create Customer Plan'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Plan Name (internal) *" value={name}
                onChange={e => setName(e.target.value)} placeholder="e.g. BASIC_FAMILY" disabled={isEdit}
                helperText="Unique identifier, no spaces" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Display Name *" value={displayName}
                onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Basic Family" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField fullWidth size="small" label="Price (₹)" type="number"
                value={price} onChange={e => setPrice(e.target.value)} inputProps={{ min: 0 }} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Billing Cycle</InputLabel>
                <Select value={cycle} label="Billing Cycle" onChange={e => setCycle(e.target.value)}>
                  <MenuItem value="MONTHLY">Monthly</MenuItem>
                  <MenuItem value="YEARLY">Yearly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth size="small" label="Max Child Profiles" type="number"
                value={maxProfiles} onChange={e => setMaxProfiles(e.target.value)} inputProps={{ min: 1, max: 20 }} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth size="small" label="Description" multiline rows={2}
                value={description} onChange={e => setDesc(e.target.value)} />
            </Grid>
          </Grid>

          <Divider />

          {/* Feature toggles */}
          <Box>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>
              Features Included in this Plan
            </Typography>
            <Grid container spacing={1}>
              {FEATURE_META.map(f => {
                const enabled = features[f.key] ?? false;
                return (
                  <Grid key={f.key} size={{ xs: 12, sm: 6 }}>
                    <Box
                      onClick={() => toggleFeature(f.key)}
                      sx={{
                        p: 1.25, borderRadius: 1.5, cursor: 'pointer',
                        border: `1.5px solid ${enabled ? f.color + '60' : '#E2E8F0'}`,
                        bgcolor: enabled ? f.color + '08' : '#FAFAFA',
                        transition: 'all 0.15s ease',
                        display: 'flex', alignItems: 'center', gap: 1,
                        '&:hover': { borderColor: f.color + '80' },
                      }}
                    >
                      <Box sx={{ color: enabled ? f.color : '#CBD5E1' }}>{f.icon}</Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontSize={12} fontWeight={600} color={enabled ? 'text.primary' : 'text.disabled'}>
                          {f.label}
                        </Typography>
                        <Typography fontSize={10} color="text.disabled">{f.desc}</Typography>
                      </Box>
                      {enabled
                        ? <CheckCircleIcon sx={{ fontSize: 16, color: f.color }} />
                        : <CancelIcon sx={{ fontSize: 16, color: '#CBD5E1' }} />}
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          <FormControlLabel control={<Switch checked={active} onChange={e => setActive(e.target.checked)} />}
            label={<Typography variant="body2">Plan is active (visible to customers)</Typography>} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          sx={{ bgcolor: '#00897B', '&:hover': { bgcolor: '#00695C' }, minWidth: 140 }}>
          {saving ? <CircularProgress size={18} color="inherit" /> : isEdit ? 'Save Changes' : 'Create Plan'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function IspPlansPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | undefined>();
  const [snack, setSnack] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Plan | null>(null);

  const { data, isLoading } = useQuery<Plan[]>({
    queryKey: ['isp-customer-plans'],
    queryFn: () => api.get('/admin/plans?all=true').then(r => {
      const d = r.data;
      return (Array.isArray(d) ? d : d?.data ?? []) as Plan[];
    }).catch(() => []),
  });

  const plans = data ?? [];

  const handleDelete = async (plan: Plan) => {
    try {
      await api.delete(`/admin/plans/${plan.id}`);
      qc.invalidateQueries({ queryKey: ['isp-customer-plans'] });
      setSnack('Plan deleted');
    } catch (e: any) {
      setSnack(e?.response?.data?.message ?? 'Delete failed');
    }
    setDeleteConfirm(null);
  };

  const featureCount = (p: Plan) => Object.values(p.features ?? {}).filter(Boolean).length;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<CardMembershipIcon />}
        title="Customer Plans"
        subtitle="Create and manage subscription plans for your customers"
        iconColor="#00897B"
        action={
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => { setEditPlan(undefined); setDialogOpen(true); }}
            sx={{ bgcolor: '#00897B', '&:hover': { bgcolor: '#00695C' } }}>
            Create Plan
          </Button>
        }
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<CardMembershipIcon sx={{ fontSize: 36, color: '#00897B' }} />}
          title="No customer plans yet"
          description="Create subscription plans that your customers can choose from. Each plan defines which features they can access."
          action={{ label: 'Create First Plan', onClick: () => { setEditPlan(undefined); setDialogOpen(true); } }}
        />
      ) : (
        <Grid container spacing={3}>
          {plans.map((plan, i) => (
            <Grid key={plan.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <AnimatedPage delay={i * 0.05}>
                <Card sx={{
                  height: '100%', position: 'relative', overflow: 'hidden',
                  border: plan.active ? '1px solid #E0F2F1' : '1px solid #E2E8F0',
                  opacity: plan.active ? 1 : 0.7,
                  transition: 'all 0.2s ease',
                  '&:hover': { boxShadow: '0 8px 30px rgba(0,0,0,0.12)', transform: 'translateY(-3px)' },
                }}>
                  <Box sx={{ height: 4, background: plan.active ? 'linear-gradient(135deg, #00897B, #004D40)' : '#CBD5E1' }} />
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                      <Box>
                        <Typography fontWeight={800} fontSize={16}>{plan.displayName}</Typography>
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace">{plan.name}</Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <Chip size="small" label={plan.active ? 'Active' : 'Inactive'}
                          color={plan.active ? 'success' : 'default'}
                          sx={{ height: 20, fontSize: 10, fontWeight: 600 }} />
                      </Stack>
                    </Stack>

                    <Typography variant="h5" fontWeight={800} color="#00897B" sx={{ mb: 0.5 }}>
                      {plan.price > 0 ? `₹${plan.price}/${plan.billingCycle === 'YEARLY' ? 'yr' : 'mo'}` : 'Free'}
                    </Typography>

                    <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                      <Chip size="small" label={`${plan.maxProfilesPerCustomer} profiles`}
                        sx={{ height: 20, fontSize: 10, bgcolor: '#E0F2F1', color: '#00695C', fontWeight: 600 }} />
                      <Chip size="small" label={`${featureCount(plan)} features`}
                        sx={{ height: 20, fontSize: 10, bgcolor: '#E3F2FD', color: '#1565C0', fontWeight: 600 }} />
                    </Stack>

                    {plan.description && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                        {plan.description}
                      </Typography>
                    )}

                    {/* Feature chips */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                      {FEATURE_META.filter(f => plan.features?.[f.key]).map(f => (
                        <Tooltip key={f.key} title={f.desc}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.25,
                            bgcolor: f.color + '12', borderRadius: 1, border: `1px solid ${f.color}30` }}>
                            <Box sx={{ color: f.color, '& svg': { display: 'block' } }}>{f.icon}</Box>
                            <Typography fontSize={10} fontWeight={600} color={f.color}>{f.label}</Typography>
                          </Box>
                        </Tooltip>
                      ))}
                    </Box>

                    <Divider sx={{ mb: 1.5 }} />
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" startIcon={<EditIcon sx={{ fontSize: 13 }} />}
                        onClick={() => { setEditPlan(plan); setDialogOpen(true); }}
                        sx={{ fontSize: 11, flex: 1, borderColor: '#00897B', color: '#00897B' }}>
                        Edit
                      </Button>
                      <Tooltip title="Delete plan">
                        <IconButton size="small" onClick={() => setDeleteConfirm(plan)}
                          sx={{ color: '#E53935', '&:hover': { bgcolor: '#FFEBEE' } }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <PlanDialog
          open={dialogOpen}
          plan={editPlan}
          onClose={() => { setDialogOpen(false); setEditPlan(undefined); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['isp-customer-plans'] });
            setSnack(editPlan ? 'Plan updated' : 'Plan created');
          }}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} sx={{ color: '#B71C1C' }}>Delete Plan?</DialogTitle>
        <DialogContent>
          <Typography>Delete "{deleteConfirm?.displayName}"? Customers currently on this plan will keep it until they switch.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}
