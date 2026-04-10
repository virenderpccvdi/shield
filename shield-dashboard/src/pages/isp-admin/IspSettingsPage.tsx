import {
  Box, Typography, Card, CardContent, TextField, Button, Switch, Divider,
  Alert, Avatar, Grid, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, InputAdornment, IconButton, Snackbar, Chip, Stack,
  Tabs, Tab, Tooltip,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import NotificationsIcon from '@mui/icons-material/Notifications';
import EmailIcon from '@mui/icons-material/Email';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import TelegramIcon from '@mui/icons-material/Telegram';
import BusinessIcon from '@mui/icons-material/Business';
import PaletteIcon from '@mui/icons-material/Palette';
import SecurityIcon from '@mui/icons-material/Security';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PhoneIcon from '@mui/icons-material/Phone';
import LinkIcon from '@mui/icons-material/Link';
import PeopleIcon from '@mui/icons-material/People';
import StarIcon from '@mui/icons-material/Star';
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

function getInitials(name: string) {
  return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
}

function SectionHeader({ icon, title, color, bg }: { icon: React.ReactNode; title: string; color: string; bg: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
      <Box sx={{ width: 38, height: 38, borderRadius: '10px', bgcolor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </Box>
      <Typography variant="subtitle1" fontWeight={700} fontSize={15}>{title}</Typography>
    </Box>
  );
}

function ToggleRow({ icon, label, desc, checked, onChange }: { icon: React.ReactNode; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25, px: 1, borderRadius: 1.5, '&:hover': { bgcolor: '#F8FAFC' }, transition: 'background 0.15s' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {icon}
        <Box>
          <Typography variant="body2" fontWeight={600}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">{desc}</Typography>
        </Box>
      </Box>
      <Switch checked={checked} onChange={e => onChange(e.target.checked)} size="small" />
    </Box>
  );
}

const SECTION_TABS = [
  { label: 'Profile', icon: <PersonIcon sx={{ fontSize: 18 }} /> },
  { label: 'ISP Branding', icon: <BusinessIcon sx={{ fontSize: 18 }} /> },
  { label: 'Security', icon: <SecurityIcon sx={{ fontSize: 18 }} /> },
  { label: 'Notifications', icon: <NotificationsIcon sx={{ fontSize: 18 }} /> },
];

const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

export default function IspSettingsPage() {
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const tenantId = (user as any)?.tenant_id ?? (user as any)?.tenantId;
  const [tab, setTab] = useState(0);

  // ── Profile ──
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Branding (tenant) ──
  const [tenant, setTenant] = useState<any>(null);
  const [brandName, setBrandName] = useState('');
  const [brandEmail, setBrandEmail] = useState('');
  const [brandPhone, setBrandPhone] = useState('');
  const [brandLogo, setBrandLogo] = useState('');
  const [brandColor, setBrandColor] = useState('#1565C0');
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandMsg, setBrandMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logoPreviewError, setLogoPreviewError] = useState(false);

  // ── Password ──
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── MFA ──
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; qrCodeUrl: string; backupCodes: string[] } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaDisableCode, setMfaDisableCode] = useState('');
  const [mfaMsg, setMfaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // ── Notifications ──
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [suspiciousAlert, setSuspiciousAlert] = useState(true);
  const [highUsageAlert, setHighUsageAlert] = useState(false);

  // ── Delete dialog ──
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  // ── Snackbar ──
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showSnack = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  // Load profile + tenant on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        const p = data.data;
        setName(p.name || '');
        setPhone(p.phone || '');
        setMfaEnabled(!!p.mfaEnabled);
      } catch { /* fallback */ } finally {
        setProfileLoading(false);
      }
    })();

    if (tenantId) {
      api.get('/tenants/me').then(r => {
        const t = r.data?.data ?? r.data;
        setTenant(t);
        setBrandName(t.name || '');
        setBrandEmail(t.contactEmail || '');
        setBrandPhone(t.contactPhone || '');
        setBrandLogo(t.logoUrl || '');
        setBrandColor(t.primaryColor || '#1565C0');
      }).catch(() => {});
    }
  }, [tenantId]);

  const handleSaveProfile = async () => {
    if (!name.trim()) { setProfileMsg({ type: 'error', text: 'Name is required.' }); return; }
    setProfileSaving(true); setProfileMsg(null);
    try {
      const { data } = await api.put('/auth/me', { name: name.trim(), phone: phone.trim() || null });
      const p = data.data;
      if (user && accessToken) setAuth({ ...user, name: p.name }, accessToken, refreshToken || undefined);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
      showSnack('Profile saved!');
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update profile.' });
    } finally { setProfileSaving(false); }
  };

  const handleSaveBranding = async () => {
    setBrandSaving(true); setBrandMsg(null);
    try {
      await api.put(`/tenants/${tenantId}`, {
        name: brandName.trim() || undefined,
        contactEmail: brandEmail.trim() || undefined,
        contactPhone: brandPhone.trim() || undefined,
        logoUrl: brandLogo.trim() || undefined,
        primaryColor: brandColor || undefined,
      });
      setBrandMsg({ type: 'success', text: 'ISP branding updated successfully.' });
      showSnack('Branding saved!');
    } catch (err: any) {
      setBrandMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update branding.' });
    } finally { setBrandSaving(false); }
  };

  const handleChangePassword = async () => {
    setPwdMsg(null);
    if (!currentPwd || !newPwd || !confirmPwd) { setPwdMsg({ type: 'error', text: 'All fields are required.' }); return; }
    if (newPwd.length < 8) { setPwdMsg({ type: 'error', text: 'New password must be at least 8 characters.' }); return; }
    if (newPwd !== confirmPwd) { setPwdMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
    setPwdSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPwd, newPassword: newPwd });
      setPwdMsg({ type: 'success', text: 'Password changed successfully.' });
      showSnack('Password changed!');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: any) {
      setPwdMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
    } finally { setPwdSaving(false); }
  };

  const handleMfaSetup = async () => {
    setMfaLoading(true); setMfaMsg(null);
    try { const { data } = await api.post('/auth/mfa/setup'); setMfaSetupData(data.data); }
    catch (err: any) { setMfaMsg({ type: 'error', text: err.response?.data?.message || 'Failed to set up MFA.' }); }
    finally { setMfaLoading(false); }
  };

  const handleMfaVerify = async () => {
    if (!mfaCode || mfaCode.length < 6) { setMfaMsg({ type: 'error', text: 'Enter a valid 6-digit code.' }); return; }
    setMfaLoading(true); setMfaMsg(null);
    try {
      await api.post('/auth/mfa/verify', { code: mfaCode });
      setMfaEnabled(true); setMfaCode(''); setShowBackupCodes(true);
      setMfaMsg({ type: 'success', text: 'MFA enabled! Save your backup codes.' });
      showSnack('Two-factor authentication enabled!');
    } catch (err: any) {
      setMfaMsg({ type: 'error', text: err.response?.data?.message || 'Invalid code.' });
    } finally { setMfaLoading(false); }
  };

  const handleMfaDisable = async () => {
    if (!mfaDisableCode) { setMfaMsg({ type: 'error', text: 'Enter your TOTP or backup code.' }); return; }
    setMfaLoading(true); setMfaMsg(null);
    try {
      await api.post('/auth/mfa/disable', { code: mfaDisableCode });
      setMfaEnabled(false); setMfaDisableCode(''); setMfaSetupData(null);
      setMfaMsg({ type: 'success', text: 'MFA disabled.' });
      showSnack('Two-factor authentication disabled.');
    } catch (err: any) {
      setMfaMsg({ type: 'error', text: err.response?.data?.message || 'Failed to disable MFA.' });
    } finally { setMfaLoading(false); }
  };

  const planColor = tenant?.plan === 'ENTERPRISE' ? { bg: '#EDE7F6', color: '#4527A0' } :
    tenant?.plan === 'GROWTH' ? { bg: '#E3F2FD', color: '#1565C0' } : { bg: '#F3E5F5', color: '#7B1FA2' };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<SettingsIcon />}
        title="ISP Settings"
        subtitle="Manage your account, branding, and ISP preferences"
        iconColor="#00695C"
      />

      <Grid container spacing={3}>
        {/* ─── Left: Sidebar nav ─── */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ position: { md: 'sticky' }, top: 24 }}>
            {/* ISP identity card */}
            <Box sx={{
              background: 'linear-gradient(135deg, #00695C 0%, #004D40 100%)',
              borderRadius: '12px 12px 0 0',
              p: 2.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {brandLogo && !logoPreviewError ? (
                  <Box component="img" src={brandLogo} onError={() => setLogoPreviewError(true)}
                    sx={{ width: 44, height: 44, borderRadius: 2, objectFit: 'contain', bgcolor: 'white', p: 0.5 }} />
                ) : (
                  <Avatar sx={{ width: 44, height: 44, bgcolor: 'rgba(255,255,255,0.2)', fontWeight: 700, fontSize: 16 }}>
                    {getInitials(brandName || tenant?.name || 'ISP')}
                  </Avatar>
                )}
                <Box>
                  <Typography color="white" fontWeight={700} fontSize={14} noWrap sx={{ maxWidth: 140 }}>
                    {brandName || tenant?.name || 'Your ISP'}
                  </Typography>
                  <Typography color="rgba(255,255,255,0.7)" variant="caption">
                    {user?.email}
                  </Typography>
                </Box>
              </Box>
              {tenant?.plan && (
                <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
                  <Chip
                    size="small"
                    icon={<StarIcon sx={{ fontSize: 12, color: planColor.color }} />}
                    label={tenant.plan}
                    sx={{ bgcolor: planColor.bg, color: planColor.color, fontWeight: 700, fontSize: 10, height: 20 }}
                  />
                  {tenant.active && (
                    <Chip size="small" label="Active" icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                      sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 600, fontSize: 10, height: 20 }} />
                  )}
                </Box>
              )}
            </Box>

            {/* Plan usage */}
            {tenant && (
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Customer Quota</Typography>
                  <Typography variant="caption" fontWeight={700} color="#00695C">{tenant.maxCustomers?.toLocaleString()}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Profiles/Customer</Typography>
                  <Typography variant="caption" fontWeight={700} color="#00695C">{tenant.maxProfilesPerCustomer}</Typography>
                </Box>
              </Box>
            )}

            {/* Tab list */}
            <Tabs
              orientation="vertical"
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{
                '& .MuiTab-root': {
                  alignItems: 'flex-start', minHeight: 46, textAlign: 'left', justifyContent: 'flex-start',
                  px: 2, fontSize: 13, fontWeight: 500,
                  '&.Mui-selected': { fontWeight: 700, color: '#00695C' },
                },
                '& .MuiTabs-indicator': { left: 0, right: 'auto', width: 3, bgcolor: '#00695C', borderRadius: '0 2px 2px 0' },
              }}
            >
              {SECTION_TABS.map(t => (
                <Tab key={t.label} label={t.label} icon={t.icon} iconPosition="start"
                  sx={{ gap: 1.5, '& .MuiTab-iconWrapper': { mr: 0 } }} />
              ))}
            </Tabs>
          </Card>
        </Grid>

        {/* ─── Right: Content panels ─── */}
        <Grid size={{ xs: 12, md: 9 }}>

          {/* ── Tab 0: Profile ── */}
          {tab === 0 && (
            <AnimatedPage delay={0.05}>
              <Stack spacing={2.5}>
                {/* Avatar + info */}
                <Card>
                  <CardContent>
                    <SectionHeader icon={<PersonIcon sx={{ color: '#1565C0', fontSize: 20 }} />} title="Account Information" color="#1565C0" bg="#E3F2FD" />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0' }}>
                      <Avatar sx={{ width: 60, height: 60, fontSize: 20, fontWeight: 700, background: 'linear-gradient(135deg, #00695C 0%, #004D40 100%)' }}>
                        {getInitials(name || user?.name || '')}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={700} fontSize={16}>{name || user?.name || 'ISP Admin'}</Typography>
                        <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                          <Chip size="small" label="ISP Admin" sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: '#E0F2F1', color: '#00695C' }} />
                        </Box>
                      </Box>
                    </Box>

                    {profileMsg && <Alert severity={profileMsg.type} sx={{ mb: 2, borderRadius: 2 }}>{profileMsg.text}</Alert>}
                    {profileLoading ? (
                      <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>
                    ) : (
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField label="Full Name" value={name} onChange={e => setName(e.target.value)} fullWidth size="small" sx={inputSx} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField label="Email" value={user?.email || ''} fullWidth size="small" disabled helperText="Email cannot be changed" sx={inputSx} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField label="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} fullWidth size="small" placeholder="+91 9876543210"
                            slotProps={{ input: { startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ fontSize: 18, color: '#90A4AE' }} /></InputAdornment> } }}
                            sx={inputSx} />
                        </Grid>
                        <Grid size={12}>
                          <Button variant="contained" onClick={handleSaveProfile} disabled={profileSaving}
                            sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #00695C 0%, #004D40 100%)' }}>
                            {profileSaving ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
                            {profileSaving ? 'Saving…' : 'Save Changes'}
                          </Button>
                        </Grid>
                      </Grid>
                    )}
                  </CardContent>
                </Card>

                {/* Messaging */}
                <Card>
                  <CardContent>
                    <SectionHeader icon={<WhatsAppIcon sx={{ color: '#43A047', fontSize: 20 }} />} title="Messaging Channels" color="#43A047" bg="#E8F5E9" />
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="WhatsApp Number" placeholder="+91 9876543210" fullWidth size="small"
                          slotProps={{ input: { startAdornment: <InputAdornment position="start"><WhatsAppIcon sx={{ color: '#43A047', fontSize: 18 }} /></InputAdornment> } }}
                          sx={inputSx} />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Telegram Chat ID" placeholder="@your_channel" fullWidth size="small"
                          slotProps={{ input: { startAdornment: <InputAdornment position="start"><TelegramIcon sx={{ color: '#0288D1', fontSize: 18 }} /></InputAdornment> } }}
                          sx={inputSx} />
                      </Grid>
                      <Grid size={12}>
                        <Button variant="outlined" sx={{ borderRadius: 2, borderColor: '#43A047', color: '#43A047', '&:hover': { bgcolor: '#F1F8E9' } }}>
                          Save Channels
                        </Button>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Stack>
            </AnimatedPage>
          )}

          {/* ── Tab 1: ISP Branding ── */}
          {tab === 1 && (
            <AnimatedPage delay={0.05}>
              <Card>
                <CardContent>
                  <SectionHeader icon={<BusinessIcon sx={{ color: '#7B1FA2', fontSize: 20 }} />} title="ISP Branding & Identity" color="#7B1FA2" bg="#F3E5F5" />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Customize how your ISP brand appears to customers in the Shield app.
                  </Typography>

                  {brandMsg && <Alert severity={brandMsg.type} sx={{ mb: 2, borderRadius: 2 }}>{brandMsg.text}</Alert>}

                  <Grid container spacing={2.5}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField label="ISP / Company Name" value={brandName} onChange={e => setBrandName(e.target.value)} fullWidth size="small"
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><BusinessIcon sx={{ fontSize: 18, color: '#7B1FA2' }} /></InputAdornment> } }}
                        sx={inputSx} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField label="Contact Email" value={brandEmail} onChange={e => setBrandEmail(e.target.value)} fullWidth size="small" type="email"
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailIcon sx={{ fontSize: 18, color: '#1565C0' }} /></InputAdornment> } }}
                        sx={inputSx} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField label="Contact Phone" value={brandPhone} onChange={e => setBrandPhone(e.target.value)} fullWidth size="small"
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ fontSize: 18, color: '#90A4AE' }} /></InputAdornment> } }}
                        sx={inputSx} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField label="Logo URL" value={brandLogo} onChange={e => { setBrandLogo(e.target.value); setLogoPreviewError(false); }} fullWidth size="small"
                        placeholder="https://your-isp.com/logo.png"
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><LinkIcon sx={{ fontSize: 18, color: '#90A4AE' }} /></InputAdornment> } }}
                        sx={inputSx} />
                    </Grid>

                    {/* Color picker */}
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75 }}>Brand Primary Color</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          component="input"
                          type="color"
                          value={brandColor}
                          onChange={e => setBrandColor(e.target.value)}
                          style={{ width: 44, height: 44, border: 'none', padding: 0, borderRadius: 8, cursor: 'pointer', outline: '2px solid #E0E0E0' }}
                        />
                        <TextField size="small" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                          sx={{ ...inputSx, flex: 1 }} placeholder="#1565C0"
                          slotProps={{ input: { startAdornment: <InputAdornment position="start"><PaletteIcon sx={{ fontSize: 18, color: brandColor }} /></InputAdornment> } }}
                        />
                      </Box>
                    </Grid>

                    {/* Logo preview */}
                    {brandLogo && !logoPreviewError && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75 }}>Logo Preview</Typography>
                        <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#FAFAFA' }}>
                          <Box component="img" src={brandLogo} onError={() => setLogoPreviewError(true)}
                            sx={{ height: 40, maxWidth: 120, objectFit: 'contain' }} alt="Logo preview" />
                          <Box>
                            <Typography fontWeight={700} fontSize={13} sx={{ color: brandColor }}>{brandName || 'Your ISP'}</Typography>
                            <Typography variant="caption" color="text.secondary">Powered by Shield</Typography>
                          </Box>
                        </Box>
                      </Grid>
                    )}

                    <Grid size={12}>
                      <Button variant="contained" onClick={handleSaveBranding} disabled={brandSaving}
                        sx={{ borderRadius: 2, background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}CC 100%)` }}>
                        {brandSaving ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
                        {brandSaving ? 'Saving…' : 'Save Branding'}
                      </Button>
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 3 }} />

                  {/* Plan features overview */}
                  {tenant?.features && (
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                        <StarIcon sx={{ fontSize: 18, color: '#7B1FA2' }} />
                        <Typography fontWeight={700} fontSize={14}>Enabled Features ({tenant.plan} Plan)</Typography>
                      </Stack>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {Object.entries(tenant.features as Record<string, boolean>).map(([k, v]) => (
                          <Chip key={k} size="small"
                            label={k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            variant={v ? 'filled' : 'outlined'}
                            sx={{
                              height: 24, fontSize: 11, fontWeight: v ? 700 : 400,
                              bgcolor: v ? '#EDE7F6' : 'transparent',
                              color: v ? '#4527A0' : '#90A4AE',
                              borderColor: v ? 'transparent' : '#E0E0E0',
                              opacity: v ? 1 : 0.6,
                            }}
                          />
                        ))}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Features are managed by your plan. Contact Shield support to upgrade.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </AnimatedPage>
          )}

          {/* ── Tab 2: Security ── */}
          {tab === 2 && (
            <AnimatedPage delay={0.05}>
              <Stack spacing={2.5}>
                {/* Change password */}
                <Card>
                  <CardContent>
                    <SectionHeader icon={<LockIcon sx={{ color: '#FB8C00', fontSize: 20 }} />} title="Change Password" color="#FB8C00" bg="#FFF3E0" />
                    {pwdMsg && <Alert severity={pwdMsg.type} sx={{ mb: 2, borderRadius: 2 }}>{pwdMsg.text}</Alert>}
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Current Password" type={showCurrentPwd ? 'text' : 'password'} value={currentPwd}
                          onChange={e => setCurrentPwd(e.target.value)} fullWidth size="small" autoComplete="current-password"
                          slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowCurrentPwd(!showCurrentPwd)} edge="end" size="small">{showCurrentPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> } }}
                          sx={inputSx} />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="New Password" type={showNewPwd ? 'text' : 'password'} value={newPwd}
                          onChange={e => setNewPwd(e.target.value)} fullWidth size="small" autoComplete="new-password" helperText="Min. 8 characters"
                          slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowNewPwd(!showNewPwd)} edge="end" size="small">{showNewPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> } }}
                          sx={inputSx} />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Confirm New Password" type="password" value={confirmPwd}
                          onChange={e => setConfirmPwd(e.target.value)} fullWidth size="small" autoComplete="new-password"
                          error={!!confirmPwd && confirmPwd !== newPwd}
                          helperText={confirmPwd && confirmPwd !== newPwd ? 'Passwords do not match' : ''}
                          sx={inputSx} />
                      </Grid>
                      <Grid size={12}>
                        <Button variant="contained" onClick={handleChangePassword}
                          disabled={pwdSaving || !currentPwd || !newPwd || !confirmPwd || newPwd !== confirmPwd}
                          sx={{ borderRadius: 2, bgcolor: '#C2410C', '&:hover': { bgcolor: '#9A3412' } }}>
                          {pwdSaving ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null}
                          {pwdSaving ? 'Updating…' : 'Update Password'}
                        </Button>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* MFA */}
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                      <Box sx={{ width: 38, height: 38, borderRadius: '10px', bgcolor: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <SecurityIcon sx={{ color: '#2E7D32', fontSize: 20 }} />
                      </Box>
                      <Typography variant="subtitle1" fontWeight={700} fontSize={15}>Two-Factor Authentication</Typography>
                      <Chip label={mfaEnabled ? 'Enabled' : 'Disabled'} size="small" color={mfaEnabled ? 'success' : 'default'}
                        sx={{ ml: 'auto', fontWeight: 700 }} />
                    </Box>

                    {mfaMsg && <Alert severity={mfaMsg.type} sx={{ mb: 2, borderRadius: 2 }}>{mfaMsg.text}</Alert>}

                    {!mfaEnabled ? (
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Secure your ISP admin account with TOTP-based two-factor authentication.
                        </Typography>
                        {!mfaSetupData ? (
                          <Button variant="contained" startIcon={mfaLoading ? <CircularProgress size={16} color="inherit" /> : <QrCode2Icon />}
                            onClick={handleMfaSetup} disabled={mfaLoading}
                            sx={{ borderRadius: 2, bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' } }}>
                            Enable MFA
                          </Button>
                        ) : (
                          <Box>
                            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>1. Scan QR code with your authenticator app:</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, mb: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E0E0E0' }}>
                              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaSetupData.qrCodeUrl)}`}
                                alt="MFA QR" width={200} height={200} style={{ imageRendering: 'pixelated' }} />
                            </Box>
                            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Or enter secret manually:</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5, bgcolor: '#F5F5F5', borderRadius: 1.5 }}>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{mfaSetupData.secret}</Typography>
                              <Tooltip title="Copy"><IconButton size="small" onClick={() => { navigator.clipboard.writeText(mfaSetupData.secret); showSnack('Copied!'); }}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
                            </Box>
                            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>2. Enter 6-digit code:</Typography>
                            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                              <TextField value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000" size="small"
                                slotProps={{ htmlInput: { maxLength: 6, style: { fontFamily: 'monospace', fontSize: 18, letterSpacing: 8, textAlign: 'center' } } }}
                                sx={{ ...inputSx, width: 180 }} />
                              <Button variant="contained" onClick={handleMfaVerify} disabled={mfaLoading || mfaCode.length < 6}
                                sx={{ borderRadius: 2, bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' } }}>
                                {mfaLoading ? <CircularProgress size={18} color="inherit" /> : 'Verify'}
                              </Button>
                            </Box>
                            {showBackupCodes && mfaSetupData.backupCodes && (
                              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Save these backup codes securely!</Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                                  {mfaSetupData.backupCodes.map(code => <Typography key={code} variant="body2" sx={{ fontFamily: 'monospace' }}>{code}</Typography>)}
                                </Box>
                              </Alert>
                            )}
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5, bgcolor: '#E8F5E9', borderRadius: 2 }}>
                          <CheckCircleIcon sx={{ color: '#2E7D32' }} />
                          <Typography variant="body2" color="#2E7D32" fontWeight={600}>MFA is active on your account.</Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Enter your TOTP or backup code to disable:</Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <TextField value={mfaDisableCode} onChange={e => setMfaDisableCode(e.target.value)} placeholder="TOTP or backup code"
                            size="small" sx={{ ...inputSx, flex: 1 }} />
                          <Button variant="outlined" color="error" onClick={handleMfaDisable} disabled={mfaLoading || !mfaDisableCode} sx={{ borderRadius: 2 }}>
                            {mfaLoading ? <CircularProgress size={18} color="inherit" /> : 'Disable MFA'}
                          </Button>
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Stack>
            </AnimatedPage>
          )}

          {/* ── Tab 3: Notifications ── */}
          {tab === 3 && (
            <AnimatedPage delay={0.05}>
              <Stack spacing={2.5}>
                <Card>
                  <CardContent>
                    <SectionHeader icon={<NotificationsIcon sx={{ color: '#7B1FA2', fontSize: 20 }} />} title="Alert Preferences" color="#7B1FA2" bg="#F3E5F5" />
                    <Stack divider={<Divider flexItem />}>
                      <ToggleRow icon={<EmailIcon sx={{ fontSize: 18, color: '#1565C0' }} />} label="Email Alerts" desc="Receive critical alerts via email" checked={emailAlerts} onChange={setEmailAlerts} />
                      <ToggleRow icon={<NotificationsIcon sx={{ fontSize: 18, color: '#7B1FA2' }} />} label="Push Notifications" desc="Browser push notifications" checked={pushAlerts} onChange={setPushAlerts} />
                      <ToggleRow icon={<PeopleIcon sx={{ fontSize: 18, color: '#00695C' }} />} label="Weekly ISP Digest" desc="Customer activity summary every Monday" checked={weeklyReport} onChange={setWeeklyReport} />
                      <ToggleRow icon={<SecurityIcon sx={{ fontSize: 18, color: '#E53935' }} />} label="Suspicious Activity Alerts" desc="Alerts when unusual patterns are detected" checked={suspiciousAlert} onChange={setSuspiciousAlert} />
                      <ToggleRow icon={<StarIcon sx={{ fontSize: 18, color: '#F57F17' }} />} label="High Usage Notifications" desc="When customers exceed 90% quota" checked={highUsageAlert} onChange={setHighUsageAlert} />
                    </Stack>
                    <Button variant="contained" sx={{ mt: 2, borderRadius: 2, background: 'linear-gradient(135deg, #00695C 0%, #004D40 100%)' }}
                      onClick={() => showSnack('Notification preferences saved!')}>
                      Save Preferences
                    </Button>
                  </CardContent>
                </Card>

                <Card sx={{ border: '1px solid #FFECB3' }}>
                  <CardContent>
                    <SectionHeader icon={<EmailIcon sx={{ color: '#F57F17', fontSize: 20 }} />} title="Email Notification Channels" color="#F57F17" bg="#FFF8E1" />
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Notification Email" placeholder="alerts@your-isp.com" fullWidth size="small" defaultValue={user?.email}
                          slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailIcon sx={{ fontSize: 18, color: '#F57F17' }} /></InputAdornment> } }}
                          sx={inputSx} />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Escalation Email" placeholder="manager@your-isp.com" fullWidth size="small"
                          helperText="High-severity alerts only"
                          slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailIcon sx={{ fontSize: 18, color: '#90A4AE' }} /></InputAdornment> } }}
                          sx={inputSx} />
                      </Grid>
                      <Grid size={12}>
                        <Button variant="outlined" sx={{ borderRadius: 2, borderColor: '#F57F17', color: '#7C4700', '&:hover': { bgcolor: 'rgba(245,127,23,0.08)' } }}
                          onClick={() => showSnack('Email channels saved!')}>
                          Save Channels
                        </Button>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Stack>
            </AnimatedPage>
          )}
        </Grid>
      </Grid>

      {/* Delete dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700} color="error">Delete Account</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>This will permanently delete your ISP admin account. Your tenant and customer data will be retained according to your SLA.</Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>Type <strong>DELETE</strong> to confirm:</Typography>
          <TextField fullWidth value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" size="small" />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setDeleteDialog(false); setDeleteConfirm(''); }}>Cancel</Button>
          <Button variant="contained" color="error" disabled={deleteConfirm !== 'DELETE'}
            onClick={() => { showSnack('Account deletion request submitted.'); setDeleteDialog(false); setDeleteConfirm(''); }}>
            Delete Account
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
