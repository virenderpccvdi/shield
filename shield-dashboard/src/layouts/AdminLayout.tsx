import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography, Divider, AppBar, Toolbar, IconButton, Avatar, Menu, MenuItem } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import DnsIcon from '@mui/icons-material/Dns';
import BarChartIcon from '@mui/icons-material/BarChart';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import ShieldIcon from '@mui/icons-material/Shield';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import HistoryIcon from '@mui/icons-material/History';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import DevicesIcon from '@mui/icons-material/Devices';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import { useAuthStore } from '../store/auth.store';
import LanguageSwitcher from '../components/LanguageSwitcher';

const DRAWER_WIDTH = 240;

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user, logout } = useAuthStore();

  const sections = [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', icon: <DashboardIcon />, path: '/admin/dashboard' },
        { label: 'Analytics', icon: <BarChartIcon />, path: '/admin/analytics' },
      ],
    },
    {
      title: 'Management',
      items: [
        { label: 'Tenants', icon: <BusinessIcon />, path: '/admin/tenants' },
        { label: 'Users', icon: <PeopleIcon />, path: '/admin/users' },
        { label: 'Plans', icon: <CardMembershipIcon />, path: '/admin/plans' },
        { label: 'Devices', icon: <DevicesIcon />, path: '/admin/devices' },
        { label: 'Child Profiles', icon: <ChildCareIcon />, path: '/admin/child-profiles' },
        { label: 'DNS Rules', icon: <DnsIcon />, path: '/admin/dns-rules' },
      ],
    },
    {
      title: 'System',
      items: [
        { label: 'Services', icon: <MonitorHeartIcon />, path: '/admin/health' },
        { label: 'Notifications', icon: <NotificationsIcon />, path: '/admin/notifications' },
        { label: 'Invoices', icon: <ReceiptLongIcon />, path: '/admin/invoices' },
        { label: 'Audit Log', icon: <HistoryIcon />, path: '/admin/audit-logs' },
        { label: 'Settings', icon: <SettingsIcon />, path: '/admin/settings' },
      ],
    },
  ];
  const items = sections.flatMap(s => s.items);

  const drawer = (
    <Box sx={{ height: '100%', bgcolor: '#1A237E', color: 'white' }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5, background: 'linear-gradient(135deg, #1A237E 0%, #283593 100%)' }}>
        <ShieldIcon sx={{ color: '#90CAF9', fontSize: 28 }} />
        <Box><Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 700, lineHeight: 1.2 }}>Shield</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Global Admin</Typography></Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <List sx={{ px: 1, mt: 1 }}>
        {sections.map((section, si) => (
          <Box key={section.title}>
            {si > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 1 }} />}
            <Typography variant="overline" sx={{ px: 2, color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: 1.2 }}>{section.title}</Typography>
            {section.items.map((item) => (
          <ListItemButton key={item.label} selected={location.pathname === item.path || location.pathname.startsWith(item.path + '/')} onClick={() => navigate(item.path)}
            sx={{
              borderRadius: 2, mb: 0.5, color: 'rgba(255,255,255,0.7)',
              position: 'relative', overflow: 'hidden',
              transition: 'all 0.2s ease',
              '&::before': {
                content: '""', position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                width: 3, height: 0, bgcolor: '#90CAF9', borderRadius: '0 2px 2px 0',
                transition: 'height 0.2s ease',
              },
              '&.Mui-selected': {
                bgcolor: 'rgba(144,202,249,0.2)', color: '#90CAF9',
                '& .MuiListItemIcon-root': { color: '#90CAF9' },
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
          </Box>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <a href="#main-content" style={{ position: 'absolute', left: '-9999px', zIndex: 9999, padding: '8px 16px', background: '#1A237E', color: '#fff', textDecoration: 'none', fontSize: 14 }}
        onFocus={(e) => { e.currentTarget.style.left = '8px'; e.currentTarget.style.top = '8px'; }}
        onBlur={(e) => { e.currentTarget.style.left = '-9999px'; }}>
        Skip to main content
      </a>
      <Drawer variant="permanent" sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}>{drawer}</Drawer>
      <Box sx={{ flexGrow: 1, ml: `${DRAWER_WIDTH}px` }}>
        <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #E8EDF2' }}>
          <Toolbar>
            <Box sx={{ flexGrow: 1 }} />
            <LanguageSwitcher />
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="User menu">
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#1A237E', fontSize: 14 }}>{user?.name?.charAt(0)?.toUpperCase()}</Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem onClick={() => { navigate('/admin/settings'); setAnchorEl(null); }}>Settings</MenuItem>
          <MenuItem onClick={() => { logout(); navigate('/login'); }} sx={{ color: 'error.main' }}>Sign out</MenuItem>
        </Menu>
        <Box component="main" id="main-content" sx={{ p: 3 }}><Outlet /></Box>
      </Box>
    </Box>
  );
}
