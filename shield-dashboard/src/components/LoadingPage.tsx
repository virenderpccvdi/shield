import { Box, Skeleton, Card, CardContent } from '@mui/material';

/**
 * Full-page skeleton loading state — replaces CircularProgress spinners.
 * Shows shimmer skeleton cards matching the typical page layout.
 */
export default function LoadingPage({ cards = 4, hasTable = false }: { cards?: number; hasTable?: boolean }) {
  return (
    <Box sx={{ '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } }, animation: 'fadeIn 0.3s ease' }}>
      {/* Page header skeleton */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Skeleton variant="rounded" width={44} height={44} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width={200} height={28} />
          <Skeleton variant="text" width={140} height={18} />
        </Box>
        <Skeleton variant="rounded" width={120} height={36} />
      </Box>

      {/* Stat cards row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cards, 4)}, 1fr)`, gap: 2, mb: 3 }}>
        {Array.from({ length: Math.min(cards, 4) }).map((_, i) => (
          <Card key={i} sx={{ height: 100 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Skeleton variant="rounded" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="70%" height={28} />
                  <Skeleton variant="text" width="50%" height={16} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Content area */}
      {hasTable ? (
        <Card>
          <CardContent>
            <Box sx={{ mb: 2 }}>
              <Skeleton variant="text" width={160} height={24} />
            </Box>
            {Array.from({ length: 6 }).map((_, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Skeleton variant="circular" width={32} height={32} />
                <Skeleton variant="text" width="25%" />
                <Skeleton variant="text" width="20%" />
                <Skeleton variant="text" width="15%" />
                <Skeleton variant="rounded" width={80} height={22} />
              </Box>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
          <Card sx={{ height: 280 }}>
            <CardContent>
              <Skeleton variant="text" width={160} height={24} sx={{ mb: 2 }} />
              <Skeleton variant="rounded" width="100%" height={200} />
            </CardContent>
          </Card>
          <Card sx={{ height: 280 }}>
            <CardContent>
              <Skeleton variant="text" width={120} height={24} sx={{ mb: 2 }} />
              {Array.from({ length: 5 }).map((_, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="60%" height={16} />
                    <Skeleton variant="text" width="40%" height={13} />
                  </Box>
                  <Skeleton variant="rounded" width={60} height={22} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}
