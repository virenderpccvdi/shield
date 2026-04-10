import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, CircularProgress,
  Button, Stack, Select, MenuItem, FormControl, InputLabel,
  Alert, Snackbar, Divider, Tabs, Tab, Dialog, DialogTitle,
  DialogContent, DialogActions, Avatar,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import LanguageIcon from '@mui/icons-material/Language';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingPage from '../../components/LoadingPage';

interface ChildProfile { id: string; name: string; }

interface ApprovalRequest {
  id: string;
  domain: string;
  appName?: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  requestedAt: string;
  resolvedAt?: string;
  approvedDuration?: string;
  reason?: string;
}

const DURATION_OPTIONS = [
  { value: 'ONE_HOUR', label: '1 Hour' },
  { value: 'TODAY', label: 'Rest of today' },
  { value: 'PERMANENT', label: 'Always allow' },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusChip({ status }: { status: ApprovalRequest['status'] }) {
  const config = {
    PENDING:  { color: '#7C4700', bg: '#FFF8E1', label: 'Pending' },
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

export default function ApprovalRequestsPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; requestId: string | null }>({ open: false, requestId: null });
  const [approveDuration, setApproveDuration] = useState<string>('TODAY');
  const [denyDialog, setDenyDialog] = useState<{ open: boolean; requestId: string | null }>({ open: false, requestId: null });
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
  const pendingOnly = tab === 0;

  const { data: requests, isLoading: loadingRequests } = useQuery({
    queryKey: ['approval-requests', profileId, pendingOnly],
    queryFn: () =>
      api.get(`/dns/approval-requests/${profileId}`, { params: { pendingOnly } })
        .then(r => {
          const d = r.data?.data;
          return (d?.content ?? d ?? []) as ApprovalRequest[];
        }).catch(() => []),
    enabled: !!profileId,
  });

  const approveMutation = useMutation({
    mutationFn: ({ requestId, duration }: { requestId: string; duration: string }) =>
      api.post(`/dns/approval-requests/${requestId}/approve`, { duration }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approval-requests', profileId] });
      setApproveDialog({ open: false, requestId: null });
      setSnackbar({ open: true, message: 'Request approved', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to approve request', severity: 'error' }),
  });

  const denyMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/dns/approval-requests/${requestId}/deny`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approval-requests', profileId] });
      setDenyDialog({ open: false, requestId: null });
      setSnackbar({ open: true, message: 'Request denied', severity: 'success' });
    },
    onError: () => setSnackbar({ open: true, message: 'Failed to deny request', severity: 'error' }),
  });

  if (loadingChildren) return <LoadingPage />;

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<PendingActionsIcon />} title="App Requests" subtitle="Review access requests from your children" iconColor="#1565C0" />
        <EmptyState title="No child profiles" description="Add a child profile first to view approval requests" />
      </AnimatedPage>
    );
  }

  const pendingCount = (requests ?? []).filter(r => r.status === 'PENDING').length;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PendingActionsIcon />}
        title="App Requests"
        subtitle="Review and approve or deny access requests from your children"
        iconColor="#1565C0"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? '#1565C0' : 'rgba(21,101,192,0.08)',
                  color: (profileId === c.id) ? 'white' : '#1565C0',
                  '&:hover': { bgcolor: (profileId === c.id) ? '#0D47A1' : 'rgba(21,101,192,0.16)' },
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
                    <Chip size="small" label={pendingCount}
                      sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: '#FFEBEE', color: '#C62828', minWidth: 22 }} />
                  )}
                </Stack>
              }
            />
            <Tab label="All Requests" />
          </Tabs>
        </Box>

        <CardContent sx={{ p: 0 }}>
          {loadingRequests ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : !requests || requests.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <PendingActionsIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary" variant="body2">
                {pendingOnly ? 'No pending requests' : 'No requests found'}
              </Typography>
            </Box>
          ) : (
            <Box>
              {requests.map((req, i) => (
                <Box key={req.id}>
                  {i > 0 && <Divider />}
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: 2.5, py: 2, gap: 2, flexWrap: 'wrap',
                  }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                      <Avatar sx={{ width: 38, height: 38, bgcolor: 'rgba(21,101,192,0.1)' }}>
                        <LanguageIcon sx={{ color: '#1565C0', fontSize: 20 }} />
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {req.appName || req.domain}
                        </Typography>
                        {req.appName && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {req.domain}
                          </Typography>
                        )}
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                          <AccessTimeIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.disabled">
                            {timeAgo(req.requestedAt)}
                          </Typography>
                          {req.approvedDuration && (
                            <Typography variant="caption" color="text.secondary">
                              · {DURATION_OPTIONS.find(d => d.value === req.approvedDuration)?.label ?? req.approvedDuration}
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
                            onClick={() => { setApproveDialog({ open: true, requestId: req.id }); setApproveDuration('TODAY'); }}
                            sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' }, fontWeight: 600, fontSize: 12 }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<CancelIcon />}
                            onClick={() => setDenyDialog({ open: true, requestId: req.id })}
                            sx={{ fontWeight: 600, fontSize: 12 }}
                          >
                            Deny
                          </Button>
                        </>
                      )}
                    </Stack>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={approveDialog.open} onClose={() => setApproveDialog({ open: false, requestId: null })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Approve Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            How long should this site be accessible?
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Duration</InputLabel>
            <Select value={approveDuration} label="Duration" onChange={e => setApproveDuration(e.target.value)}>
              {DURATION_OPTIONS.map(d => (
                <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setApproveDialog({ open: false, requestId: null })} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            onClick={() => approveDialog.requestId && approveMutation.mutate({ requestId: approveDialog.requestId, duration: approveDuration })}
            disabled={approveMutation.isPending}
            sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' }, fontWeight: 600 }}
          >
            {approveMutation.isPending ? 'Approving...' : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deny Confirmation Dialog */}
      <Dialog open={denyDialog.open} onClose={() => setDenyDialog({ open: false, requestId: null })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Deny Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            The site will remain blocked for this child. You can approve it later if needed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDenyDialog({ open: false, requestId: null })} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => denyDialog.requestId && denyMutation.mutate(denyDialog.requestId)}
            disabled={denyMutation.isPending}
            sx={{ fontWeight: 600 }}
          >
            {denyMutation.isPending ? 'Denying...' : 'Deny'}
          </Button>
        </DialogActions>
      </Dialog>

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
