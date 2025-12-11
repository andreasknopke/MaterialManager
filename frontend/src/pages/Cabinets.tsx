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
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  QrCode2 as QrCodeIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { cabinetAPI } from '../services/api';
import QRCode from 'qrcode';
import { useReactToPrint } from 'react-to-print';

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
    { field: 'department_name', headerName: 'Department', width: 180 },
    { field: 'location', headerName: 'Standort', width: 200 },
    { field: 'description', headerName: 'Beschreibung', width: 250 },
    { field: 'capacity', headerName: 'Kapazität', width: 120, type: 'number' },
    {
      field: 'actions',
      headerName: 'Aktionen',
      width: 180,
      sortable: false,
      renderCell: (params) => (
        <>
          <IconButton size="small" onClick={() => handleOpen(params.row)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleShowQR(params.row)} color="primary">
            <QrCodeIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDelete(params.row.id)} color="error">
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
    </Box>
  );
};

export default Cabinets;
