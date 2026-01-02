import React, { useState, useEffect } from 'react';
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
  Switch,
  FormControlLabel,
  Checkbox,
  IconButton,
  Tooltip,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Warning as WarningIcon,
  DeleteForever as DeleteForeverIcon,
  Settings as SettingsIcon,
  CameraAlt as CameraIcon,
  BluetoothConnected as BluetoothIcon,
  Storage as DatabaseIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Key as KeyIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { 
  encodeDbToken, 
  getDbToken, 
  saveDbToken, 
  clearDbToken, 
  getCurrentDbCredentials,
  DbCredentials 
} from '../utils/dbToken';

// Scanner-Einstellungen aus localStorage laden/speichern
export const getScannerSettings = () => {
  const settings = localStorage.getItem('scannerSettings');
  return settings ? JSON.parse(settings) : { cameraEnabled: true, bluetoothEnabled: false };
};

export const saveScannerSettings = (settings: { cameraEnabled: boolean; bluetoothEnabled: boolean }) => {
  localStorage.setItem('scannerSettings', JSON.stringify(settings));
};

const Admin: React.FC = () => {
  const { isRoot } = useAuth();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Scanner-Einstellungen
  const [scannerSettings, setScannerSettings] = useState(getScannerSettings());
  
  // DB Token Generator
  const [dbTokenTab, setDbTokenTab] = useState(0);
  const [generatedToken, setGeneratedToken] = useState('');
  const [copySnackbar, setCopySnackbar] = useState(false);
  const [currentDbInfo, setCurrentDbInfo] = useState<DbCredentials | null>(null);
  
  // Manuelle DB-Credentials
  const [manualCredentials, setManualCredentials] = useState<DbCredentials>({
    host: '',
    user: '',
    password: '',
    database: '',
    port: 3306,
    ssl: false  // Standard: kein SSL erzwingen
  });

  useEffect(() => {
    // Aktuelle DB-Credentials laden
    const creds = getCurrentDbCredentials();
    setCurrentDbInfo(creds);
  }, []);

  const handleScannerSettingChange = (setting: 'cameraEnabled' | 'bluetoothEnabled') => {
    const newSettings = { ...scannerSettings, [setting]: !scannerSettings[setting] };
    setScannerSettings(newSettings);
    saveScannerSettings(newSettings);
    setSuccess(`Scanner-Einstellung wurde gespeichert`);
    setTimeout(() => setSuccess(null), 2000);
  };

  // Token aus Server-Secrets generieren
  const generateTokenFromSecrets = async () => {
    try {
      const response = await axios.get('/api/admin/db-credentials');
      const creds = response.data;
      const token = encodeDbToken({
        host: creds.host,
        user: creds.user,
        password: creds.password,
        database: creds.database,
        port: creds.port || 3306,
        ssl: creds.ssl !== false
      });
      setGeneratedToken(token);
      setSuccess('Token aus Server-Secrets generiert');
    } catch (err: any) {
      setError('Fehler beim Laden der Server-Credentials: ' + (err.response?.data?.error || err.message));
    }
  };

  // Token aus manuellen Eingaben generieren
  const generateTokenFromManual = () => {
    if (!manualCredentials.host || !manualCredentials.user || !manualCredentials.password || !manualCredentials.database) {
      setError('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    const token = encodeDbToken(manualCredentials);
    setGeneratedToken(token);
    setSuccess('Token manuell generiert');
  };

  // Token in Zwischenablage kopieren
  const copyTokenToClipboard = async () => {
    if (!generatedToken) return;
    try {
      await navigator.clipboard.writeText(generatedToken);
      setCopySnackbar(true);
    } catch (err) {
      // Fallback für ältere Browser
      const textArea = document.createElement('textarea');
      textArea.value = generatedToken;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySnackbar(true);
    }
  };

  // URL mit Token generieren
  const generateUrlWithToken = () => {
    if (!generatedToken) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/?db_token=${encodeURIComponent(generatedToken)}`;
  };

  // Aktuellen Token aktivieren
  const activateGeneratedToken = () => {
    if (!generatedToken) return;
    const success = saveDbToken(generatedToken);
    if (success) {
      setCurrentDbInfo(getCurrentDbCredentials());
      setSuccess('Token aktiviert - wird ab jetzt für DB-Verbindungen verwendet');
    } else {
      setError('Ungültiger Token');
    }
  };

  // Token deaktivieren
  const deactivateToken = () => {
    clearDbToken();
    setCurrentDbInfo(null);
    setSuccess('DB-Token deaktiviert - Server verwendet Standard-Credentials');
  };

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

  // Migration: Endo Today Link zur View hinzufügen
  const runEndoLinkMigration = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await axios.post('/api/admin/run-endo-link-migration');
      setSuccess('Endo Today Link Migration erfolgreich durchgeführt!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('Migration error:', err);
      setError(err.response?.data?.error || 'Migration fehlgeschlagen');
    } finally {
      setLoading(false);
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
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
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




        {/* Datenbank-Migrationen - Nur für Root */}
        {isRoot && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <RefreshIcon color="primary" />
                  <Typography variant="h6">
                    Datenbank-Migrationen
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary" paragraph>
                  Führen Sie hier Datenbank-Migrationen aus, um neue Features zu aktivieren.
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" gutterBottom>
                          Material Lookup: Endo Today Link
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          Fügt das <code>endo_today_link</code> Feld aus der Kategorie zur Material-Übersichtsview hinzu.
                          Erforderlich für die LLM-basierte Produktsuche.
                        </Typography>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={runEndoLinkMigration}
                          disabled={loading}
                          fullWidth
                        >
                          {loading ? 'Migration läuft...' : 'Endo Link Migration ausführen'}
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

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

        {/* Scanner-Einstellungen - Für alle Admins */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <CameraIcon color="primary" />
                <Typography variant="h6">
                  Scanner-Einstellungen
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" paragraph>
                Aktivieren Sie hier zusätzliche Scanner-Optionen für den Barcode-Scanner.
                Standardmäßig wird nur die Tastatur-Eingabe verwendet.
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={scannerSettings.cameraEnabled}
                      onChange={() => handleScannerSettingChange('cameraEnabled')}
                      color="primary"
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <CameraIcon fontSize="small" />
                      <span>Kamera-Scanner aktivieren</span>
                    </Box>
                  }
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 6, mt: -1 }}>
                  Ermöglicht das Scannen mit der Gerätekamera (ZXing + OCR)
                </Typography>
              </Box>
              
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={scannerSettings.bluetoothEnabled}
                      onChange={() => handleScannerSettingChange('bluetoothEnabled')}
                      color="primary"
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <BluetoothIcon fontSize="small" />
                      <span>Handscanner-Modus aktivieren</span>
                    </Box>
                  }
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 6, mt: -1 }}>
                  Zeigt den Handscanner-Modus für Bluetooth/USB-Scanner an
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* DB Token Generator - Für Root */}
        {isRoot && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <DatabaseIcon color="primary" />
                  <Typography variant="h6">
                    Datenbank Token-Generator
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                
                {/* Aktuelle Verbindung anzeigen */}
                {currentDbInfo && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <strong>Aktiver DB-Token:</strong> {currentDbInfo.host}:{currentDbInfo.port} / {currentDbInfo.database}
                    <Button size="small" color="inherit" onClick={deactivateToken} sx={{ ml: 2 }}>
                      Deaktivieren
                    </Button>
                  </Alert>
                )}

                <Typography variant="body2" color="text.secondary" paragraph>
                  Generieren Sie einen DB-Token für die dynamische Datenbankverbindung.
                  Der Token kann über den URL-Parameter <code>db_token</code> übergeben werden.
                </Typography>

                <Tabs value={dbTokenTab} onChange={(_, v) => setDbTokenTab(v)} sx={{ mb: 2 }}>
                  <Tab label="Aus Server-Secrets" />
                  <Tab label="Manuell eingeben" />
                </Tabs>

                {/* Tab 0: Aus Server-Secrets */}
                {dbTokenTab === 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Lädt die Datenbank-Credentials aus den Server-Umgebungsvariablen und generiert daraus einen Token.
                    </Typography>
                    <Button 
                      variant="contained" 
                      startIcon={<KeyIcon />}
                      onClick={generateTokenFromSecrets}
                    >
                      Token aus Secrets generieren
                    </Button>
                  </Box>
                )}

                {/* Tab 1: Manuelle Eingabe */}
                {dbTokenTab === 1 && (
                  <Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Host"
                          value={manualCredentials.host}
                          onChange={(e) => setManualCredentials({ ...manualCredentials, host: e.target.value })}
                          placeholder="z.B. db.example.com"
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          label="Port"
                          type="number"
                          value={manualCredentials.port}
                          onChange={(e) => setManualCredentials({ ...manualCredentials, port: parseInt(e.target.value) || 3306 })}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          label="Datenbank"
                          value={manualCredentials.database}
                          onChange={(e) => setManualCredentials({ ...manualCredentials, database: e.target.value })}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Benutzer"
                          value={manualCredentials.user}
                          onChange={(e) => setManualCredentials({ ...manualCredentials, user: e.target.value })}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Passwort"
                          type="password"
                          value={manualCredentials.password}
                          onChange={(e) => setManualCredentials({ ...manualCredentials, password: e.target.value })}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={manualCredentials.ssl || false}
                              onChange={(e) => setManualCredentials({ ...manualCredentials, ssl: e.target.checked })}
                            />
                          }
                          label="SSL-Verbindung erzwingen"
                        />
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                          Aktivieren Sie dies nur, wenn der Datenbankserver SSL erfordert
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Button 
                          variant="contained" 
                          startIcon={<KeyIcon />}
                          onClick={generateTokenFromManual}
                        >
                          Token generieren
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Generierter Token */}
                {generatedToken && (
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle2" gutterBottom>
                      Generierter Token:
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        fullWidth
                        value={generatedToken}
                        size="small"
                        InputProps={{
                          readOnly: true,
                          sx: { fontFamily: 'monospace', fontSize: '0.8rem' }
                        }}
                      />
                      <Tooltip title="Token kopieren">
                        <IconButton onClick={copyTokenToClipboard}>
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                    </Paper>

                    <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                      URL mit Token:
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        fullWidth
                        value={generateUrlWithToken()}
                        size="small"
                        InputProps={{
                          readOnly: true,
                          sx: { fontFamily: 'monospace', fontSize: '0.75rem' }
                        }}
                      />
                      <Tooltip title="URL kopieren">
                        <IconButton onClick={async () => {
                          await navigator.clipboard.writeText(generateUrlWithToken());
                          setCopySnackbar(true);
                        }}>
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                    </Paper>

                    <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                      <Button 
                        variant="outlined" 
                        color="primary"
                        onClick={activateGeneratedToken}
                      >
                        Token aktivieren
                      </Button>
                      <Button 
                        variant="text" 
                        onClick={() => setGeneratedToken('')}
                      >
                        Token löschen
                      </Button>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Copy Snackbar */}
      <Snackbar
        open={copySnackbar}
        autoHideDuration={2000}
        onClose={() => setCopySnackbar(false)}
        message="In Zwischenablage kopiert"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

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
