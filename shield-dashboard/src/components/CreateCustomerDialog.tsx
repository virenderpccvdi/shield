import { useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Grid, Alert, CircularProgress, IconButton, InputAdornment, Tooltip,
} from '@mui/material';
import CasinoIcon from '@mui/icons-material/Casino';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import api from '../api/axios';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface FormState {
  name: string;
  email: string;
  password: string;
  phone: string;
}

const EMPTY: FormState = { name: '', email: '', password: '', phone: '' };

function generatePassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  // Guarantee at least one of each type
  let pw = '';
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < 14; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  // Shuffle
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

export default function CreateCustomerDialog({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleClose = useCallback(() => {
    if (saving) return;
    setForm(EMPTY);
    setError('');
    setShowPassword(false);
    setCopied(false);
    onClose();
  }, [saving, onClose]);

  function handleGenerate() {
    const pw = generatePassword();
    setForm(f => ({ ...f, password: pw }));
    setShowPassword(true);
  }

  function handleCopy() {
    if (form.password) {
      navigator.clipboard.writeText(form.password).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Name, email and password are required');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.post('/auth/admin/register', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        role: 'CUSTOMER',
      });
      onSuccess(`Customer "${form.name.trim()}" created successfully`);
      setForm(EMPTY);
      setShowPassword(false);
      setCopied(false);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>Add New Customer</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2}>
          <Grid size={12}>
            <TextField fullWidth label="Full Name *" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Email *" type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Phone" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+1 555 000 0000" />
          </Grid>
          <Grid size={12}>
            <TextField
              fullWidth
              label="Password * (min 8 characters)"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={copied ? 'Copied!' : 'Copy password'}>
                        <IconButton size="small" onClick={handleCopy} disabled={!form.password}>
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
          {saving ? <CircularProgress size={18} color="inherit" /> : 'Create Customer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
