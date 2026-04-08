import { Box, Card, CardContent, Tooltip, Typography, Stack } from '@mui/material';

interface ActivityHeatmapProps {
  data: Array<{ date: string; totalQueries: number; totalBlocks: number }>;
  title?: string;
}

const TIME_BLOCKS = ['0-3', '4-7', '8-11', '12-15', '16-19', '20-23'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Weights per time block index (must sum to 1.0)
const TIME_WEIGHTS = [0.05, 0.10, 0.25, 0.25, 0.20, 0.15];

// Returns ISO day-of-week: 0=Mon … 6=Sun
function dayIndex(dateStr: string): number {
  const d = new Date(dateStr);
  return (d.getDay() + 6) % 7; // convert Sun=0 → Mon=0
}

export default function ActivityHeatmap({ data, title = 'Activity Heatmap' }: ActivityHeatmapProps) {
  // Build a [dayIndex][timeBlockIndex] => count matrix
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(6).fill(0));

  for (const entry of data) {
    const di = dayIndex(entry.date);
    for (let ti = 0; ti < 6; ti++) {
      matrix[di][ti] += entry.totalQueries * TIME_WEIGHTS[ti];
    }
  }

  const allValues = matrix.flat();
  const maxCount = Math.max(...allValues, 1);

  function cellIntensity(count: number): number {
    if (count === 0) return 0;
    return 0.05 + (count / maxCount) * 0.95;
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={700} mb={2}>{title}</Typography>

        {/* Time block header */}
        <Stack direction="row" spacing={0} sx={{ mb: 0.5 }}>
          {/* spacer for day labels */}
          <Box sx={{ width: 36, flexShrink: 0 }} />
          {TIME_BLOCKS.map((tb) => (
            <Box
              key={tb}
              sx={{ flex: 1, textAlign: 'center' }}
            >
              <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                {tb}h
              </Typography>
            </Box>
          ))}
        </Stack>

        {/* Grid rows */}
        {DAY_LABELS.map((day, di) => (
          <Stack key={day} direction="row" spacing={0} sx={{ mb: 0.5 }}>
            {/* Day label */}
            <Box sx={{ width: 36, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>
                {day}
              </Typography>
            </Box>
            {TIME_BLOCKS.map((tb, ti) => {
              const count = Math.round(matrix[di][ti]);
              const intensity = cellIntensity(matrix[di][ti]);
              return (
                <Tooltip
                  key={tb}
                  title={
                    <Box>
                      <Typography variant="caption" display="block" fontWeight={700}>
                        {day}, {tb}h
                      </Typography>
                      <Typography variant="caption" display="block">
                        ~{count} queries
                      </Typography>
                    </Box>
                  }
                  arrow
                >
                  <Box
                    sx={{
                      flex: 1,
                      height: 24,
                      mx: 0.25,
                      borderRadius: 0.5,
                      backgroundColor: intensity > 0
                        ? `rgba(21, 101, 192, ${intensity.toFixed(2)})`
                        : 'rgba(0,0,0,0.05)',
                      cursor: 'default',
                      transition: 'background-color 0.2s ease',
                      '&:hover': {
                        outline: '2px solid rgba(21,101,192,0.6)',
                      },
                    }}
                  />
                </Tooltip>
              );
            })}
          </Stack>
        ))}

        {/* Legend */}
        <Stack direction="row" spacing={1} alignItems="center" mt={2}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>Low</Typography>
          <Box
            sx={{
              flex: 1,
              maxWidth: 120,
              height: 10,
              borderRadius: 1,
              background: 'linear-gradient(to right, rgba(21,101,192,0.05), rgba(21,101,192,1))',
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>High</Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
