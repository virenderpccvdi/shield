import { Box, Typography, Breadcrumbs, Link, alpha } from '@mui/material';
import { useTheme, type Theme } from '@mui/material/styles';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import type { ReactNode } from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  iconColor?: string;
  /** When true, renders a full-width gradient hero banner instead of the compact header */
  hero?: boolean;
  /** Optional breadcrumb trail rendered above the title */
  breadcrumbs?: BreadcrumbItem[];
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

export default function PageHeader({ icon, title, subtitle, action, iconColor, hero = false, breadcrumbs }: PageHeaderProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const resolvedColor = resolveColor(iconColor ?? theme.palette.primary.main, theme);

  const breadcrumbNode = breadcrumbs && breadcrumbs.length > 0 && (
    <Breadcrumbs
      separator={<NavigateNextIcon fontSize="inherit" sx={{ fontSize: 13 }} />}
      sx={{ mb: 0.75 }}
      aria-label="breadcrumb"
    >
      {breadcrumbs.map((crumb, i) => {
        const isLast = i === breadcrumbs.length - 1;
        return isLast ? (
          <Typography key={crumb.label} sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}>
            {crumb.label}
          </Typography>
        ) : (
          <Link
            key={crumb.label}
            href={crumb.href ?? '#'}
            underline="hover"
            sx={{ fontSize: 12, fontWeight: 500, color: 'text.disabled' }}
          >
            {crumb.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );

  if (hero) {
    return (
      <Box sx={{
        mx: -3, mt: -3, mb: 3, px: 3, py: 3,
        background: isDark
          ? `linear-gradient(135deg, ${alpha(resolvedColor, 0.22)} 0%, ${alpha(resolvedColor, 0.08)} 100%)`
          : `linear-gradient(135deg, ${alpha(resolvedColor, 0.1)} 0%, ${alpha(resolvedColor, 0.03)} 100%)`,
        borderBottom: `1px solid ${alpha(resolvedColor, 0.12)}`,
        '@keyframes slideInLeft': { from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        animation: 'slideInLeft 0.4s ease both',
      }}>
        {breadcrumbNode}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 52, height: 52, borderRadius: '14px',
              background: `linear-gradient(135deg, ${resolvedColor} 0%, ${alpha(resolvedColor, 0.75)} 100%)`,
              boxShadow: `0 4px 20px ${alpha(resolvedColor, 0.36)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}>
              {icon}
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2 }}>{title}</Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>
          {action}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 3,
      '@keyframes slideInLeft': { from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
      animation: 'slideInLeft 0.4s ease both',
    }}>
      <Box>
        {breadcrumbNode}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: '12px',
            background: isDark ? alpha(resolvedColor, 0.18) : alpha(resolvedColor, 0.1),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: resolvedColor,
            flexShrink: 0,
          }}>
            {icon}
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>{title}</Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.1 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
      {action && (
        <Box sx={{ flexShrink: 0, ml: 2 }}>
          {action}
        </Box>
      )}
    </Box>
  );
}
