import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Button, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Stack, List, ListItem, ListItemText,
  ListItemSecondaryAction, Divider, Alert, Snackbar,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ContactEmergencyIcon from '@mui/icons-material/ContactEmergency';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

const ICON_COLOR = '#C62828';
const MAX_CONTACTS = 3;

interface ChildProfile { id: string; name: string; }

interface EmergencyContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  relationship?: string;
}

interface ContactForm {
  name: string;
  phone: string;
  email: string;
  relationship: string;
}

const EMPTY_FORM: ContactForm = { name: '', phone: '', email: '', relationship: '' };

export default function EmergencyContactsPage() {
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
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

  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['emergency-contacts', profileId],
    queryFn: () => api.get(`/profiles/${profileId}/emergency-contacts`).then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data ?? []) as EmergencyContact[];
    }).catch(() => [] as EmergencyContact[]),
    enabled: !!profileId,
  });

  const addMutation = useMutation({
    mutationFn: (data: ContactForm) => api.post(`/profiles/${profileId}/emergency-contacts`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emergency-contacts', profileId] });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setFormError(null);
      setSnackbar({ open: true, message: 'Emergency contact added', severity: 'success' });
    },
    onError: () => {
      setSnackbar({ open: true, message: 'Failed to add contact', severity: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (contactId: string) => api.delete(`/profiles/${profileId}/emergency-contacts/${contactId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emergency-contacts', profileId] });
      setDeleteConfirmId(null);
      setSnackbar({ open: true, message: 'Contact removed', severity: 'success' });
    },
    onError: () => {
      setSnackbar({ open: true, message: 'Failed to remove contact', severity: 'error' });
    },
  });

  const handleOpenDialog = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setFormError('Phone or email is required');
      return;
    }
    setFormError(null);
    addMutation.mutate(form);
  };

  const atCapacity = (contacts?.length ?? 0) >= MAX_CONTACTS;

  if (loadingChildren) {
    return (
      <AnimatedPage>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </AnimatedPage>
    );
  }

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader
          icon={<ContactEmergencyIcon />}
          title="Emergency Contacts"
          subtitle="Add trusted contacts for emergencies"
          iconColor={ICON_COLOR}
        />
        <EmptyState title="No child profiles" description="Add a child profile first to manage emergency contacts" />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ContactEmergencyIcon />}
        title="Emergency Contacts"
        subtitle="Trusted people to contact in an emergency"
        iconColor={ICON_COLOR}
        action={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {children.map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: profileId === c.id ? ICON_COLOR : 'rgba(198,40,40,0.08)',
                  color: profileId === c.id ? 'white' : ICON_COLOR,
                  '&:hover': { bgcolor: profileId === c.id ? '#B71C1C' : 'rgba(198,40,40,0.16)' },
                }}
              />
            ))}
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={handleOpenDialog}
              disabled={atCapacity}
              sx={{ bgcolor: ICON_COLOR, '&:hover': { bgcolor: '#B71C1C' } }}
            >
              Add Contact
            </Button>
          </Stack>
        }
      />

      {/* Info card */}
      <AnimatedPage delay={0.05}>
        <Card sx={{ mb: 3, borderLeft: `4px solid ${ICON_COLOR}` }}>
          <CardContent sx={{ py: '12px !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <PeopleAltIcon sx={{ color: ICON_COLOR, fontSize: 22 }} />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Up to {MAX_CONTACTS} emergency contacts per child
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  These contacts can be reached quickly from the child's app in an emergency situation.
                </Typography>
              </Box>
              <Box sx={{ ml: 'auto' }}>
                <Chip
                  label={`${contacts?.length ?? 0} / ${MAX_CONTACTS}`}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    bgcolor: atCapacity ? 'rgba(198,40,40,0.10)' : 'rgba(67,160,71,0.08)',
                    color: atCapacity ? ICON_COLOR : '#2E7D32',
                  }}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Contact list */}
      <AnimatedPage delay={0.1}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Contacts for {children.find(c => c.id === profileId)?.name ?? 'child'}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {loadingContacts ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : !contacts || contacts.length === 0 ? (
              <EmptyState
                title="No emergency contacts yet"
                description="Add trusted contacts so your child can reach someone quickly in an emergency"
              />
            ) : (
              <List disablePadding>
                {contacts.map((contact, i) => (
                  <ListItem
                    key={contact.id}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.2s ease',
                      '&:hover': { bgcolor: 'background.default', borderColor: 'rgba(198,40,40,0.25)' },
                      '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                      animation: `fadeInUp 0.3s ease ${0.05 + i * 0.07}s both`,
                    }}
                  >
                    <Box sx={{
                      width: 44, height: 44, borderRadius: '10px', flexShrink: 0, mr: 2,
                      bgcolor: 'rgba(198,40,40,0.08)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: ICON_COLOR,
                    }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {contact.name.charAt(0).toUpperCase()}
                      </Typography>
                    </Box>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={600}>{contact.name}</Typography>
                          {contact.relationship && (
                            <Chip label={contact.relationship} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 600 }} />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.25 }}>
                          {contact.phone && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PhoneIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">{contact.phone}</Typography>
                            </Box>
                          )}
                          {contact.email && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EmailIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">{contact.email}</Typography>
                            </Box>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={() => setDeleteConfirmId(contact.id)}
                        sx={{ color: 'text.disabled', '&:hover': { color: ICON_COLOR, bgcolor: 'rgba(198,40,40,0.08)' } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}

            {atCapacity && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="info" sx={{ fontSize: 13 }}>
                  You've reached the maximum of {MAX_CONTACTS} emergency contacts for this profile.
                  Remove one to add a new contact.
                </Alert>
              </Box>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Add Contact Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Emergency Contact</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {formError && (
              <Alert severity="error" onClose={() => setFormError(null)}>{formError}</Alert>
            )}
            <TextField
              label="Full Name *"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              fullWidth
              size="small"
              autoFocus
            />
            <TextField
              label="Phone Number"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              fullWidth
              size="small"
              placeholder="+91 98765 43210"
              slotProps={{ htmlInput: { type: 'tel' } }}
            />
            <TextField
              label="Email Address"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              fullWidth
              size="small"
              placeholder="contact@example.com"
              slotProps={{ htmlInput: { type: 'email' } }}
            />
            <TextField
              label="Relationship (optional)"
              value={form.relationship}
              onChange={e => setForm({ ...form, relationship: e.target.value })}
              fullWidth
              size="small"
              placeholder="e.g. Grandparent, Uncle, Family friend"
            />
            <Typography variant="caption" color="text.secondary">
              * At least one of Phone or Email is required.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={addMutation.isPending}
            sx={{ bgcolor: ICON_COLOR, '&:hover': { bgcolor: '#B71C1C' } }}
          >
            {addMutation.isPending ? 'Adding...' : 'Add Contact'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Remove Contact?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to remove this emergency contact? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

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
