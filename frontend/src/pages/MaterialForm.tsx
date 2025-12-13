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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  QrCodeScanner as QrCodeScannerIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { materialAPI, cabinetAPI, categoryAPI, companyAPI, unitAPI } from '../services/api';
import { parseGS1Barcode, isValidGS1Barcode, GS1Data } from '../utils/gs1Parser';
import { useAuth } from '../contexts/AuthContext';

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
  const { user, isRoot } = useAuth();
  
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

  // GS1-Parser Status
  const [gs1Data, setGs1Data] = useState<GS1Data | null>(null);
  const [gs1Warning, setGs1Warning] = useState<string | null>(null);

  // Fach-QR-Code Status
  const [compartmentQrInput, setCompartmentQrInput] = useState<string>('');
  const [compartmentQrData, setCompartmentQrData] = useState<any>(null);

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
  });

  useEffect(() => {
    console.log('MaterialForm useEffect triggered');
    console.log('isNew in useEffect:', isNew);
    console.log('id in useEffect:', id);
    
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
      const [categoriesRes, companiesRes, cabinetsRes, unitsRes] = await Promise.all([
        categoryAPI.getAll(),
        companyAPI.getAll(),
        cabinetAPI.getAll(),
        unitAPI.getAll(),
      ]);
      console.log('Dropdown data loaded successfully');
      setCategories(categoriesRes.data);
      setCompanies(companiesRes.data);
      setCabinets(cabinetsRes.data);
      setUnits(unitsRes.data);
    } catch (err) {
      console.error('Fehler beim Laden der Dropdown-Daten:', err);
      setError('Fehler beim Laden der Formulardaten');
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

  const fetchCompartments = async (cabinetId: number) => {
    try {
      const response = await cabinetAPI.getCompartments(cabinetId);
      setCompartments(response.data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Fächer:', err);
      setCompartments([]);
    }
  };

  const handleChange = (field: keyof MaterialFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    
    // Wenn der Schrank gewechselt wird, Fächer neu laden und compartment_id zurücksetzen
    if (field === 'cabinet_id') {
      const cabinetId = value ? Number(value) : '';
      if (value) {
        fetchCompartments(Number(value));
      } else {
        setCompartments([]);
      }
      setFormData(prev => ({ ...prev, cabinet_id: cabinetId, compartment_id: '' }));
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  const handleGS1BarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const barcode = e.target.value;
    setFormData({ ...formData, gs1_barcode: barcode });
    setGs1Warning(null);
    setGs1Data(null);

    if (!barcode) {
      return;
    }

    // GS1 Barcode parsen
    if (isValidGS1Barcode(barcode)) {
      const parsed = parseGS1Barcode(barcode);
      setGs1Data(parsed);

      // Auto-Fill Felder
      const updates: Partial<MaterialFormData> = {};

      if (parsed.gtin) {
        updates.article_number = parsed.gtin;
      }

      // LOT: batchNumber (AI 10) oder falls nicht vorhanden serialNumber (AI 21)
      if (parsed.batchNumber) {
        updates.lot_number = parsed.batchNumber;
      } else if (parsed.serialNumber) {
        updates.lot_number = parsed.serialNumber;
      }

      if (parsed.expiryDate) {
        updates.expiry_date = parsed.expiryDate;
      }

      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({ ...prev, ...updates }));
        setSuccess('GS1-Daten erfolgreich ausgelesen!');
        setTimeout(() => setSuccess(null), 3000);
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
    }));
    setGs1Data(null);
    setGs1Warning(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const dataToSend = {
        ...formData,
        category_id: formData.category_id || null,
        company_id: formData.company_id || null,
        cabinet_id: formData.cabinet_id || null,
        compartment_id: formData.compartment_id || null,
        expiry_date: formData.expiry_date || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
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

      if (isNew) {
        const response = await materialAPI.create({ ...dataToSend, barcodes });
        setSuccess('Material erfolgreich erstellt!');
        setTimeout(() => navigate(`/materials/${response.data.id}`), 1500);
      } else {
        await materialAPI.update(parseInt(id!), dataToSend);
        setSuccess('Material erfolgreich aktualisiert!');
        setTimeout(() => navigate('/materials'), 1500);
      }
    } catch (err: any) {
      console.error('Fehler beim Speichern:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern des Materials');
    } finally {
      setSaving(false);
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
                  endAdornment: compartmentQrInput && (
                    <InputAdornment position="end">
                      <Tooltip title="Fach-Daten löschen">
                        <IconButton onClick={clearCompartmentQrData} size="small">
                          <ClearIcon />
                        </IconButton>
                      </Tooltip>
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
                  endAdornment: formData.gs1_barcode && (
                    <InputAdornment position="end">
                      <Tooltip title="GS1-Daten löschen">
                        <IconButton onClick={clearGS1Data} size="small">
                          <ClearIcon />
                        </IconButton>
                      </Tooltip>
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
              <TextField
                required
                fullWidth
                label="Bezeichnung"
                value={formData.name}
                onChange={handleChange('name')}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Artikelnummer (GTIN)"
                value={formData.article_number}
                onChange={handleChange('article_number')}
                helperText={gs1Data?.gtin ? `GTIN aus GS1-Barcode: ${gs1Data.gtin}` : 'Global Trade Item Number (GTIN)'}
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
                onChange={handleChange('company_id')}
              >
                <MenuItem value="">Keine Firma</MenuItem>
                {companies.map((comp) => (
                  <MenuItem key={comp.id} value={comp.id}>
                    {comp.name}
                  </MenuItem>
                ))}
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
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                  disabled={saving}
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default MaterialForm;
