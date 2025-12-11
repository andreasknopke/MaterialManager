import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Card,
  CardContent,
  CardActions,
  Grid,
  Divider,
  TextField,
} from '@mui/material';
import {
  Warning as WarningIcon,
  DeleteForever as DeleteForeverIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const Admin: React.FC = () => {
  const { isRoot } = useAuth();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleResetDatabase = async () => {
    if (confirmText !== 'DATENBANK LÖSCHEN') {
      setError('Bitte geben Sie den Bestätigungstext korrekt ein.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/admin/reset-database');
      setSuccess('Datenbank wurde erfolgreich geleert!');
      setConfirmDialogOpen(false);
      setConfirmText('');
      
      // Erfolg-Nachricht nach 3 Sekunden ausblenden
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Fehler beim Zurücksetzen der Datenbank:', err);
      setError(err.response?.data?.error || 'Fehler beim Zurücksetzen der Datenbank');
    } finally {
      setLoading(false);
    }
  };

  const openConfirmDialog = () => {
    setConfirmText('');
    setError(null);
    setConfirmDialogOpen(true);
  };

  const closeConfirmDialog = () => {
    setConfirmDialogOpen(false);
    setConfirmText('');
    setError(null);
  };

  const handleCabinetMigration = async () => {
    setMigrationLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/admin/run-cabinet-department-migration');
      setSuccess(response.data.message);
      
      // Erfolg-Nachricht nach 5 Sekunden ausblenden
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('Fehler bei der Cabinet Migration:', err);
      setError(err.response?.data?.error || 'Fehler bei der Migration');
    } finally {
      setMigrationLoading(false);
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <SettingsIcon sx={{ fontSize: 40 }} />
        <Typography variant="h4">
          Administration
        </Typography>
      </Box>

      {error && (
        <AleCabinet Department Migration - Nur für Root */}
        {isRoot && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <SettingsIcon color="primary" />
                  <Typography variant="h6">
                    Cabinet Department Migration
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary" paragraph>
                  Diese Migration fügt die <code>department_id</code> Spalte zur Cabinets-Tabelle hinzu.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Dadurch können:
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    <li>Schränke Departments zugeordnet werden</li>
                    <li>Department Admins ihre eigenen Schränke verwalten</li>
                    <li>Root alle Schränke mit Department-Zuordnung sehen</li>
                  </ul>
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleCabinetMigration}
                  disabled={migrationLoading}
                  fullWidth
                >
                  {migrationLoading ? 'Migration läuft...' : 'Migration ausführen'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        )}

        {/* rt severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {!isRoot && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Einige Admin-Funktionen sind nur für den Root-Benutzer verfügbar.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Datenbank-Management - Nur für Root */}
        {isRoot && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <DeleteForeverIcon color="error" />
                  <Typography variant="h6">
                    Datenbank zurücksetzen
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary" paragraph>
                  Diese Aktion löscht <strong>alle Daten</strong> aus der Datenbank:
                </Typography>
                <Typography component="div" variant="body2" color="text.secondary">
                  <ul style={{ marginTop: 0, paddingLeft: 20 }}>
                    <li>Alle Materialien</li>
                    <li>Alle Kategorien</li>
                    <li>Alle Firmen</li>
                    <li>Alle Schränke</li>
                    <li>Alle Barcodes</li>
                    <li>Alle Transaktionen</li>
                  </ul>
                </Typography>
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <strong>ACHTUNG:</strong> Diese Aktion kann nicht rückgängig gemacht werden!
                </Alert>
              </CardContent>
              <CardActions>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<WarningIcon />}
                  onClick={openConfirmDialog}
                  fullWidth
                >
                  Datenbank leeren
                </Button>
              </CardActions>
            </Card>
          </Grid>
        )}

        {/* Platzhalter für zukünftige Admin-Funktionen */}
        {!isRoot && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Weitere Admin-Funktionen folgen hier
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Momentan sind keine zusätzlichen Admin-Funktionen verfügbar.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Bestätigungs-Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={closeConfirmDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="error" />
            Datenbank wirklich löschen?
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sie sind dabei, <strong>ALLE Daten</strong> aus der Datenbank unwiderruflich zu löschen.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, mb: 2 }}>
            Um fortzufahren, geben Sie bitte folgenden Text ein:
          </DialogContentText>
          <Paper sx={{ p: 2, bgcolor: 'error.light', mb: 2 }}>
            <Typography 
              variant="body1" 
              sx={{ 
                fontFamily: 'monospace', 
                fontWeight: 'bold',
                color: 'error.contrastText',
                textAlign: 'center',
              }}
            >
              DATENBANK LÖSCHEN
            </Typography>
          </Paper>
          <TextField
            autoFocus
            fullWidth
            variant="outlined"
            placeholder="Bestätigungstext eingeben"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            error={confirmText !== '' && confirmText !== 'DATENBANK LÖSCHEN'}
            helperText={
              confirmText !== '' && confirmText !== 'DATENBANK LÖSCHEN'
                ? 'Der Text muss exakt übereinstimmen'
                : ''
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmDialog} disabled={loading}>
            Abbrechen
          </Button>
          <Button
            onClick={handleResetDatabase}
            color="error"
            variant="contained"
            disabled={confirmText !== 'DATENBANK LÖSCHEN' || loading}
            startIcon={<DeleteForeverIcon />}
          >
            {loading ? 'Lösche...' : 'Unwiderruflich löschen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Admin;
