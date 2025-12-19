import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  CircularProgress,
  MenuItem,
  Alert,
  InputAdornment,
  IconButton,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Autocomplete,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  QrCodeScanner as QrCodeScannerIcon,
  CameraAlt as CameraIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { materialAPI, cabinetAPI, categoryAPI, companyAPI, unitAPI, shapeAPI } from '../services/api';
import { parseGS1Barcode, isValidGS1Barcode, GS1Data } from '../utils/gs1Parser';
import { useAuth } from '../contexts/AuthContext';
import { getScannerSettings } from './Admin';

// Debounce Timer für GS1 Debug Logging und GTIN-Suche
let gs1DebugTimer: ReturnType<typeof setTimeout> | null = null;
let gtinSearchTimer: ReturnType<typeof setTimeout> | null = null;
let nameSearchTimer: ReturnType<typeof setTimeout> | null = null;

// Guidewire-Acceptance Optionen
const GUIDEWIRE_OPTIONS = ['0.014in', '0.018in', '0.032in', '0.035in', '0.038in'];

// EU-registrierte Medizintechnik-Firmen
const EU_REGISTERED_COMPANIES = [
  "Aachen Resonance GmbH",
  "Abbott",
  "Acandis GmbH & Co. KG",
  "Advanced Vascular Dynamics",
  "ALN",
  "Alvimedica",
  "amg International GmbH",
  "Andramed GmbH",
  "AndraTec GmbH Germany",
  "AngioDynamics",
  "Argon Medical Devices, Inc.",
  "Arthesys",
  "Artivion, Inc.",
  "ArtVentive Medical Group, Inc.",
  "Asahi Intecc Co Ltd.",
  "Avinger, Inc.",
  "B. Braun Melsungen AG",
  "Balt",
  "Balton",
  "Bard Access Systems, Inc",
  "BD Interventional",
  "Bentley InnoMed GmbH",
  "BioCardia, Inc.",
  "Biolas",
  "Biosensors International",
  "Blockade Medical",
  "Boston Scientific Corporation",
  "BrosMed Medical",
  "Cagent Vascular",
  "Cardionovum GmbH",
  "Cerenovus",
  "Concept Medical",
  "Contego Medical LLC",
  "Control Medical Technology",
  "Cook Medical",
  "Cordis",
  "Dornier MedTech GmbH",
  "Edwards Lifesciences",
  "EndoCross",
  "Endologix",
  "eucatech AG",
  "Eurocor GmbH",
  "F Care Systems",
  "Forge Medical, Inc.",
  "Front Line Medical Technologies Inc.",
  "Galt",
  "Getinge (Advanta)",
  "Gore & Associates",
  "Haemonetics",
  "iMS GmbH",
  "Inari Medical",
  "Infraredx",
  "InspireMD",
  "Invamed",
  "iVascular",
  "Joline GmbH & Co. KG",
  "Kawasumi Laboratories, Inc",
  "LeMaitre Vascular, Inc.",
  "Lombard Medical Limited",
  "MedAlliance",
  "Medcomp",
  "Medtronic",
  "Meril Life Sciences Pvt. Ltd.",
  "Merit Medical Systems, Inc.",
  "Mermaid Medical",
  "Micro Medical Solutions",
  "Natec Medical Ltd",
  "Opsens Medical",
  "optimed Medizinische Instrumente GmbH",
  "Oscor Inc.",
  "Pediavascular",
  "Penumbra, Inc.",
  "Perflow Medical",
  "phenox GmbH",
  "Philips",
  "Prytime Medical Devices, Inc.",
  "Q3 Medical Group",
  "Ra Medical Systems, Inc.",
  "Rapid Medical",
  "Recor Medical",
  "Reflow Medical, Inc",
  "RenalGuard Solutions, Inc.",
  "Rontis AG",
  "Scitech Medical",
  "Shape Memory Medical Inc.",
  "Shockwave Medical, Inc.",
  "Simeks Medical",
  "STARmed Co., Ltd.",
  "Stryker",
  "Teleflex (Biotronik)",
  "Terumo Aortic",
  "Terumo Europe",
  "Terumo Neuro",
  "ThermopeutiX, Inc.",
  "Tokai Medical Products, Inc",
  "Total Vein Systems",
  "Translational Research Institute",
  "Tricol Biomedical Inc.",
  "TriReme Medical LLC",
  "TriSalus Life Sciences",
  "Varian Medical Systems",
  "VentureMed Group, Inc.",
  "Veryan Medical",
  "Vesalio Inc.",
  "Wallaby Medical, Inc.",
  "Z-Medica, LLC"
].sort();

interface MaterialFormData {
  name: string;
  description: string;
  category_id: number | '';
  company_id: number | '';
  cabinet_id: number | '';
  compartment_id: number | '';
  unit_id: number | '';
  size: string;
  unit: string;
  min_stock: number;
  expiry_date: string;
  lot_number: string;
  article_number: string;
  cost: string;
  location_in_cabinet: string;
  notes: string;
  gs1_barcode: string;
  is_consignment: boolean;
  // Device-Eigenschaften
  shape_id: number | '';
  shaft_length: string;
  device_length: string;
  device_diameter: string;
  french_size: string;
  guidewire_acceptance: string;
}

interface Shape {
  id: number;
  name: string;
  active: boolean;
}

interface Compartment {
  id: number;
  cabinet_id: number;
  name: string;
  description: string | null;
}

const MaterialForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isRoot, isAdmin } = useAuth();
  
  // Prüfe ob wir auf /materials/new sind (id ist undefined) oder eine echte ID haben
  const isNew = !id || id === 'new';

  console.log('MaterialForm rendered');
  console.log('id from URL:', id);
  console.log('location.pathname:', location.pathname);
  console.log('isNew:', isNew);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dropdown-Daten
  const [categories, setCategories] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  
  // Produktnamen-Autocomplete
  const [productNameSuggestions, setProductNameSuggestions] = useState<string[]>([]);
  const [productNameLoading, setProductNameLoading] = useState(false);

  // EU-Firmen Dialog
  const [euCompaniesDialogOpen, setEuCompaniesDialogOpen] = useState(false);
  const [euCompanySearchTerm, setEuCompanySearchTerm] = useState('');

  // Shape-Verwaltungs-Dialog
  const [shapeDialogOpen, setShapeDialogOpen] = useState(false);
  const [allShapes, setAllShapes] = useState<Shape[]>([]);
  const [newShapeName, setNewShapeName] = useState('');
  const [editingShapeId, setEditingShapeId] = useState<number | null>(null);
  const [editingShapeName, setEditingShapeName] = useState('');
  const [shapeLoading, setShapeLoading] = useState(false);
  const [shapeError, setShapeError] = useState<string | null>(null);

  // Packung/Stück-Dialog
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<any>(null);

  // GS1-Parser Status
  const [gs1Data, setGs1Data] = useState<GS1Data | null>(null);
  const [gs1Warning, setGs1Warning] = useState<string | null>(null);
  
  // Tracking welche Felder aus GS1-Barcode geparst wurden
  const [parsedFromGs1, setParsedFromGs1] = useState<{
    gtin: boolean;
    lot: boolean;
    expiry: boolean;
  }>({ gtin: false, lot: false, expiry: false });

  // Fach-QR-Code Status
  const [compartmentQrInput, setCompartmentQrInput] = useState<string>('');
  const [compartmentQrData, setCompartmentQrData] = useState<any>(null);
  
  // Scanner-Einstellung
  const [cameraEnabled, setCameraEnabled] = useState(false);

  const [formData, setFormData] = useState<MaterialFormData>({
    name: '',
    description: '',
    category_id: '',
    company_id: '',
    cabinet_id: '',
    compartment_id: '',
    unit_id: '',
    size: '1',
    unit: 'Stück',
    min_stock: 0,
    expiry_date: '',
    lot_number: '',
    article_number: '',
    cost: '',
    location_in_cabinet: '',
    notes: '',
    gs1_barcode: '',
    is_consignment: false,
    // Device-Eigenschaften
    shape_id: '',
    shaft_length: '',
    device_length: '',
    device_diameter: '',
    french_size: '',
    guidewire_acceptance: '',
  });

  useEffect(() => {
    console.log('MaterialForm useEffect triggered');
    console.log('isNew in useEffect:', isNew);
    console.log('id in useEffect:', id);
    
    // Scanner-Einstellung laden
    const settings = getScannerSettings();
    setCameraEnabled(settings.cameraEnabled);
    
    fetchDropdownData();
    
    // Nur Material laden, wenn es eine gültige ID ist (nicht "new" und numerisch)
    if (!isNew && id && !isNaN(Number(id))) {
      console.log('Fetching material for ID:', id);
      fetchMaterial();
    } else if (isNew) {
      console.log('Creating new material - setting loading to false');
      // Bei neuem Material: Loading beenden
      setLoading(false);
      
      // Für nicht-root User: unit_id automatisch setzen
      if (!isRoot && user?.departmentId) {
        setFormData(prev => ({ ...prev, unit_id: user.departmentId as number }));
      }
      
      // Prüfe ob Daten vom Scanner übergeben wurden
      const state = location.state as any;
      console.log('MaterialForm location.state:', state);
      console.log('Current URL id:', id);
      console.log('isNew:', isNew);
      
      // Check for scanned cabinet
      if (state?.cabinetId) {
        console.log('Cabinet vom Scanner:', state.cabinetName, state.cabinetId);
        setFormData(prev => ({ ...prev, cabinet_id: state.cabinetId }));
        setSuccess(`Schrank "${state.cabinetName}" übernommen!`);
        setTimeout(() => setSuccess(null), 3000);
      }
      
      if (state?.fromScanner && state?.gs1_barcode) {
        console.log('GS1 Barcode vom Scanner:', state.gs1_barcode);
        console.log('GS1 Data vom Scanner:', state.gs1Data);
        
        // GS1-Daten zusammenstellen
        const updates: Partial<MaterialFormData> = {
          gs1_barcode: state.gs1_barcode,
        };
        
        if (state.gs1Data) {
          if (state.gs1Data.gtin) {
            updates.article_number = state.gs1Data.gtin;
          }
          // LOT: batchNumber (AI 10) oder falls nicht vorhanden serialNumber (AI 21)
          if (state.gs1Data.batchNumber) {
            updates.lot_number = state.gs1Data.batchNumber;
          } else if (state.gs1Data.serialNumber) {
            updates.lot_number = state.gs1Data.serialNumber;
          }
          if (state.gs1Data.expiryDate) {
            updates.expiry_date = state.gs1Data.expiryDate;
          }
          
          setGs1Data(state.gs1Data);
        }
        console.log('Applying updates:', updates);
        // Alle Updates auf einmal anwenden
        setFormData(prev => ({ ...prev, ...updates }));
        setSuccess('GS1-Barcode vom Scanner übernommen!');
        setTimeout(() => setSuccess(null), 3000);
      }
    } else {
      console.log('Edge case: not new, but invalid ID');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  const fetchDropdownData = async () => {
    console.log('fetchDropdownData called');
    try {
      const [categoriesRes, companiesRes, cabinetsRes, unitsRes, shapesRes] = await Promise.all([
        categoryAPI.getAll(),
        companyAPI.getAll(),
        cabinetAPI.getAll(),
        unitAPI.getAll(),
        shapeAPI.getAll(),
      ]);
      console.log('Dropdown data loaded successfully');
      setCategories(categoriesRes.data);
      setCompanies(companiesRes.data);
      setCabinets(cabinetsRes.data);
      setUnits(unitsRes.data);
      setShapes(shapesRes.data);
    } catch (err) {
      console.error('Fehler beim Laden der Dropdown-Daten:', err);
      setError('Fehler beim Laden der Formulardaten');
    }
  };

  const fetchCompartments = async (cabinetId: number) => {
    try {
      const response = await cabinetAPI.getCompartments(cabinetId);
      setCompartments(response.data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Fächer:', err);
      setCompartments([]);
    }
  };

  // Effect: Fächer laden wenn cabinet_id sich ändert (auch bei Autofill/Template)
  useEffect(() => {
    if (formData.cabinet_id && typeof formData.cabinet_id === 'number') {
      fetchCompartments(formData.cabinet_id);
    } else {
      setCompartments([]);
    }
  }, [formData.cabinet_id]);

  // Shape-Verwaltungs-Funktionen
  const openShapeDialog = async () => {
    setShapeDialogOpen(true);
    setShapeError(null);
    setNewShapeName('');
    setEditingShapeId(null);
    setShapeLoading(true);
    try {
      const response = await shapeAPI.getAllIncludingInactive();
      setAllShapes(response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Shapes:', err);
      setShapeError('Fehler beim Laden der Shapes');
    } finally {
      setShapeLoading(false);
    }
  };

  const handleAddShape = async () => {
    if (!newShapeName.trim()) return;
    setShapeLoading(true);
    setShapeError(null);
    try {
      await shapeAPI.create({ name: newShapeName.trim() });
      setNewShapeName('');
      // Shapes neu laden
      const response = await shapeAPI.getAllIncludingInactive();
      setAllShapes(response.data);
      // Aktive Shapes für Dropdown aktualisieren
      const activeResponse = await shapeAPI.getAll();
      setShapes(activeResponse.data);
    } catch (err: any) {
      setShapeError(err.response?.data?.error || 'Fehler beim Erstellen');
    } finally {
      setShapeLoading(false);
    }
  };

  const handleUpdateShape = async (shapeId: number) => {
    if (!editingShapeName.trim()) return;
    setShapeLoading(true);
    setShapeError(null);
    try {
      const shape = allShapes.find(s => s.id === shapeId);
      await shapeAPI.update(shapeId, { 
        name: editingShapeName.trim(),
        active: shape?.active !== false
      });
      setEditingShapeId(null);
      setEditingShapeName('');
      // Shapes neu laden
      const response = await shapeAPI.getAllIncludingInactive();
      setAllShapes(response.data);
      // Aktive Shapes für Dropdown aktualisieren
      const activeResponse = await shapeAPI.getAll();
      setShapes(activeResponse.data);
    } catch (err: any) {
      setShapeError(err.response?.data?.error || 'Fehler beim Aktualisieren');
    } finally {
      setShapeLoading(false);
    }
  };

  const handleToggleShapeActive = async (shape: Shape) => {
    setShapeLoading(true);
    setShapeError(null);
    try {
      await shapeAPI.update(shape.id, { 
        name: shape.name,
        active: !shape.active
      });
      // Shapes neu laden
      const response = await shapeAPI.getAllIncludingInactive();
      setAllShapes(response.data);
      // Aktive Shapes für Dropdown aktualisieren
      const activeResponse = await shapeAPI.getAll();
      setShapes(activeResponse.data);
    } catch (err: any) {
      setShapeError(err.response?.data?.error || 'Fehler beim Aktualisieren');
    } finally {
      setShapeLoading(false);
    }
  };

  const handleDeleteShape = async (shapeId: number) => {
    setShapeLoading(true);
    setShapeError(null);
    try {
      await shapeAPI.delete(shapeId);
      // Shapes neu laden
      const response = await shapeAPI.getAllIncludingInactive();
      setAllShapes(response.data);
      // Aktive Shapes für Dropdown aktualisieren
      const activeResponse = await shapeAPI.getAll();
      setShapes(activeResponse.data);
    } catch (err: any) {
      setShapeError(err.response?.data?.error || 'Fehler beim Löschen');
    } finally {
      setShapeLoading(false);
    }
  };

  const fetchMaterial = async () => {
    try {
      const response = await materialAPI.getById(parseInt(id!));
      const material = response.data;
      setFormData({
        name: material.name || '',
        description: material.description || '',
        category_id: material.category_id || '',
        company_id: material.company_id || '',
        cabinet_id: material.cabinet_id || '',
        compartment_id: material.compartment_id || '',
        unit_id: material.unit_id || '',
        size: material.size || '',
        unit: material.unit || 'Stück',
        min_stock: material.min_stock || 0,
        expiry_date: material.expiry_date ? material.expiry_date.split('T')[0] : '',
        lot_number: material.lot_number || '',
        article_number: material.article_number || '',
        cost: material.cost ? String(material.cost) : '',
        location_in_cabinet: material.location_in_cabinet || '',
        notes: material.notes || '',
        gs1_barcode: '',
        is_consignment: material.is_consignment || false,
        // Device-Eigenschaften
        shape_id: material.shape_id || '',
        shaft_length: material.shaft_length || '',
        device_length: material.device_length || '',
        device_diameter: material.device_diameter || '',
        french_size: material.french_size || '',
        guidewire_acceptance: material.guidewire_acceptance || '',
      });
      
      // Fächer für den Schrank laden wenn vorhanden
      if (material.cabinet_id) {
        await fetchCompartments(material.cabinet_id);
      }
    } catch (err) {
      console.error('Fehler beim Laden des Materials:', err);
      setError('Material nicht gefunden');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof MaterialFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    
    // Wenn der Schrank gewechselt wird, compartment_id zurücksetzen (Fächer werden durch useEffect geladen)
    if (field === 'cabinet_id') {
      const cabinetId = value ? Number(value) : '';
      setFormData(prev => ({ ...prev, cabinet_id: cabinetId, compartment_id: '' }));
    } else if (field === 'name') {
      // Name-Feld: nur Wert setzen, Vorschläge werden separat geladen
      // DB-Lookup passiert erst bei Enter (siehe handleNameKeyDown)
      setFormData(prev => ({ ...prev, name: value }));
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  // Produktnamen-Vorschläge laden für Autocomplete
  const fetchProductNameSuggestions = async (search: string) => {
    if (!search || search.length < 1) {
      setProductNameSuggestions([]);
      return;
    }
    
    // Debounced Suche
    if (nameSearchTimer) {
      clearTimeout(nameSearchTimer);
    }
    
    nameSearchTimer = setTimeout(async () => {
      setProductNameLoading(true);
      try {
        const response = await materialAPI.getProductNames(search);
        setProductNameSuggestions(response.data || []);
      } catch (error) {
        console.error('Fehler beim Laden der Produktnamen:', error);
        setProductNameSuggestions([]);
      } finally {
        setProductNameLoading(false);
      }
    }, 200);
  };

  // DB-Lookup für Kategorie/Firma bei Enter im Namensfeld
  const handleNameLookup = async (name: string) => {
    if (!name || name.trim().length < 3) return;
    
    // Nur suchen wenn Kategorie und Firma leer sind
    if (formData.category_id || formData.company_id) return;
    
    try {
      console.log('Suche nach Materialname:', name);
      const response = await materialAPI.getByName(name.trim());
      if (response.data?.found && response.data?.template) {
        const template = response.data.template;
        console.log('Name Template gefunden:', template);
        
        const updates: Partial<MaterialFormData> = {};
        if (!formData.category_id && template.category_id) {
          updates.category_id = template.category_id;
        }
        if (!formData.company_id && template.company_id) {
          updates.company_id = template.company_id;
        }
        
        if (Object.keys(updates).length > 0) {
          console.log('Name-Lookup Updates:', updates);
          setFormData(prev => ({ ...prev, ...updates }));
          setSuccess(`Kategorie/Firma aus bestehendem Material "${template.name}" übernommen!`);
          setTimeout(() => setSuccess(null), 4000);
        }
      }
    } catch (err) {
      // 404 oder kein Match ist OK
      console.log('Kein exakter Name-Match gefunden');
    }
  };

  const handleGS1BarcodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const barcode = e.target.value;
    console.log('=== MaterialForm GS1 Input ===');
    console.log('Eingegebener Barcode:', barcode);
    console.log('Barcode Länge:', barcode.length);
    const hexDump = Array.from(barcode).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
    console.log('Barcode Hex:', hexDump);
    
    setFormData(prev => ({ ...prev, gs1_barcode: barcode }));
    setGs1Warning(null);
    // gs1Data NICHT auf null setzen - wir wollen vorherige Daten behalten für Split-Barcodes

    if (!barcode) {
      return;
    }

    // GS1 Barcode parsen
    console.log('isValidGS1Barcode:', isValidGS1Barcode(barcode));
    if (isValidGS1Barcode(barcode)) {
      const parsed = parseGS1Barcode(barcode);
      console.log('Parsed Result in MaterialForm:', parsed);
      
      // Debug-Log ans Backend senden (debounced - wartet 500ms nach letztem Zeichen)
      if (gs1DebugTimer) {
        clearTimeout(gs1DebugTimer);
      }
      gs1DebugTimer = setTimeout(() => {
        fetch('/api/debug/gs1-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcode,
            hexDump,
            parsedResult: parsed,
            source: 'MaterialForm.handleGS1BarcodeChange'
          })
        }).catch(err => console.log('Debug log failed:', err));
      }, 500);
      
      // GS1-Daten zusammenführen (für Split-Barcodes)
      // Neue Werte überschreiben nur wenn sie vorhanden sind
      setGs1Data(prevGs1 => ({
        ...prevGs1,
        ...parsed,
        // Nur überschreiben wenn der neue Wert vorhanden ist
        gtin: parsed.gtin || prevGs1?.gtin,
        batchNumber: parsed.batchNumber || prevGs1?.batchNumber,
        expiryDate: parsed.expiryDate || prevGs1?.expiryDate,
        serialNumber: parsed.serialNumber || prevGs1?.serialNumber,
        raw: barcode, // Immer den letzten Barcode speichern
      }));

      // Auto-Fill Felder aus dem gescannten Barcode
      // Nur Felder aktualisieren die im aktuellen Scan vorhanden sind
      const updates: Partial<MaterialFormData> = {};
      const gs1ParsedUpdates: { gtin: boolean; lot: boolean; expiry: boolean } = { gtin: false, lot: false, expiry: false };

      if (parsed.gtin) {
        updates.article_number = parsed.gtin;
        gs1ParsedUpdates.gtin = true;
      }

      // LOT: batchNumber (AI 10) oder falls nicht vorhanden serialNumber (AI 21)
      if (parsed.batchNumber) {
        updates.lot_number = parsed.batchNumber;
        gs1ParsedUpdates.lot = true;
      } else if (parsed.serialNumber) {
        updates.lot_number = parsed.serialNumber;
        gs1ParsedUpdates.lot = true;
      }

      if (parsed.expiryDate) {
        updates.expiry_date = parsed.expiryDate;
        gs1ParsedUpdates.expiry = true;
      }

      // Sofort die Barcode-Daten anwenden (nur die neuen Felder)
      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({ ...prev, ...updates }));
        // Aktualisiere welche Felder geparst wurden (merge mit vorherigen)
        setParsedFromGs1(prev => ({
          gtin: prev.gtin || gs1ParsedUpdates.gtin,
          lot: prev.lot || gs1ParsedUpdates.lot,
          expiry: prev.expiry || gs1ParsedUpdates.expiry,
        }));
      }

      // GTIN-Suche debounced ausführen (wartet bis Scanner fertig ist)
      if (parsed.gtin) {
        if (gtinSearchTimer) {
          clearTimeout(gtinSearchTimer);
        }
        gtinSearchTimer = setTimeout(async () => {
          try {
            console.log('Suche nach GTIN:', parsed.gtin);
            const response = await materialAPI.getByGtin(parsed.gtin!);
            if (response.data?.template) {
              const template = response.data.template;
              console.log('GTIN Template gefunden:', template);
              
              // Felder vorausfüllen (aktuelle formData nochmal holen)
              setFormData(prev => {
                const templateUpdates: Partial<MaterialFormData> = {};
                
                if (!prev.name && template.name) templateUpdates.name = template.name;
                if (!prev.description && template.description) templateUpdates.description = template.description;
                if (!prev.category_id && template.category_id) templateUpdates.category_id = template.category_id;
                if (!prev.company_id && template.company_id) templateUpdates.company_id = template.company_id;
                if (!prev.cabinet_id && template.cabinet_id) templateUpdates.cabinet_id = template.cabinet_id;
                if (!prev.compartment_id && template.compartment_id) templateUpdates.compartment_id = template.compartment_id;
                if (!prev.size && template.size) templateUpdates.size = template.size;
                if (!prev.unit && template.unit) templateUpdates.unit = template.unit;
                if (!prev.cost && template.cost) templateUpdates.cost = String(template.cost);
                if (!prev.location_in_cabinet && template.location_in_cabinet) templateUpdates.location_in_cabinet = template.location_in_cabinet;
                if (template.is_consignment !== undefined) templateUpdates.is_consignment = template.is_consignment;
                
                // Device-Eigenschaften
                if (!prev.shape_id && template.shape_id) templateUpdates.shape_id = template.shape_id;
                if (!prev.shaft_length && template.shaft_length) templateUpdates.shaft_length = template.shaft_length;
                if (!prev.device_length && template.device_length) templateUpdates.device_length = template.device_length;
                if (!prev.device_diameter && template.device_diameter) templateUpdates.device_diameter = template.device_diameter;
                if (!prev.french_size && template.french_size) templateUpdates.french_size = template.french_size;
                if (!prev.guidewire_acceptance && template.guidewire_acceptance) templateUpdates.guidewire_acceptance = template.guidewire_acceptance;
                
                console.log('Template Updates:', templateUpdates);
                return { ...prev, ...templateUpdates };
              });
              
              setSuccess('Material mit dieser GTIN gefunden - Felder vorausgefüllt!');
              setTimeout(() => setSuccess(null), 4000);
            }
          } catch (err) {
            // 404 ist OK - bedeutet nur, dass keine GTIN gefunden wurde
            console.log('Keine existierende GTIN gefunden (neues Produkt)');
          }
        }, 600); // Etwas länger als Debug-Timer warten
      }
    } else if (barcode.length > 3) {
      setGs1Warning('Dies scheint kein gültiger GS1-Barcode zu sein.');
    }
  };

  const clearGS1Data = () => {
    setFormData(prev => ({
      ...prev,
      gs1_barcode: '',
      expiry_date: '',
      lot_number: '',
      article_number: '',
    }));
    setGs1Data(null);
    setGs1Warning(null);
    setParsedFromGs1({ gtin: false, lot: false, expiry: false });
  };

  // Fach-QR-Code Handler
  const handleCompartmentQrChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setCompartmentQrInput(input);
    setCompartmentQrData(null);

    if (!input) return;

    try {
      // Versuche JSON zu parsen
      const parsed = JSON.parse(input);
      
      // Prüfe ob es ein Fach-QR-Code ist
      if (parsed.type === 'COMPARTMENT' && parsed.cabinetId && parsed.compartmentId) {
        setCompartmentQrData(parsed);
        
        // Schrank und Fach setzen
        const cabinetId = parsed.cabinetId;
        const compartmentId = parsed.compartmentId;
        
        // Erst Schrank setzen, dann Fächer laden
        setFormData(prev => ({ ...prev, cabinet_id: cabinetId }));
        
        // Fächer für diesen Schrank laden
        try {
          const response = await cabinetAPI.getCompartments(cabinetId);
          const loadedCompartments = response.data || [];
          setCompartments(loadedCompartments);
          
          // Fach setzen
          setFormData(prev => ({ ...prev, cabinet_id: cabinetId, compartment_id: compartmentId }));
          
          setSuccess(`Schrank "${parsed.cabinetName}" und Fach "${parsed.compartmentName}" übernommen!`);
          setTimeout(() => setSuccess(null), 4000);
        } catch (err) {
          console.error('Fehler beim Laden der Fächer:', err);
          setError('Fehler beim Laden der Fächer für diesen Schrank');
        }
      }
    } catch {
      // Kein gültiges JSON - ignorieren
    }
  };

  const clearCompartmentQrData = () => {
    setCompartmentQrInput('');
    setCompartmentQrData(null);
  };

  // Kamera-Scanner öffnen - navigiert zum BarcodeScanner-Modul
  const openScanner = (mode: 'gs1' | 'qr') => {
    // Speichere aktuellen Formular-Zustand in sessionStorage
    sessionStorage.setItem('materialFormData', JSON.stringify(formData));
    sessionStorage.setItem('materialFormScannerMode', mode);
    sessionStorage.setItem('materialFormReturnPath', location.pathname);
    
    // Navigiere zum BarcodeScanner mit Rückkehr-Flag
    navigate('/scanner', { 
      state: { 
        returnToMaterialForm: true,
        scanMode: mode,
        materialId: id,
      } 
    });
  };

  // Prüfe beim Laden, ob wir vom Scanner zurückkommen
  useEffect(() => {
    const state = location.state as { 
      fromScanner?: boolean; 
      scannedCode?: string;
      scanMode?: 'gs1' | 'qr';
    } | null;
    
    if (state?.fromScanner && state?.scannedCode) {
      console.log('Zurück vom Scanner mit Code:', state.scannedCode, 'Mode:', state.scanMode);
      
      // Zuerst Formular-Daten aus sessionStorage wiederherstellen
      const savedFormData = sessionStorage.getItem('materialFormData');
      let restoredData: MaterialFormData | null = null;
      if (savedFormData) {
        try {
          restoredData = JSON.parse(savedFormData);
          sessionStorage.removeItem('materialFormData');
          sessionStorage.removeItem('materialFormScannerMode');
          sessionStorage.removeItem('materialFormReturnPath');
        } catch (e) {
          console.error('Fehler beim Wiederherstellen der Formulardaten:', e);
        }
      }
      
      if (state.scanMode === 'gs1') {
        // GS1-Barcode verarbeiten - über handleGS1BarcodeChange für Lookup
        const scannedCode = state.scannedCode!;
        
        // Zuerst wiederhergestellte Daten setzen (falls vorhanden)
        if (restoredData) {
          setFormData(prev => ({ ...prev, ...restoredData }));
        }
        
        // Dann handleGS1BarcodeChange aufrufen - das triggert Parsing UND Lookup
        // Verzögert, damit restoredData-State angewendet wurde
        setTimeout(() => {
          handleGS1BarcodeChange({ target: { value: scannedCode } } as React.ChangeEvent<HTMLInputElement>);
        }, 100);
      } else if (state.scanMode === 'qr') {
        // QR-Code für Fach verarbeiten
        if (restoredData) {
          setFormData(prev => ({ ...prev, ...restoredData }));
        }
        setCompartmentQrInput(state.scannedCode!);
        // Verzögert aufrufen, damit State aktualisiert ist
        setTimeout(() => {
          handleCompartmentQrChange({ target: { value: state.scannedCode! } } as React.ChangeEvent<HTMLInputElement>);
        }, 100);
      }
      
      // State bereinigen
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // EU-Firma hinzufügen und automatisch auswählen
  const handleAddEuCompany = async (companyName: string) => {
    try {
      const response = await companyAPI.create({
        name: companyName,
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        department_id: user?.departmentId || null
      });
      
      // Aktualisiere Companies-Liste
      const updatedCompanies = await companyAPI.getAll();
      setCompanies(Array.isArray(updatedCompanies.data) ? updatedCompanies.data : []);
      
      // Finde die neu erstellte Firma
      const newCompany = updatedCompanies.data.find((c: any) => c.name === companyName);
      if (newCompany) {
        // Setze die Firma im Formular
        setFormData(prev => ({ ...prev, company_id: newCompany.id }));
        setSuccess(`Firma "${companyName}" wurde hinzugefügt und ausgewählt`);
        setTimeout(() => setSuccess(null), 3000);
      }
      
      setEuCompaniesDialogOpen(false);
      setEuCompanySearchTerm('');
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Firma:', error);
      setError('Fehler beim Hinzufügen der Firma');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Bei neuen Materialien mit Packung > 1: Dialog anzeigen
    const packSize = parseInt(formData.size) || 1;
    if (isNew && formData.unit === 'Packung' && packSize > 1) {
      // Daten für späteren Speichervorgang vorbereiten
      const dataToSend = {
        ...formData,
        category_id: formData.category_id || null,
        company_id: formData.company_id || null,
        cabinet_id: formData.cabinet_id || null,
        compartment_id: formData.compartment_id || null,
        expiry_date: formData.expiry_date || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        // Device-Eigenschaften
        shape_id: formData.shape_id || null,
        shaft_length: formData.shaft_length || null,
        device_length: formData.device_length || null,
        device_diameter: formData.device_diameter || null,
        french_size: formData.french_size || null,
        guidewire_acceptance: formData.guidewire_acceptance || null,
      };
      
      // GS1 Barcode als zusätzlichen Barcode hinzufügen, falls vorhanden
      const barcodes = [];
      if (formData.gs1_barcode && gs1Data) {
        barcodes.push({
          barcode: formData.gs1_barcode,
          barcode_type: 'GS1-128',
          is_primary: true,
        });
      }
      
      setPendingFormData({ ...dataToSend, barcodes, packSize });
      setPackDialogOpen(true);
      return;
    }
    
    // Normales Speichern (einzelnes Material oder Bearbeitung)
    await saveAsSingleItem();
  };

  // Speichert ein einzelnes Material (Packung oder Stück)
  const saveAsSingleItem = async (overrideData?: any) => {
    setSaving(true);
    setError(null);

    try {
      const dataToSend = overrideData || {
        ...formData,
        category_id: formData.category_id || null,
        company_id: formData.company_id || null,
        cabinet_id: formData.cabinet_id || null,
        compartment_id: formData.compartment_id || null,
        expiry_date: formData.expiry_date || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        // Device-Eigenschaften
        shape_id: formData.shape_id || null,
        shaft_length: formData.shaft_length || null,
        device_length: formData.device_length || null,
        device_diameter: formData.device_diameter || null,
        french_size: formData.french_size || null,
        guidewire_acceptance: formData.guidewire_acceptance || null,
      };

      // GS1 Barcode als zusätzlichen Barcode hinzufügen, falls vorhanden
      const barcodes = overrideData?.barcodes || [];
      if (!overrideData && formData.gs1_barcode && gs1Data) {
        barcodes.push({
          barcode: formData.gs1_barcode,
          barcode_type: 'GS1-128',
          is_primary: true,
        });
      }

      if (isNew) {
        const response = await materialAPI.create({ ...dataToSend, barcodes });
        setSuccess('Material erfolgreich erstellt!');
        setTimeout(() => navigate(`/materials/${response.data.id}`), 1500);
      } else {
        const response = await materialAPI.update(parseInt(id!), dataToSend);
        const productUpdated = response.data?.productUpdated || false;
        if (productUpdated) {
          setSuccess('Material und Produkt-Stammdaten erfolgreich aktualisiert!');
        } else {
          setSuccess('Material erfolgreich aktualisiert!');
        }
        setTimeout(() => navigate('/materials'), 1500);
      }
    } catch (err: any) {
      console.error('Fehler beim Speichern:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern des Materials');
    } finally {
      setSaving(false);
    }
  };

  // Speichert als Packung (1 Eintrag)
  const saveAsPackage = async () => {
    setPackDialogOpen(false);
    if (pendingFormData) {
      await saveAsSingleItem(pendingFormData);
    }
    setPendingFormData(null);
  };

  // Speichert als einzelne Stücke (mehrere Einträge)
  const saveAsIndividualItems = async () => {
    setPackDialogOpen(false);
    if (!pendingFormData) return;

    setSaving(true);
    setError(null);

    try {
      const { packSize, barcodes, ...baseData } = pendingFormData;
      
      // Für jedes Stück in der Packung einen Eintrag erstellen
      const promises = [];
      for (let i = 0; i < packSize; i++) {
        const itemData = {
          ...baseData,
          unit: 'Stück',
          size: '1',
          // Barcode nur beim ersten Eintrag hinzufügen (um Duplikate zu vermeiden)
          barcodes: i === 0 ? barcodes : [],
        };
        promises.push(materialAPI.create(itemData));
      }
      
      await Promise.all(promises);
      
      setSuccess(`${packSize} einzelne Materialien erfolgreich erstellt!`);
      setTimeout(() => navigate('/materials'), 1500);
    } catch (err: any) {
      console.error('Fehler beim Speichern:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern der Materialien');
    } finally {
      setSaving(false);
      setPendingFormData(null);
    }
  };

  if (loading) {
    console.log('MaterialForm: showing loading spinner');
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  console.log('MaterialForm: rendering form');
  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/materials')}
        sx={{ mb: 2 }}
      >
        Zurück
      </Button>

      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
        {isNew ? 'Neues Material erstellen' : 'Material bearbeiten'}
      </Typography>

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

      <Paper sx={{ p: { xs: 2, sm: 3 }, mt: { xs: 2, sm: 3 } }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={{ xs: 2, sm: 3 }}>
            {/* Fach-QR-Code Eingabe */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Fach-QR-Code Scanner
              </Typography>
              <TextField
                fullWidth
                label="Fach-QR-Code"
                value={compartmentQrInput}
                onChange={handleCompartmentQrChange}
                placeholder="Scannen Sie einen Fach-QR-Code vom Schranketikett"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <QrCodeScannerIcon color="secondary" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      {cameraEnabled && (
                        <Tooltip title="Kamera-Scanner öffnen">
                          <IconButton onClick={() => openScanner('qr')} size="small" color="primary">
                            <CameraIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {compartmentQrInput && (
                        <Tooltip title="Fach-Daten löschen">
                          <IconButton onClick={clearCompartmentQrData} size="small">
                            <ClearIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </InputAdornment>
                  ),
                }}
              />
              {compartmentQrData && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    <strong>✅ Fach-Daten übernommen:</strong>
                  </Typography>
                  <Typography variant="body2">• Schrank: {compartmentQrData.cabinetName}</Typography>
                  <Typography variant="body2">• Fach: {compartmentQrData.compartmentName}</Typography>
                </Alert>
              )}
            </Grid>

            {/* GS1 Barcode Eingabe */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                GS1 Barcode Scanner
              </Typography>
              <TextField
                fullWidth
                label="GS1 Barcode"
                value={formData.gs1_barcode}
                onChange={handleGS1BarcodeChange}
                placeholder="Scannen oder eingeben Sie einen GS1-Barcode (AI 01, 10, 17)"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <QrCodeScannerIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      {cameraEnabled && (
                        <Tooltip title="Kamera-Scanner öffnen">
                          <IconButton onClick={() => openScanner('gs1')} size="small" color="primary">
                            <CameraIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {formData.gs1_barcode && (
                        <Tooltip title="GS1-Daten löschen">
                          <IconButton onClick={clearGS1Data} size="small">
                            <ClearIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </InputAdornment>
                  ),
                }}
              />
              {gs1Warning && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {gs1Warning}
                </Alert>
              )}
              {gs1Data && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    <strong>Geparste GS1-Daten:</strong>
                  </Typography>
                  {gs1Data.gtin && <Typography variant="body2">• GTIN/Artikelnummer (AI 01): {gs1Data.gtin}</Typography>}
                  {gs1Data.batchNumber && <Typography variant="body2">• LOT/Chargennummer (AI 10): {gs1Data.batchNumber}</Typography>}
                  {!gs1Data.batchNumber && gs1Data.serialNumber && <Typography variant="body2">• Seriennummer → LOT (AI 21): {gs1Data.serialNumber}</Typography>}
                  {gs1Data.batchNumber && gs1Data.serialNumber && <Typography variant="body2">• Seriennummer (AI 21): {gs1Data.serialNumber}</Typography>}
                  {gs1Data.expiryDate && <Typography variant="body2">• Verfallsdatum (AI 17): {gs1Data.expiryDate}</Typography>}
                  {gs1Data.sscc && <Typography variant="body2">• SSCC (AI 00): {gs1Data.sscc}</Typography>}
                </Alert>
              )}
            </Grid>

            {/* Grunddaten */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Grunddaten
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Autocomplete
                freeSolo
                options={productNameSuggestions}
                loading={productNameLoading}
                value={formData.name}
                onInputChange={(_, value) => {
                  setFormData(prev => ({ ...prev, name: value }));
                  fetchProductNameSuggestions(value);
                }}
                onChange={(_, value) => {
                  if (value) {
                    setFormData(prev => ({ ...prev, name: value }));
                    // Bei Auswahl aus der Liste direkt Lookup machen
                    handleNameLookup(value);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    required
                    fullWidth
                    label="Bezeichnung"
                    helperText="Tippen Sie für Vorschläge, Enter für Kategorie/Firma-Lookup"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNameLookup(formData.name);
                      }
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                label="Artikelnummer (GTIN)"
                value={formData.article_number}
                onChange={handleChange('article_number')}
                helperText={gs1Data?.gtin ? `GTIN aus GS1-Barcode: ${gs1Data.gtin}` : 'Global Trade Item Number (GTIN)'}
                InputProps={{
                  endAdornment: parsedFromGs1.gtin ? (
                    <InputAdornment position="end">
                      <CheckCircleIcon color="success" />
                    </InputAdornment>
                  ) : undefined,
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Kosten pro Einheit (€)"
                type="number"
                value={formData.cost}
                onChange={handleChange('cost')}
                InputProps={{
                  inputProps: { min: 0, step: 0.01 }
                }}
                helperText="Optionale Kostenangabe pro Einheit in EUR"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Beschreibung"
                value={formData.description}
                onChange={handleChange('description')}
              />
            </Grid>

            {/* Kategorisierung */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Kategorisierung
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Einheit / Abteilung"
                value={formData.unit_id}
                onChange={handleChange('unit_id')}
                disabled={!isRoot}
                helperText={!isRoot ? 'Automatisch zugewiesen' : undefined}
              >
                <MenuItem value="">Keine Einheit</MenuItem>
                {units.map((unit) => (
                  <MenuItem key={unit.id} value={unit.id}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: unit.color,
                        }}
                      />
                      {unit.name}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Kategorie"
                value={formData.category_id}
                onChange={handleChange('category_id')}
              >
                <MenuItem value="">Keine Kategorie</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Firma"
                value={formData.company_id}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'EU_COMPANIES') {
                    setEuCompaniesDialogOpen(true);
                  } else {
                    handleChange('company_id')(e as any);
                  }
                }}
              >
                <MenuItem value="">Keine Firma</MenuItem>
                {companies.map((comp) => (
                  <MenuItem key={comp.id} value={comp.id}>
                    {comp.name}
                  </MenuItem>
                ))}
                <MenuItem value="EU_COMPANIES" sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                  Weitere EU-Firmen...
                </MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Schrank"
                value={formData.cabinet_id}
                onChange={handleChange('cabinet_id')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Tooltip title="Schrank-QR-Code scannen">
                        <IconButton size="small" onClick={() => navigate('/scanner', { state: { scanCabinet: true, returnTo: location.pathname } })}>
                          <QrCodeScannerIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              >
                <MenuItem value="">Kein Schrank</MenuItem>
                {cabinets.map((cab) => (
                  <MenuItem key={cab.id} value={cab.id}>
                    {cab.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Bestandsdaten */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Bestandsdaten
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label="Einheiten pro Packung"
                value={formData.size}
                onChange={handleChange('size')}
                disabled={formData.unit === 'Stück'}
                helperText={formData.unit === 'Stück' ? 'Bei Stück immer 1' : 'Anzahl Einheiten in der Packung'}
                InputProps={{
                  inputProps: { min: 1 }
                }}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                select
                label="Einheit"
                value={formData.unit}
                onChange={(e) => {
                  const newUnit = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    unit: newUnit,
                    size: newUnit === 'Stück' ? '1' : prev.size
                  }));
                }}
              >
                <MenuItem value="Stück">Stück</MenuItem>
                <MenuItem value="Packung">Packung</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label="Mindestbestand (optional)"
                value={formData.min_stock}
                onChange={handleChange('min_stock')}
                helperText="0 = nutzt Kategorie-Mindestbestand"
                InputProps={{
                  inputProps: { min: 0 }
                }}
              />
            </Grid>

            {/* Chargen- und Haltbarkeitsdaten */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Chargen- und Haltbarkeitsdaten
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                label="Chargennummer (LOT)"
                value={formData.lot_number}
                onChange={handleChange('lot_number')}
                helperText={gs1Data?.batchNumber ? `LOT-Nummer aus GS1-Barcode: ${gs1Data.batchNumber}` : (gs1Data?.serialNumber ? `Seriennummer als LOT: ${gs1Data.serialNumber}` : 'Batch/Lot Number aus GS1 AI 10 oder Seriennummer AI 21')}
                InputProps={{
                  endAdornment: parsedFromGs1.lot ? (
                    <InputAdornment position="end">
                      <CheckCircleIcon color="success" />
                    </InputAdornment>
                  ) : undefined,
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                type="date"
                label="Verfallsdatum"
                value={formData.expiry_date}
                onChange={handleChange('expiry_date')}
                InputLabelProps={{ shrink: true }}
                helperText={gs1Data?.expiryDate ? 'Aus GS1-Barcode übernommen' : ''}
                InputProps={{
                  endAdornment: parsedFromGs1.expiry ? (
                    <InputAdornment position="end">
                      <CheckCircleIcon color="success" />
                    </InputAdornment>
                  ) : undefined,
                }}
              />
            </Grid>

            {/* Lagerort und Notizen */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Weitere Informationen
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                select
                fullWidth
                label="Fach im Schrank"
                value={formData.compartment_id}
                onChange={handleChange('compartment_id')}
                disabled={!formData.cabinet_id || compartments.length === 0}
                helperText={
                  !formData.cabinet_id 
                    ? 'Bitte zuerst einen Schrank auswählen' 
                    : compartments.length === 0 
                      ? 'Keine Fächer für diesen Schrank konfiguriert' 
                      : ''
                }
              >
                <MenuItem value="">Kein Fach ausgewählt</MenuItem>
                {compartments.map((comp) => (
                  <MenuItem key={comp.id} value={comp.id}>
                    {comp.name}{comp.description ? ` - ${comp.description}` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Notizen"
                value={formData.notes}
                onChange={handleChange('notes')}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.is_consignment}
                    onChange={(e) => setFormData({ ...formData, is_consignment: e.target.checked })}
                    color="error"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography>Konsignationsware</Typography>
                    <Typography variant="caption" color="text.secondary">
                      (wird rot markiert in Listen)
                    </Typography>
                  </Box>
                }
              />
            </Grid>

            {/* Device-Eigenschaften */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Device-Eigenschaften (optional)
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <TextField
                  select
                  fullWidth
                  label="Shape / Form"
                  value={formData.shape_id}
                  onChange={handleChange('shape_id')}
                >
                  <MenuItem value="">
                    <em>Keine Auswahl</em>
                  </MenuItem>
                  {shapes.map((shape) => (
                    <MenuItem key={shape.id} value={shape.id}>
                      {shape.name}
                    </MenuItem>
                  ))}
                </TextField>
                {isAdmin && (
                  <Tooltip title="Shapes bearbeiten">
                    <IconButton 
                      onClick={openShapeDialog}
                      sx={{ mt: 1 }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Schaftlänge"
                value={formData.shaft_length}
                onChange={handleChange('shaft_length')}
                placeholder="z.B. 100cm"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Device-Länge"
                value={formData.device_length}
                onChange={handleChange('device_length')}
                placeholder="z.B. 150cm"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Device-Durchmesser"
                value={formData.device_diameter}
                onChange={handleChange('device_diameter')}
                placeholder="z.B. 5mm"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="French-Size"
                value={formData.french_size}
                onChange={handleChange('french_size')}
                placeholder="z.B. 5F, 6F"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Guidewire-Acceptance"
                value={formData.guidewire_acceptance}
                onChange={handleChange('guidewire_acceptance')}
              >
                <MenuItem value="">
                  <em>Keine Auswahl</em>
                </MenuItem>
                {GUIDEWIRE_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Aktionsbuttons */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end" mt={2}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/materials')}
                  disabled={saving}
                >
                  Abbrechen
                </Button>
                <Tooltip 
                  title={
                    !formData.name.trim() || !formData.article_number.trim() || !formData.lot_number.trim() || !formData.expiry_date
                      ? 'Bitte füllen Sie alle Pflichtfelder aus: Bezeichnung, GTIN, LOT und Verfallsdatum'
                      : ''
                  }
                >
                  <span>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                      disabled={saving || !formData.name.trim() || !formData.article_number.trim() || !formData.lot_number.trim() || !formData.expiry_date}
                    >
                      {saving ? 'Speichern...' : 'Speichern'}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {/* Shape-Verwaltungs-Dialog */}
      <Dialog 
        open={shapeDialogOpen} 
        onClose={() => setShapeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Shape-Typen verwalten</DialogTitle>
        <DialogContent>
          {shapeError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setShapeError(null)}>
              {shapeError}
            </Alert>
          )}

          {/* Neuen Shape hinzufügen */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Neuen Shape hinzufügen"
              value={newShapeName}
              onChange={(e) => setNewShapeName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddShape();
                }
              }}
              disabled={shapeLoading}
            />
            <Button
              variant="contained"
              onClick={handleAddShape}
              disabled={!newShapeName.trim() || shapeLoading}
              startIcon={<AddIcon />}
            >
              Hinzufügen
            </Button>
          </Box>

          {/* Liste der Shapes */}
          {shapeLoading && allShapes.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List dense>
              {allShapes.map((shape) => (
                <ListItem 
                  key={shape.id}
                  sx={{ 
                    bgcolor: shape.active ? 'transparent' : 'action.disabledBackground',
                    borderRadius: 1,
                    mb: 0.5
                  }}
                >
                  {editingShapeId === shape.id ? (
                    <Box sx={{ display: 'flex', gap: 1, width: '100%', alignItems: 'center' }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={editingShapeName}
                        onChange={(e) => setEditingShapeName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleUpdateShape(shape.id);
                          }
                        }}
                        autoFocus
                      />
                      <Button 
                        size="small" 
                        onClick={() => handleUpdateShape(shape.id)}
                        disabled={shapeLoading}
                      >
                        OK
                      </Button>
                      <Button 
                        size="small" 
                        onClick={() => {
                          setEditingShapeId(null);
                          setEditingShapeName('');
                        }}
                      >
                        Abbrechen
                      </Button>
                    </Box>
                  ) : (
                    <>
                      <ListItemText 
                        primary={shape.name}
                        secondary={!shape.active ? 'Deaktiviert' : undefined}
                        sx={{ 
                          opacity: shape.active ? 1 : 0.5,
                          textDecoration: shape.active ? 'none' : 'line-through'
                        }}
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title={shape.active ? 'Deaktivieren' : 'Aktivieren'}>
                          <Switch
                            edge="end"
                            size="small"
                            checked={shape.active}
                            onChange={() => handleToggleShapeActive(shape)}
                            disabled={shapeLoading}
                          />
                        </Tooltip>
                        <Tooltip title="Bearbeiten">
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => {
                              setEditingShapeId(shape.id);
                              setEditingShapeName(shape.name);
                            }}
                            disabled={shapeLoading}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Löschen (Deaktivieren)">
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => handleDeleteShape(shape.id)}
                            disabled={shapeLoading || !shape.active}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </>
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShapeDialogOpen(false)}>
            Schließen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Packung/Stück Dialog */}
      <Dialog
        open={packDialogOpen}
        onClose={() => setPackDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Wie möchten Sie die Packung speichern?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Sie haben eine <strong>Packung mit {pendingFormData?.packSize || 0} Einheiten</strong> eingegeben.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Bei Materialien wie Drähten oder Kathetern ist es oft sinnvoll, jeden Artikel einzeln zu erfassen. 
            So können Sie später einzelne Stücke aus dem Schrank entnehmen, ohne die ganze Packung zu entfernen.
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paper 
              elevation={2} 
              sx={{ 
                p: 2, 
                cursor: 'pointer',
                border: '2px solid transparent',
                transition: 'all 0.2s',
                '&:hover': { 
                  bgcolor: 'action.hover',
                  borderColor: 'primary.main' 
                }
              }}
              onClick={saveAsIndividualItems}
            >
              <Typography variant="subtitle1" fontWeight="bold" color="primary">
                🔢 Als {pendingFormData?.packSize || 0} einzelne Stücke speichern
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Jedes Stück wird separat erfasst und kann einzeln entnommen werden.
                Empfohlen für Verbrauchsmaterialien.
              </Typography>
            </Paper>
            
            <Paper 
              elevation={2} 
              sx={{ 
                p: 2, 
                cursor: 'pointer',
                border: '2px solid transparent',
                transition: 'all 0.2s',
                '&:hover': { 
                  bgcolor: 'action.hover',
                  borderColor: 'secondary.main' 
                }
              }}
              onClick={saveAsPackage}
            >
              <Typography variant="subtitle1" fontWeight="bold" color="secondary">
                📦 Als 1 Packung speichern
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Die Packung wird als Ganzes erfasst. 
                Geeignet für Materialien, die immer komplett entnommen werden.
              </Typography>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPackDialogOpen(false)} color="inherit">
            Abbrechen
          </Button>
        </DialogActions>
      </Dialog>

      {/* EU-Firmen Dialog */}
      <Dialog 
        open={euCompaniesDialogOpen} 
        onClose={() => {
          setEuCompaniesDialogOpen(false);
          setEuCompanySearchTerm('');
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          EU-registrierte Medizintechnik-Firmen
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Wählen Sie eine Firma aus, um sie automatisch hinzuzufügen und auszuwählen
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Suche"
            variant="outlined"
            value={euCompanySearchTerm}
            onChange={(e) => setEuCompanySearchTerm(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
            placeholder="Firmenname suchen..."
          />
          <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
            <List>
              {(() => {
                const existingNames = new Set(companies.map(c => c.name.toLowerCase()));
                const filtered = EU_REGISTERED_COMPANIES.filter(company =>
                  company.toLowerCase().includes(euCompanySearchTerm.toLowerCase()) &&
                  !existingNames.has(company.toLowerCase())
                );
                
                return filtered.length > 0 ? (
                  filtered.map((company, index) => (
                    <ListItem key={index} disablePadding>
                      <ListItemText 
                        primary={company}
                        secondary="Klicken zum Hinzufügen und Auswählen"
                        onClick={() => handleAddEuCompany(company)}
                        sx={{ 
                          cursor: 'pointer',
                          px: 2,
                          py: 1,
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText 
                      primary={euCompanySearchTerm ? "Keine Firmen gefunden" : "Alle EU-Firmen bereits hinzugefügt"}
                      sx={{ textAlign: 'center', color: 'text.secondary' }}
                    />
                  </ListItem>
                );
              })()}
            </List>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEuCompaniesDialogOpen(false);
            setEuCompanySearchTerm('');
          }}>
            Schließen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MaterialForm;
