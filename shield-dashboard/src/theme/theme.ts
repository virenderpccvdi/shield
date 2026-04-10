import { createTheme, alpha } from '@mui/material/styles';

// ─────────────────────────────────────────────────────────────────────────────
// Guardian's Lens — React MUI theme
//
// Rules:
//  · No 1px solid borders for structure — hierarchy via surface tier shifts
//  · Ghost border only: outlineVariant @ 20% opacity where strictly required
//  · Manrope for H1–H4 (Display/Headline authority)
//  · Inter for H5–caption (Body/Label utility)
//  · Guardian Shadow: blur 32, spread -4, on_surface @ 6% — never black
//  · Glassmorphism AppBar: surface @ 88% + backdrop-filter blur(20px)
//  · Primary #005DAC, primaryContainer #1976D2 (unified with Flutter)
// ─────────────────────────────────────────────────────────────────────────────

export const ds = {
  // Primary hierarchy
  primary:           '#005DAC',
  primaryContainer:  '#1976D2',
  primaryLight:      '#4FC3F7',
  primaryChip:       '#E3F2FD',

  // Secondary
  secondary:         '#0288D1',
  secondaryDark:     '#0277BD',
  secondaryLight:    '#4FC3F7',

  // Semantic
  success:  '#2E7D32',
  warning:  '#E65100',
  danger:   '#C62828',
  info:     '#0277BD',
  tertiary: '#BF360C',

  // Surface tiers (light) — the "no-line" system
  surface:                '#F7F9FB',  // canvas
  surfaceContainerLowest: '#FFFFFF',  // pure white card
  surfaceContainerLow:    '#F0F4F8',  // elevated card / input fill
  surfaceContainer:       '#E8EEF4',  // section bg
  surfaceContainerHigh:   '#DCE6EF',  // grouped UI
  surfaceContainerHighest:'#D0DCEA',

  // Surface tiers (dark)
  surfaceDark:                '#0D1B2A',
  surfaceContainerLowestDark: '#0A1520',
  surfaceContainerLowDark:    '#122030',
  surfaceContainerDark:       '#192B3E',
  surfaceContainerHighDark:   '#1E3349',
  surfaceContainerHighestDark:'#243B54',

  // On-surface text
  onSurface:        '#0F1F3D',
  onSurfaceVariant: '#4A6481',
  outlineVariant:   '#C4D0DC',   // only at 20% opacity for ghost borders

  // Legacy compatibility
  bg:         '#F7F9FB',
  bgDark:     '#0D1B2A',
  card:       '#FFFFFF',
  cardDark:   '#122030',
  border:     'rgba(196,208,220,0.2)',  // ghost border
  borderDark: 'rgba(42,63,86,0.4)',
  text:       '#0F1F3D',
  muted:      '#4A6481',
  subtle:     '#7A97B2',
} as const;

export function getShieldTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  const p      = ds.primary;
  const pCont  = ds.primaryContainer;

  // Resolved surface values
  const surface    = isDark ? ds.surfaceDark               : ds.surface;
  const surfLow    = isDark ? ds.surfaceContainerLowDark   : ds.surfaceContainerLow;
  const surfLowest = isDark ? ds.surfaceContainerLowestDark: ds.surfaceContainerLowest;
  const surfHigh   = isDark ? ds.surfaceContainerHighDark  : ds.surfaceContainerHigh;

  const textPrim   = isDark ? '#E8EFF6' : ds.onSurface;
  const textSec    = isDark ? '#8AA5BE' : ds.onSurfaceVariant;
  const outlineVar = isDark ? ds.borderDark : ds.border;   // 20% ghost border

  return createTheme({
    palette: {
      mode,
      primary:    { main: p, light: ds.primaryLight, dark: ds.primaryContainer, contrastText: '#fff' },
      secondary:  { main: ds.secondary, light: ds.secondaryLight, dark: ds.secondaryDark, contrastText: '#fff' },
      error:      { main: ds.danger },
      warning:    { main: ds.warning },
      success:    { main: ds.success },
      info:       { main: ds.info },
      background: { default: surface, paper: surfLowest },
      text:       { primary: textPrim, secondary: textSec },
      divider:    outlineVar,
    },

    // ── Guardian's Lens dual-font typography ───────────────────────────────
    typography: {
      // Manrope for Display/Headline authority
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      fontWeightLight: 300, fontWeightRegular: 400,
      fontWeightMedium: 500, fontWeightBold: 700,

      h1: {
        fontFamily: '"Manrope", system-ui, sans-serif',
        fontSize: '1.875rem', fontWeight: 800,
        letterSpacing: '-0.04em', lineHeight: 1.15, color: textPrim,
      },
      h2: {
        fontFamily: '"Manrope", system-ui, sans-serif',
        fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em',
      },
      h3: {
        fontFamily: '"Manrope", system-ui, sans-serif',
        fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em',
      },
      h4: {
        fontFamily: '"Manrope", system-ui, sans-serif',
        fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em',
      },
      // Inter for utility text
      h5: { fontSize: '0.975rem', fontWeight: 600 },
      h6: { fontSize: '0.875rem', fontWeight: 600 },
      subtitle1: { fontWeight: 600, letterSpacing: '-0.01em', fontSize: '0.9rem' },
      subtitle2: { fontWeight: 600, fontSize: '0.8rem', color: textSec },
      body1: { fontSize: '0.875rem', lineHeight: 1.65, color: textPrim },
      body2: { fontSize: '0.8rem',   lineHeight: 1.6,  color: textSec },
      caption:  { fontSize: '0.72rem', color: textSec },
      overline: {
        fontSize: '0.68rem', fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color: ds.subtle,
      },
      button: {
        fontWeight: 600, letterSpacing: '0.01em',
        textTransform: 'none' as const, fontSize: '0.875rem',
      },
    },

    shape: { borderRadius: 12 },

    // ── Guardian Shadow system — never black ─────────────────────────────
    shadows: [
      'none',
      `0 2px 8px ${alpha(ds.onSurface, 0.05)}, 0 1px 2px ${alpha(ds.onSurface, 0.03)}`,
      `0 4px 12px ${alpha(ds.onSurface, 0.06)}, 0 2px 4px ${alpha(ds.onSurface, 0.04)}`,
      `0 8px 24px ${alpha(ds.onSurface, 0.06)}, 0 2px 8px ${alpha(ds.onSurface, 0.04)}`,
      `0 12px 32px ${alpha(p, 0.08)}, 0 4px 12px ${alpha(ds.onSurface, 0.04)}`,
      `0 16px 40px ${alpha(p, 0.10)}, 0 6px 16px ${alpha(ds.onSurface, 0.05)}`,
      `0 20px 48px ${alpha(p, 0.12)}, 0 8px 20px ${alpha(ds.onSurface, 0.06)}`,
      `0 24px 56px ${alpha(p, 0.12)}, 0 8px 24px ${alpha(ds.onSurface, 0.06)}`,
      `0 32px 64px ${alpha(p, 0.14)}, 0 12px 32px ${alpha(ds.onSurface, 0.07)}`,
      ...Array(16).fill('none'),
    ] as any,

    components: {
      MuiCssBaseline: {
        styleOverrides: `
          *, *::before, *::after { box-sizing: border-box; }
          html { scroll-behavior: smooth; }
          body { background: ${surface}; }
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${isDark ? alpha('#fff', 0.12) : ds.outlineVariant}; border-radius: 99px; }
          ::-webkit-scrollbar-thumb:hover { background: ${alpha(p, 0.4)}; }

          /* Guardian animations */
          @keyframes fadeInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
          @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
          @keyframes slideInLeft { from { opacity:0; transform:translateX(-16px); } to { opacity:1; transform:translateX(0); } }
          @keyframes livePulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.35; transform:scale(0.8); } }
          @keyframes shimmer { 0% { background-position:-600px 0; } 100% { background-position:600px 0; } }
          @keyframes guardianPulse { 0%,100% { box-shadow:0 0 0 0 ${alpha(p, 0.4)}; } 70% { box-shadow:0 0 0 10px transparent; } }
          @keyframes gradientShift { 0%,100% { background-position:0% 50%; } 50% { background-position:100% 50%; } }
          @keyframes sapphireShimmer {
            0%   { background-position: -200% center; }
            100% { background-position:  200% center; }
          }
        `,
      },

      // ── Card: tonal lift, NO border in light, ghost border in dark ─────
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            // No border in light — surface tier contrast is the definition
            border: isDark ? `1px solid ${outlineVar}` : 'none',
            borderRadius: 14,
            backgroundColor: surfLowest,
            // Guardian shadow — ambient, not dark
            boxShadow: isDark
              ? 'none'
              : `0 2px 8px ${alpha(ds.onSurface, 0.05)}, 0 1px 2px ${alpha(ds.onSurface, 0.03)}`,
            transition: 'box-shadow 0.22s ease, transform 0.22s ease',
            '&:hover': {
              boxShadow: isDark
                ? `0 8px 32px ${alpha('#000', 0.35)}`
                : `0 8px 32px ${alpha(ds.onSurface, 0.08)}, 0 4px 12px ${alpha(p, 0.06)}`,
              transform: 'translateY(-1px)',
            },
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: '20px', '&:last-child': { paddingBottom: '20px' } },
        },
      },

      // ── Paper: no border in light, ghost border in dark ───────────────
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: isDark ? `1px solid ${outlineVar}` : 'none',
            backgroundColor: surfLowest,
          },
          elevation1: {
            boxShadow: `0 2px 8px ${alpha(ds.onSurface, 0.05)}`,
          },
          elevation2: {
            boxShadow: `0 4px 12px ${alpha(ds.onSurface, 0.06)}`,
          },
        },
      },

      // ── Buttons: gradient primary, ghost border outlined ──────────────
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 24,  // xl radius from spec
            fontWeight: 600,
            fontSize: '0.875rem',
            padding: '10px 22px',
            textTransform: 'none' as const,
            transition: 'all 0.18s ease',
            '&:hover': { transform: 'translateY(-1px)' },
            '&:active': { transform: 'translateY(0)' },
          },
          contained: {
            background: `linear-gradient(135deg, #004A8F 0%, ${p} 100%)`,
            boxShadow:  `0 4px 16px ${alpha(p, 0.30)}`,
            '&:hover': {
              background:  `linear-gradient(135deg, ${p} 0%, ${pCont} 100%)`,
              boxShadow:   `0 6px 20px ${alpha(p, 0.40)}`,
            },
          },
          outlined: {
            borderWidth:  '1.5px',
            borderColor:  alpha(p, 0.40),
            '&:hover': {
              borderWidth: '1.5px', borderColor: p,
              backgroundColor: alpha(p, 0.04),
            },
          },
          text: {
            borderRadius: 8,
            '&:hover': { backgroundColor: alpha(p, 0.06) },
          },
          sizeSmall: { padding: '5px 14px', fontSize: '0.8rem', borderRadius: 16 },
          sizeLarge: { padding: '12px 28px', fontSize: '0.925rem' },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'all 0.16s ease',
            '&:hover': { backgroundColor: alpha(p, 0.08), transform: 'scale(1.06)' },
          },
        },
      },

      // ── Inputs: surfaceContainerLow fill, ghost border ────────────────
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            fontSize: '0.875rem',
            backgroundColor: isDark ? alpha('#fff', 0.04) : ds.surfaceContainerLow,
            transition: 'box-shadow 0.18s, border-color 0.18s',
            // Ghost border at rest (20% outlineVariant)
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: outlineVar,
              borderWidth: '1px',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: 2,
              borderColor: p,
              boxShadow: `0 0 0 3px ${alpha(p, 0.10)}`,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(p, 0.55),
            },
          },
        },
      },
      MuiInputLabel:  { styleOverrides: { root: { fontSize: '0.875rem', fontWeight: 500 } } },
      MuiInputBase:   { styleOverrides: { input: { fontSize: '0.875rem' } } },

      // ── AppBar: glassmorphism — the editorial "airy" navigation ─────────
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: isDark
              ? alpha(ds.surfaceContainerLowDark, 0.88)
              : alpha('#FFFFFF', 0.88),
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            // Ghost border at bottom only — the "one allowed line"
            borderBottom: `1px solid ${outlineVar}`,
            color: textPrim,
            backgroundImage: 'none',
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: { minHeight: '60px !important', padding: '0 24px !important' },
        },
      },

      // ── Drawer: tonal surface, no border ──────────────────────────────
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isDark ? ds.surfaceContainerLowDark : ds.surfaceContainerLowest,
            borderRight: 'none',  // No structural border — tonal contrast only
            boxShadow: isDark
              ? `4px 0 24px ${alpha('#000', 0.35)}`
              : `4px 0 24px ${alpha(ds.onSurface, 0.06)}`,
          },
        },
      },

      // ── List items: rounded, tonal hover ──────────────────────────────
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            marginBottom: 2,
            minHeight: 42,
            transition: 'all 0.15s ease',
            '&.Mui-selected': {
              backgroundColor: alpha(p, 0.10),
              color: p,
              '&:hover': { backgroundColor: alpha(p, 0.14) },
            },
            '&:hover': { backgroundColor: alpha(p, 0.06) },
          },
        },
      },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 36 } } },

      // ── Tables: tonal header, no outer border ──────────────────────────
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            // No border — tonal contrast from header bg is enough
            border: 'none',
            boxShadow: isDark ? 'none' : `0 2px 8px ${alpha(ds.onSurface, 0.05)}`,
            overflow: 'hidden',
          },
        },
      },
      MuiTable:     { styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } } },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottomColor: outlineVar,
            padding: '12px 16px', fontSize: '0.84rem',
          },
          head: {
            backgroundColor: isDark ? ds.surfaceContainerDark : ds.surfaceContainerLow,
            color:           ds.subtle,
            fontWeight:      700,
            fontSize:        '0.68rem',
            letterSpacing:   '0.09em',
            textTransform:   'uppercase' as const,
            padding:         '10px 16px',
            borderBottom:    `1px solid ${outlineVar}`,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background 0.12s',
            '&:hover': {
              backgroundColor: isDark ? alpha(p, 0.05) : alpha(p, 0.03),
            },
            '&:last-child td': { borderBottom: 'none' },
          },
        },
      },

      // ── Chips: pill, tonal — no border in light ───────────────────────
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 99,
            fontWeight: 600, fontSize: '0.74rem',
            border: 'none',  // tonal only
          },
          sizeSmall: { height: 22, fontSize: '0.68rem' },
          colorPrimary: {
            backgroundColor: isDark ? alpha(p, 0.20) : ds.primaryChip,
            color:           isDark ? '#90CAF9' : ds.primaryContainer,
          },
          colorSuccess: {
            backgroundColor: isDark ? alpha(ds.success, 0.20) : '#E8F5E9',
            color:           isDark ? '#A5D6A7' : ds.success,
          },
          colorError: {
            backgroundColor: isDark ? alpha(ds.danger, 0.20) : '#FFEBEE',
            color:           isDark ? '#EF9A9A' : ds.danger,
          },
          colorWarning: {
            backgroundColor: isDark ? alpha(ds.warning, 0.20) : '#FFF3E0',
            color:           isDark ? '#FFCC80' : ds.warning,
          },
        },
      },

      // ── Dialog: surfaceContainerLowest, no border in light ────────────
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            border: isDark ? `1px solid ${outlineVar}` : 'none',
            backgroundColor: surfLowest,
            boxShadow: `0 24px 64px ${alpha(ds.onSurface, 0.16)}`,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontFamily: '"Manrope", system-ui, sans-serif',
            fontSize: '1.05rem', fontWeight: 700, padding: '20px 24px 10px',
          },
        },
      },
      MuiDialogContent: { styleOverrides: { root: { padding: '0 24px 14px' } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '10px 24px 20px', gap: 8 } } },

      // ── Tooltip ──────────────────────────────────────────────────────
      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: {
            fontSize: '0.72rem', fontWeight: 500,
            backgroundColor: '#1A2E42',
            borderRadius: 8, padding: '5px 10px',
          },
          arrow: { color: '#1A2E42' },
        },
      },

      // ── Menu: tonal, no border in light ──────────────────────────────
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            border: isDark ? `1px solid ${outlineVar}` : 'none',
            boxShadow: `0 8px 32px ${alpha(ds.onSurface, 0.12)}`,
            minWidth: 180,
            backgroundColor: surfLowest,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: '2px 8px',
            fontSize: '0.875rem', fontWeight: 500,
            padding: '7px 12px',
            '&:hover': { backgroundColor: alpha(p, 0.07) },
            '&.Mui-selected': {
              backgroundColor: alpha(p, 0.10),
              '&:hover': { backgroundColor: alpha(p, 0.14) },
            },
          },
        },
      },

      // ── Tabs ─────────────────────────────────────────────────────────
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none' as const,
            fontWeight: 600, fontSize: '0.875rem',
            minHeight: 44,
            '&.Mui-selected': { color: p },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { height: 2, borderRadius: 99, backgroundColor: p },
          root: { borderBottom: `1px solid ${outlineVar}` },
        },
      },

      // ── Alert: tonal containers, no border in light ───────────────────
      MuiAlert: {
        styleOverrides: {
          root:            { borderRadius: 12, fontWeight: 500, fontSize: '0.85rem' },
          standardInfo:    { backgroundColor: alpha(p, 0.07),         color: isDark ? '#90CAF9' : ds.primaryContainer },
          standardSuccess: { backgroundColor: alpha(ds.success, 0.07), color: isDark ? '#A5D6A7' : ds.success },
          standardWarning: { backgroundColor: alpha(ds.warning, 0.07), color: isDark ? '#FFCC80' : ds.warning },
          standardError:   { backgroundColor: alpha(ds.danger, 0.07),  color: isDark ? '#EF9A9A' : ds.danger },
        },
      },

      // ── Progress ─────────────────────────────────────────────────────
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 99, height: 5, backgroundColor: alpha(p, 0.10) },
          bar:  {
            borderRadius: 99,
            background: `linear-gradient(90deg, ${p} 0%, ${pCont} 100%)`,
          },
        },
      },

      // ── Switch ───────────────────────────────────────────────────────
      MuiSwitch: {
        styleOverrides: {
          root: { padding: 8 },
          track: {
            borderRadius: 10,
            backgroundColor: isDark ? alpha('#fff', 0.15) : ds.outlineVariant,
            opacity: 1,
          },
          switchBase: {
            '&.Mui-checked': {
              '& + .MuiSwitch-track': {
                backgroundColor: p,
                opacity: 0.85,
              },
            },
          },
        },
      },

      // ── Badge ────────────────────────────────────────────────────────
      MuiBadge: {
        styleOverrides: {
          badge: {
            fontSize: '0.62rem', fontWeight: 700,
            minWidth: 17, height: 17, padding: '0 4px',
          },
        },
      },

      // ── Skeleton ─────────────────────────────────────────────────────
      MuiSkeleton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: isDark ? alpha('#fff', 0.07) : ds.surfaceContainerLow,
          },
        },
      },

      // ── Avatar: guardian gradient ─────────────────────────────────────
      MuiAvatar: {
        styleOverrides: {
          root: {
            fontFamily: '"Manrope", system-ui, sans-serif',
            fontWeight: 700,
            background: `linear-gradient(135deg, #004A8F 0%, ${p} 100%)`,
            color: '#fff',
          },
        },
      },

      MuiSnackbar: {
        defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'right' } },
      },
    },
  });
}

export const lightTheme  = getShieldTheme('light');
export const darkTheme   = getShieldTheme('dark');
export const shieldTheme = lightTheme;

// ── Guardian gradients ────────────────────────────────────────────────────────
export const gradients = {
  // Core guardian gradient (hero sections, primary CTAs)
  guardian:    `linear-gradient(135deg, #003D72 0%, ${ds.primary} 100%)`,
  guardianSoft:`linear-gradient(135deg, ${ds.primary} 0%, ${ds.primaryContainer} 100%)`,

  // Polished sapphire — add as overlay at 15% opacity for hero depth
  sapphire:    `radial-gradient(ellipse at 70% -10%, ${alpha(ds.primary, 0.15)} 0%, transparent 60%)`,

  // Semantic
  success:  `linear-gradient(135deg, #1B5E20 0%, ${ds.success} 100%)`,
  warning:  `linear-gradient(135deg, #BF360C 0%, ${ds.warning} 100%)`,
  danger:   `linear-gradient(135deg, #7F0000 0%, ${ds.danger} 100%)`,
  info:     `linear-gradient(135deg, #01579B 0%, ${ds.info} 100%)`,

  // Extended palette
  purple:   'linear-gradient(135deg, #4A148C 0%, #7B1FA2 100%)',
  teal:     'linear-gradient(135deg, #004D40 0%, #00897B 100%)',
  amber:    'linear-gradient(135deg, #E65100 0%, #FF8F00 100%)',
  dark:     'linear-gradient(135deg, #0D1B2A 0%, #192B3E 100%)',

  // ── Legacy aliases (backward compat for existing pages) ───────────────
  indigo:    `linear-gradient(135deg, ${ds.primaryContainer} 0%, ${ds.primary} 100%)`,
  indigoDark:`linear-gradient(135deg, #003D72 0%, ${ds.primaryContainer} 100%)`,
  cyan:      `linear-gradient(135deg, ${ds.secondary} 0%, ${ds.secondaryDark} 100%)`,
  cyanDark:  `linear-gradient(135deg, ${ds.secondaryDark} 0%, #01579B 100%)`,
  blue:      `linear-gradient(135deg, #1565C0 0%, ${ds.primary} 100%)`,
  navy:      `linear-gradient(135deg, #003D72 0%, #1A237E 100%)`,
  sky:       `linear-gradient(135deg, ${ds.secondary} 0%, ${ds.secondaryDark} 100%)`,
  tealSoft:  `linear-gradient(135deg, ${ds.primary} 0%, ${ds.primaryContainer} 100%)`,
  green:     `linear-gradient(135deg, #1B5E20 0%, ${ds.success} 100%)`,
  emerald:   `linear-gradient(135deg, #1B5E20 0%, ${ds.success} 100%)`,
  orange:    `linear-gradient(135deg, #BF360C 0%, ${ds.warning} 100%)`,
  red:       `linear-gradient(135deg, #7F0000 0%, ${ds.danger} 100%)`,
  coral:     `linear-gradient(135deg, #B71C1C 0%, ${ds.danger} 100%)`,
  lavender:  'linear-gradient(135deg, #4A148C 0%, #7B1FA2 100%)',
  hero:      `linear-gradient(135deg, #003D72 0%, ${ds.primary} 100%)`,
  pink:      'linear-gradient(135deg, #880E4F 0%, #AD1457 100%)',
  sage:      `linear-gradient(135deg, #1B5E20 0%, ${ds.success} 100%)`,
  ivory:     'linear-gradient(135deg, #263238 0%, #37474F 100%)',
} as const;

// ── Guardian shadows ──────────────────────────────────────────────────────────
export const guardianShadow = {
  sm:   `0 2px 8px ${alpha(ds.onSurface, 0.05)}, 0 1px 2px ${alpha(ds.onSurface, 0.03)}`,
  md:   `0 8px 32px ${alpha(ds.onSurface, 0.06)}, 0 2px 8px ${alpha(ds.onSurface, 0.04)}`,
  lg:   `0 16px 48px ${alpha(ds.onSurface, 0.08)}, 0 6px 16px ${alpha(ds.onSurface, 0.05)}`,
  xl:   `0 24px 64px ${alpha(ds.primary, 0.12)}, 0 8px 24px ${alpha(ds.onSurface, 0.06)}`,
  hero: `0 32px 80px ${alpha(ds.onSurface, 0.16)}`,
  // Colored ambient shadows
  colored: (color: string) => `0 8px 24px ${alpha(color, 0.25)}, 0 2px 8px ${alpha(color, 0.15)}`,
} as const;

// Legacy export for existing code
export const shadows = {
  xs:      guardianShadow.sm,
  sm:      guardianShadow.sm,
  md:      guardianShadow.md,
  lg:      guardianShadow.lg,
  xl:      guardianShadow.xl,
  blue:    guardianShadow.colored(ds.primary),
  colored: guardianShadow.colored,
} as const;

// Legacy brand export
export const brand = {
  primary:      ds.primary,
  primaryDark:  ds.primaryContainer,
  primaryLight: ds.primaryLight,
  primaryChip:  ds.primaryChip,
  secondary:    ds.secondary,
  secondaryDark: ds.secondaryDark,
  secondaryLight: ds.secondaryLight,
  accent:   ds.info,
  success:  ds.success,
  warning:  ds.warning,
  danger:   ds.danger,
  bg:       ds.surface,
  card:     ds.surfaceContainerLowest,
  border:   ds.border,
  text:     ds.onSurface,
  muted:    ds.onSurfaceVariant,
  subtle:   ds.subtle,
  bgDark:   ds.surfaceDark,
  cardDark: ds.surfaceContainerLowDark,
  borderDark: ds.borderDark,
} as const;

export const animations = {
  fadeInUp:     'animation: fadeInUp 0.4s ease forwards',
  fadeIn:       'animation: fadeIn 0.3s ease forwards',
  slideInLeft:  'animation: slideInLeft 0.35s ease forwards',
  pulse:        'animation: guardianPulse 2s infinite',
  shimmer:      'background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%); background-size: 600px 100%; animation: shimmer 1.5s infinite',
} as const;
