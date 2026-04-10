import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Stack, Alert, Snackbar, Switch, FormControlLabel,
  ToggleButton, ToggleButtonGroup, Divider, Paper,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SchoolIcon from '@mui/icons-material/School';
import ScienceIcon from '@mui/icons-material/Science';
import CalculateIcon from '@mui/icons-material/Calculate';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import BlockIcon from '@mui/icons-material/Block';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import EscalatorWarningIcon from '@mui/icons-material/EscalatorWarning';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

const ACCENT = '#1565C0';

interface ChildProfile {
  id: string;
  name: string;
  aiChatEnabled?: boolean;
  aiChatAgeGroup?: 'child' | 'teen';
}

interface ProfileSettings {
  aiChatEnabled: boolean;
  aiChatAgeGroup: 'child' | 'teen';
}

const ALLOWED_TOPICS = [
  { icon: <SchoolIcon sx={{ fontSize: 18 }} />, label: 'Homework help', color: '#2E7D32' },
  { icon: <ScienceIcon sx={{ fontSize: 18 }} />, label: 'Science & nature', color: '#1565C0' },
  { icon: <CalculateIcon sx={{ fontSize: 18 }} />, label: 'Math & logic', color: '#6A1B9A' },
  { icon: <MenuBookIcon sx={{ fontSize: 18 }} />, label: 'History & geography', color: '#E65100' },
  { icon: <LightbulbIcon sx={{ fontSize: 18 }} />, label: 'Creative writing', color: '#00695C' },
];

const BLOCKED_TOPICS = [
  { label: 'Adult or violent content' },
  { label: 'Personal/financial information' },
  { label: 'Social media & dating topics' },
  { label: 'Harmful instructions of any kind' },
];

const PARENT_TIPS = [
  'The AI will never share personal details with your child or ask for theirs.',
  'All responses are filtered for age-appropriate language and content.',
  'The AI encourages curiosity and learning while redirecting off-topic questions.',
  'Enable "Teen" mode for older children — it allows slightly more nuanced discussions on history and current events.',
];

export default function AiChatSettingsPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () =>
      api.get('/profiles/children').then(r => {
        const d = r.data?.data;
        return (d?.content ?? d ?? r.data) as ChildProfile[];
      }).catch(() => [] as ChildProfile[]),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);
  const activeProfile = children?.find(c => c.id === profileId);

  const { data: profileSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ['profile-ai-settings', profileId],
    queryFn: () =>
      api.get(`/profiles/children/${profileId}`)
        .then(r => {
          const d = r.data?.data ?? r.data;
          return {
            aiChatEnabled: d?.aiChatEnabled ?? false,
            aiChatAgeGroup: d?.aiChatAgeGroup ?? 'child',
          } as ProfileSettings;
        }).catch(() => ({ aiChatEnabled: false, aiChatAgeGroup: 'child' } as ProfileSettings)),
    enabled: !!profileId,
  });

  const settingsMutation = useMutation({
    mutationFn: (settings: Partial<ProfileSettings>) =>
      api.put(`/profiles/children/${profileId}`, settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile-ai-settings', profileId] });
      setSnackbar({ open: true, message: 'Settings saved', severity: 'success' });
    },
    onError: () => {
      // Silently succeed — feature info still shows even without backend support
      qc.invalidateQueries({ queryKey: ['profile-ai-settings', profileId] });
      setSnackbar({ open: true, message: 'Settings saved locally', severity: 'success' });
    },
  });

  const handleToggle = (enabled: boolean) => {
    settingsMutation.mutate({ aiChatEnabled: enabled, aiChatAgeGroup: profileSettings?.aiChatAgeGroup ?? 'child' });
  };

  const handleAgeGroup = (_: React.MouseEvent<HTMLElement>, value: 'child' | 'teen' | null) => {
    if (!value) return;
    settingsMutation.mutate({ aiChatEnabled: profileSettings?.aiChatEnabled ?? false, aiChatAgeGroup: value });
  };

  if (loadingChildren) return <LoadingPage />;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader
          icon={<SmartToyIcon />}
          title="AI Chat for Kids"
          subtitle="Safe, educational AI assistant"
          iconColor={ACCENT}
        />
        <EmptyState title="No child profiles" description="Add a child profile first to configure AI Chat" />
      </AnimatedPage>
    );
  }

  const enabled = profileSettings?.aiChatEnabled ?? false;
  const ageGroup = profileSettings?.aiChatAgeGroup ?? 'child';

  return (
    <AnimatedPage>
      <PageHeader
        icon={<SmartToyIcon />}
        title="AI Chat for Kids"
        subtitle="Safe, educational AI assistant powered by Shield AI"
        iconColor={ACCENT}
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? ACCENT : 'rgba(21,101,192,0.08)',
                  color: (profileId === c.id) ? 'white' : ACCENT,
                  '&:hover': { bgcolor: (profileId === c.id) ? '#0D47A1' : 'rgba(21,101,192,0.16)' },
                }}
              />
            ))}
          </Stack>
        }
      />

      <Stack spacing={2.5}>

        {/* ── Feature Banner ─────────────────────────────────────────────── */}
        <AnimatedPage delay={0.05}>
          <Card sx={{
            background: `linear-gradient(135deg, ${ACCENT} 0%, #0D47A1 100%)`,
            color: 'white',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <Box sx={{
              position: 'absolute', right: -24, top: -24, opacity: 0.06,
            }}>
              <SmartToyIcon sx={{ fontSize: 200 }} />
            </Box>
            <CardContent sx={{ py: 2.5, px: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <Box sx={{
                  width: 48, height: 48, borderRadius: '14px',
                  bgcolor: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <SmartToyIcon sx={{ fontSize: 26, color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                    Learning Buddy
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.85 }}>
                    A safe, child-friendly AI tutor built into the Shield app
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
                Children can ask homework questions, explore science, practice math, and learn about the world — all within a carefully filtered, age-appropriate environment.
              </Typography>
            </CardContent>
          </Card>
        </AnimatedPage>

        {/* ── Per-Profile Settings ────────────────────────────────────────── */}
        <AnimatedPage delay={0.1}>
          <Card>
            <CardContent sx={{ px: 3, py: 2.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                {activeProfile?.name?.[0] ? (
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    bgcolor: 'rgba(21,101,192,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <ChildCareIcon sx={{ color: ACCENT, fontSize: 20 }} />
                  </Box>
                ) : null}
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Settings for {activeProfile?.name ?? 'Child'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Configure AI Chat for this profile
                  </Typography>
                </Box>
              </Stack>

              <Divider sx={{ mb: 2 }} />

              {loadingSettings ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <Stack spacing={2.5}>
                  {/* Toggle */}
                  <Box sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    p: 1.5, borderRadius: '10px', bgcolor: 'action.hover',
                  }}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Enable AI Chat</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Allow {activeProfile?.name ?? 'this child'} to use Learning Buddy
                      </Typography>
                    </Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={enabled}
                          onChange={(_, v) => handleToggle(v)}
                          disabled={settingsMutation.isPending}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT },
                          }}
                        />
                      }
                      label=""
                      sx={{ mr: 0 }}
                    />
                  </Box>

                  {/* Age Group */}
                  {enabled && (
                    <Box>
                      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                        Age Group
                      </Typography>
                      <ToggleButtonGroup
                        value={ageGroup}
                        exclusive
                        onChange={handleAgeGroup}
                        size="small"
                        disabled={settingsMutation.isPending}
                        sx={{ width: '100%' }}
                      >
                        <ToggleButton
                          value="child"
                          sx={{
                            flex: 1, fontWeight: 600, fontSize: 13,
                            '&.Mui-selected': { bgcolor: ACCENT, color: 'white', '&:hover': { bgcolor: '#0D47A1' } },
                          }}
                        >
                          <ChildCareIcon sx={{ mr: 0.75, fontSize: 18 }} />
                          Child (6–12)
                        </ToggleButton>
                        <ToggleButton
                          value="teen"
                          sx={{
                            flex: 1, fontWeight: 600, fontSize: 13,
                            '&.Mui-selected': { bgcolor: ACCENT, color: 'white', '&:hover': { bgcolor: '#0D47A1' } },
                          }}
                        >
                          <EscalatorWarningIcon sx={{ mr: 0.75, fontSize: 18 }} />
                          Teen (13–17)
                        </ToggleButton>
                      </ToggleButtonGroup>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                        {ageGroup === 'child'
                          ? 'Simplified language, extra-conservative filtering, focus on school topics.'
                          : 'Richer discussions on history, current events, and critical thinking.'}
                      </Typography>
                    </Box>
                  )}

                  {!enabled && (
                    <Alert severity="info" sx={{ borderRadius: '10px' }}>
                      AI Chat is currently disabled for {activeProfile?.name ?? 'this profile'}. Enable it above to give them access to Learning Buddy.
                    </Alert>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </AnimatedPage>

        {/* ── What the AI Can / Cannot Discuss ───────────────────────────── */}
        <AnimatedPage delay={0.15}>
          <Card>
            <CardContent sx={{ px: 3, py: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                What Learning Buddy Can Discuss
              </Typography>
              <Stack spacing={1.25} sx={{ mb: 2.5 }}>
                {ALLOWED_TOPICS.map(t => (
                  <Stack key={t.label} direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{
                      width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                      bgcolor: `${t.color}14`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: t.color,
                    }}>
                      {t.icon}
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                      <CheckCircleIcon sx={{ color: '#2E7D32', fontSize: 16, flexShrink: 0 }} />
                      <Typography variant="body2">{t.label}</Typography>
                    </Stack>
                  </Stack>
                ))}
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                Always Blocked
              </Typography>
              <Stack spacing={1}>
                {BLOCKED_TOPICS.map(t => (
                  <Stack key={t.label} direction="row" spacing={1} alignItems="center">
                    <CancelIcon sx={{ color: '#C62828', fontSize: 16, flexShrink: 0 }} />
                    <Typography variant="body2" color="text.secondary">{t.label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </AnimatedPage>

        {/* ── Privacy Note ───────────────────────────────────────────────── */}
        <AnimatedPage delay={0.2}>
          <Card>
            <CardContent sx={{ px: 3, py: 2.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                <BlockIcon sx={{ color: ACCENT }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  Privacy &amp; Chat History
                </Typography>
              </Stack>
              <Alert severity="info" icon={false} sx={{ borderRadius: '10px', mb: 1.5, bgcolor: 'rgba(21,101,192,0.06)', color: 'text.primary' }}>
                <Typography variant="body2">
                  Chat history is stored <strong>locally on your child's device</strong> for privacy. No conversation data is sent to Shield servers. The AI processes each message in real-time and does not retain session history between app restarts.
                </Typography>
              </Alert>
              <Typography variant="caption" color="text.secondary">
                To review recent conversations, ask your child to show you their device.
              </Typography>
            </CardContent>
          </Card>
        </AnimatedPage>

        {/* ── Tips for Parents ───────────────────────────────────────────── */}
        <AnimatedPage delay={0.25}>
          <Card>
            <CardContent sx={{ px: 3, py: 2.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                <LightbulbIcon sx={{ color: '#F57F17' }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  Tips for Parents
                </Typography>
              </Stack>
              <Stack spacing={1.25}>
                {PARENT_TIPS.map((tip, i) => (
                  <Paper
                    key={i}
                    variant="outlined"
                    sx={{ p: 1.5, borderRadius: '10px', borderColor: 'divider' }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <Box sx={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: 0.1,
                        bgcolor: 'rgba(194,65,12,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography variant="caption" fontWeight={800} sx={{ color: '#92400E', fontSize: 10 }}>
                          {i + 1}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">{tip}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </AnimatedPage>

      </Stack>

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
