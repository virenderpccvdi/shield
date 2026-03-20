import { createTheme } from '@mui/material/styles';

export function getShieldTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#3B82F6' : '#1565C0',
        light: isDark ? '#60A5FA' : '#1976D2',
        dark: isDark ? '#2563EB' : '#0D47A1',
      },
      secondary: { main: '#43A047' },
      error: { main: '#E53935' },
      warning: { main: '#FB8C00' },
      success: { main: '#43A047' },
      background: {
        default: isDark ? '#0A0F1E' : '#F8FAFC',
        paper: isDark ? '#111827' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#F1F5F9' : '#0F172A',
        secondary: isDark ? '#94A3B8' : '#64748B',
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : '#E8EDF2',
    },
    typography: {
      fontFamily: '"Inter", "Roboto", sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 12,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            backgroundColor: theme.palette.background.paper,
            '&:hover': { boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.4)' : '0 8px 30px rgba(0,0,0,0.12)' },
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none' as const,
            fontWeight: 600,
            transition: 'all 0.2s ease',
            '&:hover': { transform: 'translateY(-1px)', boxShadow: isDark ? '0 4px 12px rgba(59,130,246,0.4)' : '0 4px 12px rgba(21,101,192,0.3)' },
            '&:active': { transform: 'translateY(0)' },
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 500 } },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            borderBottom: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderBottomColor: theme.palette.divider,
          }),
          head: ({ theme }) => ({
            backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
            color: theme.palette.text.secondary,
          }),
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: ({ theme }) => ({
            '&:hover': {
              backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : '#F5F9FF',
            },
          }),
        },
      },
    },
  });
}

export const lightTheme = getShieldTheme('light');
export const darkTheme = getShieldTheme('dark');

// Keep legacy export for any remaining references
export const shieldTheme = lightTheme;

export const animations = {
  fadeInUp: '@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }',
  fadeIn: '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }',
  pulse: '@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }',
  slideInLeft: '@keyframes slideInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }',
  shimmer: '@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }',
} as const;

export const gradients = {
  blue: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
  green: 'linear-gradient(135deg, #43A047 0%, #2E7D32 100%)',
  orange: 'linear-gradient(135deg, #FB8C00 0%, #E65100 100%)',
  red: 'linear-gradient(135deg, #E53935 0%, #B71C1C 100%)',
  purple: 'linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%)',
  teal: 'linear-gradient(135deg, #00897B 0%, #004D40 100%)',
  dark: 'linear-gradient(135deg, #1A237E 0%, #0D1B2A 100%)',
} as const;
