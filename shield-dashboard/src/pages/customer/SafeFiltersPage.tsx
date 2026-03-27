import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Stack, Alert, Snackbar, Switch, FormControlLabel,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SecurityIcon from '@mui/icons-material/Security';
import YouTubeIcon from '@mui/icons-material/YouTube';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import MusicVideoIcon from '@mui/icons-material/MusicVideo';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface ChildProfile { id: string; name: string; }
interface SafeFilterStatus {
  youtubeSafeMode: boolean;
  safeSearch: boolean;
  facebookBlocked: boolean;
  instagramBlocked: boolean;
  tiktokBlocked: boolean;
}

export default function SafeFiltersPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => []),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const { data: filterStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['safe-filter-status', profileId],
    queryFn: () =>
      api.get(`/dns/rules/${profileId}`)
        .then(r => {
          const d = r.data?.data ?? r.data;
          return {
            youtubeSafeMode: d?.youtubeSafeMode ?? false,
            safeSearch: d?.safeSearch ?? false,
            facebookBlocked: d?.facebookBlocked ?? false,
            instagramBlocked: d?.instagramBlocked ?? false,
            tiktokBlocked: d?.tiktokBlocked ?? false,
          } as SafeFilterStatus;
        }).catch(() => ({ youtubeSafeMode: false, safeSearch: false, facebookBlocked: false, instagramBlocked: false, tiktokBlocked: false } as SafeFilterStatus)),
    enabled: !!profileId,
  });

  const youtubeMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.post(`/dns/rules/${profileId}/youtube-safe-mode`, { enabled }),
    onSuccess: (_, enabled) => {
      qc.invalidateQueries({ queryKey: ['safe-filter-status', profileId] });
      setSnackbar({
        open: true,
        message: `YouTube Safe Mode ${enabled ? 'enabled' : 'disabled'}`,
        severity: 'success',
      });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to update YouTube Safe Mode', severity: 'error' }),
  });

  const safeSearchMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.post(`/dns/rules/${profileId}/safe-search`, { enabled }),
    onSuccess: (_, enabled) => {
      qc.invalidateQueries({ queryKey: ['safe-filter-status', profileId] });
      setSnackbar({
        open: true,
        message: `Safe Search ${enabled ? 'enabled' : 'disabled'}`,
        severity: 'success',
      });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to update Safe Search', severity: 'error' }),
  });

  const facebookMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.post(`/dns/rules/${profileId}/social-block`, { platform: 'facebook', enabled }),
    onSuccess: (_, enabled) => {
      qc.invalidateQueries({ queryKey: ['safe-filter-status', profileId] });
      setSnackbar({ open: true, message: `Facebook ${enabled ? 'blocked' : 'unblocked'}`, severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to update Facebook block', severity: 'error' }),
  });

  const instagramMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.post(`/dns/rules/${profileId}/social-block`, { platform: 'instagram', enabled }),
    onSuccess: (_, enabled) => {
      qc.invalidateQueries({ queryKey: ['safe-filter-status', profileId] });
      setSnackbar({ open: true, message: `Instagram ${enabled ? 'blocked' : 'unblocked'}`, severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to update Instagram block', severity: 'error' }),
  });

  const tiktokMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.post(`/dns/rules/${profileId}/social-block`, { platform: 'tiktok', enabled }),
    onSuccess: (_, enabled) => {
      qc.invalidateQueries({ queryKey: ['safe-filter-status', profileId] });
      setSnackbar({ open: true, message: `TikTok ${enabled ? 'blocked' : 'unblocked'}`, severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to update TikTok block', severity: 'error' }),
  });

  if (loadingChildren) return <LoadingPage />;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<SecurityIcon />} title="Safe Filters" subtitle="YouTube Safe Mode and Safe Search settings" iconColor="#1565C0" />
        <EmptyState title="No child profiles" description="Add a child profile first to configure safe filters" />
      </AnimatedPage>
    );
  }

  const ytEnabled = filterStatus?.youtubeSafeMode ?? false;
  const ssEnabled = filterStatus?.safeSearch ?? false;
  const fbBlocked = filterStatus?.facebookBlocked ?? false;
  const igBlocked = filterStatus?.instagramBlocked ?? false;
  const ttBlocked = filterStatus?.tiktokBlocked ?? false;

  const filters = [
    {
      key: 'youtube',
      icon: <YouTubeIcon sx={{ fontSize: 28, color: '#FF0000' }} />,
      iconBg: 'rgba(255,0,0,0.08)',
      title: 'YouTube Safe Mode',
      description: 'Forces YouTube Restricted Mode — hides mature content, inappropriate videos, and age-restricted content',
      enabled: ytEnabled,
      loading: youtubeMutation.isPending || loadingStatus,
      onChange: (v: boolean) => youtubeMutation.mutate(v),
      benefits: [
        'Hides age-restricted and mature videos',
        'Removes explicit content from search results',
        'Enforced at DNS level — cannot be bypassed by child',
      ],
    },
    {
      key: 'safesearch',
      icon: <SearchIcon sx={{ fontSize: 28, color: '#1565C0' }} />,
      iconBg: 'rgba(21,101,192,0.08)',
      title: 'Safe Search',
      description: 'Forces SafeSearch on Google, Bing & DuckDuckGo — filters explicit images, videos, and web results',
      enabled: ssEnabled,
      loading: safeSearchMutation.isPending || loadingStatus,
      onChange: (v: boolean) => safeSearchMutation.mutate(v),
      benefits: [
        'Filters explicit images and videos from search',
        'Works across Google, Bing, and DuckDuckGo',
        'Enforced at DNS level — cannot be turned off by child',
      ],
    },
    {
      key: 'facebook',
      icon: <PeopleAltIcon sx={{ fontSize: 28, color: '#1877F2' }} />,
      iconBg: 'rgba(24,119,242,0.08)',
      title: 'Block Facebook',
      description: 'Blocks access to Facebook and Messenger — prevents exposure to inappropriate content, cyberbullying, and strangers',
      enabled: fbBlocked,
      loading: facebookMutation.isPending || loadingStatus,
      onChange: (v: boolean) => facebookMutation.mutate(v),
      benefits: [
        'Blocks facebook.com, messenger.com and all sub-domains',
        'Prevents harmful video content and live streams',
        'Enforced at DNS level across all apps and browsers',
      ],
    },
    {
      key: 'instagram',
      icon: <PhotoCameraIcon sx={{ fontSize: 28, color: '#C13584' }} />,
      iconBg: 'rgba(193,53,132,0.08)',
      title: 'Block Instagram',
      description: 'Blocks Instagram and Threads — prevents exposure to harmful Reels, filters, and contact with strangers',
      enabled: igBlocked,
      loading: instagramMutation.isPending || loadingStatus,
      onChange: (v: boolean) => instagramMutation.mutate(v),
      benefits: [
        'Blocks instagram.com and threads.net',
        'Stops harmful video Reels and Stories',
        'Enforced at DNS level — works on mobile and desktop',
      ],
    },
    {
      key: 'tiktok',
      icon: <MusicVideoIcon sx={{ fontSize: 28, color: '#EE1D52' }} />,
      iconBg: 'rgba(238,29,82,0.08)',
      title: 'Block TikTok',
      description: 'Blocks TikTok completely — prevents addictive short-form videos, harmful trends, and stranger interactions',
      enabled: ttBlocked,
      loading: tiktokMutation.isPending || loadingStatus,
      onChange: (v: boolean) => tiktokMutation.mutate(v),
      benefits: [
        'Blocks tiktok.com and all TikTok CDN domains',
        'Stops addictive video feed and harmful challenges',
        'Enforced at DNS level — cannot be bypassed by VPN apps',
      ],
    },
  ];

  return (
    <AnimatedPage>
      <PageHeader
        icon={<SecurityIcon />}
        title="Safe Filters"
        subtitle="Enforce safe viewing on YouTube and search engines"
        iconColor="#1565C0"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? '#1565C0' : 'rgba(21,101,192,0.08)',
                  color: (profileId === c.id) ? 'white' : '#1565C0',
                  '&:hover': { bgcolor: (profileId === c.id) ? '#0D47A1' : 'rgba(21,101,192,0.16)' },
                }}
              />
            ))}
          </Stack>
        }
      />

      <Stack spacing={2.5} sx={{ mb: 3 }}>
        {filters.map((filter, i) => (
          <AnimatedPage key={filter.key} delay={0.1 + i * 0.1}>
            <Card sx={{
              border: '1px solid',
              borderColor: filter.enabled ? 'success.light' : 'divider',
              transition: 'border-color 0.2s ease',
            }}>
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                  <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ flex: 1 }}>
                    <Box sx={{
                      width: 52, height: 52, borderRadius: '12px', flexShrink: 0,
                      bgcolor: filter.iconBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {filter.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="subtitle1" fontWeight={700}>{filter.title}</Typography>
                        {filter.enabled && (
                          <Chip
                            size="small"
                            label="Active"
                            icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                            sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: '#E8F5E9', color: '#2E7D32' }}
                          />
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {filter.description}
                      </Typography>
                      <Stack spacing={0.5}>
                        {filter.benefits.map((b, bi) => (
                          <Stack key={bi} direction="row" spacing={0.75} alignItems="flex-start">
                            <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main', mt: 0.25, flexShrink: 0 }} />
                            <Typography variant="caption" color="text.secondary">{b}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  </Stack>
                  <Box sx={{ display: 'flex', alignItems: 'center', pl: { sm: 1 } }}>
                    {filter.loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={filter.enabled}
                            onChange={e => filter.onChange(e.target.checked)}
                            disabled={!profileId}
                            sx={{
                              '& .MuiSwitch-switchBase.Mui-checked': { color: 'success.main' },
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'success.main' },
                            }}
                          />
                        }
                        label={
                          <Typography variant="body2" fontWeight={600} color={filter.enabled ? 'success.main' : 'text.secondary'}>
                            {filter.enabled ? 'On' : 'Off'}
                          </Typography>
                        }
                        labelPlacement="start"
                        sx={{ mx: 0, gap: 1 }}
                      />
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </AnimatedPage>
        ))}
      </Stack>

      {/* Info card */}
      <AnimatedPage delay={0.35}>
        <Card sx={{ bgcolor: 'rgba(21,101,192,0.04)', border: '1px solid rgba(21,101,192,0.15)' }}>
          <CardContent>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <InfoOutlinedIcon sx={{ color: '#1565C0', mt: 0.25, flexShrink: 0 }} />
              <Box>
                <Typography variant="subtitle2" fontWeight={700} color="#1565C0" sx={{ mb: 0.5 }}>
                  How safe filters work
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  These filters are enforced at the DNS level, which means they apply to all browsers and apps on your child's device.
                  Unlike browser extensions, children cannot bypass them by switching browsers or using incognito mode.
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </AnimatedPage>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
