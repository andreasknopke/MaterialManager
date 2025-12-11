import React, { useEffect, useState } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { cabinetAPI, unitAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Cabinets: React.FC = () => {
  const { user } = useAuth();
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    capacity: 0,
    unit_id: null as number | null,
  });

  useEffect(() => {
    fetchCabinets();
    if (user?.isRoot) {
      fetchDepartments();
    }
  }, [user?.isRoot]);

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

  const fetchDepartments = async () => {
    try {
      const response = await unitAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : [];
      setDepartments(data);
    } catch (error) {
      console.error('Fehler beim Laden der Departments:', error);
    }
  };

  const handleOpen = (cabinet?: any) => {
    if (cabinet) {
      setEditingCabinet(cabinet);
      setFormData({
        name: cabinet.name,
        location: cabinet.location || '',
        description: cabinet.description || '',
        capacity: cabinet.capacity || 0,
        unit_id: cabinet.unit_id || null,
      });
    } else {
      setEditingCabinet(null);
      setFormData({ name: '', location: '', description: '', capacity: 0, unit_id: user?.departmentId || null });
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

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'location', headerName: 'Standort', width: 200 },
    { 
      field: 'department_name', 
      headerName: 'Department', 
      width: 150,
      renderCell: (params) => params.value ? <Chip label={params.value} size="small" color="primary" /> : '-'
    },
    { field: 'description', headerName: 'Beschreibung', width: 250 },
    { field: 'capacity', headerName: 'Kapazität', width: 100, type: 'number' },
    {
      field: 'active',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => (
        <Chip 
          label={params.value ? 'Aktiv' : 'Inaktiv'} 
          color={params.value ? 'success' : 'default'} 
          size="small" 
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Aktionen',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <>
          <IconButton size="small" onClick={() => handleOpen(params.row)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDelete(params.row.id)}>
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
            {user?.isRoot && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={formData.unit_id || ''}
                    onChange={(e) => setFormData({ ...formData, unit_id: e.target.value as number })}
                    label="Department"
                  >
                    <MenuItem value="">
                      <em>Kein Department</em>
                    </MenuItem>
                    {departments.map((dept) => (
                      <MenuItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Abbrechen</Button>
          <Button onClick={handleSave} variant="contained">
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Cabinets;
