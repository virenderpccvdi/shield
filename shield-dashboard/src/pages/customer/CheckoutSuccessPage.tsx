import { Box, Typography, Card, CardContent, Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AnimatedPage from '../../components/AnimatedPage';
import { useAuthStore } from '../../store/auth.store';

export default function CheckoutSuccessPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  // Invalidate subscription cache so updated plan loads immediately
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['my-subscription'] });
  }, []);

  const role = user?.role;
  const dashPath = role === 'ISP_ADMIN' ? '/isp/billing' : role === 'GLOBAL_ADMIN' ? '/admin/invoices' : '/dashboard';
  const dashLabel = role === 'ISP_ADMIN' ? 'Go to Billing' : role === 'GLOBAL_ADMIN' ? 'View Invoices' : 'Go to Dashboard';

  return (
    <AnimatedPage>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Card sx={{ maxWidth: 480, textAlign: 'center' }}>
          <CardContent sx={{ py: { xs: 4, md: 6 }, px: { xs: 2, md: 4 } }}>
            <CheckCircleIcon sx={{ fontSize: 80, color: '#43A047', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} gutterBottom>Payment Successful!</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Your subscription is now active. All plan features have been enabled on your account.
            </Typography>
            <Button variant="contained" size="large" onClick={() => navigate(dashPath)}
              sx={{ borderRadius: 2, bgcolor: '#43A047' }}>
              {dashLabel}
            </Button>
          </CardContent>
        </Card>
      </Box>
    </AnimatedPage>
  );
}
