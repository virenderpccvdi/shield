import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, AppBar, Toolbar, IconButton, Avatar, Menu,
  MenuItem, Tooltip, useMediaQuery, useTheme,
} from '@mui/material';
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
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import BlockIcon from '@mui/icons-material/Block';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import SecurityIcon from '@mui/icons-material/Security';
import TimelineIcon from '@mui/icons-material/Timeline';
import PhonelinkSetupIcon from '@mui/icons-material/PhonelinkSetup';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PublicIcon from '@mui/icons-material/Public';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';
import LanguageSwitcher from '../components/LanguageSwitcher';

const DRAWER_EXPANDED = 240;
const DRAWER_COLLAPSED = 56;


const sections = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', icon: <DashboardIcon />, path: '/admin/dashboard' },
      { label: 'Alerts', icon: <NotificationsActiveIcon />, path: '/admin/alerts' },
      { label: 'Analytics', icon: <BarChartIcon />, path: '/admin/analytics' },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Tenants', icon: <BusinessIcon />, path: '/admin/tenants' },
      { label: 'Customers', icon: <PeopleIcon />, path: '/admin/customers' },
      { label: 'Users', icon: <PeopleIcon />, path: '/admin/users' },
      { label: 'Plans', icon: <CardMembershipIcon />, path: '/admin/plans' },
      { label: 'Devices', icon: <DevicesIcon />, path: '/admin/devices' },
      { label: 'Child Profiles', icon: <ChildCareIcon />, path: '/admin/child-profiles' },
      { label: 'URL Activity', icon: <TimelineIcon />, path: '/admin/url-activity' },
      { label: 'App Control', icon: <PhonelinkSetupIcon />, path: '/admin/app-control' },
      { label: 'DNS Rules', icon: <DnsIcon />, path: '/admin/dns-rules' },
      { label: 'Global Blocklist', icon: <BlockIcon />, path: '/admin/blocklist' },
      { label: 'Features', icon: <ToggleOnIcon />, path: '/admin/features' },
      { label: 'Role Permissions', icon: <SecurityIcon />, path: '/admin/roles' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'AI Models', icon: <PsychologyIcon />, path: '/admin/ai-models' },
      { label: 'AI Insights', icon: <PsychologyIcon />, path: '/admin/ai-insights' },
      { label: 'Services', icon: <MonitorHeartIcon />, path: '/admin/health' },
      { label: 'Notifications', icon: <NotificationsIcon />, path: '/admin/notifications' },
      { label: 'Invoices', icon: <ReceiptLongIcon />, path: '/admin/invoices' },
      { label: 'Audit Log', icon: <HistoryIcon />, path: '/admin/audit-logs' },
      { label: 'CRM Leads', icon: <ContactMailIcon />, path: '/admin/leads' },
      { label: 'Visitors', icon: <PublicIcon />, path: '/admin/visitors' },
      { label: 'Platform Admin', icon: <AdminPanelSettingsIcon />, path: '/admin/platform' },
      { label: 'Settings', icon: <SettingsIcon />, path: '/admin/settings' },
    ],
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user, logout } = useAuthStore();
  const { mode: themeMode, toggle: toggleTheme } = useThemeStore();

  const drawerWidth = collapsed && !isMobile ? DRAWER_COLLAPSED : DRAWER_EXPANDED;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const drawer = (
    <Box sx={{
      height: '100%', bgcolor: 'background.paper', color: 'text.primary',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width 0.25s ease',
    }}>
      {/* Logo */}
      <Box sx={{
        px: collapsed && !isMobile ? 1 : 2.5,
        py: 2,
        display: 'flex',
        alignItems: 'center',
        gap: collapsed && !isMobile ? 0 : 1.5,
        minHeight: 64,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
      }}>
        <ShieldIcon sx={{ color: 'primary.main', fontSize: 26, flexShrink: 0 }} />
        {(!collapsed || isMobile) && (
          <Box>
            <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.3 }}>
              Shield
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Global Admin
            </Typography>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Scrollable nav */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
      }}>
        <List disablePadding sx={{ px: collapsed && !isMobile ? 0.5 : 1 }}>
          {sections.map((section, si) => (
            <Box key={section.title}>
              {si > 0 && <Box sx={{ my: 1, mx: 1 }}><Divider /></Box>}
              {(!collapsed || isMobile) && (
                <Typography variant="overline" sx={{
                  px: 2, py: 0.5, display: 'block',
                  color: 'text.disabled', fontSize: 10, fontWeight: 700,
                  letterSpacing: 1.5,
                }}>
                  {section.title}
                </Typography>
              )}
              {section.items.map((item) => {
                const active = isActive(item.path);
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
                      color: active ? 'primary.main' : 'text.secondary',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.18s ease',
                      '&::before': {
                        content: '""',
                        position: 'absolute', left: 0, top: '20%',
                        width: 3, height: active ? '60%' : 0,
                        bgcolor: 'primary.main', borderRadius: '0 3px 3px 0',
                        transition: 'height 0.2s ease',
                      },
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                      },
                      '&.Mui-selected:hover': { bgcolor: 'primary.dark' },
                      '&:hover': {
                        bgcolor: 'action.hover',
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
                      {item.icon}
                    </ListItemIcon>
                    {(!collapsed || isMobile) && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: 13.5, fontWeight: active ? 600 : 500 }}
                      />
                    )}
                  </ListItemButton>
                );

                return collapsed && !isMobile ? (
                  <Tooltip key={item.label} title={item.label} placement="right" arrow>
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

      <Divider />

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
              sx={{ width: 32, height: 32, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              onClick={() => { logout(); navigate('/login'); }}
            >
              {user?.name?.charAt(0)?.toUpperCase() ?? 'A'}
            </Avatar>
          </Tooltip>
        ) : (
          <>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {user?.name?.charAt(0)?.toUpperCase() ?? 'A'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600, fontSize: 12.5, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name ?? 'Admin'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                {user?.email ?? ''}
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton size="small" onClick={() => { logout(); navigate('/login'); }} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {/* Collapse toggle — only on desktop */}
      {!isMobile && (
        <>
          <Divider />
          <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', px: 1, py: 0.75 }}>
            <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
              <IconButton
                size="small"
                onClick={() => setCollapsed(c => !c)}
                sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main', bgcolor: 'action.hover' } }}
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
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <a href="#main-content" style={{
        position: 'absolute', left: '-9999px', zIndex: 9999,
        padding: '8px 16px', background: 'var(--mui-palette-background-paper, #0F172A)', color: 'var(--mui-palette-text-primary, #fff)',
        textDecoration: 'none', fontSize: 14,
      }}
        onFocus={(e) => { e.currentTarget.style.left = '8px'; e.currentTarget.style.top = '8px'; }}
        onBlur={(e) => { e.currentTarget.style.left = '-9999px'; }}>
        Skip to main content
      </a>

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_EXPANDED, boxSizing: 'border-box', border: 'none' } }}
        >
          {drawer}
        </Drawer>
      )}

      {/* Desktop drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              border: 'none',
              transition: 'width 0.25s ease',
              overflowX: 'hidden',
            },
          }}
        >
          {drawer}
        </Drawer>
      )}

      <Box sx={{ flexGrow: 1, ml: isMobile ? 0 : `${drawerWidth}px`, transition: 'margin-left 0.25s ease' }}>
        <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar sx={{ minHeight: 56 }}>
            {isMobile && (
              <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open navigation" sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <LanguageSwitcher />
            <IconButton onClick={toggleTheme} aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} sx={{ mr: 0.5 }}>
              {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="User menu">
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700 }}>
                {user?.name?.charAt(0)?.toUpperCase()}
              </Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem disabled>
            <Typography variant="body2" fontWeight={600}>{user?.name}</Typography>
          </MenuItem>
          <MenuItem disabled>
            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { navigate('/admin/settings'); setAnchorEl(null); }}>Settings</MenuItem>
          <MenuItem onClick={() => { logout(); navigate('/login'); }} sx={{ color: 'error.main' }}>Sign out</MenuItem>
        </Menu>
        <Box component="main" id="main-content" sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
