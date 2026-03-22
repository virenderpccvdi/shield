import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, TextField, Stack,
  FormControl, InputLabel, Select, MenuItem, Chip, Snackbar, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CampaignIcon from '@mui/icons-material/Campaign';
import SendIcon from '@mui/icons-material/Send';
import EmailIcon from '@mui/icons-material/Email';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PeopleIcon from '@mui/icons-material/People';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import { useAuthStore } from '../../store/auth.store';

const TEAL = '#00695C';
const TEAL_DARK = '#004D40';

interface IspComm {
  id: string;
  tenantId: string;
  subject: string;
  body: string;
  channel: string;
  sentBy: string;
  sentAt: string;
  recipientCount: number;
  status: string;
}

interface PagedResp<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
}

const EMPTY_FORM = { subject: '', body: '', channel: 'EMAIL' };

export default function CommunicationsPage() {
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.tenantId;
  const userId = user?.id;
  const qc = useQueryClient();

  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  // ── Quotas (to show customer count) ──────────────────────────────────────
  const { data: quotaData } = useQuery({
    queryKey: ['tenant-quotas', tenantId],
    enabled: !!tenantId,
    queryFn: () =>
      api.get(`/tenants/${tenantId}/quotas`).then((r) => r.data?.data as { usage: { customers: number } }),
  });
  const customerCount = quotaData?.usage?.customers ?? 0;

  // ── Communication history ─────────────────────────────────────────────────
  const { data: historyData, isLoading: historyLoading } = useQuery<PagedResp<IspComm>>({
    queryKey: ['isp-comms-history', tenantId],
    enabled: !!tenantId,
    queryFn: () =>
      api
        .get(`/notifications/isp-comms/history/${tenantId}?page=0&size=50`)
        .then((r) => (r.data?.data as PagedResp<IspComm>) ?? { content: [], totalElements: 0, totalPages: 0, page: 0 }),
  });
  const history: IspComm[] = historyData?.content ?? [];

  // ── Send mutation ─────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: () =>
      api.post('/notifications/isp-comms/send', {
        tenantId,
        sentBy: userId,
        subject: form.subject,
        body: form.body,
        channel: form.channel,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['isp-comms-history', tenantId] });
      qc.invalidateQueries({ queryKey: ['tenant-quotas', tenantId] });
      setForm(EMPTY_FORM);
      setConfirmOpen(false);
      setSnack({ msg: 'Communication sent successfully!', severity: 'success' });
    },
    onError: () => {
      setConfirmOpen(false);
      setSnack({ msg: 'Failed to send communication. Please try again.', severity: 'error' });
    },
  });

  const canSend = form.subject.trim().length > 0 && form.body.trim().length > 0;

  const channelLabel = (ch: string) => {
    if (ch === 'EMAIL') return 'Email';
    if (ch === 'PUSH') return 'Push';
    if (ch === 'BOTH') return 'Email + Push';
    return ch;
  };

  const channelColor = (ch: string): 'info' | 'warning' | 'success' => {
    if (ch === 'PUSH') return 'warning';
    if (ch === 'BOTH') return 'success';
    return 'info';
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<CampaignIcon />}
        title="Customer Communications"
        subtitle="Broadcast announcements, alerts, and tips to all your customers"
        iconColor={TEAL}
      />

      <Grid container spacing={2.5}>
        {/* ── Send Form ────────────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <AnimatedPage delay={0.1}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '8px',
                    bgcolor: '#E0F2F1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: TEAL,
                  }}>
                    <SendIcon fontSize="small" />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600}>New Communication</Typography>
                </Box>

                <Stack spacing={2.5}>
                  <TextField
                    label="Subject"
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 300 }}
                    placeholder="e.g. Scheduled maintenance on 25 March 2026"
                  />

                  <TextField
                    label="Message"
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    fullWidth
                    multiline
                    rows={5}
                    placeholder="Write your announcement, service alert, or tip here..."
                  />

                  <FormControl size="small" sx={{ maxWidth: 280 }}>
                    <InputLabel>Channel</InputLabel>
                    <Select
                      value={form.channel}
                      label="Channel"
                      onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                    >
                      <MenuItem value="EMAIL">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <EmailIcon fontSize="small" sx={{ color: '#1565C0' }} />
                          Email only
                        </Box>
                      </MenuItem>
                      <MenuItem value="PUSH">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <NotificationsIcon fontSize="small" sx={{ color: '#F57C00' }} />
                          Push notification only
                        </Box>
                      </MenuItem>
                      <MenuItem value="BOTH">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <EmailIcon fontSize="small" sx={{ color: TEAL }} />
                          Email + Push
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>

                  <Box>
                    <Tooltip title={!canSend ? 'Subject and message are required' : ''}>
                      <span>
                        <Button
                          variant="contained"
                          startIcon={<SendIcon />}
                          disabled={!canSend || sendMutation.isPending}
                          onClick={() => setConfirmOpen(true)}
                          sx={{
                            bgcolor: TEAL,
                            '&:hover': { bgcolor: TEAL_DARK },
                            '&.Mui-disabled': { bgcolor: '#B0BEC5', color: 'white' },
                          }}
                        >
                          Send to All Customers
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* ── Stats sidebar ────────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <AnimatedPage delay={0.15}>
            <Stack spacing={2}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                      width: 44, height: 44, borderRadius: '10px',
                      bgcolor: '#E0F2F1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <PeopleIcon sx={{ color: TEAL }} />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Recipients</Typography>
                      <Typography variant="h5" fontWeight={700} sx={{ color: TEAL }}>
                        {customerCount.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">active customers</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                    Channel info
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EmailIcon fontSize="small" sx={{ color: '#1565C0' }} />
                      <Typography variant="body2"><strong>Email</strong> — sent to customer email addresses via SMTP</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <NotificationsIcon fontSize="small" sx={{ color: '#F57C00' }} />
                      <Typography variant="body2"><strong>Push</strong> — sent via FCM to all customer devices</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </AnimatedPage>
        </Grid>

        {/* ── History table ────────────────────────────────────────────────── */}
        <Grid size={12}>
          <AnimatedPage delay={0.2}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  Communication History
                </Typography>

                {historyLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={32} sx={{ color: TEAL }} />
                  </Box>
                ) : history.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 5 }}>
                    <CampaignIcon sx={{ fontSize: 48, color: '#B0BEC5', mb: 1 }} />
                    <Typography color="text.secondary">No communications sent yet</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Your first broadcast will appear here
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Subject</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Channel</TableCell>
                          <TableCell sx={{ fontWeight: 600 }} align="right">Recipients</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {history.map((row) => (
                          <TableRow key={row.id} hover>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Typography variant="body2">
                                {new Date(row.sentAt).toLocaleDateString('en-IN', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                })}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(row.sentAt).toLocaleTimeString('en-IN', {
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{
                                maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {row.subject}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={channelLabel(row.channel)}
                                color={channelColor(row.channel)}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={600}>
                                {row.recipientCount.toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={row.status}
                                color={row.status === 'SENT' ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>
      </Grid>

      {/* ── Confirmation dialog ──────────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onClose={() => !sendMutation.isPending && setConfirmOpen(false)}>
        <DialogTitle>Send to all customers?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will send your communication to{' '}
            <strong>{customerCount.toLocaleString()} customer{customerCount !== 1 ? 's' : ''}</strong>{' '}
            via <strong>{channelLabel(form.channel)}</strong>.
          </DialogContentText>
          <Box sx={{ mt: 2, p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E0E0E0' }}>
            <Typography variant="subtitle2" fontWeight={600}>{form.subject}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
              {form.body.length > 200 ? form.body.slice(0, 200) + '…' : form.body}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={sendMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending}
            startIcon={sendMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            sx={{ bgcolor: TEAL, '&:hover': { bgcolor: TEAL_DARK } }}
          >
            {sendMutation.isPending ? 'Sending…' : 'Confirm & Send'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ─────────────────────────────────────────────────────────── */}
      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled">
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </AnimatedPage>
  );
}
