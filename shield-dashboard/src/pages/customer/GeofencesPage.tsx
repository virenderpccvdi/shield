import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Button,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Slider, Stack, List, ListItem, ListItemIcon, ListItemText,
  ListItemSecondaryAction, Alert, Snackbar
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary,
} from '@vis.gl/react-google-maps';
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

const GOOGLE_MAPS_API_KEY = 'AIzaSyDXazeaKnjxYsnwE-Vb-gfapzhr566mo2M';

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

// color is a real hex (used for Google Maps circle strokeColor/fillColor — must be hex, not MUI token)
// muiColor is the MUI sx-compatible token used for MUI components
const GEOFENCE_TYPES: Record<string, { icon: React.ReactNode; color: string; muiColor: string; bg: string }> = {
  HOME: { icon: <HomeIcon />, color: '#1565C0', muiColor: 'primary.main', bg: 'rgba(21,101,192,0.08)' },
  SCHOOL: { icon: <SchoolIcon />, color: '#7B1FA2', muiColor: '#7B1FA2', bg: '#F3E5F5' },
  SPORTS: { icon: <SportsIcon />, color: '#43A047', muiColor: 'success.main', bg: 'rgba(67,160,71,0.08)' },
  OTHER: { icon: <PlaceIcon />, color: '#FB8C00', muiColor: 'warning.main', bg: 'rgba(251,140,0,0.08)' },
};

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 }; // Delhi

// Renders geofence circles on the map
function GeofenceOverlay({
  geofences,
  onMapClick,
  dialogOpen,
}: {
  geofences: Geofence[];
  onMapClick: (lat: number, lng: number) => void;
  dialogOpen: boolean;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

  // Handle map click to set geofence center when dialog is open
  useEffect(() => {
    if (!map || !dialogOpen) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onMapClick(e.latLng.lat(), e.latLng.lng());
      }
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, dialogOpen, onMapClick]);

  useEffect(() => {
    if (!map || !mapsLib) return;

    circlesRef.current.forEach(c => c.setMap(null));
    circlesRef.current = [];

    geofences.forEach(g => {
      const typeConf = GEOFENCE_TYPES[g.type || 'OTHER'] || GEOFENCE_TYPES.OTHER;
      const circle = new mapsLib.Circle({
        map,
        center: { lat: g.centerLat, lng: g.centerLng },
        radius: g.radiusMeters,
        strokeColor: typeConf.color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: typeConf.color,
        fillOpacity: 0.15,
      });
      circlesRef.current.push(circle);
    });

    // Fit bounds
    if (geofences.length > 0 && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      geofences.forEach(g => bounds.extend({ lat: g.centerLat, lng: g.centerLng }));
      map.fitBounds(bounds, 80);
    }

    return () => {
      circlesRef.current.forEach(c => c.setMap(null));
      circlesRef.current = [];
    };
  }, [map, mapsLib, geofences]);

  return (
    <>
      {geofences.map((g) => (
        <AdvancedMarker
          key={g.id}
          position={{ lat: g.centerLat, lng: g.centerLng }}
          onClick={() => setOpenInfoId(openInfoId === g.id ? null : g.id)}
        />
      ))}
      {geofences.map((g) =>
        openInfoId === g.id ? (
          <InfoWindow
            key={`info-${g.id}`}
            position={{ lat: g.centerLat, lng: g.centerLng }}
            onCloseClick={() => setOpenInfoId(null)}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>{g.name}</Typography>
              <Typography variant="caption">Radius: {g.radiusMeters}m</Typography>
            </Box>
          </InfoWindow>
        ) : null
      )}
    </>
  );
}

export default function GeofencesPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [form, setForm] = useState<GeofenceForm>({
    name: '', centerLat: DEFAULT_CENTER.lat, centerLng: DEFAULT_CENTER.lng, radiusMeters: 200, type: 'OTHER',
  });

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
    queryFn: () => api.get(`/location/${profileId}/geofences`).then(r => {
      const raw = r.data?.data ?? r.data;
      return (Array.isArray(raw) ? raw : raw?.content ?? []) as Geofence[];
    }),
    enabled: !!profileId,
  });

  const createMutation = useMutation({
    mutationFn: (data: GeofenceForm) => api.post(`/location/${profileId}/geofences`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['geofences', profileId] }); closeDialog(); },
    onError: (e: any) => setMutationError(e?.response?.data?.message ?? 'Failed to create geofence'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GeofenceForm }) =>
      api.put(`/location/${profileId}/geofences/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['geofences', profileId] }); closeDialog(); },
    onError: (e: any) => setMutationError(e?.response?.data?.message ?? 'Failed to update geofence'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/location/${profileId}/geofences/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofences', profileId] }),
    onError: (e: any) => setMutationError(e?.response?.data?.message ?? 'Failed to delete geofence'),
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

  const handleMapClick = (lat: number, lng: number) => {
    setForm(prev => ({ ...prev, centerLat: lat, centerLng: lng }));
  };

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<FenceIcon />} title="Geofences" subtitle="Set safe zones for your children" iconColor="success.main" />
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
        iconColor="success.main"
        action={
          <Stack direction="row" spacing={1}>
            {(children || []).map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? 'success.main' : 'rgba(67,160,71,0.08)',
                  color: (profileId === c.id) ? 'white' : 'success.main',
                  '&:hover': { bgcolor: (profileId === c.id) ? 'success.dark' : 'rgba(67,160,71,0.16)' },
                }}
              />
            ))}
            <Button
              variant="contained"
              startIcon={<AddLocationIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
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
              <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                <Map
                  defaultCenter={DEFAULT_CENTER}
                  defaultZoom={13}
                  mapId="shield-geofences-map"
                  style={{ height: 500, width: '100%' }}
                >
                  <GeofenceOverlay
                    geofences={geofences || []}
                    onMapClick={handleMapClick}
                    dialogOpen={dialogOpen}
                  />
                </Map>
              </APIProvider>
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
                            borderRadius: 2, mb: 1, bgcolor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            transition: 'all 0.2s ease',
                            '&:hover': { bgcolor: 'background.default', borderColor: 'rgba(21,101,192,0.20)' },
                            '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                            animation: `fadeInUp 0.3s ease ${0.1 + i * 0.05}s both`,
                          }}
                        >
                          <ListItemIcon>
                            <Box sx={{
                              width: 36, height: 36, borderRadius: '8px',
                              bgcolor: typeConf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: typeConf.muiColor, '& .MuiSvgIcon-root': { fontSize: 18 },
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
                            <IconButton size="small" onClick={() => deleteMutation.mutate(g.id)} sx={{ color: 'error.main' }}>
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
                    icon={<Box sx={{ color: form.type === key ? 'white' : conf.muiColor, '& .MuiSvgIcon-root': { fontSize: 16 } }}>{conf.icon}</Box>}
                    onClick={() => setForm({ ...form, type: key })}
                    sx={{
                      fontWeight: 600,
                      bgcolor: form.type === key ? conf.muiColor : conf.bg,
                      color: form.type === key ? 'white' : conf.muiColor,
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
                sx={{ color: 'success.main' }}
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
            sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
          >
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!mutationError}
        autoHideDuration={4000}
        onClose={() => setMutationError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setMutationError(null)} sx={{ borderRadius: 2 }}>
          {mutationError}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
