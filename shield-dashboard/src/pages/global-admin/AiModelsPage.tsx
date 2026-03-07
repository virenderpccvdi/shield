import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip,
  CircularProgress, Alert, Snackbar, Divider, Stack, LinearProgress,
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

interface ModelHealth {
  status: string;
  modelVersion?: string;
  lastTrained?: string;
  totalSamples?: number;
  anomalyThreshold?: number;
  modelType?: string;
  features?: string[];
}

interface AiAlert {
  id: string;
  profileId: string;
  severity: string;
  description: string;
  createdAt: string;
}

export default function AiModelsPage() {
  const [snack, setSnack] = useState('');
  const qc = useQueryClient();

  const { data: healthData, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ['ai-health'],
    queryFn: () => api.get('/ai/model/health').then(r => r.data?.data ?? r.data),
    retry: 1,
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['ai-alerts'],
    queryFn: () => api.get('/ai/alerts').then(r => r.data?.data ?? r.data ?? []),
    retry: 1,
  });

  const retrain = useMutation({
    mutationFn: () => api.post('/ai/model/retrain'),
    onSuccess: () => {
      setSnack('Model retraining started. This may take a few minutes.');
      qc.invalidateQueries({ queryKey: ['ai-health'] });
    },
    onError: () => setSnack('Failed to trigger retraining'),
  });

  const health: ModelHealth = healthData ?? {};
  const alerts: AiAlert[] = Array.isArray(alertsData) ? alertsData : [];
  const isUp = health.status === 'healthy' || health.status === 'ok' || health.status === 'UP';

  const severityColor = (s: string) => {
    if (s === 'HIGH' || s === 'CRITICAL') return 'error';
    if (s === 'MEDIUM') return 'warning';
    return 'info';
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PsychologyIcon />}
        title="AI Models"
        subtitle="Anomaly detection model status and management"
        iconColor="#6A1B9A"
        action={
          <Button variant="contained" startIcon={<ModelTrainingIcon />}
            onClick={() => retrain.mutate()} disabled={retrain.isPending}
            sx={{ bgcolor: '#6A1B9A', '&:hover': { bgcolor: '#4A148C' } }}>
            {retrain.isPending ? <CircularProgress size={18} color="inherit" /> : 'Retrain Model'}
          </Button>
        }
      />

      <Grid container spacing={3}>
        {/* Health Card */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PsychologyIcon sx={{ color: '#6A1B9A' }} />
                <Typography variant="h6" fontWeight={700}>Service Health</Typography>
              </Box>
              {healthLoading ? (
                <Box sx={{ py: 4 }}><LinearProgress /></Box>
              ) : healthError ? (
                <Alert severity="error">AI service is unreachable</Alert>
              ) : (
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {isUp
                      ? <CheckCircleIcon sx={{ color: '#43A047' }} />
                      : <ErrorIcon sx={{ color: '#E53935' }} />}
                    <Typography variant="body1" fontWeight={600}>
                      Status: <Chip label={health.status ?? 'unknown'} color={isUp ? 'success' : 'error'} size="small" sx={{ fontWeight: 700, ml: 0.5 }} />
                    </Typography>
                  </Box>
                  <Divider />
                  <InfoRow label="Model Type" value={health.modelType ?? 'Isolation Forest'} />
                  <InfoRow label="Model Version" value={health.modelVersion ?? '—'} />
                  <InfoRow label="Last Trained" value={health.lastTrained ? new Date(health.lastTrained).toLocaleString() : '—'} />
                  <InfoRow label="Training Samples" value={health.totalSamples?.toLocaleString() ?? '—'} />
                  <InfoRow label="Anomaly Threshold" value={health.anomalyThreshold != null ? String(health.anomalyThreshold) : '—'} />
                  {health.features && health.features.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>FEATURES</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {health.features.map(f => (
                          <Chip key={f} label={f} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11 }} />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Alerts Card */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <WarningAmberIcon sx={{ color: '#E65100' }} />
                <Typography variant="h6" fontWeight={700}>Recent Anomaly Alerts</Typography>
                <Chip label={alerts.length} size="small" color={alerts.length > 0 ? 'warning' : 'default'} sx={{ ml: 'auto', fontWeight: 700 }} />
              </Box>
              {alertsLoading ? (
                <Box sx={{ py: 4 }}><LinearProgress /></Box>
              ) : alerts.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#43A047', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">No recent anomalies detected</Typography>
                </Box>
              ) : (
                <Stack spacing={1.5} sx={{ maxHeight: 380, overflowY: 'auto' }}>
                  {alerts.slice(0, 20).map((alert) => (
                    <Box key={alert.id} sx={{
                      p: 1.5, borderRadius: 2, bgcolor: '#FAFAFA', border: '1px solid #F0F0F0',
                      '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                      animation: 'fadeInUp 0.3s ease both',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Chip label={alert.severity} color={severityColor(alert.severity)} size="small" sx={{ fontWeight: 700, fontSize: 10 }} />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(alert.createdAt).toLocaleString()}
                        </Typography>
                      </Box>
                      <Typography variant="body2">{alert.description}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        Profile: {alert.profileId}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Box>
  );
}
