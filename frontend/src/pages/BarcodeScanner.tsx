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
    } | null;
    
    // Auto-Open für verschiedene Szenarien
    if ((state?.autoOpenCamera || state?.scanCabinet || state?.returnToMaterialForm) && scannerSettings.cameraEnabled) {
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
              // GS1-Modus aktivieren: FNC1 wird als ASCII 29 (Group Separator) ausgegeben
              const hints = new Map();
              hints.set(DecodeHintType.ASSUME_GS1, true);
              
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
      
      // Ausgewählten Bereich im Original-Koordinatensystem
      const cropX = Math.max(0, Math.round(adjustedX * scaleX));
      const cropY = Math.max(0, Math.round(adjustedY * scaleY));
      const cropWidth = Math.min(naturalWidth - cropX, Math.round(selectionRect.width * scaleX));
      const cropHeight = Math.min(naturalHeight - cropY, Math.round(selectionRect.height * scaleY));
      
      console.log('OCR Selection:', { 
        display: selectionRect, 
        imageInContainer: { offsetX, offsetY, displayedWidth, displayedHeight },
        adjusted: { adjustedX, adjustedY },
        original: { cropX, cropY, cropWidth, cropHeight },
        scale: { scaleX, scaleY }
      });
      
      // Canvas für den Ausschnitt erstellen
      const canvas = document.createElement('canvas');
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas-Context nicht verfügbar');
      }
      
      // Ausschnitt zeichnen
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      
      console.log('OCR Canvas erstellt:', cropWidth, 'x', cropHeight);
      
      // OCR durchführen - ohne Sprachmodell für bessere Zahlenerkennung
      const worker = await Tesseract.createWorker('eng', undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });
      
      // PSM 7 = Single line, nur Zahlen und Buchstaben
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz()-/. ',
      });
      
      const result = await worker.recognize(canvas);
      await worker.terminate();
      
      // Nur erkannte Zeichen zurückgeben, keine Interpretation
      const recognizedText = result.data.text.trim();
      console.log('OCR Ergebnis:', recognizedText, 'Confidence:', result.data.confidence);
      
      if (recognizedText) {
        setSelectedOcrText(recognizedText);
        setSuccess(`Text erkannt: "${recognizedText.substring(0, 50)}${recognizedText.length > 50 ? '...' : ''}"`);
      } else {
        setError('Kein Text im ausgewählten Bereich erkannt. Versuchen Sie einen anderen Bereich.');
      }
    } catch (err: any) {
      console.error('OCR Fehler:', err);
      setError('OCR-Erkennung fehlgeschlagen: ' + err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  // OCR-Auswahl bestätigen und als Barcode verwenden
  const confirmOcrSelection = () => {
    if (!selectedOcrText.trim()) {
      setError('Bitte wählen Sie mindestens einen Text aus');
      return;
    }
    
    // Text bereinigen (Zeilenumbrüche und mehrfache Leerzeichen entfernen)
    const cleanedText = selectedOcrText.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Prüfen ob wir von MaterialForm kommen und zurück navigieren sollen
    const state = location.state as { 
      returnToMaterialForm?: boolean;
      scanMode?: 'gs1' | 'qr';
      materialId?: string;
    } | null;
    
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
