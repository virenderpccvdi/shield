import { useState } from 'react';
import {
  Box, Typography, Card, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, TextField, InputAdornment, Stack, Grid, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip, Select, MenuItem,
  FormControl, InputLabel, Alert, Drawer, Divider, Avatar, Tab, Tabs,
  LinearProgress,
} from '@mui/material';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import NoteIcon from '@mui/icons-material/Note';
import CallIcon from '@mui/icons-material/Call';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import TaskIcon from '@mui/icons-material/Task';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import TableRowsIcon from '@mui/icons-material/TableRows';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import EventIcon from '@mui/icons-material/Event';
import LabelIcon from '@mui/icons-material/Label';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import BlockIcon from '@mui/icons-material/Block';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { gradients } from '../../theme/theme';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  source: string;
  status: string;
  pipelineStage: string;
  notes?: string;
  ipAddress?: string;
  assignedToName?: string;
  dealValue?: number;
  followUpAt?: string;
  tags?: string[];
  lostReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface Activity {
  id: string;
  leadId: string;
  type: string;
  title?: string;
  description?: string;
  outcome?: string;
  performedByName?: string;
  performedAt: string;
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  proposal: number;
  won: number;
  lost: number;
}

const PIPELINE_STAGES = [
  { key: 'NEW',       label: 'New',       color: '#1565C0', bg: '#E3F2FD', icon: '📥' },
  { key: 'CONTACTED', label: 'Contacted', color: '#E65100', bg: '#FFF3E0', icon: '📞' },
  { key: 'QUALIFIED', label: 'Qualified', color: '#2E7D32', bg: '#E8F5E9', icon: '✅' },
  { key: 'PROPOSAL',  label: 'Proposal',  color: '#6A1B9A', bg: '#F3E5F5', icon: '📋' },
  { key: 'WON',       label: 'Won',       color: '#00695C', bg: '#E0F2F1', icon: '🏆' },
  { key: 'LOST',      label: 'Lost',      color: '#B71C1C', bg: '#FFEBEE', icon: '❌' },
];

const ACTIVITY_TYPES = [
  { key: 'NOTE',    label: 'Note',    icon: <NoteIcon />,        color: '#607D8B' },
  { key: 'CALL',    label: 'Call',    icon: <CallIcon />,        color: '#1565C0' },
  { key: 'EMAIL',   label: 'Email',   icon: <EmailIcon />,       color: '#7B1FA2' },
  { key: 'MEETING', label: 'Meeting', icon: <MeetingRoomIcon />, color: '#E65100' },
  { key: 'TASK',    label: 'Task',    icon: <TaskIcon />,        color: '#2E7D32' },
];

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(v?: number) {
  if (!v) return null;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
}

function stageOf(lead: Lead) {
  return PIPELINE_STAGES.find(s => s.key === (lead.pipelineStage || lead.status)) ?? PIPELINE_STAGES[0];
}

function actTypeOf(type: string) {
  return ACTIVITY_TYPES.find(t => t.key === type) ?? ACTIVITY_TYPES[0];
}

export default function LeadsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<'list' | 'pipeline'>('pipeline');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [error, setError] = useState('');
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [drawerTab, setDrawerTab] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  // Activity form state
  const [actType, setActType] = useState('NOTE');
  const [actTitle, setActTitle] = useState('');
  const [actDesc, setActDesc] = useState('');
  const [actOutcome, setActOutcome] = useState('');
  // Edit lead state (inside drawer)
  const [editNotes, setEditNotes] = useState('');
  const [editDeal, setEditDeal] = useState('');
  const [editFollowUp, setEditFollowUp] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editAssigned, setEditAssigned] = useState('');
  const [editingDetails, setEditingDetails] = useState(false);

  const { data: stats } = useQuery<LeadStats>({
    queryKey: ['lead-stats'],
    queryFn: () => api.get('/admin/contact/leads/stats').then(r => r.data?.data ?? r.data),
    refetchInterval: 30000,
  });

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['leads', stageFilter],
    queryFn: () => {
      const p = new URLSearchParams({ page: '0', size: '200' });
      if (stageFilter) p.set('stage', stageFilter);
      return api.get(`/admin/contact/leads?${p}`).then(r =>
        r.data?.data?.content ?? r.data?.content ?? []
      ).catch(() => []);
    },
    refetchInterval: 30000,
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ['activities', drawerLead?.id],
    queryFn: () => drawerLead
      ? api.get(`/admin/contact/leads/${drawerLead.id}/activities`).then(r => r.data?.data ?? r.data ?? [])
      : Promise.resolve([]),
    enabled: !!drawerLead,
  });

  const updateMutation = useMutation({
    mutationFn: (p: { id: string } & Partial<Lead> & { pipelineStage?: string }) =>
      api.put(`/admin/contact/leads/${p.id}`, p),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-stats'] });
      if (drawerLead && drawerLead.id === vars.id) {
        api.get(`/admin/contact/leads/${vars.id}`).then(r => {
          setDrawerLead(r.data?.data ?? r.data);
        });
      }
      setEditingDetails(false);
    },
    onError: () => setError('Failed to update lead.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/contact/leads/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-stats'] });
      setDeleteTarget(null);
      setDrawerLead(null);
    },
    onError: () => setError('Failed to delete lead.'),
  });

  const addActivityMutation = useMutation({
    mutationFn: (p: { leadId: string; type: string; title: string; description: string; outcome: string }) =>
      api.post(`/admin/contact/leads/${p.leadId}/activities`, {
        type: p.type, title: p.title, description: p.description, outcome: p.outcome,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities', drawerLead?.id] });
      setActTitle(''); setActDesc(''); setActOutcome(''); setActType('NOTE');
    },
    onError: () => setError('Failed to add activity.'),
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (p: { leadId: string; actId: string }) =>
      api.delete(`/admin/contact/leads/${p.leadId}/activities/${p.actId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities', drawerLead?.id] }),
  });

  function openDrawer(lead: Lead) {
    setDrawerLead(lead);
    setDrawerTab(0);
    setEditNotes(lead.notes ?? '');
    setEditDeal(lead.dealValue?.toString() ?? '');
    setEditFollowUp(lead.followUpAt ? lead.followUpAt.slice(0, 10) : '');
    setEditTags((lead.tags ?? []).join(', '));
    setEditAssigned(lead.assignedToName ?? '');
    setEditingDetails(false);
  }

  function moveStage(lead: Lead, direction: 'forward' | 'back') {
    const idx = PIPELINE_STAGES.findIndex(s => s.key === (lead.pipelineStage || 'NEW'));
    const next = PIPELINE_STAGES[direction === 'forward' ? idx + 1 : idx - 1];
    if (!next) return;
    updateMutation.mutate({ id: lead.id, pipelineStage: next.key });
    if (drawerLead?.id === lead.id) setDrawerLead({ ...drawerLead, pipelineStage: next.key });
  }

  function saveDetails() {
    if (!drawerLead) return;
    updateMutation.mutate({
      id: drawerLead.id,
      notes: editNotes,
      dealValue: editDeal ? Number(editDeal) : undefined,
      followUpAt: editFollowUp ? new Date(editFollowUp).toISOString() : undefined,
      tags: editTags ? editTags.split(',').map(t => t.trim()).filter(Boolean) : [],
      assignedToName: editAssigned,
    } as Lead & { id: string });
  }

  const filtered = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      (l.company ?? '').toLowerCase().includes(q);
  });

  return (
    <AnimatedPage>
      <PageHeader
        icon={<ContactMailIcon />}
        title="CRM"
        subtitle="Sales pipeline & contact management"
        iconColor="#7B1FA2"
        action={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Pipeline view">
              <IconButton
                onClick={() => setView('pipeline')}
                sx={{
                  bgcolor: view === 'pipeline' ? '#7B1FA2' : 'transparent',
                  color: view === 'pipeline' ? '#fff' : 'inherit',
                }}
              >
                <ViewKanbanIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="List view">
              <IconButton
                onClick={() => setView('list')}
                sx={{
                  bgcolor: view === 'list' ? '#7B1FA2' : 'transparent',
                  color: view === 'list' ? '#fff' : 'inherit',
                }}
              >
                <TableRowsIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard title="Total" value={stats?.total ?? 0} icon={<ContactMailIcon />} gradient={gradients.purple} delay={0} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard title="New" value={stats?.new ?? 0} icon={<PersonIcon />} gradient={gradients.blue} delay={0.05} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard title="Contacted" value={stats?.contacted ?? 0} icon={<PhoneIcon />} gradient={gradients.orange} delay={0.1} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard title="Qualified" value={stats?.qualified ?? 0} icon={<TaskIcon />} gradient={gradients.green} delay={0.15} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard title="Won" value={stats?.won ?? 0} icon={<EmojiEventsIcon />} gradient={gradients.teal} delay={0.2} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard title="Lost" value={stats?.lost ?? 0} icon={<BlockIcon />} gradient={gradients.red} delay={0.25} />
        </Grid>
      </Grid>

      {/* Search bar */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              placeholder="Search name, email, company…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              sx={{ minWidth: 260 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            {view === 'list' && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Stage</InputLabel>
                <Select value={stageFilter} label="Stage" onChange={e => setStageFilter(e.target.value)}>
                  <MenuItem value="">All Stages</MenuItem>
                  {PIPELINE_STAGES.map(s => (
                    <MenuItem key={s.key} value={s.key}>{s.icon} {s.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {filtered.length} leads
            </Typography>
          </Stack>
        </Box>
      </Card>

      {/* PIPELINE VIEW */}
      {view === 'pipeline' && (
        <Box sx={{ overflowX: 'auto', pb: 2 }}>
          <Stack direction="row" spacing={2} sx={{ minWidth: 900 }}>
            {PIPELINE_STAGES.map(stage => {
              const stageLeads = filtered.filter(l => (l.pipelineStage || 'NEW') === stage.key);
              const totalVal = stageLeads.reduce((s, l) => s + (l.dealValue ?? 0), 0);
              return (
                <Box key={stage.key} sx={{ flex: 1, minWidth: 180 }}>
                  {/* Column header */}
                  <Box sx={{
                    px: 1.5, py: 1, borderRadius: '10px 10px 0 0',
                    bgcolor: stage.bg, borderBottom: `3px solid ${stage.color}`,
                  }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight={700} fontSize={13} color={stage.color}>
                        {stage.icon} {stage.label}
                      </Typography>
                      <Chip
                        size="small"
                        label={stageLeads.length}
                        sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: stage.color, color: '#fff' }}
                      />
                    </Stack>
                    {totalVal > 0 && (
                      <Typography fontSize={11} color={stage.color} fontWeight={600} mt={0.25}>
                        {fmtCurrency(totalVal)}
                      </Typography>
                    )}
                  </Box>
                  {/* Cards */}
                  <Box sx={{
                    bgcolor: '#F8FAFC', borderRadius: '0 0 10px 10px', p: 1, minHeight: 120,
                    border: '1px solid #E0E0E0', borderTop: 'none',
                  }}>
                    {isLoading ? (
                      <LinearProgress />
                    ) : stageLeads.length === 0 ? (
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', pt: 2 }}>
                        No leads
                      </Typography>
                    ) : stageLeads.map(lead => (
                      <Card
                        key={lead.id}
                        onClick={() => openDrawer(lead)}
                        sx={{
                          mb: 1, cursor: 'pointer', borderRadius: 1.5,
                          '&:hover': { boxShadow: 3, transform: 'translateY(-1px)' },
                          transition: 'all 0.15s ease',
                          borderLeft: `3px solid ${stage.color}`,
                        }}
                      >
                        <Box sx={{ p: 1.25 }}>
                          <Typography fontWeight={700} fontSize={13} noWrap>{lead.name}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap fontSize={11}>
                            {lead.company || lead.email}
                          </Typography>
                          <Stack direction="row" spacing={0.5} mt={0.75} flexWrap="wrap" useFlexGap>
                            {lead.dealValue && (
                              <Chip
                                size="small"
                                icon={<CurrencyRupeeIcon sx={{ fontSize: '10px !important' }} />}
                                label={fmtCurrency(lead.dealValue)}
                                sx={{ height: 18, fontSize: 10, fontWeight: 600, bgcolor: '#E8F5E9', color: '#2E7D32' }}
                              />
                            )}
                            {lead.followUpAt && new Date(lead.followUpAt) >= new Date() && (
                              <Chip
                                size="small"
                                icon={<EventIcon sx={{ fontSize: '10px !important' }} />}
                                label={fmtDate(lead.followUpAt)}
                                sx={{ height: 18, fontSize: 10, bgcolor: '#FFF3E0', color: '#E65100' }}
                              />
                            )}
                            {lead.assignedToName && (
                              <Chip
                                size="small"
                                label={lead.assignedToName.split(' ')[0]}
                                sx={{ height: 18, fontSize: 10, bgcolor: '#F3E5F5', color: '#7B1FA2' }}
                              />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.disabled" fontSize={10} display="block" mt={0.5}>
                            {timeAgo(lead.createdAt)}
                          </Typography>
                        </Box>
                      </Card>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* LIST VIEW */}
      {view === 'list' && (
        <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {isLoading ? (
            <LinearProgress />
          ) : filtered.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <ContactMailIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1.5 }} />
              <Typography variant="h6" color="text.secondary" fontWeight={600}>No leads found</Typography>
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" component={Paper} elevation={0}>
                <TableHead>
                  <TableRow>
                    {['Contact', 'Company', 'Stage', 'Deal Value', 'Follow-Up', 'Assigned', 'Date', ''].map(h => (
                      <TableCell
                        key={h}
                        sx={{
                          fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                          letterSpacing: 0.8, color: 'text.secondary', bgcolor: 'grey.50',
                          borderBottom: '2px solid', borderColor: 'divider',
                        }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((lead, idx) => {
                    const stage = stageOf(lead);
                    return (
                      <TableRow
                        key={lead.id}
                        hover
                        onClick={() => openDrawer(lead)}
                        sx={{
                          cursor: 'pointer',
                          '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
                          animation: `fadeIn 0.2s ease ${(idx % 25) * 0.02}s both`,
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: stage.color, fontSize: 13, fontWeight: 700 }}>
                              {lead.name[0]?.toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography fontSize={13} fontWeight={700}>{lead.name}</Typography>
                              <Typography fontSize={11} color="text.secondary">{lead.email}</Typography>
                              {lead.phone && (
                                <Typography fontSize={11} color="text.secondary">{lead.phone}</Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography fontSize={12}>{lead.company || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={`${stage.icon} ${stage.label}`}
                            sx={{ bgcolor: stage.bg, color: stage.color, fontWeight: 700, fontSize: 11, height: 22 }}
                          />
                        </TableCell>
                        <TableCell>
                          {lead.dealValue ? (
                            <Typography fontSize={12} fontWeight={600} color="#2E7D32">{fmtCurrency(lead.dealValue)}</Typography>
                          ) : (
                            <Typography fontSize={12} color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.followUpAt ? (
                            <Typography
                              fontSize={11}
                              color={new Date(lead.followUpAt) < new Date() ? '#B71C1C' : 'text.secondary'}
                            >
                              {fmtDate(lead.followUpAt)}
                            </Typography>
                          ) : (
                            <Typography fontSize={12} color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography fontSize={12}>{lead.assignedToName || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography fontSize={11} color="text.secondary" whiteSpace="nowrap">
                            {fmtDate(lead.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => setDeleteTarget(lead)}
                              sx={{ color: '#C62828', '&:hover': { bgcolor: '#FFEBEE' } }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </Card>
      )}

      {/* LEAD DETAIL DRAWER */}
      <Drawer
        anchor="right"
        open={!!drawerLead}
        onClose={() => setDrawerLead(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, display: 'flex', flexDirection: 'column' } }}
      >
        {drawerLead && (() => {
          const stage = stageOf(drawerLead);
          const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === drawerLead.pipelineStage);
          return (
            <>
              {/* Drawer header */}
              <Box sx={{ p: 2.5, bgcolor: stage.bg, borderBottom: '1px solid #E0E0E0' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ width: 44, height: 44, bgcolor: stage.color, fontSize: 18, fontWeight: 700 }}>
                      {drawerLead.name[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography fontWeight={800} fontSize={16}>{drawerLead.name}</Typography>
                      <Typography fontSize={12} color="text.secondary">{drawerLead.company || drawerLead.email}</Typography>
                    </Box>
                  </Stack>
                  <IconButton size="small" onClick={() => setDrawerLead(null)}><CloseIcon /></IconButton>
                </Stack>

                {/* Stage progress bar */}
                <Stack direction="row" spacing={0.5} mt={2} alignItems="center">
                  <Tooltip title="Move back">
                    <span>
                      <IconButton
                        size="small"
                        disabled={stageIdx <= 0}
                        onClick={() => moveStage(drawerLead, 'back')}
                        sx={{ color: stage.color }}
                      >
                        <ArrowBackIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {PIPELINE_STAGES.map((s, i) => (
                    <Tooltip key={s.key} title={s.label}>
                      <Box
                        onClick={() => updateMutation.mutate({ id: drawerLead.id, pipelineStage: s.key })}
                        sx={{
                          flex: 1, height: 6, borderRadius: 3, cursor: 'pointer',
                          bgcolor: i <= stageIdx ? s.color : '#E0E0E0',
                          transition: 'all 0.2s', '&:hover': { opacity: 0.8 },
                        }}
                      />
                    </Tooltip>
                  ))}
                  <Tooltip title="Move forward">
                    <span>
                      <IconButton
                        size="small"
                        disabled={stageIdx >= PIPELINE_STAGES.length - 1}
                        onClick={() => moveStage(drawerLead, 'forward')}
                        sx={{ color: stage.color }}
                      >
                        <ArrowForwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                <Typography fontSize={11} color={stage.color} fontWeight={600} textAlign="center" mt={0.5}>
                  {stage.icon} {stage.label}
                </Typography>
              </Box>

              {/* Tabs */}
              <Tabs
                value={drawerTab}
                onChange={(_, v) => setDrawerTab(v)}
                sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
              >
                <Tab label="Details" />
                <Tab label={`Activity (${activities.length})`} />
              </Tabs>

              {/* Tab content */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
                {drawerTab === 0 && (
                  <Stack spacing={2.5}>
                    {/* Contact info */}
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.8}>
                        Contact Info
                      </Typography>
                      <Stack spacing={1} mt={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <EmailIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                          <Typography fontSize={13}>{drawerLead.email}</Typography>
                        </Stack>
                        {drawerLead.phone && (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <PhoneIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                            <Typography fontSize={13}>{drawerLead.phone}</Typography>
                          </Stack>
                        )}
                        {drawerLead.company && (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <BusinessIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                            <Typography fontSize={13}>{drawerLead.company}</Typography>
                          </Stack>
                        )}
                      </Stack>
                    </Box>

                    {/* Original message */}
                    {drawerLead.message && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.8}>
                          Original Message
                        </Typography>
                        <Box sx={{
                          mt: 1, p: 1.5, bgcolor: 'grey.50', borderRadius: 1.5, fontSize: 13,
                          color: 'text.secondary', borderLeft: '3px solid #E0E0E0', fontStyle: 'italic',
                        }}>
                          {drawerLead.message}
                        </Box>
                      </Box>
                    )}

                    <Divider />

                    {/* Editable fields */}
                    {editingDetails ? (
                      <Stack spacing={2}>
                        <TextField
                          label="Deal Value (₹)"
                          size="small"
                          value={editDeal}
                          onChange={e => setEditDeal(e.target.value)}
                          type="number"
                          slotProps={{
                            input: {
                              startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                            },
                          }}
                        />
                        <TextField
                          label="Follow-up Date"
                          size="small"
                          type="date"
                          value={editFollowUp}
                          onChange={e => setEditFollowUp(e.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <TextField
                          label="Assigned To"
                          size="small"
                          value={editAssigned}
                          onChange={e => setEditAssigned(e.target.value)}
                          placeholder="Sales rep name"
                        />
                        <TextField
                          label="Tags (comma-separated)"
                          size="small"
                          value={editTags}
                          onChange={e => setEditTags(e.target.value)}
                          placeholder="ISP, Enterprise, Hot"
                        />
                        <TextField
                          label="Notes"
                          multiline
                          rows={3}
                          size="small"
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
                          placeholder="Internal notes…"
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={saveDetails}
                            disabled={updateMutation.isPending}
                            sx={{ bgcolor: '#7B1FA2', '&:hover': { bgcolor: '#6A1B9A' } }}
                          >
                            Save
                          </Button>
                          <Button size="small" onClick={() => setEditingDetails(false)}>Cancel</Button>
                        </Stack>
                      </Stack>
                    ) : (
                      <Stack spacing={1.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" fontWeight={700} textTransform="uppercase" letterSpacing={0.8} color="text.secondary">
                            Deal Details
                          </Typography>
                          <Button
                            size="small"
                            startIcon={<EditIcon sx={{ fontSize: '14px !important' }} />}
                            onClick={() => setEditingDetails(true)}
                            sx={{ fontSize: 11 }}
                          >
                            Edit
                          </Button>
                        </Stack>
                        <Grid container spacing={1.5}>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#E8F5E9', borderRadius: 1.5 }}>
                              <Typography fontSize={11} color="text.secondary" fontWeight={600}>Deal Value</Typography>
                              <Typography fontSize={14} fontWeight={700} color="#2E7D32">
                                {fmtCurrency(drawerLead.dealValue) ?? '—'}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#FFF3E0', borderRadius: 1.5 }}>
                              <Typography fontSize={11} color="text.secondary" fontWeight={600}>Follow-Up</Typography>
                              <Typography
                                fontSize={13}
                                fontWeight={600}
                                color={drawerLead.followUpAt && new Date(drawerLead.followUpAt) < new Date() ? '#B71C1C' : '#E65100'}
                              >
                                {fmtDate(drawerLead.followUpAt)}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#F3E5F5', borderRadius: 1.5 }}>
                              <Typography fontSize={11} color="text.secondary" fontWeight={600}>Assigned To</Typography>
                              <Typography fontSize={13} fontWeight={600}>{drawerLead.assignedToName || '—'}</Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#E3F2FD', borderRadius: 1.5 }}>
                              <Typography fontSize={11} color="text.secondary" fontWeight={600}>Source</Typography>
                              <Typography fontSize={13} fontWeight={600}>{drawerLead.source || '—'}</Typography>
                            </Box>
                          </Grid>
                        </Grid>

                        {/* Tags */}
                        {drawerLead.tags && drawerLead.tags.length > 0 && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>Tags</Typography>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={0.5} useFlexGap>
                              {drawerLead.tags.map(tag => (
                                <Chip
                                  key={tag}
                                  size="small"
                                  label={tag}
                                  icon={<LabelIcon sx={{ fontSize: '12px !important' }} />}
                                  sx={{ height: 22, fontSize: 11, bgcolor: '#F3E5F5', color: '#7B1FA2' }}
                                />
                              ))}
                            </Stack>
                          </Box>
                        )}

                        {/* Notes */}
                        {drawerLead.notes && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>Notes</Typography>
                            <Box sx={{ mt: 0.5, p: 1.25, bgcolor: 'grey.50', borderRadius: 1.5, fontSize: 13, color: 'text.secondary' }}>
                              {drawerLead.notes}
                            </Box>
                          </Box>
                        )}
                      </Stack>
                    )}

                    <Divider />

                    {/* Meta */}
                    <Stack direction="row" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                      <Box>
                        <Typography variant="caption" color="text.disabled">Created</Typography>
                        <Typography fontSize={12} fontWeight={600}>{fmtDate(drawerLead.createdAt)}</Typography>
                      </Box>
                      {drawerLead.ipAddress && (
                        <Box>
                          <Typography variant="caption" color="text.disabled">IP</Typography>
                          <Typography fontSize={12} fontFamily="monospace">{drawerLead.ipAddress}</Typography>
                        </Box>
                      )}
                    </Stack>

                    {/* Danger zone */}
                    <Box sx={{ pt: 1, borderTop: '1px dashed #FFCDD2' }}>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => setDeleteTarget(drawerLead)}
                      >
                        Delete Lead
                      </Button>
                    </Box>
                  </Stack>
                )}

                {/* ACTIVITY TAB */}
                {drawerTab === 1 && (
                  <Stack spacing={2}>
                    {/* Add activity form */}
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid #E0E0E0' }}>
                      <Typography fontWeight={700} fontSize={13} mb={1.5}>Log Activity</Typography>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1}>
                          {ACTIVITY_TYPES.map(at => (
                            <Tooltip key={at.key} title={at.label}>
                              <IconButton
                                size="small"
                                onClick={() => setActType(at.key)}
                                sx={{
                                  bgcolor: actType === at.key ? at.color : 'transparent',
                                  color: actType === at.key ? '#fff' : at.color,
                                  border: `1px solid ${at.color}`, borderRadius: 1,
                                  '&:hover': { bgcolor: at.color, color: '#fff' },
                                }}
                              >
                                {at.icon}
                              </IconButton>
                            </Tooltip>
                          ))}
                        </Stack>
                        <TextField
                          size="small"
                          label="Title"
                          value={actTitle}
                          onChange={e => setActTitle(e.target.value)}
                          placeholder={
                            actType === 'CALL' ? 'Called about pricing'
                              : actType === 'EMAIL' ? 'Sent proposal email'
                                : 'Add a note…'
                          }
                        />
                        <TextField
                          size="small"
                          label="Description"
                          multiline
                          rows={2}
                          value={actDesc}
                          onChange={e => setActDesc(e.target.value)}
                        />
                        {(actType === 'CALL' || actType === 'MEETING') && (
                          <FormControl size="small">
                            <InputLabel>Outcome</InputLabel>
                            <Select value={actOutcome} label="Outcome" onChange={e => setActOutcome(e.target.value)}>
                              <MenuItem value="">—</MenuItem>
                              <MenuItem value="COMPLETED">Completed</MenuItem>
                              <MenuItem value="NO_ANSWER">No Answer</MenuItem>
                              <MenuItem value="RESCHEDULED">Rescheduled</MenuItem>
                              <MenuItem value="LEFT_MESSAGE">Left Message</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<AddIcon />}
                          disabled={addActivityMutation.isPending}
                          onClick={() => drawerLead && addActivityMutation.mutate({
                            leadId: drawerLead.id, type: actType,
                            title: actTitle, description: actDesc, outcome: actOutcome,
                          })}
                          sx={{ bgcolor: '#7B1FA2', '&:hover': { bgcolor: '#6A1B9A' }, alignSelf: 'flex-start' }}
                        >
                          Log Activity
                        </Button>
                      </Stack>
                    </Box>

                    {/* Activity timeline */}
                    {activities.length === 0 ? (
                      <Typography color="text.disabled" fontSize={13} textAlign="center" py={2}>
                        No activities yet
                      </Typography>
                    ) : activities.map(act => {
                      const at = actTypeOf(act.type);
                      return (
                        <Stack key={act.id} direction="row" spacing={1.5} alignItems="flex-start">
                          <Box sx={{
                            width: 32, height: 32, borderRadius: '50%',
                            bgcolor: at.color + '22', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: at.color, flexShrink: 0,
                          }}>
                            <Box sx={{ fontSize: 16, display: 'flex' }}>{at.icon}</Box>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                              <Box>
                                <Typography fontSize={13} fontWeight={600}>
                                  {act.title || at.label}
                                  {act.outcome && (
                                    <Chip
                                      size="small"
                                      label={act.outcome}
                                      sx={{ ml: 1, height: 18, fontSize: 10, bgcolor: '#E8F5E9', color: '#2E7D32' }}
                                    />
                                  )}
                                </Typography>
                                {act.description && (
                                  <Typography fontSize={12} color="text.secondary" mt={0.25}>
                                    {act.description}
                                  </Typography>
                                )}
                                <Typography fontSize={11} color="text.disabled" mt={0.25}>
                                  {act.performedByName && `${act.performedByName} · `}{timeAgo(act.performedAt)}
                                </Typography>
                              </Box>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => drawerLead && deleteActivityMutation.mutate({ leadId: drawerLead.id, actId: act.id })}
                                  sx={{ color: '#BDBDBD', '&:hover': { color: '#E53935' } }}
                                >
                                  <DeleteIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Box>
                        </Stack>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            </>
          );
        })()}
      </Drawer>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Delete Lead</DialogTitle>
        <DialogContent>
          <Typography>
            Delete lead from <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email})? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </AnimatedPage>
  );
}
