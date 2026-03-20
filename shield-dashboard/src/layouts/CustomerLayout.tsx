import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, List, ListItemIcon,
  ListItemText, ListItemButton, Typography, IconButton, Badge,
  Avatar, Menu, MenuItem, Divider, Tooltip, useTheme, useMediaQuery,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MapIcon from '@mui/icons-material/Map';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FenceIcon from '@mui/icons-material/Fence';
import HistoryIcon from '@mui/icons-material/History';
import PsychologyIcon from '@mui/icons-material/Psychology';
import DevicesIcon from '@mui/icons-material/Devices';
import PhonelinkSetupIcon from '@mui/icons-material/PhonelinkSetup';
import MenuIcon from '@mui/icons-material/Menu';
import ShieldIcon from '@mui/icons-material/Shield';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuthStore } from '../store/auth.store';
import { useAlertStore } from '../store/alert.store';
import { useThemeStore } from '../store/theme.store';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import LanguageSwitcher from '../components/LanguageSwitcher';

const DRAWER_EXPANDED = 240;
const DRAWER_COLLAPSED = 56;

const BG = '#0C1A2E';
const BG_HOVER = 'rgba(255,255,255,0.06)';
const BG_SELECTED = '#1A3A6E';
const ACCENT = '#60A5FA';

const sections = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
      { label: 'Map', icon: <MapIcon />, path: '/map' },
    ],
  },
  {
    title: 'Controls',
    items: [
      { label: 'App & Content Control', icon: <PhonelinkSetupIcon />, path: '/app-control' },
      { label: 'Time Limits', icon: <AccessTimeIcon />, path: '/time-limits' },
      { label: 'Geofences', icon: <FenceIcon />, path: '/geofences' },
      { label: 'Devices', icon: <DevicesIcon />, path: '/devices' },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { label: 'Location History', icon: <HistoryIcon />, path: '/location-history' },
      { label: 'AI Insights', icon: <PsychologyIcon />, path: '/ai-insights' },
      { label: 'Alerts', icon: <NotificationsIcon />, path: '/alerts' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Subscription', icon: <CardMembershipIcon />, path: '/subscription' },
      { label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
    ],
  },
];

export default function CustomerLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const { user, logout } = useAuthStore();
  const unreadCount = useAlertStore((s) => s.unreadCount);
  const { mode: themeMode, toggle: toggleTheme } = useThemeStore();
  useRealtimeSync();

  const drawerWidth = collapsed && !isMobile ? DRAWER_COLLAPSED : DRAWER_EXPANDED;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const drawer = (
    <Box sx={{
      height: '100%', bgcolor: BG, color: 'white',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <Box sx={{
        px: collapsed && !isMobile ? 1 : 2.5,
        py: 2,
        display: 'flex',
        alignItems: 'center',
        gap: collapsed && !isMobile ? 0 : 1.5,
        minHeight: 64,
        background: 'linear-gradient(135deg, #0C1A2E 0%, #162544 100%)',
        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
      }}>
        <ShieldIcon sx={{ color: ACCENT, fontSize: 26, flexShrink: 0 }} />
        {(!collapsed || isMobile) && (
          <Box>
            <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.3 }}>
              Shield
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Family Dashboard
            </Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* Scrollable nav */}
      <Box sx={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
      }}>
        <List disablePadding sx={{ px: collapsed && !isMobile ? 0.5 : 1 }}>
          {sections.map((section, si) => (
            <Box key={section.title}>
              {si > 0 && <Box sx={{ my: 1, mx: 1 }}><Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} /></Box>}
              {(!collapsed || isMobile) && (
                <Typography variant="overline" sx={{
                  px: 2, py: 0.5, display: 'block',
                  color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700,
                  letterSpacing: 1.5,
                }}>
                  {section.title}
                </Typography>
              )}
              {section.items.map((item) => {
                const active = isActive(item.path);
                const isAlerts = item.path === '/alerts';
                const btn = (
                  <ListItemButton
                    key={item.label}
                    selected={active}
                    onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false); }}
                    sx={{
                      borderRadius: '8px',
                      mb: 0.25,
                      minHeight: 40,
                      px: collapsed && !isMobile ? 1 : 1.5,
                      justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                      color: active ? ACCENT : 'rgba(255,255,255,0.6)',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.18s ease',
                      '&::before': {
                        content: '""',
                        position: 'absolute', left: 0, top: '20%',
                        width: 3, height: active ? '60%' : 0,
                        bgcolor: ACCENT, borderRadius: '0 3px 3px 0',
                        transition: 'height 0.2s ease',
                      },
                      '&.Mui-selected': {
                        bgcolor: BG_SELECTED,
                        color: ACCENT,
                        '& .MuiListItemIcon-root': { color: ACCENT },
                      },
                      '&.Mui-selected:hover': { bgcolor: BG_SELECTED },
                      '&:hover': {
                        bgcolor: BG_HOVER,
                        '& .MuiListItemIcon-root': { transform: 'scale(1.15)' },
                      },
                      '& .MuiListItemIcon-root': { transition: 'transform 0.18s ease' },
                    }}
                  >
                    <ListItemIcon sx={{
                      color: 'inherit',
                      minWidth: collapsed && !isMobile ? 0 : 36,
                      mr: collapsed && !isMobile ? 0 : 1,
                      justifyContent: 'center',
                    }}>
                      {isAlerts && unreadCount > 0 ? (
                        <Badge badgeContent={unreadCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: 9, minWidth: 16, height: 16 } }}>
                          {item.icon}
                        </Badge>
                      ) : item.icon}
                    </ListItemIcon>
                    {(!collapsed || isMobile) && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: 13.5, fontWeight: active ? 600 : 500 }}
                        secondary={isAlerts && unreadCount > 0 ? `${unreadCount} unread` : undefined}
                        secondaryTypographyProps={{ fontSize: 10.5, color: '#F87171' }}
                      />
                    )}
                  </ListItemButton>
                );

                return collapsed && !isMobile ? (
                  <Tooltip
                    key={item.label}
                    title={isAlerts && unreadCount > 0 ? `${item.label} (${unreadCount} unread)` : item.label}
                    placement="right"
                    arrow
                  >
                    <Box>{btn}</Box>
                  </Tooltip>
                ) : (
                  <Box key={item.label}>{btn}</Box>
                );
              })}
            </Box>
          ))}
        </List>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* User section */}
      <Box sx={{
        px: collapsed && !isMobile ? 0.5 : 1.5,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: collapsed && !isMobile ? 0 : 1.5,
        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
      }}>
        {collapsed && !isMobile ? (
          <Tooltip title={`${user?.name ?? ''} — Sign out`} placement="right" arrow>
            <Avatar
              sx={{ width: 32, height: 32, bgcolor: ACCENT, color: BG, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              onClick={() => { logout(); navigate('/login'); }}
            >
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </Avatar>
          </Tooltip>
        ) : (
          <>
            <Avatar sx={{ width: 32, height: 32, bgcolor: ACCENT, color: BG, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: 12.5, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name ?? 'User'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                {user?.email ?? ''}
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton size="small" onClick={() => { logout(); navigate('/login'); }} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#F87171' } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {/* Collapse toggle */}
      {!isMobile && (
        <>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />
          <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', px: 1, py: 0.75 }}>
            <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
              <IconButton
                size="small"
                onClick={() => setCollapsed(c => !c)}
                sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: ACCENT, bgcolor: BG_HOVER } }}
              >
                {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 }, transition: 'width 0.25s ease' }}>
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: DRAWER_EXPANDED, border: 'none' } }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': {
                width: drawerWidth,
                border: 'none',
                transition: 'width 0.25s ease',
                overflowX: 'hidden',
              },
            }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, transition: 'all 0.25s ease' }}>
        <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar sx={{ minHeight: 56 }}>
            {isMobile && (
              <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <LanguageSwitcher />
            <IconButton onClick={toggleTheme} aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} sx={{ mr: 0.5 }}>
              {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            <IconButton onClick={() => navigate('/alerts')} aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}>
              <Badge badgeContent={unreadCount} color="error"><NotificationsIcon /></Badge>
            </IconButton>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="User menu" sx={{ ml: 0.5 }}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#1565C0', fontSize: 14, fontWeight: 700 }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem disabled><Typography variant="body2" fontWeight={600}>{user?.name}</Typography></MenuItem>
          <MenuItem disabled><Typography variant="body2" color="text.secondary" fontSize={12}>{user?.email}</Typography></MenuItem>
          <Divider />
          <MenuItem onClick={() => { navigate('/settings'); setAnchorEl(null); }}>Settings</MenuItem>
          <MenuItem onClick={() => { logout(); navigate('/login'); }} sx={{ color: 'error.main' }}>Sign out</MenuItem>
        </Menu>
        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
