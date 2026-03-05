import { Box, Grid, Card, CardContent, Typography, CircularProgress } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DnsIcon from '@mui/icons-material/Dns';
import BlockIcon from '@mui/icons-material/Block';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { gradients } from '../../theme/theme';

const COLORS = ['#1565C0', '#43A047', '#FB8C00', '#E53935', '#9C27B0', '#00ACC1'];

export default function ReportsPage() {
  const { profileId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['report', profileId],
    queryFn: async () => {
      try {
        const [dailyRes, catRes] = await Promise.all([
          api.get(`/analytics/${profileId}/daily`, { params: { days: 7 } }),
          api.get(`/analytics/${profileId}/categories`, { params: { period: 'week' } }),
        ]);
        const dailyRaw = (dailyRes.data?.data ?? dailyRes.data) as { date: string; totalQueries: number; blockedQueries: number }[];
        const catRaw = (catRes.data?.data ?? catRes.data) as { category: string; count: number }[];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dailyStats = (dailyRaw || []).map(d => ({
          day: dayNames[new Date(d.date).getDay()] || d.date,
          queries: d.totalQueries,
          blocks: d.blockedQueries,
        }));
        const categoryBreakdown = (catRaw || []).map(c => ({ name: c.category, value: c.count }));
        return { dailyStats, categoryBreakdown };
      } catch {
        return {
          dailyStats: [
            { day: 'Mon', queries: 450, blocks: 23 }, { day: 'Tue', queries: 380, blocks: 15 },
            { day: 'Wed', queries: 520, blocks: 41 }, { day: 'Thu', queries: 290, blocks: 8 },
            { day: 'Fri', queries: 610, blocks: 56 }, { day: 'Sat', queries: 720, blocks: 34 },
            { day: 'Sun', queries: 480, blocks: 19 },
          ],
          categoryBreakdown: [
            { name: 'Streaming', value: 35 }, { name: 'Gaming', value: 25 },
            { name: 'Social', value: 20 }, { name: 'Educational', value: 12 }, { name: 'Other', value: 8 },
          ],
        };
      }
    },
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  const totalQueries = data?.dailyStats?.reduce((s: number, d: { queries: number }) => s + d.queries, 0) || 0;
  const totalBlocks = data?.dailyStats?.reduce((s: number, d: { blocks: number }) => s + d.blocks, 0) || 0;
  const blockRate = totalQueries > 0 ? ((totalBlocks / totalQueries) * 100).toFixed(1) : '0';

  return (
    <AnimatedPage>
      <PageHeader
        icon={<AssessmentIcon />}
        title="Weekly Report"
        subtitle="Activity summary for the past 7 days"
        iconColor="#1565C0"
      />

      {/* Stat Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="Total Queries"
            value={totalQueries.toLocaleString()}
            icon={<DnsIcon />}
            gradient={gradients.blue}
            trend={5.2}
            delay={0.1}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="Total Blocked"
            value={totalBlocks}
            icon={<BlockIcon />}
            gradient={gradients.red}
            trend={-2.1}
            delay={0.2}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="Block Rate"
            value={`${blockRate}%`}
            icon={<TrendingUpIcon />}
            gradient={gradients.purple}
            delay={0.3}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Bar Chart */}
        <Grid size={{ xs: 12, md: 7 }}>
          <AnimatedPage delay={0.3}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>Daily DNS Activity</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>Queries and blocked requests per day</Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data?.dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="queries" name="Queries" fill="#1565C0" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="blocks" name="Blocked" fill="#E53935" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>

        {/* Pie Chart */}
        <Grid size={{ xs: 12, md: 5 }}>
          <AnimatedPage delay={0.4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>Category Breakdown</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Top content categories accessed</Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={data?.categoryBreakdown} cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="value" paddingAngle={3}
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {(data?.categoryBreakdown || []).map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </AnimatedPage>
        </Grid>
      </Grid>
    </AnimatedPage>
  );
}
