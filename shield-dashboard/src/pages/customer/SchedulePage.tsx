import { Box, Typography, Card, CardContent, Button, Tooltip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SchoolIcon from '@mui/icons-material/School';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import WeekendIcon from '@mui/icons-material/Weekend';
import SaveIcon from '@mui/icons-material/Save';
import api from '../../api/axios';
import { useState } from 'react';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const presets = [
  { label: 'School Hours', icon: <SchoolIcon sx={{ fontSize: 16 }} />, color: '#1565C0' },
  { label: 'Bedtime', icon: <BedtimeIcon sx={{ fontSize: 16 }} />, color: '#7B1FA2' },
  { label: 'Weekend', icon: <WeekendIcon sx={{ fontSize: 16 }} />, color: '#FB8C00' },
];

export default function SchedulePage() {
  const { profileId } = useParams();
  const [grid, setGrid] = useState<boolean[][]>(() => Array.from({ length: 7 }, () => Array(24).fill(false)));

  useQuery({
    queryKey: ['schedule', profileId],
    queryFn: async () => {
      const r = await api.get(`/dns/schedules/${profileId}`);
      if (r.data.data) setGrid(r.data.data);
      return r.data.data;
    },
    retry: false,
  });

  const toggle = (day: number, hour: number) => {
    setGrid((g) => g.map((row, d) => d === day ? row.map((v, h) => h === hour ? !v : v) : row));
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ScheduleIcon />}
        title="Schedule"
        subtitle="Set internet access times for each day"
        iconColor="#7B1FA2"
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {presets.map(p => (
              <Button key={p.label} size="small" variant="outlined" startIcon={p.icon}
                sx={{
                  borderRadius: 2, borderColor: `${p.color}40`, color: p.color,
                  '&:hover': { borderColor: p.color, bgcolor: `${p.color}08` },
                }}>
                {p.label}
              </Button>
            ))}
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
                {/* Hour headers */}
                <Box sx={{ display: 'flex', mb: 1, ml: '52px' }}>
                  {HOURS.map(h => (
                    <Box key={h} sx={{
                      width: 28, textAlign: 'center', fontSize: 10, fontWeight: 600,
                      color: (h >= 22 || h < 6) ? '#9E9E9E' : '#546E7A',
                    }}>
                      {h}
                    </Box>
                  ))}
                </Box>

                {/* Grid rows */}
                {DAYS.map((day, d) => (
                  <AnimatedPage key={day} delay={0.2 + d * 0.04}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
                      <Typography sx={{
                        width: 48, fontSize: 12, fontWeight: 700,
                        color: (d >= 5) ? '#FB8C00' : '#546E7A',
                        pr: 1,
                      }}>
                        {day}
                      </Typography>
                      {HOURS.map(h => (
                        <Tooltip key={h} title={`${day} ${h}:00 -- ${grid[d][h] ? 'Blocked' : 'Allowed'}`} arrow>
                          <Box
                            onClick={() => toggle(d, h)}
                            sx={{
                              width: 26, height: 28, borderRadius: '6px', mr: 0.25,
                              cursor: 'pointer',
                              bgcolor: grid[d][h] ? '#FFCDD2' : '#C8E6C9',
                              border: '1.5px solid',
                              borderColor: grid[d][h] ? '#EF9A9A' : '#A5D6A7',
                              transition: 'all 0.15s ease',
                              '&:hover': {
                                transform: 'scale(1.15)',
                                boxShadow: grid[d][h]
                                  ? '0 2px 8px rgba(229,57,53,0.3)'
                                  : '0 2px 8px rgba(67,160,71,0.3)',
                                zIndex: 1,
                              },
                              '&:active': { transform: 'scale(0.95)' },
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  </AnimatedPage>
                ))}
              </Box>
            </Box>

            <AnimatedPage delay={0.6}>
              <Box sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() => api.put(`/dns/schedules/${profileId}`, { schedule: grid })}
                  sx={{
                    background: 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)',
                    borderRadius: 2, px: 3,
                  }}
                >
                  Save Schedule
                </Button>
              </Box>
            </AnimatedPage>
          </CardContent>
        </Card>
      </AnimatedPage>
    </AnimatedPage>
  );
}
