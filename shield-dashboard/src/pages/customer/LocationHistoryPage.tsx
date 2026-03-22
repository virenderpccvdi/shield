import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Chip, Stack, List, ListItem, ListItemIcon, ListItemText, Button, Tooltip
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary,
} from '@vis.gl/react-google-maps';
import HistoryIcon from '@mui/icons-material/History';
import PlaceIcon from '@mui/icons-material/Place';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { useWebSocket } from '../../hooks/useWebSocket';
import LoadingPage from '../../components/LoadingPage';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDXazeaKnjxYsnwE-Vb-gfapzhr566mo2M';

interface ChildProfile { id: string; name: string; }

interface LocationPoint {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  batteryPct?: number;
  recordedAt: string;
  address?: string;
}

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };

// Renders the route polyline + start/end markers inside a Map component
function RouteOverlay({ points }: { points: LocationPoint[] }) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [openMarker, setOpenMarker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (!map || !mapsLib || points.length === 0) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      return;
    }

    // Remove old polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const path = points.map(p => ({ lat: p.latitude, lng: p.longitude }));

    polylineRef.current = new mapsLib.Polyline({
      path,
      geodesic: true,
      strokeColor: '#1565C0',
      strokeOpacity: 0.8,
      strokeWeight: 3,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 },
        offset: '0',
        repeat: '20px',
      }],
      map,
    });

    // Fit bounds
    if (window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      path.forEach(p => bounds.extend(p));
      map.fitBounds(bounds, 60);
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, mapsLib, points]);

  if (points.length === 0) return null;

  const startPt = points[0];
  const endPt = points[points.length - 1];

  return (
    <>
      {/* Start marker */}
      <AdvancedMarker
        position={{ lat: startPt.latitude, lng: startPt.longitude }}
        onClick={() => setOpenMarker(openMarker === 'start' ? null : 'start')}
      >
        <div style={{
          background: '#43A047', color: 'white', borderRadius: '50%',
          width: 28, height: 28, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 12, fontWeight: 700,
          border: '3px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        }}>S</div>
      </AdvancedMarker>
      {openMarker === 'start' && (
        <InfoWindow
          position={{ lat: startPt.latitude, lng: startPt.longitude }}
          onCloseClick={() => setOpenMarker(null)}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>Start</Typography>
            <Typography variant="caption">{formatTime(startPt.recordedAt)}</Typography>
          </Box>
        </InfoWindow>
      )}

      {/* End marker (only if more than 1 point) */}
      {points.length > 1 && (
        <>
          <AdvancedMarker
            position={{ lat: endPt.latitude, lng: endPt.longitude }}
            onClick={() => setOpenMarker(openMarker === 'end' ? null : 'end')}
          >
            <div style={{
              background: '#E53935', color: 'white', borderRadius: '50%',
              width: 28, height: 28, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 12, fontWeight: 700,
              border: '3px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}>E</div>
          </AdvancedMarker>
          {openMarker === 'end' && (
            <InfoWindow
              position={{ lat: endPt.latitude, lng: endPt.longitude }}
              onCloseClick={() => setOpenMarker(null)}
            >
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>End</Typography>
                <Typography variant="caption">{formatTime(endPt.recordedAt)}</Typography>
              </Box>
            </InfoWindow>
          )}
        </>
      )}
    </>
  );
}

function formatTime(iso: string) {
  return dayjs(iso).format('h:mm A');
}

export default function LocationHistoryPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<Dayjs>(dayjs().startOf('day'));
  const [toDate, setToDate] = useState<Dayjs>(dayjs().endOf('day'));

  const { data: children } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => []),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const isToday = fromDate.isSame(dayjs(), 'day') && toDate.isSame(dayjs(), 'day');
  const fromISO = useMemo(() => fromDate.toISOString(), [fromDate]);
  const toISO = useMemo(() => toDate.toISOString(), [toDate]);
  const historyQueryKey = ['location-history', profileId, fromISO, toISO];

  const { data: locationData, isLoading } = useQuery({
    queryKey: historyQueryKey,
    queryFn: () => api.get(`/location/${profileId}/history`, {
      params: {
        from: fromISO,
        to: toISO,
        size: 500,
      },
    }).then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as LocationPoint[];
    }),
    enabled: !!profileId,
    refetchInterval: isToday ? 30000 : false,
  });

  const handleLiveLocation = useCallback((data: unknown) => {
    const pt = data as LocationPoint;
    if (!pt?.latitude || !pt?.longitude) return;
    qc.setQueryData<LocationPoint[]>(historyQueryKey, (prev) => {
      if (!prev) return [pt];
      if (prev.some(p => p.id === pt.id)) return prev;
      return [...prev, pt];
    });
  }, [profileId, fromISO, toISO]);

  useWebSocket(`/topic/location/${profileId}`, handleLiveLocation, !!profileId && isToday);

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<HistoryIcon />} title="Location History" subtitle="Track movement history" iconColor="#1565C0" />
        <EmptyState title="No child profiles" description="Add a child profile first to view location history" />
      </AnimatedPage>
    );
  }

  const points = locationData || [];

  const exportCsv = () => {
    if (points.length === 0) return;
    const childName = (children || []).find(c => c.id === profileId)?.name ?? 'child';
    const header = 'Date,Time,Latitude,Longitude,Speed (km/h),Battery (%),Address';
    const rows = points.map(p => {
      const d = dayjs(p.recordedAt);
      return [
        d.format('YYYY-MM-DD'),
        d.format('HH:mm:ss'),
        p.latitude,
        p.longitude,
        p.speed != null ? p.speed.toFixed(1) : '',
        p.batteryPct ?? '',
        (p.address ?? '').replace(/,/g, ';'),
      ].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shield-location-${childName}-${fromDate.format('YYYY-MM-DD')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute map center: first point or default
  const mapCenter = points.length > 0
    ? { lat: points[0].latitude, lng: points[0].longitude }
    : DEFAULT_CENTER;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<HistoryIcon />}
        title="Location History"
        subtitle="View movement history and route playback"
        iconColor="#1565C0"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            {(children || []).map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? '#1565C0' : '#E3F2FD',
                  color: (profileId === c.id) ? 'white' : '#1565C0',
                  '&:hover': { bgcolor: (profileId === c.id) ? '#0D47A1' : '#BBDEFB' },
                }}
              />
            ))}
            <Tooltip title="Export CSV">
              <span>
                <Button
                  size="small" variant="outlined" startIcon={<DownloadIcon />}
                  onClick={exportCsv} disabled={points.length === 0}
                  sx={{ borderRadius: 2, fontWeight: 600, borderColor: '#1565C020', color: '#1565C0' }}
                >
                  Export
                </Button>
              </span>
            </Tooltip>
          </Stack>
        }
      />

      {/* Date pickers */}
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 2.5 }}>
          <CardContent sx={{ py: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                <DatePicker
                  label="From"
                  value={fromDate}
                  onChange={(v) => v && setFromDate(v.startOf('day'))}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <DatePicker
                  label="To"
                  value={toDate}
                  onChange={(v) => v && setToDate(v.endOf('day'))}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <Chip
                  label={`${points.length} points`}
                  sx={{ fontWeight: 600, bgcolor: '#E3F2FD', color: '#1565C0' }}
                />
                {isToday && (
                  <Chip
                    icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', color: '#43A047 !important', animation: 'pulse 1.5s infinite' }} />}
                    label="Live"
                    size="small"
                    sx={{ fontWeight: 600, bgcolor: '#E8F5E9', color: '#2E7D32',
                      '& @keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }}
                  />
                )}
              </Stack>
            </LocalizationProvider>
          </CardContent>
        </Card>
      </AnimatedPage>

      <Grid container spacing={2.5}>
        {/* Map */}
        <Grid size={{ xs: 12, md: 8 }}>
          <AnimatedPage delay={0.15}>
            <Card sx={{ overflow: 'hidden' }}>
              {isLoading ? (
                <LoadingPage />
              ) : (
                <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                  <Map
                    defaultCenter={mapCenter}
                    defaultZoom={13}
                    mapId="shield-history-map"
                    style={{ height: 500, width: '100%' }}
                  >
                    <RouteOverlay points={points} />
                  </Map>
                </APIProvider>
              )}
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Timeline sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          <AnimatedPage delay={0.2}>
            <Card sx={{ height: 500, overflow: 'auto' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                  Timeline
                </Typography>
                {points.length === 0 ? (
                  <EmptyState title="No data" description="No location data for the selected date range" />
                ) : (
                  <List disablePadding>
                    {points.slice(0, 50).map((pt, i) => (
                      <ListItem
                        key={pt.id || i}
                        sx={{
                          py: 1, px: 1, borderRadius: 1.5, mb: 0.5,
                          borderLeft: i === 0 ? '3px solid #43A047' : i === points.length - 1 ? '3px solid #E53935' : '3px solid #E0E0E0',
                          transition: 'all 0.2s ease',
                          '&:hover': { bgcolor: '#F5F9FF' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {i === 0 ? (
                            <DirectionsWalkIcon sx={{ fontSize: 18, color: '#43A047' }} />
                          ) : (
                            <AccessTimeIcon sx={{ fontSize: 16, color: '#9E9E9E' }} />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight={500} fontSize={13}>
                              {formatTime(pt.recordedAt)}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {pt.latitude.toFixed(4)}, {pt.longitude.toFixed(4)}
                              {pt.speed ? ` | ${pt.speed.toFixed(1)} km/h` : ''}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                    {points.length > 50 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                        Showing first 50 of {points.length} points
                      </Typography>
                    )}
                  </List>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>
      </Grid>
    </AnimatedPage>
  );
}
