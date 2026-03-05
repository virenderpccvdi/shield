import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, CircularProgress,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmailIcon from '@mui/icons-material/Email';
import api from '../../api/axios';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await api.post('/auth/forgot-password', { email }); setSent(true); } catch { setSent(true); } finally { setLoading(false); }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a2e6e 0%, #1565C0 40%, #0277BD 70%, #00838F 100%)',
      p: 2,
      '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
      '@keyframes slideUp': { from: { opacity: 0, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes float': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      '@keyframes scaleIn': { from: { opacity: 0, transform: 'scale(0.5)' }, to: { opacity: 1, transform: 'scale(1)' } },
      '@keyframes checkDraw': { from: { strokeDashoffset: 50 }, to: { strokeDashoffset: 0 } },
      animation: 'fadeIn 0.6s ease-out',
    }}>
      {/* Decorative circles */}
      <Box sx={{ position: 'fixed', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.03)' }} />
      <Box sx={{ position: 'fixed', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.03)' }} />

      <Box sx={{
        width: '100%',
        maxWidth: 440,
        bgcolor: 'white',
        borderRadius: 4,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        animation: 'slideUp 0.6s ease-out 0.2s both',
      }}>
        {/* Top gradient bar */}
        <Box sx={{ height: 4, background: 'linear-gradient(90deg, #1565C0, #0277BD, #00838F)' }} />

        <Box sx={{ p: { xs: 3, sm: 4 } }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
            <Box sx={{
              width: 44, height: 44,
              background: 'linear-gradient(135deg, #1565C0, #0277BD)',
              borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'float 3s ease-in-out infinite',
            }}>
              <ShieldIcon sx={{ fontSize: 26, color: 'white' }} />
            </Box>
            <Typography variant="h6" fontWeight={800} color="#1565C0">Shield</Typography>
          </Box>

          {sent ? (
            /* Success state */
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Box sx={{
                width: 72, height: 72, mx: 'auto', mb: 3,
                borderRadius: '50%',
                bgcolor: '#E8F5E9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'scaleIn 0.5s ease-out 0.3s both',
              }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 40, color: '#2E7D32', animation: 'scaleIn 0.4s ease-out 0.5s both' }} />
              </Box>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1, animation: 'slideUp 0.5s ease-out 0.5s both' }}>
                Check your email
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 1, animation: 'slideUp 0.5s ease-out 0.6s both' }}>
                If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, animation: 'slideUp 0.5s ease-out 0.7s both' }}>
                Please check your spam folder if you don't see it.
              </Typography>
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  sx={{
                    animation: 'slideUp 0.5s ease-out 0.8s both',
                    borderColor: '#1565C0', color: '#1565C0',
                    '&:hover': { borderColor: '#0D47A1', bgcolor: 'rgba(21,101,192,0.04)' },
                  }}
                >
                  Back to sign in
                </Button>
              </Link>
            </Box>
          ) : (
            /* Form state */
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
                  Reset password
                </Typography>
                <Typography color="text.secondary">
                  Enter your email and we'll send you a reset link.
                </Typography>
              </Box>

              <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  fullWidth
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <EmailIcon sx={{ color: 'text.disabled', mr: 1, fontSize: 20 }} />
                    ),
                  }}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{
                    py: 1.5, fontSize: 15, fontWeight: 600,
                    bgcolor: '#1565C0',
                    '&:hover': { bgcolor: '#0D47A1' },
                  }}
                >
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Send Reset Link'}
                </Button>
              </Box>

              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Link to="/login" style={{ textDecoration: 'none', color: '#1565C0', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ArrowBackIcon sx={{ fontSize: 16 }} />
                  Back to sign in
                </Link>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
