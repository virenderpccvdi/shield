import { Box, Typography, alpha } from '@mui/material';
import { useTheme, type Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  iconColor?: string;
  /** When true, renders a full-width gradient hero banner instead of the compact header */
  hero?: boolean;
}

/** Resolve an MUI palette token like 'primary.main' to a real CSS colour string. */
function resolveColor(color: string, theme: Theme): string {
  const parts = color.split('.');
  if (parts.length >= 2) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let val: any = theme.palette;
    for (const p of parts) { val = val?.[p]; }
    if (typeof val === 'string') return val;
  }
  return color;
}

export default function PageHeader({ icon, title, subtitle, action, iconColor, hero = false }: PageHeaderProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const resolvedColor = resolveColor(iconColor ?? theme.palette.primary.main, theme);

  if (hero) {
    return (
      <Box sx={{
        mx: -3, mt: -3, mb: 3, px: 3, py: 3,
        background: isDark
          ? `linear-gradient(135deg, ${alpha(resolvedColor, 0.25)} 0%, ${alpha(resolvedColor, 0.1)} 100%)`
          : `linear-gradient(135deg, ${alpha(resolvedColor, 0.12)} 0%, ${alpha(resolvedColor, 0.04)} 100%)`,
        borderBottom: `1px solid ${alpha(resolvedColor, 0.15)}`,
        '@keyframes slideInLeft': { from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        animation: 'slideInLeft 0.4s ease both',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 52, height: 52, borderRadius: '14px',
              background: `linear-gradient(135deg, ${resolvedColor} 0%, ${alpha(resolvedColor, 0.7)} 100%)`,
              boxShadow: `0 4px 20px ${alpha(resolvedColor, 0.4)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'primary.contrastText',
            }}>
              {icon}
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2 }}>{title}</Typography>
              {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>}
            </Box>
          </Box>
          {action}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
      '@keyframes slideInLeft': { from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
      animation: 'slideInLeft 0.4s ease both',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '12px',
          background: alpha(resolvedColor, 0.1),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: resolvedColor,
        }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700}>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
        </Box>
      </Box>
      {action}
    </Box>
  );
}
