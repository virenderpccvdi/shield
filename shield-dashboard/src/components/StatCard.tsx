import { Box, Card, CardContent, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  gradient?: string; // CSS linear-gradient
  trend?: number; // percentage change, positive = up
  delay?: number; // animation delay in seconds
}

export default function StatCard({ title, value, unit, icon, gradient, trend, delay = 0 }: StatCardProps) {
  const isGradient = !!gradient;
  return (
    <Card sx={{
      '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      animation: `fadeInUp 0.5s ease ${delay}s both`,
      background: gradient || '#fff',
      color: isGradient ? '#fff' : 'inherit',
      border: isGradient ? 'none' : undefined,
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' },
    }}>
      {isGradient && (
        <Box sx={{
          position: 'absolute', top: -20, right: -20,
          width: 100, height: 100, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
        }} />
      )}
      <CardContent sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="body2" sx={{ opacity: isGradient ? 0.85 : 0.6, fontWeight: 500, fontSize: 13 }}>{title}</Typography>
          <Box sx={{ opacity: isGradient ? 0.7 : 0.4 }}>{icon}</Box>
        </Box>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 0.5 }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && <Typography component="span" variant="body1" sx={{ opacity: 0.7, ml: 0.5 }}>{unit}</Typography>}
        </Typography>
        {trend !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            {trend >= 0 ? (
              <TrendingUpIcon sx={{ fontSize: 16, color: isGradient ? 'rgba(255,255,255,0.9)' : '#43A047' }} />
            ) : (
              <TrendingDownIcon sx={{ fontSize: 16, color: isGradient ? 'rgba(255,255,255,0.9)' : '#E53935' }} />
            )}
            <Typography variant="caption" sx={{ fontWeight: 600, color: isGradient ? 'rgba(255,255,255,0.9)' : (trend >= 0 ? '#43A047' : '#E53935') }}>
              {Math.abs(trend).toFixed(1)}%
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>vs last week</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
