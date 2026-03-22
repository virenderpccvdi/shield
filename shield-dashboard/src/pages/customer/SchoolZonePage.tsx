import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, CircularProgress,
  Button, Chip, Switch, TextField, Stack,
  Divider, Alert, Snackbar, List, ListItem, ListItemText,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SchoolIcon from '@mui/icons-material/School';
import PlaceIcon from '@mui/icons-material/Place';
import SaveIcon from '@mui/icons-material/Save';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

const ICON_COLOR = '#1B5E20';
const BG_COLOR = 'rgba(27,94,32,0.08)';

interface ChildProfile { id: string; name: string; }

interface Geofence {
  id: string;
  name: string;
  centerLat?: number;
  centerLng?: number;
  radiusMeters?: number;
  type?: string;
  isSchool?: boolean;
  schoolStart?: string;
  schoolEnd?: string;
}

interface GeofenceSchoolSettings {
  isSchool: boolean;
  schoolStart: string;
  schoolEnd: string;
}

type GeofencePatch = Record<string, GeofenceSchoolSettings>;

export default function SchoolZonePage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  // localSettings: geofenceId → school settings (tracks unsaved changes)
  const [localSettings, setLocalSettings] = useState<GeofencePatch>({});
  const [dirty, setDirty] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => [] as ChildProfile[]),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);

  const { data: geofences, isLoading: loadingGeofences } = useQuery({
    queryKey: ['geofences-profile', profileId],
    queryFn: () => api.get(`/profiles/${profileId}/geofences`).then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data ?? []) as Geofence[];
    }).catch(() => [] as Geofence[]),
    enabled: !!profileId,
  });

  const saveMutation = useMutation({
    mutationFn: async (patches: GeofencePatch) => {
      const requests = Object.entries(patches).map(([geofenceId, settings]) =>
        api.patch(`/profiles/geofences/${geofenceId}`, {
          isSchool: settings.isSchool,
          schoolStart: settings.schoolStart,
          schoolEnd: settings.schoolEnd,
        })
      );
      return Promise.all(requests);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geofences-profile', profileId] });
      setLocalSettings({});
      setDirty(false);
      setSnackbar({ open: true, message: 'School zone settings saved', severity: 'success' });
    },
    onError: () => {
      setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' });
    },
  });

  const getSettings = (g: Geofence): GeofenceSchoolSettings => {
    if (localSettings[g.id]) return localSettings[g.id];
    return {
      isSchool: g.isSchool ?? false,
      schoolStart: g.schoolStart ?? '08:00',
      schoolEnd: g.schoolEnd ?? '15:00',
    };
  };

  const updateSettings = (geofenceId: string, patch: Partial<GeofenceSchoolSettings>) => {
    setLocalSettings(prev => {
      const geofence = geofences?.find(g => g.id === geofenceId);
      const current = prev[geofenceId] ?? {
        isSchool: geofence?.isSchool ?? false,
        schoolStart: geofence?.schoolStart ?? '08:00',
        schoolEnd: geofence?.schoolEnd ?? '15:00',
      };
      return { ...prev, [geofenceId]: { ...current, ...patch } };
    });
    setDirty(true);
  };

  if (loadingChildren) {
    return (
      <AnimatedPage>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      </AnimatedPage>
    );
  }

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader
          icon={<SchoolIcon />}
          title="School Zone"
          subtitle="Mark geofences as school zones"
          iconColor={ICON_COLOR}
        />
        <EmptyState title="No child profiles" description="Add a child profile first to configure school zones" />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<SchoolIcon />}
        title="School Zone"
        subtitle="Set school hours and arrival/departure notifications"
        iconColor={ICON_COLOR}
        action={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => { setSelectedChild(c.id); setLocalSettings({}); setDirty(false); }}
                sx={{
                  fontWeight: 600,
                  bgcolor: profileId === c.id ? ICON_COLOR : BG_COLOR,
                  color: profileId === c.id ? 'white' : ICON_COLOR,
                  '&:hover': { bgcolor: profileId === c.id ? '#13401A' : 'rgba(27,94,32,0.16)' },
                }}
              />
            ))}
          </Stack>
        }
      />

      {/* How it works */}
      <AnimatedPage delay={0.05}>
        <Card sx={{ mb: 3, borderLeft: `4px solid ${ICON_COLOR}` }}>
          <CardContent sx={{ py: '12px !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <NotificationsActiveIcon sx={{ color: ICON_COLOR, fontSize: 22, mt: 0.25, flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary">
                When your child arrives at or leaves the school zone during school hours,
                you'll be notified immediately. Mark any of your geofences as a school zone
                and set the active school hours below.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Geofences list */}
      <AnimatedPage delay={0.1}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              Geofences for {children.find(c => c.id === profileId)?.name ?? 'child'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Toggle "Mark as School Zone" on any geofence, then set the school hours for that zone.
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {loadingGeofences ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : !geofences || geofences.length === 0 ? (
              <EmptyState
                title="No geofences yet"
                description="Create geofences on the Geofences page first, then return here to mark any as school zones"
              />
            ) : (
              <List disablePadding>
                {geofences.map((g, i) => {
                  const settings = getSettings(g);
                  return (
                    <ListItem
                      key={g.id}
                      disablePadding
                      sx={{
                        display: 'block',
                        mb: 1.5,
                        '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                        animation: `fadeInUp 0.3s ease ${0.05 + i * 0.07}s both`,
                      }}
                    >
                      <Box sx={{
                        border: '1px solid',
                        borderColor: settings.isSchool ? 'rgba(27,94,32,0.35)' : 'divider',
                        borderRadius: 2,
                        overflow: 'hidden',
                        transition: 'border-color 0.2s ease',
                      }}>
                        {/* Geofence header row */}
                        <Box sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          px: 2, py: 1.5,
                          bgcolor: settings.isSchool ? BG_COLOR : 'background.paper',
                          transition: 'background-color 0.2s ease',
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                              width: 38, height: 38, borderRadius: '9px', flexShrink: 0,
                              bgcolor: settings.isSchool ? ICON_COLOR : 'rgba(0,0,0,0.06)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: settings.isSchool ? 'white' : 'text.secondary',
                              transition: 'all 0.2s ease',
                            }}>
                              {settings.isSchool ? <SchoolIcon sx={{ fontSize: 20 }} /> : <PlaceIcon sx={{ fontSize: 20 }} />}
                            </Box>
                            <ListItemText
                              primary={
                                <Typography variant="body2" fontWeight={600}>{g.name}</Typography>
                              }
                              secondary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                                  {g.type && (
                                    <Chip
                                      label={g.type}
                                      size="small"
                                      sx={{ height: 18, fontSize: 10, fontWeight: 600 }}
                                    />
                                  )}
                                  {g.radiusMeters && (
                                    <Typography variant="caption" color="text.secondary">
                                      {g.radiusMeters}m radius
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                          </Box>
                          <Switch
                            checked={settings.isSchool}
                            onChange={e => updateSettings(g.id, { isSchool: e.target.checked })}
                            size="small"
                            sx={{
                              '& .MuiSwitch-switchBase.Mui-checked': { color: ICON_COLOR },
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ICON_COLOR },
                            }}
                          />
                        </Box>

                        {/* School hours sub-row (only shown when isSchool = true) */}
                        {settings.isSchool && (
                          <Box sx={{
                            px: 2, py: 2,
                            borderTop: '1px solid',
                            borderColor: 'rgba(27,94,32,0.15)',
                            bgcolor: 'background.paper',
                          }}>
                            <Typography variant="caption" fontWeight={600} color={ICON_COLOR} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', mb: 1.5 }}>
                              School Hours
                            </Typography>
                            <Stack direction="row" spacing={2}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                  Start time
                                </Typography>
                                <TextField
                                  type="time"
                                  value={settings.schoolStart}
                                  onChange={e => updateSettings(g.id, { schoolStart: e.target.value })}
                                  size="small"
                                  fullWidth
                                  slotProps={{ htmlInput: { step: 300 } }}
                                  sx={{ '& input': { fontWeight: 600 } }}
                                />
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                  End time
                                </Typography>
                                <TextField
                                  type="time"
                                  value={settings.schoolEnd}
                                  onChange={e => updateSettings(g.id, { schoolEnd: e.target.value })}
                                  size="small"
                                  fullWidth
                                  slotProps={{ htmlInput: { step: 300 } }}
                                  sx={{ '& input': { fontWeight: 600 } }}
                                />
                              </Box>
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                              You'll receive arrival and departure alerts during this window.
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Save Button */}
      {dirty && (
        <AnimatedPage delay={0}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => saveMutation.mutate(localSettings)}
              disabled={saveMutation.isPending || Object.keys(localSettings).length === 0}
              sx={{ bgcolor: ICON_COLOR, '&:hover': { bgcolor: '#13401A' } }}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save School Zones'}
            </Button>
          </Box>
        </AnimatedPage>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
