import { Box, Card, CardContent, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import type { ReactNode } from 'react';
import SparklineChart from './SparklineChart';

// ── Design System tokens ──────────────────────────────────────────────────────
const DS = {
  primary:           '#005DAC',
  surface:           '#F7F9FB',
  surfaceContainerLowest: '#FFFFFF',
  onSurface:         '#0F1F3D',
  onSurfaceVariant:  '#4A6481',
  success:           '#2E7D32',
  successContainer:  '#E8F5E9',
  warning:           '#E65100',
  warningContainer:  '#FFF3E0',
  danger:            '#C62828',
  dangerContainer:   '#FFEBEE',
  info:              '#0277BD',
  infoContainer:     '#E1F5FE',
  guardianShadow:    '0 8px 32px -4px rgba(15,31,61,0.06)',
} as const;

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  gradient?: string;          // kept for backward compat — ignored in new design
  trend?: number;             // percentage change, positive = up
  delay?: number;
  sparklineData?: number[];
  accentColor?: string;       // semantic color for the left indicator stripe
}

/** Maps accentColor to the right tonal container for the icon badge */
function resolveIconBg(accent: string): string {
  if (accent === DS.success) return DS.successContainer;
  if (accent === DS.warning) return DS.warningContainer;
  if (accent === DS.danger)  return DS.dangerContainer;
  if (accent === DS.info)    return DS.infoContainer;
  // primary or custom
  return '#E3F2FD';
}

export default function StatCard({
  title, value, unit, icon, trend, delay = 0, sparklineData, accentColor,
}: StatCardProps) {
  const accent = accentColor ?? DS.primary;
  const iconBg = resolveIconBg(accent);

  return (
    <Card sx={{
      bgcolor: DS.surfaceContainerLowest,
      border: 'none',
      boxShadow: DS.guardianShadow,
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative',
      '@keyframes fadeInUp': {
        from: { opacity: 0, transform: 'translateY(20px)' },
        to:   { opacity: 1, transform: 'translateY(0)' },
      },
      animation: `fadeInUp 0.45s ease ${delay}s both`,
      transition: 'transform 0.22s ease, box-shadow 0.22s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: `0 12px 32px -4px rgba(15,31,61,0.10)`,
      },
      // Left indicator stripe — the sole structural accent
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0, left: 0, bottom: 0,
        width: 3,
        background: accent,
        borderRadius: '12px 0 0 12px',
      },
    }}>
      <CardContent sx={{ pl: '20px', pr: '20px', pt: '18px', pb: '18px !important' }}>
        {/* Header row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography sx={{
            fontFamily: '"Inter", sans-serif',
            fontWeight: 500,
            fontSize: 12.5,
            color: DS.onSurfaceVariant,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}>
            {title}
          </Typography>
          <Box sx={{
            width: 36, height: 36, borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: iconBg,
            color: accent,
            flexShrink: 0,
            '& svg': { fontSize: 19 },
          }}>
            {icon}
          </Box>
        </Box>

        {/* Value */}
        <Typography sx={{
          fontFamily: '"Manrope", sans-serif',
          fontSize: '1.75rem',
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
          color: DS.primary,
          mb: 0.5,
        }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && (
            <Typography component="span" sx={{
              fontFamily: '"Inter", sans-serif',
              fontSize: '1rem',
              fontWeight: 500,
              opacity: 0.65,
              ml: 0.5,
              letterSpacing: 0,
              color: DS.onSurfaceVariant,
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
              bgcolor: trend >= 0
                ? 'rgba(46,125,50,0.09)'
                : 'rgba(198,40,40,0.09)',
            }}>
              {trend >= 0 ? (
                <TrendingUpIcon sx={{ fontSize: 13, color: DS.success }} />
              ) : (
                <TrendingDownIcon sx={{ fontSize: 13, color: DS.danger }} />
              )}
              <Typography sx={{
                fontFamily: '"Inter", sans-serif',
                fontSize: 11.5,
                fontWeight: 700,
                color: trend >= 0 ? DS.success : DS.danger,
                lineHeight: 1,
              }}>
                {Math.abs(trend).toFixed(1)}%
              </Typography>
            </Box>
            <Typography sx={{
              fontFamily: '"Inter", sans-serif',
              fontSize: 11.5,
              color: DS.onSurfaceVariant,
            }}>
              vs last week
            </Typography>
          </Box>
        )}

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <Box sx={{ mt: 1.25 }}>
            <SparklineChart data={sparklineData} color={accent} height={40} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
