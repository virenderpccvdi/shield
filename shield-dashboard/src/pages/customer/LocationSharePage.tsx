import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Button, Stack, Alert, Snackbar, Divider, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Switch, FormControlLabel, Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ShareIcon from '@mui/icons-material/Share';
import AddLinkIcon from '@mui/icons-material/AddLink';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface ChildProfile { id: string; name: string; }

interface LocationShare {
  id: string;
  shareToken: string;
  label: string;
  expiresAt: string;
  maxViews: number | null;
  viewCount: number;
  isActive: boolean;
  shareUrl: string;
}

interface CreateShareForm {
  label: string;
  durationHours: number;
  maxViewsEnabled: boolean;
  maxViews: number;
}

const DURATION_OPTIONS = [
  { label: '1 hour', value: 1 },
  { label: '6 hours', value: 6 },
  { label: '24 hours', value: 24 },
  { label: '3 days', value: 72 },
  { label: '7 days', value: 168 },
];

const FORM_INITIAL: CreateShareForm = {
  label: '',
  durationHours: 24,
  maxViewsEnabled: false,
  maxViews: 10,
};

function formatExpiry(expiresAt: string): string {
  try {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `Expires in ${days} day${days !== 1 ? 's' : ''}`;
    }
    if (hours > 0) return `Expires in ${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();
    return `Expires in ${mins}m`;
  } catch {
    return expiresAt;
  }
}

function truncateToken(token: string): string {
  return token.length > 12 ? `${token.slice(0, 8)}...${token.slice(-4)}` : token;
}

export default function LocationSharePage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; shareId: string | null; label: string }>({
    open: false, shareId: null, label: '',
  });
  const [form, setForm] = useState<CreateShareForm>(FORM_INITIAL);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () =>
      api.get('/profiles/children').then(r => {
        const d = r.data?.data;
        return (d?.content ?? d ?? r.data) as ChildProfile[];
      }).catch(() => [] as ChildProfile[]),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const { data: shares, isLoading: loadingShares } = useQuery({
    queryKey: ['location-shares', profileId],
    queryFn: () =>
      api.get(`/location/shares/${profileId}`)
        .then(r => {
          const d = r.data?.data ?? r.data;
          return (Array.isArray(d) ? d : d?.content ?? []) as LocationShare[];
        }).catch(() => [] as LocationShare[]),
    enabled: !!profileId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { profileId: string; label: string; durationHours: number; maxViews: number | null }) =>
      api.post('/location/shares', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-shares', profileId] });
      setCreateDialog(false);
      setForm(FORM_INITIAL);
      setSnackbar({ open: true, message: 'Share link created successfully', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to create share link', severity: 'error' }),
  });

  const revokeMutation = useMutation({
    mutationFn: (shareId: string) => api.delete(`/location/shares/${shareId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-shares', profileId] });
      setRevokeDialog({ open: false, shareId: null, label: '' });
      setSnackbar({ open: true, message: 'Share link revoked', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to revoke share link', severity: 'error' }),
  });

  const handleCreate = () => {
    if (!profileId) return;
    createMutation.mutate({
      profileId,
      label: form.label.trim(),
      durationHours: form.durationHours,
      maxViews: form.maxViewsEnabled ? form.maxViews : null,
    });
  };

  const handleCopy = async (share: LocationShare) => {
    try {
      await navigator.clipboard.writeText(share.shareUrl);
      setCopiedId(share.id);
      setSnackbar({ open: true, message: 'Link copied to clipboard!', severity: 'info' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setSnackbar({ open: true, message: 'Failed to copy link', severity: 'error' });
    }
  };

  if (loadingChildren) return <LoadingPage />;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader
          icon={<ShareIcon />}
          title="Share Location"
          subtitle="Create shareable location links for extended family"
          iconColor="#00695C"
        />
        <EmptyState
          title="No child profiles"
          description="Add a child profile first to create location share links"
        />
      </AnimatedPage>
    );
  }

  const activeShares = (shares ?? []).filter(s => s.isActive);

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ShareIcon />}
        title="Share Location"
        subtitle="Create temporary links so family members can view your child's location"
        iconColor="#00695C"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: profileId === c.id ? '#00695C' : 'rgba(0,105,92,0.08)',
                  color: profileId === c.id ? 'white' : '#00695C',
                  '&:hover': { bgcolor: profileId === c.id ? '#004D40' : 'rgba(0,105,92,0.16)' },
                }}
              />
            ))}
            <Button
              variant="contained"
              size="small"
              startIcon={<AddLinkIcon />}
              onClick={() => { setForm(FORM_INITIAL); setCreateDialog(true); }}
              disabled={!profileId}
              sx={{ bgcolor: '#00695C', '&:hover': { bgcolor: '#004D40' }, fontWeight: 600 }}
            >
              Create Share Link
            </Button>
          </Stack>
        }
      />

      {loadingShares ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : activeShares.length === 0 ? (
        <AnimatedPage delay={0.1}>
          <Card>
            <CardContent sx={{ py: 5, textAlign: 'center' }}>
              <LinkOffIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
              <Typography variant="h6" fontWeight={600} color="text.secondary" gutterBottom>
                No active shares
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mb: 2.5 }}>
                Create a share link so grandparents or other family members can see your child's location
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddLinkIcon />}
                onClick={() => { setForm(FORM_INITIAL); setCreateDialog(true); }}
                sx={{ bgcolor: '#00695C', '&:hover': { bgcolor: '#004D40' }, fontWeight: 600 }}
              >
                Create First Share
              </Button>
            </CardContent>
          </Card>
        </AnimatedPage>
      ) : (
        <AnimatedPage delay={0.1}>
          <Stack spacing={2}>
            {activeShares.map((share) => {
              const isExpired = new Date(share.expiresAt).getTime() <= Date.now();
              const expiryLabel = formatExpiry(share.expiresAt);
              const viewsExhausted = share.maxViews !== null && share.viewCount >= share.maxViews;

              return (
                <Card
                  key={share.id}
                  sx={{
                    border: '1px solid',
                    borderColor: isExpired || viewsExhausted ? 'error.light' : 'divider',
                    opacity: isExpired || viewsExhausted ? 0.7 : 1,
                  }}
                >
                  <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-start' }} spacing={1.5}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                          <Typography variant="body1" fontWeight={700}>
                            {share.label || 'Untitled share'}
                          </Typography>
                          {(isExpired || viewsExhausted) && (
                            <Chip
                              size="small"
                              label={isExpired ? 'Expired' : 'Views exhausted'}
                              sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: '#FFEBEE', color: '#C62828' }}
                            />
                          )}
                        </Stack>

                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', display: 'block', mb: 1 }}>
                          Token: {truncateToken(share.shareToken)}
                        </Typography>

                        <Stack direction="row" spacing={2} flexWrap="wrap">
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <AccessTimeIcon sx={{ fontSize: 14, color: isExpired ? 'error.main' : 'text.secondary' }} />
                            <Typography variant="caption" sx={{ color: isExpired ? 'error.main' : 'text.secondary', fontWeight: 500 }}>
                              {expiryLabel}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              {share.viewCount} view{share.viewCount !== 1 ? 's' : ''}
                              {share.maxViews !== null && ` / ${share.maxViews} max`}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Box>

                      <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                        <Tooltip title={copiedId === share.id ? 'Copied!' : 'Copy link'}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ContentCopyIcon fontSize="small" />}
                            onClick={() => handleCopy(share)}
                            sx={{
                              fontWeight: 600,
                              fontSize: 12,
                              borderColor: copiedId === share.id ? '#2E7D32' : undefined,
                              color: copiedId === share.id ? '#2E7D32' : undefined,
                            }}
                          >
                            {copiedId === share.id ? 'Copied!' : 'Copy'}
                          </Button>
                        </Tooltip>
                        <Tooltip title="Revoke share">
                          <IconButton
                            size="small"
                            onClick={() => setRevokeDialog({ open: true, shareId: share.id, label: share.label || 'this share' })}
                            sx={{ color: 'error.light', '&:hover': { color: 'error.main', bgcolor: '#FFEBEE' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </AnimatedPage>
      )}

      {/* Create Share Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create Share Link</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Label (optional)"
              placeholder="e.g. Grandma's share"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              size="small"
              fullWidth
              helperText="Help identify this share link later"
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Duration</InputLabel>
              <Select
                value={form.durationHours}
                label="Duration"
                onChange={e => setForm(f => ({ ...f, durationHours: Number(e.target.value) }))}
              >
                {DURATION_OPTIONS.map(o => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.maxViewsEnabled}
                    onChange={e => setForm(f => ({ ...f, maxViewsEnabled: e.target.checked }))}
                    size="small"
                    sx={{ '& .MuiSwitch-thumb': { bgcolor: '#00695C' }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: '#00695C' } }}
                  />
                }
                label={<Typography variant="body2" fontWeight={600}>Limit max views</Typography>}
              />
              {form.maxViewsEnabled && (
                <TextField
                  label="Max views"
                  type="number"
                  value={form.maxViews}
                  onChange={e => setForm(f => ({ ...f, maxViews: Math.max(1, parseInt(e.target.value) || 1) }))}
                  size="small"
                  inputProps={{ min: 1, max: 100 }}
                  sx={{ mt: 1.5, width: 140 }}
                  helperText="Link expires after this many views"
                />
              )}
            </Box>

            <Divider />
            <Typography variant="caption" color="text.secondary">
              The recipient will be able to see the child's current location without needing to log in.
              The link automatically expires after the selected duration.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCreateDialog(false)} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={createMutation.isPending || !profileId}
            sx={{ bgcolor: '#00695C', '&:hover': { bgcolor: '#004D40' }, fontWeight: 600 }}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Link'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={revokeDialog.open} onClose={() => setRevokeDialog({ open: false, shareId: null, label: '' })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Revoke Share Link</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Revoke <strong>{revokeDialog.label}</strong>? Anyone with this link will no longer be able to view the location.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setRevokeDialog({ open: false, shareId: null, label: '' })} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => revokeDialog.shareId && revokeMutation.mutate(revokeDialog.shareId)}
            disabled={revokeMutation.isPending}
            sx={{ fontWeight: 600 }}
          >
            {revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
          </Button>
        </DialogActions>
      </Dialog>

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
