import { useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert, CircularProgress,
  InputAdornment, IconButton, Divider,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmailIcon from '@mui/icons-material/Email';
import { useAuthStore } from '../../store/auth.store';
import api from '../../api/axios';

const FEATURES = [
  'Real-time DNS activity monitoring',
  'AI-powered threat detection',
  'Screen time & schedule controls',
  'Location tracking & geo-fencing',
  'Rewards & gamification system',
];

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const setAuth = useAuthStore((s) => s.setAuth);

  // Credential step
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA / OTP step
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCooldown() {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function sendOtpEmail(token: string) {
    await api.post('/auth/mfa/email/send', { mfaToken: token });
    startCooldown();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });

      // MFA required — switch to OTP step
      if (data?.mfaRequired || data?.data?.mfaRequired) {
        const token = data?.mfaToken || data?.data?.mfaToken || '';
        setMfaToken(token);
        setMfaStep(true);
        // Automatically trigger OTP email
        try {
          await sendOtpEmail(token);
        } catch {
          // If the auto-send fails, user can still click Resend
        }
        return;
      }

      // Normal login success
      const payload = data.data ?? data;
      const { accessToken, refreshToken, name, email: userEmail, role, userId, tenantId } = payload;
      setAuth(
        { id: userId || '', name: name || email, email: userEmail || email, role, tenantId },
        accessToken,
        refreshToken,
      );
      if (redirectTo) navigate(redirectTo);
      else if (role === 'GLOBAL_ADMIN') navigate('/admin/dashboard');
      else if (role === 'ISP_ADMIN') navigate('/isp/dashboard');
      else navigate('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setOtpLoading(true);
    try {
      const { data } = await api.post('/auth/mfa/validate', { mfaToken, code: otp });
      const payload = data.data ?? data;
      const { accessToken, refreshToken, name, email: userEmail, role, userId, tenantId } = payload;
      setAuth(
        { id: userId || '', name: name || email, email: userEmail || email, role, tenantId },
        accessToken,
        refreshToken,
      );
      if (redirectTo) navigate(redirectTo);
      else if (role === 'GLOBAL_ADMIN') navigate('/admin/dashboard');
      else if (role === 'ISP_ADMIN') navigate('/isp/dashboard');
      else navigate('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    try {
      await sendOtpEmail(mfaToken);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to resend OTP. Please try again.');
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

          {!mfaStep ? (
            /* ── Credential Step ───────────────────────────────────────── */
            <>
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
            </>
          ) : (
            /* ── OTP / MFA Step ────────────────────────────────────────── */
            <>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <EmailIcon sx={{ fontSize: 52, color: 'primary.main', mb: 1.5 }} />
                <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>Check Your Email</Typography>
                <Typography variant="body2" color="text.secondary">
                  We sent a 6-digit code to{' '}
                  <Typography component="span" variant="body2" fontWeight={600} color="text.primary">
                    {maskEmail(email)}
                  </Typography>
                </Typography>
              </Box>

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <TextField
                label="Enter OTP"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ maxLength: 6, style: { letterSpacing: 12, fontSize: 26, textAlign: 'center', fontWeight: 700 } }}
                fullWidth
                sx={{ mb: 2 }}
                autoFocus
                placeholder="000000"
              />

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleVerifyOtp}
                disabled={otp.length !== 6 || otpLoading}
                sx={{ py: 1.5, fontSize: 15, fontWeight: 600, bgcolor: '#1565C0', '&:hover': { bgcolor: '#0D47A1' } }}
              >
                {otpLoading ? <CircularProgress size={22} color="inherit" /> : 'Verify'}
              </Button>

              <Box sx={{ mt: 2.5, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Didn't receive the code?{' '}
                  {resendCooldown > 0 ? (
                    <Typography component="span" variant="body2" color="text.disabled">
                      Resend in {resendCooldown}s
                    </Typography>
                  ) : (
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ color: '#1565C0', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      onClick={handleResendOtp}
                    >
                      Resend OTP
                    </Typography>
                  )}
                </Typography>
              </Box>

              <Divider sx={{ my: 3 }} />
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  variant="body2"
                  sx={{ color: '#1565C0', cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                  onClick={() => { setMfaStep(false); setOtp(''); setError(''); }}
                >
                  Back to sign in
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
