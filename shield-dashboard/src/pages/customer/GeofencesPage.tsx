import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Button,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Slider, Stack, List, ListItem, ListItemIcon, ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FenceIcon from '@mui/icons-material/Fence';
import AddLocationIcon from '@mui/icons-material/AddLocation';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlaceIcon from '@mui/icons-material/Place';
import SchoolIcon from '@mui/icons-material/School';
import HomeIcon from '@mui/icons-material/Home';
import SportsIcon from '@mui/icons-material/Sports';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface ChildProfile { id: string; name: string; }

interface Geofence {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  type?: string;
  isActive?: boolean;
  alertOnEnter?: boolean;
  alertOnExit?: boolean;
}

interface GeofenceForm {
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  type: string;
}

const GEOFENCE_TYPES: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  HOME: { icon: <HomeIcon />, color: '#1565C0', bg: '#E3F2FD' },
  SCHOOL: { icon: <SchoolIcon />, color: '#7B1FA2', bg: '#F3E5F5' },
  SPORTS: { icon: <SportsIcon />, color: '#43A047', bg: '#E8F5E9' },
  OTHER: { icon: <PlaceIcon />, color: '#FB8C00', bg: '#FFF3E0' },
};

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 }; // Delhi

export default function GeofencesPage() {
  const qc = useQueryClient();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GeofenceForm>({ name: '', centerLat: DEFAULT_CENTER.lat, centerLng: DEFAULT_CENTER.lng, radiusMeters: 200, type: 'OTHER' });

  const { data: children } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => []),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const { data: geofences, isLoading } = useQuery({
    queryKey: ['geofences', profileId],
    queryFn: () => api.get(`/location/${profileId}/geofences`).then(r => r.data.data as Geofence[]),
    enabled: !!profileId,
  });

  const createMutation = useMutation({
    mutationFn: (data: GeofenceForm) => api.post(`/location/${profileId}/geofences`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['geofences', profileId] }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GeofenceForm }) =>
      api.put(`/location/${profileId}/geofences/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['geofences', profileId] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/location/${profileId}/geofences/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofences', profileId] }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ name: '', centerLat: DEFAULT_CENTER.lat, centerLng: DEFAULT_CENTER.lng, radiusMeters: 200, type: 'OTHER' });
  };

  const openEdit = (g: Geofence) => {
    setEditingId(g.id);
    setForm({ name: g.name, centerLat: g.centerLat, centerLng: g.centerLng, radiusMeters: g.radiusMeters, type: g.type || 'OTHER' });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const L = (window as any).L;
    if (!L) {
      // Load Leaflet dynamically
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      initMap();
    }
  }, []);

  function initMap() {
    const L = (window as any).L;
    if (!L || !mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    mapInstance.current = map;

    // Click to set geofence center in dialog
    map.on('click', (e: any) => {
      if (dialogOpen) {
        setForm(prev => ({ ...prev, centerLat: e.latlng.lat, centerLng: e.latlng.lng }));
      }
    });
  }

  // Update map circles when geofences change
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current) return;

    // Clear old circles
    circlesRef.current.forEach(c => c.remove());
    circlesRef.current = [];

    if (geofences && geofences.length > 0) {
      geofences.forEach(g => {
        const typeConf = GEOFENCE_TYPES[g.type || 'OTHER'] || GEOFENCE_TYPES.OTHER;
        const circle = L.circle([g.centerLat, g.centerLng], {
          radius: g.radiusMeters,
          color: typeConf.color,
          fillColor: typeConf.color,
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(mapInstance.current);
        circle.bindPopup(`<b>${g.name}</b><br/>Radius: ${g.radiusMeters}m`);
        circlesRef.current.push(circle);
      });

      // Fit bounds
      const bounds = geofences.map(g => [g.centerLat, g.centerLng] as [number, number]);
      if (bounds.length > 0) {
        mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [geofences]);

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<FenceIcon />} title="Geofences" subtitle="Set safe zones for your children" iconColor="#43A047" />
        <EmptyState title="No child profiles" description="Add a child profile first to create geofences" />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<FenceIcon />}
        title="Geofences"
        subtitle="Create and manage safe zones"
        iconColor="#43A047"
        action={
          <Stack direction="row" spacing={1}>
            {(children || []).map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? '#43A047' : '#E8F5E9',
                  color: (profileId === c.id) ? 'white' : '#43A047',
                  '&:hover': { bgcolor: (profileId === c.id) ? '#388E3C' : '#C8E6C9' },
                }}
              />
            ))}
            <Button
              variant="contained"
              startIcon={<AddLocationIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{ bgcolor: '#43A047', '&:hover': { bgcolor: '#388E3C' } }}
            >
              Add Zone
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={2.5}>
        {/* Map */}
        <Grid size={{ xs: 12, md: 8 }}>
          <AnimatedPage delay={0.1}>
            <Card sx={{ overflow: 'hidden' }}>
              <Box ref={mapRef} sx={{ height: 500, width: '100%' }} />
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Geofence List */}
        <Grid size={{ xs: 12, md: 4 }}>
          <AnimatedPage delay={0.2}>
            <Card sx={{ height: 500, overflow: 'auto' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                  Safe Zones ({(geofences || []).length})
                </Typography>
                {isLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>
                ) : !geofences || geofences.length === 0 ? (
                  <EmptyState title="No geofences" description="Click 'Add Zone' to create your first safe zone" />
                ) : (
                  <List disablePadding>
                    {geofences.map((g, i) => {
                      const typeConf = GEOFENCE_TYPES[g.type || 'OTHER'] || GEOFENCE_TYPES.OTHER;
                      return (
                        <ListItem
                          key={g.id}
                          sx={{
                            borderRadius: 2, mb: 1, bgcolor: '#FAFAFA',
                            border: '1px solid #F0F0F0',
                            transition: 'all 0.2s ease',
                            '&:hover': { bgcolor: '#F5F9FF', borderColor: '#E3F2FD' },
                            '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                            animation: `fadeInUp 0.3s ease ${0.1 + i * 0.05}s both`,
                          }}
                        >
                          <ListItemIcon>
                            <Box sx={{
                              width: 36, height: 36, borderRadius: '8px',
                              bgcolor: typeConf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: typeConf.color, '& .MuiSvgIcon-root': { fontSize: 18 },
                            }}>
                              {typeConf.icon}
                            </Box>
                          </ListItemIcon>
                          <ListItemText
                            primary={<Typography variant="body2" fontWeight={600}>{g.name}</Typography>}
                            secondary={`${g.radiusMeters}m radius`}
                          />
                          <ListItemSecondaryAction>
                            <IconButton size="small" onClick={() => openEdit(g)} sx={{ mr: 0.5 }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => deleteMutation.mutate(g.id)} sx={{ color: '#E53935' }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Geofence' : 'New Geofence'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Zone Name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              fullWidth
              size="small"
            />
            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Type</Typography>
              <Stack direction="row" spacing={1}>
                {Object.entries(GEOFENCE_TYPES).map(([key, conf]) => (
                  <Chip
                    key={key}
                    label={key}
                    icon={<Box sx={{ color: form.type === key ? 'white' : conf.color, '& .MuiSvgIcon-root': { fontSize: 16 } }}>{conf.icon}</Box>}
                    onClick={() => setForm({ ...form, type: key })}
                    sx={{
                      fontWeight: 600,
                      bgcolor: form.type === key ? conf.color : conf.bg,
                      color: form.type === key ? 'white' : conf.color,
                    }}
                  />
                ))}
              </Stack>
            </Box>
            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  label="Latitude"
                  type="number"
                  value={form.centerLat}
                  onChange={e => setForm({ ...form, centerLat: parseFloat(e.target.value) || 0 })}
                  fullWidth size="small"
                  slotProps={{ htmlInput: { step: 0.0001 } }}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Longitude"
                  type="number"
                  value={form.centerLng}
                  onChange={e => setForm({ ...form, centerLng: parseFloat(e.target.value) || 0 })}
                  fullWidth size="small"
                  slotProps={{ htmlInput: { step: 0.0001 } }}
                />
              </Grid>
            </Grid>
            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                Radius: {form.radiusMeters}m
              </Typography>
              <Slider
                value={form.radiusMeters}
                min={50}
                max={2000}
                step={50}
                onChange={(_, val) => setForm({ ...form, radiusMeters: val as number })}
                valueLabelDisplay="auto"
                valueLabelFormat={v => `${v}m`}
                sx={{ color: '#43A047' }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Tip: Click on the map to set the center point for the geofence.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!form.name || createMutation.isPending || updateMutation.isPending}
            sx={{ bgcolor: '#43A047', '&:hover': { bgcolor: '#388E3C' } }}
          >
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </AnimatedPage>
  );
}
