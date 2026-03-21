import { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress,
  Chip, Stack, Alert, Divider, IconButton, Tooltip as MuiTooltip,
  Button, LinearProgress, Tab, Tabs, TextField, InputAdornment,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoIcon from '@mui/icons-material/Info';
import ErrorIcon from '@mui/icons-material/Error';
import ShieldIcon from '@mui/icons-material/Shield';
import FavoriteIcon from '@mui/icons-material/Favorite';
import NightlightIcon from '@mui/icons-material/Nightlight';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BlockIcon from '@mui/icons-material/Block';
import TodayIcon from '@mui/icons-material/Today';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChildProfile { id: string; name: string; }

interface RiskIndicator {
  type: string;
  description: string;
  severity: string;
  detectedAt: string;
}

interface CategoryStat {
  name: string;
  minutes: number;
  blocked: number;
}

interface Recommendation {
  type: string;
  title: string;
  description: string;
  icon: string;
}

interface AnomalyEvent {
  severity: string;
  description: string;
  detectedAt: string;
}

interface DayTrend {
  date: string;
  allowed: number;
  blocked: number;
}

interface InsightsData {
  profileId: string;
  riskScore: number;
  riskLevel: string;
  indicators: RiskIndicator[];
  addictionScore: number;
  mentalHealthSignals: string[];
  hasData: boolean;
  screenTimeMinutes: number;
  dailyAvgMinutes: number;
  totalBlocked: number;
  topCategories: CategoryStat[];
  recommendations: Recommendation[];
  anomalies: AnomalyEvent[];
  weeklyTrend: DayTrend[];
  summary: string;
}

interface WeeklyDigest {
  profileId: string;
  weekOf: string;
  summary: string;
  riskLevel: string;
  riskScore: number;
  signals: string[];
  usageTrend: string;
  topInsight: string;
  recommendedAction?: string;
  generatedAt: string;
}

interface KeywordData {
  profileId: string;
  keywords: Record<string, number>;
}

interface SocialAlert {
  id: string;
  profileId: string;
  alertType: string;
  severity: string;
  description: string;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
  detectedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  LOW: { color: '#2E7D32', bg: '#E8F5E9', icon: <InfoIcon /> },
  MEDIUM: { color: '#F57F17', bg: '#FFF8E1', icon: <WarningAmberIcon /> },
  HIGH: { color: '#C62828', bg: '#FFEBEE', icon: <ErrorIcon /> },
};

const RISK_COLORS: Record<string, { color: string; bg: string }> = {
  LOW: { color: '#43A047', bg: '#E8F5E9' },
  MEDIUM: { color: '#FB8C00', bg: '#FFF8E1' },
  HIGH: { color: '#E53935', bg: '#FFEBEE' },
};

const TREND_ICONS: Record<string, React.ReactNode> = {
  UP: <TrendingUpIcon sx={{ fontSize: 18 }} />,
  DOWN: <TrendingDownIcon sx={{ fontSize: 18 }} />,
  STABLE: <RemoveIcon sx={{ fontSize: 18 }} />,
};

const SOCIAL_ALERT_ICONS: Record<string, React.ReactNode> = {
  LATE_NIGHT: <NightlightIcon sx={{ fontSize: 20 }} />,
  SOCIAL_SPIKE: <TrendingUpIcon sx={{ fontSize: 20 }} />,
  GAMING_SPIKE: <SportsEsportsIcon sx={{ fontSize: 20 }} />,
  NEW_CATEGORY: <NewReleasesIcon sx={{ fontSize: 20 }} />,
};

const SOCIAL_ALERT_COLORS: Record<string, { color: string; bg: string }> = {
  HIGH: { color: '#C62828', bg: '#FFEBEE' },
  MEDIUM: { color: '#E65100', bg: '#FFF3E0' },
  LOW: { color: '#2E7D32', bg: '#E8F5E9' },
};

const REC_ICON_COLORS: Record<string, string> = {
  limit: '#7B1FA2',
  schedule: '#0288D1',
  block: '#C62828',
  reward: '#2E7D32',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMinutes(m: number): string {
  if (!m) return '0m';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return iso; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskGauge({ score, level }: { score: number; level: string }) {
  const config = RISK_COLORS[level] || RISK_COLORS.LOW;
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={Math.min(100, score)}
        size={100}
        thickness={6}
        sx={{
          color: config.color,
          '& .MuiCircularProgress-circle': { strokeLinecap: 'round' },
        }}
      />
      <Box sx={{
        top: 0, left: 0, bottom: 0, right: 0,
        position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <Typography variant="h5" fontWeight={800} sx={{ color: config.color, lineHeight: 1 }}>{score}</Typography>
        <Typography variant="caption" fontWeight={600} sx={{ color: config.color }}>{level}</Typography>
      </Box>
    </Box>
  );
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ py: 2.5 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 2, bgcolor: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5,
        }}>
          <Box sx={{ color, '& .MuiSvgIcon-root': { fontSize: 20 } }}>{icon}</Box>
        </Box>
        <Typography variant="h5" fontWeight={800} sx={{ color, lineHeight: 1.1 }}>{value}</Typography>
        <Typography variant="body2" fontWeight={600} sx={{ mt: 0.3 }}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const color = REC_ICON_COLORS[rec.type] || '#7B1FA2';
  return (
    <Card sx={{
      border: '1px solid',
      borderColor: `${color}30`,
      '&:hover': { boxShadow: 3, transform: 'translateY(-1px)', transition: 'all .15s' },
    }}>
      <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: 2, flexShrink: 0,
          background: `linear-gradient(135deg, ${color}cc, ${color})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LightbulbIcon sx={{ color: 'white', fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body1" fontWeight={700}>{rec.title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, lineHeight: 1.5 }}>
            {rec.description}
          </Typography>
          <Box sx={{ mt: 1.5 }}>
            <Chip
              label={rec.type.toUpperCase()}
              size="small"
              sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: `${color}18`, color }}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function AnomalyRow({ event }: { event: AnomalyEvent }) {
  const sev = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.LOW;
  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', gap: 1.5,
      p: 1.5, borderRadius: 2, bgcolor: sev.bg,
    }}>
      <Box sx={{ color: sev.color, mt: 0.3, '& .MuiSvgIcon-root': { fontSize: 20 } }}>
        {sev.icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600}>{event.description}</Typography>
        <Typography variant="caption" color="text.secondary">
          {new Date(event.detectedAt).toLocaleString()}
        </Typography>
      </Box>
      <Chip
        size="small"
        label={event.severity}
        sx={{ ml: 'auto', height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'white', color: sev.color }}
      />
    </Box>
  );
}

// ─── Weekly AI Report card ────────────────────────────────────────────────────

function WeeklyReportCard({ weekly, insights }: { weekly: WeeklyDigest; insights?: InsightsData }) {
  const trendColor = weekly.usageTrend === 'DOWN' ? '#43A047' : weekly.usageTrend === 'UP' ? '#E53935' : '#607D8B';
  const riskCfg = RISK_COLORS[weekly.riskLevel] || RISK_COLORS.LOW;

  const screenHrs = insights?.screenTimeMinutes
    ? `${(insights.screenTimeMinutes / 60).toFixed(1)} hrs`
    : null;

  return (
    <Card sx={{ background: 'linear-gradient(135deg, #F3E5F5 0%, #EDE7F6 100%)', border: '1px solid #CE93D820' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <ShieldIcon sx={{ color: '#7B1FA2' }} />
          <Typography variant="subtitle1" fontWeight={700}>Weekly AI Report</Typography>
          <Chip
            label={`Week of ${weekly.weekOf}`}
            size="small"
            sx={{ ml: 'auto', bgcolor: 'white', fontWeight: 600, fontSize: 11 }}
          />
        </Box>

        {/* Key metrics row */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          {screenHrs && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTimeIcon sx={{ fontSize: 16, color: '#7B1FA2' }} />
              <Typography variant="body2" fontWeight={600}>{screenHrs} screen time</Typography>
            </Box>
          )}
          {insights?.totalBlocked != null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <BlockIcon sx={{ fontSize: 16, color: '#E53935' }} />
              <Typography variant="body2" fontWeight={600}>{insights.totalBlocked} sites blocked</Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: trendColor }}>
            {TREND_ICONS[weekly.usageTrend]}
            <Typography variant="body2" fontWeight={600}>
              Usage: {weekly.usageTrend}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: riskCfg.color }} />
            <Typography variant="body2" fontWeight={600} sx={{ color: riskCfg.color }}>
              Risk: {weekly.riskLevel}
            </Typography>
          </Box>
        </Stack>

        <Alert
          severity={weekly.riskLevel === 'HIGH' ? 'error' : weekly.riskLevel === 'MEDIUM' ? 'warning' : 'success'}
          sx={{ mb: 2, borderRadius: 2, bgcolor: 'white' }}
        >
          {weekly.summary}
        </Alert>

        {weekly.topInsight && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Top Insight:</strong> {weekly.topInsight}
          </Typography>
        )}
        {weekly.recommendedAction && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1, p: 1.5, borderRadius: 2, bgcolor: 'white' }}>
            <LightbulbIcon sx={{ fontSize: 18, color: '#7B1FA2', mt: 0.1 }} />
            <Typography variant="body2" color="primary">
              <strong>Top Recommendation:</strong> {weekly.recommendedAction}
            </Typography>
          </Box>
        )}

        {weekly.signals.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 1.5 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {weekly.signals.map((s, i) => (
                <Chip key={i} label={s} size="small" variant="outlined" sx={{ fontSize: 12 }} />
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ─── No-data empty state ──────────────────────────────────────────────────────

function NoDataEmptyState({ profileName }: { profileName?: string }) {
  return (
    <Card sx={{ textAlign: 'center', p: 4 }}>
      <CardContent>
        <Box sx={{
          width: 88, height: 88, borderRadius: '50%',
          bgcolor: '#F3E5F5', display: 'flex', alignItems: 'center',
          justifyContent: 'center', mx: 'auto', mb: 3,
        }}>
          <HourglassEmptyIcon sx={{ fontSize: 44, color: '#9C27B0' }} />
        </Box>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Collecting Data…
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mx: 'auto', lineHeight: 1.6 }}>
          AI insights for{profileName ? ` ${profileName}` : ' this profile'} will be available
          after 24 hours of usage. Make sure the child's device is connected to Shield DNS.
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
          {['Device connected to Shield DNS', 'Active browsing detected', 'Check back after ~24h'].map((hint, i) => (
            <Chip
              key={i}
              icon={<InfoIcon />}
              label={hint}
              size="small"
              variant="outlined"
              sx={{ fontSize: 11 }}
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── Category progress bars ───────────────────────────────────────────────────

function TopCategoriesCard({ categories }: { categories: CategoryStat[] }) {
  if (!categories || categories.length === 0) return null;
  const maxBlocked = Math.max(...categories.map(c => c.blocked), 1);
  const palette = ['#7B1FA2', '#E53935', '#F57C00', '#0288D1', '#2E7D32'];
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Top Blocked Categories</Typography>
        <Stack spacing={1.5}>
          {categories.slice(0, 5).map((cat, i) => (
            <Box key={i}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" fontWeight={600}>{cat.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {cat.blocked} blocked · {fmtMinutes(cat.minutes)} allowed
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(cat.blocked / maxBlocked) * 100}
                sx={{
                  height: 6, borderRadius: 3,
                  bgcolor: `${palette[i % palette.length]}18`,
                  '& .MuiLinearProgress-bar': { bgcolor: palette[i % palette.length], borderRadius: 3 },
                }}
              />
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── Ask AI types ─────────────────────────────────────────────────────────────

interface ChatMsg {
  text: string;
  isUser: boolean;
  suggestions?: string[];
}

// ─── Ask AI tab component ─────────────────────────────────────────────────────

const STARTER_SUGGESTIONS = [
  "Why is my child's risk score high?",
  "What categories should I block?",
  "Is my child's usage normal for their age?",
  "What time does my child use internet most?",
];

function AskAiTab({ profileId }: { profileId: string | null }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendQuestion = async (question: string) => {
    if (!question.trim() || !profileId || loading) return;
    const q = question.trim();
    setInput('');
    setMessages(prev => {
      const next = [...prev, { text: q, isUser: true }];
      // Keep last 3 Q&A pairs (6 messages)
      return next.slice(-6);
    });
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { profileId, question: q });
      const data = res.data?.data ?? res.data;
      const answer = data?.answer ?? 'Sorry, no answer available.';
      const suggestions: string[] = Array.isArray(data?.suggestions) ? data.suggestions : [];
      setMessages(prev => [...prev, { text: answer, isUser: false, suggestions }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { text: 'Unable to reach Shield AI right now. Please try again.', isUser: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!profileId) {
    return (
      <Card sx={{ textAlign: 'center', p: 4 }}>
        <CardContent>
          <SmartToyIcon sx={{ fontSize: 48, color: '#1565C0', mb: 2 }} />
          <Typography variant="h6" fontWeight={700}>Select a child profile</Typography>
          <Typography variant="body2" color="text.secondary">
            Choose a child above to start chatting with Shield AI.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {/* Header */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 2.5, py: 2, borderBottom: '1px solid #F0F0F0',
        }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2,
            bgcolor: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SmartToyIcon sx={{ color: '#1565C0', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Shield AI Assistant</Typography>
            <Typography variant="caption" color="text.secondary">
              Ask anything about your child's online activity
            </Typography>
          </Box>
        </Box>

        {/* Starter suggestions (only shown when no messages yet) */}
        {messages.length === 0 && (
          <Box sx={{ px: 2.5, py: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600 }}>
              Try asking:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {STARTER_SUGGESTIONS.map((s, i) => (
                <Chip
                  key={i}
                  label={s}
                  size="small"
                  onClick={() => sendQuestion(s)}
                  sx={{
                    cursor: 'pointer', bgcolor: '#E3F2FD', color: '#1565C0',
                    fontWeight: 600, fontSize: 12,
                    '&:hover': { bgcolor: '#BBDEFB' },
                    mb: 0.5,
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Message list */}
        {messages.length > 0 && (
          <Box sx={{
            px: 2.5, py: 2,
            maxHeight: 400, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 1.5,
          }}>
            {messages.map((msg, i) => (
              <Box key={i}>
                <Box sx={{
                  display: 'flex',
                  justifyContent: msg.isUser ? 'flex-end' : 'flex-start',
                  gap: 1,
                }}>
                  {!msg.isUser && (
                    <Box sx={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      bgcolor: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      mt: 0.3,
                    }}>
                      <SmartToyIcon sx={{ fontSize: 16, color: '#1565C0' }} />
                    </Box>
                  )}
                  <Box sx={{
                    maxWidth: '75%',
                    px: 2, py: 1.2,
                    borderRadius: msg.isUser
                      ? '16px 4px 16px 16px'
                      : '4px 16px 16px 16px',
                    bgcolor: msg.isUser ? '#7B1FA2' : '#E3F2FD',
                    color: msg.isUser ? 'white' : 'text.primary',
                  }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
                      {msg.text}
                    </Typography>
                  </Box>
                </Box>
                {/* Suggestion chips below AI reply */}
                {!msg.isUser && msg.suggestions && msg.suggestions.length > 0 && (
                  <Box sx={{ pl: 5, mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {msg.suggestions.map((s, j) => (
                      <Chip
                        key={j}
                        label={s}
                        size="small"
                        onClick={() => sendQuestion(s)}
                        sx={{
                          cursor: 'pointer', bgcolor: '#E3F2FD', color: '#1565C0',
                          fontWeight: 600, fontSize: 11,
                          '&:hover': { bgcolor: '#BBDEFB' },
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            ))}
            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '50%',
                  bgcolor: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <SmartToyIcon sx={{ fontSize: 16, color: '#1565C0' }} />
                </Box>
                <CircularProgress size={16} sx={{ color: '#1565C0' }} />
                <Typography variant="caption" color="text.secondary">Shield AI is thinking…</Typography>
              </Box>
            )}
            <div ref={bottomRef} />
          </Box>
        )}

        {/* Input */}
        <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid #F0F0F0' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ask about your child's activity…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(input); } }}
            disabled={loading}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      disabled={loading || !input.trim()}
                      onClick={() => sendQuestion(input)}
                      sx={{ color: '#1565C0' }}
                    >
                      <SendIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AiInsightsPage() {
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const qc = useQueryClient();

  const { data: children } = useQuery({
    queryKey: ['children'],
    queryFn: () => api.get('/profiles/children').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? r.data) as ChildProfile[];
    }).catch(() => []),
  });

  const profileId = selectedChild || (children && children.length > 0 ? children[0].id : null);
  const selectedChildObj = (children || []).find(c => c.id === profileId);

  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ['ai-insights', profileId],
    queryFn: () => api.get(`/ai/${profileId}/insights`).then(r => {
      const d = r.data?.data ?? r.data;
      return d as InsightsData;
    }),
    enabled: !!profileId,
  });

  const { data: weekly, isLoading: loadingWeekly } = useQuery({
    queryKey: ['ai-weekly', profileId],
    queryFn: () => api.get(`/ai/${profileId}/weekly`).then(r => {
      const d = r.data?.data ?? r.data;
      return d as WeeklyDigest;
    }),
    enabled: !!profileId,
  });

  const { data: keywordData } = useQuery({
    queryKey: ['ai-keywords', profileId],
    queryFn: () => api.get(`/ai/${profileId}/keywords`).then(r => r.data as KeywordData).catch(() => null),
    enabled: !!profileId,
  });

  const { data: socialAlerts } = useQuery({
    queryKey: ['social-alerts', profileId],
    queryFn: () => api.get(`/analytics/${profileId}/social-alerts`)
      .then(r => r.data as SocialAlert[])
      .catch(() => [] as SocialAlert[]),
    enabled: !!profileId,
    refetchInterval: 2 * 60 * 1000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => api.post(`/analytics/social-alerts/${alertId}/acknowledge`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social-alerts', profileId] }),
  });

  if (!children || children.length === 0) {
    return (
      <AnimatedPage>
        <PageHeader icon={<PsychologyIcon />} title="AI Insights" subtitle="AI-powered behavior analysis" iconColor="#7B1FA2" />
        <EmptyState title="No child profiles" description="Add a child profile to see AI insights" />
      </AnimatedPage>
    );
  }

  const isLoading = loadingInsights || loadingWeekly;

  // Build weekly trend chart data — prefer real data from insights
  const rawTrend = insights?.weeklyTrend ?? [];
  const weeklyChartData = rawTrend.length >= 7
    ? rawTrend.map(d => ({
        day: shortDate(d.date),
        allowed: d.allowed,
        blocked: d.blocked,
      }))
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
        day,
        allowed: 0,
        blocked: 0,
      }));

  // Keyword bar chart data
  const keywords = keywordData?.keywords || {};
  const keywordChartData = Object.entries(keywords)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  // No-data state (new profile)
  const showNoData = insights?.hasData === false;

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PsychologyIcon />}
        title="AI Insights"
        subtitle="AI-powered behavior analysis and risk assessment"
        iconColor="#7B1FA2"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {(children || []).map(c => (
              <Chip
                key={c.id}
                label={c.name}
                onClick={() => setSelectedChild(c.id)}
                sx={{
                  fontWeight: 600,
                  bgcolor: (profileId === c.id) ? '#7B1FA2' : '#F3E5F5',
                  color: (profileId === c.id) ? 'white' : '#7B1FA2',
                  '&:hover': { bgcolor: (profileId === c.id) ? '#6A1B9A' : '#E1BEE7' },
                }}
              />
            ))}
          </Stack>
        }
      />

      {/* Tab bar */}
      <Box sx={{ borderBottom: '1px solid #F0F0F0', mb: 2.5 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ '& .MuiTab-root': { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 44 } }}
        >
          <Tab label="Overview" />
          <Tab label="Trends" />
          <Tab label="Alerts" />
          <Tab label="Ask AI" icon={<SmartToyIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Ask AI tab */}
      {activeTab === 3 && <AskAiTab profileId={profileId} />}

      {/* Analytics tabs 0-2 */}
      {activeTab !== 3 && (
        isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
        ) : showNoData ? (
          <NoDataEmptyState profileName={selectedChildObj?.name} />
        ) : (
        <Grid container spacing={2.5}>

          {/* ── Row 1: Risk Score + Addiction + Trend + Mental Health ── */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <AnimatedPage delay={0.1}>
              <Card sx={{ textAlign: 'center' }}>
                <CardContent sx={{ py: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>Risk Score</Typography>
                  <RiskGauge
                    score={insights?.riskScore ?? 0}
                    level={insights?.riskLevel ?? 'LOW'}
                  />
                  {insights?.summary && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block', lineHeight: 1.4 }}>
                      {insights.summary}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <AnimatedPage delay={0.15}>
              <Card sx={{ textAlign: 'center' }}>
                <CardContent sx={{ py: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>Addiction Score</Typography>
                  <RiskGauge
                    score={insights?.addictionScore ?? 0}
                    level={(insights?.addictionScore ?? 0) > 60 ? 'HIGH' : (insights?.addictionScore ?? 0) > 35 ? 'MEDIUM' : 'LOW'}
                  />
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <AnimatedPage delay={0.2}>
              <Card>
                <CardContent sx={{ py: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Usage Trend</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {TREND_ICONS[weekly?.usageTrend || 'STABLE']}
                    <Typography variant="h6" fontWeight={700}>
                      {weekly?.usageTrend || 'STABLE'}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Week of {weekly?.weekOf || 'N/A'}
                  </Typography>
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <AnimatedPage delay={0.25}>
              <Card>
                <CardContent sx={{ py: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <FavoriteIcon sx={{ color: '#E91E63', fontSize: 20 }} />
                    <Typography variant="subtitle2" color="text.secondary">Mental Health</Typography>
                  </Box>
                  {(insights?.mentalHealthSignals || []).length === 0 ? (
                    <Chip label="No concerns" size="small" sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 600 }} />
                  ) : (
                    <Stack spacing={0.5}>
                      {(insights?.mentalHealthSignals || []).slice(0, 3).map((s, i) => (
                        <Typography key={i} variant="caption" color="warning.main">{s}</Typography>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>

          {/* ── Row 2: Screen Time Stats ── */}
          {insights?.hasData && (
            <>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AnimatedPage delay={0.28}>
                  <StatCard
                    icon={<AccessTimeIcon />}
                    label="Screen Time"
                    value={fmtMinutes(insights.screenTimeMinutes)}
                    sub="this week"
                    color="#7B1FA2"
                  />
                </AnimatedPage>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AnimatedPage delay={0.3}>
                  <StatCard
                    icon={<TodayIcon />}
                    label="Daily Average"
                    value={fmtMinutes(insights.dailyAvgMinutes)}
                    sub="per day"
                    color="#0288D1"
                  />
                </AnimatedPage>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AnimatedPage delay={0.32}>
                  <StatCard
                    icon={<BlockIcon />}
                    label="Blocked Requests"
                    value={`${insights.totalBlocked}`}
                    sub="this week"
                    color="#E53935"
                  />
                </AnimatedPage>
              </Grid>
            </>
          )}

          {/* ── Weekly AI Report ── */}
          {weekly && (
            <Grid size={12}>
              <AnimatedPage delay={0.35}>
                <WeeklyReportCard weekly={weekly} insights={insights} />
              </AnimatedPage>
            </Grid>
          )}

          {/* ── Weekly Usage Trend Chart ── */}
          <Grid size={{ xs: 12, md: 7 }}>
            <AnimatedPage delay={0.38}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                    Weekly Usage Trend
                  </Typography>
                  <Box sx={{ height: 250 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value: number, name: string) => [value, name === 'allowed' ? 'Allowed' : 'Blocked']}
                        />
                        <Area type="monotone" dataKey="allowed" stroke="#7B1FA2" fill="#F3E5F5" name="allowed" />
                        <Area type="monotone" dataKey="blocked" stroke="#E53935" fill="#FFEBEE" name="blocked" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>

          {/* ── Top Categories ── */}
          <Grid size={{ xs: 12, md: 5 }}>
            <AnimatedPage delay={0.4}>
              <TopCategoriesCard categories={insights?.topCategories ?? []} />
            </AnimatedPage>
          </Grid>

          {/* ── Risk Indicators ── */}
          {insights && (insights.indicators?.length ?? 0) > 0 && (
            <Grid size={{ xs: 12, md: 6 }}>
              <AnimatedPage delay={0.42}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Risk Indicators</Typography>
                    <Stack spacing={1.5}>
                      {insights.indicators.map((ind, i) => {
                        const sev = SEVERITY_CONFIG[ind.severity] || SEVERITY_CONFIG.LOW;
                        return (
                          <Box
                            key={i}
                            sx={{
                              display: 'flex', alignItems: 'flex-start', gap: 1.5,
                              p: 1.5, borderRadius: 2, bgcolor: sev.bg,
                            }}
                          >
                            <Box sx={{ color: sev.color, mt: 0.3, '& .MuiSvgIcon-root': { fontSize: 20 } }}>
                              {sev.icon}
                            </Box>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{ind.type}</Typography>
                              <Typography variant="caption" color="text.secondary">{ind.description}</Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={ind.severity}
                              sx={{ ml: 'auto', height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'white', color: sev.color }}
                            />
                          </Box>
                        );
                      })}
                    </Stack>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          )}

          {/* ── AI Anomaly Events ── */}
          {(insights?.anomalies?.length ?? 0) > 0 && (
            <Grid size={{ xs: 12, md: (insights?.indicators?.length ?? 0) > 0 ? 6 : 12 }}>
              <AnimatedPage delay={0.44}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={600}>AI Anomaly Alerts</Typography>
                      <Chip
                        label={`${insights!.anomalies.length} detected`}
                        size="small"
                        sx={{ bgcolor: '#FFEBEE', color: '#C62828', fontWeight: 700 }}
                      />
                    </Box>
                    <Stack spacing={1.5}>
                      {insights!.anomalies.map((ev, i) => (
                        <AnomalyRow key={i} event={ev} />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          )}

          {/* ── Smart Recommendations ── */}
          {(insights?.recommendations?.length ?? 0) > 0 && (
            <Grid size={12}>
              <AnimatedPage delay={0.46}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={600}>Smart Recommendations</Typography>
                      <Chip
                        label={`${insights!.recommendations.length} suggestions`}
                        size="small"
                        sx={{ bgcolor: '#F3E5F5', color: '#7B1FA2', fontWeight: 600 }}
                      />
                    </Box>
                    <Grid container spacing={2}>
                      {insights!.recommendations.map((rec, i) => (
                        <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                          <RecommendationCard rec={rec} />
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          )}

          {/* ── Social Monitoring Alerts ── */}
          {(socialAlerts && socialAlerts.length > 0) && (
            <Grid size={12}>
              <AnimatedPage delay={0.48}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={600}>Social Monitoring Alerts</Typography>
                      <Chip
                        label={`${socialAlerts.filter(a => !a.acknowledged).length} unread`}
                        size="small"
                        sx={{ bgcolor: '#FFEBEE', color: '#C62828', fontWeight: 700 }}
                      />
                    </Box>
                    <Stack spacing={1.5}>
                      {socialAlerts.slice(0, 10).map(alert => {
                        const colors = SOCIAL_ALERT_COLORS[alert.severity] || SOCIAL_ALERT_COLORS.LOW;
                        const icon = SOCIAL_ALERT_ICONS[alert.alertType] || <NewReleasesIcon sx={{ fontSize: 20 }} />;
                        return (
                          <Box
                            key={alert.id}
                            sx={{
                              display: 'flex', alignItems: 'flex-start', gap: 1.5,
                              p: 1.5, borderRadius: 2,
                              bgcolor: alert.acknowledged ? '#FAFAFA' : colors.bg,
                              opacity: alert.acknowledged ? 0.6 : 1,
                              border: '1px solid',
                              borderColor: alert.acknowledged ? '#E0E0E0' : `${colors.color}40`,
                            }}
                          >
                            <Box sx={{ color: colors.color, mt: 0.2 }}>{icon}</Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Chip
                                  label={alert.alertType.replace('_', ' ')}
                                  size="small"
                                  sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'white', color: colors.color }}
                                />
                                <Chip
                                  label={alert.severity}
                                  size="small"
                                  sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: colors.color, color: 'white' }}
                                />
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                  {new Date(alert.detectedAt).toLocaleString()}
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary">{alert.description}</Typography>
                            </Box>
                            {!alert.acknowledged && (
                              <MuiTooltip title="Mark as read">
                                <IconButton
                                  size="small"
                                  onClick={() => acknowledgeMutation.mutate(alert.id)}
                                  sx={{ color: colors.color }}
                                >
                                  <CheckCircleOutlineIcon fontSize="small" />
                                </IconButton>
                              </MuiTooltip>
                            )}
                          </Box>
                        );
                      })}
                    </Stack>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          )}

          {/* ── Keyword Analysis ── */}
          {keywordChartData.length > 0 && (
            <Grid size={12}>
              <AnimatedPage delay={0.5}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Top Search Keywords</Typography>
                    <Box sx={{ height: 250 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={keywordChartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis dataKey="word" type="category" tick={{ fontSize: 12 }} width={100} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#7B1FA2" radius={[0, 4, 4, 0]} name="Searches" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          )}
        </Grid>
        )
      )}
    </AnimatedPage>
  );
}
