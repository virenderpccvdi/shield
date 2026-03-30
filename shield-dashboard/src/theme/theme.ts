import { createTheme, alpha } from '@mui/material/styles';

export function getShieldTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';

  // ── Design tokens ──────────────────────────────────────────────────────────
  const primary   = isDark ? '#3B82F6' : '#1565C0';
  const surface   = isDark ? '#111827' : '#FFFFFF';
  const surfaceAlt = isDark ? '#1E293B' : '#F8FAFC';
  const border    = isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0';
  const textPrim  = isDark ? '#F1F5F9' : '#0F172A';
  const textSec   = isDark ? '#94A3B8' : '#64748B';

  return createTheme({
    palette: {
      mode,
      primary:   { main: primary, light: isDark ? '#60A5FA' : '#1976D2', dark: isDark ? '#2563EB' : '#0D47A1', contrastText: '#fff' },
      secondary: { main: isDark ? '#A78BFA' : '#7C3AED' },
      error:     { main: '#EF4444' },
      warning:   { main: '#F59E0B' },
      success:   { main: '#10B981' },
      info:      { main: '#0EA5E9' },
      background: { default: isDark ? '#0A0F1E' : '#F1F5F9', paper: surface },
      text: { primary: textPrim, secondary: textSec },
      divider: border,
    },

    typography: {
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      fontWeightLight:   300,
      fontWeightRegular: 400,
      fontWeightMedium:  500,
      fontWeightBold:    700,
      h1: { fontSize: '2rem',    fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2 },
      h2: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em' },
      h3: { fontSize: '1.5rem',  fontWeight: 700, letterSpacing: '-0.02em' },
      h4: { fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontSize: '1.1rem',  fontWeight: 600, letterSpacing: '-0.015em' },
      h6: { fontSize: '0.95rem', fontWeight: 600 },
      subtitle1: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle2: { fontWeight: 600, fontSize: '0.82rem', color: textSec },
      body1:     { fontSize: '0.9rem', lineHeight: 1.6 },
      body2:     { fontSize: '0.82rem', lineHeight: 1.55 },
      caption:   { fontSize: '0.75rem', color: textSec },
      overline:  { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const },
      button:    { fontWeight: 600, letterSpacing: '0.01em', textTransform: 'none' as const },
    },

    shape: { borderRadius: 10 },

    shadows: [
      'none',
      isDark ? '0 1px 3px rgba(0,0,0,0.5)' : '0 1px 3px rgba(15,23,42,0.07)',
      isDark ? '0 2px 6px rgba(0,0,0,0.45)' : '0 2px 6px rgba(15,23,42,0.08)',
      isDark ? '0 4px 12px rgba(0,0,0,0.4)'  : '0 4px 12px rgba(15,23,42,0.10)',
      isDark ? '0 6px 16px rgba(0,0,0,0.4)'  : '0 6px 16px rgba(15,23,42,0.11)',
      isDark ? '0 8px 24px rgba(0,0,0,0.38)' : '0 8px 24px rgba(15,23,42,0.12)',
      isDark ? '0 12px 32px rgba(0,0,0,0.35)': '0 12px 32px rgba(15,23,42,0.13)',
      isDark ? '0 16px 40px rgba(0,0,0,0.32)': '0 16px 40px rgba(15,23,42,0.14)',
      isDark ? '0 20px 48px rgba(0,0,0,0.3)' : '0 20px 48px rgba(15,23,42,0.15)',
      ...Array(16).fill('none'),
    ] as any,

    components: {
      // ── Cards ──────────────────────────────────────────────────────────────
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${border}`,
            borderRadius: 14,
            backgroundColor: surface,
            transition: 'box-shadow 0.22s ease, transform 0.22s ease',
            '&:hover': {
              boxShadow: isDark
                ? '0 8px 32px rgba(0,0,0,0.45)'
                : '0 8px 32px rgba(15,23,42,0.12)',
            },
          },
        },
      },
      MuiCardContent: {
        styleOverrides: { root: { padding: '20px', '&:last-child': { paddingBottom: '20px' } } },
      },

      // ── Paper ──────────────────────────────────────────────────────────────
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            border: `1px solid ${border}`,
            backgroundColor: surface,
          }),
          elevation1: {
            boxShadow: isDark
              ? '0 2px 8px rgba(0,0,0,0.4)'
              : '0 2px 8px rgba(15,23,42,0.08)',
          },
        },
      },

      // ── Buttons ────────────────────────────────────────────────────────────
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 9,
            textTransform: 'none' as const,
            fontWeight: 600,
            fontSize: '0.875rem',
            padding: '8px 18px',
            transition: 'all 0.18s ease',
            '&:hover': { transform: 'translateY(-1px)' },
            '&:active': { transform: 'translateY(0)' },
          },
          contained: {
            boxShadow: isDark
              ? `0 4px 14px ${alpha(primary, 0.45)}`
              : `0 4px 14px ${alpha(primary, 0.3)}`,
            '&:hover': {
              boxShadow: isDark
                ? `0 6px 20px ${alpha(primary, 0.55)}`
                : `0 6px 20px ${alpha(primary, 0.4)}`,
            },
          },
          outlined: {
            borderWidth: 1.5,
            '&:hover': { borderWidth: 1.5 },
          },
          sizeSmall: { padding: '5px 12px', fontSize: '0.8rem' },
          sizeLarge: { padding: '11px 24px', fontSize: '0.95rem' },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            transition: 'all 0.15s ease',
            '&:hover': { transform: 'scale(1.08)' },
          },
        },
      },

      // ── Inputs ─────────────────────────────────────────────────────────────
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            fontSize: '0.875rem',
            transition: 'box-shadow 0.18s',
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: 2,
              boxShadow: `0 0 0 3px ${alpha(primary, 0.12)}`,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: primary,
            },
          },
          notchedOutline: { borderColor: border, transition: 'border-color 0.18s' },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { fontSize: '0.875rem', fontWeight: 500 } },
      },
      MuiInputBase: {
        styleOverrides: { input: { fontSize: '0.875rem' } },
      },

      // ── Select ─────────────────────────────────────────────────────────────
      MuiSelect: {
        styleOverrides: { select: { paddingTop: 10, paddingBottom: 10 } },
      },

      // ── AppBar ─────────────────────────────────────────────────────────────
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: surface,
            borderBottom: `1px solid ${border}`,
            color: textPrim,
            backgroundImage: 'none',
          },
        },
      },
      MuiToolbar: {
        styleOverrides: { root: { minHeight: '60px !important', padding: '0 20px !important' } },
      },

      // ── Drawer ─────────────────────────────────────────────────────────────
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isDark ? '#0D1321' : '#FFFFFF',
            borderRight: `1px solid ${border}`,
          },
        },
      },

      // ── Lists ──────────────────────────────────────────────────────────────
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            marginBottom: 2,
            minHeight: 40,
            transition: 'background 0.15s, color 0.15s',
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: { root: { minWidth: 36 } },
      },

      // ── Tables ─────────────────────────────────────────────────────────────
      MuiTableContainer: {
        styleOverrides: {
          root: { borderRadius: 12, border: `1px solid ${border}` },
        },
      },
      MuiTable: {
        styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderBottomColor: border,
            padding: '12px 16px',
            fontSize: '0.85rem',
          }),
          head: {
            backgroundColor: isDark ? '#1A2236' : '#F8FAFC',
            color: textSec,
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '10px 16px',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background 0.13s',
            '&:hover': { backgroundColor: isDark ? alpha(primary, 0.06) : '#F5F9FF' },
            '&:last-child td': { borderBottom: 'none' },
          },
        },
      },
      MuiTableSortLabel: {
        styleOverrides: {
          root: { color: `${textSec} !important`, fontSize: '0.75rem', fontWeight: 700 },
          icon: { fontSize: '14px !important' },
        },
      },

      // ── Chips ──────────────────────────────────────────────────────────────
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 7, fontWeight: 600, fontSize: '0.75rem' },
          sizeSmall: { height: 22, fontSize: '0.7rem' },
        },
      },

      // ── Tooltips ───────────────────────────────────────────────────────────
      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: {
            fontSize: '0.75rem',
            fontWeight: 500,
            backgroundColor: isDark ? '#1E293B' : '#0F172A',
            borderRadius: 7,
            padding: '6px 10px',
          },
          arrow: { color: isDark ? '#1E293B' : '#0F172A' },
        },
      },

      // ── Menu ───────────────────────────────────────────────────────────────
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            border: `1px solid ${border}`,
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.5)'
              : '0 8px 32px rgba(15,23,42,0.15)',
            minWidth: 180,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: '2px 6px',
            fontSize: '0.875rem',
            fontWeight: 500,
            padding: '8px 12px',
            transition: 'background 0.13s',
          },
        },
      },

      // ── Dialog ─────────────────────────────────────────────────────────────
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            border: `1px solid ${border}`,
            boxShadow: isDark
              ? '0 24px 64px rgba(0,0,0,0.6)'
              : '0 24px 64px rgba(15,23,42,0.2)',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontSize: '1rem', fontWeight: 700, padding: '20px 24px 12px' },
        },
      },
      MuiDialogContent: {
        styleOverrides: { root: { padding: '0 24px 16px' } },
      },
      MuiDialogActions: {
        styleOverrides: { root: { padding: '12px 24px 20px', gap: 8 } },
      },

      // ── Tabs ───────────────────────────────────────────────────────────────
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            minHeight: 44,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { height: 2.5, borderRadius: 2 },
        },
      },

      // ── Badges ─────────────────────────────────────────────────────────────
      MuiBadge: {
        styleOverrides: {
          badge: { fontSize: '0.65rem', fontWeight: 700, minWidth: 18, height: 18, padding: '0 4px' },
        },
      },

      // ── Alerts ─────────────────────────────────────────────────────────────
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10, fontWeight: 500, fontSize: '0.875rem' },
        },
      },

      // ── Pagination ─────────────────────────────────────────────────────────
      MuiPaginationItem: {
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 600, fontSize: '0.82rem' },
        },
      },

      // ── Avatar ─────────────────────────────────────────────────────────────
      MuiAvatar: {
        styleOverrides: {
          root: { fontWeight: 700 },
        },
      },

      // ── Skeleton ───────────────────────────────────────────────────────────
      MuiSkeleton: {
        styleOverrides: {
          root: { borderRadius: 8 },
          rectangular: { borderRadius: 10 },
        },
      },

      // ── Switch ─────────────────────────────────────────────────────────────
      MuiSwitch: {
        styleOverrides: {
          root: { padding: 8 },
          track: { borderRadius: 10 },
          thumb: { boxShadow: '0 2px 4px rgba(0,0,0,0.2)' },
        },
      },

      // ── Linear progress ────────────────────────────────────────────────────
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 4, height: 6 },
          bar: { borderRadius: 4 },
        },
      },

      // ── Snackbar ───────────────────────────────────────────────────────────
      MuiSnackbar: {
        defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'right' } },
      },
    },
  });
}

export const lightTheme = getShieldTheme('light');
export const darkTheme  = getShieldTheme('dark');
export const shieldTheme = lightTheme;

// ── Design tokens (accessible to non-MUI code) ────────────────────────────
export const gradients = {
  blue:   'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
  indigo: 'linear-gradient(135deg, #3730A3 0%, #1E1B4B 100%)',
  green:  'linear-gradient(135deg, #059669 0%, #065F46 100%)',
  teal:   'linear-gradient(135deg, #0D9488 0%, #134E4A 100%)',
  orange: 'linear-gradient(135deg, #EA580C 0%, #9A3412 100%)',
  red:    'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
  purple: 'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)',
  pink:   'linear-gradient(135deg, #DB2777 0%, #831843 100%)',
  dark:   'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
  hero:   'linear-gradient(135deg, #0D1B4B 0%, #1565C0 50%, #0288D1 100%)',
} as const;

export const shadows = {
  xs:  '0 1px 3px rgba(15,23,42,0.07)',
  sm:  '0 2px 8px rgba(15,23,42,0.09)',
  md:  '0 4px 16px rgba(15,23,42,0.11)',
  lg:  '0 8px 32px rgba(15,23,42,0.13)',
  xl:  '0 16px 48px rgba(15,23,42,0.16)',
  colored: (color: string) => `0 6px 24px ${color}40`,
} as const;

export const animations = {
  fadeInUp: '@keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }',
  fadeIn:   '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }',
  pulse:    '@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }',
  shimmer:  '@keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }',
} as const;
