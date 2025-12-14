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
            <div ref={printRef} style={{ padding: '30px', backgroundColor: 'white', width: '100%', fontFamily: 'Arial, sans-serif' }}>
              {qrCodeUrl && (
                <>
                  {/* Header mit QR-Code */}
                  <Box sx={{ textAlign: 'center', mb: 4, borderBottom: '2px solid #333', pb: 3 }}>
                    <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: '#333' }}>
                      {selectedCabinet?.name}
                    </Typography>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      {selectedCabinet?.location}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                      <img src={qrCodeUrl} alt="QR Code" style={{ width: '200px', height: '200px' }} />
                    </Box>
                    <Typography variant="caption" display="block" color="text.secondary">
                      Scannen Sie diesen Code beim Erfassen von Material
                    </Typography>
                  </Box>

                  {/* Fächer und Inhalt */}
                  {infosheetLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : infosheetCompartments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                      Keine Fächer vorhanden
                    </Typography>
                  ) : (
                    <Box>
                      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3, color: '#333' }}>
                        Fächer und Inhalt
                      </Typography>
                      
                      {infosheetCompartments.map((compartment, idx) => (
                        <Box key={compartment.id} sx={{ mb: 4, pageBreakInside: 'avoid' }}>
                          {/* Fachname */}
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 'bold', 
                              backgroundColor: '#f5f5f5', 
                              padding: '8px 12px',
                              borderLeft: '4px solid #1976d2',
                              mb: 2
                            }}
                          >
                            {compartment.name}
                            {compartment.description && (
                              <Typography variant="body2" component="span" sx={{ ml: 2, fontWeight: 'normal', color: '#666' }}>
                                ({compartment.description})
                              </Typography>
                            )}
                          </Typography>

                          {/* Materialien im Fach */}
                          {compartment.materials.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontStyle: 'italic' }}>
                              Leer
                            </Typography>
                          ) : (
                            <Box sx={{ ml: 2 }}>
                              {compartment.materials.map((material, matIdx) => (
                                <Box 
                                  key={`${material.article_number}-${matIdx}`} 
                                  sx={{ 
                                    mb: 1.5, 
                                    pb: 1.5, 
                                    borderBottom: matIdx < compartment.materials.length - 1 ? '1px solid #e0e0e0' : 'none'
                                  }}
                                >
                                  {/* Kategorie als Hauptüberschrift */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                      {material.category_name || 'Ohne Kategorie'}
                                    </Typography>
                                    {material.is_consignment && (
                                      <Chip 
                                        label="Konsignationsware" 
                                        size="small"
                                        color="warning"
                                        sx={{ height: '20px', fontSize: '0.7rem' }}
                                      />
                                    )}
                                  </Box>

                                  {/* Device-Eigenschaften */}
                                  <Box sx={{ ml: 2 }}>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                      {material.shape_name && (
                                        <Chip
                                          label={`Form: ${material.shape_name}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontSize: '0.75rem' }}
                                        />
                                      )}
                                      {material.shaft_length && (
                                        <Chip
                                          label={`Schaftlänge: ${material.shaft_length}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontSize: '0.75rem' }}
                                        />
                                      )}
                                      {material.device_length && (
                                        <Chip
                                          label={`Device-Länge: ${material.device_length}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontSize: '0.75rem' }}
                                        />
                                      )}
                                      {material.device_diameter && (
                                        <Chip
                                          label={`Device-Durchmesser: ${material.device_diameter}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontSize: '0.75rem' }}
                                        />
                                      )}
                                      {material.french_size && (
                                        <Chip
                                          label={`French-Size: ${material.french_size}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontSize: '0.75rem' }}
                                        />
                                      )}
                                      {material.guidewire_acceptance && (
                                        <Chip
                                          label={`Guidewire-Acceptance: ${material.guidewire_acceptance}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontSize: '0.75rem' }}
                                        />
                                      )}
                                    </Box>
                                    {!material.shape_name && !material.shaft_length && !material.device_length && 
                                     !material.device_diameter && !material.french_size && !material.guidewire_acceptance && (
                                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                        Keine Eigenschaften definiert
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              ))}
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
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '2px' }}>
                    {compartmentCabinet?.name}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1976d2' }}>
                    {selectedCompartment?.name}
                  </div>
                  {compartmentCabinet?.location && (
                    <div style={{ fontSize: '10px', color: '#666' }}>
                      {compartmentCabinet.location}
                    </div>
                  )}
                </div>
                {compartmentQrCodeUrl && (
                  <img 
                    src={compartmentQrCodeUrl} 
                    alt="QR Code" 
                    style={{ width: '25mm', height: '25mm' }} 
                  />
                )}
              </div>
              
              {/* Materialien-Liste */}
              {compartmentMaterialsLoading ? (
                <div style={{ textAlign: 'center', padding: '10px' }}>
                  <CircularProgress size={20} />
                </div>
              ) : compartmentMaterials.length === 0 ? (
                <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', padding: '10px' }}>
                  Keine Materialien in diesem Fach
                </div>
              ) : (
                <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <th style={{ textAlign: 'left', padding: '2px', fontWeight: 'bold' }}>Material</th>
                      <th style={{ textAlign: 'right', padding: '2px', fontWeight: 'bold', width: '40px' }}>Bestand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compartmentMaterials.map((mat, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px dotted #eee' }}>
                        <td style={{ padding: '2px' }}>
                          {mat.name}
                          {mat.size && <span style={{ color: '#666' }}> ({mat.size})</span>}
                        </td>
                        <td style={{ textAlign: 'right', padding: '2px', fontWeight: 'bold' }}>
                          {mat.total_stock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
    </Box>
  );
};

export default Cabinets;
