import { Box, Typography, Card, CardContent, Button, CircularProgress, LinearProgress, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AddIcon from '@mui/icons-material/Add';
import TimerIcon from '@mui/icons-material/Timer';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import { gradients } from '../../theme/theme';

interface Task { id: string; title: string; completed: boolean; rewardMinutes: number; completedAt?: string; }

export default function RewardsPage() {
  const { profileId } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', profileId],
    queryFn: () => api.get(`/rewards/tasks/${profileId}`).then(r => (r.data.data ?? r.data) as Task[]).catch(() => [] as Task[]),
  });
  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/rewards/tasks/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', profileId] }),
  });

  const tasks = data || [];
  const totalRewards = tasks.filter(t => t.completed).reduce((s, t) => s + t.rewardMinutes, 0);
  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<EmojiEventsIcon />}
        title="Tasks & Rewards"
        subtitle="Complete tasks to earn screen time"
        iconColor="#FB8C00"
      />

      {/* Reward Bank Card */}
      <AnimatedPage delay={0.1}>
        <Card sx={{
          mb: 3, background: gradients.orange,
          color: '#fff', position: 'relative', overflow: 'hidden',
        }}>
          <Box sx={{
            position: 'absolute', top: -30, right: -30,
            width: 120, height: 120, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
          }} />
          <Box sx={{
            position: 'absolute', bottom: -20, right: 40,
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }} />
          <CardContent sx={{ position: 'relative', zIndex: 1, py: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{
                width: 64, height: 64, borderRadius: '16px',
                bgcolor: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TimerIcon sx={{ fontSize: 32 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 0.5 }}>Reward Bank</Typography>
                <Typography variant="h3" fontWeight={800}>
                  {totalRewards}
                  <Typography component="span" variant="h6" sx={{ opacity: 0.8, ml: 1 }}>minutes</Typography>
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>{completedCount}/{tasks.length} tasks</Typography>
                <Box sx={{ mt: 1, width: 100 }}>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                      height: 6, borderRadius: 3,
                      bgcolor: 'rgba(255,255,255,0.2)',
                      '& .MuiLinearProgress-bar': { bgcolor: '#fff', borderRadius: 3 },
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Tasks List */}
      <AnimatedPage delay={0.2}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={600}>Tasks</Typography>
              <Button variant="outlined" size="small" startIcon={<AddIcon />}
                sx={{ borderRadius: 2, borderColor: '#FB8C0040', color: '#FB8C00' }}>
                Add Task
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {tasks.map((task, i) => (
                <AnimatedPage key={task.id} delay={0.25 + i * 0.06}>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    p: 2, borderRadius: 2,
                    border: '1px solid',
                    borderColor: task.completed ? '#E8F5E9' : '#E8EDF2',
                    bgcolor: task.completed ? '#FAFFF5' : '#fff',
                    transition: 'all 0.2s ease',
                    '&:hover': { borderColor: task.completed ? '#A5D6A7' : '#1565C0', transform: 'translateX(4px)' },
                  }}>
                    <Box sx={{
                      color: task.completed ? 'success.main' : 'text.disabled',
                      transition: 'all 0.3s ease',
                      ...(task.completed && {
                        '@keyframes bounceIn': {
                          '0%': { transform: 'scale(0.5)' },
                          '50%': { transform: 'scale(1.2)' },
                          '100%': { transform: 'scale(1)' },
                        },
                        animation: 'bounceIn 0.4s ease',
                      }),
                    }}>
                      {task.completed ? <CheckCircleIcon sx={{ fontSize: 28 }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 28 }} />}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={task.completed ? 400 : 600} sx={{
                        textDecoration: task.completed ? 'line-through' : 'none',
                        color: task.completed ? 'text.secondary' : 'text.primary',
                      }}>
                        {task.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {task.completed ? `Completed` : 'Pending'}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={`+${task.rewardMinutes} min`}
                      sx={{
                        height: 24, fontWeight: 700, fontSize: 12,
                        bgcolor: task.completed ? '#E8F5E9' : '#FFF3E0',
                        color: task.completed ? '#2E7D32' : '#E65100',
                      }}
                    />
                    {!task.completed && (
                      <Button size="small" variant="contained" onClick={() => completeMutation.mutate(task.id)}
                        sx={{ borderRadius: 2, bgcolor: '#43A047', '&:hover': { bgcolor: '#2E7D32' }, minWidth: 80 }}>
                        Done
                      </Button>
                    )}
                  </Box>
                </AnimatedPage>
              ))}
              {tasks.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <EmojiEventsIcon sx={{ fontSize: 48, color: '#E0E0E0', mb: 1 }} />
                  <Typography color="text.secondary">No tasks yet. Add one to get started!</Typography>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      </AnimatedPage>
    </AnimatedPage>
  );
}
