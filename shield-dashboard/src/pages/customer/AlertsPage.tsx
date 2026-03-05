import { Box, Typography, Card, CardContent, Chip, IconButton, Tabs, Tab, Button } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useState } from 'react';
import { useAlertStore, AlertItem } from '../../store/alert.store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuthStore } from '../../store/auth.store';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

const severityColor: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  LOW: 'success', MEDIUM: 'warning', HIGH: 'error', CRITICAL: 'error'
};

const severityStyles: Record<string, { border: string; glow: string; bg: string }> = {
  CRITICAL: { border: '#E53935', glow: '0 0 12px rgba(229,57,53,0.25)', bg: '#FFF5F5' },
  HIGH: { border: '#FB8C00', glow: '0 0 8px rgba(251,140,0,0.15)', bg: '#FFF8F0' },
  MEDIUM: { border: '#FFC107', glow: 'none', bg: '#FFFDF5' },
  LOW: { border: '#43A047', glow: 'none', bg: '#FAFFF5' },
};

export default function AlertsPage() {
  const [tab, setTab] = useState(0);
  const { alerts, unreadCount, markRead, markAllRead, addAlert } = useAlertStore();
  const user = useAuthStore((s) => s.user);

  useWebSocket(`/topic/alerts/${user?.id}`, (data) => addAlert(data as AlertItem), !!user?.id);

  const filtered = tab === 0 ? alerts : alerts.filter((a) => !a.read);

  return (
    <AnimatedPage>
      <PageHeader
        icon={<NotificationsActiveIcon />}
        title="Alert Centre"
        subtitle={`${alerts.length} total alerts`}
        iconColor="#E53935"
        action={
          unreadCount > 0 ? (
            <Button variant="outlined" size="small" startIcon={<DoneAllIcon />} onClick={markAllRead}
              sx={{ borderRadius: 2, borderColor: '#E5393530', color: '#E53935' }}>
              Mark all read ({unreadCount})
            </Button>
          ) : undefined
        }
      />

      <AnimatedPage delay={0.1}>
        <Card>
          <Tabs value={tab} onChange={(_, v: number) => setTab(v)}
            sx={{
              borderBottom: '1px solid #E8EDF2', px: 2,
              '& .MuiTab-root': { fontWeight: 600, textTransform: 'none' },
            }}
          >
            <Tab label="All Alerts" />
            <Tab label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Unread
                {unreadCount > 0 && (
                  <Chip size="small" label={unreadCount} color="error"
                    sx={{ height: 20, minWidth: 20, fontSize: 11, fontWeight: 700 }} />
                )}
              </Box>
            } />
          </Tabs>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<NotificationsNoneIcon sx={{ fontSize: 36, color: '#9E9E9E' }} />}
              title={tab === 1 ? 'All caught up!' : 'No alerts yet'}
              description={tab === 1 ? 'You have no unread alerts' : 'Alerts will appear here when triggered'}
            />
          ) : (
            <Box>
              {filtered.map((alert, i) => {
                const style = severityStyles[alert.severity] || severityStyles.LOW;
                return (
                  <Box
                    key={alert.id}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 2,
                      px: 2.5, py: 2,
                      borderBottom: i < filtered.length - 1 ? '1px solid #F1F5F9' : 'none',
                      borderLeft: `4px solid ${style.border}`,
                      bgcolor: alert.read ? 'transparent' : style.bg,
                      boxShadow: !alert.read ? style.glow : 'none',
                      transition: 'all 0.2s ease',
                      '&:hover': { bgcolor: '#FAFBFC' },
                      '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                      animation: `fadeInUp 0.3s ease ${Math.min(i * 0.05, 0.5)}s both`,
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Chip
                          size="small"
                          label={alert.severity}
                          color={severityColor[alert.severity] || 'default'}
                          sx={{
                            height: 20, fontSize: 10, fontWeight: 700,
                            ...(alert.severity === 'CRITICAL' && {
                              '@keyframes subtlePulse': {
                                '0%, 100%': { opacity: 1 },
                                '50%': { opacity: 0.7 },
                              },
                              animation: 'subtlePulse 2s ease-in-out infinite',
                            }),
                          }}
                        />
                        <Typography variant="body2" fontWeight={alert.read ? 400 : 600}>{alert.message}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {alert.profileName} &middot; {new Date(alert.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                    {!alert.read && (
                      <IconButton
                        size="small"
                        onClick={() => markRead(alert.id)}
                        title="Mark read"
                        sx={{
                          bgcolor: '#F1F5F9',
                          '&:hover': { bgcolor: '#E8EDF2' },
                        }}
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Card>
      </AnimatedPage>
    </AnimatedPage>
  );
}
