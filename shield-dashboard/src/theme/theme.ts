import { createTheme, alpha } from '@mui/material/styles';

export const brand = {
  // Core — Indigo primary, Cyan secondary
  primary:      '#4F46E5',
  primaryDark:  '#3730A3',
  primaryLight: '#818CF8',
  primaryChip:  '#EEF2FF',
  // Secondary (Cyan)
  secondary:    '#06B6D4',
  secondaryDark:'#0891B2',
  secondaryLight:'#67E8F9',
  // Semantic
  accent:   '#06B6D4',
  success:  '#10B981',
  warning:  '#F59E0B',
  danger:   '#EF4444',
  // Surfaces (light)
  bg:       '#F9FAFB',
  card:     '#FFFFFF',
  border:   '#E5E7EB',
  // Text (light)
  text:     '#111827',
  muted:    '#6B7280',
  subtle:   '#9CA3AF',
  // Dark surfaces
  bgDark:   '#0F172A',
  cardDark: '#1E293B',
  borderDark:'rgba(255,255,255,0.08)',
} as const;

export function getShieldTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  const primary   = brand.primary;
  const secondary = brand.secondary;
  const surface   = isDark ? brand.cardDark  : brand.card;
  const bg        = isDark ? brand.bgDark    : brand.bg;
  const border    = isDark ? brand.borderDark: brand.border;
  const textPrim  = isDark ? '#F9FAFB'       : brand.text;
  const textSec   = isDark ? '#94A3B8'       : brand.muted;

  return createTheme({
    palette: {
      mode,
      primary:    { main: primary, light: brand.primaryLight, dark: brand.primaryDark, contrastText: '#fff' },
      secondary:  { main: secondary, light: brand.secondaryLight, dark: brand.secondaryDark, contrastText: '#fff' },
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

    shape: { borderRadius: 12 },

    shadows: [
      'none',
      '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
      '0 2px 6px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
      '0 4px 12px rgba(79,70,229,0.08), 0 2px 4px rgba(0,0,0,0.04)',
      '0 6px 16px rgba(79,70,229,0.10), 0 2px 6px rgba(0,0,0,0.05)',
      '0 8px 24px rgba(79,70,229,0.12), 0 4px 8px rgba(0,0,0,0.06)',
      '0 12px 32px rgba(79,70,229,0.12), 0 4px 12px rgba(0,0,0,0.06)',
      '0 16px 40px rgba(79,70,229,0.13), 0 6px 16px rgba(0,0,0,0.07)',
      '0 20px 48px rgba(79,70,229,0.14), 0 8px 20px rgba(0,0,0,0.08)',
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
          ::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(255,255,255,0.12)' : '#D1D5DB'}; border-radius: 99px; }
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
            boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
            transition: 'box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease',
            '&:hover': {
              boxShadow: isDark
                ? '0 8px 32px rgba(0,0,0,0.4)'
                : '0 8px 24px rgba(79,70,229,0.12), 0 4px 8px rgba(0,0,0,0.06)',
              borderColor: isDark ? alpha(primary, 0.25) : '#C7D2FE',
            },
          },
        },
      },
      MuiCardContent: { styleOverrides: { root: { padding: '20px', '&:last-child': { paddingBottom: '20px' } } } },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${border}`,
            backgroundColor: surface,
          },
          elevation1: { boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' },
          elevation2: { boxShadow: '0 4px 12px rgba(79,70,229,0.08)' },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '0.875rem',
            padding: '8px 18px',
            textTransform: 'none' as const,
            transition: 'all 0.18s ease',
            '&:hover': { transform: 'translateY(-1px)' },
            '&:active': { transform: 'translateY(0)' },
          },
          contained: {
            background: `linear-gradient(135deg, ${brand.primaryDark} 0%, ${primary} 100%)`,
            boxShadow: `0 2px 8px ${alpha(primary, 0.32)}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${primary} 0%, ${brand.primaryDark} 100%)`,
              boxShadow: `0 4px 16px ${alpha(primary, 0.42)}`,
            },
          },
          outlined: {
            borderWidth: '1.5px',
            borderColor: alpha(primary, 0.45),
            '&:hover': { borderWidth: '1.5px', borderColor: primary, backgroundColor: alpha(primary, 0.04) },
          },
          text: { '&:hover': { backgroundColor: alpha(primary, 0.06) } },
          sizeSmall: { padding: '4px 12px', fontSize: '0.8rem', borderRadius: 6 },
          sizeLarge: { padding: '10px 24px', fontSize: '0.925rem' },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: 'all 0.16s ease',
            '&:hover': { backgroundColor: alpha(primary, 0.07), transform: 'scale(1.08)' },
          },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontSize: '0.875rem',
            backgroundColor: isDark ? alpha('#fff', 0.03) : '#FAFAFA',
            transition: 'box-shadow 0.18s, border-color 0.18s',
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: 2,
              borderColor: primary,
              boxShadow: `0 0 0 3px ${alpha(primary, 0.1)}`,
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
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderBottom: `1px solid ${border}`,
            color: textPrim,
            backgroundImage: 'none',
          },
        },
      },
      MuiToolbar: { styleOverrides: { root: { minHeight: '60px !important', padding: '0 20px !important' } } },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderRight: `1px solid ${border}`,
            boxShadow: 'none',
          },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginBottom: 1,
            minHeight: 40,
            transition: 'all 0.16s ease',
          },
        },
      },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 34 } } },

      MuiTableContainer: { styleOverrides: { root: { borderRadius: 12, border: `1px solid ${border}`, overflowX: 'auto' } } },
      MuiTable:          { styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: border, padding: '12px 16px', fontSize: '0.84rem' },
          head: {
            backgroundColor: isDark ? alpha('#fff', 0.03) : '#F9FAFB',
            color: brand.subtle,
            fontWeight: 700,
            fontSize: '0.7rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            padding: '10px 16px',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background 0.12s',
            '&:hover': { backgroundColor: isDark ? alpha(primary, 0.05) : alpha(primary, 0.03) },
            '&:last-child td': { borderBottom: 'none' },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 99, fontWeight: 600, fontSize: '0.74rem' },
          sizeSmall: { height: 20, fontSize: '0.68rem' },
          colorPrimary: {
            backgroundColor: isDark ? alpha(primary, 0.2) : brand.primaryChip,
            color: isDark ? '#A5B4FC' : brand.primaryDark,
            border: `1px solid ${isDark ? alpha(primary, 0.3) : '#C7D2FE'}`,
          },
          colorSuccess: {
            backgroundColor: isDark ? alpha(brand.success, 0.2) : '#D1FAE5',
            color: isDark ? '#6EE7B7' : '#065F46',
            border: `1px solid ${isDark ? alpha(brand.success, 0.3) : '#A7F3D0'}`,
          },
          colorError: {
            backgroundColor: isDark ? alpha(brand.danger, 0.2) : '#FEE2E2',
            color: isDark ? '#FCA5A5' : '#991B1B',
            border: `1px solid ${isDark ? alpha(brand.danger, 0.3) : '#FECACA'}`,
          },
          colorWarning: {
            backgroundColor: isDark ? alpha(brand.warning, 0.2) : '#FEF3C7',
            color: isDark ? '#FCD34D' : '#92400E',
            border: `1px solid ${isDark ? alpha(brand.warning, 0.3) : '#FDE68A'}`,
          },
        },
      },

      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: {
            fontSize: '0.72rem',
            fontWeight: 500,
            backgroundColor: '#1E293B',
            borderRadius: 6,
            padding: '5px 9px',
          },
          arrow: { color: '#1E293B' },
        },
      },

      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            border: `1px solid ${border}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            minWidth: 180,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            margin: '2px 6px',
            fontSize: '0.875rem',
            fontWeight: 500,
            padding: '7px 11px',
            '&:hover': { backgroundColor: alpha(primary, 0.07) },
          },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            border: `1px solid ${border}`,
            backgroundColor: surface,
            boxShadow: '0 24px 64px rgba(0,0,0,0.16)',
          },
        },
      },
      MuiDialogTitle:   { styleOverrides: { root: { fontSize: '1rem', fontWeight: 700, padding: '18px 22px 10px' } } },
      MuiDialogContent: { styleOverrides: { root: { padding: '0 22px 14px' } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '10px 22px 18px', gap: 8 } } },

      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none' as const,
            fontWeight: 600,
            fontSize: '0.875rem',
            minHeight: 42,
            '&.Mui-selected': { color: primary },
          },
        },
      },
      MuiTabs: { styleOverrides: { indicator: { height: 2, borderRadius: 2, backgroundColor: primary } } },

      MuiBadge: { styleOverrides: { badge: { fontSize: '0.62rem', fontWeight: 700, minWidth: 17, height: 17, padding: '0 4px' } } },

      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10, fontWeight: 500, fontSize: '0.85rem' },
          standardInfo:    { backgroundColor: alpha(primary, 0.06), color: isDark ? '#A5B4FC' : brand.primaryDark, border: `1px solid ${alpha(primary, 0.18)}` },
          standardSuccess: { backgroundColor: alpha(brand.success, 0.06), border: `1px solid ${alpha(brand.success, 0.18)}` },
          standardWarning: { backgroundColor: alpha(brand.warning, 0.06), border: `1px solid ${alpha(brand.warning, 0.18)}` },
          standardError:   { backgroundColor: alpha(brand.danger, 0.06),  border: `1px solid ${alpha(brand.danger, 0.18)}` },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 99, height: 5, backgroundColor: alpha(primary, 0.1) },
          bar:  { borderRadius: 99, background: `linear-gradient(90deg, ${primary} 0%, ${brand.secondaryDark} 100%)` },
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
        styleOverrides: { root: { borderRadius: 8, backgroundColor: isDark ? alpha('#fff', 0.07) : '#F3F4F6' } },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            fontWeight: 700,
            background: `linear-gradient(135deg, ${brand.primaryDark} 0%, ${primary} 100%)`,
            color: '#fff',
          },
        },
      },
      MuiSnackbar: { defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'right' } } },
    },
  });
}

export const lightTheme = getShieldTheme('light');
export const darkTheme  = getShieldTheme('dark');
export const shieldTheme = lightTheme;

export const gradients = {
  // NOTE: All gradients use dark-enough start colors so white text stays legible (≥4.5:1)
  indigo:    `linear-gradient(135deg, ${brand.primary} 0%, ${brand.primaryDark} 100%)`,
  indigoDark:`linear-gradient(135deg, ${brand.primaryDark} 0%, #2E27A3 100%)`,
  cyan:      `linear-gradient(135deg, ${brand.secondary} 0%, ${brand.secondaryDark} 100%)`,
  cyanDark:  `linear-gradient(135deg, ${brand.secondaryDark} 0%, #0E7490 100%)`,
  // semantic
  blue:      `linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)`,
  navy:      `linear-gradient(135deg, ${brand.primaryDark} 0%, #1E1B7A 100%)`,
  sky:       `linear-gradient(135deg, ${brand.secondary} 0%, ${brand.secondaryDark} 100%)`,
  teal:      `linear-gradient(135deg, #00838F 0%, #006064 100%)`,
  tealSoft:  `linear-gradient(135deg, ${brand.primary} 0%, ${brand.primaryDark} 100%)`,
  green:     `linear-gradient(135deg, #10B981 0%, #059669 100%)`,
  emerald:   `linear-gradient(135deg, #10B981 0%, #059669 100%)`,
  amber:     `linear-gradient(135deg, #D97706 0%, #B45309 100%)`,
  orange:    `linear-gradient(135deg, #EA580C 0%, #C2410C 100%)`,
  red:       `linear-gradient(135deg, #EF4444 0%, #DC2626 100%)`,
  coral:     `linear-gradient(135deg, #E53935 0%, #C62828 100%)`,
  purple:    `linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)`,
  lavender:  `linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)`,
  dark:      `linear-gradient(135deg, #1E293B 0%, #334155 100%)`,
  hero:      `linear-gradient(135deg, ${brand.primaryDark} 0%, ${brand.primary} 100%)`,
  pink:      `linear-gradient(135deg, #DB2777 0%, #BE185D 100%)`,
  sage:      `linear-gradient(135deg, #059669 0%, #047857 100%)`,
  ivory:     `linear-gradient(135deg, #4B5563 0%, #374151 100%)`,
} as const;

export const shadows = {
  xs:      '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
  sm:      '0 2px 6px rgba(0,0,0,0.08)',
  md:      '0 4px 12px rgba(79,70,229,0.08)',
  lg:      '0 8px 24px rgba(79,70,229,0.12)',
  xl:      '0 16px 48px rgba(79,70,229,0.16)',
  blue:    '0 4px 16px rgba(79,70,229,0.24)',
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
