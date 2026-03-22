import { useCallback, useEffect, useRef } from 'react';
import { Box, Card, CardContent, CircularProgress, Chip, Typography, Stack } from '@mui/material';
import {
  APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MapIcon from '@mui/icons-material/Map';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useState } from 'react';
import LoadingPage from '../../components/LoadingPage';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDXazeaKnjxYsnwE-Vb-gfapzhr566mo2M';

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

// Component to render geofence circles using Maps JavaScript API
function GeofenceCircles({ geofences }: { geofences: Geofence[] }) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const circlesRef = useRef<google.maps.Circle[]>([]);

  useEffect(() => {
    if (!map || !mapsLib) return;
    // Clear old circles
    circlesRef.current.forEach(c => c.setMap(null));
    circlesRef.current = [];

    geofences.filter(gf => gf.isActive !== false).forEach(gf => {
      const circle = new mapsLib.Circle({
        map,
        center: { lat: gf.centerLat, lng: gf.centerLng },
        radius: gf.radiusMeters,
        strokeColor: '#1565C0',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#1565C0',
        fillOpacity: 0.12,
      });
      circlesRef.current.push(circle);
    });

    return () => {
      circlesRef.current.forEach(c => c.setMap(null));
      circlesRef.current = [];
    };
  }, [map, mapsLib, geofences]);

  return null;
}

function LocationMarkers({
  locations,
  geofences,
}: {
  locations: LiveLocation[];
  geofences: Geofence[];
}) {
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

  return (
    <>
      {locations.map((loc) => (
        <AdvancedMarker
          key={loc.profileId}
          position={{ lat: loc.latitude, lng: loc.longitude }}
          onClick={() => setOpenInfoId(openInfoId === loc.profileId ? null : loc.profileId)}
        />
      ))}
      {locations.map((loc) =>
        openInfoId === loc.profileId ? (
          <InfoWindow
            key={`info-${loc.profileId}`}
            position={{ lat: loc.latitude, lng: loc.longitude }}
            onCloseClick={() => setOpenInfoId(null)}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>{loc.profileName}</Typography>
              <Typography variant="caption" display="block">
                Last seen: {new Date(loc.recordedAt).toLocaleTimeString()}
              </Typography>
              {loc.batteryPct != null && loc.batteryPct > 0 && (
                <Typography variant="caption" display="block">
                  🔋 Battery: {loc.batteryPct}%
                </Typography>
              )}
              {loc.speed != null && loc.speed > 0 && (
                <Typography variant="caption" display="block">
                  🚗 Speed: {typeof loc.speed === 'number' ? loc.speed.toFixed(1) : loc.speed} km/h
                </Typography>
              )}
              {loc.isMoving !== undefined && (
                <Typography variant="caption" display="block">
                  {loc.isMoving ? 'Moving' : 'Stationary'}
                </Typography>
              )}
            </Box>
          </InfoWindow>
        ) : null
      )}
      <GeofenceCircles geofences={geofences} />
    </>
  );
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
    refetchInterval: 30000,
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

  const firstProfileId = profileIds[0] || '';
  const secondProfileId = profileIds[1] || '';
  const thirdProfileId = profileIds[2] || '';
  useWebSocket(`/topic/location/${firstProfileId}`, handleLocationUpdate, !!firstProfileId);
  useWebSocket(`/topic/location/${secondProfileId}`, handleLocationUpdate, !!secondProfileId);
  useWebSocket(`/topic/location/${thirdProfileId}`, handleLocationUpdate, !!thirdProfileId);

  const center = locations?.[0]
    ? { lat: locations[0].latitude, lng: locations[0].longitude }
    : { lat: 28.6139, lng: 77.209 };
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
              <LoadingPage />
            ) : (
              <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                <Map
                  defaultCenter={center}
                  defaultZoom={13}
                  mapId="shield-family-map"
                  style={{ height: '70vh', width: '100%', borderRadius: 12 }}
                >
                  <LocationMarkers
                    locations={locations || []}
                    geofences={geofences || []}
                  />
                </Map>
              </APIProvider>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>
    </AnimatedPage>
  );
}
