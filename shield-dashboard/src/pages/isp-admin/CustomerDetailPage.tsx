import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Button,
  Chip, Avatar, Stack, Divider, Table, TableHead, TableRow, TableCell,
  TableBody
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DevicesIcon from '@mui/icons-material/Devices';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import BlockIcon from '@mui/icons-material/Block';
import DnsIcon from '@mui/icons-material/Dns';
import ShieldIcon from '@mui/icons-material/Shield';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface Customer {
  id: string;
  name: string;
  email: string;
  status: string;
  joinedAt: string;
  userId?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  profileCount?: number;
}

interface ChildProfile {
  id: string;
  name: string;
  age?: number;
  filterLevel?: string;
  online?: boolean;
  blocksToday?: number;
}

interface UsageStats {
  totalQueries?: number;
  totalBlocks?: number;
  activeDevices?: number;
  averageDailyUsage?: number;
}

const STATUS_COLORS: Record<string, { color: 'success' | 'error' | 'warning' | 'default'; }> = {
  ACTIVE: { color: 'success' },
  SUSPENDED: { color: 'error' },
  PENDING: { color: 'warning' },
};

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  FREE: { bg: '#F5F5F5', text: '#757575' },
  BASIC: { bg: '#E3F2FD', text: '#1565C0' },
  PREMIUM: { bg: '#F3E5F5', text: '#7B1FA2' },
  ENTERPRISE: { bg: '#FFF8E1', text: '#F57F17' },
};

const FILTER_COLORS: Record<string, { bg: string; text: string }> = {
  STRICT: { bg: '#FFEBEE', text: '#C62828' },
  MODERATE: { bg: '#FFF8E1', text: '#F57F17' },
  RELAXED: { bg: '#E8F5E9', text: '#2E7D32' },
  CUSTOM: { bg: '#E3F2FD', text: '#1565C0' },
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['isp-customer', id],
    queryFn: () => api.get(`/profiles/customers/${id}`).then(r => r.data?.data as Customer).catch(() => null),
    enabled: !!id,
  });

  const { data: profiles } = useQuery({
    queryKey: ['customer-profiles', id],
    queryFn: () => api.get(`/profiles/children`, { params: { customerId: id } }).then(r => {
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as ChildProfile[];
    }).catch(() => []),
    enabled: !!id,
  });

  const { data: stats } = useQuery({
    queryKey: ['customer-stats', id],
    queryFn: () => api.get(`/analytics/customer/${id}`).then(r => r.data?.data as UsageStats).catch(() => ({
      totalQueries: 0, totalBlocks: 0, activeDevices: 0, averageDailyUsage: 0,
    })),
    enabled: !!id,
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  if (!customer) {
    return (
      <AnimatedPage>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/isp/customers')} sx={{ mb: 2, color: 'text.secondary' }}>
          Back to Customers
        </Button>
        <EmptyState title="Customer not found" description="This customer may have been removed" />
      </AnimatedPage>
    );
  }

  const plan = customer.subscriptionPlan || 'FREE';
  const planColor = PLAN_COLORS[plan] || PLAN_COLORS.FREE;
  const statCards = [
    { label: 'DNS Queries', value: stats?.totalQueries ?? 0, icon: <DnsIcon />, color: '#1565C0', bg: '#E3F2FD' },
    { label: 'Blocked', value: stats?.totalBlocks ?? 0, icon: <BlockIcon />, color: '#E53935', bg: '#FFEBEE' },
    { label: 'Devices', value: stats?.activeDevices ?? 0, icon: <DevicesIcon />, color: '#00897B', bg: '#E0F2F1' },
    { label: 'Profiles', value: (profiles || []).length, icon: <ChildCareIcon />, color: '#7B1FA2', bg: '#F3E5F5' },
  ];

  return (
    <AnimatedPage>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/isp/customers')}
        sx={{ mb: 2, color: 'text.secondary', '&:hover': { bgcolor: '#F8FAFC' } }}>
        Back to Customers
      </Button>

      {/* Customer Header */}
      <AnimatedPage delay={0.1}>
        <Card sx={{ mb: 3, overflow: 'hidden' }}>
          <Box sx={{ height: 6, background: 'linear-gradient(135deg, #00897B 0%, #004D40 100%)' }} />
          <CardContent sx={{ pt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
              <Avatar sx={{
                width: 64, height: 64, fontSize: 22, fontWeight: 700,
                bgcolor: '#00897B', boxShadow: '0 4px 14px rgba(0,137,123,0.3)',
              }}>
                {getInitials(customer.name)}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                  <Typography variant="h5" fontWeight={700}>{customer.name}</Typography>
                  <Chip
                    size="small"
                    label={customer.status}
                    color={STATUS_COLORS[customer.status]?.color || 'default'}
                    sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                  />
                  <Chip
                    size="small"
                    label={plan}
                    sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: planColor.bg, color: planColor.text }}
                  />
                </Box>
                <Stack direction="row" spacing={2} sx={{ color: 'text.secondary' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <EmailIcon sx={{ fontSize: 16 }} />
                    <Typography variant="body2">{customer.email}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarTodayIcon sx={{ fontSize: 16 }} />
                    <Typography variant="body2">Joined {customer.joinedAt}</Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </AnimatedPage>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((stat, i) => (
          <Grid size={{ xs: 6, sm: 3 }} key={stat.label}>
            <AnimatedPage delay={0.15 + i * 0.05}>
              <Card sx={{ textAlign: 'center', transition: 'transform 0.2s ease', '&:hover': { transform: 'translateY(-3px)' } }}>
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: '10px',
                    bgcolor: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: stat.color, mx: 'auto', mb: 1,
                    '& .MuiSvgIcon-root': { fontSize: 20 },
                  }}>
                    {stat.icon}
                  </Box>
                  <Typography variant="h5" fontWeight={700} sx={{ color: stat.color }}>{stat.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                </CardContent>
              </Card>
            </AnimatedPage>
          </Grid>
        ))}
      </Grid>

      {/* Child Profiles Table */}
      <AnimatedPage delay={0.35}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <ShieldIcon sx={{ color: '#00897B' }} />
              <Typography variant="subtitle1" fontWeight={600}>Child Profiles</Typography>
            </Box>
            {(!profiles || profiles.length === 0) ? (
              <EmptyState
                icon={<ChildCareIcon sx={{ fontSize: 36, color: '#7B1FA2' }} />}
                title="No profiles"
                description="This customer hasn't created any child profiles yet"
              />
            ) : (
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    {['Name', 'Age', 'Filter Level', 'Status', 'Blocks Today'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, color: '#64748B', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {profiles.map((p, i) => {
                    const filterConf = FILTER_COLORS[p.filterLevel || 'MODERATE'] || FILTER_COLORS.MODERATE;
                    return (
                      <TableRow
                        key={p.id}
                        sx={{
                          transition: 'all 0.2s ease',
                          '&:hover': { bgcolor: '#F5F9FF' },
                          '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                          animation: `fadeInUp 0.3s ease ${0.1 + i * 0.05}s both`,
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 32, height: 32, fontSize: 12, fontWeight: 700, bgcolor: '#7B1FA2' }}>
                              {getInitials(p.name)}
                            </Avatar>
                            <Typography fontWeight={600} fontSize={14}>{p.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">{p.age ?? '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={p.filterLevel || 'MODERATE'}
                            sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: filterConf.bg, color: filterConf.text }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={p.online ? 'Online' : 'Offline'}
                            color={p.online ? 'success' : 'default'}
                            sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {p.blocksToday ?? 0}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </AnimatedPage>
    </AnimatedPage>
  );
}
