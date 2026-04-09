import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, List, ListItemIcon,
  ListItemText, ListItemButton, Typography, IconButton, Badge,
  Avatar, Menu, MenuItem, Divider, Tooltip, useTheme, useMediaQuery,
  Collapse, InputBase, Chip, Paper,
} from '@mui/material';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MapIcon from '@mui/icons-material/Map';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SettingsIcon from '@mui/icons-material/Settings';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FenceIcon from '@mui/icons-material/Fence';
import HistoryIcon from '@mui/icons-material/History';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DevicesIcon from '@mui/icons-material/Devices';
import PhonelinkSetupIcon from '@mui/icons-material/PhonelinkSetup';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import SchoolIcon from '@mui/icons-material/School';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TimerIcon from '@mui/icons-material/Timer';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import MenuIcon from '@mui/icons-material/Menu';
import ShieldIcon from '@mui/icons-material/Shield';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import ContactEmergencyIcon from '@mui/icons-material/ContactEmergency';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import NightlightIcon from '@mui/icons-material/Nightlight';
import GavelIcon from '@mui/icons-material/Gavel';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import DnsIcon from '@mui/icons-material/Dns';
import ScheduleIcon from '@mui/icons-material/Schedule';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PersonIcon from '@mui/icons-material/Person';
import { useAuthStore } from '../store/auth.store';
import { useAlertStore } from '../store/alert.store';
import { useThemeStore } from '../store/theme.store';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { alpha } from '@mui/material/styles';
import { brand } from '../theme/theme';

const DRAWER_EXPANDED = 260;
const DRAWER_COLLAPSED = 68;


const sections = [
  {
    title: 'Overview', color: '#1565C0',
    items: [
      { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', color: '#1565C0' },
    ],
  },
  {
    title: 'DNS & Filtering', color: '#6A1B9A',
    items: [
      { label: 'Content Filter', icon: <PhonelinkSetupIcon />, path: '/app-control', color: '#6A1B9A' },
      { label: 'Homework Mode', icon: <SchoolIcon />, path: '/homework', color: '#2E7D32' },
      { label: 'Bedtime Lock', icon: <NightlightIcon />, path: '/bedtime', color: '#1A237E' },
      { label: 'Access Schedule', icon: <ScheduleIcon />, path: '/access-schedule', color: '#0288D1' },
      { label: 'Safe Filters', icon: <VerifiedUserIcon />, path: '/safe-filters', color: '#00695C' },
      { label: 'Browsing History', icon: <DnsIcon />, path: '/browsing-history', color: '#4527A0' },
    ],
  },
  {
    title: 'Time & Limits', color: '#E65100',
    items: [
      { label: 'Time Limits', icon: <AccessTimeIcon />, path: '/time-limits', color: '#E65100' },
      { label: 'App Budgets', icon: <TimerIcon />, path: '/app-budgets', color: '#BF360C' },
      { label: 'Approval Requests', icon: <CheckCircleOutlineIcon />, path: '/approvals', color: '#F57F17' },
    ],
  },
  {
    title: 'Location & Safety', color: '#00695C',
    items: [
      { label: 'Location', icon: <MapIcon />, path: '/map', color: '#00897B' },
      { label: 'Location History', icon: <HistoryIcon />, path: '/location-history', color: '#2E7D32' },
      { label: 'Geofences', icon: <FenceIcon />, path: '/geofences', color: '#00838F' },
      { label: 'Battery Alerts', icon: <BatteryAlertIcon />, path: '/battery-alerts', color: '#F9A825' },
      { label: 'Emergency Contacts', icon: <ContactEmergencyIcon />, path: '/emergency-contacts', color: '#C62828' },
    ],
  },
  {
    title: 'Family', color: '#AD1457',
    items: [
      { label: 'Child Profiles', icon: <ChildCareIcon />, path: '/profiles', color: '#AD1457' },
      { label: 'Family Rules', icon: <GavelIcon />, path: '/family-rules', color: '#7B1FA2' },
      { label: 'Co-Parent', icon: <SupervisorAccountIcon />, path: '/co-parent', color: '#4A148C' },
      { label: 'Family Members', icon: <GroupAddIcon />, path: '/family-members', color: '#0D47A1' },
      { label: 'Achievements', icon: <EmojiEventsIcon />, path: '/achievements', color: '#FF6F00' },
    ],
  },
  {
    title: 'Reports & AI', color: '#0277BD',
    items: [
      { label: 'Suspicious Activity', icon: <ReportProblemIcon />, path: '/suspicious-activity', color: '#B71C1C' },
      { label: 'App Usage', icon: <QueryStatsIcon />, path: '/app-usage', color: '#1B5E20' },
      { label: 'Safe Filters Report', icon: <SmartToyIcon />, path: '/safe-filters-report', color: '#2E7D32' },
      { label: 'AI Insights', icon: <PsychologyIcon />, path: '/ai-insights', color: '#4527A0' },
    ],
  },
  {
    title: 'Account', color: '#37474F',
    items: [
      { label: 'Devices', icon: <DevicesIcon />, path: '/devices', color: '#455A64' },
      { label: 'Alerts', icon: <NotificationsIcon />, path: '/alerts', color: '#D32F2F' },
      { label: 'Subscription', icon: <CardMembershipIcon />, path: '/subscription', color: '#1565C0' },
      { label: 'Settings', icon: <SettingsIcon />, path: '/settings', color: '#37474F' },
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

  const [bottomNav, setBottomNav] = useState(0);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(sections.map(s => [s.title, true]))
  );
  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const drawerWidth = collapsed && !isMobile ? DRAWER_COLLAPSED : DRAWER_EXPANDED;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const isDark = muiTheme.palette.mode === 'dark';

  const sidebarBg    = isDark ? '#1E293B' : '#FFFFFF';
  const sidebarBorder = isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';
  const navTextColor = isDark ? '#94A3B8' : brand.muted;
  const activeTextColor = isDark ? '#A5B4FC' : brand.primaryDark;
  const activeBg    = isDark ? alpha(brand.primary, 0.18) : brand.primaryChip;
  const hoverBg     = isDark ? alpha(brand.primary, 0.08) : alpha(brand.primary, 0.05);

  const drawer = (
    <Box sx={{
      height: '100%',
      bgcolor: sidebarBg,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <Box sx={{
        px: collapsed && !isMobile ? 0 : 2.5,
        py: 0,
        display: 'flex',
        alignItems: 'center',
        gap: collapsed && !isMobile ? 0 : 1.5,
        minHeight: 64,
        borderBottom: `1px solid ${sidebarBorder}`,
        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
        flexShrink: 0,
      }}>
        <Box sx={{
          width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
          background: `linear-gradient(135deg, ${brand.primaryLight} 0%, ${brand.primary} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 2px 8px ${alpha(brand.primary, 0.35)}`,
        }}>
          <ShieldIcon sx={{ color: '#fff', fontSize: 20 }} />
        </Box>
        {(!collapsed || isMobile) && (
          <Box>
            <Typography variant="subtitle1" sx={{
              fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.3,
              color: isDark ? '#F9FAFB' : brand.text,
            }}>
              Shield
            </Typography>
            <Typography variant="caption" sx={{
              fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase',
              color: brand.subtle,
            }}>
              Family Dashboard
            </Typography>
          </Box>
        )}
      </Box>

      {/* Scrollable nav */}
      <Box sx={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1.5,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: sidebarBorder, borderRadius: 2 },
      }}>
        <List disablePadding sx={{ px: collapsed && !isMobile ? 0.75 : 1.25 }}>
          {sections.map((section, si) => {
            const isExpanded = expandedSections[section.title] ?? true;
            return (
              <Box key={section.title}>
                {si > 0 && (
                  <Box sx={{ my: 1, mx: 0.5 }}>
                    <Divider sx={{ borderColor: sidebarBorder }} />
                  </Box>
                )}
                {/* Section header — only shown when sidebar is expanded */}
                {(!collapsed || isMobile) && (
                  <Box
                    onClick={() => toggleSection(section.title)}
                    sx={{
                      px: 1.5, py: 0.5,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer',
                      borderRadius: 1.5,
                      mx: 0.25,
                      mb: 0.25,
                      '&:hover': { bgcolor: hoverBg },
                    }}
                  >
                    <Typography sx={{
                      color: brand.subtle,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      lineHeight: 1.8,
                    }}>
                      {section.title}
                    </Typography>
                    <Box sx={{ color: brand.subtle, display: 'flex', alignItems: 'center' }}>
                      {isExpanded
                        ? <ExpandLessIcon sx={{ fontSize: 13 }} />
                        : <ExpandMoreIcon sx={{ fontSize: 13 }} />}
                    </Box>
                  </Box>
                )}
                {/* Items — always show in collapsed mode (icon only), use Collapse when expanded */}
                <Collapse in={collapsed || isMobile ? true : isExpanded} timeout={150}>
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
                          px: collapsed && !isMobile ? 0 : 1.5,
                          justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                          color: active ? activeTextColor : navTextColor,
                          transition: 'all 0.18s ease',
                          '&.Mui-selected': {
                            bgcolor: activeBg,
                            color: activeTextColor,
                            '& .MuiListItemIcon-root': { color: activeTextColor },
                            '&:hover': { bgcolor: activeBg },
                          },
                          '&:hover:not(.Mui-selected)': {
                            bgcolor: hoverBg,
                            color: isDark ? '#E2E8F0' : brand.text,
                            '& .MuiListItemIcon-root': { color: isDark ? '#E2E8F0' : brand.text },
                          },
                          '& .MuiListItemIcon-root': {
                            color: active ? activeTextColor : navTextColor,
                            transition: 'color 0.16s',
                          },
                        }}
                      >
                        <ListItemIcon sx={{
                          color: 'inherit',
                          minWidth: collapsed && !isMobile ? 0 : 34,
                          mr: collapsed && !isMobile ? 0 : 1,
                          justifyContent: 'center',
                          '& svg': { fontSize: 19 },
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
                            primaryTypographyProps={{ fontSize: 13.5, fontWeight: active ? 600 : 450, color: 'inherit', lineHeight: 1.3 }}
                            secondary={isAlerts && unreadCount > 0 ? `${unreadCount} unread` : undefined}
                            secondaryTypographyProps={{ fontSize: 10.5, color: 'error.light' }}
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
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ borderColor: sidebarBorder }} />

      {/* User section */}
      <Box sx={{
        px: collapsed && !isMobile ? 0.75 : 1.5,
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: collapsed && !isMobile ? 0 : 1.25,
        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
      }}>
        {collapsed && !isMobile ? (
          <Tooltip title={`${user?.name ?? ''} — Sign out`} placement="right" arrow>
            <Avatar
              sx={{
                width: 34, height: 34,
                background: `linear-gradient(135deg, ${brand.primaryLight} 0%, ${brand.primary} 100%)`,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
              onClick={() => { logout(); navigate('/login'); }}
            >
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </Avatar>
          </Tooltip>
        ) : (
          <>
            <Avatar sx={{
              width: 34, height: 34,
              background: `linear-gradient(135deg, ${brand.primaryLight} 0%, ${brand.primary} 100%)`,
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{
                fontWeight: 600, fontSize: 12.5, lineHeight: 1.2,
                color: isDark ? '#F1F5F9' : brand.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {user?.name ?? 'User'}
              </Typography>
              <Typography sx={{
                fontSize: 10.5, color: brand.subtle, lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
              }}>
                {user?.email ?? ''}
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton size="small" onClick={() => { logout(); navigate('/login'); }} sx={{
                color: brand.subtle,
                '&:hover': { color: brand.danger, bgcolor: alpha(brand.danger, 0.08) },
              }}>
                <LogoutIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {/* Collapse toggle */}
      {!isMobile && (
        <>
          <Divider sx={{ borderColor: sidebarBorder }} />
          <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', px: 1, py: 0.75 }}>
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
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 }, transition: 'width 0.25s ease' }}>
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: DRAWER_EXPANDED,
                border: 'none',
                borderRight: `1px solid ${sidebarBorder}`,
                bgcolor: sidebarBg,
              },
            }}
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
                borderRight: `1px solid ${sidebarBorder}`,
                transition: 'width 0.25s ease',
                overflowX: 'hidden',
                bgcolor: sidebarBg,
              },
            }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, transition: 'all 0.25s ease' }}>
        <AppBar position="static" color="inherit" elevation={0} sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          backdropFilter: 'blur(8px)',
        }}>
          <Toolbar sx={{ minHeight: 60, gap: 0.5, px: { xs: 1.5, md: 2.5 } }}>
            {isMobile && (
              <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" sx={{ mr: 0.5 }}>
                <MenuIcon />
              </IconButton>
            )}

            {/* Search bar */}
            <Box sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              gap: 1,
              mr: 1,
              width: { sm: 200, md: 280 },
              bgcolor: isDark ? alpha('#fff', 0.05) : '#F3F4F6',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
              borderRadius: '8px',
              px: 1.5,
              py: 0.6,
              transition: 'all 0.18s ease',
              '&:focus-within': {
                borderColor: brand.primary,
                bgcolor: isDark ? alpha(brand.primary, 0.08) : '#EEF2FF',
                boxShadow: `0 0 0 3px ${alpha(brand.primary, 0.1)}`,
              },
            }}>
              <SearchIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
              <InputBase
                placeholder="Search…"
                inputProps={{ 'aria-label': 'global search' }}
                sx={{ fontSize: 13.5, flex: 1, '& input': { py: 0 } }}
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

            <Tooltip title={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}>
              <IconButton
                size="small"
                onClick={() => navigate('/alerts')}
                aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
                sx={{
                  position: 'relative',
                  color: unreadCount > 0 ? brand.primary : 'text.secondary',
                  bgcolor: unreadCount > 0 ? alpha(brand.primary, 0.08) : 'transparent',
                  '&:hover': { bgcolor: alpha(brand.primary, 0.1) },
                }}
              >
                <Badge badgeContent={unreadCount || 0} color="error" max={99}>
                  {unreadCount > 0 ? <NotificationsActiveIcon fontSize="small" /> : <NotificationsIcon fontSize="small" />}
                </Badge>
              </IconButton>
            </Tooltip>

            {/* User button */}
            <Box
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, ml: 0.5, px: 1, py: 0.5,
                borderRadius: '8px', cursor: 'pointer',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: isDark ? alpha('#fff', 0.06) : alpha(brand.primary, 0.04),
                  borderColor: isDark ? alpha(brand.primary, 0.3) : '#C7D2FE',
                },
              }}
            >
              <Avatar sx={{
                width: 28, height: 28,
                background: `linear-gradient(135deg, ${brand.primaryLight} 0%, ${brand.primary} 100%)`,
                fontSize: 12, fontWeight: 700,
              }}>
                {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </Avatar>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Typography variant="body2" sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2, color: 'text.primary' }}>
                  {user?.name ?? 'User'}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: 10.5, color: 'text.secondary', lineHeight: 1 }}>
                  Family
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
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }}>{user?.name ?? 'User'}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>{user?.email ?? ''}</Typography>
              <Chip label="Family" size="small" sx={{ mt: 0.5, height: 18, fontSize: 10, fontWeight: 600 }} color="primary" />
            </Box>
          </Box>
          <Divider />
          <MenuItem onClick={() => { navigate('/settings'); setAnchorEl(null); }} sx={{ gap: 1.5, py: 1 }}>
            <PersonIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="body2">Profile & Settings</Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { logout(); navigate('/login'); }} sx={{ color: 'error.main', gap: 1.5, py: 1 }}>
            <LogoutIcon fontSize="small" />
            <Typography variant="body2">Sign out</Typography>
          </MenuItem>
        </Menu>
        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, pb: { xs: '76px', md: 3 } }}>
          <Outlet />
        </Box>
      </Box>

      {/* Mobile bottom navigation */}
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200, display: { xs: 'block', md: 'none' } }} elevation={3}>
        <BottomNavigation
          value={bottomNav}
          onChange={(_, v) => { setBottomNav(v); }}
          sx={{ bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider', height: 60 }}
        >
          <BottomNavigationAction label="Dashboard" icon={<DashboardIcon />} onClick={() => navigate('/dashboard')} />
          <BottomNavigationAction label="Family" icon={<FamilyRestroomIcon />} onClick={() => navigate('/profiles')} />
          <BottomNavigationAction label="Location" icon={<MapIcon />} onClick={() => navigate('/map')} />
          <BottomNavigationAction label="Alerts" icon={<NotificationsIcon />} onClick={() => navigate('/alerts')} />
          <BottomNavigationAction label="More" icon={<MoreHorizIcon />} onClick={() => setMobileOpen(true)} />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
