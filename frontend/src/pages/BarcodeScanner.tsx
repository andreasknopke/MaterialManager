import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Alert,
  IconButton,
  Tooltip,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { 
  QrCodeScanner as ScannerIcon, 
  Remove as RemoveIcon, 
  Add as AddIcon, 
  ContentPaste as PasteIcon,
  CameraAlt as CameraIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { barcodeAPI } from '../services/api';
import { parseGS1Barcode, isValidGS1Barcode } from '../utils/gs1Parser';
import { BarcodeScannerComponent } from 'react-qr-barcode-scanner';

const BarcodeScanner: React.FC = () => {
  const navigate = useNavigate();
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [material, setMaterial] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleSearch = async () => {
    setError('');
    setSuccess('');
    setMaterial(null);
    setNotFound(false);

    try {
      const response = await barcodeAPI.search(barcode);
      setMaterial(response.data.material);
    } catch (err) {
      setError('Barcode nicht gefunden');
      setNotFound(true);
    }
  };

  const handleAddNewMaterial = () => {
    console.log('handleAddNewMaterial called');
    console.log('Current barcode:', barcode);
    
    // GS1-Barcode parsen, falls vorhanden
    let gs1Data = null;
    if (isValidGS1Barcode(barcode)) {
      gs1Data = parseGS1Barcode(barcode);
      console.log('GS1 barcode parsed:', gs1Data);
    } else {
      console.log('Not a valid GS1 barcode');
    }

    // Zu neuem Material navigieren und Barcode-Daten im State übergeben
    console.log('Navigating to /materials/new with state:', {
      gs1_barcode: barcode,
      gs1Data: gs1Data,
      fromScanner: true,
    });
    
    navigate('/materials/new', {
      state: {
        gs1_barcode: barcode,
        gs1Data: gs1Data,
        fromScanner: true,
      }
    });
  };

  const handleScanOut = async () => {
    setError('');
    setSuccess('');

    if (!material) {
      setError('Bitte zuerst einen Barcode suchen');
      return;
    }

    try {
      await barcodeAPI.scanOut({
        barcode,
        quantity,
        user_name: 'System',
        notes: 'Barcode-Scan Ausgang',
      });
      setSuccess(`${quantity} Einheit(en) erfolgreich ausgebucht`);
      
      // Material-Daten aktualisieren
      const response = await barcodeAPI.search(barcode);
      setMaterial(response.data.material);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Ausbuchen');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setBarcode(text.trim());
      setError('');
      setSuccess('Barcode aus Zwischenablage eingefügt');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Fehler beim Zugriff auf die Zwischenablage. Bitte Berechtigung erteilen.');
    }
  };

  const handleCameraScan = (err: any, result: any) => {
    if (result) {
      setBarcode(result.text);
      setCameraOpen(false);
      setError('');
      setSuccess('Barcode erfolgreich gescannt');
      setTimeout(() => setSuccess(''), 2000);
      // Automatisch suchen nach Scan
      setTimeout(() => {
        barcodeAPI.search(result.text)
          .then(response => setMaterial(response.data.material))
          .catch(() => setNotFound(true));
      }, 100);
    }
    if (err) {
      console.error('Camera scan error:', err);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
        Barcode Scanner
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: { xs: 2, sm: 3 }, display: { xs: 'none', sm: 'block' } }}>
        Scannen Sie einen Barcode oder geben Sie ihn manuell ein
      </Typography>

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" mb={2}>
              <ScannerIcon sx={{ mr: 1, fontSize: 30 }} />
              <Typography variant="h6">Barcode eingeben</Typography>
            </Box>

            <TextField
              fullWidth
              label="Barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Barcode scannen oder eingeben"
              margin="normal"
              autoFocus
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Kamera öffnen">
                      <IconButton
                        onClick={() => setCameraOpen(true)}
                        edge="end"
                        sx={{ mr: 1 }}
                      >
                        <CameraIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Aus Zwischenablage einfügen">
                      <IconButton
                        onClick={handlePasteFromClipboard}
                        edge="end"
                      >
                        <PasteIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              fullWidth
              variant="contained"
              onClick={handleSearch}
              sx={{ mt: 2 }}
            >
              Suchen
            </Button>

            {/* Hinzufügen-Button wenn nicht gefunden */}
            {notFound && (
              <Button
                fullWidth
                variant="contained"
                color="success"
                startIcon={<AddIcon />}
                onClick={handleAddNewMaterial}
                sx={{ mt: 2 }}
              >
                Material hinzufügen
              </Button>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {success}
              </Alert>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          {material && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Material-Information
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Bezeichnung
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {material.name}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Kategorie
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {material.category_name || '-'}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Firma
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {material.company_name || '-'}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Aktueller Bestand
                  </Typography>
                  <Typography variant="h5" color="primary" gutterBottom>
                    {material.current_stock}
                  </Typography>

                  <TextField
                    fullWidth
                    label="Menge"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    margin="normal"
                    InputProps={{ inputProps: { min: 1 } }}
                  />

                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    startIcon={<RemoveIcon />}
                    onClick={handleScanOut}
                    sx={{ mt: 2 }}
                  >
                    Entnahme ({quantity} Stück)
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Camera Scanner Dialog */}
      <Dialog 
        open={cameraOpen} 
        onClose={() => setCameraOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Barcode scannen</Typography>
            <IconButton onClick={() => setCameraOpen(false)} edge="end">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, position: 'relative', height: '100%' }}>
          {cameraOpen && (
            <BarcodeScannerComponent
              width="100%"
              height="100%"
              onUpdate={handleCameraScan}
              stopStream={!cameraOpen}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCameraOpen(false)} variant="outlined">
            Abbrechen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BarcodeScanner;
