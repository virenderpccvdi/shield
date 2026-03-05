import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Button,
  TextField, Stack, Divider, Snackbar
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BrushIcon from '@mui/icons-material/Brush';
import SaveIcon from '@mui/icons-material/Save';
import PaletteIcon from '@mui/icons-material/Palette';
import BusinessIcon from '@mui/icons-material/Business';
import LanguageIcon from '@mui/icons-material/Language';
import ImageIcon from '@mui/icons-material/Image';
import ShieldIcon from '@mui/icons-material/Shield';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

interface BrandingConfig {
  companyName: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  customDomain?: string;
  supportEmail?: string;
  supportPhone?: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  companyName: '',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#1565C0',
  secondaryColor: '#43A047',
  accentColor: '#FB8C00',
  customDomain: '',
  supportEmail: '',
  supportPhone: '',
  privacyPolicyUrl: '',
  termsUrl: '',
};

export default function BrandingPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [dirty, setDirty] = useState(false);
  const [snack, setSnack] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['branding'],
    queryFn: () => api.get('/admin/branding').then(r => r.data as BrandingConfig).catch(() => null),
  });

  useEffect(() => {
    if (data) {
      setForm({ ...DEFAULT_BRANDING, ...data });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (brandingData: BrandingConfig) => api.put('/admin/branding', brandingData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branding'] });
      setDirty(false);
      setSnack('Branding saved successfully');
    },
    onError: () => setSnack('Failed to save branding'),
  });

  const updateField = (field: keyof BrandingConfig, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<BrushIcon />}
        title="Branding"
        subtitle="Customize your white-label experience"
        iconColor="#7B1FA2"
        action={
          dirty ? (
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
              sx={{ bgcolor: '#7B1FA2', '&:hover': { bgcolor: '#6A1B9A' } }}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          ) : undefined
        }
      />

      <Grid container spacing={2.5}>
        {/* Company Info */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.1}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '8px',
                    bgcolor: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#1565C0',
                  }}>
                    <BusinessIcon fontSize="small" />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Company Information</Typography>
                </Box>
                <Stack spacing={2}>
                  <TextField
                    label="Company Name"
                    value={form.companyName}
                    onChange={e => updateField('companyName', e.target.value)}
                    fullWidth size="small"
                    placeholder="Your ISP Name"
                  />
                  <TextField
                    label="Support Email"
                    value={form.supportEmail || ''}
                    onChange={e => updateField('supportEmail', e.target.value)}
                    fullWidth size="small"
                    placeholder="support@yourisp.com"
                  />
                  <TextField
                    label="Support Phone"
                    value={form.supportPhone || ''}
                    onChange={e => updateField('supportPhone', e.target.value)}
                    fullWidth size="small"
                    placeholder="+91 1234567890"
                  />
                </Stack>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Logo & Assets */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.15}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '8px',
                    bgcolor: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#FB8C00',
                  }}>
                    <ImageIcon fontSize="small" />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Logo & Assets</Typography>
                </Box>
                <Stack spacing={2}>
                  <TextField
                    label="Logo URL"
                    value={form.logoUrl || ''}
                    onChange={e => updateField('logoUrl', e.target.value)}
                    fullWidth size="small"
                    placeholder="https://yourisp.com/logo.svg"
                  />
                  <TextField
                    label="Favicon URL"
                    value={form.faviconUrl || ''}
                    onChange={e => updateField('faviconUrl', e.target.value)}
                    fullWidth size="small"
                    placeholder="https://yourisp.com/favicon.ico"
                  />
                  {form.logoUrl && (
                    <Box sx={{
                      p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px dashed #E0E0E0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <img
                        src={form.logoUrl}
                        alt="Logo preview"
                        style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Colors */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.2}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '8px',
                    bgcolor: '#F3E5F5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#7B1FA2',
                  }}>
                    <PaletteIcon fontSize="small" />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Brand Colors</Typography>
                </Box>
                <Stack spacing={2}>
                  {([
                    { field: 'primaryColor' as const, label: 'Primary Color' },
                    { field: 'secondaryColor' as const, label: 'Secondary Color' },
                    { field: 'accentColor' as const, label: 'Accent Color' },
                  ]).map(({ field, label }) => (
                    <Box key={field} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        component="input"
                        type="color"
                        value={form[field] || '#1565C0'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(field, e.target.value)}
                        sx={{
                          width: 44, height: 44, border: '2px solid #E0E0E0', borderRadius: 2,
                          cursor: 'pointer', p: 0.3,
                          '&::-webkit-color-swatch': { borderRadius: 1, border: 'none' },
                        }}
                      />
                      <TextField
                        label={label}
                        value={form[field] || ''}
                        onChange={e => updateField(field, e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="#1565C0"
                      />
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Domain & Links */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.25}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '8px',
                    bgcolor: '#E0F2F1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#00897B',
                  }}>
                    <LanguageIcon fontSize="small" />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Domain & Legal</Typography>
                </Box>
                <Stack spacing={2}>
                  <TextField
                    label="Custom Domain"
                    value={form.customDomain || ''}
                    onChange={e => updateField('customDomain', e.target.value)}
                    fullWidth size="small"
                    placeholder="parental.yourisp.com"
                    helperText="Point your CNAME to shield.rstglobal.in"
                  />
                  <TextField
                    label="Privacy Policy URL"
                    value={form.privacyPolicyUrl || ''}
                    onChange={e => updateField('privacyPolicyUrl', e.target.value)}
                    fullWidth size="small"
                    placeholder="https://yourisp.com/privacy"
                  />
                  <TextField
                    label="Terms of Service URL"
                    value={form.termsUrl || ''}
                    onChange={e => updateField('termsUrl', e.target.value)}
                    fullWidth size="small"
                    placeholder="https://yourisp.com/terms"
                  />
                </Stack>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Live Preview */}
        <Grid size={12}>
          <AnimatedPage delay={0.3}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Live Preview</Typography>
                <Box sx={{
                  border: '1px solid #E0E0E0', borderRadius: 3, overflow: 'hidden',
                  bgcolor: '#F8FAFC',
                }}>
                  {/* Preview header */}
                  <Box sx={{
                    bgcolor: form.primaryColor || '#1565C0', px: 3, py: 2,
                    display: 'flex', alignItems: 'center', gap: 2,
                  }}>
                    {form.logoUrl ? (
                      <img
                        src={form.logoUrl}
                        alt="Logo"
                        style={{ height: 32, maxWidth: 120, objectFit: 'contain' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <ShieldIcon sx={{ color: 'white', fontSize: 28 }} />
                    )}
                    <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
                      {form.companyName || 'Your ISP Name'}
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                      {form.customDomain || 'parental.yourisp.com'}
                    </Typography>
                  </Box>
                  {/* Preview body */}
                  <Box sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <Box sx={{
                        flex: 1, p: 2, borderRadius: 2,
                        bgcolor: 'white', border: '1px solid #E0E0E0',
                      }}>
                        <Typography variant="caption" color="text.secondary">Protected Devices</Typography>
                        <Typography variant="h5" fontWeight={700} sx={{ color: form.primaryColor }}>12</Typography>
                      </Box>
                      <Box sx={{
                        flex: 1, p: 2, borderRadius: 2,
                        bgcolor: 'white', border: '1px solid #E0E0E0',
                      }}>
                        <Typography variant="caption" color="text.secondary">Threats Blocked</Typography>
                        <Typography variant="h5" fontWeight={700} sx={{ color: form.secondaryColor }}>247</Typography>
                      </Box>
                      <Box sx={{
                        flex: 1, p: 2, borderRadius: 2,
                        bgcolor: 'white', border: '1px solid #E0E0E0',
                      }}>
                        <Typography variant="caption" color="text.secondary">Active Plans</Typography>
                        <Typography variant="h5" fontWeight={700} sx={{ color: form.accentColor || '#FB8C00' }}>5</Typography>
                      </Box>
                    </Box>
                    <Button
                      variant="contained"
                      size="small"
                      sx={{ bgcolor: form.secondaryColor || '#43A047', '&:hover': { bgcolor: form.secondaryColor || '#43A047', filter: 'brightness(0.9)' } }}
                    >
                      Sample Button
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>
      </Grid>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack('')}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </AnimatedPage>
  );
}
