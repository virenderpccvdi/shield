import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, CircularProgress, InputAdornment, IconButton,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import api from '../../api/axios';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate        = useNavigate();
  const token           = searchParams.get('token') ?? '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Reset link is invalid or has expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  const hasToken = token.length > 0;

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a2e6e 0%, #1565C0 40%, #0277BD 70%, #00838F 100%)',
      p: 2,
      '@keyframes slideUp': { from: { opacity: 0, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
    }}>
      {/* Decorative circles */}
      <Box sx={{ position: 'fixed', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.03)' }} />
      <Box sx={{ position: 'fixed', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.03)' }} />

      <Box sx={{
        width: '100%', maxWidth: 440,
        bgcolor: 'white', borderRadius: 4,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        animation: 'slideUp 0.6s ease-out 0.1s both',
      }}>
        <Box sx={{ height: 4, background: 'linear-gradient(90deg, #1565C0, #0277BD, #00838F)' }} />

        <Box sx={{ p: { xs: 3, sm: 4 } }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
            <Box sx={{
              width: 44, height: 44,
              background: 'linear-gradient(135deg, #1565C0, #0277BD)',
              borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.1, color: '#1565C0' }}>Shield</Typography>
              <Typography variant="caption" color="text.secondary">Family Internet Protection</Typography>
            </Box>
          </Box>

          {/* No token */}
          {!hasToken && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <ErrorOutlineIcon sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Invalid Reset Link</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                This password reset link is missing its token. Please request a new reset email.
              </Typography>
              <Button variant="contained" component={Link} to="/forgot-password" sx={{ borderRadius: 2 }}>
                Request New Link
              </Button>
            </Box>
          )}

          {/* Success */}
          {hasToken && done && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Password Updated!</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Your password has been reset successfully. You can now sign in with your new password.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/login')}
                sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #1565C0, #0277BD)', minWidth: 160 }}
              >
                Sign In
              </Button>
            </Box>
          )}

          {/* Form */}
          {hasToken && !done && (
            <>
              <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>Set New Password</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Choose a strong password for your Shield account.
              </Typography>

              {error && (
                <Box sx={{ bgcolor: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 2, p: 1.5, mb: 2.5 }}>
                  <Typography variant="body2" color="error.main">{error}</Typography>
                </Box>
              )}

              <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="New Password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  size="small"
                  helperText="Minimum 8 characters"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPwd(!showPwd)}>
                          {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <TextField
                  label="Confirm Password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  size="large"
                  sx={{
                    borderRadius: 2, mt: 0.5, py: 1.4, fontWeight: 700,
                    background: 'linear-gradient(135deg, #1565C0, #0277BD)',
                    '&:hover': { background: 'linear-gradient(135deg, #1976D2, #0288D1)' },
                  }}
                >
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Reset Password'}
                </Button>
                <Button
                  component={Link}
                  to="/login"
                  variant="text"
                  sx={{ borderRadius: 2, color: 'text.secondary' }}
                >
                  Back to Sign In
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
