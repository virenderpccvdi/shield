import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Grid, Typography, Box, Card, CardContent, Button, Chip, CircularProgress, Alert, Tooltip, Stack } from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PersonIcon from '@mui/icons-material/Person';
import BlockIcon from '@mui/icons-material/Block';
import AddIcon from '@mui/icons-material/Add';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

interface ChildProfile { id: string; name: string; online: boolean; lastSeen?: string; blocksToday: number; currentActivity?: string; paused: boolean; }

const GRADIENT_ACCENTS = ['#1565C0', '#43A047', '#7B1FA2', '#FB8C00', '#E53935', '#00897B'];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function CustomerDashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['children'], queryFn: () => api.get('/profiles/children').then(r => {
    const d = r.data?.data;
    return (d?.content ?? d ?? r.data) as ChildProfile[];
  }).catch(() => []), refetchInterval: 30000 });

  const pauseMutation = useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      paused
        ? api.delete(`/dns/schedules/${id}/override`)
        : api.post(`/dns/schedules/${id}/override`, { action: 'BLOCK_ALL', durationMinutes: 60 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['children'] }),
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error" sx={{ mt: 2 }}>Failed to load dashboard. Check your connection.</Alert>;

  const children = data || [];
  const highBlockChildren = children.filter(c => c.blocksToday > 10);
  const totalBlocks = children.reduce((s, c) => s + c.blocksToday, 0);
  const onlineCount = children.filter(c => c.online).length;

  return (
    <AnimatedPage>
      {/* Alert banner for high block count */}
      {highBlockChildren.length > 0 && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2, borderRadius: 2 }}>
          <strong>{highBlockChildren.map(c => c.name).join(', ')}</strong> {highBlockChildren.length === 1 ? 'has' : 'have'} a high number of blocked requests today. Review their activity.
        </Alert>
      )}

      {/* Quick stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ textAlign: 'center', p: 1.5, border: '1px solid #E3F2FD' }}>
            <Typography variant="h5" fontWeight={800} color="#1565C0">{children.length}</Typography>
            <Typography variant="caption" color="text.secondary">Profiles</Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ textAlign: 'center', p: 1.5, border: '1px solid #E8F5E9' }}>
            <Typography variant="h5" fontWeight={800} color="#2E7D32">{onlineCount}</Typography>
            <Typography variant="caption" color="text.secondary">Online Now</Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ textAlign: 'center', p: 1.5, border: '1px solid #FFF3E0' }}>
            <Typography variant="h5" fontWeight={800} color="#E65100">{totalBlocks}</Typography>
            <Typography variant="caption" color="text.secondary">Blocks Today</Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card sx={{ textAlign: 'center', p: 1.5, border: '1px solid #F3E5F5' }}>
            <Typography variant="h5" fontWeight={800} color="#7B1FA2">{children.filter(c => c.paused).length}</Typography>
            <Typography variant="caption" color="text.secondary">Paused</Typography>
          </Card>
        </Grid>
      </Grid>

      <PageHeader
        icon={<FamilyRestroomIcon />}
        title="Family Dashboard"
        subtitle={`${children.length} child profile${children.length !== 1 ? 's' : ''}`}
        iconColor="#1565C0"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/profiles/new')}
            sx={{ background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)' }}>
            Add Child
          </Button>
        }
      />

      <Grid container spacing={3}>
        {children.map((child, i) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={child.id}>
            <AnimatedPage delay={0.1 + i * 0.08}>
              <Card
                onClick={() => navigate(`/profiles/${child.id}`)}
                sx={{
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  },
                }}
              >
                {/* Gradient accent bar at top */}
                <Box sx={{
                  height: 4,
                  background: `linear-gradient(90deg, ${GRADIENT_ACCENTS[i % GRADIENT_ACCENTS.length]}, ${GRADIENT_ACCENTS[(i + 1) % GRADIENT_ACCENTS.length]})`,
                }} />
                <CardContent sx={{ pt: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: `linear-gradient(135deg, ${GRADIENT_ACCENTS[i % GRADIENT_ACCENTS.length]}20, ${GRADIENT_ACCENTS[i % GRADIENT_ACCENTS.length]}40)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative',
                        border: `2px solid ${GRADIENT_ACCENTS[i % GRADIENT_ACCENTS.length]}30`,
                      }}>
                        <Typography fontWeight={700} fontSize={16} sx={{ color: GRADIENT_ACCENTS[i % GRADIENT_ACCENTS.length] }}>
                          {getInitials(child.name)}
                        </Typography>
                        {child.online && (
                          <Box sx={{
                            position: 'absolute', bottom: 0, right: 0,
                            width: 14, height: 14, borderRadius: '50%',
                            bgcolor: '#43A047', border: '2.5px solid white',
                            '@keyframes pulse': {
                              '0%': { boxShadow: '0 0 0 0 rgba(67,160,71,0.5)' },
                              '70%': { boxShadow: '0 0 0 6px rgba(67,160,71,0)' },
                              '100%': { boxShadow: '0 0 0 0 rgba(67,160,71,0)' },
                            },
                            animation: 'pulse 2s infinite',
                          }} />
                        )}
                      </Box>
                      <Box>
                        <Typography fontWeight={700} variant="subtitle1">{child.name}</Typography>
                        <Chip
                          size="small"
                          label={child.online ? 'Online' : (child.lastSeen || 'Offline')}
                          color={child.online ? 'success' : 'default'}
                          sx={{ height: 20, fontSize: 11, fontWeight: 500 }}
                        />
                      </Box>
                    </Box>
                    <Tooltip title={child.paused ? 'Resume internet' : 'Pause internet'}>
                      <Button size="small" variant={child.paused ? 'contained' : 'outlined'} color={child.paused ? 'success' : 'warning'}
                        startIcon={child.paused ? <PlayArrowIcon /> : <PauseIcon />}
                        onClick={(e) => { e.stopPropagation(); pauseMutation.mutate({ id: child.id, paused: child.paused }); }}
                        sx={{ minWidth: 90, borderRadius: 2 }}>
                        {child.paused ? 'Resume' : 'Pause'}
                      </Button>
                    </Tooltip>
                  </Box>
                  {child.currentActivity && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, px: 1, py: 0.5, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                      Active: {child.currentActivity}
                    </Typography>
                  )}
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    p: 1, borderRadius: 1.5,
                    bgcolor: child.blocksToday > 0 ? '#FFF3F0' : '#F6FFF6',
                  }}>
                    <BlockIcon sx={{ fontSize: 15, color: child.blocksToday > 0 ? 'error.main' : 'text.disabled' }} />
                    <Typography variant="body2" color={child.blocksToday > 0 ? 'error.main' : 'text.secondary'} fontSize={13} fontWeight={500}>
                      {child.blocksToday} block{child.blocksToday !== 1 ? 's' : ''} today
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>
        ))}

        {/* Add Child Card */}
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <AnimatedPage delay={0.1 + children.length * 0.08}>
            <Card
              onClick={() => navigate('/profiles/new')}
              sx={{
                border: '2px dashed #CBD5E1',
                bgcolor: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: '#1565C0',
                  bgcolor: '#F5F9FF',
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 30px rgba(21,101,192,0.1)',
                },
              }}
            >
              <CardContent sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: 200, color: 'text.secondary', gap: 1.5,
              }}>
                <Box sx={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform 0.3s ease',
                  '.MuiCard-root:hover &': { transform: 'scale(1.1)' },
                }}>
                  <AddIcon sx={{ fontSize: 28, color: '#1565C0' }} />
                </Box>
                <Typography fontWeight={600} color="primary" fontSize={15}>Add Child Profile</Typography>
                <Typography variant="body2" textAlign="center" color="text.secondary">
                  Set up rules, schedules, and time limits
                </Typography>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>
      </Grid>
    </AnimatedPage>
  );
}
