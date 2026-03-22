import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Stack, Chip, CircularProgress, Switch, FormControlLabel, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import GavelIcon from '@mui/icons-material/Gavel';
import Icon from '@mui/material/Icon';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { useAuthStore } from '../../store/auth.store';

interface FamilyRule {
  id: string;
  customerId: string;
  title: string;
  description?: string;
  icon: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

const AVAILABLE_ICONS = [
  { name: 'rule', label: 'General Rule' },
  { name: 'schedule', label: 'Schedule' },
  { name: 'school', label: 'School' },
  { name: 'sports_esports', label: 'Gaming' },
  { name: 'phone_android', label: 'Phone' },
  { name: 'family_restroom', label: 'Family' },
  { name: 'bedroom_baby', label: 'Bedroom' },
  { name: 'restaurant', label: 'Mealtime' },
];

const THEME_COLOR = '#1565C0';

interface RuleDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (title: string, description: string, icon: string) => Promise<void>;
  initial?: FamilyRule;
  saving: boolean;
}

function RuleDialog({ open, onClose, onSave, initial, saving }: RuleDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('rule');

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '');
      setDescription(initial?.description ?? '');
      setIcon(initial?.icon ?? 'rule');
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!title.trim()) return;
    await onSave(title.trim(), description.trim(), icon);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {initial ? 'Edit Rule' : 'Add Family Rule'}
      </DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        <Stack spacing={2.5}>
          <TextField
            label="Rule Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            fullWidth
            required
            inputProps={{ maxLength: 200 }}
            placeholder="e.g. No phones during dinner"
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Explain the rule to your children"
          />
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              Icon
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {AVAILABLE_ICONS.map(ic => (
                <Tooltip key={ic.name} title={ic.label}>
                  <Box
                    onClick={() => setIcon(ic.name)}
                    sx={{
                      p: 1.2,
                      borderRadius: 2,
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: icon === ic.name ? THEME_COLOR : 'divider',
                      bgcolor: icon === ic.name ? `${THEME_COLOR}14` : 'transparent',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: THEME_COLOR, bgcolor: `${THEME_COLOR}10` },
                    }}
                  >
                    <Icon sx={{ color: icon === ic.name ? THEME_COLOR : 'text.secondary', fontSize: 24 }}>
                      {ic.name}
                    </Icon>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          sx={{ bgcolor: THEME_COLOR, '&:hover': { bgcolor: '#0D47A1' } }}
        >
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : (initial ? 'Save Changes' : 'Add Rule')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function FamilyRulesPage() {
  const [rules, setRules] = useState<FamilyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FamilyRule | undefined>();
  const [saving, setSaving] = useState(false);

  const userId = useAuthStore(s => s.user?.id);

  const fetchRules = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch customer record to get customerId
      const custRes = await api.get('/profiles/customers/me').catch(() => null);
      const customerId = custRes?.data?.data?.id ?? custRes?.data?.id;
      if (!customerId) { setLoading(false); return; }

      const res = await api.get(`/profiles/family-rules?customerId=${customerId}&includeInactive=true`);
      const data = res.data?.data ?? res.data;
      setRules(Array.isArray(data) ? data : []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, [userId]);

  const handleAdd = async (title: string, description: string, icon: string) => {
    if (!userId) return;
    setSaving(true);
    try {
      await api.post('/profiles/family-rules', { title, description, icon });
      setDialogOpen(false);
      await fetchRules();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (title: string, description: string, icon: string) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await api.put(`/profiles/family-rules/${editTarget.id}`, { title, description, icon });
      setDialogOpen(false);
      setEditTarget(undefined);
      await fetchRules();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: FamilyRule) => {
    await api.put(`/profiles/family-rules/${rule.id}`, { active: !rule.active });
    await fetchRules();
  };

  const handleDelete = async (ruleId: string) => {
    await api.delete(`/profiles/family-rules/${ruleId}`);
    await fetchRules();
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newRules = [...rules];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newRules.length) return;
    [newRules[index], newRules[swapIdx]] = [newRules[swapIdx], newRules[index]];
    setRules(newRules);

    const customerId = newRules[0]?.customerId;
    if (!customerId) return;
    await api.post('/profiles/family-rules/reorder', {
      customerId,
      orderedIds: newRules.map(r => r.id),
    });
  };

  const openAdd = () => { setEditTarget(undefined); setDialogOpen(true); };
  const openEdit = (rule: FamilyRule) => { setEditTarget(rule); setDialogOpen(true); };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<GavelIcon />}
        title="Family Rules"
        subtitle="House rules displayed to your children in the Shield app"
        iconColor={THEME_COLOR}
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openAdd}
            sx={{ bgcolor: THEME_COLOR, '&:hover': { bgcolor: '#0D47A1' }, borderRadius: 2 }}
          >
            Add Rule
          </Button>
        }
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: THEME_COLOR }} />
        </Box>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<GavelIcon sx={{ fontSize: 40, color: THEME_COLOR }} />}
          title="No family rules yet"
          description="Add house rules like 'No phones during dinner' to guide your children's behaviour"
          action={
            (<Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}
              sx={{ bgcolor: THEME_COLOR, '&:hover': { bgcolor: '#0D47A1' } }}>
              Add First Rule
            </Button>) as React.ReactNode
          }
        />
      ) : (
        <Grid container spacing={2}>
          {rules.map((rule, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={rule.id}>
              <Card sx={{
                opacity: rule.active ? 1 : 0.6,
                transition: 'all 0.2s',
                border: '1px solid',
                borderColor: rule.active ? `${THEME_COLOR}30` : 'divider',
                '&:hover': { boxShadow: rule.active ? 4 : 1 },
              }}>
                <CardContent sx={{ pb: '12px !important' }}>
                  {/* Header row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Box sx={{
                      p: 0.75, borderRadius: 1.5,
                      bgcolor: rule.active ? `${THEME_COLOR}14` : '#F0F0F0',
                    }}>
                      <Icon sx={{ color: rule.active ? THEME_COLOR : '#999', fontSize: 22, display: 'block' }}>
                        {rule.icon || 'rule'}
                      </Icon>
                    </Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }} noWrap>
                      {rule.title}
                    </Typography>
                    {!rule.active && (
                      <Chip label="Inactive" size="small" sx={{ fontSize: 10, height: 18 }} />
                    )}
                  </Box>

                  {rule.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: 13 }}>
                      {rule.description}
                    </Typography>
                  )}

                  {/* Actions row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={rule.active}
                          onChange={() => handleToggleActive(rule)}
                          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: THEME_COLOR },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: THEME_COLOR } }}
                        />
                      }
                      label={<Typography variant="caption">{rule.active ? 'Active' : 'Inactive'}</Typography>}
                      sx={{ mr: 0 }}
                    />
                    <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <Tooltip title="Move up">
                        <span>
                          <IconButton size="small" onClick={() => handleMove(index, 'up')} disabled={index === 0}>
                            <KeyboardArrowUpIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move down">
                        <span>
                          <IconButton size="small" onClick={() => handleMove(index, 'down')} disabled={index === rules.length - 1}>
                            <KeyboardArrowDownIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(rule)}>
                          <EditIcon fontSize="small" sx={{ color: THEME_COLOR }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(rule.id)}>
                          <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <RuleDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditTarget(undefined); }}
        onSave={editTarget ? handleEdit : handleAdd}
        initial={editTarget}
        saving={saving}
      />
    </AnimatedPage>
  );
}
