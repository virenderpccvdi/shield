import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Stack, Alert, Snackbar, Grid, Tab, Tabs,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LockIcon from '@mui/icons-material/Lock';
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

const ICON_COLOR = '#F9A825';
const BG_COLOR = 'rgba(249,168,37,0.10)';

interface ChildProfile { id: string; name: string; }

interface Badge {
  id: string;
  name: string;
  description: string;
  iconEmoji: string;
  category: string;
  threshold: number;
}

interface EarnedBadge {
  id: string;
  profileId: string;
  badgeId: string;
  earnedAt: string;
  badge: Omit<Badge, 'threshold'>;
}

const CATEGORIES = ['All', 'Tasks', 'Safety', 'Learning', 'Streak'];

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Tasks:    { bg: 'rgba(21,101,192,0.10)', color: '#1565C0' },
  Safety:   { bg: 'rgba(198,40,40,0.10)',  color: '#C62828' },
  Learning: { bg: 'rgba(46,125,50,0.10)',  color: '#2E7D32' },
  Streak:   { bg: 'rgba(230,81,0,0.10)',   color: '#92400E' },
  All:      { bg: BG_COLOR,               color: ICON_COLOR },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function EarnedCard({ earned }: { earned: EarnedBadge }) {
  const cat = earned.badge.category ?? 'All';
  const colors = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['All'];
  return (
    <Card sx={{
      height: '100%',
      border: '1px solid',
      borderColor: colors.color + '33',
      bgcolor: colors.bg,
      transition: 'transform 0.15s, box-shadow 0.15s',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
    }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack spacing={1.5} alignItems="flex-start">
          <Box sx={{
            width: 52, height: 52, borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'background.paper',
            border: '2px solid',
            borderColor: colors.color + '44',
            fontSize: 28,
          }}>
            {earned.badge.iconEmoji || <EmojiEventsIcon sx={{ fontSize: 26, color: colors.color }} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {earned.badge.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.4 }}>
              {earned.badge.description}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
            <Chip
              label={earned.badge.category}
              size="small"
              sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: colors.bg, color: colors.color, border: `1px solid ${colors.color}33` }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
              {formatDate(earned.earnedAt)}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function LockedCard({ badge }: { badge: Badge }) {
  return (
    <Card sx={{
      height: '100%',
      bgcolor: 'action.hover',
      border: '1px solid',
      borderColor: 'divider',
      opacity: 0.7,
    }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack spacing={1.5} alignItems="flex-start">
          <Box sx={{
            width: 52, height: 52, borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'background.paper',
            border: '2px solid',
            borderColor: 'divider',
            position: 'relative',
          }}>
            <Typography sx={{ fontSize: 24, filter: 'grayscale(1)', opacity: 0.5 }}>
              {badge.iconEmoji || '🏅'}
            </Typography>
            <Box sx={{
              position: 'absolute', bottom: -4, right: -4,
              width: 18, height: 18, borderRadius: '50%',
              bgcolor: 'background.default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid',
              borderColor: 'divider',
            }}>
              <LockIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
            </Box>
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight={600} color="text.secondary" noWrap>
              {badge.name}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25, lineHeight: 1.4 }}>
              {badge.description}
            </Typography>
          </Box>
          <Chip
            label={badge.category}
            size="small"
            sx={{ height: 20, fontSize: 10, fontWeight: 600, color: 'text.disabled', bgcolor: 'transparent', border: '1px solid', borderColor: 'divider' }}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function AchievementsPage() {
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [categoryTab, setCategoryTab] = useState(0);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => [] as ChildProfile[]),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const { data: allBadges, isLoading: loadingBadges } = useQuery({
    queryKey: ['all-badges'],
    queryFn: () =>
      api.get('/rewards/badges')
        .then(r => {
          const d = r.data?.data;
          return (d?.content ?? d ?? []) as Badge[];
        }).catch(() => []),
  });

  const { data: earnedBadges, isLoading: loadingEarned } = useQuery({
    queryKey: ['earned-badges', profileId],
    queryFn: () =>
      api.get(`/rewards/badges/profile/${profileId}`)
        .then(r => {
          const d = r.data?.data;
          return (d?.content ?? d ?? []) as EarnedBadge[];
        }).catch(() => []),
    enabled: !!profileId,
  });

  const selectedCategory = CATEGORIES[categoryTab];
  const earnedBadgeIds = new Set((earnedBadges ?? []).map(e => e.badgeId));

  const filteredEarned = (earnedBadges ?? []).filter(e =>
    selectedCategory === 'All' || e.badge.category === selectedCategory
  );

  const notEarnedBadges = (allBadges ?? []).filter(b =>
    !earnedBadgeIds.has(b.id) &&
    (selectedCategory === 'All' || b.category === selectedCategory)
  );

  const totalEarned = (earnedBadges ?? []).length;
  const totalBadges = (allBadges ?? []).length;
  const remaining = totalBadges - totalEarned;

  if (loadingChildren) return <LoadingPage />;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader
          icon={<EmojiEventsIcon />}
          title="Achievements"
          subtitle="View your child's earned badges and milestones"
          iconColor={ICON_COLOR}
        />
        <EmptyState title="No child profiles" description="Add a child profile first to view achievements" />
      </AnimatedPage>
    );
  }

  const isLoading = loadingBadges || loadingEarned;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<EmojiEventsIcon />}
        title="Achievements"
        subtitle="Celebrate your child's accomplishments and milestones"
        iconColor={ICON_COLOR}
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: profileId === c.id ? ICON_COLOR : BG_COLOR,
                  color: profileId === c.id ? 'white' : ICON_COLOR,
                  '&:hover': { bgcolor: profileId === c.id ? '#F57F17' : 'rgba(249,168,37,0.18)' },
                }}
              />
            ))}
          </Stack>
        }
      />

      {/* Stats row */}
      <AnimatedPage delay={0.05}>
        <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
          <Card sx={{ flex: 1, minWidth: 140 }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: BG_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmojiEventsIcon sx={{ color: ICON_COLOR, fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={800} color={ICON_COLOR}>{totalEarned}</Typography>
                  <Typography variant="caption" color="text.secondary">Badges earned</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 140 }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmojiObjectsIcon sx={{ color: 'text.secondary', fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={800} color="text.secondary">{remaining}</Typography>
                  <Typography variant="caption" color="text.secondary">Remaining</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </AnimatedPage>

      {/* Category filter tabs */}
      <AnimatedPage delay={0.08}>
        <Card sx={{ mb: 3 }}>
          <Tabs
            value={categoryTab}
            onChange={(_, v) => setCategoryTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 1,
              '& .MuiTab-root': { fontSize: 13, fontWeight: 600, textTransform: 'none', minHeight: 44 },
              '& .Mui-selected': { color: ICON_COLOR },
              '& .MuiTabs-indicator': { bgcolor: ICON_COLOR },
            }}
          >
            {CATEGORIES.map(cat => (
              <Tab key={cat} label={cat} />
            ))}
          </Tabs>
        </Card>
      </AnimatedPage>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <AnimatedPage delay={0.12}>
          {/* Earned badges */}
          {filteredEarned.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="overline" sx={{ px: 0.5, color: 'text.disabled', fontSize: 10, fontWeight: 700, letterSpacing: 1.5 }}>
                Earned ({filteredEarned.length})
              </Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {filteredEarned.map(e => (
                  <Grid key={e.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <EarnedCard earned={e} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Not yet earned */}
          {notEarnedBadges.length > 0 && (
            <Box>
              <Typography variant="overline" sx={{ px: 0.5, color: 'text.disabled', fontSize: 10, fontWeight: 700, letterSpacing: 1.5 }}>
                Not yet earned ({notEarnedBadges.length})
              </Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {notEarnedBadges.map(b => (
                  <Grid key={b.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <LockedCard badge={b} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {filteredEarned.length === 0 && notEarnedBadges.length === 0 && (
            <Card>
              <CardContent sx={{ py: 5, textAlign: 'center' }}>
                <EmojiEventsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
                <Typography variant="h6" fontWeight={600} color="text.secondary">
                  No badges in this category
                </Typography>
              </CardContent>
            </Card>
          )}
        </AnimatedPage>
      )}

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
