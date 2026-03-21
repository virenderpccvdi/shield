import { Box, Typography, Card, CardContent, Button, Tooltip, Snackbar, Alert, CircularProgress } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SchoolIcon from '@mui/icons-material/School';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import WeekendIcon from '@mui/icons-material/Weekend';
import SaveIcon from '@mui/icons-material/Save';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import api from '../../api/axios';
import { useState } from 'react';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const presets = [
  { label: 'School Hours', icon: <SchoolIcon sx={{ fontSize: 16 }} />, color: '#1565C0', key: 'SCHOOL_HOURS' },
  { label: 'Bedtime', icon: <BedtimeIcon sx={{ fontSize: 16 }} />, color: '#7B1FA2', key: 'BEDTIME' },
  { label: 'Weekend', icon: <WeekendIcon sx={{ fontSize: 16 }} />, color: '#FB8C00', key: 'WEEKEND' },
];

export default function SchedulePage() {
  const { profileId } = useParams();
  const qc = useQueryClient();
  const [grid, setGrid] = useState<Record<string, number[]>>({});
  const [snack, setSnack] = useState('');
  const [overrideDialog, setOverrideDialog] = useState(false);

  useQuery({
    queryKey: ['schedule-page', profileId],
    queryFn: () => api.get(`/dns/schedules/${profileId}`).then(r => {
      const d = r.data?.data || r.data;
      if (d?.grid) setGrid(d.grid);
      return d;
    }).catch(() => null),
    enabled: !!profileId,
  });

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/dns/schedules/${profileId}`, { grid }),
    onSuccess: () => { setSnack('Schedule saved'); qc.invalidateQueries({ queryKey: ['schedule-page', profileId] }); },
    onError: () => setSnack('Failed to save schedule'),
  });

  const presetMutation = useMutation({
    mutationFn: (presetKey: string) => api.post(`/dns/schedules/${profileId}/preset?preset=${presetKey}`),
    onSuccess: () => { setSnack('Preset applied'); qc.invalidateQueries({ queryKey: ['schedule-page', profileId] }); },
    onError: () => setSnack('Failed to apply preset'),
  });

  const overrideMutation = useMutation({
    mutationFn: (type: string) => api.post(`/dns/schedules/${profileId}/override`, { overrideType: type, durationMinutes: 60 }),
    onSuccess: () => { setSnack('Override applied'); },
    onError: () => setSnack('Failed to apply override'),
  });

  const toggle = (day: string, hour: number) => {
    setGrid(g => ({
      ...g,
      [day]: (g[day] || Array(24).fill(1)).map((v, h) => h === hour ? (v === 1 ? 0 : 1) : v),
    }));
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ScheduleIcon />}
        title="Schedule"
        subtitle="Set internet access times for each day"
        iconColor="#7B1FA2"
        action={
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {presets.map(p => (
              <Button key={p.key} size="small" variant="outlined" startIcon={p.icon}
                disabled={presetMutation.isPending}
                onClick={() => presetMutation.mutate(p.key)}
                sx={{ borderRadius: 2, borderColor: `${p.color}40`, color: p.color, '&:hover': { borderColor: p.color, bgcolor: `${p.color}08` } }}>
                {p.label}
              </Button>
            ))}
            <Button size="small" variant="outlined" startIcon={<PauseCircleIcon />}
              disabled={overrideMutation.isPending}
              onClick={() => overrideMutation.mutate('PAUSE')}
              sx={{ borderRadius: 2, borderColor: '#E5393540', color: '#E53935', '&:hover': { borderColor: '#E53935' } }}>
              Pause Now
            </Button>
          </Box>
        }
      />

      <AnimatedPage delay={0.15}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: '#C8E6C9', border: '1px solid #A5D6A7' }} />
                <Typography variant="caption" color="text.secondary">Allowed</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: '#FFCDD2', border: '1px solid #EF9A9A' }} />
                <Typography variant="caption" color="text.secondary">Blocked</Typography>
              </Box>
            </Box>

            <Box sx={{ overflowX: 'auto' }}>
              <Box sx={{ minWidth: 700 }}>
                <Box sx={{ display: 'flex', mb: 1, ml: '52px' }}>
                  {HOURS.map(h => (
                    <Box key={h} sx={{ width: 28, textAlign: 'center', fontSize: 10, fontWeight: 600, color: (h >= 22 || h < 6) ? '#9E9E9E' : '#546E7A' }}>{h}</Box>
                  ))}
                </Box>
                {DAYS.map((day, d) => (
                  <AnimatedPage key={day} delay={0.2 + d * 0.04}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
                      <Typography sx={{ width: 48, fontSize: 12, fontWeight: 700, color: d >= 5 ? '#FB8C00' : '#546E7A', pr: 1 }}>{day}</Typography>
                      {HOURS.map(h => {
                        const val = grid[day]?.[h] ?? 1;
                        return (
                          <Tooltip key={h} title={`${day} ${h}:00 — ${val === 1 ? 'Allowed' : 'Blocked'}`} arrow>
                            <Box onClick={() => toggle(day, h)} sx={{
                              width: 26, height: 28, borderRadius: '6px', mr: 0.25, cursor: 'pointer',
                              bgcolor: val === 0 ? '#FFCDD2' : '#C8E6C9',
                              border: '1.5px solid', borderColor: val === 0 ? '#EF9A9A' : '#A5D6A7',
                              transition: 'all 0.15s ease',
                              '&:hover': { transform: 'scale(1.15)', zIndex: 1 },
                              '&:active': { transform: 'scale(0.95)' },
                            }} />
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </AnimatedPage>
                ))}
              </Box>
            </Box>

            <AnimatedPage delay={0.6}>
              <Box sx={{ mt: 3 }}>
                <Button variant="contained" startIcon={<SaveIcon />}
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  sx={{ background: 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)', borderRadius: 2, px: 3 }}>
                  {saveMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save Schedule'}
                </Button>
              </Box>
            </AnimatedPage>
          </CardContent>
        </Card>
      </AnimatedPage>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.includes('Failed') ? 'error' : 'success'} onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
