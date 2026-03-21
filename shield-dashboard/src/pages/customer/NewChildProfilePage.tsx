import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, TextField, Stack,
  FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert,
  Chip, Grid,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import ShieldIcon from '@mui/icons-material/Shield';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

const FILTER_OPTIONS = [
  { value: 'STRICT',   label: 'Strict',   desc: 'Maximum protection — suitable for young children (2–8)',  color: '#C62828', bg: '#FFEBEE' },
  { value: 'MODERATE', label: 'Moderate', desc: 'Balanced protection — suitable for children (8–13)',       color: '#F57F17', bg: '#FFF8E1' },
  { value: 'RELAXED',  label: 'Relaxed',  desc: 'Light filtering — suitable for older teens (13+)',         color: '#2E7D32', bg: '#E8F5E9' },
];

const AGE_GROUP_FROM_AGE = (age: number) => {
  if (age <= 5)  return 'TODDLER';
  if (age <= 10) return 'CHILD';
  if (age <= 13) return 'PRETEEN';
  return 'TEEN';
};

export default function NewChildProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName]           = useState('');
  const [age, setAge]             = useState('');
  const [filterLevel, setFilter]  = useState('MODERATE');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Child name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const ageNum = parseInt(age) || 10;
      const res = await api.post('/profiles/children', {
        name: name.trim(),
        filterLevel,
        ageGroup: AGE_GROUP_FROM_AGE(ageNum),
      });
      const profileId = res.data?.data?.id ?? res.data?.id;
      qc.invalidateQueries({ queryKey: ['children'] });
      qc.invalidateQueries({ queryKey: ['customer-child-profiles'] });
      navigate(profileId ? `/profiles/${profileId}` : '/dashboard');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to create profile. Please try again.');
      setSaving(false);
    }
  };

  const selectedFilter = FILTER_OPTIONS.find(f => f.value === filterLevel)!;

  return (
    <AnimatedPage>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')}
        sx={{ mb: 2, color: 'text.secondary' }}>
        Back to Dashboard
      </Button>

      <PageHeader
        icon={<ChildCareIcon />}
        title="Add Child Profile"
        subtitle="Create a protected profile for your child"
        iconColor="#1565C0"
      />

      <Grid container spacing={3} justifyContent="center">
        <Grid size={{ xs: 12, sm: 8, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <Stack spacing={3}>
                <TextField
                  fullWidth label="Child's Name *"
                  value={name} onChange={e => setName(e.target.value)}
                  autoFocus placeholder="e.g. Jake, Emma"
                />
                <TextField
                  fullWidth label="Age" type="number"
                  value={age} onChange={e => setAge(e.target.value)}
                  inputProps={{ min: 2, max: 18 }}
                  helperText="Used to set appropriate defaults"
                />

                {/* Filter level picker */}
                <Box>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5 }}>
                    Content Filter Level *
                  </Typography>
                  <Grid container spacing={1.5}>
                    {FILTER_OPTIONS.map(f => (
                      <Grid key={f.value} size={{ xs: 12, sm: 4 }}>
                        <Box
                          onClick={() => setFilter(f.value)}
                          sx={{
                            p: 1.5, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                            border: `2px solid ${filterLevel === f.value ? f.color : '#E2E8F0'}`,
                            bgcolor: filterLevel === f.value ? f.bg : 'transparent',
                            transition: 'all 0.2s ease',
                            '&:hover': { borderColor: f.color, bgcolor: f.bg },
                          }}
                        >
                          <Chip size="small" label={f.label}
                            sx={{ bgcolor: f.bg, color: f.color, fontWeight: 700, mb: 0.5, width: '100%' }} />
                          <Typography variant="caption" color="text.secondary" fontSize={10} display="block">
                            {f.desc}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                {/* What's included info */}
                <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <ShieldIcon sx={{ fontSize: 16, color: selectedFilter.color }} />
                    <Typography variant="body2" fontWeight={700} color={selectedFilter.color}>
                      {selectedFilter.label} filter includes:
                    </Typography>
                  </Stack>
                  <Stack spacing={0.5}>
                    {['Malware & Phishing protection (always on)', 'Adult content filtering',
                      filterLevel === 'RELAXED' ? 'Basic safety controls' : 'Gaming & social limits',
                      filterLevel === 'STRICT' ? 'YouTube Restricted Mode' : 'Custom allow/block lists',
                    ].map(item => (
                      <Typography key={item} variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box component="span" sx={{ color: selectedFilter.color }}>✓</Box> {item}
                      </Typography>
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
                    You can adjust all settings after creating the profile.
                  </Typography>
                </Box>

                <Button variant="contained" size="large" onClick={handleSave} disabled={saving || !name.trim()}
                  sx={{ background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)', py: 1.5, borderRadius: 2 }}>
                  {saving ? <CircularProgress size={20} color="inherit" /> : 'Create Child Profile'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </AnimatedPage>
  );
}
