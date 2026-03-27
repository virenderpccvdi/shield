import {
  Box, Typography, Card, CardContent, Button, ToggleButton,
  ToggleButtonGroup, Stack, Alert, CircularProgress, Snackbar,
  Grid, TextField, Divider, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import StorageIcon from '@mui/icons-material/Storage';
import PeopleIcon from '@mui/icons-material/People';
import CategoryIcon from '@mui/icons-material/Category';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import HistoryIcon from '@mui/icons-material/History';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { alpha, useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import api from '../../api/axios';

type Period = 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_3_MONTHS' | 'ALL_TIME';
type Format = 'CSV' | 'JSON';

interface ExportRecord {
  id: string;
  type: string;
  format: string;
  period: string;
  rows: number;
  timestamp: string;
  status: 'success' | 'error';
}

const PERIOD_LABELS: Record<Period, string> = {
  THIS_WEEK: 'This Week',
  THIS_MONTH: 'This Month',
  LAST_3_MONTHS: 'Last 3 Months',
  ALL_TIME: 'All Time',
};

function todayStr() { return new Date().toISOString().split('T')[0]; }
function thirtyDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
}

function loadHistory(): ExportRecord[] {
  try { return JSON.parse(localStorage.getItem('shield_export_history') ?? '[]'); } catch { return []; }
}

function saveHistory(records: ExportRecord[]) {
  localStorage.setItem('shield_export_history', JSON.stringify(records.slice(0, 20)));
}

function addHistoryRecord(record: Omit<ExportRecord, 'id'>) {
  const records = loadHistory();
  records.unshift({ ...record, id: Date.now().toString() });
  saveHistory(records);
}

export default function AnalyticsExportPage() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const tenantId = user?.tenantId ?? '';

  // DNS export
  const [dnsPeriod, setDnsPeriod] = useState<Period>('THIS_MONTH');
  const [dnsFormat, setDnsFormat] = useState<Format>('CSV');
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsError, setDnsError] = useState('');

  // Customer export
  const [custFormat, setCustFormat] = useState<Format>('CSV');
  const [custLoading, setCustLoading] = useState(false);
  const [custError, setCustError] = useState('');

  // Custom date range export
  const [startDate, setStartDate] = useState(thirtyDaysAgo());
  const [endDate, setEndDate] = useState(todayStr());
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState('');

  // Category report export
  const [catLoading, setCatLoading] = useState(false);

  // PDF report
  const [pdfLoading, setPdfLoading] = useState(false);

  const [snack, setSnack] = useState('');
  const [history, setHistory] = useState<ExportRecord[]>(loadHistory);

  const tid = tenantId || localStorage.getItem('shield_tenant_id') || '';
  const token = accessToken ?? localStorage.getItem('shield_token') ?? '';

  // Pre-fetch overview to estimate row counts
  const { data: overview } = useQuery({
    queryKey: ['export-overview', tid],
    queryFn: async () => {
      const r = await api.get(`/analytics/tenant/${tid}/overview?period=month`);
      return r.data?.data ?? r.data;
    },
    enabled: !!tid,
    staleTime: 60_000,
  });

  const { data: catData } = useQuery({
    queryKey: ['export-categories', tid],
    queryFn: async () => {
      const r = await api.get(`/analytics/tenant/${tid}/categories?period=month`);
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: !!tid,
    staleTime: 60_000,
  });

  const { data: dailyData } = useQuery({
    queryKey: ['export-daily', tid],
    queryFn: async () => {
      const r = await api.get(`/analytics/tenant/${tid}/daily?days=30`);
      const d = r.data?.data ?? r.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: !!tid,
    staleTime: 60_000,
  });

  async function downloadBlob(url: string, filename: string): Promise<number> {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const text = await response.text();
      let msg = `Export failed (${response.status})`;
      try { const j = JSON.parse(text) as { message?: string }; if (j.message) msg = j.message; } catch { /* */ }
      throw new Error(msg);
    }
    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    URL.revokeObjectURL(a.href); document.body.removeChild(a);
    return blob.size;
  }

  function downloadCSVString(content: string, filename: string): number {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    URL.revokeObjectURL(a.href); document.body.removeChild(a);
    return blob.size;
  }

  const handleDnsDownload = async () => {
    setDnsLoading(true); setDnsError('');
    try {
      const url = `/api/v1/analytics/export/dns?tenantId=${tid}&period=${dnsPeriod}&format=${dnsFormat}`;
      await downloadBlob(url, `shield-dns-${dnsPeriod.toLowerCase()}.${dnsFormat.toLowerCase()}`);
      const rows = overview?.totalQueriesMonth ?? 0;
      addHistoryRecord({ type: 'DNS Statistics', format: dnsFormat, period: PERIOD_LABELS[dnsPeriod], rows, timestamp: new Date().toISOString(), status: 'success' });
      setSnack('DNS statistics downloaded');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Download failed';
      setDnsError(msg);
      addHistoryRecord({ type: 'DNS Statistics', format: dnsFormat, period: PERIOD_LABELS[dnsPeriod], rows: 0, timestamp: new Date().toISOString(), status: 'error' });
    } finally {
      setDnsLoading(false);
      setHistory(loadHistory());
    }
  };

  const handleCustDownload = async () => {
    setCustLoading(true); setCustError('');
    try {
      const url = `/api/v1/analytics/export/customers?tenantId=${tid}&format=${custFormat}`;
      await downloadBlob(url, `shield-customers.${custFormat.toLowerCase()}`);
      addHistoryRecord({ type: 'Customer Summary', format: custFormat, period: 'All Time', rows: 0, timestamp: new Date().toISOString(), status: 'success' });
      setSnack('Customer summary downloaded');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Download failed';
      setCustError(msg);
      addHistoryRecord({ type: 'Customer Summary', format: custFormat, period: 'All Time', rows: 0, timestamp: new Date().toISOString(), status: 'error' });
    } finally {
      setCustLoading(false);
      setHistory(loadHistory());
    }
  };

  const handleCustomDateDownload = async () => {
    setCustomLoading(true); setCustomError('');
    try {
      const url = `/api/v1/analytics/export/dns?tenantId=${tid}&startDate=${startDate}&endDate=${endDate}&format=CSV`;
      await downloadBlob(url, `shield-dns-${startDate}-to-${endDate}.csv`);
      addHistoryRecord({ type: 'Custom Date Range', format: 'CSV', period: `${startDate} → ${endDate}`, rows: 0, timestamp: new Date().toISOString(), status: 'success' });
      setSnack('Custom range exported');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Download failed';
      setCustomError(msg);
    } finally {
      setCustomLoading(false);
      setHistory(loadHistory());
    }
  };

  const handleCategoryExport = () => {
    setCatLoading(true);
    try {
      const cats = Array.isArray(catData) ? catData : [];
      const lines = ['Category,Queries,Blocked,Allowed,BlockRate%'];
      cats.forEach((c: { category: string; count: number; blocked?: number }) => {
        const allowed = c.count - (c.blocked ?? 0);
        const rate = c.count > 0 ? (((c.blocked ?? 0) / c.count) * 100).toFixed(1) : '0';
        lines.push(`"${c.category}",${c.count},${c.blocked ?? 0},${allowed},${rate}`);
      });
      const content = lines.join('\n');
      downloadCSVString(content, 'shield-categories.csv');
      addHistoryRecord({ type: 'Category Report', format: 'CSV', period: 'This Month', rows: cats.length, timestamp: new Date().toISOString(), status: 'success' });
      setSnack('Category report exported');
    } catch {
      setSnack('Category export failed');
    } finally {
      setCatLoading(false);
      setHistory(loadHistory());
    }
  };

  const handleFullReportExport = async () => {
    setPdfLoading(true);
    try {
      // Generate comprehensive multi-section CSV report
      const daily = Array.isArray(dailyData) ? dailyData : [];
      const cats = Array.isArray(catData) ? catData : [];

      const lines: string[] = [];

      lines.push('=== SHIELD ANALYTICS FULL REPORT ===');
      lines.push(`Generated,${new Date().toLocaleString()}`);
      lines.push(`Tenant ID,${tid}`);
      lines.push('');

      lines.push('=== EXECUTIVE SUMMARY ===');
      lines.push(`Total Queries (30d),${overview?.totalQueriesMonth ?? 'N/A'}`);
      lines.push(`Blocked Queries (30d),${overview?.blockedQueriesMonth ?? 'N/A'}`);
      lines.push(`Active Profiles,${overview?.activeProfiles ?? 'N/A'}`);
      lines.push('');

      lines.push('=== DAILY TRENDS (30 DAYS) ===');
      lines.push('Date,TotalQueries,BlockedQueries,AllowedQueries,BlockRate%');
      daily.forEach((d: { date: string; totalQueries: number; blockedQueries: number }) => {
        const allowed = d.totalQueries - d.blockedQueries;
        const rate = d.totalQueries > 0 ? ((d.blockedQueries / d.totalQueries) * 100).toFixed(1) : '0';
        lines.push(`${d.date},${d.totalQueries},${d.blockedQueries},${allowed},${rate}`);
      });
      lines.push('');

      lines.push('=== CATEGORY BREAKDOWN ===');
      lines.push('Category,Queries,Blocked,BlockRate%');
      cats.forEach((c: { category: string; count: number; blocked?: number }) => {
        const rate = c.count > 0 ? (((c.blocked ?? 0) / c.count) * 100).toFixed(1) : '0';
        lines.push(`"${c.category}",${c.count},${c.blocked ?? 0},${rate}`);
      });

      const rows = daily.length + cats.length;
      downloadCSVString(lines.join('\n'), `shield-full-report-${todayStr()}.csv`);
      addHistoryRecord({ type: 'Full Report (CSV)', format: 'CSV', period: 'Last 30 Days', rows, timestamp: new Date().toISOString(), status: 'success' });
      setSnack('Full report exported');
    } catch {
      setSnack('Report export failed');
    } finally {
      setPdfLoading(false);
      setHistory(loadHistory());
    }
  };

  const cardSx = {
    sx: {
      border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
      borderRadius: 3,
      height: '100%',
    },
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<DownloadIcon />}
        title="Analytics Export"
        subtitle="Download DNS statistics, customer data, and reports in multiple formats"
        iconColor="primary.main"
        hero
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>

        {/* DNS Statistics Export */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card {...cardSx}>
            <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: alpha(theme.palette.primary.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'primary.main' }}>
                  <StorageIcon />
                </Box>
                <Box>
                  <Typography fontWeight={700} fontSize={15}>DNS Statistics Export</Typography>
                  <Typography variant="body2" color="text.secondary" fontSize={12}>Query counts, blocked requests, top domains</Typography>
                </Box>
              </Box>

              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: 0.8 }}>Time Period</Typography>
              <ToggleButtonGroup value={dnsPeriod} exclusive onChange={(_, v) => { if (v) setDnsPeriod(v as Period); }} size="small" sx={{ mb: 2.5, flexWrap: 'wrap', gap: 0.5 }}>
                {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                  <ToggleButton key={p} value={p} sx={{ borderRadius: '6px !important', px: 1.5, fontSize: 12, fontWeight: 600, border: `1px solid ${alpha(theme.palette.divider, 0.6)} !important`, '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText', borderColor: 'primary.main !important', '&:hover': { bgcolor: 'primary.dark' } } }}>
                    {PERIOD_LABELS[p]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: 0.8 }}>Format</Typography>
              <ToggleButtonGroup value={dnsFormat} exclusive onChange={(_, v) => { if (v) setDnsFormat(v as Format); }} size="small" sx={{ mb: 2.5 }}>
                {(['CSV', 'JSON'] as Format[]).map((f) => (
                  <ToggleButton key={f} value={f} sx={{ px: 2.5, fontSize: 13, fontWeight: 700, '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } } }}>{f}</ToggleButton>
                ))}
              </ToggleButtonGroup>

              {dnsError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDnsError('')}>{dnsError}</Alert>}

              <Box sx={{ mt: 'auto' }}>
                <Button variant="contained" fullWidth onClick={handleDnsDownload} disabled={dnsLoading} startIcon={dnsLoading ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />} sx={{ fontWeight: 700, borderRadius: 2, py: 1.1 }}>
                  {dnsLoading ? 'Preparing…' : `Download DNS Stats (${dnsFormat})`}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Customer Summary Export */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card {...cardSx}>
            <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: alpha(theme.palette.success.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'success.main' }}>
                  <PeopleIcon />
                </Box>
                <Box>
                  <Typography fontWeight={700} fontSize={15}>Customer Summary Export</Typography>
                  <Typography variant="body2" color="text.secondary" fontSize={12}>Customer accounts, plans, usage summary</Typography>
                </Box>
              </Box>

              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: 0.8 }}>Format</Typography>
              <ToggleButtonGroup value={custFormat} exclusive onChange={(_, v) => { if (v) setCustFormat(v as Format); }} size="small" sx={{ mb: 2.5 }}>
                {(['CSV', 'JSON'] as Format[]).map((f) => (
                  <ToggleButton key={f} value={f} sx={{ px: 2.5, fontSize: 13, fontWeight: 700, '&.Mui-selected': { bgcolor: 'success.main', color: 'success.contrastText', '&:hover': { bgcolor: 'success.dark' } } }}>{f}</ToggleButton>
                ))}
              </ToggleButtonGroup>

              <Alert severity="info" icon={false} sx={{ mb: 2.5, bgcolor: alpha(theme.palette.info.main, 0.06), border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`, borderRadius: 2, fontSize: 12.5 }}>
                Exports all customer accounts including name, email, plan, and usage status.
              </Alert>

              {custError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCustError('')}>{custError}</Alert>}

              <Box sx={{ mt: 'auto' }}>
                <Button variant="contained" color="success" fullWidth onClick={handleCustDownload} disabled={custLoading} startIcon={custLoading ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />} sx={{ fontWeight: 700, borderRadius: 2, py: 1.1 }}>
                  {custLoading ? 'Preparing…' : `Download Customer Summary (${custFormat})`}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Custom Date Range Export */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card {...cardSx}>
            <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: alpha(theme.palette.warning.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'warning.main' }}>
                  <AssessmentIcon />
                </Box>
                <Box>
                  <Typography fontWeight={700} fontSize={15}>Custom Date Range Export</Typography>
                  <Typography variant="body2" color="text.secondary" fontSize={12}>Export DNS data for a specific date range</Typography>
                </Box>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.5 }}>
                <TextField label="Start Date" type="date" size="small" value={startDate} onChange={e => setStartDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
                <TextField label="End Date" type="date" size="small" value={endDate} onChange={e => setEndDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
              </Stack>

              {customError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCustomError('')}>{customError}</Alert>}

              <Box sx={{ mt: 'auto' }}>
                <Button variant="contained" color="warning" fullWidth onClick={handleCustomDateDownload} disabled={customLoading || !startDate || !endDate} startIcon={customLoading ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />} sx={{ fontWeight: 700, borderRadius: 2, py: 1.1, color: '#fff' }}>
                  {customLoading ? 'Preparing…' : 'Export Date Range (CSV)'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Category Report + Full Report */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={2} height="100%">
            <Card sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.6)}`, borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: alpha('#9C27B0', 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9C27B0', flexShrink: 0 }}>
                  <CategoryIcon fontSize="small" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} fontSize={14}>Category Breakdown (CSV)</Typography>
                  <Typography variant="caption" color="text.secondary">All categories with query counts and block rates</Typography>
                </Box>
                <Button variant="outlined" size="small" onClick={handleCategoryExport} disabled={catLoading} startIcon={catLoading ? <CircularProgress size={14} /> : <FileDownloadIcon />} sx={{ fontWeight: 700, borderRadius: 2, flexShrink: 0, borderColor: '#9C27B0', color: '#9C27B0' }}>
                  {catLoading ? '…' : 'Export'}
                </Button>
              </CardContent>
            </Card>

            <Card sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.6)}`, borderRadius: 3, flex: 1 }}>
              <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: alpha('#C62828', 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C62828', flexShrink: 0 }}>
                  <PictureAsPdfIcon fontSize="small" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} fontSize={14}>Full Report (Multi-section CSV)</Typography>
                  <Typography variant="caption" color="text.secondary">Summary + daily trends + categories in one file</Typography>
                </Box>
                <Button variant="outlined" size="small" onClick={handleFullReportExport} disabled={pdfLoading} startIcon={pdfLoading ? <CircularProgress size={14} /> : <PictureAsPdfIcon />} sx={{ fontWeight: 700, borderRadius: 2, flexShrink: 0, borderColor: '#C62828', color: '#C62828' }}>
                  {pdfLoading ? '…' : 'Export'}
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* Export History */}
      <Card sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.6)}`, borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <HistoryIcon sx={{ color: 'text.secondary' }} />
              <Typography fontWeight={700}>Export History</Typography>
            </Box>
            {history.length > 0 && (
              <Button size="small" onClick={() => { saveHistory([]); setHistory([]); }} sx={{ fontSize: 12, color: 'text.secondary' }}>
                Clear History
              </Button>
            )}
          </Box>

          <Divider sx={{ mb: 2 }} />

          {history.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center', fontSize: 14 }}>
              No exports yet — your download history will appear here
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Period</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Format</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>Rows</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>When</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((rec) => (
                    <TableRow key={rec.id} sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} noWrap>{rec.type}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap>{rec.period}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={rec.format} size="small" sx={{ fontSize: 11, fontWeight: 700, height: 20 }} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{rec.rows > 0 ? rec.rows.toLocaleString() : '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {new Date(rec.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={rec.status} size="small" color={rec.status === 'success' ? 'success' : 'error'} sx={{ fontSize: 11, fontWeight: 700, height: 20 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </AnimatedPage>
  );
}
