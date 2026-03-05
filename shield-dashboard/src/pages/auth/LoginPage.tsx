import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert, CircularProgress,
  InputAdornment, IconButton, Divider,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuthStore } from '../../store/auth.store';
import api from '../../api/axios';

const FEATURES = [
  'Real-time DNS activity monitoring',
  'AI-powered threat detection',
  'Screen time & schedule controls',
  'Location tracking & geo-fencing',
  'Rewards & gamification system',
];

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });
      const { accessToken, refreshToken, name, email: userEmail, role, userId, tenantId } = data.data;
      setAuth(
        { id: userId || '', name: name || email, email: userEmail || email, role, tenantId },
        accessToken,
        refreshToken,
      );
      if (role === 'GLOBAL_ADMIN') navigate('/admin/dashboard');
      else if (role === 'ISP_ADMIN') navigate('/isp/dashboard');
      else navigate('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      display: 'flex', minHeight: '100vh',
      '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
      '@keyframes slideUp': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes float': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      animation: 'fadeIn 0.6s ease-out',
    }}>
      {/* LEFT — Brand Panel */}
      <Box
        sx={{
          width: { xs: 0, md: '420px' },
          flexShrink: 0,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          px: 5,
          py: 6,
          background: 'linear-gradient(160deg, #0a2e6e 0%, #1565C0 55%, #0277BD 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <Box sx={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />
        <Box sx={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />

        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 5, animation: 'slideUp 0.6s ease-out 0.2s both' }}>
          <Box sx={{ width: 48, height: 48, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'float 3s ease-in-out infinite' }}>
            <ShieldIcon sx={{ fontSize: 30, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} lineHeight={1.1}>Shield</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Family Internet Protection</Typography>
          </Box>
        </Box>

        <Typography variant="h4" fontWeight={700} sx={{ mb: 1, lineHeight: 1.3, animation: 'slideUp 0.6s ease-out 0.3s both' }}>
          Keep your family<br />safe online
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 4, fontSize: 15, animation: 'slideUp 0.6s ease-out 0.4s both' }}>
          Powerful parental controls backed by AI-driven DNS filtering.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, animation: 'slideUp 0.6s ease-out 0.5s both' }}>
          {FEATURES.map((f, i) => (
            <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, animation: `slideUp 0.4s ease-out ${0.6 + i * 0.1}s both` }}>
              <CheckCircleIcon sx={{ fontSize: 18, color: '#90CAF9' }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>{f}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 5, p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)', animation: 'slideUp 0.6s ease-out 1.1s both' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 0.5 }}>Trusted by families worldwide</Typography>
          <Typography variant="body2" fontWeight={600}>No credit card · No subscription · No limits</Typography>
        </Box>
      </Box>

      {/* RIGHT — Form Panel */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC', p: { xs: 3, sm: 4 } }}>
        <Box sx={{ width: '100%', maxWidth: 440, animation: 'slideUp 0.6s ease-out 0.3s both' }}>
          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, mb: 4 }}>
            <ShieldIcon sx={{ color: '#1565C0', fontSize: 28 }} />
            <Typography fontWeight={800} fontSize={20} color="#1565C0">Shield</Typography>
          </Box>

          <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>Welcome back</Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>Sign in to your Shield dashboard</Typography>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              variant="outlined"
            />
            <TextField
              fullWidth
              label="Password"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPwd(!showPwd)} edge="end" size="small">
                      {showPwd ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
              <Link to="/forgot-password" style={{ fontSize: 13, color: '#1565C0', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </Box>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ py: 1.5, mt: 1, fontSize: 15, fontWeight: 600, bgcolor: '#1565C0', '&:hover': { bgcolor: '#0D47A1' } }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />
          <Typography variant="body2" textAlign="center" color="text.secondary">
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#1565C0', fontWeight: 600, textDecoration: 'none' }}>
              Create one free
            </Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
