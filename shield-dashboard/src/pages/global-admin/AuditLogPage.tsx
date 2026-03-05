import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Stack, TextField,
  MenuItem, CircularProgress, Avatar, Button, TablePagination,
  InputAdornment,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import PersonIcon from '@mui/icons-material/Person';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LockIcon from '@mui/icons-material/Lock';
import DnsIcon from '@mui/icons-material/Dns';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import ClearIcon from '@mui/icons-material/Clear';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress: string;
  createdAt: string;
}

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  SERVICE_RESTART: { icon: <RestartAltIcon fontSize="small" />, color: '#FB8C00', label: 'Service Restart' },
  SERVICE_STOP: { icon: <StopCircleIcon fontSize="small" />, color: '#E53935', label: 'Service Stop' },
  SERVICE_START: { icon: <PlayCircleIcon fontSize="small" />, color: '#43A047', label: 'Service Start' },
  PLAN_CREATED: { icon: <AddCircleIcon fontSize="small" />, color: '#7B1FA2', label: 'Plan Created' },
  PLAN_UPDATED: { icon: <EditIcon fontSize="small" />, color: '#1565C0', label: 'Plan Updated' },
  PLAN_DELETED: { icon: <DeleteIcon fontSize="small" />, color: '#C62828', label: 'Plan Deleted' },
  TENANT_UPDATED: { icon: <EditIcon fontSize="small" />, color: '#00897B', label: 'Tenant Updated' },
  USER_UPDATED: { icon: <PersonIcon fontSize="small" />, color: '#5C6BC0', label: 'User Updated' },
  USER_DELETED: { icon: <DeleteIcon fontSize="small" />, color: '#C62828', label: 'User Deleted' },
  USER_LOGIN: { icon: <LoginIcon fontSize="small" />, color: '#2196F3', label: 'User Login' },
  USER_LOGOUT: { icon: <LogoutIcon fontSize="small" />, color: '#607D8B', label: 'User Logout' },
  USER_REGISTERED: { icon: <PersonAddIcon fontSize="small" />, color: '#4CAF50', label: 'User Registered' },
  PASSWORD_CHANGED: { icon: <LockIcon fontSize="small" />, color: '#FF9800', label: 'Password Changed' },
  PROFILE_UPDATED: { icon: <PersonIcon fontSize="small" />, color: '#009688', label: 'Profile Updated' },
  DNS_RULES_UPDATED: { icon: <DnsIcon fontSize="small" />, color: '#00897B', label: 'DNS Rules Updated' },
};

const DEFAULT_CONFIG = { icon: <SettingsIcon fontSize="small" />, color: '#78909C', label: 'Action' };

const FILTER_OPTIONS = [
  { value: '', label: 'All Actions' },
  ...Object.entries(ACTION_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function exportCSV(entries: AuditEntry[]) {
  const headers = ['Timestamp', 'Action', 'User', 'Resource Type', 'Resource ID', 'IP Address', 'Details'];
  const rows = entries.map(e => [
    e.createdAt, e.action, e.userName || '', e.resourceType || '', e.resourceId || '',
    e.ipAddress || '', JSON.stringify(e.details || {}),
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', actionFilter, userSearch, dateFrom, dateTo, page, size],
    queryFn: () => {
      const params = new URLSearchParams({ size: String(size), page: String(page), sort: 'createdAt,desc' });
      if (actionFilter) params.set('action', actionFilter);
      if (dateFrom) params.set('from', new Date(dateFrom).toISOString());
      if (dateTo) params.set('to', new Date(dateTo + 'T23:59:59').toISOString());
      return api.get(`/admin/audit-logs?${params}`).then(r => {
        const d = r.data?.data || r.data;
        return { content: (d?.content ?? d) as AuditEntry[], totalElements: d?.totalElements ?? 0 };
      }).catch(() => ({ content: [], totalElements: 0 }));
    },
  });

  const entries = data?.content || [];
  const total = data?.totalElements || 0;

  // Client-side user name filter (backend doesn't support userName search)
  const filtered = userSearch
    ? entries.filter(e => e.userName?.toLowerCase().includes(userSearch.toLowerCase()))
    : entries;

  const hasFilters = actionFilter || userSearch || dateFrom || dateTo;
  const clearFilters = () => { setActionFilter(''); setUserSearch(''); setDateFrom(''); setDateTo(''); setPage(0); };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<HistoryIcon />}
        title="Audit Log"
        subtitle={`${total} event${total !== 1 ? 's' : ''} tracked`}
        iconColor="#5C6BC0"
        action={
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
            onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}
            sx={{ borderRadius: 2 }}>
            Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center" useFlexGap>
            <TextField select size="small" value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(0); }}
              label="Action" sx={{ minWidth: 180 }}>
              {FILTER_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField size="small" placeholder="Filter by user..." value={userSearch}
              onChange={e => setUserSearch(e.target.value)} label="User"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ minWidth: 180 }} />
            <TextField size="small" type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(0); }}
              label="From" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(0); }}
              label="To" slotProps={{ inputLabel: { shrink: true } }} />
            {hasFilters && (
              <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters}
                sx={{ color: '#78909C' }}>Clear</Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <HistoryIcon sx={{ fontSize: 48, color: '#BDBDBD', mb: 1 }} />
            <Typography color="text.secondary">No audit entries found</Typography>
            {hasFilters && <Typography variant="caption" color="text.secondary">Try adjusting your filters</Typography>}
          </CardContent>
        </Card>
      ) : (
        <>
          <Box sx={{ position: 'relative', pl: 3 }}>
            <Box sx={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, bgcolor: '#E0E0E0', borderRadius: 1 }} />
            {filtered.map((entry, idx) => {
              const cfg = ACTION_CONFIG[entry.action] || DEFAULT_CONFIG;
              return (
                <Box key={entry.id} sx={{
                  position: 'relative', mb: 2,
                  '@keyframes fadeInLeft': { from: { opacity: 0, transform: 'translateX(-10px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
                  animation: `fadeInLeft 0.3s ease ${idx * 0.03}s both`,
                }}>
                  <Box sx={{
                    position: 'absolute', left: -3, top: 16,
                    width: 24, height: 24, borderRadius: '50%',
                    bgcolor: cfg.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1, boxShadow: `0 0 0 4px ${cfg.color}20`,
                  }}>
                    {cfg.icon}
                  </Box>
                  <Card sx={{ ml: 3, transition: 'all 0.2s ease', '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.08)' } }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Chip size="small" label={cfg.label} sx={{ bgcolor: `${cfg.color}15`, color: cfg.color, fontWeight: 600, fontSize: 11 }} />
                          <Typography variant="body2">
                            {entry.resourceType && <strong>{entry.resourceType}</strong>}
                            {entry.resourceId && <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace', ml: 0.5, color: 'text.secondary' }}>{entry.resourceId.substring(0, 8)}...</Typography>}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {entry.userName && (
                            <Chip size="small" avatar={<Avatar sx={{ width: 20, height: 20, fontSize: 10 }}>{entry.userName?.[0]?.toUpperCase()}</Avatar>}
                              label={entry.userName} sx={{ height: 24, fontSize: 11 }} />
                          )}
                          {entry.ipAddress && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{entry.ipAddress}</Typography>
                          )}
                          <Typography variant="caption" color="text.secondary" title={formatDate(entry.createdAt)}>
                            {timeAgo(entry.createdAt)}
                          </Typography>
                        </Stack>
                      </Box>
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <Box sx={{ mt: 0.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {Object.entries(entry.details).map(([k, v]) => (
                            <Chip key={k} size="small" variant="outlined" label={`${k}: ${v}`} sx={{ height: 20, fontSize: 10 }} />
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              );
            })}
          </Box>
          <TablePagination
            component="div" count={total} page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={size}
            onRowsPerPageChange={e => { setSize(+e.target.value); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </>
      )}
    </AnimatedPage>
  );
}
