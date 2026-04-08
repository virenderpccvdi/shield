import { createTheme, alpha } from '@mui/material/styles';

export const brand = {
  // Core
  primary:      '#2563EB',
  primaryDark:  '#1E40AF',
  primaryLight: '#3B82F6',
  primaryChip:  '#DBEAFE',
  // Semantic
  accent:   '#0EA5E9',
  success:  '#16A34A',
  warning:  '#D97706',
  danger:   '#DC2626',
  // Surfaces
  bg:       '#F8FAFC',
  card:     '#FFFFFF',
  border:   '#E2E8F0',
  // Text
  text:     '#0F172A',
  muted:    '#64748B',
  subtle:   '#94A3B8',
  // Dark
  bgDark:   '#0F172A',
  cardDark: '#1E293B',
  borderDark:'rgba(255,255,255,0.08)',
} as const;

export function getShieldTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  const primary   = brand.primary;
  const surface   = isDark ? brand.cardDark  : brand.card;
  const bg        = isDark ? brand.bgDark    : brand.bg;
  const border    = isDark ? brand.borderDark: brand.border;
  const textPrim  = isDark ? '#F1F5F9'       : brand.text;
  const textSec   = isDark ? '#94A3B8'       : brand.muted;

  return createTheme({
    palette: {
      mode,
      primary:    { main: primary, light: brand.primaryLight, dark: brand.primaryDark, contrastText: '#fff' },
      secondary:  { main: '#475569' },
      error:      { main: brand.danger },
      warning:    { main: brand.warning },
      success:    { main: brand.success },
      info:       { main: brand.accent },
      background: { default: bg, paper: surface },
      text:       { primary: textPrim, secondary: textSec },
      divider:    border,
    },

    typography: {
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontWeightLight: 300, fontWeightRegular: 400, fontWeightMedium: 500, fontWeightBold: 700,
      h1: { fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2, color: textPrim },
      h2: { fontSize: '1.5rem',   fontWeight: 700, letterSpacing: '-0.025em' },
      h3: { fontSize: '1.25rem',  fontWeight: 700, letterSpacing: '-0.02em' },
      h4: { fontSize: '1.1rem',   fontWeight: 700, letterSpacing: '-0.015em' },
      h5: { fontSize: '0.975rem', fontWeight: 600 },
      h6: { fontSize: '0.875rem', fontWeight: 600 },
      subtitle1: { fontWeight: 600, letterSpacing: '-0.01em', fontSize: '0.9rem' },
      subtitle2: { fontWeight: 600, fontSize: '0.8rem', color: textSec },
      body1: { fontSize: '0.875rem', lineHeight: 1.65, color: textPrim },
      body2: { fontSize: '0.8rem',   lineHeight: 1.6,  color: textSec },
      caption:  { fontSize: '0.72rem', color: textSec },
      overline: { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: brand.subtle },
      button:   { fontWeight: 600, letterSpacing: '0.01em', textTransform: 'none' as const, fontSize: '0.875rem' },
    },

    shape: { borderRadius: 10 },

    shadows: [
      'none',
      '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
      '0 2px 6px rgba(15,23,42,0.07), 0 1px 3px rgba(15,23,42,0.05)',
      '0 4px 12px rgba(37,99,235,0.08), 0 2px 4px rgba(15,23,42,0.04)',
      '0 6px 16px rgba(37,99,235,0.10), 0 2px 6px rgba(15,23,42,0.05)',
      '0 8px 24px rgba(37,99,235,0.12), 0 4px 8px rgba(15,23,42,0.06)',
      '0 12px 32px rgba(37,99,235,0.12), 0 4px 12px rgba(15,23,42,0.06)',
      '0 16px 40px rgba(37,99,235,0.13), 0 6px 16px rgba(15,23,42,0.07)',
      '0 20px 48px rgba(37,99,235,0.14), 0 8px 20px rgba(15,23,42,0.08)',
      ...Array(16).fill('none'),
    ] as any,

    components: {
      MuiCssBaseline: {
        styleOverrides: `
          *, *::before, *::after { box-sizing: border-box; }
          html { scroll-behavior: smooth; }
          body { background: ${bg}; }
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(255,255,255,0.12)' : '#CBD5E1'}; border-radius: 99px; }
          ::-webkit-scrollbar-thumb:hover { background: ${alpha(primary, 0.4)}; }
          @keyframes fadeInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
          @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
          @keyframes slideInLeft { from { opacity:0; transform:translateX(-16px); } to { opacity:1; transform:translateX(0); } }
          @keyframes livePulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.35; transform:scale(0.8); } }
          @keyframes shimmer { 0% { background-position:-600px 0; } 100% { background-position:600px 0; } }
          @keyframes gradientShift { 0%,100% { background-position:0% 50%; } 50% { background-position:100% 50%; } }
        `,
      },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${border}`,
            borderRadius: 12,
            backgroundColor: surface,
            transition: 'box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease',
            '&:hover': {
              boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 24px rgba(37,99,235,0.10)',
              borderColor: isDark ? alpha(primary, 0.25) : '#BFDBFE',
            },
          },
        },
      },
      MuiCardContent: { styleOverrides: { root: { padding: '20px', '&:last-child': { paddingBottom: '20px' } } } },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none', border: `1px solid ${border}`, backgroundColor: surface },
          elevation1: { boxShadow: '0 2px 8px rgba(15,23,42,0.07)' },
          elevation2: { boxShadow: '0 4px 12px rgba(37,99,235,0.08)' },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8, fontWeight: 600, fontSize: '0.875rem',
            padding: '7px 16px', textTransform: 'none' as const,
            transition: 'all 0.18s ease',
            '&:hover': { transform: 'translateY(-1px)' },
            '&:active': { transform: 'translateY(0)' },
          },
          contained: {
            background: `linear-gradient(135deg, ${brand.primaryLight} 0%, ${primary} 100%)`,
            boxShadow: `0 2px 8px ${alpha(primary, 0.32)}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${primary} 0%, ${brand.primaryDark} 100%)`,
              boxShadow: `0 4px 16px ${alpha(primary, 0.42)}`,
            },
          },
          outlined: {
            borderWidth: '1.5px', borderColor: alpha(primary, 0.45),
            '&:hover': { borderWidth: '1.5px', borderColor: primary, backgroundColor: alpha(primary, 0.04) },
          },
          text: { '&:hover': { backgroundColor: alpha(primary, 0.06) } },
          sizeSmall: { padding: '4px 10px', fontSize: '0.8rem' },
          sizeLarge: { padding: '10px 22px', fontSize: '0.925rem' },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 8, transition: 'all 0.16s ease',
            '&:hover': { backgroundColor: alpha(primary, 0.07), transform: 'scale(1.08)' },
          },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8, fontSize: '0.875rem',
            backgroundColor: isDark ? alpha('#fff', 0.03) : '#FAFAFA',
            transition: 'box-shadow 0.18s, border-color 0.18s',
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: 2, borderColor: primary, boxShadow: `0 0 0 3px ${alpha(primary, 0.1)}`,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(primary, 0.6) },
          },
          notchedOutline: { borderColor: border },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { fontSize: '0.875rem', fontWeight: 500 } } },
      MuiInputBase:  { styleOverrides: { input: { fontSize: '0.875rem' } } },

      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#0F172A' : brand.card,
            borderBottom: `1px solid ${border}`,
            color: textPrim, backgroundImage: 'none',
          },
        },
      },
      MuiToolbar: { styleOverrides: { root: { minHeight: '60px !important', padding: '0 20px !important' } } },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isDark ? '#0F172A' : brand.primaryDark,
            borderRight: 'none',
            boxShadow: '2px 0 16px rgba(15,23,42,0.08)',
          },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8, marginBottom: 1, minHeight: 40,
            transition: 'all 0.16s ease',
          },
        },
      },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 34 } } },

      MuiTableContainer: { styleOverrides: { root: { borderRadius: 12, border: `1px solid ${border}`, overflowX: 'auto' } } },
      MuiTable:          { styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: border, padding: '11px 16px', fontSize: '0.84rem' },
          head: {
            backgroundColor: isDark ? alpha('#fff', 0.03) : '#F8FAFC',
            color: brand.subtle, fontWeight: 700, fontSize: '0.7rem',
            letterSpacing: '0.08em', textTransform: 'uppercase' as const, padding: '9px 16px',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background 0.12s',
            '&:hover': { backgroundColor: isDark ? alpha(primary, 0.05) : '#F0F7FF' },
            '&:last-child td': { borderBottom: 'none' },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 600, fontSize: '0.74rem' },
          sizeSmall: { height: 20, fontSize: '0.68rem' },
          colorPrimary: {
            backgroundColor: isDark ? alpha(primary,0.2) : brand.primaryChip,
            color: isDark ? '#93C5FD' : brand.primaryDark,
            border: `1px solid ${isDark ? alpha(primary,0.3) : '#BFDBFE'}`,
          },
          colorSuccess: {
            backgroundColor: isDark ? alpha(brand.success,0.2) : '#DCFCE7',
            color: isDark ? '#86EFAC' : '#15803D',
            border: `1px solid ${isDark ? alpha(brand.success,0.3) : '#BBF7D0'}`,
          },
          colorError: {
            backgroundColor: isDark ? alpha(brand.danger,0.2) : '#FEE2E2',
            color: isDark ? '#FCA5A5' : '#991B1B',
            border: `1px solid ${isDark ? alpha(brand.danger,0.3) : '#FECACA'}`,
          },
          colorWarning: {
            backgroundColor: isDark ? alpha(brand.warning,0.2) : '#FEF3C7',
            color: isDark ? '#FCD34D' : '#92400E',
            border: `1px solid ${isDark ? alpha(brand.warning,0.3) : '#FDE68A'}`,
          },
        },
      },

      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: { fontSize: '0.72rem', fontWeight: 500, backgroundColor: isDark ? '#1E293B' : '#1E293B', borderRadius: 6, padding: '5px 9px' },
          arrow:   { color: '#1E293B' },
        },
      },

      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: 12, border: `1px solid ${border}`, boxShadow: '0 8px 32px rgba(15,23,42,0.14)', minWidth: 180 },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 6, margin: '2px 6px', fontSize: '0.875rem',
            fontWeight: 500, padding: '7px 11px',
            '&:hover': { backgroundColor: alpha(primary, 0.07) },
          },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 16, border: `1px solid ${border}`, backgroundColor: surface, boxShadow: '0 24px 64px rgba(15,23,42,0.18)' },
        },
      },
      MuiDialogTitle:   { styleOverrides: { root: { fontSize: '1rem', fontWeight: 700, padding: '18px 22px 10px' } } },
      MuiDialogContent: { styleOverrides: { root: { padding: '0 22px 14px' } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '10px 22px 18px', gap: 8 } } },

      MuiTab:  { styleOverrides: { root: { textTransform: 'none' as const, fontWeight: 600, fontSize: '0.875rem', minHeight: 42, '&.Mui-selected': { color: primary } } } },
      MuiTabs: { styleOverrides: { indicator: { height: 2, borderRadius: 2, backgroundColor: primary } } },

      MuiBadge: { styleOverrides: { badge: { fontSize: '0.62rem', fontWeight: 700, minWidth: 17, height: 17, padding: '0 4px' } } },

      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10, fontWeight: 500, fontSize: '0.85rem' },
          standardInfo:    { backgroundColor: alpha(primary,0.06), color: isDark ? '#93C5FD' : brand.primaryDark, border: `1px solid ${alpha(primary,0.18)}` },
          standardSuccess: { backgroundColor: alpha(brand.success,0.06), border: `1px solid ${alpha(brand.success,0.18)}` },
          standardWarning: { backgroundColor: alpha(brand.warning,0.06), border: `1px solid ${alpha(brand.warning,0.18)}` },
          standardError:   { backgroundColor: alpha(brand.danger,0.06),  border: `1px solid ${alpha(brand.danger,0.18)}` },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 4, height: 5, backgroundColor: alpha(primary, 0.1) },
          bar:  { borderRadius: 4, background: `linear-gradient(90deg, ${primary} 0%, ${brand.primaryLight} 100%)` },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: { padding: 8 },
          track: { borderRadius: 10 },
          switchBase: { '&.Mui-checked + .MuiSwitch-track': { backgroundColor: primary, opacity: 0.85 } },
        },
      },
      MuiSkeleton: {
        styleOverrides: { root: { borderRadius: 6, backgroundColor: isDark ? alpha('#fff',0.07) : '#EEF2F7' } },
      },
      MuiAvatar: {
        styleOverrides: { root: { fontWeight: 700, background: `linear-gradient(135deg, ${brand.primaryLight} 0%, ${primary} 100%)`, color: '#fff' } },
      },
      MuiSnackbar: { defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'right' } } },
    },
  });
}

export const lightTheme = getShieldTheme('light');
export const darkTheme  = getShieldTheme('dark');
export const shieldTheme = lightTheme;

export const gradients = {
  blue:    `linear-gradient(135deg, ${brand.primaryLight} 0%, ${brand.primary} 100%)`,
  navy:    `linear-gradient(135deg, ${brand.primary} 0%, ${brand.primaryDark} 100%)`,
  sky:     `linear-gradient(135deg, ${brand.accent} 0%, #0284C7 100%)`,
  green:   `linear-gradient(135deg, #22C55E 0%, ${brand.success} 100%)`,
  emerald: `linear-gradient(135deg, #10B981 0%, #059669 100%)`,
  amber:   `linear-gradient(135deg, #FBBF24 0%, ${brand.warning} 100%)`,
  red:     `linear-gradient(135deg, #EF4444 0%, ${brand.danger} 100%)`,
  purple:  `linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)`,
  dark:    `linear-gradient(135deg, ${brand.text} 0%, #334155 100%)`,
  hero:    `linear-gradient(135deg, ${brand.primaryDark} 0%, ${brand.primary} 60%, ${brand.primaryLight} 100%)`,
  // aliases
  teal:    `linear-gradient(135deg, ${brand.accent} 0%, #0284C7 100%)`,
  tealSoft:`linear-gradient(135deg, ${brand.primaryLight} 0%, ${brand.primary} 100%)`,
  indigo:  `linear-gradient(135deg, #6366F1 0%, #4338CA 100%)`,
  orange:  `linear-gradient(135deg, #FBBF24 0%, ${brand.warning} 100%)`,
  pink:    `linear-gradient(135deg, #EC4899 0%, #9D174D 100%)`,
  coral:   `linear-gradient(135deg, #EF4444 0%, ${brand.danger} 100%)`,
  sage:    `linear-gradient(135deg, #22C55E 0%, ${brand.success} 100%)`,
  ivory:   `linear-gradient(135deg, #F9FAFB 0%, ${brand.bg} 100%)`,
  lavender:`linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)`,
} as const;

export const shadows = {
  xs:      '0 1px 3px rgba(15,23,42,0.06)',
  sm:      '0 2px 6px rgba(15,23,42,0.07)',
  md:      '0 4px 12px rgba(37,99,235,0.08)',
  lg:      '0 8px 24px rgba(37,99,235,0.11)',
  xl:      '0 16px 48px rgba(37,99,235,0.14)',
  blue:    '0 4px 16px rgba(37,99,235,0.24)',
  colored: (c: string) => `0 4px 16px ${c}38`,
} as const;

export const animations = {
  fadeInUp:     '@keyframes fadeInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }',
  fadeIn:       '@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }',
  slideInLeft:  '@keyframes slideInLeft { from { opacity:0; transform:translateX(-16px); } to { opacity:1; transform:translateX(0); } }',
  pulse:        '@keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.04); } }',
  livePulse:    '@keyframes livePulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }',
  shimmer:      '@keyframes shimmer { 0% { background-position:-600px 0; } 100% { background-position:600px 0; } }',
  gradientShift:'@keyframes gradientShift { 0%,100% { background-position:0% 50%; } 50% { background-position:100% 50%; } }',
} as const;
