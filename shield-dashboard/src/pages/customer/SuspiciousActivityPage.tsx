import {
  Box, Typography, Card, CardContent, Chip, IconButton, Button,
  Stack, CircularProgress, Select, MenuItem, FormControl,
  InputLabel, Alert, Divider, Tooltip, Grid, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import BlockIcon from '@mui/icons-material/Block';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import PeopleIcon from '@mui/icons-material/People';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChildProfile {
  id: string;
  name: string;
}

interface SuspiciousAlert {
  id: string;
  profileId: string;
  alertType: 'BURST_BLOCKED' | 'SUSPICIOUS_CATEGORY';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function severityColor(severity: string): 'error' | 'warning' | 'default' {
  if (severity === 'HIGH') return 'error';
  if (severity === 'MEDIUM') return 'warning';
  return 'default';
}

function alertTypeLabel(type: string): string {
  if (type === 'BURST_BLOCKED') return 'Burst Blocked';
  if (type === 'SUSPICIOUS_CATEGORY') return 'Suspicious Category';
  return type;
}

function alertTypeIcon(type: string) {
  if (type === 'BURST_BLOCKED') return <BlockIcon sx={{ fontSize: 20 }} />;
  return <WarningAmberIcon sx={{ fontSize: 20 }} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

const THEME_COLOR = '#B71C1C';

export default function SuspiciousActivityPage() {
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [dateRange, setDateRange] = useState<'7D' | '14D' | '30D'>('7D');

  // Auto-refresh every 60s
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Fetch child profiles
  const { data: profiles = [], isLoading: profilesLoading } = useQuery<ChildProfile[]>({
    queryKey: ['child-profiles-minimal'],
    queryFn: async () => {
      const { data } = await api.get('/profiles/children');
      const d = data?.data;
      return ((d?.content ?? d ?? data) as ChildProfile[]) ?? [];
    },
  });

  // Auto-select first profile
  useEffect(() => {
    if (profiles.length > 0 && !selectedProfileId) {
      setSelectedProfileId(profiles[0].id);
    }
  }, [profiles, selectedProfileId]);

  // Fetch alerts
  const {
    data: alerts = [],
    isLoading: alertsLoading,
    isError,
    refetch,
  } = useQuery<SuspiciousAlert[]>({
    queryKey: ['suspicious-alerts', selectedProfileId, pendingOnly, refreshKey],
    queryFn: async () => {
      if (!selectedProfileId) return [];
      const { data } = await api.get(
        `/analytics/alerts/${selectedProfileId}?pendingOnly=${pendingOnly}`,
      );
      return (data ?? []) as SuspiciousAlert[];
    },
    enabled: !!selectedProfileId,
  });

  // Acknowledge mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.post(`/analytics/alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspicious-alerts'] });
    },
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const pendingCount = alerts.filter(a => !a.acknowledged).length;

  // ── Date range filter ────────────────────────────────────────────────────────
  const filteredAlerts = useMemo(() => {
    const days = dateRange === '7D' ? 7 : dateRange === '14D' ? 14 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return alerts.filter(a => new Date(a.detectedAt).getTime() >= cutoff);
  }, [alerts, dateRange]);

  // ── KPI counts ───────────────────────────────────────────────────────────────
  const totalAlerts = filteredAlerts.length;
  const criticalCount = filteredAlerts.filter(a => a.severity === 'HIGH').length;
  const unreadCount = filteredAlerts.filter(a => !a.acknowledged).length;
  const profilesAffected = new Set(filteredAlerts.map(a => a.profileId)).size;

  // ── Severity chart data ───────────────────────────────────────────────────────
  const severityChartData = [
    { name: 'High',   count: filteredAlerts.filter(a => a.severity === 'HIGH').length,   fill: THEME_COLOR },
    { name: 'Medium', count: filteredAlerts.filter(a => a.severity === 'MEDIUM').length, fill: '#E65100' },
    { name: 'Low',    count: filteredAlerts.filter(a => a.severity === 'LOW').length,    fill: '#9E9E9E' },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ReportProblemIcon />}
        title="Suspicious Activity"
        subtitle="DNS anomaly alerts for your child profiles"
        iconColor={THEME_COLOR}
      />

      {/* ── Date range toggle ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <ToggleButtonGroup
          value={dateRange}
          exclusive
          onChange={(_, v) => { if (v) setDateRange(v); }}
          size="small"
          sx={{ '& .MuiToggleButton-root': { px: 2, fontWeight: 600, fontSize: 12 } }}
        >
          <ToggleButton value="7D">7D</ToggleButton>
          <ToggleButton value="14D">14D</ToggleButton>
          <ToggleButton value="30D">30D</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ── KPI Stat Cards ────────────────────────────────────────────────── */}
      {!alertsLoading && alerts.length >= 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            {
              label: 'Total Alerts',
              value: totalAlerts,
              icon: <NotificationsIcon sx={{ fontSize: 22, color: '#fff' }} />,
              gradient: 'linear-gradient(135deg, #B71C1C 0%, #E53935 100%)',
            },
            {
              label: 'Critical (High)',
              value: criticalCount,
              icon: <PriorityHighIcon sx={{ fontSize: 22, color: '#fff' }} />,
              gradient: 'linear-gradient(135deg, #C62828 0%, #EF5350 100%)',
            },
            {
              label: 'Unread',
              value: unreadCount,
              icon: <MarkEmailUnreadIcon sx={{ fontSize: 22, color: '#fff' }} />,
              gradient: 'linear-gradient(135deg, #E65100 0%, #FF7043 100%)',
            },
            {
              label: 'Profiles Affected',
              value: profilesAffected,
              icon: <PeopleIcon sx={{ fontSize: 22, color: '#fff' }} />,
              gradient: 'linear-gradient(135deg, #6D1A36 0%, #AD1457 100%)',
            },
          ].map((card) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.label}>
              <Card sx={{ background: card.gradient, color: '#fff', overflow: 'hidden', position: 'relative' }}>
                <Box sx={{
                  position: 'absolute', top: -16, right: -16,
                  width: 64, height: 64, borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,0.1)',
                }} />
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, position: 'relative', zIndex: 1 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{
                      width: 40, height: 40, borderRadius: '10px',
                      bgcolor: 'rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {card.icon}
                    </Box>
                    <Box>
                      <Typography variant="h5" fontWeight={800} sx={{ color: '#fff', lineHeight: 1.1 }}>
                        {card.value}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                        {card.label}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ── Severity Bar Chart ────────────────────────────────────────────── */}
      {!alertsLoading && filteredAlerts.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              Alerts by Severity
            </Typography>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={severityChartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }} barSize={40}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                <ReTooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                  formatter={(value: number) => [value, 'Alerts']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {severityChartData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Controls row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Child Profile</InputLabel>
          <Select
            value={selectedProfileId}
            label="Child Profile"
            onChange={e => setSelectedProfileId(e.target.value)}
            disabled={profilesLoading}
          >
            {profiles.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant={pendingOnly ? 'contained' : 'outlined'}
          startIcon={<FilterAltIcon />}
          size="small"
          onClick={() => setPendingOnly(v => !v)}
          sx={{
            borderColor: THEME_COLOR,
            color: pendingOnly ? 'white' : THEME_COLOR,
            bgcolor: pendingOnly ? THEME_COLOR : 'transparent',
            '&:hover': { bgcolor: pendingOnly ? '#8B0000' : 'rgba(183,28,28,0.06)' },
          }}
        >
          {pendingOnly ? 'Showing Pending' : 'Show Pending Only'}
        </Button>

        <Tooltip title="Refresh alerts">
          <IconButton
            onClick={handleRefresh}
            disabled={alertsLoading}
            size="small"
            sx={{ ml: 'auto' }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Summary bar */}
      {selectedProfileId && !alertsLoading && filteredAlerts.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label={`${unreadCount} Pending`}
            color={unreadCount > 0 ? 'error' : 'default'}
            sx={{ fontWeight: 600 }}
          />
          <Chip
            size="small"
            label={`${criticalCount} High`}
            sx={{ bgcolor: '#FFEBEE', color: THEME_COLOR, fontWeight: 600 }}
          />
          <Chip
            size="small"
            label={`${filteredAlerts.filter(a => a.severity === 'MEDIUM').length} Medium`}
            sx={{ bgcolor: '#FFF3E0', color: '#92400E', fontWeight: 600 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
            Auto-refreshes every 60s
          </Typography>
        </Box>
      )}

      {/* Loading */}
      {(profilesLoading || alertsLoading) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={36} />
        </Box>
      )}

      {/* Error */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load alerts. Please try again.
        </Alert>
      )}

      {/* Empty state */}
      {!alertsLoading && !isError && selectedProfileId && filteredAlerts.length === 0 && (
        <EmptyState
          icon={<ReportProblemIcon sx={{ fontSize: 56, color: '#E0E0E0' }} />}
          title="No suspicious activity detected"
          description={
            pendingOnly
              ? 'There are no pending alerts for this profile.'
              : 'No suspicious activity has been detected for this profile.'
          }
        />
      )}

      {/* No profile selected */}
      {!profilesLoading && !selectedProfileId && profiles.length === 0 && (
        <EmptyState
          icon={<ReportProblemIcon sx={{ fontSize: 56, color: '#E0E0E0' }} />}
          title="No child profiles"
          description="Add a child profile to start monitoring for suspicious activity."
        />
      )}

      {/* Alert list */}
      {!alertsLoading && filteredAlerts.length > 0 && (
        <Stack spacing={2}>
          {filteredAlerts.map((alert, idx) => (
            <AnimatedPage key={alert.id} delay={idx * 0.04}>
              <Card
                sx={{
                  borderLeft: `4px solid ${
                    alert.severity === 'HIGH'
                      ? THEME_COLOR
                      : alert.severity === 'MEDIUM'
                      ? '#C2410C'
                      : '#9E9E9E'
                  }`,
                  opacity: alert.acknowledged ? 0.65 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    {/* Icon */}
                    <Box
                      sx={{
                        mt: 0.25,
                        color:
                          alert.severity === 'HIGH'
                            ? THEME_COLOR
                            : alert.severity === 'MEDIUM'
                            ? '#E65100'
                            : '#9E9E9E',
                      }}
                    >
                      {alertTypeIcon(alert.alertType)}
                    </Box>

                    {/* Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {alertTypeLabel(alert.alertType)}
                        </Typography>
                        <Chip
                          size="small"
                          label={alert.severity}
                          color={severityColor(alert.severity)}
                          sx={{ height: 18, fontSize: 11, fontWeight: 700 }}
                        />
                        {alert.acknowledged && (
                          <Chip
                            size="small"
                            label="Dismissed"
                            icon={<CheckCircleOutlineIcon />}
                            sx={{ height: 18, fontSize: 11, color: '#757575' }}
                          />
                        )}
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                        {alert.description}
                      </Typography>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <AccessTimeIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.disabled">
                          {timeAgo(alert.detectedAt)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Dismiss button */}
                    {!alert.acknowledged && (
                      <Tooltip title="Dismiss alert">
                        <IconButton
                          size="small"
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          disabled={acknowledgeMutation.isPending}
                          sx={{ color: 'text.secondary', flexShrink: 0 }}
                        >
                          <CheckCircleOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </AnimatedPage>
          ))}
        </Stack>
      )}
    </AnimatedPage>
  );
}
