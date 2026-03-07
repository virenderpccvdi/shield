import { Box, Typography } from '@mui/material';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

interface Props {
  used: number;
  total: number;
  label: string;
}

export default function UsageRingChart({ used, total, label }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color = pct >= 90 ? '#E53935' : pct >= 70 ? '#FB8C00' : '#43A047';
  const data = [{ value: pct }];

  return (
    <Box sx={{ position: 'relative', width: 140, height: 140 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background dataKey="value" cornerRadius={6} fill={color} angleAxisId={0} />
        </RadialBarChart>
      </ResponsiveContainer>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" fontWeight={700} sx={{ color, lineHeight: 1 }}>{pct}%</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontSize: 11 }}>{label}</Typography>
      </Box>
    </Box>
  );
}
