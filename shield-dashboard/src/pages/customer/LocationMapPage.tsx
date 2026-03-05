import { Box, Card, CardContent, CircularProgress, Chip } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import MapIcon from '@mui/icons-material/Map';
import L from 'leaflet';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface ChildProfile { id: string; name: string; }
interface LiveLocation { profileId: string; profileName: string; latitude: number; longitude: number; recordedAt: string; batteryLevel?: number; }
interface Geofence { id: string; name: string; latitude: number; longitude: number; radiusMeters: number; }

export default function LocationMapPage() {
  const { profileId } = useParams();

  // If we have a specific profileId from route, use it; otherwise fetch all children
  const { data: children } = useQuery({
    queryKey: ['children-for-map'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => [] as ChildProfile[]),
    enabled: !profileId,
  });

  const profileIds = profileId ? [profileId] : (children?.map(c => c.id) || []);

  const { data: locations, isLoading } = useQuery({
    queryKey: ['live-locations', profileIds],
    queryFn: async () => {
      const results = await Promise.all(
        profileIds.map(pid =>
          api.get(`/location/${pid}/latest`).then(r => {
            const loc = r.data?.data;
            if (!loc) return null;
            const child = children?.find(c => c.id === pid);
            return { ...loc, profileId: pid, profileName: child?.name || loc.profileName || 'Unknown' } as LiveLocation;
          }).catch(() => null)
        )
      );
      return results.filter(Boolean) as LiveLocation[];
    },
    enabled: profileIds.length > 0,
    refetchInterval: 30000,
  });

  const { data: geofences } = useQuery({
    queryKey: ['geofences', profileIds],
    queryFn: async () => {
      const results = await Promise.all(
        profileIds.map(pid =>
          api.get(`/location/${pid}/geofences`).then(r => (r.data?.data || []) as Geofence[]).catch(() => [] as Geofence[])
        )
      );
      return results.flat();
    },
    enabled: profileIds.length > 0,
  });

  const center: [number, number] = locations?.[0] ? [locations[0].latitude, locations[0].longitude] : [51.505, -0.09];
  const locationCount = locations?.length || 0;
  const fenceCount = geofences?.length || 0;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<MapIcon />}
        title="Family Map"
        subtitle="Real-time location tracking"
        iconColor="#00897B"
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip label={`${locationCount} device${locationCount !== 1 ? 's' : ''}`}
              sx={{ bgcolor: '#E0F2F1', color: '#00695C', fontWeight: 600, fontSize: 12 }} />
            <Chip label={`${fenceCount} geofence${fenceCount !== 1 ? 's' : ''}`}
              sx={{ bgcolor: '#E3F2FD', color: '#1565C0', fontWeight: 600, fontSize: 12 }} />
          </Box>
        }
      />

      <AnimatedPage delay={0.15}>
        <Card sx={{ overflow: 'hidden' }}>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {isLoading ? (
              <Box sx={{ height: '65vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              <MapContainer center={center} zoom={13} style={{ height: '70vh', width: '100%', borderRadius: 12 }}>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {(locations || []).map((loc) => (
                  <Marker key={loc.profileId} position={[loc.latitude, loc.longitude]}>
                    <Popup>
                      <strong>{loc.profileName}</strong><br />
                      Last seen: {new Date(loc.recordedAt).toLocaleTimeString()}<br />
                      {loc.batteryLevel !== undefined && `Battery: ${loc.batteryLevel}%`}
                    </Popup>
                  </Marker>
                ))}
                {(geofences || []).map((gf) => (
                  <Circle key={gf.id} center={[gf.latitude, gf.longitude]} radius={gf.radiusMeters} color="#1565C0" fillOpacity={0.12}>
                    <Popup>{gf.name}</Popup>
                  </Circle>
                ))}
              </MapContainer>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>
    </AnimatedPage>
  );
}
