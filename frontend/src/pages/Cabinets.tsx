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
  Collapse,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  QrCode2 as QrCodeIcon,
  Print as PrintIcon,
  Inventory as InventoryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
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

const Cabinets: React.FC = () => {
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<any>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedCabinet, setSelectedCabinet] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
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

  const handleAddCompartment = () => {
    setEditingCompartment(null);
    setCompartmentForm({ name: '', description: '' });
    setCompartmentError(null);
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

  const handleShowQR = async (cabinet: any) => {
    setSelectedCabinet(cabinet);
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
      setQrDialogOpen(true);
    } catch (error) {
      console.error('Fehler beim Generieren des QR-Codes:', error);
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
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          QR-Code für Schrank: {selectedCabinet?.name}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={2}>
            <div ref={printRef} style={{ padding: '20px', textAlign: 'center', backgroundColor: 'white' }}>
              {qrCodeUrl && (
                <>
                  <Typography variant="h6" gutterBottom>
                    {selectedCabinet?.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {selectedCabinet?.location}
                  </Typography>
                  <img src={qrCodeUrl} alt="QR Code" style={{ width: '100%', maxWidth: '400px' }} />
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Scannen Sie diesen Code beim Erfassen von Material
                  </Typography>
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
    </Box>
  );
};

export default Cabinets;
