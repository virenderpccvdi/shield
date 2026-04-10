import {
  Box, Typography, Card, CardContent, Avatar, Chip, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, CircularProgress,
  Alert, Divider, IconButton, Tooltip, Snackbar, List, ListItem,
  ListItemAvatar, ListItemText, ListItemSecondaryAction,
} from '@mui/material';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import EmailIcon from '@mui/icons-material/Email';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend';
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

const THEME_COLOR = '#1A237E';

function fmtDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function avatarLetters(email: string) {
  return email?.charAt(0)?.toUpperCase() ?? 'C';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoParentPage() {
  const [items, setItems] = useState<FamilyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Snackbar
  const [snack, setSnack] = useState('');

  const fetchFamily = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/profiles/family');
      setItems(res.data?.data ?? res.data ?? []);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to load family members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFamily(); }, [fetchFamily]);

  // ── Filtered views ──────────────────────────────────────────────────────────
  const coParents = items.filter(
    (i) => !isInvite(i) && (i as FamilyMember).role === 'CO_PARENT'
  ) as FamilyMember[];

  const pendingInvites = items.filter(
    (i) => isInvite(i) && (i as FamilyInvite).status === 'PENDING'
  ) as FamilyInvite[];

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      await api.post('/profiles/family/invite', {
        email: inviteEmail.trim().toLowerCase(),
        role: 'CO_PARENT',
      });
      setSnack('Invitation sent to ' + inviteEmail.trim());
      setInviteOpen(false);
      setInviteEmail('');
      fetchFamily();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setInviteError(msg ?? 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (memberId: string) => {
    try {
      await api.delete(`/profiles/family/${memberId}`);
      setSnack('Co-parent access revoked');
      fetchFamily();
    } catch {
      setSnack('Failed to revoke access');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await api.delete(`/profiles/family/invites/${inviteId}`);
      setSnack('Invite cancelled');
      fetchFamily();
    } catch {
      setSnack('Failed to cancel invite');
    }
  };

  if (loading) return <LoadingPage />;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<SupervisorAccountIcon />}
        title="Co-Parent Access"
        subtitle="Share full parental access with a partner or trusted adult"
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchFamily} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<GroupAddIcon />}
              onClick={() => setInviteOpen(true)}
              sx={{ bgcolor: THEME_COLOR, '&:hover': { bgcolor: '#283593' } }}
            >
              Invite Co-Parent
            </Button>
          </Box>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Info card */}
      <Card sx={{ mb: 3, borderLeft: `4px solid ${THEME_COLOR}`, bgcolor: '#E8EAF6' }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <InfoOutlinedIcon sx={{ color: THEME_COLOR, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ color: THEME_COLOR }}>
              Co-parents have <strong>full access</strong> to all child profiles and controls —
              DNS rules, schedules, location, rewards, and real-time alerts.
              They can approve or deny requests and respond to SOS alerts.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Active Co-Parents */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PeopleAltIcon sx={{ color: THEME_COLOR }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: THEME_COLOR }}>
              Active Co-Parents
            </Typography>
            <Chip label={coParents.length} size="small" sx={{ bgcolor: THEME_COLOR, color: 'white', fontWeight: 700 }} />
          </Box>

          {coParents.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <PeopleAltIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No co-parents yet</Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                Invite a partner or trusted adult to share parental access
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {coParents.map((member) => (
                <ListItem
                  key={member.id}
                  sx={{
                    px: 0,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: THEME_COLOR, width: 40, height: 40, fontWeight: 700 }}>
                      {member.userId?.charAt(0)?.toUpperCase() ?? 'C'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" fontWeight={600}>Co-Parent</Typography>
                        <Chip label="Active" size="small" color="success" sx={{ height: 20, fontSize: 11 }} />
                      </Box>
                    }
                    secondary={`Added ${fmtDate(member.createdAt)}`}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Revoke access">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRevoke(member.id)}
                      >
                        <PersonRemoveIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Pending Invites */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ScheduleSendIcon sx={{ color: '#C2410C' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#92400E' }}>
              Pending Invites
            </Typography>
            {pendingInvites.length > 0 && (
              <Chip label={pendingInvites.length} size="small" sx={{ bgcolor: '#C2410C', color: 'white', fontWeight: 700 }} />
            )}
          </Box>

          {pendingInvites.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No pending invites
            </Typography>
          ) : (
            <List disablePadding>
              {pendingInvites.map((invite) => (
                <ListItem
                  key={invite.id}
                  sx={{
                    px: 0,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: '#C2410C', width: 40, height: 40, fontWeight: 700 }}>
                      {avatarLetters(invite.email)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body1" fontWeight={600}>{invite.email}</Typography>
                        <Chip label="Pending" size="small" sx={{ bgcolor: '#FFF3E0', color: '#92400E', fontWeight: 600, height: 20, fontSize: 11 }} />
                      </Box>
                    }
                    secondary={
                      <>
                        Sent {fmtDate(invite.createdAt)}
                        {invite.expiresAt && ` · Expires ${fmtDate(invite.expiresAt)}`}
                      </>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Cancel invite">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleCancelInvite(invite.id)}
                      >
                        <PersonRemoveIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmailIcon sx={{ color: THEME_COLOR }} />
          Invite a Co-Parent
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the email address of the person you want to invite. They will receive an
            email with a link to accept co-parent access to your family's account.
          </Typography>
          {inviteError && <Alert severity="error" sx={{ mb: 2 }}>{inviteError}</Alert>}
          <TextField
            label="Email address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            fullWidth
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
            helperText="They must have or create a Shield account to accept"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setInviteOpen(false); setInviteEmail(''); setInviteError(null); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            sx={{ bgcolor: THEME_COLOR, '&:hover': { bgcolor: '#283593' } }}
          >
            {inviting ? <CircularProgress size={18} color="inherit" /> : 'Send Invite'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={3500}
        onClose={() => setSnack('')}
        message={snack}
      />
    </AnimatedPage>
  );
}
