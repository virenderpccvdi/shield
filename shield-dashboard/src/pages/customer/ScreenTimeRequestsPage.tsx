import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Button, Stack, Tabs, Tab, Divider, Alert, Snackbar, Avatar,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface ChildProfile { id: string; name: string; }

interface ScreenTimeRequest {
  id: string;
  profileId: string;
  minutes: number;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  requestedAt: string;
  decidedAt?: string;
  expiresAt?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusChip({ status }: { status: ScreenTimeRequest['status'] }) {
  const config = {
    PENDING:  { color: '#F57F17', bg: '#FFF8E1', label: 'Pending' },
    APPROVED: { color: '#2E7D32', bg: '#E8F5E9', label: 'Approved' },
    DENIED:   { color: '#C62828', bg: '#FFEBEE', label: 'Denied' },
    EXPIRED:  { color: '#546E7A', bg: '#ECEFF1', label: 'Expired' },
  }[status] ?? { color: '#546E7A', bg: '#ECEFF1', label: status };

  return (
    <Chip
      size="small"
      label={config.label}
      sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: config.bg, color: config.color }}
    />
  );
}

export default function ScreenTimeRequestsPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const { data: children, isLoading: loadingChildren } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => []),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);
  const endpoint = tab === 0 ? 'pending' : 'all';

  const { data: requests, isLoading: loadingRequests } = useQuery({
    queryKey: ['screen-time-requests', profileId, endpoint],
    queryFn: () =>
      api.get(`/dns/screen-time/${profileId}/${endpoint}`)
        .then(r => (r.data?.data ?? []) as ScreenTimeRequest[])
        .catch(() => []),
    enabled: !!profileId,
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/dns/screen-time/${requestId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['screen-time-requests', profileId] });
      setSnackbar({ open: true, message: 'Screen time request approved', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to approve request', severity: 'error' }),
  });

  const denyMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/dns/screen-time/${requestId}/deny`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['screen-time-requests', profileId] });
      setSnackbar({ open: true, message: 'Request denied', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to deny request', severity: 'error' }),
  });

  if (loadingChildren) return <LoadingPage />;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader
          icon={<TimerIcon />}
          title="Screen Time Requests"
          subtitle="Review screen time extension requests from your children"
          iconColor="#1B5E20"
        />
        <EmptyState title="No child profiles" description="Add a child profile first to view screen time requests" />
      </AnimatedPage>
    );
  }

  const pendingCount = (requests ?? []).filter(r => r.status === 'PENDING').length;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<TimerIcon />}
        title="Screen Time Requests"
        subtitle="Review and respond to screen time extension requests from your children"
        iconColor="#1B5E20"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? '#1B5E20' : 'rgba(27,94,32,0.08)',
                  color: (profileId === c.id) ? 'white' : '#1B5E20',
                  '&:hover': { bgcolor: (profileId === c.id) ? '#155724' : 'rgba(27,94,32,0.16)' },
                }}
              />
            ))}
          </Stack>
        }
      />

      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Pending</span>
                  {pendingCount > 0 && (
                    <Chip
                      size="small"
                      label={pendingCount}
                      sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: '#FFEBEE', color: '#C62828', minWidth: 22 }}
                    />
                  )}
                </Stack>
              }
            />
            <Tab label="All History" />
          </Tabs>
        </Box>

        <CardContent sx={{ p: 0 }}>
          {loadingRequests ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : !requests || requests.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <TimerIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary" variant="body2">
                {tab === 0 ? 'No pending requests' : 'No requests found'}
              </Typography>
            </Box>
          ) : (
            <Box>
              {requests.map((req, i) => {
                const childName = children.find(c => c.id === req.profileId)?.name ?? 'Child';
                return (
                  <Box key={req.id}>
                    {i > 0 && <Divider />}
                    <Box sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      px: 2.5, py: 2, gap: 2, flexWrap: 'wrap',
                    }}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                        <Avatar sx={{ width: 42, height: 42, bgcolor: 'rgba(27,94,32,0.1)' }}>
                          <TimerIcon sx={{ color: '#1B5E20', fontSize: 22 }} />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {childName} — {req.minutes} minutes
                          </Typography>
                          {req.reason && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                              "{req.reason}"
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                            <AccessTimeIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.disabled">
                              {timeAgo(req.requestedAt)}
                            </Typography>
                            {req.status === 'APPROVED' && req.expiresAt && (
                              <Typography variant="caption" color="success.main">
                                · expires {timeAgo(req.expiresAt)}
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <StatusChip status={req.status} />
                        {req.status === 'PENDING' && (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => approveMutation.mutate(req.id)}
                              disabled={approveMutation.isPending}
                              sx={{ bgcolor: '#1B5E20', '&:hover': { bgcolor: '#155724' }, fontWeight: 600, fontSize: 12 }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={() => denyMutation.mutate(req.id)}
                              disabled={denyMutation.isPending}
                              sx={{ fontWeight: 600, fontSize: 12 }}
                            >
                              Deny
                            </Button>
                          </>
                        )}
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
