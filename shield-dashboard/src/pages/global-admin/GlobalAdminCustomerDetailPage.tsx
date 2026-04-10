import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, CircularProgress, Button,
  Chip, Avatar, Stack, Divider, Table, TableHead, TableRow, TableCell,
  TableBody, Alert,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import BusinessIcon from '@mui/icons-material/Business';
import ShieldIcon from '@mui/icons-material/Shield';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

/* ─── Types ───────────────────────────────────────────── */
interface Customer {
  id: string;
  name?: string;
  email?: string;
  userId?: string;
  tenantId?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  profileCount?: number;
  maxProfiles?: number;
  createdAt?: string;
  joinedAt?: string;
}

interface ChildProfile {
  id: string;
  name?: string;
  age?: number;
  filterLevel?: string;
  online?: boolean;
  blocksToday?: number;
  dnsClientId?: string;
}

interface Tenant {
  id: string;
  name: string;
  slug?: string;
  plan?: string;
  status?: string;
}

/* ─── Helpers ─────────────────────────────────────────── */
const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  FREE:       { bg: '#F5F5F5', text: '#757575' },
  BASIC:      { bg: '#E3F2FD', text: '#1565C0' },
  PREMIUM:    { bg: '#F3E5F5', text: '#7B1FA2' },
  ENTERPRISE: { bg: '#FFF8E1', text: '#7C4700' },
};

const FILTER_COLORS: Record<string, { bg: string; text: string }> = {
  STRICT:   { bg: '#FFEBEE', text: '#C62828' },
  MODERATE: { bg: '#FFF8E1', text: '#7C4700' },
  RELAXED:  { bg: '#E8F5E9', text: '#2E7D32' },
  CUSTOM:   { bg: '#E3F2FD', text: '#1565C0' },
};

function getInitials(name?: string) {
  if (!name) return 'C';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── Info Row ────────────────────────────────────────── */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1 }}>
      <Box sx={{ color: '#64748B', mt: 0.2, flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={500} display="block">{label}</Typography>
        <Box>{value}</Box>
      </Box>
    </Box>
  );
}

/* ─── Main Component ──────────────────────────────────── */
export default function GlobalAdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [childPage] = useState(0);

  /* Customer record */
  const { data: customer, isLoading: loadingCustomer, isError: customerError } = useQuery<Customer>({
    queryKey: ['ga-customer', id],
    queryFn: async () => {
      const r = await api.get(`/profiles/customers/${id}`);
      return r.data?.data ?? r.data;
    },
    enabled: !!id,
  });

  /* Tenant info (ISP) */
  const { data: tenant } = useQuery<Tenant | null>({
    queryKey: ['ga-tenant-for-customer', customer?.tenantId],
    queryFn: async () => {
      if (!customer?.tenantId) return null;
      const r = await api.get(`/tenants/${customer.tenantId}`).catch(() => null);
      if (!r) return null;
      return r.data?.data ?? r.data;
    },
    enabled: !!customer?.tenantId,
  });

  /* Child profiles */
  const { data: children = [], isLoading: loadingChildren } = useQuery<ChildProfile[]>({
    queryKey: ['ga-children-for-customer', id, childPage],
    queryFn: async () => {
      const r = await api.get('/profiles/children', { params: { customerId: id, page: childPage, size: 20 } })
        .catch(() => ({ data: { data: [] } }));
      const d = r.data?.data;
      return (d?.content ?? d ?? []) as ChildProfile[];
    },
    enabled: !!id,
  });

  if (loadingCustomer) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (customerError || !customer) {
    return (
      <AnimatedPage>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">Customer not found or could not be loaded.</Alert>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/customers')} sx={{ mt: 2 }}>
            Back to Customers
          </Button>
        </Box>
      </AnimatedPage>
    );
  }

  const plan = customer.subscriptionPlan ?? 'FREE';
  const planColor = PLAN_COLORS[plan] ?? PLAN_COLORS.FREE;
  const status = customer.subscriptionStatus ?? 'ACTIVE';

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PersonIcon />}
        title={customer.name ?? `Customer ${id?.slice(0, 8)}…`}
        subtitle={customer.email ?? 'No email on record'}
        iconColor="#00897B"
        action={
          <Button
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            size="small"
            onClick={() => navigate('/admin/customers')}
            sx={{ borderRadius: 2 }}
          >
            All Customers
          </Button>
        }
      />

      <Grid container spacing={3}>
        {/* Left column — customer info card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
                <Avatar
                  sx={{ width: 72, height: 72, fontSize: 24, fontWeight: 700, bgcolor: '#00897B', mb: 1.5 }}
                >
                  {getInitials(customer.name)}
                </Avatar>
                <Typography fontWeight={700} fontSize={18} textAlign="center">
                  {customer.name ?? 'Unknown'}
                </Typography>
                {customer.email && (
                  <Typography variant="body2" color="text.secondary" textAlign="center" mt={0.5}>
                    {customer.email}
                  </Typography>
                )}
                <Stack direction="row" spacing={1} mt={1.5}>
                  <Chip
                    size="small"
                    label={plan}
                    sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: planColor.bg, color: planColor.text }}
                  />
                  <Chip
                    size="small"
                    label={status}
                    color={status === 'ACTIVE' ? 'success' : 'error'}
                    sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                  />
                </Stack>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <InfoRow
                icon={<EmailIcon fontSize="small" />}
                label="Email"
                value={<Typography variant="body2">{customer.email ?? '—'}</Typography>}
              />
              <InfoRow
                icon={<CalendarTodayIcon fontSize="small" />}
                label="Joined"
                value={<Typography variant="body2">{formatDate(customer.createdAt ?? customer.joinedAt)}</Typography>}
              />
              <InfoRow
                icon={<ChildCareIcon fontSize="small" />}
                label="Child Profiles"
                value={
                  <Chip
                    size="small"
                    label={`${customer.profileCount ?? children.length} / ${customer.maxProfiles ?? '?'}`}
                    sx={{ height: 20, fontSize: 11, fontWeight: 600, bgcolor: '#E3F2FD', color: '#1565C0' }}
                  />
                }
              />
              <InfoRow
                icon={<ShieldIcon fontSize="small" />}
                label="Subscription Plan"
                value={
                  <Chip
                    size="small"
                    label={plan}
                    sx={{ height: 20, fontSize: 11, fontWeight: 600, bgcolor: planColor.bg, color: planColor.text }}
                  />
                }
              />

              {tenant && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <InfoRow
                    icon={<BusinessIcon fontSize="small" />}
                    label="ISP / Tenant"
                    value={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight={600}>{tenant.name}</Typography>
                        <Button
                          size="small"
                          endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                          onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                          sx={{ minWidth: 0, p: 0, fontSize: 11, ml: 0.5, textTransform: 'none', color: '#1565C0' }}
                        >
                          View
                        </Button>
                      </Box>
                    }
                  />
                  {tenant.plan && (
                    <InfoRow
                      icon={<ShieldIcon fontSize="small" />}
                      label="ISP Plan"
                      value={<Typography variant="body2">{tenant.plan}</Typography>}
                    />
                  )}
                </>
              )}

              {customer.userId && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <InfoRow
                    icon={<PersonIcon fontSize="small" />}
                    label="Auth User ID"
                    value={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontFamily="monospace" fontSize={11}>
                          {customer.userId}
                        </Typography>
                        <Button
                          size="small"
                          endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                          onClick={() => navigate(`/admin/users/${customer.userId}`)}
                          sx={{ minWidth: 0, p: 0, fontSize: 11, ml: 0.5, textTransform: 'none', color: '#1565C0' }}
                        >
                          View
                        </Button>
                      </Box>
                    }
                  />
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right column — child profiles */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography fontWeight={700} fontSize={15} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ChildCareIcon fontSize="small" sx={{ color: '#00897B' }} />
                Child Profiles
                <Chip size="small" label={children.length} sx={{ height: 20, fontSize: 11, ml: 0.5, bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 700 }} />
              </Typography>

              {loadingChildren ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : children.length === 0 ? (
                <EmptyState
                  icon={<ChildCareIcon sx={{ fontSize: 36, color: '#00897B' }} />}
                  title="No child profiles"
                  description="This customer has not set up any child profiles yet"
                />
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                      {['Name', 'Age', 'Filter Level', 'DNS Client', 'Status'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 600, color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {children.map(child => {
                      const fl = child.filterLevel ?? 'MODERATE';
                      const fc = FILTER_COLORS[fl] ?? FILTER_COLORS.MODERATE;
                      return (
                        <TableRow
                          key={child.id}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#F5F9FF' },
                          }}
                          onClick={() => navigate(`/admin/child-profiles/${child.id}`)}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 700, bgcolor: '#00897B' }}>
                                {getInitials(child.name)}
                              </Avatar>
                              <Typography fontWeight={600} fontSize={13}>{child.name ?? '—'}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{child.age ? `${child.age} yrs` : '—'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={fl} sx={{ height: 20, fontSize: 11, fontWeight: 600, bgcolor: fc.bg, color: fc.text }} />
                          </TableCell>
                          <TableCell>
                            {child.dnsClientId ? (
                              <Typography variant="body2" fontFamily="monospace" fontSize={11}>{child.dnsClientId}</Typography>
                            ) : (
                              <Typography variant="caption" color="text.disabled">—</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={child.online ? 'Online' : 'Offline'}
                              color={child.online ? 'success' : 'default'}
                              sx={{ height: 20, fontSize: 11, fontWeight: 600 }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </AnimatedPage>
  );
}
