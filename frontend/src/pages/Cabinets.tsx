import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  QrCode2 as QrCodeIcon,
  Print as PrintIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import { cabinetAPI } from '../services/api';
import QRCode from 'qrcode';
import { useReactToPrint } from 'react-to-print';

interface Compartment {
  id: number;
  cabinet_id: number;
  name: string;
  description: string | null;
  position: number;
  material_count: number;
}

interface CompartmentMaterial {
  name: string;
  article_number: string | null;
  size: string | null;
  category_name: string | null;
  device_diameter: string | null;
  french_size: string | null;
  total_stock: number;
  item_count: number;
}

interface CustomField {
  field_label: string;
  field_value: string;
}

interface InfosheetMaterial {
  article_number: string | null;
  name: string;
  size: string | null;
  category_name: string | null;
  total_stock: number;
  item_count: number;
  is_consignment: boolean;
  shape_name: string | null;
  shaft_length: string | null;
  device_length: string | null;
  device_diameter: string | null;
  french_size: string | null;
  guidewire_acceptance: string | null;
}

interface InfosheetCompartment extends Compartment {
  materials: InfosheetMaterial[];
}

// Für Alle-Etiketten-Druck
interface CompartmentLabel {
  compartment: Compartment;
  materials: CompartmentMaterial[];
  qrCodeUrl: string;
}

// Hilfsfunktion: Zahlen zu Bereichen zusammenfassen (z.B. [6,7,8,10] → "6-8, 10")
const formatNumberRanges = (values: number[]): string => {
  if (values.length === 0) return '';
  const sorted = [...values].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      if (start === end) {
        ranges.push(String(start));
      } else if (end === start + 1) {
        ranges.push(`${start}, ${end}`);
      } else {
        ranges.push(`${start}-${end}`);
      }
      if (i < sorted.length) {
        start = sorted[i];
        end = sorted[i];
      }
    }
  }
  return ranges.join(', ');
};

// Hilfsfunktion: Materialien nach Namen gruppieren und Eigenschaften zusammenfassen
interface GroupedMaterial {
  name: string;
  diameters: number[];
  frenchSizes: number[];
  totalStock: number;
}

const groupMaterialsByName = (materials: CompartmentMaterial[]): GroupedMaterial[] => {
  const groups = new Map<string, GroupedMaterial>();
  
  for (const mat of materials) {
    // Normalisierter Key für Gruppierung (trim und lowercase)
    const normalizedKey = mat.name.trim().toLowerCase();
    const existing = groups.get(normalizedKey);
    if (existing) {
      existing.totalStock += mat.total_stock;
      if (mat.device_diameter) {
        const num = parseFloat(mat.device_diameter);
        if (!isNaN(num) && !existing.diameters.includes(num)) {
          existing.diameters.push(num);
        }
      }
      if (mat.french_size) {
        const num = parseFloat(mat.french_size.replace(/[Ff]/g, ''));
        if (!isNaN(num) && !existing.frenchSizes.includes(num)) {
          existing.frenchSizes.push(num);
        }
      }
    } else {
      const diameters: number[] = [];
      const frenchSizes: number[] = [];
      if (mat.device_diameter) {
        const num = parseFloat(mat.device_diameter);
        if (!isNaN(num)) diameters.push(num);
      }
      if (mat.french_size) {
        const num = parseFloat(mat.french_size.replace(/[Ff]/g, ''));
        if (!isNaN(num)) frenchSizes.push(num);
      }
      groups.set(normalizedKey, {
        name: mat.name.trim(), // Original-Name (getrimmt) für Anzeige
        diameters,
        frenchSizes,
        totalStock: mat.total_stock,
      });
    }
  }
  
  // Sortieren nach kleinstem Durchmesser, dann French Size
  return Array.from(groups.values()).sort((a, b) => {
    const minDiaA = a.diameters.length > 0 ? Math.min(...a.diameters) : Infinity;
    const minDiaB = b.diameters.length > 0 ? Math.min(...b.diameters) : Infinity;
    if (minDiaA !== minDiaB) return minDiaA - minDiaB;
    const minFrA = a.frenchSizes.length > 0 ? Math.min(...a.frenchSizes) : Infinity;
    const minFrB = b.frenchSizes.length > 0 ? Math.min(...b.frenchSizes) : Infinity;
    return minFrA - minFrB;
  });
};

const Cabinets: React.FC = () => {
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<any>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedCabinet, setSelectedCabinet] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [infosheetCompartments, setInfosheetCompartments] = useState<InfosheetCompartment[]>([]);
  const [infosheetLoading, setInfosheetLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    capacity: 0,
  });
  
  // Fächer-Verwaltung
  const [compartmentDialogOpen, setCompartmentDialogOpen] = useState(false);
  const [compartments, setCompartments] = useState<Compartment[]>([]);
  const [compartmentCabinet, setCompartmentCabinet] = useState<any>(null);
  const [compartmentLoading, setCompartmentLoading] = useState(false);
  const [editingCompartment, setEditingCompartment] = useState<Compartment | null>(null);
  const [compartmentForm, setCompartmentForm] = useState({ name: '', description: '' });
  const [compartmentError, setCompartmentError] = useState<string | null>(null);
  
  // Fach-QR-Code
  const [compartmentQrDialogOpen, setCompartmentQrDialogOpen] = useState(false);
  const [selectedCompartment, setSelectedCompartment] = useState<Compartment | null>(null);
  const [compartmentQrCodeUrl, setCompartmentQrCodeUrl] = useState('');
  const [compartmentMaterials, setCompartmentMaterials] = useState<CompartmentMaterial[]>([]);
  const [compartmentMaterialsLoading, setCompartmentMaterialsLoading] = useState(false);
  const compartmentPrintRef = useRef<HTMLDivElement>(null);
  
  // Alle Fach-Etiketten drucken
  const [allLabelsDialogOpen, setAllLabelsDialogOpen] = useState(false);
  const [allLabels, setAllLabels] = useState<CompartmentLabel[]>([]);
  const [allLabelsLoading, setAllLabelsLoading] = useState(false);
  const [allLabelsCabinet, setAllLabelsCabinet] = useState<any>(null);
  const allLabelsPrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCabinets();
  }, []);

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

  const handleOpen = (cabinet?: any) => {
    if (cabinet) {
      setEditingCabinet(cabinet);
      setFormData({
        name: cabinet.name,
        location: cabinet.location,
        description: cabinet.description,
        capacity: cabinet.capacity,
      });
    } else {
      setEditingCabinet(null);
      setFormData({ name: '', location: '', description: '', capacity: 0 });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingCabinet(null);
  };

  const handleSave = async () => {
    try {
      if (editingCabinet) {
        await cabinetAPI.update(editingCabinet.id, { ...formData, active: true });
      } else {
        await cabinetAPI.create(formData);
      }
      fetchCabinets();
      handleClose();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Schrank wirklich deaktivieren?')) {
      try {
        await cabinetAPI.delete(id);
        fetchCabinets();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
      }
    }
  };

  // ==================== FÄCHER-VERWALTUNG ====================
  
  const handleOpenCompartments = async (cabinet: any) => {
    setCompartmentCabinet(cabinet);
    setCompartmentDialogOpen(true);
    setCompartmentError(null);
    await fetchCompartments(cabinet.id);
  };

  const fetchCompartments = async (cabinetId: number) => {
    setCompartmentLoading(true);
    try {
      const response = await cabinetAPI.getCompartments(cabinetId);
      setCompartments(response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Fächer:', error);
      setCompartments([]);
    } finally {
      setCompartmentLoading(false);
    }
  };

  const handleEditCompartment = (comp: Compartment) => {
    setEditingCompartment(comp);
    setCompartmentForm({ name: comp.name, description: comp.description || '' });
    setCompartmentError(null);
  };

  const handleSaveCompartment = async () => {
    if (!compartmentForm.name.trim()) {
      setCompartmentError('Fachname ist erforderlich');
      return;
    }

    try {
      if (editingCompartment) {
        await cabinetAPI.updateCompartment(compartmentCabinet.id, editingCompartment.id, compartmentForm);
      } else {
        await cabinetAPI.createCompartment(compartmentCabinet.id, compartmentForm);
      }
      await fetchCompartments(compartmentCabinet.id);
      setCompartmentForm({ name: '', description: '' });
      setEditingCompartment(null);
      setCompartmentError(null);
    } catch (error: any) {
      console.error('Fehler beim Speichern des Fachs:', error);
      setCompartmentError(error.response?.data?.error || 'Fehler beim Speichern');
    }
  };

  const handleDeleteCompartment = async (comp: Compartment) => {
    if (comp.material_count > 0) {
      setCompartmentError(`Fach "${comp.name}" enthält noch ${comp.material_count} Material(ien). Bitte zuerst verschieben.`);
      return;
    }
    
    if (window.confirm(`Fach "${comp.name}" wirklich löschen?`)) {
      try {
        await cabinetAPI.deleteCompartment(compartmentCabinet.id, comp.id);
        await fetchCompartments(compartmentCabinet.id);
        setCompartmentError(null);
      } catch (error: any) {
        console.error('Fehler beim Löschen des Fachs:', error);
        setCompartmentError(error.response?.data?.error || 'Fehler beim Löschen');
      }
    }
  };

  // ==================== FACH-QR-CODE ====================
  
  const handleShowCompartmentQR = async (comp: Compartment) => {
    setSelectedCompartment(comp);
    setCompartmentMaterialsLoading(true);
    
    // QR-Code generieren mit Fach-Daten
    const qrData = JSON.stringify({
      type: 'COMPARTMENT',
      cabinetId: compartmentCabinet.id,
      compartmentId: comp.id,
      cabinetName: compartmentCabinet.name,
      compartmentName: comp.name,
    });
    
    try {
      const url = await QRCode.toDataURL(qrData, {
        width: 150,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setCompartmentQrCodeUrl(url);
      
      // Materialien des Fachs laden
      const response = await cabinetAPI.getCompartmentMaterials(compartmentCabinet.id, comp.id);
      setCompartmentMaterials(response.data.materials || []);
    } catch (error) {
      console.error('Fehler beim Generieren des QR-Codes:', error);
      setCompartmentMaterials([]);
    } finally {
      setCompartmentMaterialsLoading(false);
      setCompartmentQrDialogOpen(true);
    }
  };

  const handlePrintCompartment = useReactToPrint({
    contentRef: compartmentPrintRef,
  });

  // Alle Fach-Etiketten eines Schranks laden und drucken
  const handlePrintAllLabels = async (cabinet: any) => {
    setAllLabelsCabinet(cabinet);
    setAllLabelsLoading(true);
    setAllLabelsDialogOpen(true);
    
    try {
      // Fächer des Schranks laden
      const compartmentsResponse = await cabinetAPI.getCompartments(cabinet.id);
      const compartmentsList: Compartment[] = compartmentsResponse.data || [];
      
      // Für jedes Fach: QR-Code und Materialien laden
      const labels: CompartmentLabel[] = [];
      
      for (const comp of compartmentsList) {
        // QR-Code generieren
        const qrData = JSON.stringify({
          type: 'COMPARTMENT',
          cabinetId: cabinet.id,
          compartmentId: comp.id,
          cabinetName: cabinet.name,
          compartmentName: comp.name,
        });
        
        const qrCodeUrl = await QRCode.toDataURL(qrData, {
          width: 150,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        
        // Materialien laden
        let materials: CompartmentMaterial[] = [];
        try {
          const matResponse = await cabinetAPI.getCompartmentMaterials(cabinet.id, comp.id);
          materials = matResponse.data.materials || [];
        } catch {
          // Ignorieren wenn keine Materialien
        }
        
        labels.push({
          compartment: comp,
          materials,
          qrCodeUrl,
        });
      }
      
      setAllLabels(labels);
    } catch (error) {
      console.error('Fehler beim Laden der Etiketten:', error);
      setAllLabels([]);
    } finally {
      setAllLabelsLoading(false);
    }
  };

  const handlePrintAllLabelsAction = useReactToPrint({
    contentRef: allLabelsPrintRef,
  });

  const handleShowQR = async (cabinet: any) => {
    setSelectedCabinet(cabinet);
    setInfosheetLoading(true);
    
    // Generate QR code with cabinet data
    const qrData = JSON.stringify({
      type: 'CABINET',
      id: cabinet.id,
      name: cabinet.name,
      location: cabinet.location,
    });
    
    try {
      const url = await QRCode.toDataURL(qrData, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(url);
      
      // Lade Fächer mit Materialien und Custom Fields
      const response = await cabinetAPI.getInfosheet(cabinet.id);
      setInfosheetCompartments(response.data.compartments || []);
      
      setQrDialogOpen(true);
    } catch (error) {
      console.error('Fehler beim Generieren des QR-Codes:', error);
      setInfosheetCompartments([]);
    } finally {
      setInfosheetLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'location', headerName: 'Standort', width: 200 },
    { field: 'description', headerName: 'Beschreibung', width: 250 },
    { field: 'capacity', headerName: 'Kapazität', width: 100, type: 'number' },
    {
      field: 'actions',
      headerName: 'Aktionen',
      width: 220,
      sortable: false,
      renderCell: (params) => (
        <>
          <IconButton size="small" onClick={() => handleOpen(params.row)} title="Bearbeiten">
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleOpenCompartments(params.row)} color="secondary" title="Fächer verwalten">
            <InventoryIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleShowQR(params.row)} color="primary" title="QR-Code">
            <QrCodeIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDelete(params.row.id)} color="error" title="Löschen">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Schränke</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Neuer Schrank
        </Button>
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={cabinets}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCabinet ? 'Schrank bearbeiten' : 'Neuer Schrank'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Standort"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Beschreibung"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Kapazität"
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Abbrechen</Button>
          <Button onClick={handleSave} variant="contained">
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog 
        open={qrDialogOpen} 
        onClose={() => setQrDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Infoblatt: {selectedCabinet?.name}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={2}>
            <div 
              ref={printRef} 
              style={{ 
                padding: '15px', 
                backgroundColor: 'white', 
                width: '210mm', 
                minHeight: '297mm',
                maxHeight: '297mm',
                fontFamily: 'Arial, sans-serif',
                fontSize: infosheetCompartments.length > 6 ? '9px' : infosheetCompartments.length > 4 ? '10px' : '11px',
                overflow: 'hidden',
                boxSizing: 'border-box'
              }}
            >
              {qrCodeUrl && (
                <>
                  {/* Header mit QR-Code - kompakt */}
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    borderBottom: '2px solid #333', 
                    pb: 1, 
                    mb: 2 
                  }}>
                    <Box>
                      <Typography sx={{ fontWeight: 'bold', fontSize: '1.4em', color: '#333' }}>
                        {selectedCabinet?.name}
                      </Typography>
                      <Typography sx={{ fontSize: '1em', color: '#666' }}>
                        {selectedCabinet?.location}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <img src={qrCodeUrl} alt="QR Code" style={{ width: '60px', height: '60px' }} />
                    </Box>
                  </Box>

                  {/* Fächer und Inhalt */}
                  {infosheetLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : infosheetCompartments.length === 0 ? (
                    <Typography sx={{ fontSize: '1em', color: '#666', textAlign: 'center', py: 2 }}>
                      Keine Fächer vorhanden
                    </Typography>
                  ) : (
                    <Box>
                      {infosheetCompartments.map((compartment, idx) => (
                        <Box key={compartment.id} sx={{ mb: 1.5 }}>
                          {/* Fachname */}
                          <Box sx={{ 
                            fontWeight: 'bold', 
                            backgroundColor: '#f0f0f0', 
                            padding: '3px 8px',
                            borderLeft: '3px solid #1976d2',
                            fontSize: '1.1em',
                            mb: 0.5
                          }}>
                            {compartment.name}
                            {compartment.description && (
                              <span style={{ marginLeft: '8px', fontWeight: 'normal', color: '#666', fontSize: '0.9em' }}>
                                ({compartment.description})
                              </span>
                            )}
                          </Box>

                          {/* Materialien im Fach */}
                          {compartment.materials.length === 0 ? (
                            <Box sx={{ ml: 2, fontStyle: 'italic', color: '#999', fontSize: '0.9em' }}>
                              Leer
                            </Box>
                          ) : (
                            <Box sx={{ ml: 1 }}>
                              {(() => {
                                // Gruppiere Materialien nach Kategorie
                                const materialsByCategory = compartment.materials.reduce((acc: any, material) => {
                                  const category = material.category_name || 'Ohne Kategorie';
                                  if (!acc[category]) {
                                    acc[category] = [];
                                  }
                                  acc[category].push(material);
                                  return acc;
                                }, {});

                                return Object.entries(materialsByCategory).map(([category, materials]: [string, any], catIdx) => {
                                  // Sortiere Materialien: Durchmesser → Devicelänge → Schaftlänge (jeweils aufsteigend)
                                  const sortedMaterials = [...materials].sort((a: any, b: any) => {
                                    // Hilfsfunktion: Extrahiert numerischen Wert aus String (z.B. "8mm" → 8)
                                    const extractNumber = (val: any): number => {
                                      if (!val) return Infinity; // Kein Wert = ans Ende
                                      const match = String(val).match(/[\d.]+/);
                                      return match ? parseFloat(match[0]) : Infinity;
                                    };
                                    
                                    // 1. Nach Durchmesser sortieren
                                    const diamA = extractNumber(a.device_diameter);
                                    const diamB = extractNumber(b.device_diameter);
                                    if (diamA !== diamB) return diamA - diamB;
                                    
                                    // 2. Nach Devicelänge sortieren
                                    const lenA = extractNumber(a.device_length);
                                    const lenB = extractNumber(b.device_length);
                                    if (lenA !== lenB) return lenA - lenB;
                                    
                                    // 3. Nach Schaftlänge sortieren
                                    const shaftA = extractNumber(a.shaft_length);
                                    const shaftB = extractNumber(b.shaft_length);
                                    return shaftA - shaftB;
                                  });
                                  
                                  return (
                                  <Box key={catIdx} sx={{ mb: 0.5 }}>
                                    {/* Kategorie als Überschrift */}
                                    <Box sx={{ fontWeight: 'bold', fontSize: '1em' }}>
                                      {category}
                                    </Box>

                                    {/* Materialien dieser Kategorie */}
                                    <Box component="ul" sx={{ m: 0, pl: 3, listStyleType: 'disc' }}>
                                      {sortedMaterials.map((material: any, matIdx: number) => {
                                        // Sammle alle Eigenschaften in strukturierter Form für Tabellen-Layout
                                        const properties: { label: string; value: string }[] = [];
                                        
                                        if (material.shape_name) properties.push({ label: 'Form', value: material.shape_name });
                                        if (material.shaft_length) properties.push({ label: 'Schaft', value: material.shaft_length });
                                        if (material.device_length) properties.push({ label: 'Länge', value: material.device_length });
                                        if (material.device_diameter) properties.push({ label: 'Ø', value: material.device_diameter });
                                        if (material.french_size) {
                                          // French-Size: "F" anhängen wenn nicht bereits vorhanden
                                          const frValue = String(material.french_size);
                                          const frDisplay = frValue.toLowerCase().endsWith('f') ? frValue : `${frValue}F`;
                                          properties.push({ label: 'Fr', value: frDisplay });
                                        }
                                        if (material.guidewire_acceptance) properties.push({ label: 'GW', value: material.guidewire_acceptance });
                                        if (material.is_consignment) properties.push({ label: '', value: 'K' });
                                        
                                        return (
                                          <li key={`${material.article_number}-${matIdx}`} style={{ marginBottom: '1px' }}>
                                            <span style={{ 
                                              fontFamily: 'monospace',
                                              fontSize: '0.95em',
                                              display: 'inline-block'
                                            }}>
                                              {properties.map((prop, i) => (
                                                <span key={i} style={{ 
                                                  display: 'inline-block', 
                                                  minWidth: prop.label ? '85px' : '20px',
                                                  marginRight: '4px'
                                                }}>
                                                  {prop.label ? `${prop.label}: ${prop.value}` : prop.value}
                                                </span>
                                              ))}
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </Box>
                                  </Box>
                                )});
                              })()}
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </>
              )}
            </div>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrDialogOpen(false)}>Schließen</Button>
          <Button onClick={handlePrint} variant="contained" startIcon={<PrintIcon />}>
            Drucken
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fächer-Verwaltung Dialog */}
      <Dialog 
        open={compartmentDialogOpen} 
        onClose={() => setCompartmentDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Fächer verwalten: {compartmentCabinet?.name}
        </DialogTitle>
        <DialogContent>
          {compartmentError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCompartmentError(null)}>
              {compartmentError}
            </Alert>
          )}
          
          {/* Neues Fach hinzufügen / bearbeiten */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {editingCompartment ? 'Fach bearbeiten' : 'Neues Fach hinzufügen'}
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Fachname"
                  placeholder="z.B. Fach 1, Regal A"
                  value={compartmentForm.name}
                  onChange={(e) => setCompartmentForm({ ...compartmentForm, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Beschreibung (optional)"
                  value={compartmentForm.description}
                  onChange={(e) => setCompartmentForm({ ...compartmentForm, description: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Box display="flex" gap={1}>
                  <Button 
                    variant="contained" 
                    size="small" 
                    onClick={handleSaveCompartment}
                    disabled={!compartmentForm.name.trim()}
                  >
                    {editingCompartment ? 'Speichern' : 'Hinzufügen'}
                  </Button>
                  {editingCompartment && (
                    <Button 
                      size="small" 
                      onClick={() => {
                        setEditingCompartment(null);
                        setCompartmentForm({ name: '', description: '' });
                      }}
                    >
                      Abbrechen
                    </Button>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Fächer-Liste */}
          <Typography variant="subtitle2" gutterBottom>
            Vorhandene Fächer ({compartments.length})
          </Typography>
          {compartmentLoading ? (
            <Typography color="text.secondary">Laden...</Typography>
          ) : compartments.length === 0 ? (
            <Alert severity="info">
              Noch keine Fächer vorhanden. Fügen Sie oben das erste Fach hinzu.
            </Alert>
          ) : (
            <List dense>
              {compartments.map((comp, idx) => (
                <React.Fragment key={comp.id}>
                  {idx > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography fontWeight="medium">{comp.name}</Typography>
                          <Chip 
                            label={`${comp.material_count} Material(ien)`} 
                            size="small" 
                            color={comp.material_count > 0 ? 'primary' : 'default'}
                          />
                        </Box>
                      }
                      secondary={comp.description || 'Keine Beschreibung'}
                    />
                    <ListItemSecondaryAction>
                      <IconButton size="small" onClick={() => handleShowCompartmentQR(comp)} color="primary" title="QR-Code drucken">
                        <QrCodeIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleEditCompartment(comp)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => handleDeleteCompartment(comp)}
                        disabled={comp.material_count > 0}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => handlePrintAllLabels(compartmentCabinet)} 
            startIcon={<PrintIcon />}
            disabled={compartments.length === 0}
          >
            Alle Etiketten drucken
          </Button>
          <Button onClick={() => setCompartmentDialogOpen(false)}>Schließen</Button>
        </DialogActions>
      </Dialog>

      {/* Fach-QR-Code Druck Dialog */}
      <Dialog 
        open={compartmentQrDialogOpen} 
        onClose={() => setCompartmentQrDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Fach-Etikett drucken: {selectedCompartment?.name}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={2}>
            {/* Druckbare Etikette - Kompaktes Format für Schrankschilder */}
            <div 
              ref={compartmentPrintRef} 
              style={{ 
                backgroundColor: 'white',
                border: '2px solid #333',
                borderRadius: '4px',
                padding: '8px',
                width: '80mm',
                minHeight: '50mm',
                fontFamily: 'Arial, sans-serif',
              }}
            >
              {/* Header mit Schrank/Fach-Info */}
              <div style={{ 
                borderBottom: '1px solid #ccc', 
                paddingBottom: '4px', 
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '2px' }}>
                    {compartmentCabinet?.name}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1976d2' }}>
                    {selectedCompartment?.name}
                  </div>
                  {compartmentCabinet?.location && (
                    <div style={{ fontSize: '16px', color: '#666' }}>
                      {compartmentCabinet.location}
                    </div>
                  )}
                </div>
                {compartmentQrCodeUrl && (
                  <img 
                    src={compartmentQrCodeUrl} 
                    alt="QR Code" 
                    style={{ width: '30mm', height: '30mm' }} 
                  />
                )}
              </div>
              
              {/* Materialien-Liste */}
              {compartmentMaterialsLoading ? (
                <div style={{ textAlign: 'center', padding: '10px' }}>
                  <CircularProgress size={20} />
                </div>
              ) : compartmentMaterials.length === 0 ? (
                <div style={{ fontSize: '16px', color: '#666', textAlign: 'center', padding: '10px' }}>
                  Keine Materialien in diesem Fach
                </div>
              ) : (
                <div style={{ fontSize: '16px' }}>
                  {groupMaterialsByName(compartmentMaterials).map((group, idx) => {
                    // Eigenschaften für Anzeige zusammenstellen
                    const props: string[] = [];
                    if (group.diameters.length > 0) {
                      props.push(`Ø${formatNumberRanges(group.diameters)}`);
                    }
                    if (group.frenchSizes.length > 0) {
                      props.push(`${formatNumberRanges(group.frenchSizes)}F`);
                    }
                    
                    return (
                      <div key={idx} style={{ padding: '3px 0', borderBottom: '1px dotted #eee' }}>
                        {group.name}
                        {props.length > 0 && (
                          <span style={{ color: '#666' }}> ({props.join(', ')})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Footer mit IDs */}
              <div style={{ 
                marginTop: '4px', 
                paddingTop: '4px', 
                borderTop: '1px solid #eee',
                fontSize: '8px', 
                color: '#999',
                textAlign: 'center',
              }}>
                Schrank-ID: {compartmentCabinet?.id} | Fach-ID: {selectedCompartment?.id}
              </div>
            </div>
            
            <Typography variant="caption" color="text.secondary">
              Das Etikett ist für das Format 80mm x 50mm optimiert
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompartmentQrDialogOpen(false)}>Schließen</Button>
          <Button 
            onClick={handlePrintCompartment} 
            variant="contained" 
            startIcon={<PrintIcon />}
            disabled={compartmentMaterialsLoading}
          >
            Drucken
          </Button>
        </DialogActions>
      </Dialog>

      {/* Alle Fach-Etiketten Druck Dialog */}
      <Dialog 
        open={allLabelsDialogOpen} 
        onClose={() => setAllLabelsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Alle Fach-Etiketten drucken: {allLabelsCabinet?.name}
        </DialogTitle>
        <DialogContent>
          {allLabelsLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={4}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Etiketten werden vorbereitet...</Typography>
            </Box>
          ) : allLabels.length === 0 ? (
            <Alert severity="info">Keine Fächer vorhanden.</Alert>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {allLabels.length} Etiketten werden gedruckt (4 pro A4-Seite)
              </Typography>
              
              {/* Druckbarer Bereich - A4 mit 4 Etiketten pro Seite */}
              <div 
                ref={allLabelsPrintRef}
                style={{ backgroundColor: 'white' }}
              >
                <style>
                  {`
                    @media print {
                      .label-page {
                        page-break-after: always;
                      }
                      .label-page:last-child {
                        page-break-after: auto;
                      }
                    }
                  `}
                </style>
                
                {/* Gruppiere Etiketten in 4er-Gruppen (2x2 pro Seite) */}
                {Array.from({ length: Math.ceil(allLabels.length / 4) }).map((_, pageIdx) => (
                  <div 
                    key={pageIdx} 
                    className="label-page"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '10mm',
                      padding: '10mm',
                      minHeight: pageIdx < Math.ceil(allLabels.length / 4) - 1 ? '277mm' : 'auto',
                    }}
                  >
                    {allLabels.slice(pageIdx * 4, pageIdx * 4 + 4).map((label, idx) => (
                      <div
                        key={idx}
                        style={{ 
                          backgroundColor: 'white',
                          border: '2px solid #333',
                          borderRadius: '4px',
                          padding: '8px',
                          width: '85mm',
                          minHeight: '55mm',
                          fontFamily: 'Arial, sans-serif',
                          boxSizing: 'border-box',
                        }}
                      >
                        {/* Header mit Schrank/Fach-Info */}
                        <div style={{ 
                          borderBottom: '1px solid #ccc', 
                          paddingBottom: '4px', 
                          marginBottom: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '2px' }}>
                              {allLabelsCabinet?.name}
                            </div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                              {label.compartment.name}
                            </div>
                            {allLabelsCabinet?.location && (
                              <div style={{ fontSize: '14px', color: '#666' }}>
                                {allLabelsCabinet.location}
                              </div>
                            )}
                          </div>
                          <img 
                            src={label.qrCodeUrl} 
                            alt="QR Code" 
                            style={{ width: '25mm', height: '25mm' }} 
                          />
                        </div>
                        
                        {/* Materialien-Liste */}
                        {label.materials.length === 0 ? (
                          <div style={{ fontSize: '14px', color: '#666', textAlign: 'center', padding: '8px' }}>
                            Keine Materialien
                          </div>
                        ) : (
                          <div style={{ fontSize: '14px' }}>
                            {groupMaterialsByName(label.materials).map((group, gIdx) => {
                              const props: string[] = [];
                              if (group.diameters.length > 0) {
                                props.push(`Ø${formatNumberRanges(group.diameters)}`);
                              }
                              if (group.frenchSizes.length > 0) {
                                props.push(`${formatNumberRanges(group.frenchSizes)}F`);
                              }
                              
                              return (
                                <div key={gIdx} style={{ padding: '2px 0', borderBottom: '1px dotted #eee' }}>
                                  {group.name}
                                  {props.length > 0 && (
                                    <span style={{ color: '#666' }}> ({props.join(', ')})</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Footer */}
                        <div style={{ 
                          marginTop: '4px', 
                          paddingTop: '2px', 
                          borderTop: '1px solid #eee',
                          fontSize: '12px', 
                          color: '#999',
                          textAlign: 'center',
                        }}>
                          ID: {allLabelsCabinet?.id}-{label.compartment.id}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAllLabelsDialogOpen(false)}>Schließen</Button>
          <Button 
            onClick={handlePrintAllLabelsAction} 
            variant="contained" 
            startIcon={<PrintIcon />}
            disabled={allLabelsLoading || allLabels.length === 0}
          >
            Alle drucken
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Cabinets;
