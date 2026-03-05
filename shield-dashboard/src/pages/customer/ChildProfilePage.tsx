import { Box, Typography, Card, CardContent, Tabs, Tab, Chip, Button, Grid, IconButton } from '@mui/material';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import TimelineIcon from '@mui/icons-material/Timeline';
import EditIcon from '@mui/icons-material/Edit';
import MapIcon from '@mui/icons-material/Map';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import { gradients } from '../../theme/theme';

interface ProfileData {
  id: string;
  name: string;
  age?: number;
  filterLevel?: string;
  online: boolean;
  screenTimeToday?: number;
  queriesToday?: number;
  blocksToday?: number;
  activeTasks?: number;
}

const MOCK_PROFILE: ProfileData = {
  id: '1', name: 'Alex', age: 12, filterLevel: 'MODERATE',
  online: true, screenTimeToday: 145, queriesToday: 342, blocksToday: 18, activeTasks: 3,
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const filterColors: Record<string, { bg: string; text: string }> = {
  STRICT: { bg: '#FFEBEE', text: '#C62828' },
  MODERATE: { bg: '#FFF8E1', text: '#F57F17' },
  RELAXED: { bg: '#E8F5E9', text: '#2E7D32' },
  CUSTOM: { bg: '#E3F2FD', text: '#1565C0' },
};

const miniStats = (p: ProfileData) => [
  { label: 'Screen Time', value: `${Math.floor((p.screenTimeToday || 0) / 60)}h ${(p.screenTimeToday || 0) % 60}m`, icon: <AccessTimeIcon />, color: '#1565C0', bg: '#E3F2FD' },
  { label: 'DNS Queries', value: String(p.queriesToday || 0), icon: <DnsIcon />, color: '#7B1FA2', bg: '#F3E5F5' },
  { label: 'Blocked', value: String(p.blocksToday || 0), icon: <BlockIcon />, color: '#E53935', bg: '#FFEBEE' },
  { label: 'Active Tasks', value: String(p.activeTasks || 0), icon: <AssignmentIcon />, color: '#FB8C00', bg: '#FFF3E0' },
];

const quickActions = [
  { label: 'Pause Internet', icon: <PauseCircleIcon />, color: '#E53935', path: '' },
  { label: 'View Activity', icon: <TimelineIcon />, color: '#1565C0', path: '/activity' },
  { label: 'Edit Rules', icon: <EditIcon />, color: '#7B1FA2', path: '/rules' },
  { label: 'View Map', icon: <MapIcon />, color: '#00897B', path: '' },
];

export default function ChildProfilePage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  const { data: profile } = useQuery({
    queryKey: ['child-profile', profileId],
    queryFn: () => api.get(`/profiles/children/${profileId}`).then(r => r.data.data as ProfileData).catch(() => ({ ...MOCK_PROFILE, id: profileId || '1' })),
  });

  const p = profile || MOCK_PROFILE;
  const tabs = ['Overview', 'Activity', 'Rules', 'Schedules', 'Rewards', 'Reports'];
  const filterConf = filterColors[p.filterLevel || 'MODERATE'] || filterColors.MODERATE;

  return (
    <AnimatedPage>
      {/* Back button */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')}
        sx={{ mb: 2, color: 'text.secondary', '&:hover': { bgcolor: '#F8FAFC' } }}>
        Back to Dashboard
      </Button>

      {/* Profile Header Card */}
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 3, overflow: 'hidden' }}>
          {/* Gradient header strip */}
          <Box sx={{ height: 6, background: gradients.blue }} />
          <CardContent sx={{ pt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 1 }}>
              {/* Large avatar with gradient */}
              <Box sx={{
                width: 72, height: 72, borderRadius: '50%',
                background: gradients.blue,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
                boxShadow: '0 4px 14px rgba(21,101,192,0.3)',
              }}>
                <Typography fontWeight={800} fontSize={24} color="white">
                  {getInitials(p.name)}
                </Typography>
                {p.online && (
                  <Box sx={{
                    position: 'absolute', bottom: 2, right: 2,
                    width: 16, height: 16, borderRadius: '50%',
                    bgcolor: '#43A047', border: '3px solid white',
                    '@keyframes pulse': {
                      '0%': { boxShadow: '0 0 0 0 rgba(67,160,71,0.5)' },
                      '70%': { boxShadow: '0 0 0 8px rgba(67,160,71,0)' },
                      '100%': { boxShadow: '0 0 0 0 rgba(67,160,71,0)' },
                    },
                    animation: 'pulse 2s infinite',
                  }} />
                )}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                  <Typography variant="h5" fontWeight={700}>{p.name}</Typography>
                  <Chip
                    size="small"
                    label={p.online ? 'Online' : 'Offline'}
                    color={p.online ? 'success' : 'default'}
                    sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {p.age && <Typography variant="body2" color="text.secondary">Age {p.age}</Typography>}
                  <Chip
                    size="small"
                    label={p.filterLevel || 'MODERATE'}
                    sx={{
                      height: 22, fontSize: 11, fontWeight: 600,
                      bgcolor: filterConf.bg, color: filterConf.text,
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </CardContent>

          {/* Tab navigation */}
          <Tabs
            value={tab}
            onChange={(_, v: number) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderTop: '1px solid #E8EDF2',
              '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 48 },
              '& .Mui-selected': { color: '#1565C0' },
            }}
          >
            {tabs.map((t) => <Tab key={t} label={t} />)}
          </Tabs>
        </Card>
      </AnimatedPage>

      {/* Mini Stat Cards */}
      {tab === 0 && (
        <>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {miniStats(p).map((stat, i) => (
              <Grid size={{ xs: 6, sm: 3 }} key={stat.label}>
                <AnimatedPage delay={0.2 + i * 0.08}>
                  <Card sx={{
                    transition: 'transform 0.2s ease',
                    '&:hover': { transform: 'translateY(-3px)' },
                  }}>
                    <CardContent sx={{ py: 2, px: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box sx={{
                          width: 34, height: 34, borderRadius: '10px',
                          bgcolor: stat.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: stat.color,
                          '& .MuiSvgIcon-root': { fontSize: 18 },
                        }}>
                          {stat.icon}
                        </Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>{stat.label}</Typography>
                      </Box>
                      <Typography variant="h5" fontWeight={700} sx={{ color: stat.color }}>
                        {stat.value}
                      </Typography>
                    </CardContent>
                  </Card>
                </AnimatedPage>
              </Grid>
            ))}
          </Grid>

          {/* Quick Actions */}
          <AnimatedPage delay={0.5}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Quick Actions</Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {quickActions.map((action, i) => (
                    <Button
                      key={action.label}
                      variant="outlined"
                      startIcon={action.icon}
                      onClick={() => action.path && navigate(`/profiles/${profileId}${action.path}`)}
                      sx={{
                        borderColor: `${action.color}30`,
                        color: action.color,
                        px: 2.5, py: 1.2,
                        borderRadius: 2,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: action.color,
                          bgcolor: `${action.color}08`,
                          transform: 'translateY(-2px)',
                          boxShadow: `0 4px 12px ${action.color}20`,
                        },
                        '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                        animation: `fadeInUp 0.3s ease ${0.6 + i * 0.08}s both`,
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </AnimatedPage>
        </>
      )}

      {/* Tab content navigation */}
      {tab === 1 && (
        <AnimatedPage delay={0.1}>
          <Card><CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Button variant="contained" onClick={() => navigate(`/profiles/${profileId}/activity`)}
              sx={{ background: gradients.blue }}>
              View Live Activity
            </Button>
          </CardContent></Card>
        </AnimatedPage>
      )}
      {tab === 2 && (
        <AnimatedPage delay={0.1}>
          <Card><CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Button variant="contained" onClick={() => navigate(`/profiles/${profileId}/rules`)}
              sx={{ background: gradients.purple }}>
              Manage Content Rules
            </Button>
          </CardContent></Card>
        </AnimatedPage>
      )}
      {tab === 3 && (
        <AnimatedPage delay={0.1}>
          <Card><CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Button variant="contained" onClick={() => navigate(`/profiles/${profileId}/schedules`)}
              sx={{ background: gradients.teal }}>
              Edit Schedules
            </Button>
          </CardContent></Card>
        </AnimatedPage>
      )}
      {tab === 4 && (
        <AnimatedPage delay={0.1}>
          <Card><CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Button variant="contained" onClick={() => navigate(`/profiles/${profileId}/rewards`)}
              sx={{ background: gradients.orange }}>
              Manage Rewards
            </Button>
          </CardContent></Card>
        </AnimatedPage>
      )}
      {tab === 5 && (
        <AnimatedPage delay={0.1}>
          <Card><CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Button variant="contained" onClick={() => navigate(`/profiles/${profileId}/reports`)}
              sx={{ background: gradients.green }}>
              View Reports
            </Button>
          </CardContent></Card>
        </AnimatedPage>
      )}
    </AnimatedPage>
  );
}
