import { useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert, CircularProgress,
  InputAdornment, IconButton, Divider, Stack,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import SecurityIcon from '@mui/icons-material/Security';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import PsychologyIcon from '@mui/icons-material/Psychology';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useAuthStore } from '../../store/auth.store';
import api from '../../api/axios';

const FEATURES = [
  { icon: <SecurityIcon sx={{ fontSize: 18, color: '#A5B4FC' }} />, text: 'Real-time DNS activity monitoring' },
  { icon: <PsychologyIcon sx={{ fontSize: 18, color: '#A5B4FC' }} />, text: 'AI-powered threat detection' },
  { icon: <LockIcon sx={{ fontSize: 18, color: '#A5B4FC' }} />, text: 'Screen time & schedule controls' },
  { icon: <LocationOnIcon sx={{ fontSize: 18, color: '#A5B4FC' }} />, text: 'Location tracking & geo-fencing' },
  { icon: <FamilyRestroomIcon sx={{ fontSize: 18, color: '#A5B4FC' }} />, text: 'Rewards & gamification system' },
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
      '@keyframes slideUp': { from: { opacity: 0, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      '@keyframes float': { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-10px)' } },
      '@keyframes shimmer': { '0%': { backgroundPosition: '200% center' }, '100%': { backgroundPosition: '-200% center' } },
      animation: 'fadeIn 0.5s ease-out',
    }}>
      {/* LEFT — Brand Panel (60% on desktop, hidden on mobile) */}
      <Box
        sx={{
          width: { xs: 0, md: '60%' },
          flexShrink: 0,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          px: { md: 6, lg: 10 },
          py: 8,
          background: 'linear-gradient(145deg, #4F46E5 0%, #6D28D9 45%, #7C3AED 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative orbs */}
        <Box sx={{ position: 'absolute', top: -100, right: -100, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', top: '40%', right: '10%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 6, animation: 'slideUp 0.6s ease-out 0.1s both' }}>
          <Box sx={{
            width: 52, height: 52, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            animation: 'float 4s ease-in-out infinite',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}>
            <ShieldIcon sx={{ fontSize: 30, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} letterSpacing="-0.5px" lineHeight={1.1}>Shield</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: 10 }}>
              Family Internet Protection
            </Typography>
          </Box>
        </Box>

        {/* Headline */}
        <Typography variant="h3" fontWeight={800} sx={{
          mb: 2, lineHeight: 1.2, letterSpacing: '-1px',
          animation: 'slideUp 0.6s ease-out 0.2s both',
          background: 'linear-gradient(135deg, #ffffff 30%, rgba(196,181,253,0.9) 100%)',
          backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Protect what<br />matters most
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.65)', mb: 5, fontSize: 16, lineHeight: 1.6, maxWidth: 420, animation: 'slideUp 0.6s ease-out 0.3s both' }}>
          AI-powered DNS filtering and parental controls that keep your family safe online — in real time.
        </Typography>

        {/* Feature list */}
        <Stack spacing={2.5} sx={{ animation: 'slideUp 0.6s ease-out 0.4s both' }}>
          {FEATURES.map((f, i) => (
            <Box key={f.text} sx={{ display: 'flex', alignItems: 'center', gap: 2, animation: `slideUp 0.4s ease-out ${0.5 + i * 0.08}s both` }}>
              <Box sx={{
                width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
                bgcolor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                {f.icon}
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.88)', fontWeight: 500, fontSize: 14 }}>{f.text}</Typography>
            </Box>
          ))}
        </Stack>

        {/* Trust badge */}
        <Box sx={{
          mt: 6, p: 2.5, borderRadius: '14px',
          bgcolor: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
          animation: 'slideUp 0.6s ease-out 0.9s both',
        }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CheckCircleIcon sx={{ fontSize: 20, color: '#86EFAC' }} />
            <Box>
              <Typography variant="body2" fontWeight={700} sx={{ color: 'white', lineHeight: 1.3 }}>Trusted by 10,000+ families</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>No credit card required · Free forever plan</Typography>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* RIGHT — Form Panel (40% on desktop, full on mobile) */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#F9FAFB',
        p: { xs: 3, sm: 5 },
      }}>
        <Box sx={{ width: '100%', maxWidth: 420, animation: 'slideUp 0.6s ease-out 0.2s both' }}>
          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldIcon sx={{ color: 'white', fontSize: 22 }} />
            </Box>
            <Typography fontWeight={800} fontSize={20} sx={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Shield
            </Typography>
          </Box>

          {!mfaStep ? (
            /* ── Credential Step ───────────────────────────────────────── */
            <>
              <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={800} sx={{ mb: 0.75, letterSpacing: '-0.5px', color: '#0F172A' }}>
                  Welcome back
                </Typography>
                <Typography color="text.secondary" fontSize={15}>
                  Sign in to your Shield dashboard
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }}>{error}</Alert>
              )}

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
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      '&:hover fieldset': { borderColor: '#4F46E5' },
                      '&.Mui-focused fieldset': { borderColor: '#4F46E5' },
                    },
                  }}
                />
                <TextField
                  fullWidth
                  label="Password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      '&:hover fieldset': { borderColor: '#4F46E5' },
                      '&.Mui-focused fieldset': { borderColor: '#4F46E5' },
                    },
                  }}
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
                  <Link to="/forgot-password" style={{ fontSize: 13, color: '#4F46E5', textDecoration: 'none', fontWeight: 500 }}>
                    Forgot password?
                  </Link>
                </Box>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{
                    py: 1.6, mt: 0.5, fontSize: 15, fontWeight: 700,
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                    boxShadow: '0 4px 15px rgba(79,70,229,0.35)',
                    textTransform: 'none',
                    letterSpacing: '0.2px',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #4338CA 0%, #6D28D9 100%)',
                      boxShadow: '0 6px 20px rgba(79,70,229,0.45)',
                      transform: 'translateY(-1px)',
                    },
                    '&:active': { transform: 'translateY(0)' },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
                </Button>
              </Box>

              <Divider sx={{ my: 3.5, '&::before, &::after': { borderColor: '#E5E7EB' } }}>
                <Typography variant="caption" color="text.disabled" sx={{ px: 1.5 }}>or</Typography>
              </Divider>
              <Typography variant="body2" textAlign="center" color="text.secondary">
                New to Shield?{' '}
                <Link to="/register" style={{ color: '#4F46E5', fontWeight: 700, textDecoration: 'none' }}>
                  Create a free account
                </Link>
              </Typography>
            </>
          ) : (
            /* ── OTP / MFA Step ────────────────────────────────────────── */
            <>
              <Box sx={{ textAlign: 'center', mb: 3.5 }}>
                <Box sx={{
                  width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
                  background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(124,58,237,0.12))',
                  border: '1.5px solid rgba(79,70,229,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <EmailIcon sx={{ fontSize: 36, color: '#4F46E5' }} />
                </Box>
                <Typography variant="h5" fontWeight={800} sx={{ mb: 0.75, letterSpacing: '-0.5px', color: '#0F172A' }}>
                  Check your email
                </Typography>
                <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                  We sent a 6-digit verification code to{' '}
                  <Typography component="span" variant="body2" fontWeight={700} color="text.primary">
                    {maskEmail(email)}
                  </Typography>
                </Typography>
              </Box>

              {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: '10px' }}>{error}</Alert>}

              <TextField
                label="6-digit code"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ maxLength: 6, style: { letterSpacing: 16, fontSize: 28, textAlign: 'center', fontWeight: 800 } }}
                fullWidth
                sx={{
                  mb: 2.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    '&.Mui-focused fieldset': { borderColor: '#4F46E5' },
                  },
                }}
                autoFocus
                placeholder="000000"
              />

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleVerifyOtp}
                disabled={otp.length !== 6 || otpLoading}
                sx={{
                  py: 1.6, fontSize: 15, fontWeight: 700, borderRadius: '10px', textTransform: 'none',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  boxShadow: '0 4px 15px rgba(79,70,229,0.35)',
                  '&:hover': { background: 'linear-gradient(135deg, #4338CA 0%, #6D28D9 100%)', boxShadow: '0 6px 20px rgba(79,70,229,0.45)' },
                  transition: 'all 0.2s ease',
                }}
              >
                {otpLoading ? <CircularProgress size={22} color="inherit" /> : 'Verify Code'}
              </Button>

              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Didn't receive the code?{' '}
                  {resendCooldown > 0 ? (
                    <Typography component="span" variant="body2" color="text.disabled" fontWeight={600}>
                      Resend in {resendCooldown}s
                    </Typography>
                  ) : (
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ color: '#4F46E5', fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      onClick={handleResendOtp}
                    >
                      Resend code
                    </Typography>
                  )}
                </Typography>
              </Box>

              <Divider sx={{ my: 3, '&::before, &::after': { borderColor: '#E5E7EB' } }} />
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  variant="body2"
                  sx={{ color: '#4F46E5', cursor: 'pointer', fontWeight: 700, '&:hover': { textDecoration: 'underline' } }}
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
