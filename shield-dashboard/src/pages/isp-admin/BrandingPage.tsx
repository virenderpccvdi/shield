import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Button,
  TextField, Stack, Snackbar, Alert, Divider,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BrushIcon from '@mui/icons-material/Brush';
import SaveIcon from '@mui/icons-material/Save';
import PaletteIcon from '@mui/icons-material/Palette';
import BusinessIcon from '@mui/icons-material/Business';
import ImageIcon from '@mui/icons-material/Image';
import ShieldIcon from '@mui/icons-material/Shield';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import VisibilityIcon from '@mui/icons-material/Visibility';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import LoadingPage from '../../components/LoadingPage';
import { useAuthStore } from '../../store/auth.store';

const TEAL = '#00695C';
const TEAL_DARK = '#004D40';

interface BrandingConfig {
  brandName: string;
  brandColor: string;
  brandLogoUrl: string;
  supportEmail: string;
  supportPhone: string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  brandName: '',
  brandColor: '#00897B',
  brandLogoUrl: '',
  supportEmail: '',
  supportPhone: '',
};

export default function BrandingPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.tenantId;

  const [form, setForm] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [dirty, setDirty] = useState(false);
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['branding', tenantId],
    enabled: !!tenantId,
    queryFn: () =>
      api
        .get(`/tenants/${tenantId}/branding`)
        .then((r) => r.data?.data as BrandingConfig)
        .catch(() => null),
  });

  useEffect(() => {
    if (data) {
      setForm({ ...DEFAULT_BRANDING, ...data });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/tenants/${tenantId}/branding`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branding', tenantId] });
      setDirty(false);
      setPreviewColor(null);
      setSnack({ msg: 'Branding saved successfully', severity: 'success' });
    },
    onError: () => setSnack({ msg: 'Failed to save branding', severity: 'error' }),
  });

  const updateField = (field: keyof BrandingConfig, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const applyPreview = () => {
    setPreviewColor(form.brandColor);
  };

  if (isLoading) return <LoadingPage />;

  const activeColor = previewColor ?? form.brandColor ?? '#00897B';

  return (
    <AnimatedPage>
      <PageHeader
        icon={<BrushIcon />}
        title="White-label Branding"
        subtitle="Customize your brand identity for the customer-facing experience"
        iconColor={TEAL}
        action={
          dirty ? (
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              sx={{ bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK } }}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Branding'}
            </Button>
          ) : undefined
        }
      />

      <Grid container spacing={2.5}>
        {/* ── Brand Identity ───────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.1}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '8px',
                    bgcolor: '#E0F2F1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: TEAL,
                  }}>
                    <BusinessIcon fontSize="small" />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Brand Identity</Typography>
                </Box>
                <Stack spacing={2}>
                  <TextField
                    label="Brand Name"
                    value={form.brandName}
                    onChange={(e) => updateField('brandName', e.target.value)}
                    fullWidth size="small"
                    placeholder="Your ISP brand name (e.g. Acme Broadband)"
                    helperText="Displayed to customers in the app and emails"
                  />
                  <TextField
                    label="Logo URL"
                    value={form.brandLogoUrl}
                    onChange={(e) => updateField('brandLogoUrl', e.target.value)}
                    fullWidth size="small"
                    placeholder="https://yourisp.com/logo.svg"
                  />
                  {form.brandLogoUrl && (
                    <Box sx={{
                      p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px dashed #E0E0E0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <img
                        src={form.brandLogoUrl}
                        alt="Brand logo preview"
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

        {/* ── Brand Color ──────────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.15}>
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
                  <Typography variant="subtitle1" fontWeight={600}>Primary Brand Color</Typography>
                </Box>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      component="input"
                      type="color"
                      value={form.brandColor || '#00897B'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateField('brandColor', e.target.value)}
                      sx={{
                        width: 52, height: 52, border: '2px solid #E0E0E0', borderRadius: 2,
                        cursor: 'pointer', p: 0.3, flexShrink: 0,
                        '&::-webkit-color-swatch': { borderRadius: 1, border: 'none' },
                      }}
                    />
                    <TextField
                      label="Hex Color"
                      value={form.brandColor || ''}
                      onChange={(e) => updateField('brandColor', e.target.value)}
                      size="small"
                      fullWidth
                      placeholder="#00897B"
                      inputProps={{ maxLength: 9 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {['#00897B', '#1565C0', '#2E7D32', '#6A1B9A', '#E53935', '#F57C00'].map((c) => (
                      <Box
                        key={c}
                        onClick={() => updateField('brandColor', c)}
                        sx={{
                          width: 28, height: 28, borderRadius: '50%', bgcolor: c,
                          cursor: 'pointer', border: form.brandColor === c ? '3px solid #333' : '2px solid transparent',
                          transition: 'border 0.15s',
                          '&:hover': { opacity: 0.85 },
                        }}
                      />
                    ))}
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    size="small"
                    onClick={applyPreview}
                    sx={{ alignSelf: 'flex-start', borderColor: TEAL, color: TEAL }}
                  >
                    Preview color
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* ── Support Contact ──────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.2}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '8px',
                    bgcolor: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#2E7D32',
                  }}>
                    <SupportAgentIcon fontSize="small" />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Support Contact</Typography>
                </Box>
                <Stack spacing={2}>
                  <TextField
                    label="Support Email"
                    value={form.supportEmail}
                    onChange={(e) => updateField('supportEmail', e.target.value)}
                    fullWidth size="small"
                    placeholder="support@yourisp.com"
                    type="email"
                  />
                  <TextField
                    label="Support Phone"
                    value={form.supportPhone}
                    onChange={(e) => updateField('supportPhone', e.target.value)}
                    fullWidth size="small"
                    placeholder="+91 1234567890"
                  />
                  <Typography variant="caption" color="text.secondary">
                    These contact details are shown to customers when they need help.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* ── Logo / Asset placeholder ─────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AnimatedPage delay={0.25}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '8px',
                    bgcolor: '#FFF8E1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#F57C00',
                  }}>
                    <ImageIcon fontSize="small" />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>Branding Tips</Typography>
                </Box>
                <Stack spacing={1.5}>
                  {[
                    'Use an SVG or PNG logo on a transparent background for best results.',
                    'Recommended logo dimensions: 200 × 60 px or wider.',
                    'The brand color is applied to headers and primary buttons in the customer portal.',
                    'Support contact details appear in the customer app "Help" section.',
                  ].map((tip, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1 }}>
                      <Typography variant="body2" sx={{ color: '#F57C00', fontWeight: 700, flexShrink: 0 }}>
                        {i + 1}.
                      </Typography>
                      <Typography variant="body2" color="text.secondary">{tip}</Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* ── Live Preview ─────────────────────────────────────────────────── */}
        <Grid size={12}>
          <AnimatedPage delay={0.3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600}>Live Preview</Typography>
                  {previewColor && (
                    <Typography variant="caption" sx={{
                      bgcolor: '#E0F2F1', color: TEAL, px: 1.5, py: 0.5, borderRadius: 2,
                    }}>
                      Previewing {previewColor}
                    </Typography>
                  )}
                </Box>

                <Box sx={{
                  border: '1px solid #E0E0E0', borderRadius: 3, overflow: 'hidden',
                  bgcolor: '#F8FAFC',
                }}>
                  {/* Preview header bar */}
                  <Box sx={{
                    bgcolor: activeColor, px: 3, py: 2,
                    display: 'flex', alignItems: 'center', gap: 2,
                  }}>
                    {form.brandLogoUrl ? (
                      <img
                        src={form.brandLogoUrl}
                        alt="Logo"
                        style={{ height: 32, maxWidth: 120, objectFit: 'contain' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <ShieldIcon sx={{ color: 'white', fontSize: 28 }} />
                    )}
                    <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
                      {form.brandName || 'Your Brand Name'}
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    {form.supportEmail && (
                      <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                        {form.supportEmail}
                      </Typography>
                    )}
                  </Box>

                  {/* Preview body */}
                  <Box sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Protected Devices', value: 12 },
                        { label: 'Threats Blocked', value: 247 },
                        { label: 'Active Plans', value: 5 },
                      ].map((stat) => (
                        <Box key={stat.label} sx={{
                          flex: 1, minWidth: 110, p: 2, borderRadius: 2,
                          bgcolor: 'white', border: '1px solid #E0E0E0',
                        }}>
                          <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                          <Typography variant="h5" fontWeight={700} sx={{ color: activeColor }}>
                            {stat.value}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                      <Button
                        variant="contained"
                        size="small"
                        sx={{ bgcolor: activeColor, '&:hover': { bgcolor: activeColor, filter: 'brightness(0.9)' } }}
                      >
                        Manage Settings
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{ borderColor: activeColor, color: activeColor }}
                      >
                        View Reports
                      </Button>
                      {form.supportPhone && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                          Support: {form.supportPhone}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>
      </Grid>

      {/* ── Save button (bottom sticky for convenience) ──────────────────────── */}
      {dirty && (
        <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1200 }}>
          <Button
            variant="contained"
            startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            sx={{
              bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK },
              boxShadow: 4, borderRadius: 3, px: 3,
            }}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Branding'}
          </Button>
        </Box>
      )}

      <Snackbar
        open={!!snack}
        autoHideDuration={3500}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled">
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </AnimatedPage>
  );
}
