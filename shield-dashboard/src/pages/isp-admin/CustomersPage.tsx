import { Box, Typography, Card, Paper, Table, TableHead, TableRow, TableCell, TableBody, Chip, TextField, InputAdornment, Avatar, Button, Stack, Snackbar } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';
import SkeletonTable from '../../components/SkeletonTable';
import EmptyState from '../../components/EmptyState';
import CreateCustomerDialog from '../../components/CreateCustomerDialog';

interface Customer {
  id: string; name: string; email: string; profiles: number; status: string;
  joinedAt: string; userId?: string; subscriptionPlan?: string;
  subscriptionStatus?: string; profileCount?: number;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const statusConfig: Record<string, { color: 'success' | 'error' | 'warning' | 'default'; bg: string }> = {
  ACTIVE: { color: 'success', bg: '#E8F5E9' },
  SUSPENDED: { color: 'error', bg: '#FFEBEE' },
  PENDING: { color: 'warning', bg: '#FFF8E1' },
};

const planColors: Record<string, { bg: string; text: string }> = {
  FREE: { bg: '#F5F5F5', text: '#757575' },
  BASIC: { bg: '#E3F2FD', text: '#1565C0' },
  PREMIUM: { bg: '#F3E5F5', text: '#7B1FA2' },
  ENTERPRISE: { bg: '#FFF8E1', text: '#F57F17' },
};

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [snack, setSnack] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['isp-customers'],
    queryFn: () => api.get('/profiles/customers').then(r => {
      const d = r.data?.data;
      return (d?.content ?? d) as Customer[];
    }).catch(() => []),
  });
  const customers = (data || []).filter(c => `${c.name} ${c.email}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <AnimatedPage>
      <PageHeader
        icon={<PeopleIcon />}
        title="Customers"
        subtitle={`${(data || []).length} registered customers`}
        iconColor="#00897B"
        action={
          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              placeholder="Search customers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: '#9E9E9E' }} /></InputAdornment>,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: '#F8FAFC',
                  '&:hover': { bgcolor: '#F1F5F9' },
                  '&.Mui-focused': { bgcolor: '#fff' },
                },
              }}
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}
              sx={{ bgcolor: '#00897B', whiteSpace: 'nowrap', '&:hover': { bgcolor: '#00796B' } }}>
              Add Customer
            </Button>
          </Stack>
        }
      />

      <AnimatedPage delay={0.15}>
        <Card>
          <Paper elevation={0}>
            {isLoading ? (
              <SkeletonTable rows={5} columns={5} />
            ) : customers.length === 0 ? (
              <EmptyState
                icon={<PeopleIcon sx={{ fontSize: 36, color: '#00897B' }} />}
                title="No customers found"
                description={search ? 'Try adjusting your search terms' : 'Get started by adding your first customer'}
                action={search ? undefined : { label: 'Add Customer', onClick: () => setAddOpen(true) }}
              />
            ) : (
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    {['Customer', 'Email', 'Plan', 'Profiles', 'Status', 'Joined'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 600, color: '#64748B', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customers.map((c, i) => (
                    <TableRow
                      key={c.id}
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': { bgcolor: '#F5F9FF', transform: 'scale(1.002)' },
                        '@keyframes fadeInUp': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                        animation: `fadeInUp 0.3s ease ${0.1 + i * 0.05}s both`,
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: '#00897B' }}>
                            {getInitials(c.name)}
                          </Avatar>
                          <Typography fontWeight={600} fontSize={14}>{c.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{c.email}</Typography></TableCell>
                      <TableCell>
                        {(() => { const plan = c.subscriptionPlan || 'FREE'; const pc = planColors[plan] || planColors.FREE; return (
                          <Chip size="small" label={plan} sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: pc.bg, color: pc.text }} />
                        ); })()}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={c.profileCount ?? c.profiles ?? 0} sx={{ height: 22, minWidth: 28, bgcolor: '#E3F2FD', color: '#1565C0', fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={c.status}
                          color={statusConfig[c.status]?.color || 'default'}
                          sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{c.joinedAt}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Card>
      </AnimatedPage>

      <CreateCustomerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={(msg) => {
          setAddOpen(false);
          qc.invalidateQueries({ queryKey: ['isp-customers'] });
          setSnack(msg);
        }}
      />

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AnimatedPage>
  );
}
