import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, TextField, InputAdornment,
  CircularProgress, Avatar, Grid, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem,
  Snackbar, Alert, IconButton, Tooltip, Stack,
} from '@mui/material';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import SearchIcon from '@mui/icons-material/Search';
import ShieldIcon from '@mui/icons-material/Shield';
import DnsIcon from '@mui/icons-material/Dns';
import ScheduleIcon from '@mui/icons-material/Schedule';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

interface ChildProfile {
  id: string; customerId: string; name: string;
  avatarUrl?: string; dateOfBirth?: string; ageGroup: string;
  filterLevel: string; dnsClientId: string; dohUrl: string;
  notes?: string; createdAt: string; updatedAt: string;
}

const filterColors: Record<string, { bg: string; text: string }> = {
  STRICT: { bg: '#FFEBEE', text: '#C62828' },
  MODERATE: { bg: '#FFF8E1', text: '#F57F17' },
  RELAXED: { bg: '#E8F5E9', text: '#2E7D32' },
  CUSTOM: { bg: '#E3F2FD', text: '#1565C0' },
};
const ageGroupColors: Record<string, { bg: string; text: string }> = {
  TODDLER: { bg: '#FCE4EC', text: '#AD1457' },
  CHILD: { bg: '#E3F2FD', text: '#1565C0' },
  TEEN: { bg: '#F3E5F5', text: '#7B1FA2' },
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function CustomerChildProfilesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [snack, setSnack] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');
  const [editOpen, setEditOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<ChildProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editAgeGroup, setEditAgeGroup] = useState('');
  const [editFilterLevel, setEditFilterLevel] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteProfile, setDeleteProfile] = useState<ChildProfile | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-child-profiles'],
    queryFn: () => api.get('/profiles/children').then(r => (r.data?.data || r.data) as ChildProfile[])
      .catch(() => []),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.put(`/profiles/children/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customer-child-profiles'] }); setSnackSeverity('success'); setSnack('Profile updated'); setEditOpen(false); },
    onError: (e: any) => { setSnackSeverity('error'); setSnack(e?.response?.data?.message || 'Failed to update profile'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/profiles/children/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customer-child-profiles'] }); setSnackSeverity('success'); setSnack('Profile deleted'); setDeleteOpen(false); },
    onError: (e: any) => { setSnackSeverity('error'); setSnack(e?.response?.data?.message || 'Failed to delete profile'); },
  });

  const profiles = (data || []).filter(p =>
    !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  function openEdit(p: ChildProfile, e: React.MouseEvent) {
    e.stopPropagation();
    setEditProfile(p); setEditName(p.name); setEditAgeGroup(p.ageGroup);
    setEditFilterLevel(p.filterLevel); setEditNotes(p.notes || ''); setEditOpen(true);
  }

  function openDelete(p: ChildProfile, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteProfile(p); setDeleteOpen(true);
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ChildCareIcon />}
        title="Child Profiles"
        subtitle={`${profiles.length} profile${profiles.length !== 1 ? 's' : ''}`}
        iconColor="#1565C0"
        action={
          <Stack direction="row" spacing={2}>
            <TextField size="small" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ minWidth: 200 }} />
            <Button variant="contained" size="small" startIcon={<AddIcon />}
              onClick={() => navigate('/profiles/new')}
              sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)' }}>
              Add Profile
            </Button>
          </Stack>
        }
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <ChildCareIcon sx={{ fontSize: 48, color: '#BDBDBD', mb: 1 }} />
            <Typography color="text.secondary" sx={{ mb: 2 }}>No child profiles yet</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/profiles/new')}
              sx={{ background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)' }}>
              Create First Profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2.5}>
          {profiles.map((profile, i) => {
            const fc = filterColors[profile.filterLevel] || filterColors.MODERATE;
            const ac = ageGroupColors[profile.ageGroup] || ageGroupColors.CHILD;
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={profile.id}>
                <AnimatedPage delay={i * 0.04}>
                  <Card sx={{
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' },
                  }} onClick={() => navigate(`/profiles/${profile.id}`)}>
                    <Box sx={{ height: 4, background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)' }} />
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Avatar sx={{ width: 48, height: 48, background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)', fontWeight: 700, fontSize: 16 }}>
                          {getInitials(profile.name)}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" fontWeight={700}>{profile.name}</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            <Chip size="small" label={profile.ageGroup} sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: ac.bg, color: ac.text }} />
                            <Chip size="small" label={profile.filterLevel} sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: fc.bg, color: fc.text }} />
                          </Box>
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Edit"><IconButton size="small" onClick={(e) => openEdit(profile, e)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={(e) => openDelete(profile, e)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        </Stack>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <DnsIcon sx={{ fontSize: 14, color: '#78909C' }} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{profile.dnsClientId}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ScheduleIcon sx={{ fontSize: 14, color: '#78909C' }} />
                          <Typography variant="caption" color="text.secondary">Created {new Date(profile.createdAt).toLocaleDateString()}</Typography>
                        </Box>
                      </Box>
                      <Button fullWidth size="small" variant="outlined" startIcon={<ShieldIcon />}
                        sx={{ mt: 2, borderRadius: 2, borderColor: '#1565C020', color: '#1565C0', '&:hover': { borderColor: '#1565C0', bgcolor: '#1565C008' } }}
                        onClick={(e) => { e.stopPropagation(); navigate(`/profiles/${profile.id}`); }}>
                        Manage
                      </Button>
                    </CardContent>
                  </Card>
                </AnimatedPage>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Edit Child Profile</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={12}><TextField fullWidth label="Name" value={editName} onChange={e => setEditName(e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Age Group" value={editAgeGroup} onChange={e => setEditAgeGroup(e.target.value)}>
                <MenuItem value="TODDLER">Toddler</MenuItem>
                <MenuItem value="CHILD">Child</MenuItem>
                <MenuItem value="TEEN">Teen</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Filter Level" value={editFilterLevel} onChange={e => setEditFilterLevel(e.target.value)}>
                <MenuItem value="STRICT">Strict</MenuItem>
                <MenuItem value="MODERATE">Moderate</MenuItem>
                <MenuItem value="RELAXED">Relaxed</MenuItem>
                <MenuItem value="CUSTOM">Custom</MenuItem>
              </TextField>
            </Grid>
            <Grid size={12}><TextField fullWidth label="Notes" multiline rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={updateMutation.isPending}
            onClick={() => editProfile && updateMutation.mutate({ id: editProfile.id, body: { name: editName, ageGroup: editAgeGroup, filterLevel: editFilterLevel, notes: editNotes } })}
            sx={{ bgcolor: '#1565C0', minWidth: 120 }}>
            {updateMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle fontWeight={700}>Delete Child Profile</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{deleteProfile?.name}</strong>?</Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>This will remove all DNS rules, schedules, and budgets for this profile.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteProfile && deleteMutation.mutate(deleteProfile.id)}
            disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Delete Profile'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snackSeverity} onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
