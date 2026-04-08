import {
  Box, Typography, Card, CardContent, Avatar, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  CircularProgress, Alert, Divider, IconButton, Tooltip, Snackbar,
  Grid,
} from '@mui/material';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import RefreshIcon from '@mui/icons-material/Refresh';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import SendIcon from '@mui/icons-material/Send';
import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import LoadingPage from '../../components/LoadingPage';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: string;
  status: string;
  invitedBy?: string;
  createdAt?: string;
}

interface FamilyInvite {
  id: string;
  familyId: string;
  email: string;
  role: string;
  status: string;
  expiresAt?: string;
  createdAt?: string;
}

type FamilyItem = FamilyMember | FamilyInvite;

function isInvite(item: FamilyItem): item is FamilyInvite {
  return 'email' in item;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GUARDIAN:  { bg: '#E3F2FD', text: '#1565C0', border: '#BBDEFB' },
  CO_PARENT: { bg: '#F3E5F5', text: '#6A1B9A', border: '#E1BEE7' },
  OBSERVER:  { bg: '#E0F2F1', text: '#00695C', border: '#B2DFDB' },
};

function roleLabel(role: string) {
  switch (role?.toUpperCase()) {
    case 'GUARDIAN':  return 'Guardian';
    case 'CO_PARENT': return 'Co-Parent';
    case 'OBSERVER':  return 'Observer';
    default: return role;
  }
}

function expiryLabel(expiresAt?: string) {
  if (!expiresAt) return null;
  try {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    if (days > 0) return `Expires in ${days}d`;
    if (hours > 0) return `Expires in ${hours}h`;
    return 'Expiring soon';
  } catch {
    return null;
  }
}

function getInitial(str: string) {
  return str ? str[0].toUpperCase() : '?';
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FamilyMembersPage() {
  const [items, setItems]     = useState<FamilyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Invite dialog
  const [inviteOpen, setInviteOpen]   = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState('CO_PARENT');
  const [inviting, setInviting]       = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Cancel invite dialog
  const [cancelTarget, setCancelTarget] = useState<FamilyInvite | null>(null);
  const [cancelling, setCancelling]     = useState(false);

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState<FamilyMember | null>(null);
  const [removing, setRemoving]         = useState(false);

  // Snackbar
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });

  const showSnack = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnack({ open: true, message, severity });

  const loadFamily = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/profiles/family');
      setItems(data.data ?? []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to load family members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFamily(); }, [loadFamily]);

  const members = items.filter((i): i is FamilyMember => !isInvite(i));
  const invites  = items.filter((i): i is FamilyInvite  => isInvite(i));

  // ── Invite ────────────────────────────────────────────────────────────────

  const handleInvite = async () => {
    setInviteError(null);
    if (!inviteEmail.trim()) { setInviteError('Email is required'); return; }
    if (!/^[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}$/.test(inviteEmail.trim())) {
      setInviteError('Enter a valid email address'); return;
    }
    setInviting(true);
    try {
      await api.post('/profiles/family/invite', { email: inviteEmail.trim(), role: inviteRole });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('CO_PARENT');
      showSnack(`Invite sent to ${inviteEmail.trim()}`);
      await loadFamily();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setInviteError(e.response?.data?.message ?? 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  // ── Cancel invite ─────────────────────────────────────────────────────────

  const handleCancelInviteConfirm = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.delete(`/profiles/family/invites/${cancelTarget.id}`);
      setCancelTarget(null);
      showSnack(`Invite to ${cancelTarget.email} cancelled`);
      await loadFamily();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showSnack(e.response?.data?.message ?? 'Failed to cancel invite', 'error');
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  };

  // ── Remove member ─────────────────────────────────────────────────────────

  const handleRemoveConfirm = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.delete(`/profiles/family/${removeTarget.id}`);
      setRemoveTarget(null);
      showSnack('Family member removed');
      await loadFamily();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showSnack(e.response?.data?.message ?? 'Failed to remove member', 'error');
      setRemoveTarget(null);
    } finally {
      setRemoving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AnimatedPage>
      <PageHeader
        icon={<FamilyRestroomIcon />}
        title="Family Members"
        subtitle="Manage co-parents and family access"
        iconColor="#6A1B9A"
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={loadFamily} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<GroupAddIcon />}
              onClick={() => setInviteOpen(true)}
              sx={{
                borderRadius: 2,
                background: 'linear-gradient(135deg, #6A1B9A 0%, #4A148C 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #7B1FA2 0%, #6A1B9A 100%)' },
              }}
            >
              Invite Co-Parent
            </Button>
          </Box>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <LoadingPage />
      ) : (
        <Grid container spacing={{ xs: 2, md: 3 }}>

          {/* ── Info banner ────────────────────────────────────────────── */}
          <Grid size={12}>
            <Card sx={{
              background: 'linear-gradient(135deg, #1A237E 0%, #283593 100%)',
              color: 'white',
            }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                  width: 48, height: 48, borderRadius: '14px',
                  bgcolor: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <FamilyRestroomIcon sx={{ color: 'white', fontSize: 26 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                    {invites.length > 0 ? ` · ${invites.length} pending invite${invites.length > 1 ? 's' : ''}` : ''}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.25 }}>
                    Co-parents have full access to manage children's settings. Observers can view but not change settings.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* ── Active Members ─────────────────────────────────────────── */}
          {members.length > 0 && (
            <Grid size={12}>
              <AnimatedPage delay={0.1}>
                <Card>
                  <CardContent>
                    <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 1.2 }}>
                      Active Members
                    </Typography>
                    <Box sx={{ mt: 1.5 }}>
                      {members.map((member, i) => {
                        const role = member.role?.toUpperCase() ?? 'CO_PARENT';
                        const rc = ROLE_COLORS[role] ?? ROLE_COLORS.CO_PARENT;
                        const isGuardian = role === 'GUARDIAN';
                        const shortId = member.userId?.substring(0, 8) ?? '';

                        return (
                          <Box key={member.id}>
                            {i > 0 && <Divider sx={{ my: 1.5 }} />}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Avatar sx={{
                                bgcolor: rc.bg, color: rc.text,
                                fontWeight: 700, width: 44, height: 44,
                              }}>
                                {getInitial(shortId)}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography fontWeight={600} variant="body2">
                                  {isGuardian ? 'You (Account Owner)' : 'Family Member'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                  ID: {shortId}…
                                </Typography>
                              </Box>
                              <Chip
                                label={roleLabel(role)}
                                size="small"
                                sx={{
                                  bgcolor: rc.bg, color: rc.text,
                                  border: `1px solid ${rc.border}`,
                                  fontWeight: 700, fontSize: 11,
                                }}
                              />
                              {!isGuardian && (
                                <Tooltip title="Remove member">
                                  <IconButton
                                    size="small"
                                    onClick={() => setRemoveTarget(member)}
                                    sx={{ color: 'error.main', ml: 0.5 }}
                                  >
                                    <PersonRemoveIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          )}

          {/* ── Pending Invites ────────────────────────────────────────── */}
          {invites.length > 0 && (
            <Grid size={12}>
              <AnimatedPage delay={0.2}>
                <Card>
                  <CardContent>
                    <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 1.2 }}>
                      Pending Invites
                    </Typography>
                    <Box sx={{ mt: 1.5 }}>
                      {invites.map((invite, i) => {
                        const role = invite.role?.toUpperCase() ?? 'CO_PARENT';
                        const rc = ROLE_COLORS[role] ?? ROLE_COLORS.CO_PARENT;
                        const expiry = expiryLabel(invite.expiresAt);

                        return (
                          <Box key={invite.id}>
                            {i > 0 && <Divider sx={{ my: 1.5 }} />}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Avatar sx={{
                                bgcolor: '#FFF3E0', color: '#F57C00',
                                fontWeight: 700, width: 44, height: 44,
                              }}>
                                {getInitial(invite.email)}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography fontWeight={600} variant="body2" noWrap>
                                  {invite.email}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                                  <Chip
                                    label="Pending"
                                    size="small"
                                    sx={{ bgcolor: '#FFF8E1', color: '#F57C00', fontWeight: 700, fontSize: 10, height: 20 }}
                                  />
                                  {expiry && (
                                    <Typography variant="caption" color="text.secondary">
                                      {expiry}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                              <Chip
                                label={roleLabel(role)}
                                size="small"
                                sx={{
                                  bgcolor: rc.bg, color: rc.text,
                                  border: `1px solid ${rc.border}`,
                                  fontWeight: 700, fontSize: 11,
                                }}
                              />
                              <Tooltip title="Cancel this invite">
                                <Button
                                  size="small"
                                  color="error"
                                  startIcon={<CancelOutlinedIcon fontSize="small" />}
                                  onClick={() => setCancelTarget(invite)}
                                  sx={{ ml: 0.5, borderRadius: 2, fontSize: 12, whiteSpace: 'nowrap' }}
                                >
                                  Cancel
                                </Button>
                              </Tooltip>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          )}

          {/* ── Empty state ─────────────────────────────────────────────── */}
          {members.length === 0 && invites.length === 0 && (
            <Grid size={12}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 7 }}>
                  <Box sx={{
                    width: 72, height: 72, borderRadius: '50%',
                    bgcolor: '#F3E5F5', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', mx: 'auto', mb: 2,
                  }}>
                    <GroupAddIcon sx={{ color: '#6A1B9A', fontSize: 34 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                    No co-parents yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 360, mx: 'auto' }}>
                    Invite your partner or a trusted guardian to help manage your children's internet settings and monitoring.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<GroupAddIcon />}
                    onClick={() => setInviteOpen(true)}
                    sx={{
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #6A1B9A 0%, #4A148C 100%)',
                    }}
                  >
                    Invite Co-Parent
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* ── Invite dialog ──────────────────────────────────────────────────── */}
      <Dialog
        open={inviteOpen}
        onClose={() => { setInviteOpen(false); setInviteError(null); setInviteEmail(''); setInviteRole('CO_PARENT'); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '10px',
              bgcolor: '#F3E5F5', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GroupAddIcon sx={{ color: '#6A1B9A', fontSize: 20 }} />
            </Box>
            Invite Co-Parent
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            They'll receive an invite to join your family and help manage your children's settings.
          </Typography>
          {inviteError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{inviteError}</Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Email address"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              fullWidth
              size="small"
              placeholder="partner@example.com"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              select
              label="Role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              fullWidth
              size="small"
              helperText={
                inviteRole === 'CO_PARENT'
                  ? 'Can view and change all settings'
                  : 'Can view settings but not make changes'
              }
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            >
              <MenuItem value="CO_PARENT">Co-Parent — Full access</MenuItem>
              <MenuItem value="OBSERVER">Observer — View only</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
          <Button
            onClick={() => { setInviteOpen(false); setInviteError(null); setInviteEmail(''); setInviteRole('CO_PARENT'); }}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={inviting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={handleInvite}
            disabled={inviting}
            sx={{
              borderRadius: 2,
              background: 'linear-gradient(135deg, #6A1B9A 0%, #4A148C 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #7B1FA2 0%, #6A1B9A 100%)' },
            }}
          >
            {inviting ? 'Sending…' : 'Send Invite'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Remove member dialog ───────────────────────────────────────────── */}
      <Dialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Remove Member</DialogTitle>
        <DialogContent>
          <Typography>
            Remove this family member? They will lose access to your children's settings.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
          <Button onClick={() => setRemoveTarget(null)} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRemoveConfirm}
            disabled={removing}
            sx={{ borderRadius: 2 }}
          >
            {removing ? <CircularProgress size={20} color="inherit" /> : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Cancel invite dialog ───────────────────────────────────────────── */}
      <Dialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Cancel Invite</DialogTitle>
        <DialogContent>
          <Typography>
            Cancel the pending invite to <strong>{cancelTarget?.email}</strong>?
            They will no longer be able to accept this invitation.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
          <Button onClick={() => setCancelTarget(null)} sx={{ borderRadius: 2 }}>Keep</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancelInviteConfirm}
            disabled={cancelling}
            sx={{ borderRadius: 2 }}
          >
            {cancelling ? <CircularProgress size={20} color="inherit" /> : 'Cancel Invite'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ───────────────────────────────────────────────────────── */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
