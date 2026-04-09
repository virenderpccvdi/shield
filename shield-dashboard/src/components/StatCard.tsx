import { Box, Card, CardContent, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import type { ReactNode } from 'react';
import SparklineChart from './SparklineChart';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  gradient?: string; // CSS linear-gradient
  trend?: number; // percentage change, positive = up
  delay?: number; // animation delay in seconds
  sparklineData?: number[]; // optional sparkline below the value
  accentColor?: string; // optional accent for top border stripe
}

export default function StatCard({ title, value, unit, icon, gradient, trend, delay = 0, sparklineData, accentColor }: StatCardProps) {
  const isGradient = !!gradient;
  const accent = accentColor ?? '#4F46E5';

  return (
    <Card sx={{
      '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      animation: `fadeInUp 0.45s ease ${delay}s both`,
      // !important needed to override MuiCard.styleOverrides.root backgroundColor:surface
      ...(isGradient ? {
        background: `${gradient} !important`,
        backgroundColor: 'transparent !important',
        border: 'none !important',
        color: '#fff',
      } : {}),
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.22s ease, box-shadow 0.22s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: isGradient
          ? '0 12px 32px rgba(0,0,0,0.22)'
          : `0 8px 24px ${alpha(accent, 0.14)}, 0 4px 8px rgba(0,0,0,0.06)`,
      },
      // Subtle gradient top border strip when not using full gradient
      ...(!isGradient && {
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${accent} 0%, ${alpha(accent, 0.4)} 100%)`,
          borderRadius: '12px 12px 0 0',
        },
      }),
    }}>
      {/* Decorative circle for gradient cards */}
      {isGradient && (
        <>
          <Box sx={{
            position: 'absolute', top: -24, right: -24,
            width: 110, height: 110, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            pointerEvents: 'none',
          }} />
          <Box sx={{
            position: 'absolute', bottom: -20, left: -10,
            width: 70, height: 70, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            pointerEvents: 'none',
          }} />
        </>
      )}

      <CardContent sx={{ position: 'relative', zIndex: 1, pt: isGradient ? 2 : 2.25 }}>
        {/* Header row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
          <Typography sx={{
            opacity: isGradient ? 0.88 : 1,
            fontWeight: 500,
            fontSize: 13,
            color: isGradient ? 'rgba(255,255,255,0.9)' : 'text.secondary',
            letterSpacing: '0.01em',
          }}>
            {title}
          </Typography>
          <Box sx={{
            width: 36, height: 36, borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isGradient
              ? 'rgba(255,255,255,0.18)'
              : alpha(accent, 0.1),
            color: isGradient ? '#fff' : accent,
            flexShrink: 0,
            '& svg': { fontSize: 19 },
          }}>
            {icon}
          </Box>
        </Box>

        {/* Value */}
        <Typography sx={{
          fontSize: '1.75rem',
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
          color: isGradient ? '#fff' : 'text.primary',
          mb: 0.5,
        }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && (
            <Typography component="span" sx={{
              fontSize: '1rem',
              fontWeight: 500,
              opacity: isGradient ? 0.82 : 0.7,
              ml: 0.5,
              letterSpacing: 0,
            }}>
              {unit}
            </Typography>
          )}
        </Typography>

        {/* Trend badge */}
        {trend !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.4,
              px: 0.75, py: 0.2, borderRadius: '6px',
              bgcolor: isGradient
                ? 'rgba(255,255,255,0.18)'
                : (trend >= 0 ? alpha('#10B981', 0.12) : alpha('#EF4444', 0.12)),
            }}>
              {trend >= 0 ? (
                <TrendingUpIcon sx={{ fontSize: 13, color: isGradient ? 'rgba(255,255,255,0.95)' : '#059669' }} />
              ) : (
                <TrendingDownIcon sx={{ fontSize: 13, color: isGradient ? 'rgba(255,255,255,0.95)' : '#DC2626' }} />
              )}
              <Typography sx={{
                fontSize: 11.5,
                fontWeight: 700,
                color: isGradient
                  ? 'rgba(255,255,255,0.95)'
                  : (trend >= 0 ? '#059669' : '#DC2626'),
                lineHeight: 1,
              }}>
                {Math.abs(trend).toFixed(1)}%
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 11.5, opacity: isGradient ? 0.82 : 0.7, color: isGradient ? '#fff' : 'text.secondary' }}>
              vs last week
            </Typography>
          </Box>
        )}

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <Box sx={{ mt: 1.25, opacity: isGradient ? 0.85 : 1 }}>
            <SparklineChart
              data={sparklineData}
              color={isGradient ? 'rgba(255,255,255,0.9)' : accent}
              height={40}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
