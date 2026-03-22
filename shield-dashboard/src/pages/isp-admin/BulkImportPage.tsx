import {
  Box, Typography, Card, CardContent, Button, Alert, Chip, Stack,
  LinearProgress, List, ListItem, ListItemText, Divider, Paper,
  CircularProgress, Snackbar,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { alpha, useTheme } from '@mui/material/styles';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import { useAuthStore } from '../../store/auth.store';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

interface BulkImportJob {
  jobId: string;
  tenantId: string;
  filename?: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  message?: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errorDetails?: string[];
  createdAt?: string;
  completedAt?: string;
}

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  PENDING:    'warning',
  PROCESSING: 'info',
  DONE:       'success',
  FAILED:     'error',
};

export default function BulkImportPage() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const tenantId = user?.tenantId;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [snack, setSnack] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Poll job status while processing
  const { data: jobData } = useQuery<BulkImportJob>({
    queryKey: ['bulk-import-job', jobId],
    queryFn: async () => {
      const r = await api.get(
        `/tenants/${tenantId}/customers/bulk-import/${jobId}`
      );
      return r.data.data as BulkImportJob;
    },
    enabled: !!jobId && !!tenantId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'PENDING' || status === 'PROCESSING') return 3000;
      return false;
    },
  });

  const isRunning = jobData?.status === 'PENDING' || jobData?.status === 'PROCESSING';

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
    setUploadError('');
  }

  async function handleUpload() {
    if (!selectedFile || !tenantId) return;
    setUploading(true);
    setUploadError('');
    setJobId(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const r = await api.post(
        `/tenants/${tenantId}/customers/bulk-import`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const job = r.data.data as BulkImportJob;
      setJobId(job.jobId);
      setSnack('Import started! Polling for progress…');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Upload failed. Please check the file and try again.';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    setSelectedFile(null);
    setJobId(null);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const progressPct =
    jobData && jobData.totalRows > 0
      ? Math.round(((jobData.successRows + jobData.failedRows) / jobData.totalRows) * 100)
      : 0;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<GroupAddIcon />}
        title="Bulk Customer Import"
        subtitle="Upload a CSV file to create multiple customer accounts at once"
        iconColor="primary.main"
      />

      <Stack spacing={3} maxWidth={760}>
        {/* Format instructions */}
        <Card elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.info.main, 0.25)}`, borderRadius: 3, bgcolor: alpha(theme.palette.info.main, 0.04) }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <InfoOutlinedIcon color="info" />
              <Typography fontWeight={700} color="info.main" fontSize={15}>
                CSV Format Instructions
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Upload a <strong>.csv</strong> file with the following columns (header row is optional):
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                px: 2, py: 1.5, borderRadius: 2, fontFamily: 'monospace',
                fontSize: 13, bgcolor: alpha(theme.palette.background.default, 0.7),
                borderColor: alpha(theme.palette.divider, 0.5),
              }}
            >
              email, name, phone, planId
            </Paper>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Only <strong>email</strong> is required. Re-uploading an existing email is safe — duplicates are skipped.
              A welcome email with login credentials is sent to each new account.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 0.5 }}>
              {['john@example.com, John Smith, +91-9876543210, BASIC',
                'jane@corp.com, Jane Doe,,',
                'user@test.com,,,'].map((ex, i) => (
                <Chip key={i} label={ex} size="small" variant="outlined"
                  sx={{ fontFamily: 'monospace', fontSize: 11 }} />
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Upload area */}
        <Card elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.6)}`, borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography fontWeight={700} fontSize={15} sx={{ mb: 2.5 }}>
              Upload CSV File
            </Typography>

            <Box
              sx={{
                border: `2px dashed ${alpha(theme.palette.primary.main, 0.35)}`,
                borderRadius: 2.5,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                bgcolor: selectedFile
                  ? alpha(theme.palette.success.main, 0.04)
                  : alpha(theme.palette.primary.main, 0.03),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.07),
                  borderColor: 'primary.main',
                },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <UploadFileIcon
                sx={{
                  fontSize: 48,
                  color: selectedFile ? 'success.main' : 'primary.main',
                  mb: 1.5, opacity: 0.8,
                }}
              />
              {selectedFile ? (
                <>
                  <Typography fontWeight={700} color="success.main">
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(selectedFile.size / 1024).toFixed(1)} KB — click to change
                  </Typography>
                </>
              ) : (
                <>
                  <Typography fontWeight={600} color="text.primary">
                    Click to select a CSV file
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    or drag and drop — .csv files only
                  </Typography>
                </>
              )}
            </Box>

            {uploadError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {uploadError}
              </Alert>
            )}

            <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={!selectedFile || uploading || isRunning}
                startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
                sx={{ fontWeight: 700, borderRadius: 2 }}
              >
                {uploading ? 'Uploading…' : 'Start Import'}
              </Button>
              {(selectedFile || jobId) && (
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  disabled={uploading || isRunning}
                  sx={{ borderRadius: 2 }}
                >
                  Reset
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Job status */}
        {jobData && (
          <Card elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.6)}`, borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography fontWeight={700} fontSize={15}>Import Progress</Typography>
                <Chip
                  label={jobData.status}
                  color={STATUS_COLORS[jobData.status] ?? 'default'}
                  size="small"
                  sx={{ fontWeight: 700, fontSize: 12 }}
                />
              </Box>

              {jobData.filename && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  File: <strong>{jobData.filename}</strong>
                </Typography>
              )}

              {isRunning && (
                <Box sx={{ mb: 2 }}>
                  <LinearProgress variant="determinate" value={progressPct} sx={{ borderRadius: 2, height: 6 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, textAlign: 'right' }}>
                    {progressPct}% complete
                  </Typography>
                </Box>
              )}

              <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Paper variant="outlined" sx={{ px: 2.5, py: 1.5, borderRadius: 2, textAlign: 'center', minWidth: 90, flex: '1 1 auto' }}>
                  <Typography variant="h5" fontWeight={800}>{jobData.totalRows}</Typography>
                  <Typography variant="caption" color="text.secondary">Total</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ px: 2.5, py: 1.5, borderRadius: 2, textAlign: 'center', minWidth: 90, flex: '1 1 auto', borderColor: alpha(theme.palette.success.main, 0.5) }}>
                  <Typography variant="h5" fontWeight={800} color="success.main">{jobData.successRows}</Typography>
                  <Typography variant="caption" color="text.secondary">Imported</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ px: 2.5, py: 1.5, borderRadius: 2, textAlign: 'center', minWidth: 90, flex: '1 1 auto', borderColor: jobData.failedRows > 0 ? alpha(theme.palette.error.main, 0.5) : alpha(theme.palette.divider, 0.5) }}>
                  <Typography variant="h5" fontWeight={800} color={jobData.failedRows > 0 ? 'error.main' : 'text.primary'}>
                    {jobData.failedRows}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Failed</Typography>
                </Paper>
              </Stack>

              {jobData.status === 'DONE' && jobData.failedRows === 0 && (
                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 1.5 }}>
                  All {jobData.successRows} customer{jobData.successRows !== 1 ? 's' : ''} imported successfully.
                  Welcome emails have been sent.
                </Alert>
              )}

              {jobData.status === 'DONE' && jobData.failedRows > 0 && (
                <Alert severity="warning" icon={<ErrorOutlineIcon />} sx={{ mb: 1.5 }}>
                  Import completed with {jobData.failedRows} error{jobData.failedRows !== 1 ? 's' : ''}. See details below.
                </Alert>
              )}

              {jobData.errorDetails && jobData.errorDetails.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: 'error.main' }}>
                    Error Details
                  </Typography>
                  <Paper variant="outlined" sx={{ borderRadius: 2, maxHeight: 240, overflow: 'auto', borderColor: alpha(theme.palette.error.main, 0.3) }}>
                    <List dense disablePadding>
                      {jobData.errorDetails.map((err, i) => (
                        <Box key={i}>
                          {i > 0 && <Divider />}
                          <ListItem sx={{ py: 0.75 }}>
                            <ListItemText
                              primary={err}
                              primaryTypographyProps={{ variant: 'body2', color: 'error.main', fontFamily: 'monospace', fontSize: 12 }}
                            />
                          </ListItem>
                        </Box>
                      ))}
                    </List>
                  </Paper>
                </Box>
              )}
            </CardContent>
          </Card>
        )}
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
