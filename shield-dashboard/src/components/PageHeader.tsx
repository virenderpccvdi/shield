import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  iconColor?: string;
}

export default function PageHeader({ icon, title, subtitle, action, iconColor = '#1565C0' }: PageHeaderProps) {
  return (
    <Box sx={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
      '@keyframes slideInLeft': { from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
      animation: 'slideInLeft 0.4s ease both',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '12px',
          background: `${iconColor}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor,
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
