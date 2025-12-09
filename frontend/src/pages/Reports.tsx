import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Alert,
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
  const [lowStockMaterials, setLowStockMaterials] = useState<any[]>([]);
  const [expiringMaterials, setExpiringMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const [lowStock, expiring] = await Promise.all([
        materialAPI.getLowStock(),
        materialAPI.getExpiring(),
      ]);
      const lowStockData = Array.isArray(lowStock.data) ? lowStock.data : [];
      const expiringData = Array.isArray(expiring.data) ? expiring.data : [];
      setLowStockMaterials(lowStockData);
      setExpiringMaterials(expiringData);
    } catch (error) {
      console.error('Fehler beim Laden der Berichte:', error);
      setLowStockMaterials([]);
      setExpiringMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const lowStockColumns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Bezeichnung', width: 250 },
    { field: 'category_name', headerName: 'Kategorie', width: 150 },
    { field: 'current_stock', headerName: 'Bestand', width: 120, type: 'number' },
    { field: 'min_stock', headerName: 'Min. Bestand', width: 120, type: 'number' },
    {
      field: 'difference',
      headerName: 'Differenz',
      width: 120,
      type: 'number',
      valueGetter: (params) => params.row.current_stock - params.row.min_stock,
    },
    { field: 'cabinet_name', headerName: 'Schrank', width: 150 },
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

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Berichte
      </Typography>

      <Paper sx={{ mt: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label={`Niedriger Bestand (${lowStockMaterials.length})`} />
          <Tab label={`Ablaufende Materialien (${expiringMaterials.length})`} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {lowStockMaterials.length > 0 ? (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                {lowStockMaterials.length} Material(ien) haben einen niedrigen Bestand
              </Alert>
              <Box sx={{ height: 500 }}>
                <DataGrid
                  rows={lowStockMaterials}
                  columns={lowStockColumns}
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
              Alle Materialien haben ausreichenden Bestand
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
      </Paper>
    </Box>
  );
};

export default Reports;
