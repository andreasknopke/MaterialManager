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
} from '@mui/icons-material';
import { cabinetAPI, materialAPI } from '../services/api';
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

const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
      if (gs1Data.lot) lotNumber = gs1Data.lot;
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
        onClose={() => { setDialogOpen(false); setInventoryMode(false); stopScanner(); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            Inventur: {selectedCabinet?.name}
            {inventoryMode && (
              <Chip 
                label={`${confirmedMaterials.size}/${cabinetMaterials.length} geprüft`}
                color={confirmedMaterials.size === cabinetMaterials.length ? 'success' : 'warning'}
                size="small"
                sx={{ ml: 2 }}
              />
            )}
          </Box>
          {!inventoryMode ? (
            <Button
              variant="contained"
              color="primary"
              onClick={() => setInventoryMode(true)}
              startIcon={<CheckIcon />}
            >
              Inventur starten
            </Button>
          ) : (
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => { setInventoryMode(false); setConfirmedMaterials(new Map()); stopScanner(); }}
            >
              Inventur beenden
            </Button>
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
              
              <Button
                size="small"
                variant="outlined"
                startIcon={<CameraIcon />}
                onClick={openCameraScanner}
              >
                Kamera-Scanner öffnen
              </Button>
              
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Öffnet den vollständigen Barcode-Scanner mit GS1-Unterstützung und OCR
              </Typography>
            </Paper>
          )}
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="h6" gutterBottom>
            Materialien im Schrank ({cabinetMaterials.length})
          </Typography>
          
          {cabinetMaterials.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              Dieser Schrank ist leer
            </Alert>
          ) : (
            <List>
              {cabinetMaterials.map((material) => {
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
                          
                          {/* Zeile 3: Hersteller, Fach, Bestand */}
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            {material.company_name && (
                              <Typography variant="body2" component="span">
                                <strong>Hersteller:</strong> {material.company_name}
                              </Typography>
                            )}
                            {material.compartment_name && (
                              <Typography variant="body2" component="span">
                                <strong>Fach:</strong> {material.compartment_name}
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
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => { setDialogOpen(false); setInventoryMode(false); stopScanner(); }}>
            Schließen
          </Button>
          <Button 
            onClick={handleStartRefill}
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            color="primary"
          >
            Material scannen
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
    </Box>
  );
};

export default Inventory;
