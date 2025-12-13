import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Divider,
  LinearProgress,
} from '@mui/material';
import { 
  QrCodeScanner as ScannerIcon, 
  Remove as RemoveIcon, 
  Add as AddIcon, 
  ContentPaste as PasteIcon,
  CameraAlt as CameraIcon,
  Close as CloseIcon,
  PowerSettingsNew as ReactivateIcon,
  Inventory as InventoryIcon,
  DocumentScanner as OcrIcon,
  BluetoothConnected as BluetoothIcon,
  TextFields as TextFieldsIcon,
} from '@mui/icons-material';
import { barcodeAPI, materialAPI } from '../services/api';
import { parseGS1Barcode, isValidGS1Barcode, GS1Data } from '../utils/gs1Parser';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import Tesseract from 'tesseract.js';
import { getScannerSettings } from './Admin';
import { getInterventionSession, addInterventionItem } from './Dashboard';

const BarcodeScanner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [material, setMaterial] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [handscannerMode, setHandscannerMode] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handscannerInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  
  // Scanner-Einstellungen aus Admin laden
  const scannerSettings = getScannerSettings();
  
  // Interventionsmodus prüfen
  const interventionSession = getInterventionSession();
  const isInterventionMode = interventionSession.active;
  
  // Neuer State für GTIN-Auswahl-Dialog
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [scannedGS1Data, setScannedGS1Data] = useState<GS1Data | null>(null);
  const [gtinMasterData, setGtinMasterData] = useState<any>(null);
  const [existingMaterials, setExistingMaterials] = useState<any[]>([]);

  // Auto-open camera if navigated from dashboard or scanning cabinet (nur wenn Kamera aktiviert)
  useEffect(() => {
    const state = location.state as { autoOpenCamera?: boolean; scanCabinet?: boolean; returnTo?: string; removalMode?: boolean } | null;
    if ((state?.autoOpenCamera || state?.scanCabinet) && scannerSettings.cameraEnabled) {
      console.log('Auto-opening camera:', state);
      setCameraOpen(true);
    }
  }, [location.state]);

  useEffect(() => {
    console.log('useEffect triggered, cameraOpen:', cameraOpen, 'videoRef.current:', !!videoRef.current);
    
    if (!cameraOpen) {
      return;
    }

    // Warte kurz, bis der Dialog vollständig gerendert ist
    const timer = setTimeout(() => {
      console.log('Timer abgelaufen, videoRef.current:', !!videoRef.current);
      
      if (!videoRef.current) {
        console.error('Video-Element nicht verfügbar nach Timeout');
        setError('Video-Element konnte nicht initialisiert werden');
        setCameraOpen(false);
        return;
      }
      
      console.log('✓ Starte Kamera');
      
      const startCamera = async () => {
        try {
          // Explizit Kamera-Berechtigung anfordern
          console.log('Fordere Kamera-Zugriff an...');
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          
          console.log('✓ Kamera-Berechtigung erhalten');
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            console.log('✓ Video-Stream gestartet');
            
            // Jetzt ZXing Scanner starten mit optimierten Einstellungen für GS1-128
            const hints = new Map();
            // Unterstützte Formate - priorisiere Code 128 (GS1-128)
            hints.set(DecodeHintType.POSSIBLE_FORMATS, [
              BarcodeFormat.CODE_128,      // GS1-128 Barcodes
              BarcodeFormat.EAN_13,        // EAN-13
              BarcodeFormat.EAN_8,         // EAN-8
              BarcodeFormat.QR_CODE,       // QR Codes
              BarcodeFormat.DATA_MATRIX,   // Data Matrix
            ]);
            // Versuche härter zu dekodieren
            hints.set(DecodeHintType.TRY_HARDER, true);
            
            const codeReader = new BrowserMultiFormatReader(hints);
            codeReaderRef.current = codeReader;
            
            console.log('Starte Barcode-Erkennung...');
            
            // Kontinuierliches Scanning direkt vom Stream
            const scanLoop = async () => {
              while (cameraOpen && videoRef.current) {
                try {
                  const result = await codeReader.decodeOnce(videoRef.current);
                  
                  if (result) {
                    const scannedCode = result.getText();
                    console.log('✓ Barcode gescannt:', scannedCode);
                    console.log('Format:', result.getBarcodeFormat());
                    
                    // Stream stoppen
                    stream.getTracks().forEach(track => track.stop());
                    
                    // Check if we're scanning a cabinet QR code
                    const state = location.state as { scanCabinet?: boolean; returnTo?: string } | null;
                    if (state?.scanCabinet) {
                      try {
                        const cabinetData = JSON.parse(scannedCode);
                        if (cabinetData.type === 'CABINET') {
                          console.log('Cabinet QR code detected:', cabinetData);
                          setCameraOpen(false);
                          // Navigate back with cabinet data
                          navigate(state.returnTo || '/materials/new', {
                            state: {
                              cabinetId: cabinetData.id,
                              cabinetName: cabinetData.name,
                            }
                          });
                          return;
                        }
                      } catch (e) {
                        // Not a JSON QR code, continue with regular barcode handling
                      }
                    }
                    
                    setBarcode(scannedCode);
                    setCameraOpen(false);
                    setError('');
                    setSuccess('Barcode erfolgreich gescannt');
                    setTimeout(() => setSuccess(''), 2000);
                    
                    // NEUER WORKFLOW: GTIN prüfen und Aktion anbieten
                    handleScannedBarcode(scannedCode);
                    
                    break; // Schleife beenden nach erfolgreichem Scan
                  }
                } catch (err: any) {
                  // Ignoriere NotFoundException - normal beim Scannen
                  if (err.name !== 'NotFoundException') {
                    console.error('Scan-Fehler:', err);
                  }
                }
                
                // Kurze Pause zwischen Scans
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            };
            
            scanLoop();
          }
        } catch (err: any) {
          console.error('Fehler beim Kamera-Zugriff:', err);
          if (err.name === 'NotAllowedError') {
            setError('Kamera-Zugriff wurde verweigert. Bitte Berechtigungen erteilen.');
          } else if (err.name === 'NotFoundError') {
            setError('Keine Kamera gefunden.');
          } else {
            setError(`Kamera-Fehler: ${err.message}`);
          }
          setCameraOpen(false);
        }
      };
      
      startCamera();
    }, 300);

    return () => {
      clearTimeout(timer);
      if (codeReaderRef.current) {
        console.log('Stoppe Scanner...');
        codeReaderRef.current.reset();
      }
      // Video-Stream stoppen
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraOpen]);

  // OCR-Funktion: Texterkennung unter dem Barcode
  const performOCR = async () => {
    if (!videoRef.current) {
      setError('Kein Video-Stream verfügbar');
      return;
    }
    
    setOcrLoading(true);
    setOcrProgress(0);
    setError('');
    
    try {
      // Canvas erstellen und aktuelles Video-Frame erfassen
      const canvas = canvasRef.current || document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas-Context nicht verfügbar');
      }
      
      ctx.drawImage(video, 0, 0);
      
      // OCR mit Tesseract durchführen
      const result = await Tesseract.recognize(
        canvas,
        'eng', // Englisch für Zahlen/Buchstaben
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          },
        }
      );
      
      console.log('OCR Ergebnis:', result.data.text);
      
      // GS1-ähnliche Muster extrahieren (01)XXXXXX(17)XXXXXX(10)XXXXXX
      const text = result.data.text.replace(/\s/g, ''); // Leerzeichen entfernen
      
      // Suche nach GS1-Pattern: (01)...(17)...(10)...
      const gs1Pattern = /\(?01\)?(\d{14})\(?17\)?(\d{6})\(?10\)?([A-Za-z0-9]+)/;
      const gs1Match = text.match(gs1Pattern);
      
      if (gs1Match) {
        const extractedBarcode = `01${gs1Match[1]}17${gs1Match[2]}10${gs1Match[3]}`;
        console.log('GS1-Barcode extrahiert:', extractedBarcode);
        setBarcode(extractedBarcode);
        setCameraOpen(false);
        setSuccess('Barcode per OCR erkannt!');
        
        // Automatisch verarbeiten
        setTimeout(() => handleScannedBarcode(extractedBarcode), 500);
      } else {
        // Versuche nur Zahlenfolge zu finden
        const numbersOnly = text.replace(/[^0-9]/g, '');
        if (numbersOnly.length >= 20) {
          console.log('Zahlenfolge gefunden:', numbersOnly);
          setBarcode(numbersOnly);
          setCameraOpen(false);
          setSuccess('Zahlenfolge erkannt - bitte prüfen');
        } else {
          setError('Kein Barcode-Text erkannt. Versuchen Sie es mit besserer Beleuchtung.');
        }
      }
    } catch (err: any) {
      console.error('OCR Fehler:', err);
      setError('OCR-Erkennung fehlgeschlagen: ' + err.message);
    } finally {
      setOcrLoading(false);
      setOcrProgress(0);
    }
  };

  // Handscanner-Eingabe verarbeiten
  const handleHandscannerInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBarcode(value);
  };

  // Handscanner: Bei Enter automatisch suchen
  const handleHandscannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcode.trim()) {
      e.preventDefault();
      console.log('Handscanner Eingabe:', barcode);
      handleScannedBarcode(barcode);
      // Input leeren für nächsten Scan
      if (handscannerInputRef.current) {
        handscannerInputRef.current.value = '';
      }
      setBarcode('');
    }
  };

  // NEUER WORKFLOW: Nach Scan GTIN prüfen und entsprechende Aktion anbieten
  const handleScannedBarcode = async (scannedCode: string) => {
    console.log('=== handleScannedBarcode START ===');
    console.log('scannedCode:', scannedCode);
    
    setError('');
    setMaterial(null);
    setNotFound(false);
    setExistingMaterials([]);
    setGtinMasterData(null);
    
    // GS1-Barcode parsen
    let gs1Data: GS1Data | null = null;
    const isGS1 = isValidGS1Barcode(scannedCode);
    console.log('isValidGS1Barcode:', isGS1);
    
    if (isGS1) {
      gs1Data = parseGS1Barcode(scannedCode);
      console.log('GS1 barcode parsed:', gs1Data);
      setScannedGS1Data(gs1Data);
    } else {
      console.log('Kein GS1-Barcode, behandle als einfachen Barcode');
      // Kein GS1-Barcode - direkt zur Material-Suche per Barcode
      try {
        const response = await barcodeAPI.search(scannedCode);
        setMaterial(response.data.material);
        if (!response.data.material.active) {
          setError('⚠️ Dieses Material ist deaktiviert (Bestand 0). Sie können es unten reaktivieren.');
        }
      } catch (err) {
        setNotFound(true);
      }
      return;
    }
    
    // GTIN aus GS1-Daten extrahieren
    if (gs1Data?.gtin) {
      console.log('GTIN gefunden im Barcode:', gs1Data.gtin);
      try {
        // Prüfe ob GTIN bekannt ist
        console.log('Rufe searchGTIN API auf...');
        const gtinResponse = await barcodeAPI.searchGTIN(gs1Data.gtin);
        console.log('GTIN API Response:', gtinResponse.data);
        
        if (gtinResponse.data.found) {
          setGtinMasterData(gtinResponse.data.masterData);
          
          // Hole alle Materialien mit dieser GTIN (für Entnahme) - separat behandeln
          try {
            console.log('Rufe searchMaterialsByGTIN API auf...');
            const materialsResponse = await barcodeAPI.searchMaterialsByGTIN(gs1Data.gtin);
            console.log('Materials API Response:', materialsResponse.data);
            if (materialsResponse.data.materials && materialsResponse.data.materials.length > 0) {
              setExistingMaterials(materialsResponse.data.materials);
            }
          } catch (matErr: any) {
            console.log('Materials API Fehler (ignoriert):', matErr.message);
            // Fehler bei Materials-API ignorieren, Dialog trotzdem öffnen
          }
          
          // Dialog öffnen: Entnahme oder Hinzufügen?
          console.log('Öffne Action Dialog...');
          setActionDialogOpen(true);
        } else {
          // GTIN API erfolgreich aber nicht gefunden
          console.log('GTIN nicht in Datenbank gefunden');
          handleAddNewMaterialWithGS1(scannedCode, gs1Data);
        }
      } catch (err: any) {
        // GTIN nicht bekannt (404) - direkt zum Hinzufügen
        console.log('GTIN API Fehler:', err.response?.status, err.message);
        console.log('GTIN nicht bekannt, direkt zum Hinzufügen');
        handleAddNewMaterialWithGS1(scannedCode, gs1Data);
      }
    } else {
      console.log('Kein GTIN im geparsten Barcode');
      // Kein GTIN im Barcode - normale Suche
      setNotFound(true);
    }
    console.log('=== handleScannedBarcode END ===');
  };

  const handleSearch = async () => {
    setError('');
    setSuccess('');
    setMaterial(null);
    setNotFound(false);

    if (!barcode.trim()) {
      setError('Bitte Barcode eingeben');
      return;
    }
    
    // Neuen Workflow verwenden
    handleScannedBarcode(barcode);
  };

  // Hinzufügen mit vorausgefüllten GS1-Daten
  const handleAddNewMaterialWithGS1 = (scannedCode: string, gs1Data: GS1Data) => {
    console.log('handleAddNewMaterialWithGS1 called with:', { scannedCode, gs1Data });
    navigate('/materials/new', {
      state: {
        gs1_barcode: scannedCode,
        gs1Data: gs1Data,
        masterData: gtinMasterData,
        fromScanner: true,
      }
    });
  };

  // Aus Dialog: Neues Material hinzufügen (bei bekannter GTIN)
  const handleAddFromDialog = () => {
    setActionDialogOpen(false);
    navigate('/materials/new', {
      state: {
        gs1_barcode: barcode,
        gs1Data: scannedGS1Data,
        masterData: gtinMasterData,
        fromScanner: true,
      }
    });
  };

  // Aus Dialog: Material direkt entnehmen
  const handleSelectForRemoval = async (materialItem: any) => {
    setError('');
    setSuccess('');
    
    try {
      // Verwende material_ids (aggregiert) oder id (einzeln)
      const materialIdToUse = materialItem.material_ids || materialItem.id;
      
      // Direkte Entnahme über Material-ID(s)
      const response = await barcodeAPI.removeMaterial(materialIdToUse, {
        quantity: 1,
        user_name: 'System',
        notes: 'GTIN-Scan Entnahme',
        usage_type: isInterventionMode ? 'patient_use' : 'destock',
      });
      
      const data = response.data;
      setActionDialogOpen(false);
      
      // Im Interventionsmodus: Entnahme protokollieren
      if (isInterventionMode) {
        addInterventionItem({
          materialName: materialItem.name,
          articleNumber: materialItem.article_number || '',
          lotNumber: materialItem.lot_number || '',
          quantity: 1,
          gtin: materialItem.gtin || scannedGS1Data?.gtin || '',
        });
      }
      
      if (data.deactivated) {
        setSuccess(`1 Einheit von "${materialItem.name}" entnommen. Material vollständig entnommen.${isInterventionMode ? ' ✓ Protokolliert' : ''}`);
      } else {
        setSuccess(`1 Einheit von "${materialItem.name}" entnommen. Neuer Bestand: ${data.new_stock}${isInterventionMode ? ' ✓ Protokolliert' : ''}`);
      }
      
      // Material für Anzeige setzen (aktualisiert)
      setMaterial({
        ...materialItem,
        current_stock: data.new_stock,
        active: data.new_stock > 0
      });
    } catch (err: any) {
      setActionDialogOpen(false);
      setError(err.response?.data?.error || 'Fehler beim Entnehmen');
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

  const handleReactivate = async () => {
    setError('');
    setSuccess('');

    if (!material) {
      setError('Kein Material ausgewählt');
      return;
    }

    try {
      await materialAPI.reactivate(material.id);
      setSuccess('Material erfolgreich reaktiviert! Sie können jetzt Wareneingang buchen.');
      
      // Material-Daten aktualisieren
      const response = await barcodeAPI.search(barcode);
      setMaterial(response.data.material);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Reaktivieren');
    }
  };

  const handleScanOut = async () => {
    setError('');
    setSuccess('');

    if (!material) {
      setError('Bitte zuerst einen Barcode suchen');
      return;
    }

    try {
      // Direkte Entnahme über Material-ID (für GTIN-Workflow)
      const response = await barcodeAPI.removeMaterial(material.id, {
        quantity,
        user_name: 'System',
        notes: 'Barcode-Scan Entnahme',
        usage_type: isInterventionMode ? 'patient_use' : 'destock',
      });
      
      const data = response.data;
      
      // Im Interventionsmodus: Entnahme protokollieren
      if (isInterventionMode) {
        addInterventionItem({
          materialName: material.name,
          articleNumber: material.article_number || '',
          lotNumber: material.lot_number || '',
          quantity: quantity,
          gtin: material.gtin || '',
        });
      }
      
      if (data.deactivated) {
        setSuccess(`${quantity} Einheit(en) entnommen. Material vollständig entnommen und deaktiviert.${isInterventionMode ? ' ✓ Protokolliert' : ''}`);
        setMaterial(null);
        setNotFound(false);
      } else {
        setSuccess(`${quantity} Einheit(en) erfolgreich entnommen. Neuer Bestand: ${data.new_stock}${isInterventionMode ? ' ✓ Protokolliert' : ''}`);
        // Material-Daten aktualisieren
        setMaterial({
          ...material,
          current_stock: data.new_stock
        });
      }
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
            {/* Handscanner-Modus Toggle - nur wenn in Admin aktiviert */}
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Box display="flex" alignItems="center">
                <ScannerIcon sx={{ mr: 1, fontSize: 30 }} />
                <Typography variant="h6">
                  {handscannerMode ? 'Handscanner-Modus' : 'Barcode eingeben'}
                </Typography>
              </Box>
              {scannerSettings.bluetoothEnabled && (
                <Tooltip title={handscannerMode ? 'Handscanner-Modus deaktivieren' : 'Handscanner-Modus (Bluetooth/USB)'}>
                  <IconButton 
                    onClick={() => {
                      setHandscannerMode(!handscannerMode);
                      if (!handscannerMode) {
                        setTimeout(() => handscannerInputRef.current?.focus(), 100);
                      }
                    }}
                    color={handscannerMode ? 'primary' : 'default'}
                  >
                    <BluetoothIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {handscannerMode ? (
              /* Handscanner-Modus: Großes Eingabefeld, Auto-Submit bei Enter */
              <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <strong>Handscanner-Modus aktiv</strong><br />
                  Scannen Sie mit Ihrem Bluetooth/USB-Scanner. Der Barcode wird automatisch verarbeitet.
                </Alert>
                <TextField
                  fullWidth
                  inputRef={handscannerInputRef}
                  label="Warte auf Scan..."
                  placeholder="Scanner-Eingabe wird hier angezeigt"
                  onChange={handleHandscannerInput}
                  onKeyDown={handleHandscannerKeyDown}
                  autoFocus
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: '1.5rem',
                      fontFamily: 'monospace',
                    }
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Der Scanner sendet automatisch Enter nach dem Scan
                </Typography>
              </Box>
            ) : (
              /* Normaler Modus: Manuelles Eingabefeld */
              <>
                <TextField
                  fullWidth
                  inputRef={barcodeInputRef}
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
                        {scannerSettings.cameraEnabled && (
                          <Tooltip title="Kamera öffnen">
                            <IconButton
                              onClick={() => {
                                console.log('Kamera-Button geklickt');
                                setCameraOpen(true);
                              }}
                              edge="end"
                              sx={{ mr: 1 }}
                            >
                              <CameraIcon />
                            </IconButton>
                          </Tooltip>
                        )}
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
              </>
            )}

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
                  <Typography variant="h5" color={material.active ? 'primary' : 'error'} gutterBottom>
                    {material.current_stock} {!material.active && '(Deaktiviert)'}
                  </Typography>

                  {material.active ? (
                    <>
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
                    </>
                  ) : (
                    <Button
                      fullWidth
                      variant="contained"
                      color="success"
                      startIcon={<ReactivateIcon />}
                      onClick={handleReactivate}
                      sx={{ mt: 2 }}
                    >
                      Material reaktivieren
                    </Button>
                  )}
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
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Barcode scannen</Typography>
            <IconButton onClick={() => setCameraOpen(false)} edge="end">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ minHeight: 400, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 600, position: 'relative' }}>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                maxHeight: '400px',
                borderRadius: '8px',
                backgroundColor: '#000',
              }}
            />
            {/* Hidden canvas for OCR frame capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            <Typography 
              variant="body2" 
              color="text.secondary" 
              align="center" 
              sx={{ mt: 2 }}
            >
              Halten Sie den Barcode vor die Kamera
            </Typography>
            
            {/* OCR Progress Indicator */}
            {ocrLoading && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" align="center" color="primary">
                  OCR-Erkennung läuft... {Math.round(ocrProgress * 100)}%
                </Typography>
                <LinearProgress variant="determinate" value={ocrProgress * 100} sx={{ mt: 1 }} />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, flexDirection: 'column', gap: 1 }}>
          <Button 
            onClick={performOCR} 
            variant="contained" 
            color="secondary"
            fullWidth
            disabled={ocrLoading}
            startIcon={<TextFieldsIcon />}
          >
            {ocrLoading ? 'OCR läuft...' : 'OCR versuchen (Zahlen unter Barcode)'}
          </Button>
          <Button onClick={() => setCameraOpen(false)} variant="outlined" fullWidth>
            Abbrechen
          </Button>
        </DialogActions>
      </Dialog>

      {/* GTIN Aktions-Auswahl Dialog */}
      <Dialog 
        open={actionDialogOpen} 
        onClose={() => setActionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <InventoryIcon color="primary" />
            <Typography variant="h6">Artikel erkannt</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {gtinMasterData && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary">Artikelname</Typography>
              <Typography variant="h6" gutterBottom>{gtinMasterData.name}</Typography>
              
              {gtinMasterData.category_name && (
                <>
                  <Typography variant="body2" color="text.secondary">Kategorie</Typography>
                  <Typography variant="body1" gutterBottom>{gtinMasterData.category_name}</Typography>
                </>
              )}
              
              {scannedGS1Data?.gtin && (
                <>
                  <Typography variant="body2" color="text.secondary">GTIN</Typography>
                  <Typography variant="body1" fontFamily="monospace">{scannedGS1Data.gtin}</Typography>
                </>
              )}
            </Box>
          )}

          <Typography variant="body1" gutterBottom sx={{ fontWeight: 500 }}>
            Was möchten Sie tun?
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {/* Entnahme - nur wenn Materialien vorhanden */}
            {existingMaterials.length > 0 && (
              <>
                <Typography variant="body2" color="text.secondary">
                  Entnahme aus vorhandenem Bestand:
                </Typography>
                {existingMaterials.map((mat) => (
                  <Button
                    key={mat.id}
                    variant="outlined"
                    color="secondary"
                    startIcon={<RemoveIcon />}
                    onClick={() => handleSelectForRemoval(mat)}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <Typography variant="body2">
                        {mat.cabinet_name || 'Ohne Schrank'} - Bestand: {mat.current_stock}
                      </Typography>
                      {mat.batch_number && (
                        <Typography variant="caption" color="text.secondary">
                          Charge: {mat.batch_number}
                        </Typography>
                      )}
                    </Box>
                  </Button>
                ))}
                <Divider sx={{ my: 1 }} />
              </>
            )}

            {/* Hinzufügen - immer möglich */}
            <Button
              variant="contained"
              color="success"
              size="large"
              startIcon={<AddIcon />}
              onClick={handleAddFromDialog}
              fullWidth
            >
              Neues Material hinzufügen (Wareneingang)
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActionDialogOpen(false)} variant="outlined" fullWidth>
            Abbrechen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BarcodeScanner;
