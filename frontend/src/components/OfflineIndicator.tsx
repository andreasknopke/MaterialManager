/**
 * OfflineIndicator Component
 * Zeigt den Offline-Status und ausstehende Synchronisierungen an
 */

import React, { useState } from 'react';
import {
  Snackbar,
  Alert,
  Badge,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  LinearProgress,
  Chip
} from '@mui/material';
import {
  CloudOff as CloudOffIcon,
  CloudDone as CloudDoneIcon,
  Sync as SyncIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import useOffline from '../hooks/useOffline';

const OfflineIndicator: React.FC = () => {
  const { isOnline, pendingCount, isSyncing, lastSyncTime, syncNow, getPendingChanges } = useOffline();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);
  const [showOfflineSnackbar, setShowOfflineSnackbar] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: number; failed: number } | null>(null);

  // Snackbar bei Offline-Status zeigen
  React.useEffect(() => {
    if (!isOnline) {
      setShowOfflineSnackbar(true);
    }
  }, [isOnline]);

  const handleOpenDialog = async () => {
    const changes = await getPendingChanges();
    setPendingChanges(changes);
    setDialogOpen(true);
  };

  const handleSync = async () => {
    try {
      const result = await syncNow();
      setSyncResult(result);
      const changes = await getPendingChanges();
      setPendingChanges(changes);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const getChangeTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'post_materials': 'Material hinzugefügt',
      'put_materials': 'Material bearbeitet',
      'delete_materials': 'Material gelöscht',
      'post_cabinets': 'Schrank hinzugefügt',
      'put_cabinets': 'Schrank bearbeitet',
      'delete_cabinets': 'Schrank gelöscht',
      'post_categories': 'Kategorie hinzugefügt',
      'put_categories': 'Kategorie bearbeitet',
      'post_companies': 'Firma hinzugefügt',
      'put_companies': 'Firma bearbeitet'
    };
    return labels[type] || type;
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };

  return (
    <>
      {/* Status-Icon in der Toolbar */}
      <Tooltip title={isOnline ? 
        `Online${pendingCount > 0 ? ` - ${pendingCount} Änderung(en) ausstehend` : ''}` : 
        'Offline - Änderungen werden lokal gespeichert'
      }>
        <IconButton
          color="inherit"
          onClick={handleOpenDialog}
          sx={{ ml: 1 }}
        >
          <Badge 
            badgeContent={pendingCount} 
            color="warning"
            max={99}
          >
            {isOnline ? (
              isSyncing ? <SyncIcon className="spin" /> : <CloudDoneIcon />
            ) : (
              <CloudOffIcon color="error" />
            )}
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Offline-Snackbar */}
      <Snackbar
        open={showOfflineSnackbar && !isOnline}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={() => setShowOfflineSnackbar(false)}
      >
        <Alert 
          severity="warning" 
          variant="filled"
          onClose={() => setShowOfflineSnackbar(false)}
          icon={<CloudOffIcon />}
        >
          Sie sind offline. Änderungen werden lokal gespeichert und später synchronisiert.
        </Alert>
      </Snackbar>

      {/* Online-wieder-Snackbar */}
      <Snackbar
        open={isOnline && pendingCount > 0 && !isSyncing}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity="info" 
          variant="filled"
          action={
            <Button color="inherit" size="small" onClick={handleSync}>
              Jetzt synchronisieren
            </Button>
          }
        >
          Verbindung wiederhergestellt. {pendingCount} Änderung(en) bereit zur Synchronisierung.
        </Alert>
      </Snackbar>

      {/* Sync-Ergebnis Snackbar */}
      <Snackbar
        open={syncResult !== null}
        autoHideDuration={4000}
        onClose={() => setSyncResult(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={syncResult?.failed === 0 ? 'success' : 'warning'}
          variant="filled"
          onClose={() => setSyncResult(null)}
        >
          {syncResult?.success} Änderung(en) synchronisiert
          {syncResult?.failed ? `, ${syncResult.failed} fehlgeschlagen` : ''}
        </Alert>
      </Snackbar>

      {/* Detail-Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {isOnline ? <CloudDoneIcon color="success" /> : <CloudOffIcon color="error" />}
            Synchronisierungsstatus
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* Status-Übersicht */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Verbindungsstatus
              </Typography>
              <Chip 
                label={isOnline ? 'Online' : 'Offline'} 
                color={isOnline ? 'success' : 'error'} 
                size="small" 
              />
            </Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Ausstehende Änderungen
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {pendingCount}
              </Typography>
            </Box>
            {lastSyncTime && (
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Letzte Synchronisierung
                </Typography>
                <Typography variant="body2">
                  {lastSyncTime.toLocaleString('de-DE')}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Sync Progress */}
          {isSyncing && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Synchronisierung läuft...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {/* Ausstehende Änderungen Liste */}
          {pendingChanges.length > 0 ? (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Ausstehende Änderungen
              </Typography>
              <List dense>
                {pendingChanges.map((change, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <ScheduleIcon color="warning" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={getChangeTypeLabel(change.type)}
                      secondary={formatTime(change.timestamp)}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          ) : (
            <Box textAlign="center" py={3}>
              <CheckIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
              <Typography color="text.secondary">
                Alle Änderungen sind synchronisiert
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Schließen
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSync}
            disabled={!isOnline || isSyncing || pendingCount === 0}
            startIcon={isSyncing ? <SyncIcon className="spin" /> : <SyncIcon />}
          >
            {isSyncing ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CSS für Spin-Animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </>
  );
};

export default OfflineIndicator;
