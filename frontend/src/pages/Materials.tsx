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
    { field: 'name', headerName: 'Bezeichnung', width: 200 },
    { field: 'category_name', headerName: 'Kategorie', width: 150 },
    { field: 'company_name', headerName: 'Firma', width: 150 },
    { field: 'cabinet_name', headerName: 'Schrank', width: 120 },
    { field: 'size', headerName: 'Größe', width: 100 },
    { field: 'current_stock', headerName: 'Bestand', width: 100, type: 'number' },
    { field: 'min_stock', headerName: 'Min. Bestand', width: 120, type: 'number' },
    {
      field: 'expiry_date',
      headerName: 'Verfallsdatum',
      width: 130,
      valueFormatter: (params) => {
        return params.value ? new Date(params.value).toLocaleDateString('de-DE') : '-';
      },
    },
    {
      field: 'stock_status',
      headerName: 'Status',
      width: 150,
      renderCell: (params) => getStatusChip(params.value),
    },
    {
      field: 'actions',
      headerName: 'Aktionen',
      width: 120,
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Materialien</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/materials/new')}
        >
          Neues Material
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

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredMaterials}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  );
};

export default Materials;
