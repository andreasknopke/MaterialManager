import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { materialAPI } from '../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Reports: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [lowStockCategories, setLowStockCategories] = useState<any[]>([]);
  const [expiringMaterials, setExpiringMaterials] = useState<any[]>([]);
  const [inactiveMaterials, setInactiveMaterials] = useState<any[]>([]);
  const [inactiveMonths, setInactiveMonths] = useState<number>(6);
  const [loading, setLoading] = useState(true);
  const [inactiveLoading, setInactiveLoading] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    fetchInactiveReport();
  }, [inactiveMonths]);

  const fetchReports = async () => {
    try {
      const [lowStock, expiring] = await Promise.all([
        materialAPI.getLowStock(),
        materialAPI.getExpiring(),
      ]);
      
      // Neues Format: { products: [...], categories: [...] }
      if (lowStock.data && typeof lowStock.data === 'object' && !Array.isArray(lowStock.data)) {
        setLowStockProducts(lowStock.data.products || lowStock.data.materials || []);
        setLowStockCategories(lowStock.data.categories || []);
      } else {
        // Fallback für altes Format
        setLowStockProducts(Array.isArray(lowStock.data) ? lowStock.data : []);
        setLowStockCategories([]);
      }
      
      const expiringData = Array.isArray(expiring.data) ? expiring.data : [];
      setExpiringMaterials(expiringData);
    } catch (error) {
      console.error('Fehler beim Laden der Berichte:', error);
      setLowStockProducts([]);
      setLowStockCategories([]);
      setExpiringMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInactiveReport = async () => {
    setInactiveLoading(true);
    try {
      const response = await materialAPI.getInactive(inactiveMonths);
      const data = Array.isArray(response.data) ? response.data : [];
      setInactiveMaterials(data);
    } catch (error) {
      console.error('Fehler beim Laden inaktiver Materialien:', error);
      setInactiveMaterials([]);
    } finally {
      setInactiveLoading(false);
    }
  };

  const lowStockProductColumns: GridColDef[] = [
    { field: 'gtin', headerName: 'GTIN', width: 140 },
    { field: 'name', headerName: 'Produkt', width: 250 },
    { field: 'category_name', headerName: 'Kategorie', width: 150 },
    { field: 'company_name', headerName: 'Firma', width: 130 },
    { field: 'total_stock', headerName: 'Bestand', width: 100, type: 'number' },
    { field: 'min_stock', headerName: 'Mindestmenge', width: 120, type: 'number' },
    {
      field: 'difference',
      headerName: 'Differenz',
      width: 100,
      type: 'number',
      valueGetter: (params) => (params.row.total_stock || 0) - params.row.min_stock,
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          color="error"
          size="small"
        />
      ),
    },
    { field: 'lot_count', headerName: 'Chargen', width: 90, type: 'number' },
    { field: 'cabinet_names', headerName: 'Schränke', width: 150 },
  ];

  const lowStockCategoryColumns: GridColDef[] = [
    { field: 'category_id', headerName: 'ID', width: 70 },
    { field: 'category_name', headerName: 'Kategorie', width: 250 },
    { field: 'total_stock', headerName: 'Gesamtbestand', width: 130, type: 'number' },
    { field: 'min_quantity', headerName: 'Mindestmenge', width: 130, type: 'number' },
    {
      field: 'difference',
      headerName: 'Differenz',
      width: 120,
      type: 'number',
      valueGetter: (params) => (params.row.total_stock || 0) - params.row.min_quantity,
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          color="error"
          size="small"
        />
      ),
    },
    { field: 'material_count', headerName: 'Materialien', width: 110, type: 'number' },
    { field: 'companies', headerName: 'Firmen', width: 200 },
  ];

  const expiringColumns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Bezeichnung', width: 250 },
    { field: 'category_name', headerName: 'Kategorie', width: 150 },
    { field: 'company_name', headerName: 'Firma', width: 150 },
    {
      field: 'expiry_date',
      headerName: 'Verfallsdatum',
      width: 150,
      valueFormatter: (params) => {
        return params.value ? new Date(params.value).toLocaleDateString('de-DE') : '-';
      },
    },
    {
      field: 'days_until_expiry',
      headerName: 'Tage bis Ablauf',
      width: 150,
      type: 'number',
    },
    { field: 'current_stock', headerName: 'Bestand', width: 120, type: 'number' },
  ];

  const inactiveColumns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Bezeichnung', width: 250 },
    { field: 'article_number', headerName: 'Artikelnummer', width: 140 },
    { field: 'lot_number', headerName: 'LOT', width: 120 },
    { field: 'category_name', headerName: 'Kategorie', width: 150 },
    { field: 'company_name', headerName: 'Firma', width: 150 },
    { field: 'cabinet_name', headerName: 'Schrank', width: 150 },
    { field: 'current_stock', headerName: 'Bestand', width: 100, type: 'number' },
    {
      field: 'months_inactive',
      headerName: 'Monate inaktiv',
      width: 130,
      type: 'number',
      renderCell: (params) => (
        <Chip 
          label={`${params.value} Monate`} 
          color={params.value >= 12 ? 'error' : params.value >= 6 ? 'warning' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'last_updated',
      headerName: 'Letzte Änderung',
      width: 140,
      valueFormatter: (params) => {
        return params.value ? new Date(params.value).toLocaleDateString('de-DE') : '-';
      },
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Berichte
      </Typography>

      <Paper sx={{ mt: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label={`Niedriger Bestand (${lowStockProducts.length + lowStockCategories.length})`} />
          <Tab label={`Ablaufende Materialien (${expiringMaterials.length})`} />
          <Tab label={`Inaktive Bestände (${inactiveMaterials.length})`} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {(lowStockProducts.length > 0 || lowStockCategories.length > 0) ? (
            <>
              {/* Kategorie-basierter Low-Stock */}
              {lowStockCategories.length > 0 && (
                <>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <strong>Kategorien unter Mindestmenge:</strong> {lowStockCategories.length} Kategorie(n) haben insgesamt zu wenig Bestand
                  </Alert>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Kategorien (z.B. "Re-Entry Device" - firmenübergreifend)
                  </Typography>
                  <Box sx={{ height: 300, mb: 3 }}>
                    <DataGrid
                      rows={lowStockCategories}
                      columns={lowStockCategoryColumns}
                      loading={loading}
                      getRowId={(row) => row.category_id}
                      pageSizeOptions={[10, 25]}
                      initialState={{
                        pagination: { paginationModel: { pageSize: 10 } },
                      }}
                      disableRowSelectionOnClick
                    />
                  </Box>
                  <Divider sx={{ my: 3 }} />
                </>
              )}
              
              {/* Produkt-basierter Low-Stock */}
              {lowStockProducts.length > 0 && (
                <>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <strong>Produkte unter Mindestmenge:</strong> {lowStockProducts.length} Produkt(e)
                  </Alert>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Produkte (GTIN-basiert, alle Chargen zusammengefasst)
                  </Typography>
                  <Box sx={{ height: 400 }}>
                    <DataGrid
                      rows={lowStockProducts}
                      columns={lowStockProductColumns}
                      loading={loading}
                      getRowId={(row) => row.product_id}
                      pageSizeOptions={[10, 25, 50]}
                      initialState={{
                        pagination: { paginationModel: { pageSize: 25 } },
                      }}
                      disableRowSelectionOnClick
                    />
                  </Box>
                </>
              )}
              
              {lowStockProducts.length === 0 && lowStockCategories.length > 0 && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Alle Produkte haben ausreichenden Bestand
                </Alert>
              )}
            </>
          ) : (
            <Alert severity="success">
              Alle Produkte und Kategorien haben ausreichenden Bestand
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {expiringMaterials.length > 0 ? (
            <>
              <Alert severity="error" sx={{ mb: 2 }}>
                {expiringMaterials.length} Material(ien) laufen in den nächsten 90 Tagen ab
              </Alert>
              <Box sx={{ height: 500 }}>
                <DataGrid
                  rows={expiringMaterials}
                  columns={expiringColumns}
                  loading={loading}
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 25 } },
                  }}
                  disableRowSelectionOnClick
                />
              </Box>
            </>
          ) : (
            <Alert severity="success">
              Keine ablaufenden Materialien in den nächsten 90 Tagen
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Inaktiv seit</InputLabel>
              <Select
                value={inactiveMonths}
                label="Inaktiv seit"
                onChange={(e) => setInactiveMonths(e.target.value as number)}
              >
                <MenuItem value={6}>6 Monaten</MenuItem>
                <MenuItem value={12}>12 Monaten</MenuItem>
                <MenuItem value={18}>18 Monaten</MenuItem>
                <MenuItem value={24}>24 Monaten</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary">
              Materialien, die seit mindestens {inactiveMonths} Monaten nicht bewegt wurden
            </Typography>
          </Box>
          
          {inactiveMaterials.length > 0 ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                {inactiveMaterials.length} Material(ien) wurden seit {inactiveMonths} Monaten nicht bewegt
              </Alert>
              <Box sx={{ height: 500 }}>
                <DataGrid
                  rows={inactiveMaterials}
                  columns={inactiveColumns}
                  loading={inactiveLoading}
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 25 } },
                    sorting: { sortModel: [{ field: 'months_inactive', sort: 'desc' }] },
                  }}
                  disableRowSelectionOnClick
                />
              </Box>
            </>
          ) : (
            <Alert severity="success">
              Keine inaktiven Materialien seit {inactiveMonths} Monaten gefunden
            </Alert>
          )}
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default Reports;
