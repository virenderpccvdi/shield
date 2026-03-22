import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Button, Stack, Alert, Snackbar, Divider, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Slider, LinearProgress,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TimerIcon from '@mui/icons-material/Timer';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LanguageIcon from '@mui/icons-material/Language';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface ChildProfile { id: string; name: string; }

interface AppBudget {
  id: string;
  appName: string;
  domain: string;
  dailyMinutes: number;
  usedMinutes?: number;
}

interface AddBudgetForm {
  appName: string;
  domain: string;
  dailyMinutes: number;
}

function formatMins(m: number): string {
  if (m === 0) return '0m';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min > 0 ? `${min}m` : ''}`.trim() : `${min}m`;
}

function BudgetStatusChip({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  if (pct >= 100) return (
    <Chip size="small" label="Depleted" sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: '#FFEBEE', color: '#C62828' }} />
  );
  if (pct >= 80) return (
    <Chip size="small" label="Warning" sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: '#FFF8E1', color: '#F57F17' }} />
  );
  return (
    <Chip size="small" label="On track" sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: '#E8F5E9', color: '#2E7D32' }} />
  );
}

const FORM_INITIAL: AddBudgetForm = { appName: '', domain: '', dailyMinutes: 60 };

export default function AppBudgetsPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; budgetId: string | null; budgetName: string }>({
    open: false, budgetId: null, budgetName: '',
  });
  const [form, setForm] = useState<AddBudgetForm>(FORM_INITIAL);
  const [formErrors, setFormErrors] = useState<Partial<AddBudgetForm>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => []),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const { data: budgets, isLoading: loadingBudgets } = useQuery({
    queryKey: ['app-budgets', profileId],
    queryFn: () =>
      api.get(`/dns/app-budgets/${profileId}`)
        .then(r => {
          const d = r.data?.data;
          return (d?.content ?? d ?? []) as AppBudget[];
        }).catch(() => []),
    enabled: !!profileId,
  });

  const addMutation = useMutation({
    mutationFn: (data: AddBudgetForm) => api.post(`/dns/app-budgets/${profileId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app-budgets', profileId] });
      setDialogOpen(false);
      setForm(FORM_INITIAL);
      setSnackbar({ open: true, message: 'App budget added', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to add budget', severity: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (budgetId: string) => api.delete(`/dns/app-budgets/${profileId}/${budgetId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app-budgets', profileId] });
      setDeleteDialog({ open: false, budgetId: null, budgetName: '' });
      setSnackbar({ open: true, message: 'Budget removed', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to remove budget', severity: 'error' }),
  });

  const validateForm = (): boolean => {
    const errors: Partial<AddBudgetForm> = {};
    if (!form.appName.trim()) errors.appName = 'App name is required';
    if (!form.domain.trim()) errors.domain = 'Domain is required';
    else if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(form.domain.trim())) {
      errors.domain = 'Enter a valid domain (e.g. youtube.com)';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdd = () => {
    if (!validateForm()) return;
    addMutation.mutate(form);
  };

  if (loadingChildren) return <LoadingPage />;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<TimerIcon />} title="App Budgets" subtitle="Set daily time limits for specific apps" iconColor="#F57F17" />
        <EmptyState title="No child profiles" description="Add a child profile first to configure app budgets" />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<TimerIcon />}
        title="App Budgets"
        subtitle="Set daily time limits for specific apps or websites"
        iconColor="#F57F17"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? '#F57F17' : 'rgba(245,127,23,0.08)',
                  color: (profileId === c.id) ? 'white' : '#F57F17',
                  '&:hover': { bgcolor: (profileId === c.id) ? '#E65100' : 'rgba(245,127,23,0.16)' },
                }}
              />
            ))}
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => { setForm(FORM_INITIAL); setFormErrors({}); setDialogOpen(true); }}
              sx={{ bgcolor: '#F57F17', '&:hover': { bgcolor: '#E65100' }, fontWeight: 600 }}
            >
              Add Budget
            </Button>
          </Stack>
        }
      />

      {loadingBudgets ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : !budgets || budgets.length === 0 ? (
        <AnimatedPage delay={0.1}>
          <Card>
            <CardContent sx={{ py: 5, textAlign: 'center' }}>
              <TimerIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
              <Typography variant="h6" fontWeight={600} color="text.secondary" gutterBottom>
                No app budgets configured
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mb: 2.5 }}>
                Add a budget to limit daily time for specific apps like YouTube or TikTok
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => { setForm(FORM_INITIAL); setFormErrors({}); setDialogOpen(true); }}
                sx={{ bgcolor: '#F57F17', '&:hover': { bgcolor: '#E65100' }, fontWeight: 600 }}
              >
                Add First Budget
              </Button>
            </CardContent>
          </Card>
        </AnimatedPage>
      ) : (
        <AnimatedPage delay={0.1}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              {budgets.map((budget, i) => {
                const used = budget.usedMinutes ?? 0;
                const total = budget.dailyMinutes;
                const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
                const barColor = pct >= 100 ? '#E53935' : pct >= 80 ? '#FB8C00' : '#43A047';

                return (
                  <Box key={budget.id}>
                    {i > 0 && <Divider />}
                    <Box sx={{ px: 2.5, py: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box sx={{
                            width: 40, height: 40, borderRadius: '10px', bgcolor: 'rgba(245,127,23,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <LanguageIcon sx={{ color: '#F57F17', fontSize: 20 }} />
                          </Box>
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{budget.appName}</Typography>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                              {budget.domain}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <BudgetStatusChip used={used} total={total} />
                          <IconButton
                            size="small"
                            onClick={() => setDeleteDialog({ open: true, budgetId: budget.id, budgetName: budget.appName })}
                            sx={{ color: 'error.light', '&:hover': { color: 'error.main', bgcolor: '#FFEBEE' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>

                      <Box>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatMins(used)} used today
                          </Typography>
                          <Typography variant="caption" fontWeight={700} color="text.primary">
                            {formatMins(total)} / day
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 7, borderRadius: 4,
                            bgcolor: 'action.hover',
                            '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: barColor },
                          }}
                        />
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                          {formatMins(Math.max(0, total - used))} remaining
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* Add Budget Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add App Budget</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="App Name"
              placeholder="e.g. YouTube"
              value={form.appName}
              onChange={e => setForm(f => ({ ...f, appName: e.target.value }))}
              error={!!formErrors.appName}
              helperText={formErrors.appName}
              size="small"
              fullWidth
            />
            <TextField
              label="Domain"
              placeholder="e.g. youtube.com"
              value={form.domain}
              onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
              error={!!formErrors.domain}
              helperText={formErrors.domain || 'Enter the main domain of the app'}
              size="small"
              fullWidth
            />
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                Daily Limit: <span style={{ color: '#F57F17' }}>{formatMins(form.dailyMinutes)}</span>
              </Typography>
              <Slider
                value={form.dailyMinutes}
                min={15}
                max={240}
                step={15}
                onChange={(_, val) => setForm(f => ({ ...f, dailyMinutes: val as number }))}
                valueLabelDisplay="auto"
                valueLabelFormat={formatMins}
                marks={[
                  { value: 15, label: '15m' },
                  { value: 60, label: '1h' },
                  { value: 120, label: '2h' },
                  { value: 180, label: '3h' },
                  { value: 240, label: '4h' },
                ]}
                sx={{
                  color: '#F57F17',
                  '& .MuiSlider-thumb': { width: 18, height: 18 },
                  '& .MuiSlider-markLabel': { fontSize: 11 },
                }}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={addMutation.isPending}
            sx={{ bgcolor: '#F57F17', '&:hover': { bgcolor: '#E65100' }, fontWeight: 600 }}
          >
            {addMutation.isPending ? 'Adding...' : 'Add Budget'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, budgetId: null, budgetName: '' })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Remove Budget</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Remove the daily budget for <strong>{deleteDialog.budgetName}</strong>? The child will have unlimited access to this app.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteDialog({ open: false, budgetId: null, budgetName: '' })} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteDialog.budgetId && deleteMutation.mutate(deleteDialog.budgetId)}
            disabled={deleteMutation.isPending}
            sx={{ fontWeight: 600 }}
          >
            {deleteMutation.isPending ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
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
