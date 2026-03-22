import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Button, Stack, Alert, Snackbar, Divider, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Switch, FormControlLabel, Fab, Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

const ICON_COLOR = '#1565C0';
const BG_COLOR = 'rgba(21,101,192,0.08)';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface ChildProfile { id: string; name: string; }

interface Schedule {
  id: string;
  name: string;
  isActive: boolean;
  daysBitmask: number;
  allowStart: string;
  allowEnd: string;
  blockOutside: boolean;
}

interface ScheduleForm {
  name: string;
  isActive: boolean;
  daysBitmask: number;
  allowStart: string;
  allowEnd: string;
  blockOutside: boolean;
}

const FORM_INITIAL: ScheduleForm = {
  name: '',
  isActive: true,
  daysBitmask: 0b0011111, // Mon–Fri by default
  allowStart: '08:00',
  allowEnd: '21:00',
  blockOutside: true,
};

function formatTime12(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}

function DayChips({ bitmask, size = 'small' }: { bitmask: number; size?: 'small' | 'medium' }) {
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {DAY_LABELS.map((day, i) => {
        const active = (bitmask >> i) & 1;
        return (
          <Chip
            key={day}
            label={day}
            size={size}
            sx={{
              height: size === 'small' ? 22 : 28,
              fontSize: size === 'small' ? 10 : 12,
              fontWeight: 700,
              bgcolor: active ? ICON_COLOR : 'action.hover',
              color: active ? 'white' : 'text.disabled',
              border: 'none',
            }}
          />
        );
      })}
    </Stack>
  );
}

function DaySelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {DAY_LABELS.map((day, i) => {
        const active = (value >> i) & 1;
        return (
          <Chip
            key={day}
            label={day}
            onClick={() => onChange(active ? value & ~(1 << i) : value | (1 << i))}
            sx={{
              height: 32,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              bgcolor: active ? ICON_COLOR : 'action.hover',
              color: active ? 'white' : 'text.secondary',
              '&:hover': {
                bgcolor: active ? '#0D47A1' : 'action.selected',
              },
            }}
          />
        );
      })}
    </Stack>
  );
}

export default function AccessSchedulePage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; scheduleId: string | null; scheduleName: string }>({
    open: false, scheduleId: null, scheduleName: '',
  });
  const [form, setForm] = useState<ScheduleForm>(FORM_INITIAL);
  const [formErrors, setFormErrors] = useState<{ name?: string; days?: string }>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => [] as ChildProfile[]),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const { data: schedules, isLoading: loadingSchedules } = useQuery({
    queryKey: ['schedules', profileId],
    queryFn: () =>
      api.get(`/dns/access-schedules/${profileId}`)
        .then(r => {
          const d = r.data?.data;
          return (d?.content ?? d ?? []) as Schedule[];
        }).catch(() => []),
    enabled: !!profileId,
  });

  const addMutation = useMutation({
    mutationFn: (data: ScheduleForm) => api.post(`/dns/access-schedules/${profileId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules', profileId] });
      setDialogOpen(false);
      setSnackbar({ open: true, message: 'Schedule created', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to create schedule', severity: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScheduleForm }) =>
      api.put(`/dns/access-schedules/${profileId}/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules', profileId] });
      setDialogOpen(false);
      setSnackbar({ open: true, message: 'Schedule updated', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to update schedule', severity: 'error' }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, current }: { id: string; current: Schedule }) =>
      api.put(`/dns/access-schedules/${profileId}/${id}`, { ...current, isActive: !current.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules', profileId] }),
    onError: () => setSnackbar({ open: true, message: 'Failed to toggle schedule', severity: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/dns/access-schedules/${profileId}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules', profileId] });
      setDeleteDialog({ open: false, scheduleId: null, scheduleName: '' });
      setSnackbar({ open: true, message: 'Schedule deleted', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to delete schedule', severity: 'error' }),
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(FORM_INITIAL);
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      isActive: s.isActive,
      daysBitmask: s.daysBitmask,
      allowStart: s.allowStart,
      allowEnd: s.allowEnd,
      blockOutside: s.blockOutside,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: { name?: string; days?: string } = {};
    if (!form.name.trim()) errors.name = 'Schedule name is required';
    if (form.daysBitmask === 0) errors.days = 'Select at least one day';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      addMutation.mutate(form);
    }
  };

  const isMutating = addMutation.isPending || updateMutation.isPending;

  if (loadingChildren) return <LoadingPage />;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader
          icon={<ScheduleIcon />}
          title="Access Schedule"
          subtitle="Configure internet access windows per child"
          iconColor={ICON_COLOR}
        />
        <EmptyState title="No child profiles" description="Add a child profile first to configure access schedules" />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ScheduleIcon />}
        title="Access Schedule"
        subtitle="Define when each child can access the internet during the day"
        iconColor={ICON_COLOR}
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: profileId === c.id ? ICON_COLOR : BG_COLOR,
                  color: profileId === c.id ? 'white' : ICON_COLOR,
                  '&:hover': { bgcolor: profileId === c.id ? '#0D47A1' : 'rgba(21,101,192,0.16)' },
                }}
              />
            ))}
          </Stack>
        }
      />

      {loadingSchedules ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : !schedules || schedules.length === 0 ? (
        <AnimatedPage delay={0.1}>
          <Card>
            <CardContent sx={{ py: 5, textAlign: 'center' }}>
              <ScheduleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
              <Typography variant="h6" fontWeight={600} color="text.secondary" gutterBottom>
                No schedules configured
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mb: 2.5 }}>
                Create a schedule to control when this child can access the internet
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openAdd}
                sx={{ bgcolor: ICON_COLOR, '&:hover': { bgcolor: '#0D47A1' }, fontWeight: 600 }}
              >
                Add First Schedule
              </Button>
            </CardContent>
          </Card>
        </AnimatedPage>
      ) : (
        <AnimatedPage delay={0.1}>
          <Stack spacing={2}>
            {schedules.map(s => (
              <Card key={s.id} sx={{ opacity: s.isActive ? 1 : 0.65 }}>
                <CardContent sx={{ py: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                    {/* Left: icon + info */}
                    <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{
                        width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
                        bgcolor: s.isActive ? BG_COLOR : 'action.hover',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: s.isActive ? ICON_COLOR : 'text.disabled',
                      }}>
                        <AccessTimeIcon sx={{ fontSize: 22 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                          <Typography variant="subtitle2" fontWeight={700} noWrap>
                            {s.name}
                          </Typography>
                          {s.blockOutside && (
                            <Chip
                              label="Block outside"
                              size="small"
                              sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'rgba(198,40,40,0.08)', color: '#C62828' }}
                            />
                          )}
                        </Stack>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap">
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                            {formatTime12(s.allowStart)} – {formatTime12(s.allowEnd)}
                          </Typography>
                        </Stack>
                        <DayChips bitmask={s.daysBitmask} />
                      </Box>
                    </Stack>

                    {/* Right: toggle + actions */}
                    <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
                      <Tooltip title={s.isActive ? 'Disable schedule' : 'Enable schedule'}>
                        <Switch
                          checked={s.isActive}
                          size="small"
                          onChange={() => toggleMutation.mutate({ id: s.id, current: s })}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: ICON_COLOR },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ICON_COLOR },
                          }}
                        />
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={() => openEdit(s)}
                        sx={{ color: 'text.secondary', '&:hover': { color: ICON_COLOR, bgcolor: BG_COLOR } }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => setDeleteDialog({ open: true, scheduleId: s.id, scheduleName: s.name })}
                        sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: '#FFEBEE' } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </AnimatedPage>
      )}

      {/* FAB */}
      {schedules && schedules.length > 0 && (
        <Fab
          color="primary"
          onClick={openAdd}
          aria-label="Add schedule"
          sx={{
            position: 'fixed', bottom: 32, right: 32,
            bgcolor: ICON_COLOR, '&:hover': { bgcolor: '#0D47A1' },
            boxShadow: '0 4px 20px rgba(21,101,192,0.4)',
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingId ? 'Edit Schedule' : 'Add Schedule'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Schedule Name"
              placeholder="e.g. School Day"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              error={!!formErrors.name}
              helperText={formErrors.name}
              size="small"
              fullWidth
            />

            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                Active Days
              </Typography>
              <DaySelector
                value={form.daysBitmask}
                onChange={v => setForm(f => ({ ...f, daysBitmask: v }))}
              />
              {formErrors.days && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  {formErrors.days}
                </Typography>
              )}
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                  Allow From
                </Typography>
                <TextField
                  type="time"
                  value={form.allowStart}
                  onChange={e => setForm(f => ({ ...f, allowStart: e.target.value }))}
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { step: 300 } }}
                  sx={{ '& input': { fontWeight: 600 } }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                  Allow Until
                </Typography>
                <TextField
                  type="time"
                  value={form.allowEnd}
                  onChange={e => setForm(f => ({ ...f, allowEnd: e.target.value }))}
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { step: 300 } }}
                  sx={{ '& input': { fontWeight: 600 } }}
                />
              </Box>
            </Stack>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.blockOutside}
                    onChange={e => setForm(f => ({ ...f, blockOutside: e.target.checked }))}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: ICON_COLOR },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ICON_COLOR },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Block outside window</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Internet is blocked when outside the allowed time window
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: ICON_COLOR },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ICON_COLOR },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Active</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Schedule is currently enforced
                    </Typography>
                  </Box>
                }
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isMutating}
            sx={{ bgcolor: ICON_COLOR, '&:hover': { bgcolor: '#0D47A1' }, fontWeight: 600 }}
          >
            {isMutating ? 'Saving...' : editingId ? 'Save Changes' : 'Create Schedule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, scheduleId: null, scheduleName: '' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Schedule</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Delete <strong>{deleteDialog.scheduleName}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setDeleteDialog({ open: false, scheduleId: null, scheduleName: '' })}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteDialog.scheduleId && deleteMutation.mutate(deleteDialog.scheduleId)}
            disabled={deleteMutation.isPending}
            sx={{ fontWeight: 600 }}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
