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

const Admin: React.FC = () => {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
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

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <SettingsIcon sx={{ fontSize: 40 }} />
        <Typography variant="h4">
          Administration
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Datenbank-Management */}
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

        {/* Weitere Admin-Funktionen können hier hinzugefügt werden */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <SettingsIcon color="primary" />
                <Typography variant="h6">
                  Datenbank-Migration (Units)
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" paragraph>
                Führt die Datenbank-Migration für das Units-System aus.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Diese Aktion ist sicher und kann mehrfach ausgeführt werden.
              </Typography>
              <Alert severity="info" sx={{ mt: 2 }}>
                Migration wird automatisch überprüft und nur bei Bedarf ausgeführt.
              </Alert>
            </CardContent>
            <CardActions>
              <Button
                variant="contained"
                color="primary"
                onClick={async () => {
                  try {
                    setLoading(true);
                    await axios.post('/api/admin/run-migration');
                    setSuccess('Units-Migration erfolgreich ausgeführt!');
                    setTimeout(() => setSuccess(null), 3000);
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Migration fehlgeschlagen');
                  } finally {
                    setLoading(false);
                  }
                }}
                fullWidth
                disabled={loading}
              >
                {loading ? 'Migration läuft...' : 'Units-Migration ausführen'}
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* User Management Migration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <SettingsIcon color="secondary" />
                <Typography variant="h6">
                  User Management Migration
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" paragraph>
                Erstellt die Tabellen für das User Management System und legt den Root-Benutzer an.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Root-Credentials:</strong> Username: root, Passwort: root
              </Typography>
              <Alert severity="warning" sx={{ mt: 2 }}>
                Nach der Migration MUSS das Root-Passwort geändert werden!
              </Alert>
            </CardContent>
            <CardActions>
              <Button
                variant="contained"
                color="secondary"
                onClick={async () => {
                  try {
                    setLoading(true);
                    await axios.post('/api/admin/run-user-migration');
                    setSuccess('User Management erfolgreich installiert! Login als "root" / "root"');
                    setTimeout(() => setSuccess(null), 5000);
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'User-Migration fehlgeschlagen');
                  } finally {
                    setLoading(false);
                  }
                }}
                fullWidth
                disabled={loading}
              >
                {loading ? 'Migration läuft...' : 'User Management installieren'}
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Department Access Migration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <SettingsIcon color="info" />
                <Typography variant="h6">
                  Department-Zugriffskontrolle
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" paragraph>
                Erweitert User Management um Department-Zuweisungen für Admin- und User-Rollen.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Root bleibt globaler Admin, andere Admins werden zu Department Admins.
              </Typography>
              <Alert severity="info" sx={{ mt: 2 }}>
                Nach der Migration können Departments zugewiesen werden.
              </Alert>
            </CardContent>
            <CardActions>
              <Button
                variant="contained"
                color="info"
                onClick={async () => {
                  try {
                    setLoading(true);
                    await axios.post('/api/admin/run-department-migration');
                    setSuccess('Department-Zugriffskontrolle erfolgreich aktiviert!');
                    setTimeout(() => setSuccess(null), 5000);
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Department-Migration fehlgeschlagen');
                  } finally {
                    setLoading(false);
                  }
                }}
                fullWidth
                disabled={loading}
              >
                {loading ? 'Migration läuft...' : 'Department-Zugriff aktivieren'}
              </Button>
            </CardActions>
          </Card>
        </Grid>
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
