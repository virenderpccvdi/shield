import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography, Divider, AppBar, Toolbar, IconButton, Avatar, Menu, MenuItem } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import BrushIcon from '@mui/icons-material/Brush';
import BarChartIcon from '@mui/icons-material/BarChart';
import PaymentIcon from '@mui/icons-material/Payment';
import BlockIcon from '@mui/icons-material/Block';
import ShieldIcon from '@mui/icons-material/Shield';
import SettingsIcon from '@mui/icons-material/Settings';
import { useAuthStore } from '../store/auth.store';
import LanguageSwitcher from '../components/LanguageSwitcher';

const DRAWER_WIDTH = 240;

export default function IspLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user, logout } = useAuthStore();

  const items = [
    { label: 'ISP Dashboard', icon: <DashboardIcon />, path: '/isp/dashboard' },
    { label: 'Customers', icon: <PeopleIcon />, path: '/isp/customers' },
    { label: 'Branding', icon: <BrushIcon />, path: '/isp/branding' },
    { label: 'Analytics', icon: <BarChartIcon />, path: '/isp/analytics' },
    { label: 'Billing', icon: <PaymentIcon />, path: '/isp/billing' },
    { label: 'Blocklist', icon: <BlockIcon />, path: '/isp/blocklist' },
    { label: 'Settings', icon: <SettingsIcon />, path: '/isp/settings' },
  ];

  const drawer = (
    <Box sx={{ height: '100%', bgcolor: '#004D40', color: 'white' }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5, background: 'linear-gradient(135deg, #004D40 0%, #00695C 100%)' }}>
        <ShieldIcon sx={{ color: '#80CBC4', fontSize: 28 }} />
        <Box><Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700, lineHeight: 1.2 }}>Shield</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>ISP Admin</Typography></Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <List sx={{ px: 1, mt: 1 }}>
        {items.map((item) => (
          <ListItemButton key={item.label} selected={location.pathname === item.path} onClick={() => navigate(item.path)}
            sx={{
              borderRadius: 2, mb: 0.5, color: 'rgba(255,255,255,0.7)',
              position: 'relative', overflow: 'hidden',
              transition: 'all 0.2s ease',
              '&::before': {
                content: '""', position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                width: 3, height: 0, bgcolor: '#80CBC4', borderRadius: '0 2px 2px 0',
                transition: 'height 0.2s ease',
              },
              '&.Mui-selected': {
                bgcolor: 'rgba(128,203,196,0.2)', color: '#80CBC4',
                '& .MuiListItemIcon-root': { color: '#80CBC4' },
                '&::before': { height: '60%' },
              },
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.08)',
                '& .MuiListItemIcon-root': { transform: 'scale(1.15)', transition: 'transform 0.2s ease' },
              },
              '& .MuiListItemIcon-root': { transition: 'transform 0.2s ease' },
            }}>
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer variant="permanent" sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}>{drawer}</Drawer>
      <Box sx={{ flexGrow: 1, ml: `${DRAWER_WIDTH}px` }}>
        <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #E8EDF2' }}>
          <Toolbar>
            <Box sx={{ flexGrow: 1 }} />
            <LanguageSwitcher />
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#004D40', fontSize: 14 }}>{user?.name?.charAt(0)?.toUpperCase()}</Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem onClick={() => { navigate('/isp/settings'); setAnchorEl(null); }}>Settings</MenuItem>
          <MenuItem onClick={() => { logout(); navigate('/login'); }} sx={{ color: 'error.main' }}>Sign out</MenuItem>
        </Menu>
        <Box sx={{ p: 3 }}><Outlet /></Box>
      </Box>
    </Box>
  );
}
