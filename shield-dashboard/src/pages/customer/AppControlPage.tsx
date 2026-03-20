import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, CircularProgress,
  Avatar, Stack, Button, LinearProgress, Tooltip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import SecurityIcon from '@mui/icons-material/Security';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PhonelinkSetupIcon from '@mui/icons-material/PhonelinkSetup';
import TuneIcon from '@mui/icons-material/Tune';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface ChildProfile {
  id: string;
  name?: string;
  age?: number;
  filterLevel?: string;
  dnsClientId?: string;
  dohUrl?: string;
}

interface DnsRules {
  profileId: string;
  enabledCategories?: Record<string, boolean>;
  customBlocklist?: string[];
  customAllowlist?: string[];
}

const FILTER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  STRICT:   { bg: '#FFEBEE', text: '#C62828', label: 'Strict' },
  MODERATE: { bg: '#FFF8E1', text: '#F57F17', label: 'Moderate' },
  RELAXED:  { bg: '#E8F5E9', text: '#2E7D32', label: 'Relaxed' },
  CUSTOM:   { bg: '#E3F2FD', text: '#1565C0', label: 'Custom' },
};

function getInitials(name?: string) {
  if (!name) return 'P';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ['#00897B', '#1565C0', '#7B1FA2', '#E53935', '#FB8C00'];

export default function AppControlPage() {
  const navigate = useNavigate();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['child-profiles-appcontrol'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as ChildProfile[];
    }).catch(() => []),
  });

  const { data: rulesMap } = useQuery({
    queryKey: ['all-profile-rules', (profiles ?? []).map(p => p.id).join(',')],
    enabled: !!(profiles?.length),
    queryFn: async () => {
      const map: Record<string, DnsRules> = {};
      await Promise.all((profiles ?? []).map(async p => {
        try {
          const r = await api.get(`/dns/rules/${p.id}`);
          map[p.id] = r.data?.data ?? r.data;
        } catch { /* ignore */ }
      }));
      return map;
    },
  });

  if (isLoading) {
    return (
      <AnimatedPage>
        <PageHeader icon={<PhonelinkSetupIcon />} title="App & Content Control"
          subtitle="Manage DNS filtering for each child profile" iconColor="#1565C0" />
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PhonelinkSetupIcon />}
        title="App & Content Control"
        subtitle="Manage DNS filtering, blocked and allowed domains per child"
        iconColor="#1565C0"
      />

      <Card sx={{ mb: 3, bgcolor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <CardContent sx={{ py: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <SecurityIcon sx={{ color: '#1D4ED8', fontSize: 20 }} />
            <Box>
              <Typography variant="body2" fontWeight={600} color="#1E40AF">How DNS filtering works</Typography>
              <Typography variant="caption" color="#3B82F6">
                Set your child's device DNS to their Private DNS address below. This routes all web traffic through Shield's filter.
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {(!profiles || profiles.length === 0) ? (
        <EmptyState
          icon={<PhonelinkSetupIcon sx={{ fontSize: 36, color: '#1565C0' }} />}
          title="No child profiles"
          description="Create a child profile first to set up filtering"
        />
      ) : (
        <Grid container spacing={3}>
          {(profiles ?? []).map((profile, i) => {
            const rules = rulesMap?.[profile.id];
            const filterConf = FILTER_COLORS[profile.filterLevel ?? 'MODERATE'];
            const totalCats = Object.keys(rules?.enabledCategories ?? {}).length;
            const blockedCats = Object.values(rules?.enabledCategories ?? {}).filter(v => v === false).length;
            const customBlocked = rules?.customBlocklist?.length ?? 0;
            const customAllowed = rules?.customAllowlist?.length ?? 0;

            return (
              <Grid key={profile.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <AnimatedPage delay={0.1 + i * 0.08}>
                  <Card sx={{
                    height: '100%', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' },
                  }}
                    onClick={() => navigate(`/profiles/${profile.id}/rules`)}
                  >
                    <Box sx={{ height: 4, bgcolor: AVATAR_COLORS[i % AVATAR_COLORS.length] }} />
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                        <Avatar sx={{ bgcolor: AVATAR_COLORS[i % AVATAR_COLORS.length], fontWeight: 700, fontSize: 15 }}>
                          {getInitials(profile.name)}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={700} fontSize={15} noWrap>{profile.name ?? 'Child Profile'}</Typography>
                          {profile.age && (
                            <Typography variant="caption" color="text.secondary">Age {profile.age}</Typography>
                          )}
                        </Box>
                        <Chip size="small" label={filterConf.label}
                          sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: filterConf.bg, color: filterConf.text }} />
                      </Stack>

                      <Stack spacing={1.5} sx={{ mb: 2.5 }}>
                        {totalCats > 0 && (
                          <Box>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">Categories blocked</Typography>
                              <Typography variant="caption" fontWeight={600}>{blockedCats}/{totalCats}</Typography>
                            </Stack>
                            <LinearProgress variant="determinate"
                              value={totalCats > 0 ? (blockedCats / totalCats) * 100 : 0}
                              sx={{ height: 5, borderRadius: 3, bgcolor: '#F1F5F9',
                                '& .MuiLinearProgress-bar': { bgcolor: '#E53935' } }} />
                          </Box>
                        )}
                        <Stack direction="row" spacing={1}>
                          <Chip size="small" icon={<BlockIcon sx={{ fontSize: 12 }} />}
                            label={`${customBlocked} blocked`}
                            sx={{ height: 22, fontSize: 11, bgcolor: '#FFEBEE', color: '#B71C1C', fontWeight: 600 }} />
                          <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                            label={`${customAllowed} allowed`}
                            sx={{ height: 22, fontSize: 11, bgcolor: '#E8F5E9', color: '#1B5E20', fontWeight: 600 }} />
                        </Stack>
                      </Stack>

                      {profile.dnsClientId && (
                        <Box sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: 1.5, mb: 2 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                            Private DNS (Android)
                          </Typography>
                          <Tooltip title="Copy to set on Android device" placement="top">
                            <Typography
                              variant="caption"
                              sx={{
                                fontFamily: 'monospace', fontSize: 10.5, fontWeight: 600,
                                color: '#1565C0', cursor: 'pointer', wordBreak: 'break-all',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(profile.dnsClientId!);
                              }}
                            >
                              {profile.dnsClientId}
                            </Typography>
                          </Tooltip>
                        </Box>
                      )}

                      <Button variant="outlined" fullWidth size="small" startIcon={<TuneIcon />}
                        onClick={(e) => { e.stopPropagation(); navigate(`/profiles/${profile.id}/rules`); }}
                        sx={{
                          borderColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
                          color: AVATAR_COLORS[i % AVATAR_COLORS.length],
                          fontWeight: 600, fontSize: 12,
                          '&:hover': { bgcolor: `${AVATAR_COLORS[i % AVATAR_COLORS.length]}10` },
                        }}>
                        Manage Filters
                      </Button>
                    </CardContent>
                  </Card>
                </AnimatedPage>
              </Grid>
            );
          })}
        </Grid>
      )}
    </AnimatedPage>
  );
}
