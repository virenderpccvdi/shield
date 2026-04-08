import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ShieldIcon from '@mui/icons-material/Shield';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: '#F8FAFC',
        gap: 2,
        p: { xs: 2, md: 4 },
      }}
    >
      <ShieldIcon sx={{ fontSize: 64, color: '#1565C0', opacity: 0.4 }} />
      <Typography variant="h3" fontWeight={800} color="text.primary">
        404
      </Typography>
      <Typography variant="h6" fontWeight={600} color="text.secondary">
        Page not found
      </Typography>
      <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', maxWidth: 360 }}>
        The page you are looking for doesn't exist or has been moved.
      </Typography>
      <Button
        variant="contained"
        onClick={() => navigate('/')}
        sx={{ mt: 2, borderRadius: 2, px: 4, bgcolor: '#1565C0', '&:hover': { bgcolor: '#0D47A1' } }}
      >
        Go Home
      </Button>
    </Box>
  );
}
