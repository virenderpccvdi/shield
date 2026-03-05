import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, List, ListItem, ListItemIcon,
  ListItemText, ListItemButton, Typography, IconButton, Badge,
  Avatar, Menu, MenuItem, Divider, useTheme, useMediaQuery
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
import MenuIcon from '@mui/icons-material/Menu';
import ShieldIcon from '@mui/icons-material/Shield';
import { useAuthStore } from '../store/auth.store';
import { useAlertStore } from '../store/alert.store';
import LanguageSwitcher from '../components/LanguageSwitcher';

const DRAWER_WIDTH = 240;

const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { label: 'Time Limits', icon: <AccessTimeIcon />, path: '/time-limits' },
  { label: 'Geofences', icon: <FenceIcon />, path: '/geofences' },
  { label: 'Location History', icon: <HistoryIcon />, path: '/location-history' },
  { label: 'AI Insights', icon: <PsychologyIcon />, path: '/ai-insights' },
  { label: 'Devices', icon: <DevicesIcon />, path: '/devices' },
  { label: 'Map', icon: <MapIcon />, path: '/map' },
  { label: 'Alerts', icon: <NotificationsIcon />, path: '/alerts' },
  { label: 'Subscription', icon: <CardMembershipIcon />, path: '/subscription' },
  { label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

export default function CustomerLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuthStore();
  const unreadCount = useAlertStore((s) => s.unreadCount);

  const drawer = (
    <Box sx={{ height: '100%', bgcolor: '#0D1B2A', color: 'white', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5, background: 'linear-gradient(135deg, #0D1B2A 0%, #1B2A3D 100%)' }}>
        <ShieldIcon sx={{ color: '#4FC3F7', fontSize: 28 }} />
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, fontSize: 18 }}>Shield</Typography>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <List sx={{ px: 1, mt: 1, flex: 1 }}>
        {navItems.map((item) => (
          <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={location.pathname.startsWith(item.path)}
              onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false); }}
              sx={{
                borderRadius: 2,
                color: 'rgba(255,255,255,0.7)',
                position: 'relative', overflow: 'hidden',
                transition: 'all 0.2s ease',
                '&::before': {
                  content: '""', position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 0, bgcolor: '#4FC3F7', borderRadius: '0 2px 2px 0',
                  transition: 'height 0.2s ease',
                },
                '&.Mui-selected': {
                  bgcolor: 'rgba(79,195,247,0.15)', color: '#4FC3F7',
                  '& .MuiListItemIcon-root': { color: '#4FC3F7' },
                  '&::before': { height: '60%' },
                },
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '& .MuiListItemIcon-root': { transform: 'scale(1.15)', transition: 'transform 0.2s ease' },
                },
                '& .MuiListItemIcon-root': { transition: 'transform 0.2s ease' },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>Shield v1.0.0</Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isMobile ? (
          <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>
            {drawer}
          </Drawer>
        ) : (
          <Drawer variant="permanent" sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: 'none' } }}>
            {drawer}
          </Drawer>
        )}
      </Box>
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #E8EDF2', bgcolor: 'white' }}>
          <Toolbar sx={{ minHeight: 64 }}>
            {isMobile && <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" sx={{ mr: 2 }}><MenuIcon /></IconButton>}
            <Box sx={{ flexGrow: 1 }} />
            <LanguageSwitcher />
            <IconButton onClick={() => navigate('/alerts')} aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}>
              <Badge badgeContent={unreadCount} color="error"><NotificationsIcon /></Badge>
            </IconButton>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="User menu" sx={{ ml: 1 }}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#1565C0', fontSize: 14, fontWeight: 700 }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem disabled><Typography variant="body2" color="text.secondary">{user?.name}</Typography></MenuItem>
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
