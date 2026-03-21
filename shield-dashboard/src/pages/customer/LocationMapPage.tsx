import { useCallback, useEffect, useRef } from 'react';
import { Box, Card, CardContent, CircularProgress, Chip, Typography, Stack } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MapIcon from '@mui/icons-material/Map';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import L from 'leaflet';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import { useWebSocket } from '../../hooks/useWebSocket';

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface ChildProfile { id: string; name: string; }
interface LiveLocation {
  profileId: string; profileName: string;
  latitude: number; longitude: number;
  recordedAt: string; batteryPct?: number; speed?: number; isMoving?: boolean;
}
interface Geofence {
  id: string; name: string;
  centerLat: number; centerLng: number;
  radiusMeters: number; isActive?: boolean;
}

// Moves the map when center changes
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  const prevCenter = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!prevCenter.current ||
        Math.abs(prevCenter.current[0] - center[0]) > 0.001 ||
        Math.abs(prevCenter.current[1] - center[1]) > 0.001) {
      map.setView(center, map.getZoom());
      prevCenter.current = center;
    }
  }, [center, map]);
  return null;
}

export default function LocationMapPage() {
  const { profileId } = useParams();
  const qc = useQueryClient();

  const { data: children } = useQuery({
    queryKey: ['children-for-map'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => [] as ChildProfile[]),
    enabled: !profileId,
  });

  const profileIds = profileId ? [profileId] : (children?.map(c => c.id) || []);

  const liveQueryKey = ['live-locations', profileIds.join(',')];

  const { data: locations, isLoading } = useQuery({
    queryKey: liveQueryKey,
    queryFn: async () => {
      const results = await Promise.all(
        profileIds.map(pid =>
          api.get(`/location/${pid}/latest`).then(r => {
            const loc = r.data?.data;
            if (!loc) return null;
            const child = children?.find(c => c.id === pid);
            return {
              ...loc,
              profileId: pid,
              profileName: child?.name || loc.profileName || 'Unknown',
            } as LiveLocation;
          }).catch(() => null)
        )
      );
      return results.filter(Boolean) as LiveLocation[];
    },
    enabled: profileIds.length > 0,
    refetchInterval: 30000, // fallback polling
  });

  const { data: geofences } = useQuery({
    queryKey: ['geofences-map', profileIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        profileIds.map(pid =>
          api.get(`/location/${pid}/geofences`)
            .then(r => (r.data?.data || []) as Geofence[])
            .catch(() => [] as Geofence[])
        )
      );
      return results.flat();
    },
    enabled: profileIds.length > 0,
  });

  // Real-time WebSocket update per profile
  const handleLocationUpdate = useCallback((data: unknown) => {
    const update = data as LiveLocation & { profileId: string };
    if (!update?.profileId || !update?.latitude) return;
    qc.setQueryData<LiveLocation[]>(liveQueryKey, (prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex(l => l.profileId === update.profileId);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...update };
      return next;
    });
  }, [liveQueryKey.join(',')]);

  // Subscribe to each profile's location topic
  const firstProfileId = profileIds[0] || '';
  const secondProfileId = profileIds[1] || '';
  const thirdProfileId = profileIds[2] || '';
  useWebSocket(`/topic/location/${firstProfileId}`, handleLocationUpdate, !!firstProfileId);
  useWebSocket(`/topic/location/${secondProfileId}`, handleLocationUpdate, !!secondProfileId);
  useWebSocket(`/topic/location/${thirdProfileId}`, handleLocationUpdate, !!thirdProfileId);

  const center: [number, number] = locations?.[0]
    ? [locations[0].latitude, locations[0].longitude]
    : [28.6139, 77.209];
  const locationCount = locations?.length || 0;
  const fenceCount = geofences?.filter(g => g.isActive !== false).length || 0;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<MapIcon />}
        title="Family Map"
        subtitle="Real-time location tracking"
        iconColor="#00897B"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', color: '#43A047 !important' }} />}
              label="Live"
              size="small"
              sx={{ fontWeight: 600, bgcolor: '#E8F5E9', color: '#2E7D32' }}
            />
            <Chip label={`${locationCount} device${locationCount !== 1 ? 's' : ''}`}
              sx={{ bgcolor: '#E0F2F1', color: '#00695C', fontWeight: 600, fontSize: 12 }} />
            <Chip label={`${fenceCount} geofence${fenceCount !== 1 ? 's' : ''}`}
              sx={{ bgcolor: '#E3F2FD', color: '#1565C0', fontWeight: 600, fontSize: 12 }} />
          </Stack>
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
                <MapRecenter center={center} />
                {(locations || []).map((loc) => (
                  <Marker key={loc.profileId} position={[loc.latitude, loc.longitude]}>
                    <Popup>
                      <Typography variant="subtitle2" fontWeight={700}>{loc.profileName}</Typography>
                      <Typography variant="caption" display="block">
                        Last seen: {new Date(loc.recordedAt).toLocaleTimeString()}
                      </Typography>
                      {loc.batteryPct !== undefined && (
                        <Typography variant="caption" display="block">
                          Battery: {loc.batteryPct}%
                        </Typography>
                      )}
                      {loc.speed !== undefined && (
                        <Typography variant="caption" display="block">
                          Speed: {typeof loc.speed === 'number' ? loc.speed.toFixed(1) : loc.speed} km/h
                        </Typography>
                      )}
                      {loc.isMoving !== undefined && (
                        <Typography variant="caption" display="block">
                          {loc.isMoving ? '🚶 Moving' : '📍 Stationary'}
                        </Typography>
                      )}
                    </Popup>
                  </Marker>
                ))}
                {(geofences || []).filter(gf => gf.isActive !== false).map((gf) => (
                  <Circle
                    key={gf.id}
                    center={[gf.centerLat, gf.centerLng]}
                    radius={gf.radiusMeters}
                    color="#1565C0"
                    fillOpacity={0.12}
                  >
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
