import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Chip, Stack, List, ListItem, ListItemIcon, ListItemText
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import HistoryIcon from '@mui/icons-material/History';
import PlaceIcon from '@mui/icons-material/Place';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface ChildProfile { id: string; name: string; }

interface LocationPoint {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  recordedAt: string;
  address?: string;
}

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };

export default function LocationHistoryPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
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

  const { data: locationData, isLoading } = useQuery({
    queryKey: ['location-history', profileId, fromDate.toISOString(), toDate.toISOString()],
    queryFn: () => api.get(`/location/${profileId}/history`, {
      params: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        size: 500,
      },
    }).then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as LocationPoint[];
    }),
    enabled: !!profileId,
  });

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const L = (window as any).L;
    if (!L) {
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
  }

  // Draw route on map
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current) return;

    // Clear
    if (polylineRef.current) { polylineRef.current.remove(); polylineRef.current = null; }
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (!locationData || locationData.length === 0) return;

    const points: [number, number][] = locationData.map(p => [p.latitude, p.longitude]);

    // Polyline route
    polylineRef.current = L.polyline(points, {
      color: '#1565C0',
      weight: 3,
      opacity: 0.8,
      dashArray: '10, 6',
    }).addTo(mapInstance.current);

    // Start marker
    const startIcon = L.divIcon({
      html: '<div style="background:#43A047;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">S</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const endIcon = L.divIcon({
      html: '<div style="background:#E53935;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">E</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    if (points.length > 0) {
      markersRef.current.push(
        L.marker(points[0], { icon: startIcon })
          .addTo(mapInstance.current)
          .bindPopup(`<b>Start</b><br/>${formatTime(locationData[0].recordedAt)}`)
      );
    }
    if (points.length > 1) {
      markersRef.current.push(
        L.marker(points[points.length - 1], { icon: endIcon })
          .addTo(mapInstance.current)
          .bindPopup(`<b>End</b><br/>${formatTime(locationData[locationData.length - 1].recordedAt)}`)
      );
    }

    // Fit bounds
    mapInstance.current.fitBounds(points, { padding: [40, 40] });
  }, [locationData]);

  function formatTime(iso: string) {
    return dayjs(iso).format('h:mm A');
  }

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<HistoryIcon />} title="Location History" subtitle="Track movement history" iconColor="#1565C0" />
        <EmptyState title="No child profiles" description="Add a child profile first to view location history" />
      </AnimatedPage>
    );
  }

  const points = locationData || [];

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
                <Box sx={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box ref={mapRef} sx={{ height: 500, width: '100%' }} />
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
