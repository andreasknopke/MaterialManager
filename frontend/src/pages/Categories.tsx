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
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { categoryAPI } from '../services/api';

const Categories: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', description: '', min_quantity: 0, ops_code: '', zusatzentgelt: '' });

  useEffect(() => {
    fetchCategories();
  }, []);

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

  const handleOpen = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ 
        name: category.name, 
        description: category.description || '',
        min_quantity: category.min_quantity || 0,
        ops_code: category.ops_code || '',
        zusatzentgelt: category.zusatzentgelt || ''
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', description: '', min_quantity: 0, ops_code: '', zusatzentgelt: '' });
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
    { field: 'description', headerName: 'Beschreibung', flex: 1 },
    { field: 'ops_code', headerName: 'OPS-Code', width: 120 },
    { field: 'zusatzentgelt', headerName: 'Zusatzentgelt (ZE)', width: 140 },
    { 
      field: 'min_quantity', 
      headerName: 'Mindestmenge', 
      width: 130,
      renderCell: (params) => (
        <Chip 
          label={params.value || 0} 
          size="small" 
          color={params.value > 0 ? 'primary' : 'default'}
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
          <TextField
            fullWidth
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Beschreibung"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Mindestmenge (gesamt für alle Materialien dieser Kategorie)"
            type="number"
            value={formData.min_quantity}
            onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })}
            margin="normal"
            helperText="Die Gesamtmenge aller Materialien dieser Kategorie sollte mindestens diesen Wert haben"
            InputProps={{ inputProps: { min: 0 } }}
          />
          <TextField
            fullWidth
            label="OPS-Code"
            value={formData.ops_code}
            onChange={(e) => setFormData({ ...formData, ops_code: e.target.value })}
            margin="normal"
            helperText="Operationen- und Prozedurenschlüssel (optional)"
            placeholder="z.B. 8-83b.c1"
          />
          <TextField
            fullWidth
            label="Zusatzentgelt (ZE)"
            value={formData.zusatzentgelt}
            onChange={(e) => setFormData({ ...formData, zusatzentgelt: e.target.value })}
            margin="normal"
            helperText="Zusatzentgelt-Code für Krankenhausabrechnung (optional)"
            placeholder="z.B. ZE2025-123"
          />
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
