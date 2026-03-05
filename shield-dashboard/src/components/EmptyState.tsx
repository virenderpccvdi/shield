import { Box, Typography, Button } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      py: 8, px: 3, textAlign: 'center',
      '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
      animation: 'fadeIn 0.5s ease',
    }}>
      <Box sx={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        mb: 2,
      }}>
        {icon || <InboxIcon sx={{ fontSize: 36, color: '#1565C0' }} />}
      </Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>{title}</Typography>
      {description && <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mb: 2 }}>{description}</Typography>}
      {action && <Button variant="contained" onClick={action.onClick} sx={{ bgcolor: '#1565C0' }}>{action.label}</Button>}
    </Box>
  );
}
