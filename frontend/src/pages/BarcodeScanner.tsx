import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
  Chip,
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
  BluetoothConnected as BluetoothIcon,
  TextFields as TextFieldsIcon,
  QrCode2 as BarcodeIcon,
  CameraAlt as CaptureIcon,
  Check as ConfirmIcon,
  Refresh as RetryIcon,
} from '@mui/icons-material';
import { barcodeAPI, materialAPI } from '../services/api';
import { parseGS1Barcode, isValidGS1Barcode, GS1Data } from '../utils/gs1Parser';
import { BrowserMultiFormatReader, DecodeHintType } from '@zxing/library';
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
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const handscannerInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<boolean>(false);
  
  // Scanner-Modi: 'barcode' oder 'ocr'
  const [scanMode, setScanMode] = useState<'barcode' | 'ocr'>('barcode');
  const scanModeRef = useRef<'barcode' | 'ocr'>('barcode');
  
  // Update ref when state changes
  useEffect(() => {
    scanModeRef.current = scanMode;
  }, [scanMode]);
  
  // OCR-spezifische States
  const [ocrFrozen, setOcrFrozen] = useState(false);
  const [selectedOcrText, setSelectedOcrText] = useState<string>('');
  const [frozenImageData, setFrozenImageData] = useState<string>('');
  
  // Rechteck-Auswahl für OCR
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [startPoint, setStartPoint] = useState<{x: number, y: number} | null>(null);
  const frozenImageRef = useRef<HTMLImageElement>(null);
  
  // Video-Dimensionen für Overlay-Skalierung
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0, displayWidth: 0, displayHeight: 0 });
  
  // Scanner-Einstellungen aus Admin laden
  const scannerSettings = getScannerSettings();
  
  // Interventionsmodus prüfen
  const interventionSession = getInterventionSession();
  const isInterventionMode = interventionSession.active;
  
  // Entnahme-Modus (wenn über Dashboard "Entnahme" gestartet)
  const locationState = location.state as { removalMode?: boolean } | null;
  const isRemovalMode = locationState?.removalMode || isInterventionMode;
  
  // Neuer State für GTIN-Auswahl-Dialog
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [scannedGS1Data, setScannedGS1Data] = useState<GS1Data | null>(null);
  const [gtinMasterData, setGtinMasterData] = useState<any>(null);
  const [existingMaterials, setExistingMaterials] = useState<any[]>([]);

  // Scan-Linie Animation
  const scanLineAnimationRef = useRef<number | null>(null);
  const [scanLineColor, setScanLineColor] = useState<'red' | 'green'>('red');

  // Zeichne Scan-Bereich Overlay (statische Linie)
  const drawScanOverlay = useCallback((forceGreen: boolean = false) => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !cameraOpen || scanMode !== 'barcode') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;

    // Canvas auf Video-Display-Größe setzen
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Hintergrund verdunkeln
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Scan-Bereich berechnen (85% der Breite, 25% der Höhe, zentriert)
    const scanAreaWidth = displayWidth * 0.85;
    const scanAreaHeight = displayHeight * 0.25;
    const scanAreaX = (displayWidth - scanAreaWidth) / 2;
    const scanAreaY = (displayHeight - scanAreaHeight) / 2;

    // Scan-Bereich ausschneiden (transparent machen)
    ctx.clearRect(scanAreaX, scanAreaY, scanAreaWidth, scanAreaHeight);

    // Scan-Bereich Rahmen zeichnen
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 3;
    ctx.strokeRect(scanAreaX, scanAreaY, scanAreaWidth, scanAreaHeight);

    // Ecken hervorheben
    const cornerLength = 25;
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 5;

    // Oben links
    ctx.beginPath();
    ctx.moveTo(scanAreaX, scanAreaY + cornerLength);
    ctx.lineTo(scanAreaX, scanAreaY);
    ctx.lineTo(scanAreaX + cornerLength, scanAreaY);
    ctx.stroke();

    // Oben rechts
    ctx.beginPath();
    ctx.moveTo(scanAreaX + scanAreaWidth - cornerLength, scanAreaY);
    ctx.lineTo(scanAreaX + scanAreaWidth, scanAreaY);
    ctx.lineTo(scanAreaX + scanAreaWidth, scanAreaY + cornerLength);
    ctx.stroke();

    // Unten links
    ctx.beginPath();
    ctx.moveTo(scanAreaX, scanAreaY + scanAreaHeight - cornerLength);
    ctx.lineTo(scanAreaX, scanAreaY + scanAreaHeight);
    ctx.lineTo(scanAreaX + cornerLength, scanAreaY + scanAreaHeight);
    ctx.stroke();

    // Unten rechts
    ctx.beginPath();
    ctx.moveTo(scanAreaX + scanAreaWidth - cornerLength, scanAreaY + scanAreaHeight);
    ctx.lineTo(scanAreaX + scanAreaWidth, scanAreaY + scanAreaHeight);
    ctx.lineTo(scanAreaX + scanAreaWidth, scanAreaY + scanAreaHeight - cornerLength);
    ctx.stroke();

    // Statische Scan-Linie in der Mitte
    const lineY = scanAreaY + scanAreaHeight / 2;
    const lineColor = forceGreen || scanLineColor === 'green' ? '#00ff00' : '#ff0000';
    
    // Scan-Linie mit Farbverlauf
    const gradient = ctx.createLinearGradient(scanAreaX, lineY, scanAreaX + scanAreaWidth, lineY);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.05, lineColor);
    gradient.addColorStop(0.95, lineColor);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(scanAreaX, lineY);
    ctx.lineTo(scanAreaX + scanAreaWidth, lineY);
    ctx.stroke();

    // Kontinuierlich neu zeichnen für flüssige Darstellung
    if (cameraOpen && scanMode === 'barcode' && !ocrFrozen) {
      scanLineAnimationRef.current = requestAnimationFrame(() => drawScanOverlay(false));
    }
  }, [cameraOpen, scanMode, ocrFrozen, scanLineColor]);

  // Auto-open camera if navigated from dashboard or scanning cabinet (nur wenn Kamera aktiviert)
  useEffect(() => {
    const state = location.state as { 
      autoOpenCamera?: boolean; 
      scanCabinet?: boolean; 
      returnTo?: string; 
      removalMode?: boolean;
      returnToMaterialForm?: boolean;
      scanMode?: 'gs1' | 'qr';
      scanPatientBarcode?: boolean;
      assumeGS1?: boolean;
    } | null;
    
    // Auto-Open für verschiedene Szenarien
    if ((state?.autoOpenCamera || state?.scanCabinet || state?.returnToMaterialForm || state?.scanPatientBarcode) && scannerSettings.cameraEnabled) {
      console.log('Auto-opening camera:', state);
      setCameraOpen(true);
    }
  }, [location.state]);

  useEffect(() => {
    console.log('useEffect triggered, cameraOpen:', cameraOpen, 'videoRef.current:', !!videoRef.current);
    
    if (!cameraOpen) {
      // Animation stoppen beim Schließen
      if (scanLineAnimationRef.current) {
        cancelAnimationFrame(scanLineAnimationRef.current);
        scanLineAnimationRef.current = null;
      }
      scanLoopRef.current = false;
      return;
    }

    // OCR-States zurücksetzen beim Öffnen
    setOcrFrozen(false);
    setSelectionRect(null);
    setSelectedOcrText('');
    setFrozenImageData('');

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
          
          // Standard-Auflösung für beide Modi
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          
          streamRef.current = stream;
          console.log('✓ Kamera-Berechtigung erhalten');
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            console.log('✓ Video-Stream gestartet');
            
            // Video-Dimensionen speichern
            const updateDimensions = () => {
              if (videoRef.current) {
                setVideoDimensions({
                  width: videoRef.current.videoWidth,
                  height: videoRef.current.videoHeight,
                  displayWidth: videoRef.current.clientWidth,
                  displayHeight: videoRef.current.clientHeight,
                });
              }
            };
            videoRef.current.onloadedmetadata = updateDimensions;
            updateDimensions();
            
            // Overlay-Animation starten (nur im Barcode-Modus)
            if (scanModeRef.current === 'barcode') {
              setTimeout(() => {
                drawScanOverlay(false);
              }, 100);
            }
            
            // ZXing Scanner nur im Barcode-Modus starten
            if (scanModeRef.current === 'barcode') {
              // Prüfe ob GS1-Modus aktiviert werden soll
              // GS1 ist Standard für Material-Scans, aber deaktiviert für Patienten-ID und Schrank-QR
              const locState = location.state as { 
                scanPatientBarcode?: boolean; 
                scanCabinet?: boolean;
                assumeGS1?: boolean;
              } | null;
              
              // GS1-Modus: aktiviert außer bei Patienten-Barcode oder Schrank-QR-Scan
              const shouldAssumeGS1 = locState?.assumeGS1 !== false && 
                                      !locState?.scanPatientBarcode && 
                                      !locState?.scanCabinet;
              
              const hints = new Map();
              if (shouldAssumeGS1) {
                hints.set(DecodeHintType.ASSUME_GS1, true);
                console.log('GS1-Modus aktiviert (Material-Scan)');
              } else {
                console.log('GS1-Modus deaktiviert (Patienten-ID oder QR-Code)');
              }
              
              const codeReader = new BrowserMultiFormatReader(hints);
              codeReaderRef.current = codeReader;
              
              console.log('Starte Barcode-Erkennung...');
              scanLoopRef.current = true;
              
              // Canvas für Scan-Bereich-Ausschnitt erstellen
              const cropCanvas = document.createElement('canvas');
              const cropCtx = cropCanvas.getContext('2d');
              
              // Kontinuierliches Scanning nur im Scan-Bereich
              const scanLoop = async () => {
                while (scanLoopRef.current && videoRef.current && scanModeRef.current === 'barcode') {
                try {
                  const video = videoRef.current;
                  
                  // Scan-Bereich berechnen (85% der Breite, 25% der Höhe, zentriert)
                  // Diese Werte müssen mit drawScanOverlay übereinstimmen!
                  const videoWidth = video.videoWidth;
                  const videoHeight = video.videoHeight;
                  const scanAreaWidth = Math.round(videoWidth * 0.85);
                  const scanAreaHeight = Math.round(videoHeight * 0.25);
                  const scanAreaX = Math.round((videoWidth - scanAreaWidth) / 2);
                  const scanAreaY = Math.round((videoHeight - scanAreaHeight) / 2);
                  
                  // Canvas auf Scan-Bereich-Größe setzen
                  cropCanvas.width = scanAreaWidth;
                  cropCanvas.height = scanAreaHeight;
                  
                  // Nur den Scan-Bereich auf Canvas zeichnen
                  if (cropCtx) {
                    cropCtx.drawImage(
                      video,
                      scanAreaX, scanAreaY, scanAreaWidth, scanAreaHeight, // Quellbereich
                      0, 0, scanAreaWidth, scanAreaHeight // Zielbereich
                    );
                  }
                  
                  // ZXing auf dem zugeschnittenen Canvas scannen (als ImageData)
                  // Canvas zu Data-URL konvertieren für ZXing (JPEG ist schneller als PNG)
                  const imageUrl = cropCanvas.toDataURL('image/jpeg', 0.8);
                  
                  let result;
                  try {
                    result = await codeReader.decodeFromImageUrl(imageUrl);
                  } catch (err: any) {
                    // NotFoundException ist normal beim Scannen - ignorieren
                    if (err.name !== 'NotFoundException') {
                      throw err;
                    }
                  }
                  
                  if (result) {
                    const scannedCode = result.getText();
                    console.log('✓ Barcode gescannt:', scannedCode);
                    console.log('Format:', result.getBarcodeFormat());
                    
                    // Grüne Linie anzeigen bei Erkennung
                    setScanLineColor('green');
                    drawScanOverlay(true);
                    
                    // Nach 500ms Dialog schließen und verarbeiten
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Animation stoppen
                    if (scanLineAnimationRef.current) {
                      cancelAnimationFrame(scanLineAnimationRef.current);
                    }
                    scanLoopRef.current = false;
                    
                    // Stream stoppen
                    stream.getTracks().forEach(track => track.stop());
                    
                    // Check if we're scanning for MaterialForm
                    const state = location.state as { 
                      scanCabinet?: boolean; 
                      returnTo?: string;
                      returnToMaterialForm?: boolean;
                      scanMode?: 'gs1' | 'qr';
                      materialId?: string;
                    } | null;
                    
                    if (state?.returnToMaterialForm) {
                      console.log('Rückkehr zu MaterialForm mit Code:', scannedCode);
                      setCameraOpen(false);
                      setScanLineColor('red');
                      // Zurück zur MaterialForm navigieren
                      const returnPath = state.materialId 
                        ? `/materials/${state.materialId}/edit` 
                        : '/materials/new';
                      navigate(returnPath, {
                        state: {
                          fromScanner: true,
                          scannedCode: scannedCode,
                          scanMode: state.scanMode,
                        }
                      });
                      return;
                    }
                    
                    // Check if we're scanning a cabinet QR code
                    if (state?.scanCabinet) {
                      try {
                        const cabinetData = JSON.parse(scannedCode);
                        if (cabinetData.type === 'CABINET') {
                          console.log('Cabinet QR code detected:', cabinetData);
                          setCameraOpen(false);
                          setScanLineColor('red');
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
                    setScanLineColor('red');
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
            
            // Scan-Loop starten
            scanLoop();
            }
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
      scanLoopRef.current = false;
      if (scanLineAnimationRef.current) {
        cancelAnimationFrame(scanLineAnimationRef.current);
        scanLineAnimationRef.current = null;
      }
      if (codeReaderRef.current) {
        console.log('Stoppe Scanner...');
        codeReaderRef.current.reset();
      }
      // Video-Stream stoppen
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]); // Nur bei cameraOpen neu starten, NICHT bei scanMode-Wechsel

  // Effect für Modus-Wechsel während Kamera offen
  useEffect(() => {
    if (!cameraOpen) return;
    
    if (scanMode === 'barcode' && !ocrFrozen) {
      // Overlay starten
      drawScanOverlay(false);
    } else {
      // Animation stoppen im OCR-Modus oder wenn frozen
      if (scanLineAnimationRef.current) {
        cancelAnimationFrame(scanLineAnimationRef.current);
        scanLineAnimationRef.current = null;
      }
      
      // Barcode-Scanner stoppen im OCR-Modus
      if (scanMode === 'ocr') {
        console.log('Wechsel zu OCR-Modus: Barcode-Scanner stoppen');
        scanLoopRef.current = false;
        if (codeReaderRef.current) {
          codeReaderRef.current.reset();
        }
      }
    }
  }, [scanMode, cameraOpen, ocrFrozen, drawScanOverlay]);

  // OCR-Modus: Bild einfrieren und zur Analyse vorbereiten
  const freezeForOCR = async () => {
    if (!videoRef.current) {
      setError('Kein Video-Stream verfügbar');
      return;
    }
    
    console.log('freezeForOCR: Start');
    
    // Canvas erstellen und aktuelles Video-Frame erfassen
    const canvas = canvasRef.current;
    if (!canvas) {
      setError('Canvas nicht verfügbar');
      return;
    }
    
    const video = videoRef.current;
    
    // Prüfe ob Video bereit ist
    if (video.readyState < 2) {
      console.log('freezeForOCR: Video noch nicht bereit, warte...');
      setError('Video noch nicht bereit. Bitte erneut versuchen.');
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setError('Canvas-Context nicht verfügbar');
      return;
    }
    
    ctx.drawImage(video, 0, 0);
    
    // Bild als Data-URL speichern (JPEG für bessere iOS-Kompatibilität)
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    console.log('freezeForOCR: Image captured, size:', imageData.length);
    
    if (imageData.length < 1000) {
      console.error('freezeForOCR: Bild zu klein, wahrscheinlich fehlgeschlagen');
      setError('Bild konnte nicht erfasst werden. Bitte erneut versuchen.');
      return;
    }
    
    // Dimensionen für Skalierung speichern BEVOR ocrFrozen gesetzt wird
    const dims = {
      width: video.videoWidth,
      height: video.videoHeight,
      displayWidth: video.clientWidth,
      displayHeight: video.clientHeight,
    };
    console.log('freezeForOCR: Dimensions:', dims);
    
    // WICHTIG: Auf iOS NICHT den Stream pausieren, nur das Bild speichern
    // Das Video läuft im Hintergrund weiter, wird aber durch das Bild verdeckt
    setVideoDimensions(dims);
    
    // Jetzt erst frozen setzen - damit wird das Bild angezeigt
    setFrozenImageData(imageData);
    setOcrFrozen(true);
    setSelectionRect(null);
    
    // Hinweis anzeigen statt automatisch OCR zu starten
    setSuccess('Ziehen Sie ein Rechteck um den Text, den Sie erkennen möchten');
  };

  // Maus/Touch-Events für Rechteck-Zeichnung
  const getEventPosition = (e: React.MouseEvent | React.TouchEvent, rect: DOMRect) => {
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const handleSelectionStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!ocrFrozen || ocrLoading) return;
    
    const container = e.currentTarget.getBoundingClientRect();
    const pos = getEventPosition(e, container);
    
    setIsDrawing(true);
    setStartPoint(pos);
    setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    setSelectedOcrText('');
    setSuccess('');
  };

  const handleSelectionMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !startPoint) return;
    
    const container = e.currentTarget.getBoundingClientRect();
    const pos = getEventPosition(e, container);
    
    const x = Math.min(startPoint.x, pos.x);
    const y = Math.min(startPoint.y, pos.y);
    const width = Math.abs(pos.x - startPoint.x);
    const height = Math.abs(pos.y - startPoint.y);
    
    setSelectionRect({ x, y, width, height });
  };

  const handleSelectionEnd = async () => {
    if (!isDrawing || !selectionRect || selectionRect.width < 10 || selectionRect.height < 10) {
      setIsDrawing(false);
      setStartPoint(null);
      return;
    }
    
    setIsDrawing(false);
    setStartPoint(null);
    
    // OCR auf den ausgewählten Bereich anwenden
    await performOCROnSelection();
  };

  // OCR nur auf den ausgewählten Bereich anwenden
  const performOCROnSelection = async () => {
    if (!selectionRect || !frozenImageRef.current) return;
    
    setOcrLoading(true);
    setOcrProgress(0);
    setError('');
    
    try {
      const img = frozenImageRef.current;
      
      // Bei object-fit: contain wird das Bild zentriert und hat ggf. schwarze Balken
      // Wir müssen die tatsächliche Position und Größe des Bildes im Container berechnen
      const containerWidth = img.clientWidth;
      const containerHeight = img.clientHeight;
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      
      // Berechne die tatsächliche angezeigte Größe des Bildes (nach contain-Skalierung)
      const containerAspect = containerWidth / containerHeight;
      const imageAspect = naturalWidth / naturalHeight;
      
      let displayedWidth: number;
      let displayedHeight: number;
      let offsetX: number;
      let offsetY: number;
      
      if (imageAspect > containerAspect) {
        // Bild ist breiter als Container -> volle Breite, zentriert vertikal
        displayedWidth = containerWidth;
        displayedHeight = containerWidth / imageAspect;
        offsetX = 0;
        offsetY = (containerHeight - displayedHeight) / 2;
      } else {
        // Bild ist höher als Container -> volle Höhe, zentriert horizontal
        displayedHeight = containerHeight;
        displayedWidth = containerHeight * imageAspect;
        offsetX = (containerWidth - displayedWidth) / 2;
        offsetY = 0;
      }
      
      // Skalierung berechnen: Angezeigtes Bild -> Originalbild
      const scaleX = naturalWidth / displayedWidth;
      const scaleY = naturalHeight / displayedHeight;
      
      // Auswahl-Koordinaten relativ zum angezeigten Bild (nicht Container) berechnen
      const adjustedX = selectionRect.x - offsetX;
      const adjustedY = selectionRect.y - offsetY;
      
      // Prüfe ob die Auswahl innerhalb des Bildbereichs liegt
      if (adjustedX < 0 || adjustedY < 0 || 
          adjustedX + selectionRect.width > displayedWidth ||
          adjustedY + selectionRect.height > displayedHeight) {
        console.warn('Auswahl liegt teilweise außerhalb des Bildes');
      }
      
      // Ausgewählten Bereich im Original-Koordinatensystem (mit Begrenzung)
      const cropX = Math.max(0, Math.round(adjustedX * scaleX));
      const cropY = Math.max(0, Math.round(adjustedY * scaleY));
      const cropWidth = Math.min(naturalWidth - cropX, Math.round(selectionRect.width * scaleX));
      const cropHeight = Math.min(naturalHeight - cropY, Math.round(selectionRect.height * scaleY));
      
      // Validierung: Mindestgröße für OCR
      if (cropWidth < 20 || cropHeight < 10) {
        throw new Error('Ausgewählter Bereich zu klein für OCR');
      }
      
      console.log('OCR Selection:', { 
        container: { containerWidth, containerHeight },
        image: { naturalWidth, naturalHeight, displayedWidth, displayedHeight },
        offset: { offsetX, offsetY },
        selection: selectionRect, 
        adjusted: { adjustedX, adjustedY },
        crop: { cropX, cropY, cropWidth, cropHeight },
        scale: { scaleX, scaleY }
      });
      
      // Für bessere OCR: Bild hochskalieren (mindestens 2x, ideal 3x für kleine Texte)
      const scaleFactor = Math.max(2, Math.min(4, 600 / cropHeight)); // Ziel: ~600px Höhe
      const targetWidth = Math.round(cropWidth * scaleFactor);
      const targetHeight = Math.round(cropHeight * scaleFactor);
      
      // Canvas für den Ausschnitt erstellen
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas-Context nicht verfügbar');
      }
      
      // Bessere Bildqualität beim Skalieren
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Ausschnitt zeichnen und hochskalieren
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
      
      // Bildverarbeitung: Kontrast erhöhen und Schwarz/Weiß-Konvertierung
      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const data = imageData.data;
      
      // Berechne Histogram für adaptive Schwellwert
      let minLum = 255, maxLum = 0;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
      }
      
      // Kontrast stretchen und leicht aufhellen
      const range = maxLum - minLum || 1;
      for (let i = 0; i < data.length; i += 4) {
        // Luminanz berechnen
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Kontrast stretchen (0-255)
        let newLum = ((lum - minLum) / range) * 255;
        
        // Leichte Gammakorrektion für besseren Kontrast
        newLum = Math.pow(newLum / 255, 0.8) * 255;
        
        // Grayscale mit erhöhtem Kontrast
        data[i] = newLum;     // R
        data[i + 1] = newLum; // G
        data[i + 2] = newLum; // B
        // Alpha bleibt
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      console.log('OCR Canvas erstellt:', targetWidth, 'x', targetHeight, '(skaliert von', cropWidth, 'x', cropHeight, ')');
      
      // OCR durchführen mit optimierten Einstellungen
      const worker = await Tesseract.createWorker('eng', undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });
      
      // PSM 6 = Uniform block of text - für mehrzeilige GS1-Codes
      // PSM 7 = Single line - nur wenn wirklich eine Zeile
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz()-/. ',
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, // PSM 6 = Uniform block (mehrzeilig)
        preserve_interword_spaces: '0',
      });
      
      const result = await worker.recognize(canvas);
      await worker.terminate();
      
      // Roher erkannter Text
      let recognizedText = result.data.text.trim();
      console.log('OCR Rohergebnis:', recognizedText, 'Confidence:', result.data.confidence);
      
      // GS1 Multi-Line Post-Processing:
      // 1. Barcode-Artefakte entfernen (|||, III, lll, etc.)
      // 2. Zeilen zusammenfügen zu einem GS1-String
      recognizedText = cleanOcrForGS1(recognizedText);
      console.log('OCR Nach Bereinigung:', recognizedText);
      
      if (recognizedText) {
        setSelectedOcrText(recognizedText);
        setSuccess(`Text erkannt (${Math.round(result.data.confidence)}% sicher): "${recognizedText.substring(0, 50)}${recognizedText.length > 50 ? '...' : ''}"`);
      } else {
        setError('Kein Text im ausgewählten Bereich erkannt. Versuchen Sie einen größeren Bereich oder bessere Beleuchtung.');
      }
    } catch (err: any) {
      console.error('OCR Fehler:', err);
      setError('OCR-Erkennung fehlgeschlagen: ' + err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  // GS1-Text bereinigen: Zeichen vor (01) und nach dem GS1-Code entfernen
  const cleanGS1Text = (text: string): string => {
    // Suche nach dem Start des GS1-Codes: (01) oder 01 am Anfang einer Zahl
    const gs1StartMatch = text.match(/\(01\)/);
    if (gs1StartMatch && gs1StartMatch.index !== undefined) {
      // Alles vor (01) entfernen
      text = text.substring(gs1StartMatch.index);
    }
    
    // Suche nach dem Ende des GS1-Codes:
    // GS1 endet normalerweise vor einem Leerzeichen, das nicht Teil einer AI ist
    // Typische AIs: (01), (10), (17), (21), (11), (30), etc.
    // Suche nach Leerzeichen gefolgt von etwas das keine AI ist
    const parts = text.split(/\s+/);
    if (parts.length > 1) {
      // Prüfe jeden Teil - behalte nur die die wie GS1 AIs aussehen
      let gs1Parts: string[] = [];
      for (const part of parts) {
        // Teil sieht wie GS1 aus wenn er mit ( beginnt oder nur Ziffern/Klammern enthält
        if (part.match(/^\(\d{2}\)/) || part.match(/^[\d()]+$/)) {
          gs1Parts.push(part);
        } else if (gs1Parts.length > 0) {
          // Erstes Teil das nicht GS1 ist - aufhören
          break;
        }
        // Ignoriere Text vor dem ersten GS1-Teil
      }
      if (gs1Parts.length > 0) {
        text = gs1Parts.join('');
      }
    }
    
    // Entferne trailing Zeichen die keine GS1-Daten sind (Buchstaben am Ende ohne Klammer)
    // z.B. "(01)12345678901234(10)LOT123ABC" ist OK, aber "(01)12345... XYZ" -> XYZ entfernen
    text = text.replace(/\s+.*$/, '');
    
    return text;
  };

  // OCR-Ergebnis für GS1 Multi-Line bereinigen
  // Entfernt Barcode-Artefakte und fügt Zeilen zusammen
  const cleanOcrForGS1 = (text: string): string => {
    // 1. Barcode-Artefakte entfernen (Striche werden oft als | I l 1 erkannt)
    // Entferne Sequenzen von 3+ ähnlichen Zeichen die wie Barcode-Striche aussehen
    text = text.replace(/[|Il1]{3,}/g, '');
    text = text.replace(/[!|]{3,}/g, '');
    
    // 2. Zeilen extrahieren und filtern
    const lines = text.split(/[\r\n]+/).map(line => line.trim()).filter(line => line.length > 0);
    
    // 3. Nur Zeilen behalten die GS1-ähnliche Muster enthalten
    // GS1 Pattern: (01), (10), (17), (21), (11), (30) etc. oder Zahlenfolgen
    const gs1Lines: string[] = [];
    for (const line of lines) {
      // Zeile enthält GS1 AI in Klammern?
      if (line.match(/\(\d{2}\)/)) {
        gs1Lines.push(line);
      }
      // Zeile ist reine Zahlen mit Klammern?
      else if (line.match(/^[\d()\-\/\.]+$/) && line.length >= 8) {
        gs1Lines.push(line);
      }
      // Zeile enthält "01" gefolgt von Zahlen (ohne Klammern)?
      else if (line.match(/^01\d{12,}/)) {
        // Füge Klammern hinzu für Konsistenz
        gs1Lines.push('(01)' + line.substring(2));
      }
    }
    
    // 4. Zeilen zusammenfügen
    let result = gs1Lines.join('');
    
    // 5. Leerzeichen und unnötige Zeichen entfernen
    result = result.replace(/\s+/g, '');
    
    // 6. Häufige OCR-Fehler korrigieren
    // O -> 0 in Zahlenkontext (aber nicht in LOT-Nummern nach (10))
    // Wir korrigieren nur vor dem ersten (10)
    const lot10Index = result.indexOf('(10)');
    if (lot10Index > 0) {
      const beforeLot = result.substring(0, lot10Index).replace(/O/g, '0');
      const afterLot = result.substring(lot10Index);
      result = beforeLot + afterLot;
    } else {
      // Kein LOT, alles korrigieren
      result = result.replace(/O/g, '0');
    }
    
    // S -> 5, B -> 8 in reinen Zahlensequenzen (vor erstem Buchstaben-AI)
    // Aber vorsichtig - LOT kann Buchstaben enthalten
    
    console.log('cleanOcrForGS1:', { original: text, lines, gs1Lines, result });
    
    return result;
  };

  // OCR-Auswahl bestätigen und als Barcode verwenden
  const confirmOcrSelection = () => {
    if (!selectedOcrText.trim()) {
      setError('Bitte wählen Sie mindestens einen Text aus');
      return;
    }
    
    // Text bereinigen (Zeilenumbrüche und mehrfache Leerzeichen entfernen)
    let cleanedText = selectedOcrText.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Prüfen ob wir von MaterialForm kommen und zurück navigieren sollen
    const state = location.state as { 
      returnToMaterialForm?: boolean;
      scanMode?: 'gs1' | 'qr';
      materialId?: string;
    } | null;
    
    // Bei GS1-Modus: Text zusätzlich bereinigen
    if (state?.scanMode === 'gs1') {
      const originalText = cleanedText;
      cleanedText = cleanGS1Text(cleanedText);
      if (cleanedText !== originalText) {
        console.log('OCR GS1-Bereinigung:', originalText, '->', cleanedText);
      }
    }
    
    if (state?.returnToMaterialForm) {
      console.log('OCR: Rückkehr zu MaterialForm mit Text:', cleanedText);
      setCameraOpen(false);
      setOcrFrozen(false);
      setSelectionRect(null);
      setSelectedOcrText('');
      
      // Zurück zur MaterialForm navigieren
      const returnPath = state.materialId 
        ? `/materials/${state.materialId}/edit` 
        : '/materials/new';
      navigate(returnPath, {
        state: {
          fromScanner: true,
          scannedCode: cleanedText,
          scanMode: state.scanMode,
        }
      });
      return;
    }
    
    // Normal im BarcodeScanner bleiben
    setBarcode(cleanedText);
    setCameraOpen(false);
    setSuccess('Text übernommen');
    setOcrFrozen(false);
    setSelectionRect(null);
    setSelectedOcrText('');
    
    // Automatisch verarbeiten wenn es wie ein Barcode aussieht
    if (cleanedText.length >= 8 && /^\d+$/.test(cleanedText)) {
      setTimeout(() => handleScannedBarcode(cleanedText), 500);
    }
  };

  // OCR zurücksetzen und neu aufnehmen
  const resetOcr = async () => {
    console.log('resetOcr called');
    setOcrFrozen(false);
    setSelectionRect(null);
    setSelectedOcrText('');
    setFrozenImageData('');
    setOcrLoading(false);
    setOcrProgress(0);
    setError('');
    setSuccess('');
    
    // Da wir den Stream nicht mehr pausieren, müssen wir nur die States zurücksetzen
    // Der Video-Stream läuft bereits im Hintergrund weiter
    
    // Prüfe ob Stream noch aktiv ist
    if (streamRef.current && videoRef.current) {
      const tracks = streamRef.current.getTracks();
      const allEnded = tracks.every(track => track.readyState === 'ended');
      
      if (allEnded) {
        console.log('Stream beendet, fordere neuen an...');
        // Neuen Stream anfordern - iOS benötigt playsinline und muted
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          streamRef.current = newStream;
          videoRef.current.srcObject = newStream;
          // iOS erfordert muted für autoplay
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          await videoRef.current.play();
          console.log('Neuer Stream gestartet');
        } catch (err) {
          console.error('Fehler beim Neustarten des Streams:', err);
          setError('Kamera konnte nicht neu gestartet werden. Bitte Dialog schließen und erneut öffnen.');
        }
      }
      // Kein else nötig - Stream läuft bereits
    }
  };

  // Legacy OCR-Funktion für automatische Barcode-Erkennung
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
    
    // Prüfe ob wir im Patienten-Barcode-Scan-Modus sind
    const locState = location.state as { 
      scanPatientBarcode?: boolean; 
      returnTo?: string;
      assumeGS1?: boolean;
    } | null;
    
    if (locState?.scanPatientBarcode) {
      console.log('Patient-Barcode-Modus: Barcode zurückgeben zum Dashboard');
      // Kamera stoppen und zurück navigieren mit dem gescannten Barcode
      setCameraOpen(false);
      navigate(locState.returnTo || '/', { 
        state: { scannedPatientBarcode: scannedCode },
        replace: true 
      });
      return;
    }
    
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
      
      // Kurze Pause um sicherzustellen, dass der State aktualisiert wurde
      // bevor API-Calls gestartet werden
      await new Promise(resolve => setTimeout(resolve, 100));
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
      console.log('Batch/LOT im Barcode:', gs1Data.batchNumber);
      
      try {
        // Prüfe ob GTIN bekannt ist
        console.log('Rufe searchGTIN API auf...');
        const gtinResponse = await barcodeAPI.searchGTIN(gs1Data.gtin);
        console.log('GTIN API Response:', gtinResponse.data);
        
        if (gtinResponse.data.found) {
          setGtinMasterData(gtinResponse.data.masterData);
          
          // Hole alle Materialien mit dieser GTIN (für Entnahme)
          // Wenn Batch/LOT vorhanden, nach der genauen Charge suchen
          try {
            console.log('Rufe searchMaterialsByGTIN API auf...');
            const materialsResponse = await barcodeAPI.searchMaterialsByGTIN(gs1Data.gtin, gs1Data.batchNumber);
            console.log('Materials API Response:', materialsResponse.data);
            
            if (materialsResponse.data.materials && materialsResponse.data.materials.length > 0) {
              const materials = materialsResponse.data.materials;
              setExistingMaterials(materials);
              
              // AUTOMATISCHE ENTNAHME: Wenn genau 1 Material gefunden und im Entnahme-Modus
              if (materials.length === 1 && isRemovalMode) {
                console.log('Genau 1 Material gefunden - automatische Entnahme');
                // Direkt ausbuchen ohne Dialog
                await handleAutoRemoval(materials[0]);
                return;
              }
              
              // Bei mehreren Materialien: Dialog öffnen
              console.log(`${materials.length} Materialien gefunden - Dialog öffnen`);
              setActionDialogOpen(true);
            } else if (!isRemovalMode) {
              // Keine Materialien mit Bestand, aber nicht im Entnahme-Modus
              setActionDialogOpen(true);
            } else {
              // Im Entnahme-Modus, aber kein Material mit Bestand
              setError('Kein Material mit Bestand für diese GTIN/LOT gefunden');
            }
          } catch (matErr: any) {
            console.log('Materials API Fehler:', matErr.message);
            if (!isRemovalMode) {
              setActionDialogOpen(true);
            } else {
              setError('Fehler bei der Suche nach Materialien');
            }
          }
        } else {
          // GTIN API erfolgreich aber nicht gefunden
          console.log('GTIN nicht in Datenbank gefunden');
          if (!isRemovalMode) {
            handleAddNewMaterialWithGS1(scannedCode, gs1Data);
          } else {
            setError('GTIN nicht bekannt - Material nicht im System');
          }
        }
      } catch (err: any) {
        // GTIN nicht bekannt (404)
        console.log('GTIN API Fehler:', err.response?.status, err.message);
        if (!isRemovalMode) {
          handleAddNewMaterialWithGS1(scannedCode, gs1Data);
        } else {
          setError('GTIN nicht bekannt - Material nicht im System');
        }
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

  // Automatische Entnahme bei eindeutigem Fund (1 Material mit GTIN+LOT)
  const handleAutoRemoval = async (materialItem: any) => {
    setError('');
    setSuccess('');
    
    try {
      // Verwende material_ids (aggregiert) oder id (einzeln)
      const materialIdToUse = materialItem.material_ids || materialItem.id;
      
      // Direkte Entnahme über Material-ID(s)
      const response = await barcodeAPI.removeMaterial(materialIdToUse, {
        quantity: 1,
        user_name: 'System',
        notes: 'Automatische GTIN+LOT Entnahme',
        usage_type: isInterventionMode ? 'patient_use' : 'destock',
      });
      
      const data = response.data;
      
      // Im Interventionsmodus: Entnahme protokollieren
      if (isInterventionMode) {
        addInterventionItem({
          materialName: materialItem.name,
          articleNumber: materialItem.article_number || '',
          lotNumber: materialItem.batch_number || materialItem.lot_number || scannedGS1Data?.batchNumber || '',
          expiryDate: materialItem.expiry_date || scannedGS1Data?.expiryDate || '',
          quantity: 1,
          gtin: materialItem.article_number || scannedGS1Data?.gtin || '',
          isConsignment: Boolean(materialItem.is_consignment),
        });
      }
      
      if (data.deactivated) {
        setSuccess(`✓ Automatisch entnommen: 1x "${materialItem.name}" (LOT: ${materialItem.batch_number || '-'}). Material vollständig entnommen.${isInterventionMode ? ' ✓ Protokolliert' : ''}`);
      } else {
        setSuccess(`✓ Automatisch entnommen: 1x "${materialItem.name}" (LOT: ${materialItem.batch_number || '-'}). Neuer Bestand: ${data.new_stock}${isInterventionMode ? ' ✓ Protokolliert' : ''}`);
      }
      
      // Material für Anzeige setzen (aktualisiert)
      setMaterial({
        ...materialItem,
        current_stock: data.new_stock,
        active: data.new_stock > 0
      });
      
      // Barcode-Feld leeren für nächsten Scan
      setBarcode('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei automatischer Entnahme');
    }
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
          lotNumber: materialItem.batch_number || materialItem.lot_number || scannedGS1Data?.batchNumber || '',
          expiryDate: materialItem.expiry_date || scannedGS1Data?.expiryDate || '',
          quantity: 1,
          gtin: materialItem.gtin || scannedGS1Data?.gtin || '',
          isConsignment: Boolean(materialItem.is_consignment),
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

  // Entnahme rückgängig machen (+1 zum Bestand)
  const handleUndoRemoval = async () => {
    setError('');
    setSuccess('');

    if (!material) {
      setError('Kein Material ausgewählt');
      return;
    }

    try {
      // Verwende material_ids (aggregiert) oder id (einzeln)
      const materialIdToUse = material.material_ids || material.id;
      
      // +1 zum Bestand hinzufügen (Wareneingang)
      const response = await barcodeAPI.addStock(materialIdToUse, {
        quantity: 1,
        user_name: 'System',
        notes: 'Entnahme rückgängig gemacht',
      });
      
      const data = response.data;
      setSuccess(`Entnahme rückgängig gemacht. Neuer Bestand: ${data.new_stock}`);
      
      // Material-Daten aktualisieren
      setMaterial({
        ...material,
        current_stock: data.new_stock,
        active: true
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Rückgängig machen');
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
          expiryDate: material.expiry_date || '',
          quantity: quantity,
          gtin: material.gtin || '',
          isConsignment: Boolean(material.is_consignment),
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

                  {(material.gtin || material.article_number || scannedGS1Data?.gtin) && (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        GTIN
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {material.gtin || material.article_number || scannedGS1Data?.gtin}
                      </Typography>
                    </>
                  )}

                  {(material.batch_number || material.lot_number || scannedGS1Data?.batchNumber) && (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Batch/LOT
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {material.batch_number || material.lot_number || scannedGS1Data?.batchNumber}
                      </Typography>
                    </>
                  )}

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
                      color="warning"
                      startIcon={<AddIcon />}
                      onClick={handleUndoRemoval}
                      sx={{ mt: 2 }}
                    >
                      Entnahme rückgängig (+1)
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
        onClose={() => {
          setCameraOpen(false);
          resetOcr();
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '95vh',
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              {scanMode === 'barcode' ? <BarcodeIcon /> : <TextFieldsIcon />}
              <Typography variant="h6">
                {scanMode === 'barcode' ? 'Barcode scannen' : 'Text erkennen (OCR)'}
              </Typography>
            </Box>
            <IconButton onClick={() => {
              setCameraOpen(false);
              resetOcr();
            }} edge="end">
              <CloseIcon />
            </IconButton>
          </Box>
          
          {/* Modus-Umschaltung */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <ToggleButtonGroup
              value={scanMode}
              exclusive
              onChange={(_, newMode) => {
                if (newMode) {
                  // Barcode-Scanner stoppen beim Wechsel zu OCR
                  if (newMode === 'ocr') {
                    scanLoopRef.current = false;
                  }
                  setScanMode(newMode);
                  resetOcr();
                }
              }}
              size="small"
            >
              <ToggleButton value="barcode">
                <BarcodeIcon sx={{ mr: 1 }} />
                Barcode/QR
              </ToggleButton>
              <ToggleButton value="ocr">
                <TextFieldsIcon sx={{ mr: 1 }} />
                Text (OCR)
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0, position: 'relative', overflow: 'hidden' }}>
          <Box sx={{ 
            width: '100%', 
            position: 'relative',
            backgroundColor: '#000',
            minHeight: 350,
          }}>
            {/* Video oder eingefrorenes Bild */}
            {ocrFrozen && frozenImageData ? (
              <Box 
                sx={{ 
                  position: 'relative', 
                  width: '100%',
                  maxHeight: '450px',
                  overflow: 'hidden',
                }}
              >
                {/* Container für Bild mit Rechteck-Auswahl */}
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    height: 'auto',
                    cursor: ocrFrozen && !ocrLoading ? 'crosshair' : 'default',
                    userSelect: 'none',
                    touchAction: 'none',
                  }}
                  onMouseDown={handleSelectionStart}
                  onMouseMove={handleSelectionMove}
                  onMouseUp={handleSelectionEnd}
                  onMouseLeave={handleSelectionEnd}
                  onTouchStart={handleSelectionStart}
                  onTouchMove={handleSelectionMove}
                  onTouchEnd={handleSelectionEnd}
                >
                  <img 
                    ref={frozenImageRef}
                    id="frozen-ocr-image"
                    src={frozenImageData} 
                    alt="Captured frame"
                    draggable={false}
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: '450px',
                      objectFit: 'contain',
                      display: 'block',
                      pointerEvents: 'none',
                      backgroundColor: '#000',
                    }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      console.log('Frozen image loaded:', img.clientWidth, 'x', img.clientHeight, 'natural:', img.naturalWidth, 'x', img.naturalHeight);
                    }}
                    onError={(e) => {
                      console.error('Frozen image failed to load');
                      setError('Bild konnte nicht geladen werden. Bitte erneut versuchen.');
                      setOcrFrozen(false);
                      setFrozenImageData('');
                    }}
                  />
                  
                  {/* Auswahl-Rechteck */}
                  {selectionRect && selectionRect.width > 0 && selectionRect.height > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${selectionRect.x}px`,
                        top: `${selectionRect.y}px`,
                        width: `${selectionRect.width}px`,
                        height: `${selectionRect.height}px`,
                        border: '3px solid #2196f3',
                        backgroundColor: 'rgba(33, 150, 243, 0.2)',
                        pointerEvents: 'none',
                        boxShadow: '0 0 10px rgba(33, 150, 243, 0.5)',
                      }}
                    />
                  )}
                </Box>
              </Box>
            ) : (
              <>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    maxHeight: '450px',
                    objectFit: 'contain',
                    backgroundColor: '#000',
                  }}
                  playsInline
                  muted
                />
                
                {/* Overlay Canvas für Scan-Bereich (nur im Barcode-Modus) */}
                {scanMode === 'barcode' && (
                  <canvas
                    ref={overlayCanvasRef}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </>
            )}
            
            {/* Hidden canvas for OCR frame capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </Box>
          
          {/* Hinweistext */}
          <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
            {scanMode === 'barcode' && !ocrFrozen && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                align="center"
              >
                Positionieren Sie den Barcode innerhalb des Rechtecks
              </Typography>
            )}
            
            {scanMode === 'ocr' && !ocrFrozen && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                align="center"
              >
                Halten Sie den Text vor die Kamera und drücken Sie "Aufnehmen"
              </Typography>
            )}
            
            {ocrFrozen && (
              <Box>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  align="center"
                  gutterBottom
                >
                  {selectedOcrText 
                    ? 'Text erkannt! Übernehmen oder neuen Bereich auswählen.'
                    : 'Ziehen Sie ein Rechteck um den Text, den Sie erkennen möchten'}
                </Typography>
                
                {/* Erkannter Text Anzeige */}
                {selectedOcrText && (
                  <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Erkannter Text:
                    </Typography>
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        mt: 0.5, 
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedOcrText}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
            
            {/* OCR Progress Indicator */}
            {ocrLoading && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" align="center" color="primary">
                  Texterkennung läuft... {ocrProgress}%
                </Typography>
                <LinearProgress variant="determinate" value={ocrProgress} sx={{ mt: 1 }} />
              </Box>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 2, flexDirection: 'column', gap: 1 }}>
          {/* Barcode-Modus Aktionen */}
          {scanMode === 'barcode' && (
            <>
              <Button onClick={() => {
                setCameraOpen(false);
                resetOcr();
              }} variant="outlined" fullWidth>
                Abbrechen
              </Button>
            </>
          )}
          
          {/* OCR-Modus Aktionen */}
          {scanMode === 'ocr' && !ocrFrozen && !ocrLoading && (
            <>
              <Button 
                onClick={freezeForOCR} 
                variant="contained" 
                color="primary"
                fullWidth
                startIcon={<CaptureIcon />}
                size="large"
              >
                Aufnehmen & Text erkennen
              </Button>
              <Button onClick={() => {
                setCameraOpen(false);
                resetOcr();
              }} variant="outlined" fullWidth>
                Abbrechen
              </Button>
            </>
          )}
          
          {/* OCR-Auswahl Aktionen */}
          {scanMode === 'ocr' && ocrFrozen && (
            <>
              <Button 
                onClick={confirmOcrSelection} 
                variant="contained" 
                color="success"
                fullWidth
                disabled={!selectedOcrText}
                startIcon={<ConfirmIcon />}
                size="large"
              >
                Auswahl übernehmen
              </Button>
              <Button 
                onClick={resetOcr} 
                variant="outlined" 
                color="primary"
                fullWidth
                startIcon={<RetryIcon />}
              >
                Neu aufnehmen
              </Button>
              <Button onClick={() => {
                setCameraOpen(false);
                resetOcr();
              }} variant="outlined" fullWidth>
                Abbrechen
              </Button>
            </>
          )}
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
                  Entnahme aus vorhandenem Bestand ({existingMaterials.length} {existingMaterials.length === 1 ? 'Variante' : 'Varianten'}):
                </Typography>
                {existingMaterials.map((mat) => (
                  <Button
                    key={mat.id}
                    variant="outlined"
                    color="secondary"
                    startIcon={<RemoveIcon />}
                    onClick={() => handleSelectForRemoval(mat)}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 1.5 }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                      <Typography variant="body2" fontWeight="medium">
                        {mat.cabinet_name || 'Ohne Schrank'} - Bestand: {mat.current_stock}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {mat.batch_number && (
                          <Typography variant="caption" color="text.secondary">
                            LOT: <strong>{mat.batch_number}</strong>
                          </Typography>
                        )}
                        {mat.expiry_date && (
                          <Typography variant="caption" color={new Date(mat.expiry_date) < new Date() ? 'error.main' : 'text.secondary'}>
                            Verfall: <strong>{new Date(mat.expiry_date).toLocaleDateString('de-DE')}</strong>
                          </Typography>
                        )}
                      </Box>
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
