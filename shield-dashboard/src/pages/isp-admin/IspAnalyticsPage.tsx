import { useState, useEffect } from 'react';
import { Box, Grid, Card, CardContent, Typography, CircularProgress, Button } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import DownloadIcon from '@mui/icons-material/Download';
import DnsIcon from '@mui/icons-material/Dns';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BlockIcon from '@mui/icons-material/Block';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { gradients } from '../../theme/theme';
import { useAuthStore } from '../../store/auth.store';

interface DayQueries { day: string; queries: number; }

function exportIspCSV(data: DayQueries[], totalQueries: number, avgQueries: number) {
  const lines = [
    '# ISP Analytics Export',
    `"Generated","${new Date().toISOString()}"`,
    `"Total Queries This Week","${totalQueries}"`,
    `"Daily Average","${avgQueries}"`,
    '',
    '"Day","Queries"',
    ...data.map(d => `"${d.day}","${d.queries}"`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `isp-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}

function formatK(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

export default function IspAnalyticsPage() {
  const [data, setData] = useState<DayQueries[]>([]);
  const [loading, setLoading] = useState(true);
  const tenantId = useAuthStore(s => s.user?.tenantId);

  useEffect(() => {
    const endpoint = tenantId
      ? `/analytics/tenant/${tenantId}/daily?days=7`
      : '/analytics/platform/daily?days=7';
    api.get(endpoint)
      .then(res => {
        const d = Array.isArray(res.data) ? res.data : res.data?.data || [];
        if (d.length) {
          setData(d.map((p: any) => ({
            day: new Date(p.date).toLocaleDateString('en', { weekday: 'short' }),
            queries: p.totalQueries || 0,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantId]);

  const totalQueries = data.reduce((sum, d) => sum + d.queries, 0);
  const peakDay = data.length > 0 ? data.reduce((a, b) => a.queries > b.queries ? a : b) : null;
  const avgQueries = data.length > 0 ? Math.round(totalQueries / data.length) : 0;

  return (
    <AnimatedPage>
      <PageHeader icon={<BarChartIcon />} title="ISP Analytics" subtitle="Weekly DNS query volume for your customers" iconColor="#00897B"
        action={
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
            onClick={() => exportIspCSV(data, totalQueries, avgQueries)}
            disabled={data.length === 0} sx={{ borderRadius: 2 }}>
            Export CSV
          </Button>
        }
      />

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard title="Total Queries This Week" value={formatK(totalQueries)} icon={<DnsIcon />} gradient={gradients.teal} delay={0.1} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard title="Daily Average" value={formatK(avgQueries)} icon={<TrendingUpIcon />} gradient={gradients.blue} delay={0.2} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard title="Peak Day" value={peakDay ? peakDay.day : '--'} unit={peakDay ? formatK(peakDay.queries) : ''} icon={<BlockIcon />} gradient={gradients.purple} delay={0.3} />
        </Grid>
      </Grid>

      <AnimatedPage delay={0.3}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>Daily DNS Queries</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Query volume over the past 7 days</Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : data.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No DNS query data available yet. Data will appear once queries are logged.</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="ispGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00897B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00897B" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={formatK} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [formatK(v), 'DNS Queries']} />
                  <Area type="monotone" dataKey="queries" stroke="#00897B" strokeWidth={2.5} fill="url(#ispGradient)"
                    dot={{ r: 4, fill: '#00897B', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>
    </AnimatedPage>
  );
}
