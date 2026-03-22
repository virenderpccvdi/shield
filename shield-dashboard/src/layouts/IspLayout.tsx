import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, AppBar, Toolbar, IconButton, Avatar, Menu,
  MenuItem, Tooltip, useMediaQuery, useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MonitorIcon from '@mui/icons-material/Monitor';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PeopleIcon from '@mui/icons-material/People';
import BrushIcon from '@mui/icons-material/Brush';
import CampaignIcon from '@mui/icons-material/Campaign';
import BarChartIcon from '@mui/icons-material/BarChart';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TimelineIcon from '@mui/icons-material/Timeline';
import PhonelinkSetupIcon from '@mui/icons-material/PhonelinkSetup';
import DevicesIcon from '@mui/icons-material/Devices';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import PaymentIcon from '@mui/icons-material/Payment';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import TuneIcon from '@mui/icons-material/Tune';
import BlockIcon from '@mui/icons-material/Block';
import DnsIcon from '@mui/icons-material/Dns';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ShieldIcon from '@mui/icons-material/Shield';
import SettingsIcon from '@mui/icons-material/Settings';
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
      { label: 'ISP Dashboard', icon: <DashboardIcon />, path: '/isp/dashboard' },
      { label: 'Live Dashboard', icon: <MonitorIcon />, path: '/isp/live-dashboard' },
      { label: 'Alerts', icon: <NotificationsActiveIcon />, path: '/isp/alerts' },
      { label: 'Analytics', icon: <BarChartIcon />, path: '/isp/analytics' },
      { label: 'Reports', icon: <AssessmentIcon />, path: '/isp/reports' },
      { label: 'URL Activity', icon: <TimelineIcon />, path: '/isp/url-activity' },
      { label: 'AI Insights', icon: <PsychologyIcon />, path: '/isp/ai-insights' },
      { label: 'Export Data', icon: <FileDownloadIcon />, path: '/isp/analytics-export' },
    ],
  },
  {
    title: 'Customers',
    items: [
      { label: 'Customers', icon: <PeopleIcon />, path: '/isp/customers' },
      { label: 'Bulk Import', icon: <GroupAddIcon />, path: '/isp/customers/import' },
      { label: 'My Plan', icon: <TuneIcon />, path: '/isp/my-plan' },
      { label: 'Customer Plans', icon: <CardMembershipIcon />, path: '/isp/plans' },
      { label: 'App Control', icon: <PhonelinkSetupIcon />, path: '/isp/app-control' },
      { label: 'Devices', icon: <DevicesIcon />, path: '/isp/devices' },
      { label: 'Child Profiles', icon: <ChildCareIcon />, path: '/isp/child-profiles' },
      { label: 'Communications', icon: <CampaignIcon />, path: '/isp/communications' },
      { label: 'Branding', icon: <BrushIcon />, path: '/isp/branding' },
    ],
  },
  {
    title: 'Filtering & Security',
    items: [
      { label: 'DNS Filtering', icon: <DnsIcon />, path: '/isp/filtering' },
      { label: 'Blocklist', icon: <BlockIcon />, path: '/isp/blocklist' },
      { label: 'Billing', icon: <PaymentIcon />, path: '/isp/billing' },
      { label: 'Settings', icon: <SettingsIcon />, path: '/isp/settings' },
    ],
  },
];

export default function IspLayout() {
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
              ISP Admin
            </Typography>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Scrollable nav */}
      <Box sx={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1,
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
              {user?.name?.charAt(0)?.toUpperCase() ?? 'I'}
            </Avatar>
          </Tooltip>
        ) : (
          <>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {user?.name?.charAt(0)?.toUpperCase() ?? 'I'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600, fontSize: 12.5, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name ?? 'ISP Admin'}
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

      {/* Collapse toggle */}
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
          <MenuItem onClick={() => { navigate('/isp/settings'); setAnchorEl(null); }}>Settings</MenuItem>
          <MenuItem onClick={() => { logout(); navigate('/login'); }} sx={{ color: 'error.main' }}>Sign out</MenuItem>
        </Menu>
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
