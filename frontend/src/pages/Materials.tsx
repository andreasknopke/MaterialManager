import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  IconButton,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { materialAPI } from '../services/api';

const Materials: React.FC = () => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const response = await materialAPI.getAll();
      console.log('API Response:', response.data);
      // Sicherstellen, dass wir ein Array haben
      const data = Array.isArray(response.data) ? response.data : [];
      setMaterials(data);
    } catch (error) {
      console.error('Fehler beim Laden der Materialien:', error);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Material wirklich deaktivieren?')) {
      try {
        await materialAPI.delete(id);
        fetchMaterials();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
      }
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'LOW':
        return <Chip label="Niedriger Bestand" color="warning" size="small" />;
      case 'EXPIRING':
        return <Chip label="Läuft ab" color="error" size="small" />;
      default:
        return <Chip label="OK" color="success" size="small" />;
    }
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Bezeichnung', minWidth: 150, flex: 1 },
    { field: 'category_name', headerName: 'Kategorie', width: 120 },
    { field: 'company_name', headerName: 'Firma', width: 120 },
    { field: 'cabinet_name', headerName: 'Schrank', width: 100 },
    { field: 'size', headerName: 'Größe', width: 80 },
    { field: 'current_stock', headerName: 'Bestand', width: 90, type: 'number' },
    { field: 'min_stock', headerName: 'Min.', width: 70, type: 'number' },
    {
      field: 'expiry_date',
      headerName: 'Verfallsdatum',
      width: 110,
      valueFormatter: (params) => {
        return params.value ? new Date(params.value).toLocaleDateString('de-DE') : '-';
      },
    },
    {
      field: 'stock_status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => getStatusChip(params.value),
    },
    {
      field: 'actions',
      headerName: 'Aktionen',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <>
          <IconButton
            size="small"
            onClick={() => navigate(`/materials/${params.row.id}`)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  const filteredMaterials = materials.filter((material: any) =>
    material.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={1}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>Materialien</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon sx={{ display: { xs: 'none', sm: 'inline-block' } }} />}
          onClick={() => navigate('/materials/new')}
          size="small"
          sx={{ minWidth: { xs: 'auto', sm: 'unset' } }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Neues Material</Box>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Neu</Box>
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          label="Suche"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Nach Name, Kategorie oder Firma suchen..."
        />
      </Paper>

      <Paper sx={{ height: { xs: 400, sm: 600 }, width: '100%' }}>
        <DataGrid
          rows={filteredMaterials}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            columns: {
              columnVisibilityModel: {
                id: false,
                category_name: false,
                company_name: false,
                cabinet_name: false,
                size: false,
                min_stock: false,
                expiry_date: false,
              },
            },
          }}
          disableRowSelectionOnClick
          sx={{
            '& .MuiDataGrid-cell': {
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              padding: { xs: '4px', sm: '8px' },
            },
            '& .MuiDataGrid-columnHeaders': {
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
            },
          }}
        />
      </Paper>
    </Box>
  );
};

export default Materials;
