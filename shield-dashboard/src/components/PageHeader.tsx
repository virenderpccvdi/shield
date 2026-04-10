import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import type { ReactNode } from 'react';

// ── Design System tokens ──────────────────────────────────────────────────────
const DS = {
  primary:           '#005DAC',
  onSurface:         '#0F1F3D',
  onSurfaceVariant:  '#4A6481',
  outlineVariant:    '#C4D0DC',
  surface:           '#F7F9FB',
} as const;

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  iconColor?: string;
  /** When true, renders a full-width hero banner (kept for backward compat) */
  hero?: boolean;
  /** Optional breadcrumb trail rendered above the title */
  breadcrumbs?: BreadcrumbItem[];
}

export default function PageHeader({
  icon, title, subtitle, action, iconColor, hero = false, breadcrumbs,
}: PageHeaderProps) {
  const accentColor = iconColor
    ? iconColor.startsWith('#') ? iconColor : DS.primary
    : DS.primary;

  const breadcrumbNode = breadcrumbs && breadcrumbs.length > 0 && (
    <Breadcrumbs
      separator={<NavigateNextIcon fontSize="inherit" sx={{ fontSize: 12 }} />}
      sx={{ mb: 0.5 }}
      aria-label="breadcrumb"
    >
      {breadcrumbs.map((crumb, i) => {
        const isLast = i === breadcrumbs.length - 1;
        return isLast ? (
          <Typography key={crumb.label} sx={{
            fontFamily: '"Inter", sans-serif',
            fontSize: 12, fontWeight: 500, color: DS.onSurfaceVariant,
          }}>
            {crumb.label}
          </Typography>
        ) : (
          <Link key={crumb.label} href={crumb.href ?? '#'} underline="hover"
            sx={{ fontFamily: '"Inter", sans-serif', fontSize: 12, fontWeight: 500, color: DS.onSurfaceVariant, opacity: 0.7 }}>
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
        background: `linear-gradient(135deg, rgba(0,93,172,0.07) 0%, rgba(0,93,172,0.02) 100%)`,
        // One allowed structural line — header divider
        borderBottom: `1px solid ${DS.outlineVariant}`,
        '@keyframes slideInLeft': {
          from: { opacity: 0, transform: 'translateX(-20px)' },
          to:   { opacity: 1, transform: 'translateX(0)' },
        },
        animation: 'slideInLeft 0.4s ease both',
      }}>
        {breadcrumbNode}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {icon && (
              <Box sx={{
                width: 48, height: 48, borderRadius: '14px',
                bgcolor: `${accentColor}14`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: accentColor,
                flexShrink: 0,
              }}>
                {icon}
              </Box>
            )}
            <Box>
              <Typography sx={{
                fontFamily: '"Manrope", sans-serif',
                fontSize: '1.5rem',
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: '-0.03em',
                color: DS.onSurface,
              }}>
                {title}
              </Typography>
              {subtitle && (
                <Typography sx={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: 13,
                  color: DS.onSurfaceVariant,
                  mt: 0.25,
                }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>
          {action && <Box sx={{ flexShrink: 0, ml: 2 }}>{action}</Box>}
        </Box>
      </Box>
    );
  }

  // ── Default: asymmetric editorial header ─────────────────────────────────────
  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      mb: 3,
      pb: 2,
      // One allowed structural line — the page header divider
      borderBottom: `1px solid ${DS.outlineVariant}`,
      '@keyframes slideInLeft': {
        from: { opacity: 0, transform: 'translateX(-20px)' },
        to:   { opacity: 1, transform: 'translateX(0)' },
      },
      animation: 'slideInLeft 0.4s ease both',
    }}>
      {/* Left: breadcrumbs + title */}
      <Box>
        {breadcrumbNode}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {icon && (
            <Box sx={{
              width: 40, height: 40, borderRadius: '12px',
              bgcolor: `${accentColor}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: accentColor,
              flexShrink: 0,
            }}>
              {icon}
            </Box>
          )}
          <Box>
            <Typography sx={{
              fontFamily: '"Manrope", sans-serif',
              fontSize: '1.5rem',
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: '-0.03em',
              color: DS.onSurface,
            }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography sx={{
                fontFamily: '"Inter", sans-serif',
                fontSize: 13,
                color: DS.onSurfaceVariant,
                mt: 0.1,
              }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* Right: action slot */}
      {action && (
        <Box sx={{ flexShrink: 0, ml: 2 }}>
          {action}
        </Box>
      )}
    </Box>
  );
}
