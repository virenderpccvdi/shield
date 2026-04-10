import React from 'react';
import { Box, Typography, Button, Stack, Divider } from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in development; swap for a real error tracking service in production
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            p: 4,
            textAlign: 'center',
          }}
        >
          {/* Shield logo */}
          <Box
            sx={{
              width: 72, height: 72, borderRadius: '18px',
              background: 'linear-gradient(135deg, #003D72 0%, #005DAC 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mb: 2.5, boxShadow: '0 8px 24px rgba(0,93,172,0.25)',
            }}
          >
            <ShieldIcon sx={{ fontSize: 40, color: '#ffffff' }} />
          </Box>

          <ErrorOutlineIcon sx={{ fontSize: 36, color: 'error.main', mb: 1 }} />

          <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
            Something went wrong
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 480 }}>
            An unexpected error occurred in the Shield dashboard. You can try refreshing
            the page or navigating back to the dashboard.
          </Typography>

          {/* Dev-only error details */}
          {isDev && this.state.error && (
            <Box
              sx={{
                mb: 3, p: 2, borderRadius: 2, bgcolor: '#FFF3F3',
                border: '1px solid #FFCDD2', maxWidth: 560, width: '100%',
                textAlign: 'left', overflow: 'auto',
              }}
            >
              <Divider sx={{ mb: 1 }}>
                <Typography variant="caption" color="error">Error details (dev only)</Typography>
              </Divider>
              <Typography
                variant="caption"
                component="pre"
                sx={{ fontFamily: 'monospace', fontSize: 11, color: 'error.dark', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
              >
                {this.state.error.message}
                {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
              </Typography>
            </Box>
          )}

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => window.location.reload()}
            >
              Refresh page
            </Button>
            <Button
              variant="contained"
              startIcon={<HomeIcon />}
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                // Navigate to root — BrowserRouter basename will handle the rest
                window.location.href = window.location.origin + '/app/';
              }}
            >
              Go to dashboard
            </Button>
          </Stack>
        </Box>
      );
    }
    return this.props.children;
  }
}
