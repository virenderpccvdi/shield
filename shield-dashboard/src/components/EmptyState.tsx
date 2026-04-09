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
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;

  // Render action: if it has label/onClick keys use the shorthand; otherwise render as-is
  const actionNode = action
    ? (typeof action === 'object' && 'label' in (action as object) && 'onClick' in (action as object)
        ? <Button
            variant="contained"
            onClick={(action as { label: string; onClick: () => void }).onClick}
            sx={{ mt: 0.5 }}
          >
            {(action as { label: string; onClick: () => void }).label}
          </Button>
        : action as ReactNode)
    : null;

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      py: 8, px: 3, textAlign: 'center',
      '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      animation: 'fadeIn 0.45s ease both',
    }}>
      {/* Illustration placeholder circle with layered rings */}
      <Box sx={{ position: 'relative', mb: 3 }}>
        {/* Outer ring */}
        <Box sx={{
          position: 'absolute',
          inset: -16,
          borderRadius: '50%',
          border: `1px dashed ${alpha(primary, 0.18)}`,
          pointerEvents: 'none',
        }} />
        {/* Middle ring */}
        <Box sx={{
          position: 'absolute',
          inset: -8,
          borderRadius: '50%',
          border: `1px solid ${alpha(primary, 0.1)}`,
          pointerEvents: 'none',
        }} />
        {/* Icon container */}
        <Box sx={{
          width: 88, height: 88, borderRadius: '50%',
          background: isDark
            ? `radial-gradient(circle at 35% 35%, ${alpha(primary, 0.3)}, ${alpha(primary, 0.1)})`
            : `radial-gradient(circle at 35% 35%, ${alpha(primary, 0.16)}, ${alpha(primary, 0.05)})`,
          border: `1px solid ${alpha(primary, 0.15)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: primary,
          '& svg': { fontSize: 40 },
        }}>
          {icon || <InboxIcon />}
        </Box>
      </Box>

      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.75, color: 'text.primary' }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mb: 2.5, lineHeight: 1.7 }}>
          {description}
        </Typography>
      )}
      {actionNode}
    </Box>
  );
}
