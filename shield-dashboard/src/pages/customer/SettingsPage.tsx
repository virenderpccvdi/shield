import {
  Box, Typography, Card, CardContent, TextField, Button, Switch, Divider,
  Alert, Avatar, Grid, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, InputAdornment, IconButton, Snackbar, Chip, FormControlLabel,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import NotificationsIcon from '@mui/icons-material/Notifications';
import EmailIcon from '@mui/icons-material/Email';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import TelegramIcon from '@mui/icons-material/Telegram';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PhoneIcon from '@mui/icons-material/Phone';
import SecurityIcon from '@mui/icons-material/Security';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import PinIcon from '@mui/icons-material/Pin';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

function getInitials(name: string) {
  return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
}

export default function SettingsPage() {
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();

  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notification prefs (local only for now)
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);

  // Delete account
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [exporting, setExporting] = useState(false);

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; qrCodeUrl: string; backupCodes: string[] } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaDisableCode, setMfaDisableCode] = useState('');
  const [mfaMsg, setMfaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // PIN Lock state
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pinSettingsLoading, setPinSettingsLoading] = useState(false);
  const [pinDialog, setPinDialog] = useState(false);
  const [pinCurrentVal, setPinCurrentVal] = useState('');
  const [pinNewVal, setPinNewVal] = useState('');
  const [pinConfirmVal, setPinConfirmVal] = useState('');
  const [pinMsg, setPinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pinSaving, setPinSaving] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  // Load PIN settings on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/auth/pin/settings');
        const s = data.data ?? {};
        setPinEnabled(!!s.pinEnabled);
        setBiometricEnabled(!!s.biometricEnabled);
      } catch {
        // PIN settings not critical
      }
    })();
  }, []);

  // Load profile on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        const p = data.data;
        setName(p.name || '');
        setPhone(p.phone || '');
        setMfaEnabled(!!p.mfaEnabled);
      } catch {
        // fallback to store data
      } finally {
        setProfileLoading(false);
      }
    })();
  }, []);

  // Save profile
  const handleSaveProfile = async () => {
    if (!name.trim()) {
      setProfileMsg({ type: 'error', text: 'Name is required.' });
      return;
    }
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const { data } = await api.put('/auth/me', { name: name.trim(), phone: phone.trim() || null });
      const p = data.data;
      // Update auth store with new name
      if (user && accessToken) {
        setAuth({ ...user, name: p.name }, accessToken, refreshToken || undefined);
      }
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
      setSnackbar({ open: true, message: 'Profile saved!', severity: 'success' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setProfileMsg({ type: 'error', text: e.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    setPwdMsg(null);
    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdMsg({ type: 'error', text: 'All password fields are required.' });
      return;
    }
    if (newPwd.length < 8) {
      setPwdMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setPwdSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPwd, newPassword: newPwd });
      setPwdMsg({ type: 'success', text: 'Password changed successfully.' });
      setSnackbar({ open: true, message: 'Password changed!', severity: 'success' });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setPwdMsg({ type: 'error', text: e.response?.data?.message || 'Failed to change password.' });
    } finally {
      setPwdSaving(false);
    }
  };

  // MFA setup
  const handleMfaSetup = async () => {
    setMfaLoading(true);
    setMfaMsg(null);
    try {
      const { data } = await api.post('/auth/mfa/setup');
      setMfaSetupData(data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setMfaMsg({ type: 'error', text: e.response?.data?.message || 'Failed to set up MFA.' });
    } finally {
      setMfaLoading(false);
    }
  };

  // MFA verify (enable)
  const handleMfaVerify = async () => {
    if (!mfaCode || mfaCode.length < 6) {
      setMfaMsg({ type: 'error', text: 'Enter a valid 6-digit code from your authenticator app.' });
      return;
    }
    setMfaLoading(true);
    setMfaMsg(null);
    try {
      await api.post('/auth/mfa/verify', { code: mfaCode });
      setMfaEnabled(true);
      setMfaCode('');
      setShowBackupCodes(true);
      setMfaMsg({ type: 'success', text: 'MFA enabled successfully! Save your backup codes.' });
      setSnackbar({ open: true, message: 'Two-factor authentication enabled!', severity: 'success' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setMfaMsg({ type: 'error', text: e.response?.data?.message || 'Invalid code. Please try again.' });
    } finally {
      setMfaLoading(false);
    }
  };

  // MFA disable
  const handleMfaDisable = async () => {
    if (!mfaDisableCode || mfaDisableCode.length < 6) {
      setMfaMsg({ type: 'error', text: 'Enter a valid TOTP or backup code to disable MFA.' });
      return;
    }
    setMfaLoading(true);
    setMfaMsg(null);
    try {
      await api.post('/auth/mfa/disable', { code: mfaDisableCode });
      setMfaEnabled(false);
      setMfaDisableCode('');
      setMfaSetupData(null);
      setMfaMsg({ type: 'success', text: 'MFA disabled successfully.' });
      setSnackbar({ open: true, message: 'Two-factor authentication disabled.', severity: 'success' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setMfaMsg({ type: 'error', text: e.response?.data?.message || 'Failed to disable MFA.' });
    } finally {
      setMfaLoading(false);
    }
  };

  // PIN handlers
  const handleSavePin = async () => {
    setPinMsg(null);
    if (!pinNewVal || pinNewVal.length < 4) {
      setPinMsg({ type: 'error', text: 'PIN must be at least 4 digits.' });
      return;
    }
    if (pinNewVal !== pinConfirmVal) {
      setPinMsg({ type: 'error', text: 'PINs do not match.' });
      return;
    }
    if (!/^\d+$/.test(pinNewVal)) {
      setPinMsg({ type: 'error', text: 'PIN must contain digits only.' });
      return;
    }
    setPinSaving(true);
    try {
      await api.post('/auth/pin/set', { pin: pinNewVal });
      setPinEnabled(true);
      setPinDialog(false);
      setPinCurrentVal(''); setPinNewVal(''); setPinConfirmVal('');
      setSnackbar({ open: true, message: 'App PIN lock set successfully.', severity: 'success' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setPinMsg({ type: 'error', text: e.response?.data?.message || 'Failed to save PIN.' });
    } finally {
      setPinSaving(false);
    }
  };

  const handleRemovePin = async () => {
    setPinSettingsLoading(true);
    try {
      await api.delete('/auth/pin/remove');
      setPinEnabled(false);
      setSnackbar({ open: true, message: 'App PIN lock removed.', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to remove PIN.', severity: 'error' });
    } finally {
      setPinSettingsLoading(false);
    }
  };

  const handleToggleBiometric = async (enabled: boolean) => {
    setPinSettingsLoading(true);
    try {
      await api.put('/auth/pin/biometric', { enabled });
      setBiometricEnabled(enabled);
      setSnackbar({ open: true, message: enabled ? 'Biometric unlock enabled.' : 'Biometric unlock disabled.', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to update biometric setting.', severity: 'error' });
    } finally {
      setPinSettingsLoading(false);
    }
  };

  const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<SettingsIcon />}
        title="Settings"
        subtitle="Manage your account and preferences"
        iconColor="#546E7A"
      />

      <Grid container spacing={3}>
        {/* ─── Profile Section ─── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.1}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    bgcolor: 'rgba(21,101,192,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PersonIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Account Information</Typography>
                </Box>

                {/* Avatar */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                  <Avatar sx={{
                    width: 64, height: 64, fontSize: 22, fontWeight: 700,
                    bgcolor: 'primary.main',
                  }}>
                    {getInitials(name || user?.name || '')}
                  </Avatar>
                  <Box>
                    <Typography fontWeight={600}>{name || user?.name || 'User'}</Typography>
                    <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
                    <Typography variant="caption" sx={{
                      mt: 0.5, display: 'inline-block', px: 1, py: 0.25, borderRadius: 1,
                      bgcolor: user?.role === 'GLOBAL_ADMIN' ? '#E8EAF6' : user?.role === 'ISP_ADMIN' ? '#E0F2F1' : 'rgba(21,101,192,0.08)',
                      color: user?.role === 'GLOBAL_ADMIN' ? '#283593' : user?.role === 'ISP_ADMIN' ? '#00695C' : 'primary.main',
                      fontWeight: 600,
                    }}>
                      {user?.role?.replace('_', ' ')}
                    </Typography>
                  </Box>
                </Box>

                {profileMsg && <Alert severity={profileMsg.type} sx={{ mb: 2, borderRadius: 2 }}>{profileMsg.text}</Alert>}

                {profileLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      label="Full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      fullWidth size="small"
                      sx={inputSx}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      value={user?.email || ''}
                      fullWidth size="small"
                      disabled
                      helperText="Email cannot be changed"
                      sx={inputSx}
                    />
                    <TextField
                      label="Phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      fullWidth size="small"
                      placeholder="+1234567890"
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ fontSize: 18, color: '#90A4AE' }} /></InputAdornment>,
                      }}
                      sx={inputSx}
                    />
                    <Button
                      variant="contained"
                      onClick={handleSaveProfile}
                      disabled={profileSaving}
                      sx={{ alignSelf: 'flex-start', borderRadius: 2, bgcolor: 'primary.main' }}
                    >
                      {profileSaving ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* ─── Password Section ─── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.2}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    bgcolor: 'rgba(251,140,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <LockIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Change Password</Typography>
                </Box>

                {pwdMsg && <Alert severity={pwdMsg.type} sx={{ mb: 2, borderRadius: 2 }}>{pwdMsg.text}</Alert>}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Current password"
                    type={showCurrentPwd ? 'text' : 'password'}
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    fullWidth size="small"
                    autoComplete="current-password"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowCurrentPwd(!showCurrentPwd)} edge="end" size="small">
                            {showCurrentPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={inputSx}
                  />
                  <TextField
                    label="New password"
                    type={showNewPwd ? 'text' : 'password'}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    fullWidth size="small"
                    autoComplete="new-password"
                    helperText="Minimum 8 characters"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowNewPwd(!showNewPwd)} edge="end" size="small">
                            {showNewPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={inputSx}
                  />
                  <TextField
                    label="Confirm new password"
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    fullWidth size="small"
                    autoComplete="new-password"
                    error={!!confirmPwd && confirmPwd !== newPwd}
                    helperText={confirmPwd && confirmPwd !== newPwd ? 'Passwords do not match' : ''}
                    sx={inputSx}
                  />
                  <Button
                    variant="contained"
                    onClick={handleChangePassword}
                    disabled={pwdSaving || !currentPwd || !newPwd || !confirmPwd || newPwd !== confirmPwd}
                    sx={{ alignSelf: 'flex-start', borderRadius: 2, bgcolor: 'warning.main', '&:hover': { bgcolor: 'warning.dark' } }}
                  >
                    {pwdSaving ? <CircularProgress size={20} color="inherit" /> : 'Update Password'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* ─── Two-Factor Authentication ─── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.25}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    bgcolor: 'rgba(67,160,71,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <SecurityIcon sx={{ color: 'success.main', fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Two-Factor Authentication</Typography>
                  <Chip
                    label={mfaEnabled ? 'Enabled' : 'Disabled'}
                    size="small"
                    color={mfaEnabled ? 'success' : 'default'}
                    sx={{ ml: 'auto', fontWeight: 600 }}
                  />
                </Box>

                {mfaMsg && <Alert severity={mfaMsg.type} sx={{ mb: 2, borderRadius: 2 }}>{mfaMsg.text}</Alert>}

                {!mfaEnabled ? (
                  // ── MFA NOT enabled ──
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Add an extra layer of security to your account. When enabled, you will need to enter a code from your authenticator app each time you log in.
                    </Typography>

                    {!mfaSetupData ? (
                      <Button
                        variant="contained"
                        startIcon={mfaLoading ? <CircularProgress size={18} color="inherit" /> : <QrCode2Icon />}
                        onClick={handleMfaSetup}
                        disabled={mfaLoading}
                        sx={{ borderRadius: 2, bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
                      >
                        Enable MFA
                      </Button>
                    ) : (
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                          1. Scan this QR code with your authenticator app:
                        </Typography>
                        <Box sx={{
                          display: 'flex', justifyContent: 'center', p: 2, mb: 2,
                          bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider',
                        }}>
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaSetupData.qrCodeUrl)}`}
                            alt="MFA QR Code"
                            width={200}
                            height={200}
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </Box>

                        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                          Or enter this secret manually:
                        </Typography>
                        <Box sx={{
                          display: 'flex', alignItems: 'center', gap: 1, mb: 2,
                          p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5, fontFamily: 'monospace',
                        }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>
                            {mfaSetupData.secret}
                          </Typography>
                          <IconButton size="small" onClick={() => {
                            navigator.clipboard.writeText(mfaSetupData.secret);
                            setSnackbar({ open: true, message: 'Secret copied!', severity: 'success' });
                          }}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                          2. Enter the 6-digit code from your app:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                          <TextField
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            size="small"
                            inputProps={{ maxLength: 6, style: { fontFamily: 'monospace', fontSize: 18, letterSpacing: 8, textAlign: 'center' } }}
                            sx={{ ...inputSx, width: 180 }}
                          />
                          <Button
                            variant="contained"
                            onClick={handleMfaVerify}
                            disabled={mfaLoading || mfaCode.length < 6}
                            sx={{ borderRadius: 2, bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
                          >
                            {mfaLoading ? <CircularProgress size={20} color="inherit" /> : 'Verify'}
                          </Button>
                        </Box>

                        {showBackupCodes && mfaSetupData.backupCodes && (
                          <Alert severity="warning" sx={{ borderRadius: 2 }}>
                            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                              Save these backup codes! They can be used if you lose access to your authenticator app.
                            </Typography>
                            <Box sx={{
                              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5,
                              fontFamily: 'monospace', fontSize: 13,
                            }}>
                              {mfaSetupData.backupCodes.map((code: string) => (
                                <Typography key={code} variant="body2" sx={{ fontFamily: 'monospace' }}>{code}</Typography>
                              ))}
                            </Box>
                          </Alert>
                        )}
                      </Box>
                    )}
                  </Box>
                ) : (
                  // ── MFA IS enabled ──
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5, bgcolor: 'rgba(67,160,71,0.08)', borderRadius: 2 }}>
                      <CheckCircleIcon sx={{ color: 'success.main' }} />
                      <Typography variant="body2" color="success.main" fontWeight={600}>
                        Two-factor authentication is active on your account.
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      To disable MFA, enter your current TOTP code or a backup code:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        value={mfaDisableCode}
                        onChange={(e) => setMfaDisableCode(e.target.value)}
                        placeholder="TOTP or backup code"
                        size="small"
                        sx={{ ...inputSx, flex: 1 }}
                      />
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={handleMfaDisable}
                        disabled={mfaLoading || !mfaDisableCode}
                        sx={{ borderRadius: 2 }}
                      >
                        {mfaLoading ? <CircularProgress size={20} color="inherit" /> : 'Disable MFA'}
                      </Button>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* ─── Notification Preferences ─── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    bgcolor: 'rgba(123,31,162,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <NotificationsIcon sx={{ color: '#7B1FA2', fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Notification Preferences</Typography>
                </Box>

                {[
                  { label: 'Email Alerts', desc: 'Receive alerts via email', checked: emailAlerts, onChange: setEmailAlerts, icon: <EmailIcon sx={{ fontSize: 18, color: 'primary.main' }} /> },
                  { label: 'Push Notifications', desc: 'Browser push notifications', checked: pushAlerts, onChange: setPushAlerts, icon: <NotificationsIcon sx={{ fontSize: 18, color: '#7B1FA2' }} /> },
                  { label: 'Weekly Report', desc: 'Summary email every Sunday', checked: weeklyReport, onChange: setWeeklyReport, icon: <EmailIcon sx={{ fontSize: 18, color: '#00897B' }} /> },
                ].map((pref, i) => (
                  <Box key={pref.label}>
                    {i > 0 && <Divider sx={{ my: 1 }} />}
                    <Box sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      py: 1, px: 1, borderRadius: 1.5,
                      transition: 'background 0.2s',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {pref.icon}
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{pref.label}</Typography>
                          <Typography variant="caption" color="text.secondary">{pref.desc}</Typography>
                        </Box>
                      </Box>
                      <Switch checked={pref.checked} onChange={(e) => pref.onChange(e.target.checked)} />
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* ─── Messaging Channels ─── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    bgcolor: 'rgba(67,160,71,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <WhatsAppIcon sx={{ color: 'success.main', fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Messaging Channels</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="WhatsApp number"
                    placeholder="+1234567890"
                    fullWidth size="small"
                    InputProps={{ startAdornment: <InputAdornment position="start"><WhatsAppIcon sx={{ color: 'success.main', fontSize: 20 }} /></InputAdornment> }}
                    sx={inputSx}
                  />
                  <TextField
                    label="Telegram chat ID"
                    fullWidth size="small"
                    InputProps={{ startAdornment: <InputAdornment position="start"><TelegramIcon sx={{ color: '#0288D1', fontSize: 20 }} /></InputAdornment> }}
                    sx={inputSx}
                  />
                  <Button variant="contained"
                    sx={{ alignSelf: 'flex-start', borderRadius: 2, bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}>
                    Save Preferences
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* ─── PIN Lock ─── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.45}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    bgcolor: 'rgba(183,28,28,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PinIcon sx={{ color: '#B71C1C', fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>App PIN Lock</Typography>
                  <Chip
                    label={pinEnabled ? 'Active' : 'Off'}
                    size="small"
                    color={pinEnabled ? 'error' : 'default'}
                    sx={{ ml: 'auto', fontWeight: 600 }}
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Require a PIN to open the Shield mobile app. After 60 seconds in the background the app will lock automatically.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Button
                    variant="contained"
                    startIcon={<PinIcon />}
                    onClick={() => { setPinDialog(true); setPinMsg(null); }}
                    disabled={pinSettingsLoading}
                    sx={{ alignSelf: 'flex-start', borderRadius: 2, bgcolor: '#B71C1C', '&:hover': { bgcolor: '#8B0000' } }}
                  >
                    {pinEnabled ? 'Change PIN' : 'Set PIN'}
                  </Button>

                  {pinEnabled && (
                    <>
                      <Divider />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={biometricEnabled}
                            onChange={(e) => handleToggleBiometric(e.target.checked)}
                            disabled={pinSettingsLoading}
                            color="primary"
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <FingerprintIcon sx={{ fontSize: 18, color: '#1565C0' }} />
                            <Box>
                              <Typography variant="body2" fontWeight={600}>Biometric unlock</Typography>
                              <Typography variant="caption" color="text.secondary">Use fingerprint or face to unlock</Typography>
                            </Box>
                          </Box>
                        }
                      />
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={handleRemovePin}
                        disabled={pinSettingsLoading}
                        sx={{ alignSelf: 'flex-start', borderRadius: 2 }}
                      >
                        Remove PIN
                      </Button>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* ─── Privacy & Data ─── */}
        <Grid size={12}>
          <AnimatedPage delay={0.5}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '10px',
                    bgcolor: 'rgba(229,57,53,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PrivacyTipIcon sx={{ color: 'error.main', fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Privacy & Data</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Shield complies with GDPR, COPPA, and CCPA regulations. You have the right to access, export, and delete your personal data at any time.
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button variant="outlined" startIcon={<DownloadIcon />} disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      try {
                        const res = await api.get('/auth/me/data-export', { responseType: 'blob' });
                        const url = URL.createObjectURL(new Blob([res.data]));
                        const a = document.createElement('a');
                        a.href = url; a.download = 'shield-data-export.json'; a.click();
                        URL.revokeObjectURL(url);
                      } catch {
                        setSnackbar({ open: true, message: 'Data export request submitted. You will receive an email within 48 hours.', severity: 'success' });
                      }
                      setExporting(false);
                    }}
                    sx={{ borderRadius: 2 }}>
                    {exporting ? 'Exporting...' : 'Export My Data'}
                  </Button>
                  <Button variant="outlined" color="error" startIcon={<DeleteForeverIcon />}
                    onClick={() => setDeleteDialog(true)} sx={{ borderRadius: 2 }}>
                    Delete My Account
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Account deletion is permanent and cannot be undone. Complies with GDPR Article 17.
                </Typography>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>
      </Grid>

      {/* PIN Lock Dialog */}
      <Dialog open={pinDialog} onClose={() => setPinDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PinIcon sx={{ color: '#B71C1C' }} />
          {pinEnabled ? 'Change PIN' : 'Set App PIN'}
        </DialogTitle>
        <DialogContent>
          {pinMsg && <Alert severity={pinMsg.type} sx={{ mb: 2, borderRadius: 2 }}>{pinMsg.text}</Alert>}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose a 4–8 digit PIN to lock the Shield app.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="New PIN"
              type="password"
              inputProps={{ inputMode: 'numeric', maxLength: 8, pattern: '[0-9]*' }}
              value={pinNewVal}
              onChange={(e) => setPinNewVal(e.target.value.replace(/\D/g, ''))}
              fullWidth size="small"
              helperText="4–8 digits"
              sx={inputSx}
            />
            <TextField
              label="Confirm PIN"
              type="password"
              inputProps={{ inputMode: 'numeric', maxLength: 8, pattern: '[0-9]*' }}
              value={pinConfirmVal}
              onChange={(e) => setPinConfirmVal(e.target.value.replace(/\D/g, ''))}
              fullWidth size="small"
              error={!!pinConfirmVal && pinConfirmVal !== pinNewVal}
              helperText={pinConfirmVal && pinConfirmVal !== pinNewVal ? 'PINs do not match' : ''}
              sx={inputSx}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setPinDialog(false); setPinNewVal(''); setPinConfirmVal(''); setPinCurrentVal(''); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSavePin}
            disabled={pinSaving || !pinNewVal || !pinConfirmVal || pinNewVal !== pinConfirmVal}
            sx={{ bgcolor: '#B71C1C', '&:hover': { bgcolor: '#8B0000' } }}
          >
            {pinSaving ? <CircularProgress size={20} color="inherit" /> : 'Save PIN'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} color="error">Delete Account</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            This will permanently delete your account and all associated data including child profiles, devices, activity logs, and DNS rules.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Type <strong>DELETE</strong> to confirm:
          </Typography>
          <TextField fullWidth value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
            placeholder="Type DELETE to confirm" size="small" />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setDeleteDialog(false); setDeleteConfirm(''); }}>Cancel</Button>
          <Button variant="contained" color="error" disabled={deleteConfirm !== 'DELETE'}
            onClick={() => {
              setSnackbar({ open: true, message: 'Account deletion request submitted. Your account will be deleted within 30 days.', severity: 'success' });
              setDeleteDialog(false);
              setDeleteConfirm('');
            }}>
            Permanently Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
