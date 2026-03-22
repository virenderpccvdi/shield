import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, CircularProgress,
  Button, Alert,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ShieldIcon from '@mui/icons-material/Shield';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';

type AcceptState = 'loading' | 'success' | 'error' | 'unauthenticated';

/**
 * CoParentAcceptPage — handles co-parent invite acceptance.
 * URL: /co-parent/accept?token={uuid}
 *
 * The token is the invite token stored in profile.family_invites.token.
 * The user must be logged in; if not, they're redirected to login with a
 * redirect_to param so they land back here after authentication.
 */
export default function CoParentAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const [state, setState] = useState<AcceptState>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMsg('No invitation token found in the URL. Please use the link from your invite email.');
      return;
    }

    if (!isAuthenticated) {
      // Redirect to login, pass current URL as redirect target
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/login?redirect_to=${returnTo}`, { replace: true });
      return;
    }

    // Accept the invite
    api
      .post('/api/v1/profiles/family/accept', null, {
        params: { token },
      })
      .then(() => {
        setState('success');
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.message ??
          err?.response?.data?.error ??
          'The invitation is invalid or has already expired.';
        setState('error');
        setErrorMsg(msg);
      });
  }, [token, isAuthenticated, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#F8FAFC',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 440, width: '100%', borderRadius: 3, boxShadow: 4 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          {/* Brand */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3 }}>
            <ShieldIcon sx={{ fontSize: 32, color: '#1A237E' }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#1A237E', letterSpacing: -0.5 }}>
              Shield
            </Typography>
          </Box>

          {state === 'loading' && (
            <>
              <CircularProgress size={56} sx={{ color: '#1A237E', mb: 2 }} />
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                Accepting Co-Parent Invitation
              </Typography>
              <Typography color="text.secondary" variant="body2">
                Please wait while we process your invitation…
              </Typography>
            </>
          )}

          {state === 'success' && (
            <>
              <CheckCircleOutlineIcon sx={{ fontSize: 64, color: '#2E7D32', mb: 2 }} />
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1, color: '#1B5E20' }}>
                You're now a Co-Parent!
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
                You now have full access to the family's child profiles and parental controls.
              </Typography>
              <Alert severity="success" sx={{ mb: 3, textAlign: 'left' }}>
                You can view child locations, manage DNS rules, approve screen time requests,
                and respond to SOS alerts — just like the primary parent.
              </Alert>
              <Button
                variant="contained"
                fullWidth
                onClick={() => navigate('/dashboard')}
                sx={{ bgcolor: '#1A237E', '&:hover': { bgcolor: '#283593' }, py: 1.25, fontWeight: 700 }}
              >
                Go to Dashboard
              </Button>
            </>
          )}

          {state === 'error' && (
            <>
              <ErrorOutlineIcon sx={{ fontSize: 64, color: '#C62828', mb: 2 }} />
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1, color: '#C62828' }}>
                Invitation Not Found
              </Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
                {errorMsg}
              </Typography>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate('/dashboard')}
                sx={{ mb: 1, borderColor: '#1A237E', color: '#1A237E' }}
              >
                Go to Dashboard
              </Button>
              <Button
                variant="text"
                fullWidth
                onClick={() => navigate('/login')}
                sx={{ color: 'text.secondary' }}
              >
                Sign in with a different account
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
