import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  EventBusy as EventBusyIcon,
  Storage as StorageIcon,
  QrCodeScanner as QrCodeScannerIcon,
} from '@mui/icons-material';
import { materialAPI, cabinetAPI } from '../services/api';

interface Stats {
  totalMaterials: number;
  lowStockCount: number;
  expiringCount: number;
  totalCabinets: number;
}

interface LowStockCategory {
  category_id: number;
  category_name: string;
  min_quantity: number;
  total_stock: number;
  stock_status: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalMaterials: 0,
    lowStockCount: 0,
    expiringCount: 0,
    totalCabinets: 0,
  });
  const [lowStockCategories, setLowStockCategories] = useState<LowStockCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [materials, lowStock, expiring, cabinets] = await Promise.all([
          materialAPI.getAll(),
          materialAPI.getLowStock(),
          materialAPI.getExpiring(),
          cabinetAPI.getAll(),
        ]);

        console.log('Dashboard API Responses:', { materials, lowStock, expiring, cabinets });

        const materialsData = Array.isArray(materials.data) ? materials.data : [];
        const lowStockData = Array.isArray(lowStock.data) ? lowStock.data : [];
        const expiringData = Array.isArray(expiring.data) ? expiring.data : [];
        const cabinetsData = Array.isArray(cabinets.data) ? cabinets.data : [];

        setStats({
          totalMaterials: materialsData.length,
          lowStockCount: lowStockData.length,
          expiringCount: expiringData.length,
          totalCabinets: cabinetsData.length,
        });
        setLowStockCategories(lowStockData);
      } catch (error) {
        console.error('Fehler beim Laden der Statistiken:', error);
        setStats({
          totalMaterials: 0,
          lowStockCount: 0,
          expiringCount: 0,
          totalCabinets: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Materialien gesamt',
      value: stats.totalMaterials,
      icon: <InventoryIcon sx={{ fontSize: 40 }} />,
      color: '#1976d2',
    },
    {
      title: 'Kategorien unter Mindestbestand',
      value: stats.lowStockCount,
      icon: <WarningIcon sx={{ fontSize: 40 }} />,
      color: '#ff9800',
    },
    {
      title: 'Ablaufende Materialien',
      value: stats.expiringCount,
      icon: <EventBusyIcon sx={{ fontSize: 40 }} />,
      color: '#f44336',
    },
    {
      title: 'Schränke',
      value: stats.totalCabinets,
      icon: <StorageIcon sx={{ fontSize: 40 }} />,
      color: '#4caf50',
    },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
        Übersicht über Ihre Materialverwaltung
      </Typography>

      <Grid container spacing={3}>
        {/* Barcode Scanner - Icon */}
        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <QrCodeScannerIcon 
            sx={{ 
              fontSize: 120,
              color: '#000',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'scale(1.1)',
              }
            }}
            onClick={() => navigate('/scanner', { state: { autoOpenCamera: true } })}
          />
        </Grid>

        {/* Statistik-Karten */}
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                      {card.title}
                    </Typography>
                    <Typography variant="h4">{card.value}</Typography>
                  </Box>
                  <Box sx={{ color: card.color }}>{card.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Kategorien unter Mindestbestand */}
      {lowStockCategories.length > 0 && (
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#ff9800' }}>
                <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Kategorien unter Mindestbestand
              </Typography>
              <List dense>
                {lowStockCategories.map((cat) => (
                  <ListItem key={cat.category_id} divider>
                    <ListItemText
                      primary={cat.category_name}
                      secondary={`Bestand: ${cat.total_stock} / Mindest: ${cat.min_quantity}`}
                    />
                    <Chip 
                      label={`${cat.total_stock}/${cat.min_quantity}`}
                      color="warning"
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default Dashboard;
