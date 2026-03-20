import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip,
  CircularProgress, Alert, Snackbar, Divider, Stack, Slider,
  TextField, Switch, FormControlLabel, RadioGroup, FormControl,
  Radio, InputAdornment, IconButton, Collapse, LinearProgress,
  Tooltip,
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SaveIcon from '@mui/icons-material/Save';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SpeedIcon from '@mui/icons-material/Speed';
import UpdateIcon from '@mui/icons-material/Update';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

interface AiSettings {
  provider: string;
  modelName: string;
  fastModelName: string;
  apiKeyMasked: string;
  apiBaseUrl: string;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
  updatedAt: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  models: string[];
  fastModels: string[];
  baseUrl: string;
  logoChar: string;
  accentColor: string;
}

interface TestResult {
  success: boolean;
  response: string;
  latencyMs: number;
  error?: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Powerful reasoning and safety-focused AI by Anthropic',
    models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    fastModels: ['claude-haiku-4-5', 'claude-sonnet-4-5'],
    baseUrl: 'https://api.anthropic.com',
    logoChar: 'A',
    accentColor: '#D4A853',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'High-performance open-source AI models by DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    fastModels: ['deepseek-chat'],
    baseUrl: 'https://api.deepseek.com',
    logoChar: 'D',
    accentColor: '#4F86F7',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o and o-series models by OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
    fastModels: ['gpt-4o-mini', 'gpt-4o'],
    baseUrl: 'https://api.openai.com',
    logoChar: 'O',
    accentColor: '#10A37F',
  },
];

export default function AiModelsPage() {
  const [settings, setSettings] = useState<Partial<AiSettings>>({
    provider: 'anthropic',
    modelName: 'claude-sonnet-4-5',
    fastModelName: 'claude-haiku-4-5',
    apiKeyMasked: '',
    apiBaseUrl: '',
    maxTokens: 1024,
    temperature: 0.7,
    enabled: true,
  });
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [snack, setSnack] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');

  // Backend returns uppercase provider name (e.g. DEEPSEEK), PROVIDERS use lowercase IDs
  const normalizeProvider = (p?: string) => (p ?? '').toLowerCase();
  const selectedProvider = PROVIDERS.find(p => p.id === normalizeProvider(settings.provider)) ?? PROVIDERS[0];

  useEffect(() => {
    api.get('/admin/ai-settings')
      .then(r => {
        const d = r.data?.data ?? r.data;
        if (d) setSettings({ ...d, provider: normalizeProvider(d.provider) });
      })
      .catch(() => {
        // Use defaults if endpoint not yet available
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProviderChange = (providerId: string) => {
    const prov = PROVIDERS.find(p => p.id === providerId);
    if (!prov) return;
    setSettings(prev => ({
      ...prev,
      provider: providerId,
      modelName: prov.models[0],
      fastModelName: prov.fastModels[0],
      apiBaseUrl: prov.baseUrl,   // auto-fill provider's base URL
    }));
    setTestResult(null);
  };

  const handleSavePayload = () => {
    // Convert lowercase provider ID back to uppercase for backend
    return { ...settings, provider: (settings.provider ?? 'deepseek').toUpperCase() };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...handleSavePayload() };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      await api.put('/admin/ai-settings', payload);
      setSnack('AI settings saved successfully');
      setSnackSeverity('success');
      setApiKey('');
    } catch {
      setSnack('Failed to save settings');
      setSnackSeverity('error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post('/admin/ai-settings/test');
      const d = r.data?.data ?? r.data;
      setTestResult(d);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      setTestResult({ success: false, response: '', latencyMs: 0, error: msg });
    } finally {
      setTesting(false);
    }
  };

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PsychologyIcon />}
        title="AI Settings"
        subtitle="Configure the AI provider, model, and parameters for anomaly detection"
        iconColor="#6A1B9A"
        action={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={testing ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleTest}
              disabled={testing || saving}
              sx={{ borderRadius: 2 }}
            >
              Test Connection
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || testing}
              sx={{ bgcolor: '#6A1B9A', '&:hover': { bgcolor: '#4A148C' }, borderRadius: 2 }}
            >
              Save Settings
            </Button>
          </Stack>
        }
      />

      {loading ? (
        <Box sx={{ py: 8 }}><LinearProgress /></Box>
      ) : (
        <Grid container spacing={3}>
          {/* Left column: Provider + Config */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Stack spacing={3}>
              {/* Provider selector */}
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PsychologyIcon sx={{ color: '#6A1B9A', fontSize: 20 }} />
                    AI Provider
                  </Typography>
                  <FormControl fullWidth>
                    <RadioGroup
                      value={settings.provider ?? 'anthropic'}
                      onChange={e => handleProviderChange(e.target.value)}
                    >
                      <Grid container spacing={1.5}>
                        {PROVIDERS.map(prov => {
                          const selected = settings.provider === prov.id;
                          return (
                            <Grid key={prov.id} size={{ xs: 12, sm: 4 }}>
                              <Box
                                onClick={() => handleProviderChange(prov.id)}
                                sx={{
                                  border: `2px solid ${selected ? prov.accentColor : 'rgba(0,0,0,0.12)'}`,
                                  borderRadius: 2,
                                  p: 1.5,
                                  cursor: 'pointer',
                                  transition: 'all 0.18s ease',
                                  bgcolor: selected ? `${prov.accentColor}10` : 'transparent',
                                  '&:hover': { borderColor: prov.accentColor, bgcolor: `${prov.accentColor}08` },
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Box sx={{
                                    width: 32, height: 32, borderRadius: '8px',
                                    bgcolor: prov.accentColor,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 900, fontSize: 14,
                                  }}>
                                    {prov.logoChar}
                                  </Box>
                                  <Radio value={prov.id} size="small" sx={{ p: 0, color: prov.accentColor, '&.Mui-checked': { color: prov.accentColor } }} />
                                </Box>
                                <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.2 }}>{prov.name}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>{prov.description}</Typography>
                              </Box>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </RadioGroup>
                  </FormControl>
                </CardContent>
              </Card>

              {/* Model + Key config */}
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Model Configuration</Typography>
                  <Stack spacing={2.5}>
                    <TextField
                      select
                      fullWidth
                      label="Primary Model"
                      value={settings.modelName ?? selectedProvider.models[0]}
                      onChange={e => setSettings(prev => ({ ...prev, modelName: e.target.value }))}
                      size="small"
                      SelectProps={{ native: true }}
                    >
                      {selectedProvider.models.map(m => <option key={m} value={m}>{m}</option>)}
                    </TextField>

                    <TextField
                      select
                      fullWidth
                      label="Fast Model (for quick analysis)"
                      value={settings.fastModelName ?? selectedProvider.fastModels[0]}
                      onChange={e => setSettings(prev => ({ ...prev, fastModelName: e.target.value }))}
                      size="small"
                      SelectProps={{ native: true }}
                    >
                      {selectedProvider.fastModels.map(m => <option key={m} value={m}>{m}</option>)}
                    </TextField>

                    <TextField
                      fullWidth
                      label="API Key"
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder={settings.apiKeyMasked ? 'Leave blank to keep existing key' : 'Enter API key'}
                      size="small"
                      helperText={settings.apiKeyMasked ? `Current: ${settings.apiKeyMasked}` : 'Required to connect to the AI provider'}
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton size="small" onClick={() => setShowKey(v => !v)}>
                                {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      fullWidth
                      label="API Base URL (optional override)"
                      value={settings.apiBaseUrl ?? ''}
                      onChange={e => setSettings(prev => ({ ...prev, apiBaseUrl: e.target.value }))}
                      placeholder={selectedProvider.baseUrl}
                      size="small"
                      helperText="Leave blank to use the provider default"
                    />
                  </Stack>
                </CardContent>
              </Card>

              {/* Sliders */}
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Generation Parameters</Typography>
                  <Stack spacing={3}>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="body2" fontWeight={600}>Max Tokens</Typography>
                        <Chip label={settings.maxTokens ?? 1024} size="small" sx={{ fontWeight: 700, minWidth: 56 }} />
                      </Box>
                      <Slider
                        value={settings.maxTokens ?? 1024}
                        onChange={(_, v) => setSettings(prev => ({ ...prev, maxTokens: v as number }))}
                        min={256}
                        max={4096}
                        step={128}
                        marks={[
                          { value: 256, label: '256' },
                          { value: 1024, label: '1K' },
                          { value: 2048, label: '2K' },
                          { value: 4096, label: '4K' },
                        ]}
                        valueLabelDisplay="auto"
                        sx={{ color: '#6A1B9A' }}
                      />
                    </Box>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>Temperature</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(settings.temperature ?? 0.7) < 0.3 ? 'More deterministic' : (settings.temperature ?? 0.7) > 0.8 ? 'More creative' : 'Balanced'}
                          </Typography>
                        </Box>
                        <Chip label={(settings.temperature ?? 0.7).toFixed(2)} size="small" sx={{ fontWeight: 700, minWidth: 52 }} />
                      </Box>
                      <Slider
                        value={settings.temperature ?? 0.7}
                        onChange={(_, v) => setSettings(prev => ({ ...prev, temperature: v as number }))}
                        min={0}
                        max={1}
                        step={0.05}
                        marks={[
                          { value: 0, label: '0' },
                          { value: 0.5, label: '0.5' },
                          { value: 1, label: '1' },
                        ]}
                        valueLabelDisplay="auto"
                        sx={{ color: '#6A1B9A' }}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          {/* Right column: Status + Test result */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Stack spacing={3}>
              {/* Enable/disable toggle */}
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>AI Analysis</Typography>
                      <Typography variant="body2" color="text.secondary">Enable or disable AI-powered anomaly detection</Typography>
                    </Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.enabled ?? true}
                          onChange={e => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#6A1B9A' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#6A1B9A' } }}
                        />
                      }
                      label={settings.enabled ? 'Enabled' : 'Disabled'}
                      labelPlacement="start"
                      sx={{ m: 0 }}
                    />
                  </Box>
                </CardContent>
              </Card>

              {/* Current config */}
              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>Current Configuration</Typography>
                  <Stack spacing={1.5}>
                    <ConfigRow label="Provider">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                          width: 20, height: 20, borderRadius: '4px',
                          bgcolor: selectedProvider.accentColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 900, fontSize: 10,
                        }}>
                          {selectedProvider.logoChar}
                        </Box>
                        <Typography variant="body2" fontWeight={600}>{selectedProvider.name}</Typography>
                      </Box>
                    </ConfigRow>
                    <ConfigRow label="Primary Model">
                      <Chip label={settings.modelName ?? '—'} size="small" sx={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }} />
                    </ConfigRow>
                    <ConfigRow label="Fast Model">
                      <Chip label={settings.fastModelName ?? '—'} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11 }} />
                    </ConfigRow>
                    <ConfigRow label="API Key">
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        {settings.apiKeyMasked || '(not set)'}
                      </Typography>
                    </ConfigRow>
                    <ConfigRow label="Max Tokens">
                      <Typography variant="body2" fontWeight={600}>{settings.maxTokens ?? 1024}</Typography>
                    </ConfigRow>
                    <ConfigRow label="Temperature">
                      <Typography variant="body2" fontWeight={600}>{(settings.temperature ?? 0.7).toFixed(2)}</Typography>
                    </ConfigRow>
                    {settings.updatedAt && (
                      <>
                        <Divider />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <UpdateIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            Last updated {new Date(settings.updatedAt).toLocaleString()}
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              {/* Test result */}
              <Collapse in={testing || testResult !== null}>
                <Card sx={{
                  border: '1px solid',
                  borderColor: testing ? 'divider' : testResult?.success ? '#66BB6A' : '#EF5350',
                }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SpeedIcon sx={{ fontSize: 20, color: '#6A1B9A' }} />
                      Connection Test
                    </Typography>
                    {testing ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <CircularProgress size={20} sx={{ color: '#6A1B9A' }} />
                        <Typography variant="body2" color="text.secondary">Testing connection to {selectedProvider.name}...</Typography>
                      </Box>
                    ) : testResult ? (
                      <Stack spacing={1.5}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {testResult.success
                            ? <CheckCircleIcon sx={{ color: '#43A047' }} />
                            : <ErrorIcon sx={{ color: '#E53935' }} />}
                          <Typography variant="body1" fontWeight={600} color={testResult.success ? '#2E7D32' : '#C62828'}>
                            {testResult.success ? 'Connection successful' : 'Connection failed'}
                          </Typography>
                        </Box>
                        {testResult.latencyMs > 0 && (
                          <Tooltip title="Round-trip latency">
                            <Chip
                              icon={<SpeedIcon />}
                              label={`${testResult.latencyMs} ms`}
                              size="small"
                              color={testResult.latencyMs < 1000 ? 'success' : testResult.latencyMs < 3000 ? 'warning' : 'error'}
                              sx={{ fontWeight: 700, width: 'fit-content' }}
                            />
                          </Tooltip>
                        )}
                        {testResult.error && (
                          <Alert severity="error" sx={{ py: 0.5 }}>{testResult.error}</Alert>
                        )}
                        {testResult.response && !testResult.error && (
                          <Box sx={{ bgcolor: '#F8F9FA', borderRadius: 1.5, p: 1.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                              {testResult.response}
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    ) : null}
                  </CardContent>
                </Card>
              </Collapse>
            </Stack>
          </Grid>
        </Grid>
      )}

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackSeverity} onClose={() => setSnack('')} sx={{ width: '100%' }}>
          {snack}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      {children}
    </Box>
  );
}
