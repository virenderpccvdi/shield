import { Box, Typography, Button } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import InboxIcon from '@mui/icons-material/Inbox';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Pass either a { label, onClick } shorthand OR a full ReactNode for a custom button */
  action?: { label: string; onClick: () => void } | ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const theme = useTheme();

  // Render action: if it has label/onClick keys use the shorthand; otherwise render as-is
  const actionNode = action
    ? (typeof action === 'object' && 'label' in (action as object) && 'onClick' in (action as object)
        ? <Button variant="contained" onClick={(action as { label: string; onClick: () => void }).onClick}>
            {(action as { label: string; onClick: () => void }).label}
          </Button>
        : action as ReactNode)
    : null;

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      py: 8, px: 3, textAlign: 'center',
      '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
      animation: 'fadeIn 0.5s ease',
    }}>
      <Box sx={{
        width: 80, height: 80, borderRadius: '50%',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.primary.main, 0.2)})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        mb: 2,
      }}>
        {icon || <InboxIcon sx={{ fontSize: 36, color: 'primary.main' }} />}
      </Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>{title}</Typography>
      {description && <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mb: 2 }}>{description}</Typography>}
      {actionNode}
    </Box>
  );
}
