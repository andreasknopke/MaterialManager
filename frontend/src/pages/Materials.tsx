import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  IconButton,
  Chip,
  Alert,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { materialAPI } from '../services/api';

const Materials: React.FC = () => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [hideZeroStock, setHideZeroStock] = useState(true);
  const [groupIdentical, setGroupIdentical] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const filter = location.state?.filter;
    if (filter) {
      setActiveFilter(filter);
    }
    fetchMaterials();
  }, [location.state]);

  const fetchMaterials = async () => {
    try {
      let response;
      const filter = location.state?.filter;
      
      if (filter === 'lowStock') {
        response = await materialAPI.getLowStock();
      } else if (filter === 'expiring') {
        response = await materialAPI.getExpiring();
      } else {
        response = await materialAPI.getAll();
      }
      
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
    { 
      field: 'name', 
      headerName: 'Bezeichnung', 
      minWidth: 150, 
      flex: 1,
      renderCell: (params) => (
        <Box>
          {params.value}
          {groupIdentical && params.row.grouped_count > 1 && (
            <Chip 
              label={`${params.row.grouped_count}x`} 
              size="small" 
              color="info" 
              sx={{ ml: 1, height: 18, fontSize: '0.7rem' }}
            />
          )}
        </Box>
      ),
    },
    { field: 'article_number', headerName: 'GTIN/Art.Nr.', width: 130 },
    { field: 'category_name', headerName: 'Kategorie', width: 120 },
    { field: 'company_name', headerName: 'Firma', width: 120 },
    { 
      field: 'cabinet_name', 
      headerName: 'Schrank', 
      width: 120,
      valueGetter: (params) => groupIdentical && params.row.locations ? params.row.locations : params.value,
    },
    { field: 'compartment_name', headerName: 'Fach', width: 80 },
    { field: 'size', headerName: 'Einh./Pkg.', width: 80 },
    { 
      field: 'current_stock', 
      headerName: 'Bestand', 
      width: 90, 
      type: 'number',
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          size="small" 
          color={params.value <= 0 ? 'error' : params.value <= (params.row.min_stock || 0) ? 'warning' : 'default'}
        />
      ),
    },
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

  const filteredMaterials = materials.filter((material: any) => {
    const matchesSearch = material.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const hasStock = hideZeroStock ? material.current_stock > 0 : true;
    
    return matchesSearch && hasStock;
  });

  // Gruppiere identische Materialien (gleiche GTIN oder gleicher Name)
  const groupedMaterials = React.useMemo(() => {
    if (!groupIdentical) return filteredMaterials;

    const groups = new Map<string, any>();
    
    filteredMaterials.forEach((material: any) => {
      // Gruppierungsschlüssel: GTIN wenn vorhanden, sonst Name
      const key = material.article_number || material.name;
      
      if (groups.has(key)) {
        const existing = groups.get(key);
        existing.current_stock += material.current_stock || 0;
        existing.grouped_count += 1;
        existing.grouped_ids.push(material.id);
        // Behalte die niedrigste min_stock
        if (material.min_stock > 0 && (existing.min_stock === 0 || material.min_stock < existing.min_stock)) {
          existing.min_stock = material.min_stock;
        }
        // Sammle alle Standorte
        if (material.cabinet_name) {
          existing.locations.add(material.cabinet_name);
        }
      } else {
        groups.set(key, {
          ...material,
          grouped_count: 1,
          grouped_ids: [material.id],
          locations: new Set(material.cabinet_name ? [material.cabinet_name] : []),
        });
      }
    });

    return Array.from(groups.values()).map(g => ({
      ...g,
      locations: Array.from(g.locations).join(', '),
    }));
  }, [filteredMaterials, groupIdentical]);

  const getFilterTitle = () => {
    if (activeFilter === 'lowStock') return 'Niedriger Bestand';
    if (activeFilter === 'expiring') return 'Ablaufende Materialien';
    return null;
  };

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

      {activeFilter && (
        <Alert 
          severity={activeFilter === 'lowStock' ? 'warning' : 'error'}
          sx={{ mb: 2 }}
          onClose={async () => {
            setActiveFilter(null);
            navigate('/materials', { replace: true, state: {} });
            try {
              const response = await materialAPI.getAll();
              const data = Array.isArray(response.data) ? response.data : [];
              setMaterials(data);
            } catch (error) {
              console.error('Fehler beim Laden der Materialien:', error);
            }
          }}
        >
          Filter aktiv: <strong>{getFilterTitle()}</strong> ({filteredMaterials.length} {filteredMaterials.length === 1 ? 'Material' : 'Materialien'})
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          label="Suche"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Nach Name, Kategorie oder Firma suchen..."
        />
        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={hideZeroStock}
                onChange={(e) => setHideZeroStock(e.target.checked)}
                color="primary"
              />
            }
            label="Materialien mit Bestand 0 ausblenden"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={groupIdentical}
                onChange={(e) => setGroupIdentical(e.target.checked)}
                color="primary"
              />
            }
            label="Identische Materialien gruppieren (GTIN/Name)"
          />
        </Box>
      </Paper>

      <Paper sx={{ height: { xs: 400, sm: 600 }, width: '100%' }}>
        <DataGrid
          rows={groupedMaterials}
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
