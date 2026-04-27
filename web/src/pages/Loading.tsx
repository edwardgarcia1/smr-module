import React from 'react';
import { Box, Skeleton } from '@mui/material';
import AppLayout from '../layouts/AppLayout';

const Loading: React.FC = () => {
  return (
    <AppLayout currentTab="" isLoading={true}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          width: '100%',
          height: '100%',
        }}
      >
        {/* Header section */}
        <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
          <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1, flex: 1 }} />
          <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1, width: 100 }} />
        </Box>
        
        {/* Main content area */}
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1, mb: 2 }} />
        
        {/* Cards section */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1, flex: 1 }} />
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1, flex: 1 }} />
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1, flex: 1 }} />
        </Box>
      </Box>
    </AppLayout>
  );
};

export default Loading;
