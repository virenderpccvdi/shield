import {
  Box, Typography, Card, CardContent, Button, ToggleButton,
  ToggleButtonGroup, Stack, Alert, CircularProgress, Snackbar,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import StorageIcon from '@mui/icons-material/Storage';
import PeopleIcon from '@mui/icons-material/People';
import { alpha, useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

type Period = 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_3_MONTHS' | 'ALL_TIME';
type Format = 'CSV' | 'JSON';

const PERIOD_LABELS: Record<Period, string> = {
  THIS_WEEK: 'This Week',
  THIS_MONTH: 'This Month',
  LAST_3_MONTHS: 'Last 3 Months',
  ALL_TIME: 'All Time',
};

export default function AnalyticsExportPage() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  const tenantId = user?.tenantId ?? '';

  // DNS export state
  const [dnsPeriod, setDnsPeriod] = useState<Period>('THIS_MONTH');
  const [dnsFormat, setDnsFormat] = useState<Format>('CSV');
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsError, setDnsError] = useState('');

  // Customer export state
  const [custFormat, setCustFormat] = useState<Format>('CSV');
  const [custLoading, setCustLoading] = useState(false);
  const [custError, setCustError] = useState('');

  const [snack, setSnack] = useState('');

  const handleDownload = async (
    type: 'dns' | 'customers',
    period?: Period,
    format: Format = 'CSV',
  ) => {
    const token = accessToken ?? localStorage.getItem('shield_token') ?? '';
    const tid = tenantId || localStorage.getItem('shield_tenant_id') || (() => {
      try {
        const raw = localStorage.getItem('shield_user');
        return raw ? (JSON.parse(raw) as { tenantId?: string }).tenantId ?? '' : '';
      } catch {
        return '';
      }
    })();

    const url =
      type === 'dns'
        ? `/api/v1/analytics/export/dns?tenantId=${tid}&period=${period ?? 'THIS_MONTH'}&format=${format}`
        : `/api/v1/analytics/export/customers?tenantId=${tid}&format=${format}`;

    const ext = format.toLowerCase();
    const filename = type === 'dns' ? `dns-stats.${ext}` : `customers.${ext}`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const text = await response.text();
        let msg = `Export failed (${response.status})`;
        try {
          const json = JSON.parse(text) as { message?: string };
          if (json.message) msg = json.message;
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      setSnack(`${filename} downloaded successfully`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed. Please try again.';
      if (type === 'dns') setDnsError(msg);
      else setCustError(msg);
    }
  };

  const handleDnsDownload = async () => {
    setDnsLoading(true);
    setDnsError('');
    try {
      await handleDownload('dns', dnsPeriod, dnsFormat);
    } finally {
      setDnsLoading(false);
    }
  };

  const handleCustDownload = async () => {
    setCustLoading(true);
    setCustError('');
    try {
      await handleDownload('customers', undefined, custFormat);
    } finally {
      setCustLoading(false);
    }
  };

  const cardSx = {
    elevation: 0,
    sx: {
      border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
      borderRadius: 3,
      flex: '1 1 320px',
      minWidth: 0,
    },
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<DownloadIcon />}
        title="Analytics Export"
        subtitle="Download DNS statistics and customer data as CSV or JSON"
        iconColor="primary.main"
        hero
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="stretch">

        {/* DNS Statistics Export */}
        <Card {...cardSx}>
          <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: '10px',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'primary.main',
              }}>
                <StorageIcon />
              </Box>
              <Box>
                <Typography fontWeight={700} fontSize={15}>DNS Statistics Export</Typography>
                <Typography variant="body2" color="text.secondary" fontSize={12}>
                  Query counts, blocked requests, top domains
                </Typography>
              </Box>
            </Box>

            {/* Period selector */}
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Time Period
            </Typography>
            <ToggleButtonGroup
              value={dnsPeriod}
              exclusive
              onChange={(_, v) => { if (v) setDnsPeriod(v as Period); }}
              size="small"
              sx={{ mb: 2.5, flexWrap: 'wrap', gap: 0.5 }}
            >
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <ToggleButton
                  key={p}
                  value={p}
                  sx={{
                    borderRadius: '6px !important',
                    px: 1.5,
                    fontSize: 12,
                    fontWeight: 600,
                    border: `1px solid ${alpha(theme.palette.divider, 0.6)} !important`,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      borderColor: 'primary.main !important',
                      '&:hover': { bgcolor: 'primary.dark' },
                    },
                  }}
                >
                  {PERIOD_LABELS[p]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {/* Format toggle */}
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Format
            </Typography>
            <ToggleButtonGroup
              value={dnsFormat}
              exclusive
              onChange={(_, v) => { if (v) setDnsFormat(v as Format); }}
              size="small"
              sx={{ mb: 2.5 }}
            >
              {(['CSV', 'JSON'] as Format[]).map((f) => (
                <ToggleButton
                  key={f}
                  value={f}
                  sx={{
                    px: 2.5,
                    fontSize: 13,
                    fontWeight: 700,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': { bgcolor: 'primary.dark' },
                    },
                  }}
                >
                  {f}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {dnsError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDnsError('')}>
                {dnsError}
              </Alert>
            )}

            <Box sx={{ mt: 'auto' }}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleDnsDownload}
                disabled={dnsLoading}
                startIcon={dnsLoading ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
                sx={{ fontWeight: 700, borderRadius: 2, py: 1.1 }}
              >
                {dnsLoading ? 'Preparing…' : `Download DNS Stats (${dnsFormat})`}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Customer Summary Export */}
        <Card {...cardSx}>
          <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: '10px',
                bgcolor: alpha(theme.palette.success.main, 0.1),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'success.main',
              }}>
                <PeopleIcon />
              </Box>
              <Box>
                <Typography fontWeight={700} fontSize={15}>Customer Summary Export</Typography>
                <Typography variant="body2" color="text.secondary" fontSize={12}>
                  Customer accounts, plans, usage summary
                </Typography>
              </Box>
            </Box>

            {/* Format toggle */}
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Format
            </Typography>
            <ToggleButtonGroup
              value={custFormat}
              exclusive
              onChange={(_, v) => { if (v) setCustFormat(v as Format); }}
              size="small"
              sx={{ mb: 2.5 }}
            >
              {(['CSV', 'JSON'] as Format[]).map((f) => (
                <ToggleButton
                  key={f}
                  value={f}
                  sx={{
                    px: 2.5,
                    fontSize: 13,
                    fontWeight: 700,
                    '&.Mui-selected': {
                      bgcolor: 'success.main',
                      color: 'success.contrastText',
                      '&:hover': { bgcolor: 'success.dark' },
                    },
                  }}
                >
                  {f}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {/* Info note */}
            <Alert
              severity="info"
              icon={false}
              sx={{
                mb: 2.5,
                bgcolor: alpha(theme.palette.info.main, 0.06),
                border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                borderRadius: 2,
                fontSize: 12.5,
              }}
            >
              Exports all customer accounts for your organisation including name, email, plan, and status.
            </Alert>

            {custError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCustError('')}>
                {custError}
              </Alert>
            )}

            <Box sx={{ mt: 'auto' }}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleCustDownload}
                disabled={custLoading}
                startIcon={custLoading ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon />}
                color="success"
                sx={{ fontWeight: 700, borderRadius: 2, py: 1.1 }}
              >
                {custLoading ? 'Preparing…' : `Download Customer Summary (${custFormat})`}
              </Button>
            </Box>
          </CardContent>
        </Card>

      </Stack>

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack('')}
        message={snack}
      />
    </AnimatedPage>
  );
}
