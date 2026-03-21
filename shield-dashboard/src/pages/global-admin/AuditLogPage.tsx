import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Chip, Stack, TextField,
  MenuItem, CircularProgress, Avatar, Button, TablePagination,
  InputAdornment, Collapse, IconButton, Tooltip, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper,
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
import BusinessIcon from '@mui/icons-material/Business';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import BlockIcon from '@mui/icons-material/Block';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RefreshIcon from '@mui/icons-material/Refresh';
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
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  SERVICE_RESTART: { icon: <RestartAltIcon sx={{ fontSize: 14 }} />, color: '#E65100', bg: '#FFF3E0', label: 'Service Restart' },
  SERVICE_STOP:    { icon: <StopCircleIcon sx={{ fontSize: 14 }} />,  color: '#C62828', bg: '#FFEBEE', label: 'Service Stop' },
  SERVICE_START:   { icon: <PlayCircleIcon sx={{ fontSize: 14 }} />,  color: '#2E7D32', bg: '#E8F5E9', label: 'Service Start' },
  PLAN_CREATED:    { icon: <AddCircleIcon sx={{ fontSize: 14 }} />,   color: '#6A1B9A', bg: '#F3E5F5', label: 'Plan Created' },
  PLAN_UPDATED:    { icon: <EditIcon sx={{ fontSize: 14 }} />,        color: '#1565C0', bg: '#E3F2FD', label: 'Plan Updated' },
  PLAN_DELETED:    { icon: <DeleteIcon sx={{ fontSize: 14 }} />,      color: '#C62828', bg: '#FFEBEE', label: 'Plan Deleted' },
  TENANT_CREATED:  { icon: <BusinessIcon sx={{ fontSize: 14 }} />,    color: '#00695C', bg: '#E0F2F1', label: 'Tenant Created' },
  TENANT_UPDATED:  { icon: <EditIcon sx={{ fontSize: 14 }} />,        color: '#00838F', bg: '#E0F7FA', label: 'Tenant Updated' },
  TENANT_DELETED:  { icon: <DeleteIcon sx={{ fontSize: 14 }} />,      color: '#C62828', bg: '#FFEBEE', label: 'Tenant Deleted' },
  USER_CREATED:    { icon: <PersonAddIcon sx={{ fontSize: 14 }} />,   color: '#2E7D32', bg: '#E8F5E9', label: 'User Created' },
  USER_UPDATED:    { icon: <PersonIcon sx={{ fontSize: 14 }} />,      color: '#5C6BC0', bg: '#E8EAF6', label: 'User Updated' },
  USER_DELETED:    { icon: <DeleteIcon sx={{ fontSize: 14 }} />,      color: '#C62828', bg: '#FFEBEE', label: 'User Deleted' },
  USER_LOGIN:      { icon: <LoginIcon sx={{ fontSize: 14 }} />,       color: '#1565C0', bg: '#E3F2FD', label: 'Login' },
  USER_LOGOUT:     { icon: <LogoutIcon sx={{ fontSize: 14 }} />,      color: '#546E7A', bg: '#ECEFF1', label: 'Logout' },
  USER_REGISTERED: { icon: <PersonAddIcon sx={{ fontSize: 14 }} />,   color: '#388E3C', bg: '#F1F8E9', label: 'Registered' },
  USER_SUSPENDED:  { icon: <BlockIcon sx={{ fontSize: 14 }} />,       color: '#C62828', bg: '#FFEBEE', label: 'User Suspended' },
  PASSWORD_CHANGED:{ icon: <LockIcon sx={{ fontSize: 14 }} />,        color: '#E65100', bg: '#FFF3E0', label: 'Password Changed' },
  PASSWORD_RESET:  { icon: <LockIcon sx={{ fontSize: 14 }} />,        color: '#BF360C', bg: '#FBE9E7', label: 'Password Reset' },
  PROFILE_UPDATED: { icon: <PersonIcon sx={{ fontSize: 14 }} />,      color: '#00695C', bg: '#E0F2F1', label: 'Profile Updated' },
  DNS_RULES_UPDATED:          { icon: <DnsIcon sx={{ fontSize: 14 }} />,            color: '#00897B', bg: '#E0F2F1', label: 'DNS Rules Updated' },
  SUBSCRIPTION_CREATED:       { icon: <CardMembershipIcon sx={{ fontSize: 14 }} />, color: '#6A1B9A', bg: '#F3E5F5', label: 'Subscription Created' },
  SUBSCRIPTION_UPDATED:       { icon: <CardMembershipIcon sx={{ fontSize: 14 }} />, color: '#1565C0', bg: '#E3F2FD', label: 'Subscription Updated' },
  SUBSCRIPTION_CANCELLED:     { icon: <CardMembershipIcon sx={{ fontSize: 14 }} />, color: '#C62828', bg: '#FFEBEE', label: 'Subscription Cancelled' },
  SETTINGS_UPDATED:           { icon: <SettingsIcon sx={{ fontSize: 14 }} />,       color: '#546E7A', bg: '#ECEFF1', label: 'Settings Updated' },
  BLOCKLIST_UPDATED:          { icon: <BlockIcon sx={{ fontSize: 14 }} />,          color: '#BF360C', bg: '#FBE9E7', label: 'Blocklist Updated' },
  GLOBAL_BLOCKLIST_ADD:       { icon: <BlockIcon sx={{ fontSize: 14 }} />,          color: '#BF360C', bg: '#FBE9E7', label: 'Blocklist Added' },
  GLOBAL_BLOCKLIST_REMOVE:    { icon: <BlockIcon sx={{ fontSize: 14 }} />,          color: '#546E7A', bg: '#ECEFF1', label: 'Blocklist Removed' },
  EMERGENCY_BLOCK:            { icon: <BlockIcon sx={{ fontSize: 14 }} />,          color: '#B71C1C', bg: '#FFCDD2', label: 'Emergency Block' },
};

const DEFAULT_CONFIG = { icon: <SettingsIcon sx={{ fontSize: 14 }} />, color: '#78909C', bg: '#ECEFF1', label: 'Action' };

const FILTER_OPTIONS = [
  { value: '', label: 'All Actions' },
  ...Object.entries(ACTION_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

function formatIp(ip: string): string {
  if (!ip) return '—';
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function exportCSV(entries: AuditEntry[]) {
  const headers = ['Timestamp', 'Action', 'User', 'Resource Type', 'Resource ID', 'IP Address', 'Details'];
  const rows = entries.map(e => [
    e.createdAt, e.action, e.userName || '', e.resourceType || '', e.resourceId || '',
    e.ipAddress || '', JSON.stringify(e.details || {}),
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function ExpandableDetails({ details }: { details: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(details);
  if (entries.length === 0) return <Typography variant="caption" color="text.disabled">—</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {entries.slice(0, 2).map(([k, v]) => (
          <Chip key={k} size="small" variant="outlined" label={`${k}: ${String(v).substring(0, 30)}`}
            sx={{ height: 20, fontSize: 10, fontFamily: 'monospace', maxWidth: 200, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }} />
        ))}
        {entries.length > 2 && (
          <Chip size="small" label={open ? 'Show less' : `+${entries.length - 2} more`}
            onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
            icon={open ? <KeyboardArrowUpIcon style={{ fontSize: 12 }} /> : <KeyboardArrowDownIcon style={{ fontSize: 12 }} />}
            sx={{ height: 20, fontSize: 10, cursor: 'pointer', bgcolor: '#EDE7F6', color: '#4A148C', border: 'none' }} />
        )}
      </Box>
      <Collapse in={open}>
        <Box sx={{ mt: 1, bgcolor: 'grey.50', borderRadius: 1, p: 1.5, fontFamily: 'monospace', fontSize: 11, overflowX: 'auto' }}>
          {entries.map(([k, v]) => (
            <Box key={k} sx={{ mb: 0.25, display: 'flex', gap: 0.5 }}>
              <Typography component="span" sx={{ fontWeight: 700, color: '#6A1B9A', fontSize: 11, flexShrink: 0 }}>{k}:</Typography>
              <Typography component="span" sx={{ fontSize: 11, wordBreak: 'break-all', color: 'text.secondary' }}>{String(v)}</Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function AuditRow({ entry, idx }: { entry: AuditEntry; idx: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = ACTION_CONFIG[entry.action] || DEFAULT_CONFIG;
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;

  return (
    <>
      <TableRow
        hover
        onClick={() => hasDetails && setExpanded(e => !e)}
        sx={{
          cursor: hasDetails ? 'pointer' : 'default',
          '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
          animation: `fadeIn 0.2s ease ${(idx % 20) * 0.02}s both`,
          '& td': { borderBottom: expanded ? 'none' : undefined },
          bgcolor: expanded ? 'rgba(92,107,192,0.03)' : undefined,
        }}
      >
        {/* Timestamp */}
        <TableCell sx={{ whiteSpace: 'nowrap', width: 150 }}>
          <Tooltip title={formatDate(entry.createdAt)}>
            <Box>
              <Typography variant="body2" fontSize={12} fontWeight={600} color="text.primary">
                {timeAgo(entry.createdAt)}
              </Typography>
              <Typography variant="caption" color="text.disabled" fontSize={10}>
                {new Date(entry.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Box>
          </Tooltip>
        </TableCell>

        {/* Action */}
        <TableCell sx={{ width: 180 }}>
          <Chip
            size="small"
            icon={<Box sx={{ display: 'flex', alignItems: 'center', color: cfg.color, ml: '6px !important' }}>{cfg.icon}</Box>}
            label={cfg.label}
            sx={{
              bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 11, height: 24,
              border: `1px solid ${cfg.color}30`,
              '& .MuiChip-icon': { color: cfg.color },
            }}
          />
        </TableCell>

        {/* User */}
        <TableCell sx={{ width: 160 }}>
          {entry.userName ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: '#5C6BC0' }}>
                {entry.userName[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="body2" fontSize={12} noWrap sx={{ maxWidth: 110 }}>
                {entry.userName}
              </Typography>
            </Box>
          ) : <Typography variant="caption" color="text.disabled">System</Typography>}
        </TableCell>

        {/* Resource */}
        <TableCell>
          {entry.resourceType ? (
            <Box>
              <Typography variant="body2" fontSize={12} fontWeight={600}>{entry.resourceType}</Typography>
              {entry.resourceId && (
                <Typography variant="caption" color="text.secondary" fontFamily="monospace" fontSize={10}>
                  #{entry.resourceId.substring(0, 8)}…
                </Typography>
              )}
            </Box>
          ) : <Typography variant="caption" color="text.disabled">—</Typography>}
        </TableCell>

        {/* IP */}
        <TableCell sx={{ width: 120 }}>
          <Typography variant="caption" fontFamily="monospace" color="text.secondary" fontSize={11}>
            {formatIp(entry.ipAddress)}
          </Typography>
        </TableCell>

        {/* Expand indicator */}
        <TableCell sx={{ width: 36, pr: 1 }}>
          {hasDetails && (
            <IconButton size="small" sx={{ p: 0.25 }}>
              {expanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded details row */}
      {hasDetails && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: 0, border: expanded ? undefined : 'none !important', bgcolor: 'rgba(92,107,192,0.03)' }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box sx={{ py: 1.5, px: 2 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10, mb: 1, display: 'block' }}>
                  Event Details
                </Typography>
                <ExpandableDetails details={entry.details} />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit-logs', actionFilter, dateFrom, dateTo, page, size],
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
    refetchInterval: autoRefresh ? 60000 : false,
    staleTime: 30000,
  });

  const handleAutoRefreshToggle = useCallback((enabled: boolean) => {
    setAutoRefresh(enabled);
    if (enabled) refetch();
  }, [refetch]);

  useEffect(() => { setPage(0); }, [actionFilter, dateFrom, dateTo]);

  const allEntries = data?.content || [];
  const total = data?.totalElements || 0;

  const filtered = userSearch
    ? allEntries.filter(e => e.userName?.toLowerCase().includes(userSearch.toLowerCase()))
    : allEntries;

  const hasFilters = actionFilter || userSearch || dateFrom || dateTo;
  const clearFilters = () => { setActionFilter(''); setUserSearch(''); setDateFrom(''); setDateTo(''); };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<HistoryIcon />}
        title="Audit Log"
        subtitle={`${total.toLocaleString()} event${total !== 1 ? 's' : ''} tracked`}
        iconColor="#5C6BC0"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={
                <Switch size="small" checked={autoRefresh} onChange={e => handleAutoRefreshToggle(e.target.checked)}
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#5C6BC0' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#5C6BC0' } }}
                />
              }
              label={<Typography variant="caption" color="text.secondary">Live</Typography>}
              sx={{ mr: 0 }}
            />
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => refetch()} disabled={isFetching}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <RefreshIcon fontSize="small" sx={{ animation: isFetching ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
              </IconButton>
            </Tooltip>
            <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
              onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}
              sx={{ borderRadius: 2 }}>
              Export
            </Button>
          </Stack>
        }
      />

      {/* Filters */}
      <Card sx={{ mb: 2.5, borderRadius: 2 }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center" useFlexGap>
            <TextField select size="small" value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              label="Action Type" sx={{ minWidth: 200 }}>
              {FILTER_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>

            <TextField size="small" placeholder="Search user..." value={userSearch}
              onChange={e => setUserSearch(e.target.value)} label="User"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ minWidth: 170 }} />

            <TextField size="small" type="date" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)} label="From"
              slotProps={{ inputLabel: { shrink: true } }} />

            <TextField size="small" type="date" value={dateTo}
              onChange={e => setDateTo(e.target.value)} label="To"
              slotProps={{ inputLabel: { shrink: true } }} />

            {hasFilters && (
              <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters}
                sx={{ color: 'text.secondary' }}>Clear</Button>
            )}

            {autoRefresh && (
              <Chip size="small" icon={<RefreshIcon style={{ fontSize: 12 }} />}
                label="Auto-refreshing every 30s"
                sx={{ bgcolor: '#E8EAF6', color: '#3949AB', fontWeight: 600, fontSize: 11 }} />
            )}
          </Stack>
        </Box>
      </Card>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Card sx={{ borderRadius: 2 }}>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <HistoryIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="h6" color="text.secondary" fontWeight={600}>No audit entries found</Typography>
            {hasFilters && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Try adjusting or clearing your filters
              </Typography>
            )}
          </Box>
        </Card>
      ) : (
        <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer component={Paper} elevation={0}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Time', 'Action', 'User', 'Resource', 'IP Address', ''].map((h, i) => (
                    <TableCell key={i} sx={{
                      fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                      letterSpacing: 0.8, color: 'text.secondary', bgcolor: 'grey.50',
                      borderBottom: '2px solid', borderColor: 'divider',
                      ...(h === '' ? { width: 36 } : {}),
                    }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((entry, idx) => (
                  <AuditRow key={entry.id} entry={entry} idx={idx} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={size}
            onRowsPerPageChange={e => { setSize(+e.target.value); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          />
        </Card>
      )}
    </AnimatedPage>
  );
}
