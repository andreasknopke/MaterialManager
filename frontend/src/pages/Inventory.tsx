import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Alert,
  Divider,
  Checkbox,
  TextField,
  LinearProgress,
  Tooltip,
  InputAdornment,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Inventory2 as InventoryIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  QrCodeScanner as QrCodeScannerIcon,
  CheckCircleOutline as ConfirmedIcon,
  RadioButtonUnchecked as UnconfirmedIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  ExpandMore as ExpandMoreIcon,
  Psychology as AIIcon,
  PhotoCamera as PhotoCameraIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { cabinetAPI, materialAPI, aiAPI } from '../services/api';
import { parseGS1Barcode, isValidGS1Barcode } from '../utils/gs1Parser';

interface Cabinet {
  id: number;
  name: string;
  location: string;
  description: string;
  capacity: number;
}

interface Material {
  id: number;
  name: string;
  current_stock: number;
  min_stock: number;
  expiry_date: string;
  cabinet_id: number;
  // Erweiterte Felder
  article_number: string;
  lot_number: string;
  category_name: string;
  company_name: string;
  compartment_name: string;
  compartment_id?: number | null;
  size: string;
  unit: string;
  shape_name: string;
  device_length: string;
  device_diameter: string;
  shaft_length: string;
  french_size: string;
  guidewire_acceptance: string;
  is_consignment: boolean;
}

// Interface für bestätigte Materialien
interface ConfirmedMaterial {
  materialId: number;
  confirmed: boolean;
  scannedAt?: Date;
  method: 'scan' | 'manual';
}

// Interface für gruppierte Materialien nach Fach
interface CompartmentGroup {
  compartmentId: number | null;
  compartmentName: string;
  materials: Material[];
}

// Interface für KI-Analyse-Ergebnis
interface AIAnalysisResult {
  overallMatch: number;
  analysis: string;
  compartmentResults: Array<{
    compartmentName: string;
    matchProbability: number;
    notes: string;
  }>;
  discrepancies: string[];
  recommendations: string[];
}

const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [selectedCabinet, setSelectedCabinet] = useState<Cabinet | null>(null);
  const [cabinetMaterials, setCabinetMaterials] = useState<Material[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Inventur-spezifische States
  const [confirmedMaterials, setConfirmedMaterials] = useState<Map<number, ConfirmedMaterial>>(new Map());
  const [inventoryMode, setInventoryMode] = useState(false);
  const [scannerBarcode, setScannerBarcode] = useState('');
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [correctionMaterial, setCorrectionMaterial] = useState<Material | null>(null);
  const [correctionQuantity, setCorrectionQuantity] = useState(0);
  const [correctionReason, setCorrectionReason] = useState('');
  const [processingCorrection, setProcessingCorrection] = useState(false);
  
  // Ref für Handscanner-Input
  const scannerInputRef = useRef<HTMLInputElement>(null);
  
  // Ref für Foto-Input
  const cameraPhotoInputRef = useRef<HTMLInputElement>(null);
  const uploadPhotoInputRef = useRef<HTMLInputElement>(null);
  
  // KI-Inhaltsabgleich States
  const [aiAnalysisDialogOpen, setAiAnalysisDialogOpen] = useState(false);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);
  const [aiAnalysisCompartment, setAiAnalysisCompartment] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    fetchCabinets();
  }, []);
  
  // Prüfe ob wir vom Scanner zurückkommen
  useEffect(() => {
    const state = location.state as {
      fromScanner?: boolean;
      scannedCode?: string;
      cabinetId?: number;
      cabinetName?: string;
    } | null;
    
    if (state?.fromScanner && state?.scannedCode) {
      console.log('Zurück vom Scanner mit Code:', state.scannedCode);
      
      // Wiederherstelle Cabinet-Daten aus sessionStorage
      const savedCabinetId = sessionStorage.getItem('inventoryCabinetId');
      const savedMaterials = sessionStorage.getItem('inventoryCabinetMaterials');
      const savedConfirmed = sessionStorage.getItem('inventoryConfirmedMaterials');
      
      if (savedCabinetId && savedMaterials) {
        const cabinetId = parseInt(savedCabinetId);
        const materials = JSON.parse(savedMaterials) as Material[];
        const confirmed = savedConfirmed ? new Map<number, ConfirmedMaterial>(JSON.parse(savedConfirmed)) : new Map();
        
        // Cabinet finden
        const cabinet = cabinets.find(c => c.id === cabinetId);
        if (cabinet) {
          setSelectedCabinet(cabinet);
        }
        
        setCabinetMaterials(materials);
        setConfirmedMaterials(confirmed);
        setDialogOpen(true);
        setInventoryMode(true);
        
        // Gescannten Barcode verarbeiten
        handleScannedBarcode(state.scannedCode, materials);
        
        // Session Storage aufräumen
        sessionStorage.removeItem('inventoryCabinetId');
        sessionStorage.removeItem('inventoryCabinetMaterials');
        sessionStorage.removeItem('inventoryConfirmedMaterials');
      }
      
      // State bereinigen
      window.history.replaceState({}, document.title);
    }
  }, [location.state, cabinets]);

  const fetchCabinets = async () => {
    try {
      const response = await cabinetAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : [];
      setCabinets(data);
    } catch (error) {
      console.error('Fehler beim Laden der Schränke:', error);
      setCabinets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCabinetMaterials = async (cabinetId: number) => {
    try {
      const response = await materialAPI.getAll();
      const allMaterials = Array.isArray(response.data) ? response.data : [];
      const filtered = allMaterials.filter((m: Material) => m.cabinet_id === cabinetId);
      setCabinetMaterials(filtered);
      // Reset confirmed materials when loading new cabinet
      setConfirmedMaterials(new Map());
    } catch (error) {
      console.error('Fehler beim Laden der Materialien:', error);
      setCabinetMaterials([]);
    }
  };
  
  // Kamera-Scanner öffnen - navigiert zum BarcodeScanner mit Inventur-Modus
  const openCameraScanner = () => {
    if (!selectedCabinet) return;
    
    // Speichere aktuellen Zustand in sessionStorage für die Rückkehr
    sessionStorage.setItem('inventoryCabinetId', selectedCabinet.id.toString());
    sessionStorage.setItem('inventoryCabinetMaterials', JSON.stringify(cabinetMaterials));
    sessionStorage.setItem('inventoryConfirmedMaterials', JSON.stringify(Array.from(confirmedMaterials.entries())));
    
    // Navigiere zum BarcodeScanner mit Inventur-Check-Modus
    // assumeGS1: true für optimale GS1-Barcode-Erkennung
    navigate('/scanner', {
      state: {
        inventoryCheck: true,
        cabinetId: selectedCabinet.id,
        cabinetName: selectedCabinet.name,
        assumeGS1: true,
      }
    });
  };
  
  // Gescannten Barcode verarbeiten (mit optionalem materials-Array für Rückkehr vom Scanner)
  const handleScannedBarcode = (barcode: string, materials?: Material[]) => {
    const materialsToSearch = materials || cabinetMaterials;
    
    // Parse GS1 wenn vorhanden
    let gtin = barcode;
    let lotNumber: string | undefined;
    
    if (isValidGS1Barcode(barcode)) {
      const gs1Data = parseGS1Barcode(barcode);
      if (gs1Data.gtin) gtin = gs1Data.gtin;
      if (gs1Data.batchNumber) lotNumber = gs1Data.batchNumber;
    }
    
    // Suche Material in der aktuellen Liste
    const foundMaterial = materialsToSearch.find(m => {
      // Prüfe GTIN/Artikelnummer
      if (m.article_number && (m.article_number === gtin || m.article_number.includes(gtin))) {
        // Wenn LOT vorhanden, auch LOT prüfen
        if (lotNumber && m.lot_number) {
          return m.lot_number === lotNumber;
        }
        return true;
      }
      return false;
    });
    
    if (foundMaterial) {
      // Material gefunden - als bestätigt markieren
      confirmMaterial(foundMaterial.id, 'scan');
      setSuccess(`Material "${foundMaterial.name}" bestätigt!`);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(`Material mit Barcode "${gtin}" nicht in diesem Schrank gefunden`);
      setTimeout(() => setError(null), 3000);
    }
  };
  
  // Material als bestätigt markieren
  const confirmMaterial = (materialId: number, method: 'scan' | 'manual') => {
    setConfirmedMaterials(prev => {
      const newMap = new Map(prev);
      newMap.set(materialId, {
        materialId,
        confirmed: true,
        scannedAt: new Date(),
        method
      });
      return newMap;
    });
  };
  
  // Bestätigung aufheben
  const unconfirmMaterial = (materialId: number) => {
    setConfirmedMaterials(prev => {
      const newMap = new Map(prev);
      newMap.delete(materialId);
      return newMap;
    });
  };
  
  // Korrektur-Dialog öffnen
  const openCorrectionDialog = (material: Material) => {
    setCorrectionMaterial(material);
    setCorrectionQuantity(material.current_stock);
    setCorrectionReason('');
    setCorrectionDialogOpen(true);
  };
  
  // Inventur-Korrektur durchführen
  const handleInventoryCorrection = async () => {
    if (!correctionMaterial) return;
    
    setProcessingCorrection(true);
    try {
      const previousStock = correctionMaterial.current_stock;
      const newStock = correctionQuantity;
      const difference = newStock - previousStock;
      
      if (difference === 0) {
        // Nur bestätigen, keine Änderung nötig
        confirmMaterial(correctionMaterial.id, 'manual');
        setCorrectionDialogOpen(false);
        setSuccess(`Material "${correctionMaterial.name}" bestätigt (keine Änderung)`);
        setTimeout(() => setSuccess(null), 3000);
        return;
      }
      
      const notes = `Inventur-Korrektur: ${correctionReason || 'Bestandsanpassung bei Inventur'}`;
      
      if (difference > 0) {
        // Eingang buchen (fehlende Menge nachbuchen)
        await materialAPI.stockIn(correctionMaterial.id, {
          quantity: difference,
          notes: notes,
          usage_type: 'correction'
        });
      } else {
        // Ausgang buchen (überzähliges Material ausbuchen)
        await materialAPI.stockOut(correctionMaterial.id, {
          quantity: Math.abs(difference),
          notes: notes,
          usage_type: 'correction'
        });
      }
      
      // Material als bestätigt markieren
      confirmMaterial(correctionMaterial.id, 'manual');
      
      // Materialien neu laden
      if (selectedCabinet) {
        await fetchCabinetMaterials(selectedCabinet.id);
        // Bestätigungen wiederherstellen
        setConfirmedMaterials(prev => {
          const newMap = new Map(prev);
          newMap.set(correctionMaterial.id, {
            materialId: correctionMaterial.id,
            confirmed: true,
            scannedAt: new Date(),
            method: 'manual'
          });
          return newMap;
        });
      }
      
      setCorrectionDialogOpen(false);
      setSuccess(`Bestand korrigiert: ${previousStock} → ${newStock} (${difference > 0 ? '+' : ''}${difference})`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Fehler bei Inventur-Korrektur:', err);
      setError('Fehler bei der Bestandskorrektur');
      setTimeout(() => setError(null), 3000);
    } finally {
      setProcessingCorrection(false);
    }
  };
  
  // Handscanner-Input verarbeiten
  const handleScannerInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scannerBarcode.trim()) {
      handleScannedBarcode(scannerBarcode.trim());
      setScannerBarcode('');
    }
  };

  // Materialien nach Fächern gruppieren
  const groupMaterialsByCompartment = (materials: Material[]): CompartmentGroup[] => {
    const groups: Map<string, CompartmentGroup> = new Map();
    
    materials.forEach(material => {
      const key = material.compartment_id ? `compartment_${material.compartment_id}` : '__OHNE_FACH__';
      if (!groups.has(key)) {
        groups.set(key, {
          compartmentId: material.compartment_id ?? null,
          compartmentName: material.compartment_name || 'Ohne Fachzuordnung',
          materials: []
        });
      }
      groups.get(key)!.materials.push(material);
    });

    // Sortiere Fächer: Benannte Fächer zuerst (alphabetisch), dann "Ohne Fachzuordnung"
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      if (a.compartmentName === 'Ohne Fachzuordnung') return 1;
      if (b.compartmentName === 'Ohne Fachzuordnung') return -1;
      return a.compartmentName.localeCompare(b.compartmentName, 'de');
    });

    return sortedGroups;
  };

  // KI-Inhaltsabgleich starten
  const handleOpenAIAnalysis = () => {
    setAiAnalysisResult(null);
    setAiAnalysisError(null);
    setAiAnalysisCompartment(null);
    setAiAnalysisDialogOpen(true);
  };

  const handleOpenCompartmentAIAnalysis = (compartment: CompartmentGroup) => {
    if (!compartment.compartmentId) {
      setError('Für "Ohne Fachzuordnung" ist aktuell nur der Schrank-Gesamtabgleich verfügbar.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setAiAnalysisResult(null);
    setAiAnalysisError(null);
    setAiAnalysisCompartment({ id: compartment.compartmentId, name: compartment.compartmentName });
    setAiAnalysisDialogOpen(true);
  };

  // Foto aufnehmen für KI-Analyse
  const handleCapturePhoto = () => {
    cameraPhotoInputRef.current?.click();
  };

  // Foto-Datei hochladen für KI-Analyse
  const handleUploadPhoto = () => {
    uploadPhotoInputRef.current?.click();
  };

  // Foto verarbeiten und an KI senden
  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCabinet) return;

    setAiAnalysisLoading(true);
    setAiAnalysisError(null);

    try {
      // Bild als Base64 konvertieren
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // An Backend senden
      const response = await aiAPI.analyzeInventoryPhoto(
        selectedCabinet.id,
        base64,
        aiAnalysisCompartment?.id
      );
      
      setAiAnalysisResult(response.data.analysis);
      setSuccess('KI-Analyse erfolgreich durchgeführt!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Fehler bei KI-Analyse:', err);
      setAiAnalysisError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        'Fehler bei der KI-Analyse. Bitte versuchen Sie es erneut.'
      );
    } finally {
      setAiAnalysisLoading(false);
      // Input zurücksetzen für erneute Auswahl
      if (cameraPhotoInputRef.current) cameraPhotoInputRef.current.value = '';
      if (uploadPhotoInputRef.current) uploadPhotoInputRef.current.value = '';
    }
  };


  const handleOpenInventory = async (cabinet: Cabinet) => {
    setSelectedCabinet(cabinet);
    await fetchCabinetMaterials(cabinet.id);
    setDialogOpen(true);
  };

  const handleClearCabinet = async () => {
    if (!selectedCabinet) return;

    try {
      // Nutze den speziellen "clear" Endpoint, der:
      // - Alle Materialien mit usage_type='correction' protokolliert
      // - Die Fächerstruktur erhält
      await cabinetAPI.clear(selectedCabinet.id);
      
      setSuccess(`Schrank "${selectedCabinet.name}" wurde geleert!`);
      setClearDialogOpen(false);
      setDialogOpen(false);
      
      // Aktualisiere die Ansicht
      await fetchCabinets();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Fehler beim Leeren des Schranks:', error);
    }
  };

  const handleStartRefill = () => {
    setDialogOpen(false);
    navigate('/scanner', { 
      state: { 
        autoOpenCamera: true,
        inventoryMode: true,
        cabinetId: selectedCabinet?.id,
        cabinetName: selectedCabinet?.name,
      } 
    });
  };

  const isExpiringSoon = (expiryDate: string) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    return expiry < today;
  };

  const getMaterialCount = (cabinetId: number) => {
    // This would need to be fetched separately for each cabinet
    // For now, we'll add it when opening the dialog
    return '...';
  };

  const groupedCabinetMaterials = groupMaterialsByCompartment(cabinetMaterials);
  const aiDialogGroups = aiAnalysisCompartment
    ? groupedCabinetMaterials.filter((group) => group.compartmentId === aiAnalysisCompartment.id)
    : groupedCabinetMaterials;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Inventur
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Prüfen Sie den Inhalt der Schränke und führen Sie Inventur durch
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {cabinets.map((cabinet) => (
          <Grid item xs={12} sm={6} md={4} key={cabinet.id}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <InventoryIcon color="primary" />
                  <Typography variant="h6">{cabinet.name}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {cabinet.location}
                </Typography>
                {cabinet.description && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {cabinet.description}
                  </Typography>
                )}
                <Chip 
                  label={`Kapazität: ${cabinet.capacity}`} 
                  size="small" 
                  sx={{ mt: 2 }}
                />
              </CardContent>
              <CardActions>
                <Button 
                  size="small" 
                  startIcon={<CheckIcon />}
                  onClick={() => handleOpenInventory(cabinet)}
                  fullWidth
                  variant="outlined"
                >
                  Inventur prüfen
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Inventur Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => { setDialogOpen(false); setInventoryMode(false); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          pr: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography component="span" variant="h6" sx={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>
              Inventur: {selectedCabinet?.name}
            </Typography>
            {inventoryMode && (
              <Chip 
                label={`${confirmedMaterials.size}/${cabinetMaterials.length}`}
                color={confirmedMaterials.size === cabinetMaterials.length ? 'success' : 'warning'}
                size="small"
              />
            )}
          </Box>
          {!inventoryMode ? (
            isMobile ? (
              <Tooltip title="Inventur starten">
                <IconButton
                  color="primary"
                  onClick={() => setInventoryMode(true)}
                  sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
                >
                  <CheckIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Button
                variant="contained"
                color="primary"
                onClick={() => setInventoryMode(true)}
                startIcon={<CheckIcon />}
              >
                Inventur starten
              </Button>
            )
          ) : (
            isMobile ? (
              <Tooltip title="Inventur beenden">
                <IconButton
                  color="secondary"
                  onClick={() => { setInventoryMode(false); setConfirmedMaterials(new Map()); }}
                  sx={{ border: '1px solid', borderColor: 'secondary.main' }}
                >
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => { setInventoryMode(false); setConfirmedMaterials(new Map()); }}
              >
                Inventur beenden
              </Button>
            )
          )}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Standort: {selectedCabinet?.location}
          </Typography>
          
          {/* Scanner-Bereich bei aktiver Inventur */}
          {inventoryMode && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" gutterBottom>
                Material per Scan oder Checkbox bestätigen
              </Typography>
              
              {/* Handscanner-Eingabefeld */}
              <TextField
                inputRef={scannerInputRef}
                fullWidth
                size="small"
                placeholder="Barcode hier scannen oder eingeben..."
                value={scannerBarcode}
                onChange={(e) => setScannerBarcode(e.target.value)}
                onKeyDown={handleScannerInput}
                sx={{ mb: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <QrCodeScannerIcon />
                    </InputAdornment>
                  ),
                }}
              />
              
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {isMobile ? (
                  <Tooltip title="Kamera-Scanner öffnen">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={openCameraScanner}
                      sx={{ border: '1px solid', borderColor: 'primary.main' }}
                    >
                      <CameraIcon />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CameraIcon />}
                    onClick={openCameraScanner}
                  >
                    Kamera-Scanner öffnen
                  </Button>
                )}
                
                {isMobile ? (
                  <Tooltip title="KI Inhaltsabgleich">
                    <IconButton
                      size="small"
                      color="secondary"
                      onClick={handleOpenAIAnalysis}
                      sx={{ border: '1px solid', borderColor: 'secondary.main' }}
                    >
                      <AIIcon />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    startIcon={<AIIcon />}
                    onClick={handleOpenAIAnalysis}
                  >
                    KI Inhaltsabgleich
                  </Button>
                )}
              </Box>
              
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Öffnet den vollständigen Barcode-Scanner mit GS1-Unterstützung und OCR
              </Typography>
            </Paper>
          )}
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Materialien im Schrank ({cabinetMaterials.length})
            </Typography>
            {!inventoryMode && cabinetMaterials.length > 0 && (
              isMobile ? (
                <Tooltip title="KI Inhaltsabgleich">
                  <IconButton
                    size="small"
                    color="secondary"
                    onClick={handleOpenAIAnalysis}
                    sx={{ border: '1px solid', borderColor: 'secondary.main' }}
                  >
                    <AIIcon />
                  </IconButton>
                </Tooltip>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  startIcon={<AIIcon />}
                  onClick={handleOpenAIAnalysis}
                >
                  KI Inhaltsabgleich
                </Button>
              )
            )}
          </Box>
          
          {cabinetMaterials.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              Dieser Schrank ist leer
            </Alert>
          ) : (
            /* Materialien nach Fächern gruppiert anzeigen */
            groupedCabinetMaterials.map((compartmentGroup, groupIndex) => (
              <Accordion 
                key={compartmentGroup.compartmentName} 
                defaultExpanded={groupIndex < 3}
                sx={{ mb: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      📦 {compartmentGroup.compartmentName}
                    </Typography>
                    <Chip 
                      label={`${compartmentGroup.materials.length} Material${compartmentGroup.materials.length !== 1 ? 'ien' : ''}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    {inventoryMode && (
                      <Chip 
                        label={`${compartmentGroup.materials.filter(m => confirmedMaterials.has(m.id)).length}/${compartmentGroup.materials.length} geprüft`}
                        size="small"
                        color={compartmentGroup.materials.every(m => confirmedMaterials.has(m.id)) ? 'success' : 'warning'}
                      />
                    )}
                    <Box sx={{ ml: 'auto', mr: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="secondary"
                        startIcon={<AIIcon />}
                        disabled={!compartmentGroup.compartmentId}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCompartmentAIAnalysis(compartmentGroup);
                        }}
                      >
                        KI pro Fach
                      </Button>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <List dense>
                    {compartmentGroup.materials.map((material) => {
                      const isConfirmed = confirmedMaterials.has(material.id);
                      const confirmation = confirmedMaterials.get(material.id);
                
                return (
                  <ListItem 
                    key={material.id}
                    sx={{
                      border: '1px solid',
                      borderColor: inventoryMode 
                        ? (isConfirmed ? 'success.main' : 'warning.main')
                        : '#e0e0e0',
                      borderRadius: 1,
                      mb: 1,
                      bgcolor: isExpired(material.expiry_date) ? '#ffebee' : 
                               isExpiringSoon(material.expiry_date) ? '#fff3e0' : 
                               (inventoryMode && isConfirmed) ? '#e8f5e9' : 'transparent'
                    }}
                    secondaryAction={
                      inventoryMode && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {isConfirmed ? (
                            <Tooltip title={`Bestätigt per ${confirmation?.method === 'scan' ? 'Scan' : 'Checkbox'}`}>
                              <IconButton color="success" onClick={() => unconfirmMaterial(material.id)}>
                                <ConfirmedIcon />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Als vorhanden bestätigen">
                              <IconButton color="warning" onClick={() => confirmMaterial(material.id, 'manual')}>
                                <UnconfirmedIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Bestand korrigieren">
                            <IconButton color="primary" onClick={() => openCorrectionDialog(material)}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )
                    }
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          {inventoryMode && (
                            <Checkbox
                              checked={isConfirmed}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  confirmMaterial(material.id, 'manual');
                                } else {
                                  unconfirmMaterial(material.id);
                                }
                              }}
                              sx={{ p: 0, mr: 1 }}
                            />
                          )}
                          <Typography variant="subtitle1" fontWeight="bold">
                            {material.name}
                          </Typography>
                          {material.is_consignment && (
                            <Chip label="K" size="small" color="info" title="Konsignation" />
                          )}
                          {material.category_name && (
                            <Chip label={material.category_name} size="small" variant="outlined" />
                          )}
                          {inventoryMode && isConfirmed && confirmation?.method === 'scan' && (
                            <Chip label="Gescannt" size="small" color="success" icon={<QrCodeScannerIcon />} />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          {/* Zeile 1: GTIN, LOT, Verfallsdatum */}
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 0.5 }}>
                            {material.article_number && (
                              <Typography variant="body2" component="span">
                                <strong>GTIN:</strong> {material.article_number}
                              </Typography>
                            )}
                            {material.lot_number && (
                              <Typography variant="body2" component="span">
                                <strong>LOT:</strong> {material.lot_number}
                              </Typography>
                            )}
                            {material.expiry_date && (
                              <Typography variant="body2" component="span">
                                <strong>Ablauf:</strong> {new Date(material.expiry_date).toLocaleDateString('de-DE')}
                                {isExpired(material.expiry_date) && (
                                  <Chip label="Abgelaufen" size="small" color="error" sx={{ ml: 0.5 }} />
                                )}
                                {isExpiringSoon(material.expiry_date) && !isExpired(material.expiry_date) && (
                                  <Chip label="Läuft ab" size="small" color="warning" sx={{ ml: 0.5 }} />
                                )}
                              </Typography>
                            )}
                          </Box>
                          
                          {/* Zeile 2: Device-Eigenschaften */}
                          {(material.device_diameter || material.device_length || material.shaft_length || 
                            material.french_size || material.guidewire_acceptance || material.shape_name) && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 0.5 }}>
                              {material.shape_name && (
                                <Typography variant="body2" component="span">
                                  <strong>Form:</strong> {material.shape_name}
                                </Typography>
                              )}
                              {material.device_diameter && (
                                <Typography variant="body2" component="span">
                                  <strong>Ø:</strong> {material.device_diameter}
                                </Typography>
                              )}
                              {material.device_length && (
                                <Typography variant="body2" component="span">
                                  <strong>Länge:</strong> {material.device_length}
                                </Typography>
                              )}
                              {material.shaft_length && (
                                <Typography variant="body2" component="span">
                                  <strong>Schaft:</strong> {material.shaft_length}
                                </Typography>
                              )}
                              {material.french_size && (
                                <Typography variant="body2" component="span">
                                  <strong>Fr:</strong> {material.french_size}{!String(material.french_size).toLowerCase().endsWith('f') ? 'F' : ''}
                                </Typography>
                              )}
                              {material.guidewire_acceptance && (
                                <Typography variant="body2" component="span">
                                  <strong>GW:</strong> {material.guidewire_acceptance}
                                </Typography>
                              )}
                            </Box>
                          )}
                          
                          {/* Zeile 3: Hersteller, Bestand */}
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            {material.company_name && (
                              <Typography variant="body2" component="span">
                                <strong>Hersteller:</strong> {material.company_name}
                              </Typography>
                            )}
                            <Typography variant="body2" component="span">
                              <strong>Bestand:</strong> {material.current_stock}
                              {material.min_stock > 0 && material.current_stock < material.min_stock && (
                                <Chip label="Niedrig" size="small" color="warning" sx={{ ml: 0.5 }} />
                              )}
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
                  </List>
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => { setDialogOpen(false); setInventoryMode(false); }}>
            Schließen
          </Button>
          <Button 
            onClick={() => setClearDialogOpen(true)}
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
          >
            Schrank leeren
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Korrektur-Dialog */}
      <Dialog
        open={correctionDialogOpen}
        onClose={() => setCorrectionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Bestand korrigieren
        </DialogTitle>
        <DialogContent>
          {correctionMaterial && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>{correctionMaterial.name}</strong><br />
                  Aktueller Bestand: {correctionMaterial.current_stock}
                </Typography>
              </Alert>
              
              <Typography variant="body2" gutterBottom sx={{ mb: 2 }}>
                Geben Sie den tatsächlich vorhandenen Bestand ein. Die Differenz wird automatisch als Inventur-Korrektur gebucht.
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <IconButton 
                  onClick={() => setCorrectionQuantity(Math.max(0, correctionQuantity - 1))}
                  disabled={correctionQuantity <= 0}
                >
                  <RemoveIcon />
                </IconButton>
                <TextField
                  type="number"
                  value={correctionQuantity}
                  onChange={(e) => setCorrectionQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                  inputProps={{ min: 0, style: { textAlign: 'center' } }}
                  sx={{ width: 100 }}
                />
                <IconButton onClick={() => setCorrectionQuantity(correctionQuantity + 1)}>
                  <AddIcon />
                </IconButton>
                
                {correctionQuantity !== correctionMaterial.current_stock && (
                  <Chip 
                    label={`${correctionQuantity > correctionMaterial.current_stock ? '+' : ''}${correctionQuantity - correctionMaterial.current_stock}`}
                    color={correctionQuantity > correctionMaterial.current_stock ? 'success' : 'error'}
                  />
                )}
              </Box>
              
              <TextField
                fullWidth
                label="Grund der Korrektur (optional)"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="z.B. Schwund, Beschädigung, Nachzählung..."
                multiline
                rows={2}
              />
              
              {processingCorrection && <LinearProgress sx={{ mt: 2 }} />}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCorrectionDialogOpen(false)} disabled={processingCorrection}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleInventoryCorrection}
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            disabled={processingCorrection}
          >
            {correctionQuantity === correctionMaterial?.current_stock ? 'Bestätigen' : 'Korrektur speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bestätigungs-Dialog zum Leeren */}
      <Dialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
      >
        <DialogTitle>
          Schrank wirklich leeren?
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Achtung!</strong> Dies wird alle {cabinetMaterials.length} Materialien 
              aus dem Schrank "{selectedCabinet?.name}" deaktivieren.
            </Typography>
          </Alert>
          <Typography variant="body2">
            Sie können danach neue Materialien hinzufügen, indem Sie Barcodes scannen.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleClearCabinet}
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
          >
            Ja, leeren
          </Button>
        </DialogActions>
      </Dialog>

      {/* KI Inhaltsabgleich Dialog */}
      <Dialog
        open={aiAnalysisDialogOpen}
        onClose={() => { setAiAnalysisDialogOpen(false); setAiAnalysisResult(null); setAiAnalysisError(null); setAiAnalysisCompartment(null); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon color="secondary" />
          KI Inhaltsabgleich: {selectedCabinet?.name}
          {aiAnalysisCompartment ? ` – Fach: ${aiAnalysisCompartment.name}` : ''}
        </DialogTitle>
        <DialogContent>
          {/* Versteckte Inputs für Kamera und Datei-Upload */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraPhotoInputRef}
            style={{ display: 'none' }}
            onChange={handlePhotoSelected}
          />
          <input
            type="file"
            accept="image/*"
            ref={uploadPhotoInputRef}
            style={{ display: 'none' }}
            onChange={handlePhotoSelected}
          />

          {!aiAnalysisResult && !aiAnalysisLoading && (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>So funktioniert der KI-Inhaltsabgleich:</strong>
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  1. {aiAnalysisCompartment ? 'Öffnen Sie das gewählte Fach vollständig' : 'Öffnen Sie den Schrank vollständig'}<br />
                  2. Machen Sie ein Foto oder laden Sie ein Bild hoch, auf dem der <strong>{aiAnalysisCompartment ? 'gesamte Fachinhalt' : 'gesamte Schrankinhalt'}</strong> sichtbar ist<br />
                  3. Die KI vergleicht das Foto mit der Materialliste und gibt Wahrscheinlichkeiten an
                </Typography>
              </Alert>

              <Box sx={{ textAlign: 'center', py: 4, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  startIcon={<PhotoCameraIcon />}
                  onClick={handleCapturePhoto}
                  sx={{ px: 4, py: 2 }}
                >
                  Foto des Schrankinhalts aufnehmen
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="large"
                  startIcon={<UploadIcon />}
                  onClick={handleUploadPhoto}
                  sx={{ px: 4, py: 2 }}
                >
                  Foto hochladen
                </Button>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle2" gutterBottom>
                Aktuelle Materialliste {aiAnalysisCompartment ? '(gewähltes Fach)' : '(nach Fächern sortiert)'}:
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                {aiDialogGroups.map((group) => (
                  <Box key={group.compartmentName} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="primary">
                      📦 {group.compartmentName} ({group.materials.length})
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      {group.materials.map((m, idx) => (
                        <Typography key={idx} variant="body2" color="text.secondary">
                          • {m.name} - Bestand: {m.current_stock}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Paper>
            </>
          )}

          {aiAnalysisLoading && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress size={60} color="secondary" />
              <Typography variant="h6" sx={{ mt: 3 }}>
                KI analysiert das Foto...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Dies kann einige Sekunden dauern.
              </Typography>
            </Box>
          )}

          {aiAnalysisError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {aiAnalysisError}
            </Alert>
          )}

          {aiAnalysisResult && (
            <>
              {/* Gesamtergebnis */}
              <Paper 
                sx={{ 
                  p: 3, 
                  mb: 3, 
                  bgcolor: aiAnalysisResult.overallMatch >= 0.8 ? '#e8f5e9' : 
                           aiAnalysisResult.overallMatch >= 0.5 ? '#fff3e0' : '#ffebee'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Typography variant="h5">
                    Übereinstimmung: {Math.round(aiAnalysisResult.overallMatch * 100)}%
                  </Typography>
                  <Chip 
                    label={aiAnalysisResult.overallMatch >= 0.8 ? 'Gut' : 
                           aiAnalysisResult.overallMatch >= 0.5 ? 'Prüfen' : 'Abweichung'}
                    color={aiAnalysisResult.overallMatch >= 0.8 ? 'success' : 
                           aiAnalysisResult.overallMatch >= 0.5 ? 'warning' : 'error'}
                  />
                </Box>
                <Typography variant="body1">
                  {aiAnalysisResult.analysis}
                </Typography>
              </Paper>

              {/* Ergebnisse nach Fächern */}
              {aiAnalysisResult.compartmentResults.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Analyse nach Fächern
                  </Typography>
                  {aiAnalysisResult.compartmentResults.map((comp, idx) => (
                    <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          📦 {comp.compartmentName}
                        </Typography>
                        <Chip 
                          label={`${Math.round(comp.matchProbability * 100)}%`}
                          size="small"
                          color={comp.matchProbability >= 0.8 ? 'success' : 
                                 comp.matchProbability >= 0.5 ? 'warning' : 'error'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {comp.notes}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}

              {/* Diskrepanzen */}
              {aiAnalysisResult.discrepancies.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Mögliche Abweichungen:
                  </Typography>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {aiAnalysisResult.discrepancies.map((d, idx) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              {/* Empfehlungen */}
              {aiAnalysisResult.recommendations.length > 0 && (
                <Alert severity="info">
                  <Typography variant="subtitle2" gutterBottom>
                    Empfehlungen:
                  </Typography>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {aiAnalysisResult.recommendations.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    startIcon={<PhotoCameraIcon />}
                    onClick={() => { setAiAnalysisResult(null); setAiAnalysisError(null); }}
                  >
                    Neues Foto aufnehmen
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<UploadIcon />}
                    onClick={() => { setAiAnalysisResult(null); setAiAnalysisError(null); }}
                  >
                    Neues Foto hochladen
                  </Button>
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAiAnalysisDialogOpen(false); setAiAnalysisResult(null); setAiAnalysisError(null); setAiAnalysisCompartment(null); }}>
            Schließen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Inventory;
