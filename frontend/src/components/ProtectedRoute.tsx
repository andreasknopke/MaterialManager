import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requireAdmin?: boolean;
  requireRoot?: boolean;
}

const MAX_LOADING_TIME = 8000; // Max 8 Sekunden warten

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false,
  requireRoot = false 
}) => {
  const { user, loading, isAdmin, isRoot } = useAuth();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Timeout für Loading-State
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.warn('[ProtectedRoute] Loading timeout - forciere Login');
        setLoadingTimeout(true);
      }, MAX_LOADING_TIME);
      
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Bei Timeout: Zum Login weiterleiten
  if (loadingTimeout && loading) {
    console.log('[ProtectedRoute] Timeout erreicht - redirect zu Login');
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Authentifizierung wird geprüft...
        </Typography>
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireRoot && !isRoot) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
