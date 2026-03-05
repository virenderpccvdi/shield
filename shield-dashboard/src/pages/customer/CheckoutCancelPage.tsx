import { Box, Typography, Card, CardContent, Button } from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../../components/AnimatedPage';

export default function CheckoutCancelPage() {
  const navigate = useNavigate();
  return (
    <AnimatedPage>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Card sx={{ maxWidth: 480, textAlign: 'center' }}>
          <CardContent sx={{ py: 6, px: 4 }}>
            <CancelIcon sx={{ fontSize: 80, color: '#E53935', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} gutterBottom>Payment Cancelled</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Your payment was not processed. You can try again anytime.
            </Typography>
            <Button variant="contained" size="large" onClick={() => navigate('/subscription')}
              sx={{ borderRadius: 2 }}>
              Back to Plans
            </Button>
          </CardContent>
        </Card>
      </Box>
    </AnimatedPage>
  );
}
