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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { categoryAPI, unitAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Categories: React.FC = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '',
    department_id: null as number | null,
    min_quantity: 0
  });

  useEffect(() => {
    fetchCategories();
    if (user?.isRoot) {
      fetchDepartments();
    }
  }, [user?.isRoot]);

  const fetchCategories = async () => {
    try {
      const response = await categoryAPI.getAll();
      const data = Array.isArray(response.data) ? response.data : [];
      setCategories(data);
    } catch (error) {
      console.error('Fehler beim Laden der Kategorien:', error);
      setCategories([]);
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

  const handleOpen = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ 
        name: category.name || '', 
        description: category.description || '',
        department_id: category.department_id || null,
        min_quantity: category.min_quantity || 0
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', description: '', department_id: user?.departmentId || null, min_quantity: 0 });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingCategory(null);
  };

  const handleSave = async () => {
    try {
      if (editingCategory) {
        await categoryAPI.update(editingCategory.id, formData);
      } else {
        await categoryAPI.create(formData);
      }
      fetchCategories();
      handleClose();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Kategorie wirklich löschen?')) {
      try {
        await categoryAPI.delete(id);
        fetchCategories();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
      }
    }
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', width: 200 },
    { 
      field: 'department_name', 
      headerName: 'Department', 
      width: 150,
      renderCell: (params) => params.value ? <Chip label={params.value} size="small" color="primary" /> : '-'
    },
    { field: 'description', headerName: 'Beschreibung', flex: 1 },
    { 
      field: 'min_quantity', 
      headerName: 'Mindestmenge', 
      width: 120,
      type: 'number',
      renderCell: (params) => (
        <Chip 
          label={params.value || 0} 
          size="small" 
          color={params.value > 0 ? 'warning' : 'default'}
        />
      )
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
        <Typography variant="h4">Kategorien</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Neue Kategorie
        </Button>
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={categories}
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
        <DialogTitle>{editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</DialogTitle>
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
                label="Beschreibung"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Mindestmenge"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })}
                helperText="Warngrenze für niedrigen Bestand dieser Kategorie"
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>
            {user?.isRoot && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={formData.department_id || ''}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value as number })}
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

export default Categories;
