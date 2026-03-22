import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, CircularProgress, Alert,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';

export default function FamilyInviteAcceptPage() {
  const [params] = useSearchParams();
  const navigate   = useNavigate();
  const token      = params.get('token') ?? '';
  const isLoggedIn = useAuthStore((s) => s.isAuthenticated());

  const [status, setStatus] = useState<'idle' | 'accepting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [role, setRole] = useState('');

  // Auto-accept once logged in and token is present
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid invite link — no token found.');
      return;
    }
    if (!isLoggedIn) return; // wait for user to log in
    accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isLoggedIn]);

  async function accept() {
    setStatus('accepting');
    try {
      const { data } = await api.post(`/profiles/family/accept?token=${encodeURIComponent(token)}`);
      setRole(data?.data?.role ?? '');
      setStatus('success');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setMessage(e.response?.data?.message ?? 'Failed to accept invite. The link may have expired.');
      setStatus('error');
    }
  }

  // Not logged in — prompt them
  if (!isLoggedIn && status !== 'error') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC', p: 2 }}>
        <Card sx={{ maxWidth: 440, width: '100%', borderRadius: 3, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Box sx={{
              width: 72, height: 72, borderRadius: '50%',
              bgcolor: '#E3F2FD', display: 'flex', alignItems: 'center',
              justifyContent: 'center', mx: 'auto', mb: 2.5,
            }}>
              <GroupAddIcon sx={{ fontSize: 36, color: '#1565C0' }} />
            </Box>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
              Family Invitation
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              You've been invited to join a Shield Family. Sign in or create an account to accept.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={() => navigate(`/login?redirect=/family/invite?token=${encodeURIComponent(token)}`)}
                sx={{ borderRadius: 2, background: 'linear-gradient(135deg,#1565C0,#1976D2)', minWidth: 140 }}
              >
                Sign In
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate(`/register?redirect=/family/invite?token=${encodeURIComponent(token)}`)}
                sx={{ borderRadius: 2, minWidth: 140 }}
              >
                Create Account
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC', p: 2 }}>
      <Card sx={{ maxWidth: 440, width: '100%', borderRadius: 3, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>

          {/* Accepting */}
          {status === 'accepting' && (
            <>
              <CircularProgress size={56} sx={{ mb: 2.5, color: '#1565C0' }} />
              <Typography variant="h6" fontWeight={700}>Accepting invite…</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Joining the family, please wait.
              </Typography>
            </>
          )}

          {/* Idle (shouldn't linger here) */}
          {status === 'idle' && (
            <>
              <CircularProgress size={56} sx={{ mb: 2.5, color: '#1565C0' }} />
              <Typography variant="h6" fontWeight={700}>Processing…</Typography>
            </>
          )}

          {/* Success */}
          {status === 'success' && (
            <>
              <Box sx={{
                width: 72, height: 72, borderRadius: '50%',
                bgcolor: '#E8F5E9', display: 'flex', alignItems: 'center',
                justifyContent: 'center', mx: 'auto', mb: 2.5,
              }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 40, color: '#2E7D32' }} />
              </Box>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                You've joined the family!
              </Typography>
              {role && (
                <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2, textAlign: 'left' }}>
                  You've been added as <strong>{role.replace('_', ' ')}</strong>. You now have access to manage this family's children's settings.
                </Alert>
              )}
              <Button
                variant="contained"
                onClick={() => navigate('/dashboard')}
                sx={{ borderRadius: 2, background: 'linear-gradient(135deg,#1565C0,#1976D2)', minWidth: 180 }}
              >
                Go to Dashboard
              </Button>
            </>
          )}

          {/* Error */}
          {status === 'error' && (
            <>
              <Box sx={{
                width: 72, height: 72, borderRadius: '50%',
                bgcolor: '#FFEBEE', display: 'flex', alignItems: 'center',
                justifyContent: 'center', mx: 'auto', mb: 2.5,
              }}>
                <ErrorOutlineIcon sx={{ fontSize: 40, color: '#C62828' }} />
              </Box>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
                Invite Error
              </Typography>
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, textAlign: 'left' }}>
                {message || 'Something went wrong. The invite may have expired or already been used.'}
              </Alert>
              <Button
                variant="outlined"
                onClick={() => navigate('/dashboard')}
                sx={{ borderRadius: 2 }}
              >
                Go to Dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
