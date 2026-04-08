import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, AppBar, Toolbar, IconButton, Avatar, Menu,
  MenuItem, Tooltip, useMediaQuery, useTheme, Collapse, InputBase, Badge, Chip,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PersonIcon from '@mui/icons-material/Person';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { alpha } from '@mui/material/styles';
import { brand } from '../theme/theme';

const DRAWER_EXPANDED = 240;
const DRAWER_COLLAPSED = 56;


const sections = [
  {
    title: 'Overview', color: '#1565C0',
    items: [
      { label: 'ISP Dashboard', icon: <DashboardIcon />, path: '/isp/dashboard', color: '#1565C0' },
      { label: 'Live Dashboard', icon: <MonitorIcon />, path: '/isp/live-dashboard', color: '#0288D1' },
      { label: 'Alerts', icon: <NotificationsActiveIcon />, path: '/isp/alerts', color: '#D32F2F' },
      { label: 'Analytics', icon: <BarChartIcon />, path: '/isp/analytics', color: '#388E3C' },
      { label: 'Reports', icon: <AssessmentIcon />, path: '/isp/reports', color: '#7B1FA2' },
      { label: 'URL Activity', icon: <TimelineIcon />, path: '/isp/url-activity', color: '#E65100' },
      { label: 'AI Insights', icon: <PsychologyIcon />, path: '/isp/ai-insights', color: '#4527A0' },
      { label: 'Export Data', icon: <FileDownloadIcon />, path: '/isp/analytics-export', color: '#00838F' },
    ],
  },
  {
    title: 'Customers', color: '#AD1457',
    items: [
      { label: 'Customers', icon: <PeopleIcon />, path: '/isp/customers', color: '#AD1457' },
      { label: 'Bulk Import', icon: <GroupAddIcon />, path: '/isp/customers/import', color: '#C62828' },
      { label: 'My Plan', icon: <TuneIcon />, path: '/isp/my-plan', color: '#1A237E' },
      { label: 'Customer Plans', icon: <CardMembershipIcon />, path: '/isp/plans', color: '#0277BD' },
      { label: 'App Control', icon: <PhonelinkSetupIcon />, path: '/isp/app-control', color: '#6A1B9A' },
      { label: 'Devices', icon: <DevicesIcon />, path: '/isp/devices', color: '#37474F' },
      { label: 'Child Profiles', icon: <ChildCareIcon />, path: '/isp/child-profiles', color: '#BF360C' },
      { label: 'Communications', icon: <CampaignIcon />, path: '/isp/communications', color: '#F57F17' },
      { label: 'Branding', icon: <BrushIcon />, path: '/isp/branding', color: '#2E7D32' },
    ],
  },
  {
    title: 'Filtering & Security', color: '#E65100',
    items: [
      { label: 'DNS Filtering', icon: <DnsIcon />, path: '/isp/filtering', color: '#00695C' },
      { label: 'Blocklist', icon: <BlockIcon />, path: '/isp/blocklist', color: '#B71C1C' },
      { label: 'Billing', icon: <PaymentIcon />, path: '/isp/billing', color: '#1565C0' },
      { label: 'Settings', icon: <SettingsIcon />, path: '/isp/settings', color: '#455A64' },
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

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(sections.map(s => [s.title, true]))
  );
  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const drawerWidth = collapsed && !isMobile ? DRAWER_COLLAPSED : DRAWER_EXPANDED;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const drawer = (
    <Box sx={{
      height: '100%',
      background: brand.primaryDark,
      color: '#fff',
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
        bgcolor: brand.primaryDark,
        borderBottom: '1px solid',
        borderColor: 'rgba(255,255,255,0.12)',
        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
      }}>
        <ShieldIcon sx={{ color: '#BFDBFE', fontSize: 26, flexShrink: 0 }} />
        {(!collapsed || isMobile) && (
          <Box>
            <Typography variant="subtitle1" sx={{ color: '#FFFFFF', fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.3 }}>
              Shield ISP
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Partner Portal
            </Typography>
          </Box>
        )}
      </Box>

      {/* Scrollable nav */}
      <Box sx={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1,
        bgcolor: brand.bg,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: brand.border, borderRadius: 2 },
      }}>
        <List disablePadding sx={{ px: collapsed && !isMobile ? 0.5 : 1 }}>
          {sections.map((section, si) => {
            const isExpanded = expandedSections[section.title] ?? true;
            return (
              <Box key={section.title}>
                {si > 0 && <Box sx={{ my: 0.5, mx: 1 }}><Divider sx={{ borderColor: brand.border }} /></Box>}
                {(!collapsed || isMobile) && (
                  <Box
                    onClick={() => toggleSection(section.title)}
                    sx={{
                      px: 2, py: 0.5,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', borderRadius: 1, mx: 0.5,
                      '&:hover': { bgcolor: alpha(brand.primary, 0.05) },
                    }}
                  >
                    <Typography variant="overline" sx={{
                      color: brand.subtle, fontSize: 10, fontWeight: 700,
                      letterSpacing: 1.5, lineHeight: 1.8,
                    }}>
                      {section.title}
                    </Typography>
                    <Box sx={{ color: brand.subtle, display: 'flex', alignItems: 'center' }}>
                      {isExpanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
                    </Box>
                  </Box>
                )}
                <Collapse in={collapsed || isMobile ? true : isExpanded} timeout={150}>
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
                          color: brand.muted,
                          position: 'relative',
                          overflow: 'hidden',
                          transition: 'all 0.18s ease',
                          '&::before': {
                            content: '""',
                            position: 'absolute', left: 0, top: '20%',
                            width: 3, height: active ? '60%' : 0,
                            bgcolor: '#2563EB', borderRadius: '0 3px 3px 0',
                            transition: 'height 0.2s ease',
                          },
                          '&.Mui-selected': {
                            bgcolor: brand.primaryChip,
                            color: brand.primaryDark,
                            '& .MuiListItemIcon-root': { color: brand.primaryDark },
                            '&:hover': { bgcolor: '#BFDBFE' },
                          },
                          '&:hover': {
                            bgcolor: '#EFF6FF',
                            color: brand.primaryDark,
                            '& .MuiListItemIcon-root': { color: brand.primaryDark },
                          },
                          '& .MuiListItemIcon-root': { color: brand.muted, transition: 'color 0.16s' },
                        }}
                      >
                        <ListItemIcon sx={{
                          color: active ? brand.primaryDark : brand.muted,
                          minWidth: collapsed && !isMobile ? 0 : 36,
                          mr: collapsed && !isMobile ? 0 : 1,
                          justifyContent: 'center',
                        }}>
                          {item.icon}
                        </ListItemIcon>
                        {(!collapsed || isMobile) && (
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{ fontSize: 13.5, fontWeight: active ? 700 : 500, color: 'inherit' }}
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
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ borderColor: brand.border }} />

      {/* User section */}
      <Box sx={{
        px: collapsed && !isMobile ? 0.5 : 1.5,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: collapsed && !isMobile ? 0 : 1.5,
        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
        bgcolor: brand.card,
        borderTop: `1px solid ${brand.border}`,
      }}>
        {collapsed && !isMobile ? (
          <Tooltip title={`${user?.name ?? ''} — Sign out`} placement="right" arrow>
            <Avatar
              sx={{ width: 32, height: 32, bgcolor: brand.primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              onClick={() => { logout(); navigate('/login'); }}
            >
              {user?.name?.charAt(0)?.toUpperCase() ?? 'I'}
            </Avatar>
          </Tooltip>
        ) : (
          <>
            <Avatar sx={{ width: 32, height: 32, bgcolor: brand.primary, color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {user?.name?.charAt(0)?.toUpperCase() ?? 'I'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ color: brand.text, fontWeight: 600, fontSize: 12.5, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name ?? 'ISP Admin'}
              </Typography>
              <Typography variant="caption" sx={{ color: brand.muted, fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                {user?.email ?? ''}
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton size="small" onClick={() => { logout(); navigate('/login'); }} sx={{ color: brand.muted, '&:hover': { color: brand.danger } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {/* Collapse toggle */}
      {!isMobile && (
        <>
          <Divider sx={{ borderColor: brand.border }} />
          <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', px: 1, py: 0.75, bgcolor: brand.card }}>
            <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
              <IconButton
                size="small"
                onClick={() => setCollapsed(c => !c)}
                sx={{ color: brand.subtle, '&:hover': { color: brand.primary, bgcolor: alpha(brand.primary, 0.07) } }}
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
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_EXPANDED, boxSizing: 'border-box', border: 'none', background: brand.primaryDark } }}
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
              background: brand.primaryDark,
            },
          }}
        >
          {drawer}
        </Drawer>
      )}

      <Box sx={{ flexGrow: 1, ml: isMobile ? 0 : `${drawerWidth}px`, transition: 'margin-left 0.25s ease' }}>
        <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: brand.border, backdropFilter: 'blur(8px)', bgcolor: brand.card }}>
          <Toolbar sx={{ minHeight: 60, gap: 0.5, px: { xs: 1.5, md: 2.5 } }}>
            {isMobile && (
              <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open navigation" sx={{ mr: 0.5 }}>
                <MenuIcon />
              </IconButton>
            )}

            {/* Search bar */}
            <Box className="search-bar" sx={{ display: { xs: 'none', sm: 'flex' }, mr: 1, width: { sm: 180, md: 260 } }}>
              <SearchIcon sx={{ fontSize: 17, color: 'text.disabled', flexShrink: 0 }} />
              <InputBase
                placeholder="Search…"
                inputProps={{ 'aria-label': 'global search' }}
                sx={{ fontSize: 13.5, flex: 1 }}
              />
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            <Tooltip title="Help & docs">
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <LanguageSwitcher />

            <Tooltip title={themeMode === 'dark' ? 'Light mode' : 'Dark mode'}>
              <IconButton size="small" onClick={toggleTheme} aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                {themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Notifications">
              <IconButton size="small" onClick={() => navigate('/isp/alerts')} aria-label="Notifications">
                <Badge badgeContent={0} color="error" variant="dot">
                  <NotificationsIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* User button */}
            <Box
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, ml: 0.5, px: 1, py: 0.5,
                borderRadius: 2, cursor: 'pointer', border: '1px solid',
                borderColor: 'divider', transition: 'all 0.15s ease',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 12, fontWeight: 700 }}>
                {user?.name?.charAt(0)?.toUpperCase() ?? 'I'}
              </Avatar>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Typography variant="body2" sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2, color: 'text.primary' }}>
                  {user?.name ?? 'ISP Admin'}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: 10.5, color: 'text.secondary', lineHeight: 1 }}>
                  ISP Admin
                </Typography>
              </Box>
            </Box>
          </Toolbar>
        </AppBar>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{ elevation: 4, sx: { minWidth: 220, mt: 0.5 } }}
        >
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontSize: 16, fontWeight: 700 }}>
              {user?.name?.charAt(0)?.toUpperCase() ?? 'I'}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }}>{user?.name ?? 'ISP Admin'}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>{user?.email ?? ''}</Typography>
              <Chip label="ISP Admin" size="small" sx={{ mt: 0.5, height: 18, fontSize: 10, fontWeight: 600 }} color="primary" />
            </Box>
          </Box>
          <Divider />
          <MenuItem onClick={() => { navigate('/isp/settings'); setAnchorEl(null); }} sx={{ gap: 1.5, py: 1 }}>
            <PersonIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="body2">Profile & Settings</Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { logout(); navigate('/login'); }} sx={{ color: 'error.main', gap: 1.5, py: 1 }}>
            <LogoutIcon fontSize="small" />
            <Typography variant="body2">Sign out</Typography>
          </MenuItem>
        </Menu>
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
