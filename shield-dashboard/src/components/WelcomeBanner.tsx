import { useState } from 'react';
import {
  Box, Typography, Button, IconButton, Paper, Stack,
  Step, StepLabel, Stepper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import TuneIcon from '@mui/icons-material/Tune';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'welcome_dismissed';

const SETUP_STEPS = [
  {
    label: 'Add a child profile',
    description: 'Create a profile for each child with personalized filters',
    icon: <PersonAddIcon fontSize="small" />,
  },
  {
    label: 'Install Shield app',
    description: 'Download the Shield app on your child\'s device',
    icon: <PhoneAndroidIcon fontSize="small" />,
  },
  {
    label: 'Configure protection',
    description: 'Set content filters, schedules, and screen time limits',
    icon: <TuneIcon fontSize="small" />,
  },
];

interface WelcomeBannerProps {
  /** Only render when there are no child profiles */
  hasChildren?: boolean;
}

export default function WelcomeBanner({ hasChildren = false }: WelcomeBannerProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // If there are children or the banner was dismissed, don't show
  if (hasChildren || dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 3,
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid rgba(21,101,192,0.15)',
        background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 55%, #012A4A 100%)',
        position: 'relative',
      }}
    >
      {/* Decorative blobs */}
      <Box sx={{
        position: 'absolute', top: -40, right: -40,
        width: 180, height: 180, borderRadius: '50%',
        bgcolor: 'rgba(255,255,255,0.05)', pointerEvents: 'none',
      }} />
      <Box sx={{
        position: 'absolute', bottom: -20, left: '40%',
        width: 100, height: 100, borderRadius: '50%',
        bgcolor: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
      }} />

      {/* Dismiss button */}
      <IconButton
        size="small"
        onClick={handleDismiss}
        aria-label="Dismiss welcome banner"
        sx={{
          position: 'absolute', top: 10, right: 10, zIndex: 1,
          color: 'rgba(255,255,255,0.6)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' },
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2.5,
            bgcolor: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Box component="span" sx={{ fontSize: 22 }}>🛡️</Box>
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ color: 'white', lineHeight: 1.2 }}>
              Welcome to Shield!
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Get started in 3 easy steps to protect your family online
            </Typography>
          </Box>
        </Stack>

        {/* Stepper */}
        <Box sx={{
          bgcolor: 'rgba(255,255,255,0.08)',
          borderRadius: 2,
          p: { xs: 1.5, sm: 2 },
          mb: 2.5,
        }}>
          <Stepper
            activeStep={0}
            orientation="vertical"
            sx={{
              '& .MuiStepLabel-label': { color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem', fontWeight: 600 },
              '& .MuiStepLabel-label.Mui-active': { color: 'white', fontWeight: 700 },
              '& .MuiStepLabel-label.Mui-completed': { color: 'rgba(255,255,255,0.6)' },
              '& .MuiStepIcon-root': { color: 'rgba(255,255,255,0.3)' },
              '& .MuiStepIcon-root.Mui-active': { color: '#69F0AE' },
              '& .MuiStepConnector-line': { borderColor: 'rgba(255,255,255,0.2)' },
              '& .MuiStepContent-root': { borderColor: 'rgba(255,255,255,0.2)' },
            }}
          >
            {SETUP_STEPS.map((step, index) => (
              <Step key={step.label} expanded>
                <StepLabel
                  StepIconComponent={() => (
                    <Box sx={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      bgcolor: index === 0 ? '#69F0AE' : 'rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: index === 0 ? '#0D47A1' : 'rgba(255,255,255,0.6)',
                      fontSize: 13, fontWeight: 700,
                      mr: 0.5,
                    }}>
                      {index + 1}
                    </Box>
                  )}
                >
                  <Typography
                    component="span"
                    sx={{
                      color: index === 0 ? 'white' : 'rgba(255,255,255,0.75)',
                      fontWeight: index === 0 ? 700 : 500,
                      fontSize: '0.875rem',
                    }}
                  >
                    {step.label}
                  </Typography>
                </StepLabel>
                <Box sx={{ ml: 4.5, mb: 1 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
                    {step.description}
                  </Typography>
                </Box>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* CTA */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/profiles/new')}
            sx={{
              bgcolor: 'white',
              color: '#1565C0',
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              py: 1,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
            }}
          >
            Get Started
          </Button>
          <Button
            variant="text"
            onClick={handleDismiss}
            sx={{
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 500,
              fontSize: '0.8125rem',
              '&:hover': { color: 'white', bgcolor: 'transparent' },
            }}
          >
            Maybe later
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
