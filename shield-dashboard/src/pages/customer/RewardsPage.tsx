import {
  Box, Typography, Card, CardContent, Button, CircularProgress, LinearProgress,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, Tooltip,
  List, ListItem, ListItemText, Avatar,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AddIcon from '@mui/icons-material/Add';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import { gradients } from '../../theme/theme';
import LoadingPage from '../../components/LoadingPage';
import { useAuthStore } from '../../store/auth.store';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;      // PENDING | SUBMITTED | APPROVED | REJECTED
  rewardPoints: number;
  rewardMinutes: number;
  completedAt?: string;
  dueDate?: string;
}

function statusColor(status: string): 'default' | 'success' | 'warning' | 'error' {
  if (status === 'APPROVED') return 'success';
  if (status === 'SUBMITTED') return 'warning';
  if (status === 'REJECTED') return 'error';
  return 'default';
}

function statusLabel(status: string) {
  if (status === 'APPROVED') return 'Completed ✓';
  if (status === 'SUBMITTED') return 'Pending Approval';
  if (status === 'REJECTED') return 'Rejected';
  return 'Pending';
}

interface RewardsPageProps {
  profileId?: string;
}

interface LeaderboardEntry {
  profileId: string;
  name: string;
  totalPoints: number;
  streakDays?: number;
}

const RANK_MEDAL = ['🥇', '🥈', '🥉'];

export default function RewardsPage({ profileId: profileIdProp }: RewardsPageProps) {
  const theme = useTheme();
  const { profileId: profileIdParam } = useParams();
  const profileId = profileIdProp ?? profileIdParam;
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const tenantId = user?.tenantId;
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('10');
  const [createError, setCreateError] = useState('');

  // A6: Leaderboard
  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', tenantId],
    queryFn: () =>
      api.get(`/api/v1/rewards/leaderboard${tenantId ? `?tenantId=${tenantId}` : ''}`)
        .then(r => (r.data?.data ?? r.data) as LeaderboardEntry[])
        .catch(() => [] as LeaderboardEntry[]),
    enabled: true,
    staleTime: 120_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', profileId],
    queryFn: () =>
      api.get(`/rewards/tasks/${profileId}`)
        .then(r => {
          const raw = r.data;
          return (Array.isArray(raw) ? raw : raw?.data ?? []) as Task[];
        })
        .catch(() => [] as Task[]),
    refetchInterval: 30000,   // auto-refresh so newly created tasks appear
    enabled: !!profileId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: { title: string; description: string; rewardPoints: number; rewardMinutes: number }) =>
      api.post('/rewards/tasks', { profileId, ...payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', profileId] });
      setCreateOpen(false);
      setTitle(''); setDescription(''); setPoints('10'); setCreateError('');
    },
    onError: (err: any) => {
      setCreateError(err?.response?.data?.message ?? 'Failed to create task. Please try again.');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/rewards/tasks/${id}/approve`, { approved: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', profileId] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/rewards/tasks/${id}/reject`, { approved: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', profileId] }),
  });

  const handleCreate = () => {
    if (!title.trim()) { setCreateError('Task title is required.'); return; }
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts < 1) { setCreateError('Reward points must be at least 1.'); return; }
    setCreateError('');
    createMutation.mutate({ title: title.trim(), description: description.trim(), rewardPoints: pts, rewardMinutes: 30 });
  };

  const tasks = data || [];
  const approved = tasks.filter(t => t.status === 'APPROVED');
  const pending  = tasks.filter(t => t.status === 'PENDING');
  const submitted = tasks.filter(t => t.status === 'SUBMITTED');
  const totalPoints = approved.reduce((s, t) => s + (t.rewardPoints || 0), 0);
  const progress = tasks.length > 0 ? (approved.length / tasks.length) * 100 : 0;

  if (isLoading) return <LoadingPage />;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<EmojiEventsIcon />}
        title="Tasks & Rewards"
        subtitle="Assign tasks and track your child's progress"
        iconColor={theme.palette.warning.main}
        action={
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ borderRadius: 2, bgcolor: 'warning.main', '&:hover': { filter: 'brightness(0.9)' }, fontWeight: 700 }}>
            Assign Task
          </Button>
        }
      />

      {/* Reward Bank Card */}
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 3, background: `${gradients.orange} !important`, backgroundColor: 'transparent !important', border: 'none !important', color: '#fff', position: 'relative', overflow: 'hidden', '& .MuiTypography-root': { color: '#fff !important' } }}>
          <Box sx={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          <CardContent sx={{ position: 'relative', zIndex: 1, py: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ width: 64, height: 64, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <EmojiEventsIcon sx={{ fontSize: 32 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 0.5 }}>Points Earned</Typography>
                <Typography variant="h3" fontWeight={800}>
                  {totalPoints}
                  <Typography component="span" variant="h6" sx={{ opacity: 0.8, ml: 1 }}>pts</Typography>
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>{approved.length}/{tasks.length} completed</Typography>
                {submitted.length > 0 && (
                  <Chip label={`${submitted.length} awaiting approval`} size="small"
                    sx={{ mt: 0.5, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, fontSize: 11 }} />
                )}
                <Box sx={{ mt: 1, width: 100 }}>
                  <LinearProgress variant="determinate" value={progress}
                    sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { bgcolor: '#fff', borderRadius: 3 } }} />
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* A6: Leaderboard */}
      {leaderboard && leaderboard.length > 0 && (
        <AnimatedPage delay={0.12}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmojiEventsIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />
                Family Leaderboard
              </Typography>
              <List disablePadding>
                {leaderboard.slice(0, 5).map((entry, idx) => (
                  <ListItem key={entry.profileId} disableGutters
                    sx={{ py: 0.75, borderBottom: idx < Math.min(leaderboard.length, 5) - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <Avatar sx={{ width: 32, height: 32, mr: 1.5, fontSize: 18, bgcolor: 'transparent' }}>
                      {RANK_MEDAL[idx] ?? `#${idx + 1}`}
                    </Avatar>
                    <ListItemText
                      primary={<Typography fontWeight={600} fontSize={14}>{entry.name}</Typography>}
                      secondary={
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                          <Chip size="small" label={`${entry.totalPoints} pts`}
                            sx={{ height: 18, fontSize: 11, fontWeight: 700, bgcolor: 'warning.light', color: 'warning.dark' }} />
                          {(entry.streakDays ?? 0) > 0 && (
                            <Chip size="small" icon={<LocalFireDepartmentIcon sx={{ fontSize: 12 }} />}
                              label={`${entry.streakDays}-day streak`}
                              sx={{ height: 18, fontSize: 11, fontWeight: 600, bgcolor: 'error.light', color: 'error.dark', '& .MuiChip-icon': { color: 'error.dark' } }} />
                          )}
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* Pending approval — parent action needed */}
      {submitted.length > 0 && (
        <AnimatedPage delay={0.15}>
          <Card sx={{ mb: 3, border: '2px solid #FFA000', bgcolor: '#FFFDE7' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, color: 'warning.dark', display: 'flex', alignItems: 'center', gap: 1 }}>
                <HourglassBottomIcon sx={{ fontSize: 18 }} /> Awaiting Your Approval ({submitted.length})
              </Typography>
              <Stack spacing={1}>
                {submitted.map(task => (
                  <Box key={task.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: 2, bgcolor: '#fff', border: '1px solid #FFD54F' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={600}>{task.title}</Typography>
                      {task.description && <Typography variant="caption" color="text.secondary">{task.description}</Typography>}
                    </Box>
                    <Chip size="small" label={`+${task.rewardPoints || 0} pts`} sx={{ fontWeight: 700, bgcolor: 'warning.light', color: 'warning.dark' }} />
                    <Button size="small" variant="contained" onClick={() => approveMutation.mutate(task.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      sx={{ borderRadius: 2, bgcolor: 'success.main', '&:hover': { filter: 'brightness(0.9)' }, fontWeight: 700 }}>
                      {approveMutation.isPending ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : 'Approve'}
                    </Button>
                    <Tooltip title="Reject task">
                      <Button size="small" variant="outlined" color="error" onClick={() => rejectMutation.mutate(task.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        sx={{ borderRadius: 2, fontWeight: 600 }}>
                        Reject
                      </Button>
                    </Tooltip>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </AnimatedPage>
      )}

      {/* All Tasks List */}
      <AnimatedPage delay={0.2}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>All Tasks ({tasks.length})</Typography>
            <Stack spacing={1.5}>
              {tasks.map((task, i) => (
                <AnimatedPage key={task.id} delay={0.25 + i * 0.05}>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 2,
                    border: '1px solid', borderColor: task.status === 'APPROVED' ? '#E8F5E9' : '#E8EDF2',
                    bgcolor: task.status === 'APPROVED' ? '#FAFFF5' : '#fff',
                    transition: 'all 0.2s ease', '&:hover': { borderColor: 'primary.light' },
                  }}>
                    <Box sx={{ color: task.status === 'APPROVED' ? 'success.main' : 'text.disabled' }}>
                      {task.status === 'APPROVED'
                        ? <CheckCircleIcon sx={{ fontSize: 26 }} />
                        : <RadioButtonUncheckedIcon sx={{ fontSize: 26 }} />}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={task.status === 'APPROVED' ? 400 : 600}
                        sx={{ textDecoration: task.status === 'APPROVED' ? 'line-through' : 'none', color: task.status === 'APPROVED' ? 'text.secondary' : 'text.primary' }}>
                        {task.title}
                      </Typography>
                      {task.description && (
                        <Typography variant="caption" color="text.secondary">{task.description}</Typography>
                      )}
                    </Box>
                    <Chip size="small" label={`+${task.rewardPoints || 0} pts`}
                      sx={{ fontWeight: 700, fontSize: 12, bgcolor: task.status === 'APPROVED' ? 'success.light' : 'warning.light', color: task.status === 'APPROVED' ? 'success.dark' : 'warning.dark' }} />
                    <Chip size="small" label={statusLabel(task.status)} color={statusColor(task.status)}
                      sx={{ fontSize: 11, fontWeight: 600, minWidth: 90 }} />
                  </Box>
                </AnimatedPage>
              ))}
              {tasks.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                  <EmojiEventsIcon sx={{ fontSize: 48, color: '#E0E0E0', mb: 1 }} />
                  <Typography color="text.secondary" fontWeight={600}>No tasks yet</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Click "Assign Task" to create the first task for your child.</Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Create Task Dialog */}
      <Dialog open={createOpen} onClose={() => { setCreateOpen(false); setCreateError(''); }} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>Assign New Task</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Stack spacing={2}>
            <TextField
              label="Task Title *" fullWidth value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Clean your room, Finish homework"
              InputProps={{ sx: { borderRadius: 2 } }}
            />
            <TextField
              label="Description (optional)" fullWidth multiline rows={2} value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="More details about the task..."
              InputProps={{ sx: { borderRadius: 2 } }}
            />
            <TextField
              label="Reward Points *" fullWidth type="number" value={points}
              onChange={e => setPoints(e.target.value)}
              inputProps={{ min: 1 }}
              helperText="Points awarded when you approve the completed task"
              InputProps={{ sx: { borderRadius: 2 } }}
            />
            {createError && <Typography color="error" variant="body2">{createError}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => { setCreateOpen(false); setCreateError(''); }} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={createMutation.isPending}
            sx={{ borderRadius: 2, bgcolor: 'warning.main', '&:hover': { filter: 'brightness(0.9)' }, fontWeight: 700, px: 3 }}>
            {createMutation.isPending ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Assign Task'}
          </Button>
        </DialogActions>
      </Dialog>
    </AnimatedPage>
  );
}
