import { Box, type SxProps } from '@mui/material';
import { type ReactNode } from 'react';

export default function AnimatedPage({ children, sx, delay = 0 }: { children: ReactNode; sx?: SxProps; delay?: number }) {
  return (
    <Box sx={{
      '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      animation: `fadeInUp 0.5s ease ${delay}s both`,
      ...sx,
    }}>
      {children}
    </Box>
  );
}
