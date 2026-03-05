import { Box, Typography, Card, CardContent, Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../../components/AnimatedPage';

export default function CheckoutSuccessPage() {
  const navigate = useNavigate();
  return (
    <AnimatedPage>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Card sx={{ maxWidth: 480, textAlign: 'center' }}>
          <CardContent sx={{ py: 6, px: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 80, color: '#43A047', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} gutterBottom>Payment Successful!</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Your subscription is now active. All plan features have been enabled.
            </Typography>
            <Button variant="contained" size="large" onClick={() => navigate('/dashboard')}
              sx={{ borderRadius: 2, bgcolor: '#43A047' }}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </Box>
    </AnimatedPage>
  );
}
