import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, Switch,
  CircularProgress, Alert, Grid, Snackbar, Divider, InputAdornment,
  IconButton, Chip, Select, MenuItem, FormControl, InputLabel, FormHelperText,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import TelegramIcon from '@mui/icons-material/Telegram';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import NotificationsIcon from '@mui/icons-material/Notifications';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import LoadingPage from '../../components/LoadingPage';

interface ChannelData {
  channelType: string;
  enabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  smtpTls?: boolean;
  whatsappApiUrl?: string;
  whatsappApiKey?: string;
  whatsappFromNumber?: string;
  telegramBotToken?: string;
  telegramBotUsername?: string;
}

const DEFAULT_SMTP: ChannelData = {
  channelType: 'SMTP', enabled: false,
  smtpHost: '', smtpPort: 587, smtpUsername: '', smtpPassword: '',
  smtpFromEmail: '', smtpFromName: 'Shield', smtpTls: true,
};
const DEFAULT_WHATSAPP: ChannelData = {
  channelType: 'WHATSAPP', enabled: false,
  whatsappApiUrl: 'https://waba.360dialog.io/v1', whatsappApiKey: '', whatsappFromNumber: '',
};
const DEFAULT_TELEGRAM: ChannelData = {
  channelType: 'TELEGRAM', enabled: false,
  telegramBotToken: '', telegramBotUsername: '',
};

export default function NotificationChannelsPage() {
  const [smtp, setSmtp] = useState<ChannelData>(DEFAULT_SMTP);
  const [whatsapp, setWhatsapp] = useState<ChannelData>(DEFAULT_WHATSAPP);
  const [telegram, setTelegram] = useState<ChannelData>(DEFAULT_TELEGRAM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testRecipient, setTestRecipient] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications/admin/channels?scope=platform');
      const channels = data.data || [];
      for (const ch of channels) {
        if (ch.channelType === 'SMTP') setSmtp({ ...DEFAULT_SMTP, ...ch, smtpPassword: '' });
        else if (ch.channelType === 'WHATSAPP') setWhatsapp({ ...DEFAULT_WHATSAPP, ...ch, whatsappApiKey: '' });
        else if (ch.channelType === 'TELEGRAM') setTelegram({ ...DEFAULT_TELEGRAM, ...ch, telegramBotToken: '' });
      }
    } catch { /* keep defaults */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const handleSave = async (channel: ChannelData) => {
    setSaving(channel.channelType);
    try {
      // Don't send empty password fields (backend keeps existing if null)
      const payload = { ...channel };
      if (channel.channelType === 'SMTP' && !payload.smtpPassword) delete payload.smtpPassword;
      if (channel.channelType === 'WHATSAPP' && !payload.whatsappApiKey) delete payload.whatsappApiKey;
      if (channel.channelType === 'TELEGRAM' && !payload.telegramBotToken) delete payload.telegramBotToken;

      await api.put('/notifications/admin/channels?scope=platform', payload);
      setSnack({ msg: `${channel.channelType} channel saved successfully`, severity: 'success' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSnack({ msg: e.response?.data?.message || `Failed to save ${channel.channelType}`, severity: 'error' });
    }
    setSaving(null);
  };

  const handleTest = async (channelType: string) => {
    if (!testRecipient.trim()) {
      setSnack({ msg: 'Enter a test recipient first', severity: 'error' });
      return;
    }
    setTesting(channelType);
    try {
      await api.post(`/notifications/admin/channels/test?scope=platform&channelType=${channelType}&testRecipient=${encodeURIComponent(testRecipient.trim())}`);
      setSnack({ msg: `Test ${channelType} message sent to ${testRecipient}`, severity: 'success' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSnack({ msg: e.response?.data?.message || `Test failed for ${channelType}`, severity: 'error' });
    }
    setTesting(null);
  };

  const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

  if (loading) return (
    <LoadingPage />
  );

  return (
    <AnimatedPage>
      <PageHeader
        icon={<NotificationsIcon />}
        title="Notification Channels"
        subtitle="Configure platform-wide email, WhatsApp, and Telegram delivery"
        iconColor="#7B1FA2"
      />

      {/* Test recipient input */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight={600} color="text.secondary">Test Recipient:</Typography>
            <TextField
              size="small" placeholder="email@example.com or phone number"
              value={testRecipient} onChange={e => setTestRecipient(e.target.value)}
              sx={{ ...inputSx, minWidth: 300 }}
            />
            <Typography variant="caption" color="text.secondary">
              Used for sending test messages to verify channel configuration
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* ─── SMTP Email ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <AnimatedPage delay={0.1}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <EmailIcon sx={{ color: '#1565C0' }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>SMTP Email</Typography>
                      <Typography variant="caption" color="text.secondary">Send alerts, reports, and notifications via email</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" label={smtp.enabled ? 'Active' : 'Disabled'} color={smtp.enabled ? 'success' : 'default'} />
                    <Switch checked={smtp.enabled} onChange={e => setSmtp(s => ({ ...s, enabled: e.target.checked }))} />
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField label="SMTP Host" value={smtp.smtpHost} fullWidth size="small"
                      onChange={e => setSmtp(s => ({ ...s, smtpHost: e.target.value }))}
                      placeholder="smtp.zoho.com" sx={inputSx} />
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel>Security / Port</InputLabel>
                      <Select label="Security / Port" value={smtp.smtpPort === 465 ? '465' : smtp.smtpPort === 25 ? '25' : '587'}
                        onChange={e => {
                          const p = parseInt(e.target.value as string);
                          setSmtp(s => ({ ...s, smtpPort: p, smtpTls: p !== 25 }));
                        }} sx={{ borderRadius: 2 }}>
                        <MenuItem value="465">465 — SSL/TLS</MenuItem>
                        <MenuItem value="587">587 — STARTTLS</MenuItem>
                        <MenuItem value="25">25 — None</MenuItem>
                      </Select>
                      <FormHelperText>{smtp.smtpPort === 465 ? 'Implicit SSL — Zoho, Gmail' : smtp.smtpPort === 587 ? 'STARTTLS — Office365' : 'Unencrypted'}</FormHelperText>
                    </FormControl>
                  </Box>
                  <TextField label="Username" value={smtp.smtpUsername} fullWidth size="small"
                    onChange={e => setSmtp(s => ({ ...s, smtpUsername: e.target.value }))}
                    placeholder="your-email@gmail.com" sx={inputSx} />
                  <TextField label="Password / App Password" value={smtp.smtpPassword || ''} fullWidth size="small"
                    type={showPwd ? 'text' : 'password'}
                    onChange={e => setSmtp(s => ({ ...s, smtpPassword: e.target.value }))}
                    placeholder="Leave blank to keep existing"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPwd(!showPwd)} edge="end" size="small">
                            {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={inputSx} />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField label="From Email" value={smtp.smtpFromEmail} fullWidth size="small"
                      onChange={e => setSmtp(s => ({ ...s, smtpFromEmail: e.target.value }))}
                      placeholder="noreply@shield.rstglobal.in" sx={inputSx} />
                    <TextField label="From Name" value={smtp.smtpFromName} fullWidth size="small"
                      onChange={e => setSmtp(s => ({ ...s, smtpFromName: e.target.value }))}
                      placeholder="Shield" sx={inputSx} />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" icon={<EmailIcon fontSize="small" />}
                      label={smtp.smtpPort === 465 ? 'Implicit SSL active' : smtp.smtpPort === 587 ? 'STARTTLS active' : 'No encryption'}
                      color={smtp.smtpPort === 465 || smtp.smtpPort === 587 ? 'success' : 'warning'}
                      variant="outlined" />
                    <Typography variant="caption" color="text.secondary">
                      Encryption mode is set automatically from the port selection above
                    </Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button variant="contained" startIcon={<SaveIcon />}
                      onClick={() => handleSave(smtp)} disabled={saving === 'SMTP'}
                      sx={{ borderRadius: 2, bgcolor: '#1565C0' }}>
                      {saving === 'SMTP' ? <CircularProgress size={18} color="inherit" /> : 'Save SMTP'}
                    </Button>
                    <Button variant="outlined" startIcon={<SendIcon />}
                      onClick={() => handleTest('EMAIL')} disabled={testing === 'EMAIL'}
                      sx={{ borderRadius: 2 }}>
                      {testing === 'EMAIL' ? <CircularProgress size={18} /> : 'Send Test Email'}
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* ─── WhatsApp ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <AnimatedPage delay={0.2}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <WhatsAppIcon sx={{ color: '#43A047' }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>WhatsApp</Typography>
                      <Typography variant="caption" color="text.secondary">Send alerts via WhatsApp Business API (360dialog)</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" label={whatsapp.enabled ? 'Active' : 'Disabled'} color={whatsapp.enabled ? 'success' : 'default'} />
                    <Switch checked={whatsapp.enabled} onChange={e => setWhatsapp(s => ({ ...s, enabled: e.target.checked }))} />
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField label="API URL" value={whatsapp.whatsappApiUrl} fullWidth size="small"
                    onChange={e => setWhatsapp(s => ({ ...s, whatsappApiUrl: e.target.value }))} sx={inputSx} />
                  <TextField label="API Key" value={whatsapp.whatsappApiKey || ''} fullWidth size="small"
                    type="password" placeholder="Leave blank to keep existing"
                    onChange={e => setWhatsapp(s => ({ ...s, whatsappApiKey: e.target.value }))} sx={inputSx} />
                  <TextField label="From Number" value={whatsapp.whatsappFromNumber} fullWidth size="small"
                    placeholder="+1234567890"
                    onChange={e => setWhatsapp(s => ({ ...s, whatsappFromNumber: e.target.value }))} sx={inputSx} />
                  <Divider />
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button variant="contained" startIcon={<SaveIcon />}
                      onClick={() => handleSave(whatsapp)} disabled={saving === 'WHATSAPP'}
                      sx={{ borderRadius: 2, bgcolor: '#43A047', '&:hover': { bgcolor: '#2E7D32' } }}>
                      {saving === 'WHATSAPP' ? <CircularProgress size={18} color="inherit" /> : 'Save WhatsApp'}
                    </Button>
                    <Button variant="outlined" startIcon={<SendIcon />} color="success"
                      onClick={() => handleTest('WHATSAPP')} disabled={testing === 'WHATSAPP'}
                      sx={{ borderRadius: 2 }}>
                      {testing === 'WHATSAPP' ? <CircularProgress size={18} /> : 'Send Test'}
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* ─── Telegram ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <AnimatedPage delay={0.3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TelegramIcon sx={{ color: '#0288D1' }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>Telegram</Typography>
                      <Typography variant="caption" color="text.secondary">Send alerts via Telegram Bot API</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="small" label={telegram.enabled ? 'Active' : 'Disabled'} color={telegram.enabled ? 'success' : 'default'} />
                    <Switch checked={telegram.enabled} onChange={e => setTelegram(s => ({ ...s, enabled: e.target.checked }))} />
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField label="Bot Token" value={telegram.telegramBotToken || ''} fullWidth size="small"
                    type="password" placeholder="Leave blank to keep existing"
                    onChange={e => setTelegram(s => ({ ...s, telegramBotToken: e.target.value }))} sx={inputSx} />
                  <TextField label="Bot Username" value={telegram.telegramBotUsername} fullWidth size="small"
                    placeholder="@ShieldAlertBot"
                    onChange={e => setTelegram(s => ({ ...s, telegramBotUsername: e.target.value }))} sx={inputSx} />
                  <Divider />
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button variant="contained" startIcon={<SaveIcon />}
                      onClick={() => handleSave(telegram)} disabled={saving === 'TELEGRAM'}
                      sx={{ borderRadius: 2, bgcolor: '#0288D1', '&:hover': { bgcolor: '#01579B' } }}>
                      {saving === 'TELEGRAM' ? <CircularProgress size={18} color="inherit" /> : 'Save Telegram'}
                    </Button>
                    <Button variant="outlined" startIcon={<SendIcon />}
                      onClick={() => handleTest('TELEGRAM')} disabled={testing === 'TELEGRAM'}
                      sx={{ borderRadius: 2, color: '#0288D1', borderColor: '#0288D1' }}>
                      {testing === 'TELEGRAM' ? <CircularProgress size={18} /> : 'Send Test'}
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>
      </Grid>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.severity || 'success'} onClose={() => setSnack(null)} sx={{ borderRadius: 2 }}>
          {snack?.msg}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
