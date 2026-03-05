import { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, Alert, CircularProgress, IconButton, InputAdornment, Tooltip,
  Typography, Divider, Box, MenuItem,
} from '@mui/material';
import CasinoIcon from '@mui/icons-material/Casino';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import api from '../api/axios';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface FormState {
  tenantName: string;
  slug: string;
  domain: string;
  contactPhone: string;
  plan: string;
  maxCustomers: number;
  maxProfilesPerCustomer: number;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

const EMPTY: FormState = {
  tenantName: '', slug: '', domain: '', contactPhone: '',
  plan: 'STARTER', maxCustomers: 100, maxProfilesPerCustomer: 5,
  adminName: '', adminEmail: '', adminPassword: '',
};

function autoSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function generatePassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  let pw = '';
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < 14; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

export default function CreateTenantDialog({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'form' | 'creating'>('form');

  const handleClose = useCallback(() => {
    if (saving) return;
    setForm(EMPTY);
    setError('');
    setShowPassword(false);
    setCopied(false);
    setStep('form');
    onClose();
  }, [saving, onClose]);

  function handleGenerate() {
    const pw = generatePassword();
    setForm(f => ({ ...f, adminPassword: pw }));
    setShowPassword(true);
  }

  function handleCopy() {
    if (form.adminPassword) {
      navigator.clipboard.writeText(form.adminPassword).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  async function handleSave() {
    // Validate
    if (!form.tenantName.trim()) { setError('ISP/Tenant name is required'); return; }
    if (!form.adminName.trim() || !form.adminEmail.trim() || !form.adminPassword.trim()) {
      setError('Admin name, email and password are required'); return;
    }
    if (form.adminPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setSaving(true);
    setStep('creating');

    try {
      // Step 1: Create the ISP admin user
      await api.post('/auth/admin/register', {
        name: form.adminName.trim(),
        email: form.adminEmail.trim(),
        password: form.adminPassword,
        role: 'ISP_ADMIN',
      });

      // Step 2: Create the tenant
      try {
        await api.post('/tenants', {
          name: form.tenantName.trim(),
          slug: form.slug.trim() || autoSlug(form.tenantName),
          contactEmail: form.adminEmail.trim(),
          contactPhone: form.contactPhone.trim() || undefined,
          domain: form.domain.trim() || undefined,
          plan: form.plan,
          maxCustomers: form.maxCustomers,
          maxProfilesPerCustomer: form.maxProfilesPerCustomer,
        });
      } catch (tenantErr: any) {
        // Admin user was created but tenant creation failed
        const msg = tenantErr.response?.data?.message || 'Tenant creation failed';
        setError(`ISP admin user created, but tenant creation failed: ${msg}. You may need to create the tenant manually.`);
        setSaving(false);
        setStep('form');
        return;
      }

      onSuccess(`ISP "${form.tenantName.trim()}" created with admin ${form.adminEmail.trim()}`);
      setForm(EMPTY);
      setShowPassword(false);
      setCopied(false);
      setStep('form');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create ISP admin user');
      setStep('form');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>Add New ISP / Tenant</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Tenant details section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <BusinessIcon sx={{ color: '#1565C0', fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">ISP / Tenant Details</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={12}>
            <TextField fullWidth label="ISP / Tenant Name *" value={form.tenantName}
              onChange={e => {
                const name = e.target.value;
                setForm(f => ({ ...f, tenantName: name, slug: autoSlug(name) }));
              }}
              autoFocus />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Slug" value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              helperText="Auto-generated from name" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Domain" value={form.domain}
              onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
              placeholder="isp.example.com" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField fullWidth select label="Plan" value={form.plan}
              onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
              {['STARTER', 'GROWTH', 'ENTERPRISE'].map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField fullWidth label="Max Customers" type="number" value={form.maxCustomers}
              onChange={e => setForm(f => ({ ...f, maxCustomers: Number(e.target.value) }))}
              slotProps={{ htmlInput: { min: 1, max: 100000 } }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField fullWidth label="Max Profiles/Cust" type="number" value={form.maxProfilesPerCustomer}
              onChange={e => setForm(f => ({ ...f, maxProfilesPerCustomer: Number(e.target.value) }))}
              slotProps={{ htmlInput: { min: 1, max: 20 } }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Contact Phone" value={form.contactPhone}
              onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
              placeholder="+1 555 000 0000" />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2.5 }} />

        {/* Admin user section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <PersonIcon sx={{ color: '#FB8C00', fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">ISP Admin Account</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={12}>
            <TextField fullWidth label="Admin Full Name *" value={form.adminName}
              onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))} />
          </Grid>
          <Grid size={12}>
            <TextField fullWidth label="Admin Email *" type="email" value={form.adminEmail}
              onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))} />
          </Grid>
          <Grid size={12}>
            <TextField
              fullWidth
              label="Admin Password * (min 8 characters)"
              type={showPassword ? 'text' : 'password'}
              value={form.adminPassword}
              onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={copied ? 'Copied!' : 'Copy password'}>
                        <IconButton size="small" onClick={handleCopy} disabled={!form.adminPassword}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={showPassword ? 'Hide' : 'Show'}>
                        <IconButton size="small" onClick={() => setShowPassword(v => !v)}>
                          {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Generate random password">
                        <IconButton size="small" onClick={handleGenerate}>
                          <CasinoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          sx={{ bgcolor: '#1565C0', minWidth: 140 }}>
          {saving ? <CircularProgress size={18} color="inherit" /> : 'Create ISP'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
