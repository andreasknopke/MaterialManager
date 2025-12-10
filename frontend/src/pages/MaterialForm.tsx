import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { materialAPI, cabinetAPI, categoryAPI, companyAPI } from '../services/api';
import { parseGS1Barcode, isValidGS1Barcode, GS1Data } from '../utils/gs1Parser';

interface MaterialFormData {
  name: string;
  description: string;
  category_id: number | '';
  company_id: number | '';
  cabinet_id: number | '';
  size: string;
  unit: string;
  min_stock: number;
  current_stock: number;
  expiry_date: string;
  lot_number: string;
  article_number: string;
  location_in_cabinet: string;
  notes: string;
  gs1_barcode: string;
  shipping_container_code: string;
}

const MaterialForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dropdown-Daten
  const [categories, setCategories] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [cabinets, setCabinets] = useState<any[]>([]);

  // GS1-Parser Status
  const [gs1Data, setGs1Data] = useState<GS1Data | null>(null);
  const [gs1Warning, setGs1Warning] = useState<string | null>(null);

  const [formData, setFormData] = useState<MaterialFormData>({
    name: '',
    description: '',
    category_id: '',
    company_id: '',
    cabinet_id: '',
    size: '',
    unit: 'Stück',
    min_stock: 0,
    current_stock: 0,
    expiry_date: '',
    lot_number: '',
    article_number: '',
    location_in_cabinet: '',
    notes: '',
    gs1_barcode: '',
    shipping_container_code: '',
  });

  useEffect(() => {
    fetchDropdownData();
    if (!isNew) {
      fetchMaterial();
    }
  }, [id, isNew]);

  const fetchDropdownData = async () => {
    try {
      const [categoriesRes, companiesRes, cabinetsRes] = await Promise.all([
        categoryAPI.getAll(),
        companyAPI.getAll(),
        cabinetAPI.getAll(),
      ]);
      setCategories(categoriesRes.data);
      setCompanies(companiesRes.data);
      setCabinets(cabinetsRes.data);
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
        size: material.size || '',
        unit: material.unit || 'Stück',
        min_stock: material.min_stock || 0,
        current_stock: material.current_stock || 0,
        expiry_date: material.expiry_date ? material.expiry_date.split('T')[0] : '',
        lot_number: material.lot_number || '',
        article_number: material.article_number || '',
        location_in_cabinet: material.location_in_cabinet || '',
        notes: material.notes || '',
        gs1_barcode: '',
        shipping_container_code: '',
      });
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
    setFormData({ ...formData, [field]: e.target.value });
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

      if (parsed.expiryDate) {
        updates.expiry_date = parsed.expiryDate;
      }

      if (parsed.batchNumber) {
        updates.lot_number = parsed.batchNumber;
      }

      if (parsed.sscc || parsed.gtin) {
        updates.shipping_container_code = parsed.sscc || parsed.gtin || '';
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
      shipping_container_code: '',
    }));
    setGs1Data(null);
    setGs1Warning(null);
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
        expiry_date: formData.expiry_date || null,
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
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/materials')}
        sx={{ mb: 2 }}
      >
        Zurück
      </Button>

      <Typography variant="h4" gutterBottom>
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

      <Paper sx={{ p: 3, mt: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
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
                  {gs1Data.gtin && <Typography variant="body2">• GTIN (01): {gs1Data.gtin}</Typography>}
                  {gs1Data.batchNumber && <Typography variant="body2">• Batch/Lot (10): {gs1Data.batchNumber}</Typography>}
                  {gs1Data.expiryDate && <Typography variant="body2">• Verfallsdatum (17): {gs1Data.expiryDate}</Typography>}
                  {gs1Data.sscc && <Typography variant="body2">• SSCC (00): {gs1Data.sscc}</Typography>}
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
                label="Artikelnummer"
                value={formData.article_number}
                onChange={handleChange('article_number')}
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

            <Grid item xs={12} md={4}>
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

            <Grid item xs={12} md={4}>
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

            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Schrank"
                value={formData.cabinet_id}
                onChange={handleChange('cabinet_id')}
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
                label="Größe"
                value={formData.size}
                onChange={handleChange('size')}
                placeholder="z.B. 100ml, 5kg"
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Einheit"
                value={formData.unit}
                onChange={handleChange('unit')}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label="Mindestbestand"
                value={formData.min_stock}
                onChange={handleChange('min_stock')}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label="Aktueller Bestand"
                value={formData.current_stock}
                onChange={handleChange('current_stock')}
                disabled={!isNew}
                helperText={!isNew ? 'Über Lagerbewegungen ändern' : ''}
              />
            </Grid>

            {/* Chargen- und Haltbarkeitsdaten */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Chargen- und Haltbarkeitsdaten
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="date"
                label="Verfallsdatum"
                value={formData.expiry_date}
                onChange={handleChange('expiry_date')}
                InputLabelProps={{ shrink: true }}
                helperText={gs1Data?.expiryDate ? 'Aus GS1-Barcode übernommen' : ''}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Chargennummer / Lot"
                value={formData.lot_number}
                onChange={handleChange('lot_number')}
                helperText={gs1Data?.batchNumber ? 'Aus GS1-Barcode übernommen' : ''}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Shipping Container Code"
                value={formData.shipping_container_code}
                onChange={handleChange('shipping_container_code')}
                helperText={gs1Data?.sscc || gs1Data?.gtin ? 'Aus GS1-Barcode übernommen' : ''}
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
                fullWidth
                label="Position im Schrank"
                value={formData.location_in_cabinet}
                onChange={handleChange('location_in_cabinet')}
                placeholder="z.B. Fach 3, Regal 2"
              />
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
